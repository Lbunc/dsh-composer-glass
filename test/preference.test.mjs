/**
 * Tests for the durable on/off preference.
 *
 * Two layers are covered:
 *
 * 1. The Host schema and registration (`lib/index.js`) — pure functions, run
 *    directly.
 * 2. The browser half's settings wiring (`lib/client.js`) — loaded the way
 *    DSH loads it (a `window.__ModuleLoader__.load` factory), then driven with
 *    fake `slots` / `locale` / `settingsScope` services and a fake DOM. That
 *    proves the two behaviours this change exists for: a stored choice wins on
 *    first paint, and a click writes back through the settings scope.
 *
 * The browser half is re-imported per test with a cache-busting query so each
 * test gets fresh module scope (the real page does the same on every reload).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_ENABLED,
  SETTINGS_FIELD,
  SETTINGS_NAMESPACE,
  apply as hostApply,
  inject as hostInject,
  preferenceSchema,
} from '../lib/index.js'

// ------------------------------------------------------------------- host half

test('preferenceSchema: defaults, whitelists, and coerces to a boolean', () => {
  assert.deepEqual(preferenceSchema(undefined), { enabled: DEFAULT_ENABLED })
  assert.deepEqual(preferenceSchema(null), { enabled: true })
  assert.deepEqual(preferenceSchema({ enabled: false }), { enabled: false })
  assert.deepEqual(preferenceSchema({ enabled: true }), { enabled: true })
  // A field the schema does not name must not survive: the service would store
  // the raw value, but every reader sees this resolved shape.
  assert.deepEqual(preferenceSchema({ enabled: false, ghost: 1 }), { enabled: false })
  // Anything that is not a boolean falls back to the default rather than
  // letting a truthy string flip the pane.
  assert.deepEqual(preferenceSchema({ enabled: 'off' }), { enabled: true })
  assert.deepEqual(preferenceSchema({ enabled: 0 }), { enabled: true })
})

test('preferenceSchema.toJSON: the wire envelope settings.describe serializes', () => {
  assert.deepEqual(preferenceSchema.toJSON(), { type: 'object', dict: {} })
})

test('host apply: registers the shared namespace with an on base layer', () => {
  assert.ok(hostInject.includes('settings'), 'the host half must inject settings')
  const calls = []
  hostApply({ settings: { register: (...args) => calls.push(args) } })
  assert.equal(calls.length, 1)
  const [ns, schema, options] = calls[0]
  assert.equal(ns, SETTINGS_NAMESPACE)
  assert.equal(schema, preferenceSchema)
  assert.deepEqual(options, { base: { [SETTINGS_FIELD]: DEFAULT_ENABLED } })
})

// ----------------------------------------------------------------- client half

let importCounter = 0

/** A minimal fake DOM; only the surfaces the plugin actually touches. */
function makeDocument() {
  const attributes = new Map()
  const styles = []
  return {
    attributes,
    styles,
    documentElement: {
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: (name) => attributes.get(name),
      removeAttribute: (name) => attributes.delete(name),
    },
    head: { appendChild: (el) => { styles.push(el) } },
    createElement: (tag) => ({ tag, dataset: {}, textContent: '', remove: () => {} }),
  }
}

/** A React stand-in: createElement builds a plain tree, hooks are inert. */
function makeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => [initial, () => {}],
    useEffect: (effect) => effect(),
  }
}

/**
 * Load one fresh instance of the browser half and apply it against `scope`.
 * @returns the captured registrations, the fake DOM, and the bound scope spec.
 */
async function loadAndApply(scope) {
  let definition = null
  // The shell's global is `__ModuleLoader__`; build the name from parts so the
  // literal never depends on how the surrounding text renders underscores.
  const loaderKey = '__Module' + 'Loader__'
  globalThis.window = {}
  globalThis.window[loaderKey] = { load: (def) => { definition = def } }
  const doc = makeDocument()
  globalThis.document = doc

  const url = new URL('../lib/client.js', import.meta.url).href + '?case=' + String(++importCounter)
  await import(url)
  assert.ok(definition, 'the browser half must call window.__ModuleLoader__.load')

  const mod = definition.factory((spec) => {
    if (spec === 'react') return makeReact()
    throw new Error('unexpected require: ' + spec)
  })

  const registered = []
  const bound = []
  const ctx = {
    effect: (fn) => fn(),
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    slots: {
      inject: (name, cb) => cb(),
      register: (options, Component) => {
        registered.push({ options, Component })
        return () => {}
      },
    },
    settingsScope: {
      bind: (spec) => {
        bound.push(spec)
        return scope
      },
    },
  }
  mod.apply(ctx)
  return { mod, doc, registered, bound, styles: doc.styles }
}

/** A settings scope whose snapshot the test drives by hand. */
function makeScope() {
  const listeners = new Set()
  const writes = []
  const scope = {
    writes,
    snapshot: { status: 'loading', value: undefined, revision: undefined, writable: true, mode: 'host' },
    getSnapshot: () => scope.snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: (field, value) => {
      writes.push([field, value])
      return Promise.resolve()
    },
    /** Simulate the Host document arriving / committing. */
    publish: (status, value) => {
      scope.snapshot = { ...scope.snapshot, status, value, revision: (scope.snapshot.revision || 0) + 1 }
      for (const listener of [...listeners]) listener()
    },
  }
  return scope
}

function findButtons(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.type === 'button') out.push(node)
  for (const child of node.children || []) findButtons(child, out)
  return out
}

test('client: the shared material covers the composer, todo dock, to-bottom button, and status chip', async () => {
  const scope = makeScope()
  const { styles } = await loadAndApply(scope)
  const css = styles.map((el) => el.textContent).join('\n')
  // Every surface is gated by the persisted on/off attribute, never applied unconditionally.
  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-composer-card\]/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-testid="todo-panel"\]/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \.EvIC1a_toBottom\b/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-composer-stats\]/)
  // The todo dock is one surface for both collapsed and expanded states.
  assert.match(css, /\[data-testid="todo-panel"\]::after/)
  // Four surfaces, each with the prefixed and unprefixed blur declaration.
  assert.equal((css.match(/backdrop-filter:/g) || []).length, 8)
})

test('client: declares settingsScope alongside slots and locale', async () => {
  const scope = makeScope()
  const { mod } = await loadAndApply(scope)
  assert.deepEqual(mod.inject, ['slots', 'locale', 'settingsScope'])
  assert.equal(scope.writes.length, 0, 'apply must not fabricate a user write')
})

test('client: a stored "off" wins on first paint', async () => {
  const scope = makeScope()
  scope.publish('ready', { enabled: false })
  const { doc, bound } = await loadAndApply(scope)
  assert.equal(bound[0].namespace, 'composer-glass')
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off')
  assert.equal(scope.writes.length, 0)
})

test('client: a stored "on" paints on', async () => {
  const scope = makeScope()
  scope.publish('ready', { enabled: true })
  const { doc } = await loadAndApply(scope)
  assert.equal(doc.attributes.get('data-dsh-glass'), 'on')
})

test('client: with no document yet the pane starts on and corrects on commit', async () => {
  const scope = makeScope()
  const { doc } = await loadAndApply(scope)
  assert.equal(doc.attributes.get('data-dsh-glass'), 'on', 'schema default on first paint')

  scope.publish('ready', { enabled: false })
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off', 'subscription adopts the stored value')
  assert.equal(scope.writes.length, 0, 'adopting the stored value is not a write')
})

test('client: clicking the row writes the choice through the scope', async () => {
  const scope = makeScope()
  scope.publish('ready', { enabled: true })
  const { doc, registered } = await loadAndApply(scope)

  const row = registered.find((entry) => entry.options.id === 'dsh-glass-pane')
  assert.ok(row, 'the Settings -> General row must be registered')

  const buttons = findButtons(row.Component({ t: (key) => key }))
  const off = buttons.find((button) => button.children[0] === 'opt.off')
  const on = buttons.find((button) => button.children[0] === 'opt.on')
  assert.ok(off && on)

  off.props.onClick()
  assert.deepEqual(scope.writes, [['enabled', false]])
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off')

  on.props.onClick()
  assert.deepEqual(scope.writes, [['enabled', false], ['enabled', true]])
  assert.equal(doc.attributes.get('data-dsh-glass'), 'on')
})

/**
 * Tests for the durable on/off preference (DSH 0.1.7-rc.1 API).
 *
 * Two layers are covered:
 *
 * 1. The Host Config (`lib/index.js`) — the Schemastery schema declaring the
 *    volatile `enabled` field, run directly.
 * 2. The browser half's settings wiring (`lib/client.js`) — loaded the way
 *    DSH loads it (a `window.__ModuleLoader__.load` factory), then driven with
 *    fake `slots` / `locale` / `configForms` services and a fake DOM. That
 *    proves the two behaviours this change exists for: a stored choice wins on
 *    first paint, and a click writes back through the config form.
 *
 * The browser half is re-imported per test with a cache-busting query so each
 * test gets fresh module scope (the real page does the same on every reload).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Config,
  DEFAULT_ENABLED,
  SETTINGS_FIELD,
  apply as hostApply,
  name as hostName,
} from '../lib/index.js'

/** A volatile field resolves to a frozen `{ get() }` reference; unwrap either shape. */
function unwrap(value) {
  return value && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

// ------------------------------------------------------------------- host half

test('host name: matches the bundle patch row id', () => {
  assert.equal(hostName, 'composer-glass')
})

test('Config: volatile enabled defaults to on', () => {
  const resolved = Config({})
  assert.equal(unwrap(resolved[SETTINGS_FIELD]), DEFAULT_ENABLED)
})

test('Config: a stored boolean survives resolution, non-boolean input is rejected by the schema', () => {
  assert.equal(unwrap(Config({ [SETTINGS_FIELD]: false })[SETTINGS_FIELD]), false)
  assert.equal(unwrap(Config({ [SETTINGS_FIELD]: true })[SETTINGS_FIELD]), true)
  assert.throws(() => Config({ [SETTINGS_FIELD]: 'off' }), undefined, 'schemastery rejects non-boolean input')
})

test('host apply: a bodyless line — the Config declaration is the whole contribution', () => {
  // apply exists only so the Loader line has a body; it must not touch services.
  hostApply({})
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
 * A primitives stand-in. `Menu` renders only its anchor and exposes `onSelect`
 * on the element tree; the popup itself belongs to DSH and is not exercised.
 */
function makePrimitives() {
  const Menu = function Menu(props) { return props.anchor }
  const IconChevronDownOutline14 = function IconChevronDownOutline14() { return null }
  return { Menu, IconChevronDownOutline14 }
}

/**
 * Load one fresh instance of the browser half and apply it against `form`.
 * @returns the captured registrations, the fake DOM, and the requested entry id.
 */
async function loadAndApply(form) {
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

  const primitives = makePrimitives()
  const mod = definition.factory((spec) => {
    if (spec === 'react') return makeReact()
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error('unexpected require: ' + spec)
  })

  const registered = []
  const requested = []
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
    remote: {},
    configForms: {
      get: (entryId) => {
        requested.push(entryId)
        return form
      },
    },
  }
  mod.apply(ctx)
  return { mod, doc, registered, requested, styles: doc.styles, primitives }
}

/** A config form whose snapshot the test drives by hand (ConfigForm shape). */
function makeForm() {
  const listeners = new Set()
  const writes = []
  const form = {
    writes,
    snapshot: { status: 'loading', value: undefined, base: undefined, user: undefined, revision: undefined, writable: true, mode: 'host' },
    getSnapshot: () => form.snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: (field, value) => {
      writes.push([field, value])
      return Promise.resolve(true)
    },
    unset: () => Promise.resolve(true),
    mutate: () => Promise.resolve(true),
    /** Simulate the Host document arriving / committing. */
    publish: (status, value) => {
      form.snapshot = { ...form.snapshot, status, value, revision: (form.snapshot.revision || 0) + 1 }
      for (const listener of [...listeners]) listener()
    },
  }
  return form
}

/** Depth-first search for the first element built from `type`. */
function findByType(node, type) {
  if (!node || typeof node !== 'object') return null
  if (node.type === type) return node
  for (const child of node.children || []) {
    const found = findByType(child, type)
    if (found) return found
  }
  return null
}

/** Collect every element whose className contains the given class. */
function collectByClass(node, cls, acc = []) {
  if (!node || typeof node !== 'object') return acc
  if (typeof node.props?.className === 'string' && node.props.className.split(' ').includes(cls)) {
    acc.push(node)
  }
  for (const child of node.children || []) collectByClass(child, cls, acc)
  return acc
}

test('client: the shared material covers the composer, todo dock, to-bottom button, and status chip', async () => {
  const form = makeForm()
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')
  // Every surface is gated by the persisted on/off attribute, never applied unconditionally.
  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-composer-card\]/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-testid="todo-panel"\]/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \.EvIC1a_toBottom\b/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-composer-stats\]/)
  // The context-usage pill is its own capsule next to the stats pill.
  assert.match(css, /:root\[data-dsh-glass="on"\] \.JObwrW_root\b/)
  // The todo dock is one surface for both collapsed and expanded states.
  assert.match(css, /\[data-testid="todo-panel"\]::after/)
  // Five surfaces, each with the prefixed and unprefixed blur declaration.
  assert.equal((css.match(/backdrop-filter:/g) || []).length, 10)
})

test('client: the shipped chrome is restored when the preference is OFF', async () => {
  const form = makeForm()
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')
  // Clearing the opaque chrome is part of the glass, not a permanent override:
  // ungated, it kept the message flow running to the bottom of the seat with the
  // preference OFF instead of letting the shipped fade mask it again.
  assert.match(css, /:root\[data-dsh-glass="on"\] \.wSkVaW_composerSeat \{ background: none !important; \}/)
  assert.doesNotMatch(css, /(^|\n)\.wSkVaW_/)
})

test('client: declares configForms and remote alongside slots and locale', async () => {
  const form = makeForm()
  const { mod } = await loadAndApply(form)
  assert.deepEqual(mod.inject, ['slots', 'locale', 'remote', 'configForms'])
  assert.equal(form.writes.length, 0, 'apply must not fabricate a user write')
})

test('client: a stored "off" wins on first paint', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: false })
  const { doc, requested } = await loadAndApply(form)
  assert.deepEqual(requested, ['composer-glass'])
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off')
  assert.equal(form.writes.length, 0)
})

test('client: a stored "on" paints on', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: true })
  const { doc } = await loadAndApply(form)
  assert.equal(doc.attributes.get('data-dsh-glass'), 'on')
})

test('client: with no document yet the pane starts on and corrects on commit', async () => {
  const form = makeForm()
  const { doc } = await loadAndApply(form)
  assert.equal(doc.attributes.get('data-dsh-glass'), 'on', 'schema default on first paint')

  form.publish('ready', { enabled: false })
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off', 'subscription adopts the stored value')
  assert.equal(form.writes.length, 0, 'adopting the stored value is not a write')
})

test('client: choosing an option writes the choice through the form', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: true })
  const { doc, registered, primitives } = await loadAndApply(form)

  const card = registered.find((entry) => entry.options.name === 'plugins.row.config')
  assert.ok(card, 'the Plugins-page row-config card must be registered')
  assert.equal(card.options.key, 'dsh-composer-glass#composer-glass', 'card key pairs bundle package with patch row id')

  // The summary view renders the one-liner; the page view hosts the switch.
  const summary = card.Component({ t: (key) => key, view: 'summary' })
  assert.equal(summary.props.className, 'dsh-glass-cardSummary')
  assert.deepEqual(summary.children, ['card.summary'])

  // The page view returns a GlassRow element; render that function component
  // by hand (the fake React does not expand it) before searching for pills.
  const tree = card.Component({ t: (key) => key, view: 'page' })
  const rowTree = typeof tree.type === 'function' ? tree.type(tree.props) : tree
  const group = findByType(rowTree, primitives.Menu)
  assert.ok(!group, 'no Menu primitive may be used — profiles do not ship it')

  const pills = collectByClass(rowTree, 'dsh-glass-pill')
  assert.equal(pills.length, 2, 'the card must offer exactly two pill buttons')
  assert.match(pills[0].props.className, / on$/, 'on pill starts selected')
  assert.doesNotMatch(pills[1].props.className, / on$/)

  pills[1].props.onClick()
  assert.deepEqual(form.writes, [['enabled', false]])
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off')

  pills[0].props.onClick()
  assert.deepEqual(form.writes, [['enabled', false], ['enabled', true]])
  assert.equal(doc.attributes.get('data-dsh-glass'), 'on')
})

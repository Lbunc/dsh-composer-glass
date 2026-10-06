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
  WALLPAPER_ROUTE,
  apply as hostApply,
  kindFor,
  mimeFor,
  name as hostName,
  parseRange,
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

test('host apply: Config is the whole contribution; the route hook degrades gracefully', () => {
  // The Config declaration is the real contribution; apply only asks (via the
  // callback form of ctx.inject) for a webServer and registers the wallpaper
  // route where one exists — an environment without the service never calls
  // the callback, so a bare no-op inject must be enough to apply cleanly.
  hostApply({ inject: () => {} })
})

// ----------------------------------------------------------------- client half

let importCounter = 0

/** One fake DOM element with just the surface the plugin touches. */
function makeElement(tag) {
  const element = {
    tag,
    dataset: {},
    textContent: '',
    className: '',
    style: {},
    attrs: {},
    listeners: {},
    children: [],
    parent: null,
    connected: true,
    get isConnected() {
      return element.connected
    },
    get firstChild() {
      return element.children[0]
    },
    appendChild(child) {
      element.children.push(child)
      child.parent = element
    },
    insertBefore(child) {
      element.children.unshift(child)
      child.parent = element
    },
    remove() {
      element.connected = false
      if (element.parent) element.parent.children = element.parent.children.filter((c) => c !== element)
    },
    addEventListener(type, fn) {
      ;(element.listeners[type] || (element.listeners[type] = [])).push(fn)
    },
  }
  Object.defineProperty(element, 'src', {
    get: () => element.attrs.src,
    set: (value) => {
      element.attrs.src = value
    },
  })
  return element
}

/** A minimal fake DOM; only the surfaces the plugin actually touches. */
function makeDocument() {
  const attributes = new Map()
  const styles = []
  const doc = {
    attributes,
    styles,
    documentElement: {
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: (name) => attributes.get(name),
      removeAttribute: (name) => attributes.delete(name),
    },
    head: { appendChild: (el) => { styles.push(el) } },
    createElement: (tag) => makeElement(tag),
    body: makeElement('body'),
  }
  doc.head.appendChild = (el) => {
    styles.push(el)
    el.parent = doc.head
  }
  return doc
}

/** A React stand-in: createElement builds a plain tree, hooks are inert. */
function makeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => [initial, () => {}],
    useEffect: (effect) => effect(),
    useReducer: (reducer, initial) => [initial, () => {}],
  }
}

/**
 * Recursively call function components by hand (the fake React does not expand
 * them) until every node is a host element, and flatten `children` arrays (a
 * `.map(...)` result stays a raw array in the fake) so tree walks can descend.
 */
function expand(node, maxDepth = 8) {
  if (Array.isArray(node)) return node.flatMap((child) => expand(child, maxDepth))
  if (!node || typeof node !== 'object') return node
  let cur = node
  for (let depth = 0; depth < maxDepth && cur && typeof cur.type === 'function'; depth++) {
    cur = cur.type(cur.props)
  }
  if (Array.isArray(cur)) return expand(cur, maxDepth)
  if (cur && Array.isArray(cur.children)) {
    cur.children = cur.children.flatMap((child) => expand(child, maxDepth))
  }
  return cur
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
  // The transcript plan card shares the material (the goal bar frosts itself).
  assert.match(css, /:root\[data-dsh-glass="on"\] \.k74WwW_card\b/)
  // The goal bar's ::before gets the shared tint/blur, the bar gets the ring.
  assert.match(css, /:root\[data-dsh-glass="on"\] \.nLMEza_bar::before/)
  // Both platform builds are covered in the SAME rule: the web build (hashes
  // stable across dsh 0.1.7 → 0.2.0-rc.2) and the desktop (DeepSeek Harness)
  // build share no hashed prefix — the split is per-platform packaging, not a
  // version boundary — so each hashed surface lists its desktop counterpart
  // alongside, gated individually.
  assert.match(css, /:root\[data-dsh-glass="on"\] \.xz4KEq_toBottom\b/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \._2WTFBq_root\b/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \.KuQXFq_card\b/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \.nJdiTq_bar::before/)
  // A naive comma-join would leave selectors after the first ungated; every
  // listed selector must carry the gate itself.
  assert.doesNotMatch(css, /(^|\n)[^:]+\.Dc7zOa_/)
  // The todo dock is one surface for both collapsed and expanded states.
  assert.match(css, /\[data-testid="todo-panel"\]::after/)
  // Nine glass surfaces (eight composer-area ones plus the sidebar column)
  // plus the card's ::before underlay (the card itself sets
  // backdrop-filter:none so the slash popover can blur the real page) — ten
  // blur carriers, each with the prefixed and unprefixed declaration.
  assert.equal((css.match(/backdrop-filter:\s*blur\(/g) || []).length, 20)

  // The 1px edge line rides on outline (offset -1px), not an inset box-shadow
  // layer: a ring layer scatters into a ~20px fog band on surfaces whose render
  // path carries a backdrop-filter (the card's ::before underlay, the plan
  // card's own filter). Nine surfaces carry the line — eight through the
  // shared material, the goal bar in its own rule.
  assert.equal((css.match(/outline: 1px solid var\(--dsh-glass-ring\)/g) || []).length, 9)
  assert.equal((css.match(/outline-offset: -1px/g) || []).length, 9)
  assert.doesNotMatch(css, /inset 0 0 0 1px/, 'no inset ring layer may remain')
})

test('client: the shipped chrome is restored when the preference is OFF', async () => {
  const form = makeForm()
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')
  // Clearing the opaque chrome is part of the glass, not a permanent override:
  // ungated, it kept the message flow running to the bottom of the seat with the
  // preference OFF instead of letting the shipped fade mask it again.
  assert.match(css, /:root\[data-dsh-glass="on"\] \.wSkVaW_composerSeat, :root\[data-dsh-glass="on"\] \.Dc7zOa_composerSeat \{ background: none !important; \}/)
  assert.doesNotMatch(css, /(^|\n)\.wSkVaW_/)
  assert.doesNotMatch(css, /(^|\n)\.Dc7zOa_/)
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

  // The page view is [GlassRow, GroupsPanel]; expand the GlassRow element by
  // hand (the fake React does not) before searching for pills.
  assert.ok(!findByType(card.Component({ t: (key) => key, view: 'page' }), primitives.Menu),
    'no Menu primitive may be used — profiles do not ship it')
  const pageTree = card.Component({ t: (key) => key, view: 'page' })
  const pills = collectByClass(expand(pageTree.children[0]), 'dsh-glass-pill')
  assert.equal(pills.length, 2, 'the row must offer exactly two pill buttons')
  assert.match(pills[0].props.className, / on$/, 'on pill starts selected')
  assert.doesNotMatch(pills[1].props.className, / on$/)

  pills[1].props.onClick()
  assert.deepEqual(form.writes, [['enabled', false]])
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off')

  pills[0].props.onClick()
  assert.deepEqual(form.writes, [['enabled', false], ['enabled', true]])
  assert.equal(doc.attributes.get('data-dsh-glass'), 'on')
})

test('client: the page card hosts one tuning panel per surface group', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: true })
  const { registered } = await loadAndApply(form)
  const card = registered.find((entry) => entry.options.name === 'plugins.row.config')
  const pageTree = card.Component({ t: (key) => key, view: 'page' })

  const groups = collectByClass(expand(pageTree.children[1]), 'dsh-glass-group')
  assert.equal(groups.length, 7, 'seven surface groups: card, docks, chips, toBottom, menu, plan, sidebar')

  const sliders = collectByClass(expand(pageTree.children[1]), 'dsh-glass-slider')
  assert.equal(sliders.length, 42, 'six sliders (blur/tint/saturate/brightness/shadow/highlight) per group')

  const resets = collectByClass(expand(pageTree.children[1]), 'dsh-glass-reset')
  assert.equal(resets.length, 1, 'exactly one reset-to-preset button')
})

test('client: group pills and the reset write flat Config fields', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: true })
  const { registered } = await loadAndApply(form)
  const card = registered.find((entry) => entry.options.name === 'plugins.row.config')
  const panelTree = expand(card.Component({ t: (key) => key, view: 'page' }).children[1])

  // The first group box's off pill writes `<group>_on = false`.
  const groups = collectByClass(panelTree, 'dsh-glass-group')
  const groupPills = collectByClass(groups[0], 'dsh-glass-pill')
  groupPills[1].props.onClick()
  assert.deepEqual(form.writes, [['card_on', false]])

  // The reset button restores every group field (7 groups x 7 fields).
  form.writes.length = 0
  collectByClass(panelTree, 'dsh-glass-reset')[0].props.onClick()
  assert.equal(form.writes.length, 49)
  assert.deepEqual(
    form.writes.filter(([field]) => field.startsWith('card_')),
    [
      ['card_on', true],
      ['card_blur', 10],
      ['card_tint', 17],
      ['card_saturate', 165],
      ['card_brightness', 91],
      ['card_shadow', 100],
      ['card_highlight', 100],
    ],
    'reset restores the shipped preset'
  )
})

test('client: a slider commit persists the value the gesture previewed', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: true })
  const { registered } = await loadAndApply(form)
  const card = registered.find((entry) => entry.options.name === 'plugins.row.config')
  const panelTree = expand(card.Component({ t: (key) => key, view: 'page' }).children[1])

  // The first group's first slider (card blur). Mid-drag previews live; the
  // release reads the value off the input itself — a captured prop would have
  // gone stale during the preview — and persists it.
  const input = collectByClass(panelTree, 'dsh-glass-slider')[0].children.find((c) => c.type === 'input')
  input.props.onChange({ target: { value: '18' } })
  assert.deepEqual(form.writes, [], 'a live preview must not write')
  input.props.onPointerUp({ target: { value: '18' } })
  assert.deepEqual(form.writes, [['card_blur', 18]])
})

test('client: shadow and highlight strengths override the glass variables, light and dark', async () => {
  const form = makeForm()
  form.publish('ready', {
    enabled: true,
    card_shadow: 0,
    card_highlight: 50,
  })
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')

  // Highlight halves the edge pair: ring 0.34 * 0.5 = 0.17, inner 0.05 -> 0.025.
  assert.match(css, /--dsh-glass-ring: rgba\(255,255,255,0\.17\)/)
  assert.match(css, /--dsh-glass-inner: rgba\(255,255,255,0\.025\)/)
  // Shadow 0 flattens the drop pair to fully transparent.
  assert.match(css, /--dsh-glass-shade: rgba\(0,0,0,0\)/)
  assert.match(css, /--dsh-glass-halo: 0 12px 36px rgba\(0,0,0,0\)/)
  // The dark theme restates the override with its own palette (ring 0.22 * 0.5).
  assert.match(css, /:root\[data-dsh-glass="on"\] body\[data-ds-dark-theme\] \[data-composer-card\] \{[^}]*--dsh-glass-ring: rgba\(255,255,255,0\.11\)/)
  // Groups left at the preset strengths emit no element-scoped overrides.
  assert.doesNotMatch(css, /:root\[data-dsh-glass="on"\] \[data-testid="todo-panel"\] \{\s*--dsh-glass-ring/)
})

test('client: a group switched off drops its surfaces from the stylesheet', async () => {
  const form = makeForm()
  form.publish('ready', {
    enabled: true,
    docks_on: false,
    chips_tint: 40,
  })
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')

  assert.doesNotMatch(css, /\[data-testid="todo-panel"\]/, 'docks off removes the todo dock rule')
  assert.doesNotMatch(css, /\.nLMEza_bar/, 'docks off removes the goal bar rule')
  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-composer-card\]/, 'other groups stay on')

  // The chips group stays on and adopts the stored tint.
  assert.match(css, /calc\(0\.4 \* 100%\)/, 'chips tint follows the stored value')
})

test('client: global on with every group off restores the shipped chrome', async () => {
  const form = makeForm()
  form.publish('ready', {
    enabled: true,
    card_on: false,
    docks_on: false,
    chips_on: false,
    toBottom_on: false,
    menu_on: false,
    plan_on: false,
    sidebar_on: false,
  })
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')

  // No glass surface exists, so the chrome-clearing preconditions must stand
  // down with it — otherwise the page loses its backgrounds with nothing to
  // show for the clearing.
  assert.doesNotMatch(css, /\.wSkVaW_/, 'no chrome-clearing rule may survive all groups off')
  assert.doesNotMatch(css, /\.Dc7zOa_/, 'no desktop chrome-clearing rule may survive')
  assert.doesNotMatch(css, /\.pI_x6G_/, 'no wallpaper chrome may leak into a glass-only stylesheet')
  assert.doesNotMatch(css, /backdrop-filter:\s*blur\(/, 'no glass surface rule may survive')
  // The shadow variables stay: inert defaults, not chrome.
  assert.match(css, /--dsh-glass-ring: rgba\(255,255,255,0\.34\)/)
})

test('client: the slash-command menu anchors on its stable data attribute', async () => {
  const form = makeForm()
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')

  assert.match(css, /:root\[data-dsh-glass="on"\] \[data-trigger-menu\]/)
  // A structural :has selector would frost every other listbox holder too.
  assert.doesNotMatch(css, /div:has\(> \[role=listbox\]\)/)
})

test('client: a snapshot with no group fields falls back to the preset', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: true }) // an older profile: only `enabled`
  const { styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')

  // The preset blur (10px) appears on every glass surface.
  assert.match(css, /blur\(10px\) saturate\(165%\) brightness\(0\.91\)/)
  assert.match(css, /:root\[data-dsh-glass="on"\] \.nLMEza_bar::before/)
})

// ------------------------------------------------------------------- wallpaper

test('host: wallpaper Config fields default to off / empty / cover / 0', () => {
  const resolved = Config({})
  assert.equal(unwrap(resolved.wallpaper_on), false)
  assert.equal(unwrap(resolved.wallpaper_path), '')
  assert.equal(unwrap(resolved.wallpaper_fit), 'cover')
  assert.equal(unwrap(resolved.wallpaper_dim), 0)
  // A stored cover/contain choice survives; anything else normalizes to cover.
  assert.equal(unwrap(Config({ wallpaper_fit: 'contain' }).wallpaper_fit), 'contain')
})

test('host: kindFor and mimeFor classify by extension, case-insensitively', () => {
  assert.equal(kindFor('E:/Pictures/壁纸/1_OceanDream1_4k.jpg'), 'image')
  assert.equal(kindFor('E:/Pictures/2560x1440pro.MP4'), 'video')
  assert.equal(kindFor('clip.webm'), 'video')
  assert.equal(kindFor('no-extension'), null)
  assert.equal(kindFor('archive.zip'), null)
  assert.equal(mimeFor('a.JPG'), 'image/jpeg')
  assert.equal(mimeFor('a.mp4'), 'video/mp4')
  assert.equal(mimeFor('a.weird'), 'application/octet-stream')
})

test('host: parseRange honours plain, open, and suffix forms, rejects unsatisfiable ones', () => {
  assert.equal(parseRange(undefined, 1000), null)
  assert.equal(parseRange('items=0-5', 1000), null)
  assert.deepEqual(parseRange('bytes=0-', 1000), { start: 0, end: 999 })
  assert.deepEqual(parseRange('bytes=100-199', 1000), { start: 100, end: 199 })
  assert.deepEqual(parseRange('bytes=100-99999', 1000), { start: 100, end: 999 }, 'end clamps to size-1')
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 }, 'suffix = the last N bytes')
  assert.deepEqual(parseRange('bytes=0-99,200-299', 1000), { start: 0, end: 99 }, 'only the first range of a list')
  assert.equal(parseRange('bytes=1000-', 1000), 'invalid', 'start beyond the file is unsatisfiable')
  assert.equal(parseRange('bytes=-0', 1000), 'invalid')
  assert.equal(parseRange('bytes=5-4', 1000), 'invalid')
  assert.equal(parseRange('bytes=x-y', 1000), 'invalid')
})

test('host: apply registers the wallpaper route only where a webServer exists', () => {
  const registrations = []
  const injected = []
  const ctx = {
    inject: (deps, callback) => injected.push({ deps, callback }),
    effect: (fn) => fn(),
  }
  hostApply(ctx, { wallpaper_on: false })
  assert.equal(injected.length, 1)
  assert.deepEqual(injected[0].deps, ['webServer'])

  // The web composition answers the inject: one prefix route under /plugins.
  const dispose = () => {}
  injected[0].callback({
    webServer: {
      register: (route) => {
        registrations.push(route)
        return dispose
      },
    },
  })
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].kind, 'prefix')
  assert.equal(registrations[0].path, WALLPAPER_ROUTE)
  assert.equal(typeof registrations[0].handler, 'function')

  // The desktop composition never carries a webServer: the callback staying
  // uncalled is the whole story — nothing throws, nothing registers.
  hostApply({ inject: () => {}, effect: () => {} })
})

test('host: the wallpaper handler reads the apply-time config, never ctx.config', async () => {
  // Regression: cordis 4 gates `ctx.config` behind an inject declaration and
  // throws `cannot get property "config" without inject` on ANY read. The
  // original handler read it per-request, so every GET/HEAD rejected and the
  // webServer wrapper answered a bare 400 — the browser showed a broken-image
  // glyph in the media box's top-left corner. The handler must work from
  // apply's second parameter alone, on a ctx that cannot serve config at all.
  const registerThrough = (config) => {
    let route
    const ctx = {
      inject: (deps, callback) => callback({ webServer: { register: (r) => { route = r; return () => {} } } }),
      effect: (fn) => fn(),
    }
    hostApply(ctx, config)
    return route.handler
  }
  const makeRes = () => {
    const res = { statusCode: 0, headers: {}, chunks: [] }
    res.setHeader = (k, v) => { res.headers[k] = v }
    res.end = (chunk) => { if (chunk) res.chunks.push(chunk) }
    return res
  }
  // Volatile fields arrive as frozen `{ get() }` live references.
  const ref = (value) => ({ get: () => value })

  const missing = registerThrough({ wallpaper_on: ref(true), wallpaper_path: ref('E:/definitely/missing/wallpaper.jpg') })
  const res1 = makeRes()
  await missing({ method: 'GET', headers: {} }, res1)
  assert.equal(res1.statusCode, 404)
  assert.match(res1.chunks.join(''), /wallpaper-not-found/)

  // Plain values unwrap identically, so tests and tools can pass bare configs.
  const plain = registerThrough({ wallpaper_on: true, wallpaper_path: 'E:/definitely/missing/wallpaper.jpg' })
  const res2 = makeRes()
  await plain({ method: 'GET', headers: {} }, res2)
  assert.equal(res2.statusCode, 404)
  assert.match(res2.chunks.join(''), /wallpaper-not-found/)

  // Switched off — through the same live reference — answers no-wallpaper.
  const off = registerThrough({ wallpaper_on: ref(false), wallpaper_path: ref('E:/x.jpg') })
  const res3 = makeRes()
  await off({ method: 'GET', headers: {} }, res3)
  assert.equal(res3.statusCode, 404)
  assert.match(res3.chunks.join(''), /no-wallpaper/)
})

test('client: the wallpaper starts off and emits nothing', async () => {
  const form = makeForm()
  const { doc, styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')
  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'off')
  assert.doesNotMatch(css, /data-dsh-wallpaper/)
  assert.equal(doc.body.children.length, 0, 'no media layer may exist while off')
})

test('client: a stored image wallpaper paints the layer and clears the window chrome', async () => {
  const form = makeForm()
  form.publish('ready', {
    enabled: true,
    wallpaper_on: true,
    wallpaper_path: 'E:/Pictures/壁纸/wallpaper/1_OceanDream1_4k.jpg',
  })
  const { doc, styles } = await loadAndApply(form)
  const css = styles.map((el) => el.textContent).join('\n')

  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'on')
  // One body-level fixed layer: an <img> media element under a dim veil.
  assert.equal(doc.body.children.length, 1)
  const layer = doc.body.children[0]
  assert.equal(layer.tag, 'div')
  assert.match(String(layer.style.cssText), /z-index:-1/)
  assert.equal(layer.children.length, 2)
  assert.equal(layer.children[0].tag, 'img')
  assert.equal(layer.children[0].attrs.src, '/plugins/dsh-composer-glass/wallpaper')
  assert.equal(layer.children[0].style.objectFit, 'cover')
  assert.equal(layer.children[1].style.background, 'rgba(0,0,0,0)', 'dim starts at 0')

  // The wallpaper-gated chrome clearing: body (canvas propagation), the
  // AppFrame root, the conversation chrome, the inner sidebar root — all
  // under the wallpaper attribute, none under the glass one.
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] body \{ background: none !important; \}/)
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] \.pI_x6G_frame \{ background: none !important; \}/)
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] \.wSkVaW_root/)
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] \.hHd-Xa_root \{ background: none !important; \}/)
  // The sidebar list's built-in bottom fade (an opaque gradient toward the
  // theme fill) reads as a white band over a wallpaper — cleared like chrome.
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] \.bhn1Oq_fade \{ background: none !important; \}/)
  // Content surfaces (new-session pill, user bubble, code blocks, inline
  // code, file cards) turn glass under the same gate — one shared rule, so
  // assert per surface across the selector list; code blocks additionally
  // get their paint variables pinned to transparent so the shiki <pre> and
  // the sticky banner clear with the card.
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] \.md-code-block[^{]*\{[^}]*rgba\(255, 255, 255, 0\.17\)/)
  assert.match(css, /\.Sixlwa_bubble[^{]*\{[^}]*rgba\(255, 255, 255, 0\.17\)/)
  assert.match(css, /\.nyYjTG_file[^{]*\{[^}]*rgba\(255, 255, 255, 0\.17\)/)
  assert.match(css, /--dsl-code-block-background: transparent/)
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] code \{[^}]*rgba\(255, 255, 255, 0\.17\)/)
  // Approval + ask-user cards join the glass (they paint input-major at full
  // strength); the nested custom-answer block gets a plain tint.
  assert.match(css, /\.mna1RW_card[^{]*\{[^}]*rgba\(255, 255, 255, 0\.17\)/)
  assert.match(css, /\.LVzXQa_card[^{]*\{[^}]*rgba\(255, 255, 255, 0\.17\)/)
  assert.match(css, /\.Mbwy4a_card[^{]*\{[^}]*rgba\(255, 255, 255, 0\.17\)/)
  assert.match(css, /:root\[data-dsh-wallpaper="on"\] \.Mbwy4a_customBlock \{ background-color: rgba\(255, 255, 255, 0\.17\) !important; \}/)
  // The sidebar column keeps its tinted glass (the sidebar group is on by
  // default), so the wallpaper section must NOT clear it — the two rules
  // would fight and the later one would strip the tint.
  assert.doesNotMatch(css, /:root\[data-dsh-wallpaper="on"\] \.pI_x6G_sidebarCol/)
})

test('client: a video wallpaper mounts a looping muted video element', async () => {
  const form = makeForm()
  form.publish('ready', {
    enabled: false,
    wallpaper_on: true,
    wallpaper_path: 'E:/Pictures/2560x1440pro.mp4',
    wallpaper_fit: 'contain',
    wallpaper_dim: 35,
  })
  const { doc } = await loadAndApply(form)
  assert.equal(doc.attributes.get('data-dsh-glass'), 'off', 'the wallpaper runs with the glass off')
  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'on')

  const layer = doc.body.children[0]
  const video = layer.children[0]
  assert.equal(video.tag, 'video')
  assert.equal(video.muted, true, 'the autoplay policy requires a muted video')
  assert.equal(video.loop, true)
  assert.equal(video.playsInline, true)
  assert.equal(video.autoplay, true)
  assert.equal(video.style.objectFit, 'contain')
  assert.equal(layer.style.background, '#000', 'contained media letterboxes on black')
  assert.equal(layer.children[1].style.background, 'rgba(0,0,0,0.35)', 'the dim veil follows the slider')
})

test('client: turning the wallpaper off removes the layer and the attribute', async () => {
  const form = makeForm()
  form.publish('ready', {
    enabled: true,
    wallpaper_on: true,
    wallpaper_path: 'E:/Pictures/壁纸/wallpaper/1_OceanDream1_4k.jpg',
  })
  const { doc } = await loadAndApply(form)
  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'on')
  assert.equal(doc.body.children.length, 1)

  form.publish('ready', {
    enabled: true,
    wallpaper_on: false,
    wallpaper_path: 'E:/Pictures/壁纸/wallpaper/1_OceanDream1_4k.jpg',
  })
  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'off')
  assert.equal(doc.body.children.length, 0, 'the layer is torn down with the switch')
})

test('client: an unknown extension never activates the wallpaper', async () => {
  const form = makeForm()
  form.publish('ready', {
    enabled: true,
    wallpaper_on: true,
    wallpaper_path: 'E:/Documents/notes.zip',
  })
  const { doc, styles } = await loadAndApply(form)
  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'off', 'unknown media, no wallpaper')
  assert.equal(doc.body.children.length, 0)
  const css = styles.map((el) => el.textContent).join('\n')
  // The stylesheet gate follows the attribute, so no wallpaper chrome clears.
  assert.doesNotMatch(css, /data-dsh-wallpaper/)
})

test('client: the wallpaper panel writes flat Config fields', async () => {
  const form = makeForm()
  form.publish('ready', { enabled: true })
  const { registered, doc } = await loadAndApply(form)
  const card = registered.find((entry) => entry.options.name === 'plugins.row.config')
  const pageTree = card.Component({ t: (key) => key, view: 'page' })
  const wallpaperBox = collectByClass(expand(pageTree.children[2]), 'dsh-glass-group')[0]
  assert.ok(wallpaperBox, 'the page card hosts a wallpaper box')

  // The head pills enable the wallpaper first (a path alone shows nothing).
  const pills = collectByClass(wallpaperBox, 'dsh-glass-pill')
  assert.equal(pills.length, 4, 'two pill pairs: the on/off switch and the fit choice')
  pills[0].props.onClick()
  assert.deepEqual(form.writes, [['wallpaper_on', true]])
  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'off', 'no path yet, nothing to show')

  // The path input writes per keystroke and activates the layer at once.
  const input = collectByClass(wallpaperBox, 'dsh-glass-input')[0]
  input.props.onChange({ target: { value: 'E:/Pictures/2560x1440pro.mp4' } })
  assert.deepEqual(form.writes, [['wallpaper_on', true], ['wallpaper_path', 'E:/Pictures/2560x1440pro.mp4']])
  assert.equal(doc.attributes.get('data-dsh-wallpaper'), 'on')
  assert.equal(doc.body.children[0].children[0].tag, 'video')

  // The dim slider previews without writing and commits on release.
  form.writes.length = 0
  const dimSlider = collectByClass(wallpaperBox, 'dsh-glass-slider')[0]
  dimSlider.children.find((c) => c.type === 'input').props.onChange({ target: { value: '40' } })
  assert.deepEqual(form.writes, [], 'a live dim preview must not write')
  assert.equal(doc.body.children[0].children[1].style.background, 'rgba(0,0,0,0.4)')
  dimSlider.children.find((c) => c.type === 'input').props.onPointerUp({ target: { value: '40' } })
  assert.deepEqual(form.writes, [['wallpaper_dim', 40]])
})

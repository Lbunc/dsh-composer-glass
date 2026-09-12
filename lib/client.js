/**
 * dsh-composer-glass — browser half.
 *
 * Bundle format: `window.__ModuleLoader__.load({ id, factory(require) })`. The
 * shell supplies the CJS shim and pre-registered modules (react, ...), so this
 * file needs no bundler and no build step.
 *
 * WHAT IT DOES
 * Turns the composer card — plus the surfaces around it, the todo dock above,
 * the back-to-bottom button, and the status chip below — into one uniformly
 * translucent material. It is a MATERIAL, not a refractor:
 * measured behaviour of the target engine made real backdrop refraction
 * unworkable here, and the reasoning is recorded in the repository notes rather
 * than silently dropped.
 *
 * The one control is a preference row under Settings -> General. That slot's
 * runtime contract states the owner passes NO props, so the row draws its own
 * label, value and write path — the internals below mirror DSH's own General
 * rows (see `EnterBehaviorRow` in dsh-client-ui-conversation) field for field.
 *
 * The choice itself is NOT local state: it is the `composer-glass` Host settings
 * namespace registered by `lib/index.js`, read and written here through
 * `settingsScope`. A refresh or a client hot-replace therefore restores the
 * user's last choice instead of resetting to the schema default.
 *
 * Assets: none. No images, no fonts, no network. The whole effect is CSS.
 */

window.__ModuleLoader__.load({
  id: 'dsh-composer-glass',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    /** Root attribute whose value ("on" / "off") gates every style rule. */
    const ROOT_ATTR = 'data-dsh-glass'
    /** Class-name prefix, so this plugin's rules can never collide. */
    const PREFIX = 'dsh-glass'
    /** Locale namespace owned by this plugin. */
    const NS = 'dsh-composer-glass'
    /** Cell key for the Settings -> General row. */
    const ROW_ID = 'dsh-glass-pane'
    /** Row order: after the shipped rows (… transcript-view 12, composer-enter 20). */
    const ROW_ORDER = 30
    /** Host settings namespace holding the on/off choice; registered in lib/index.js. */
    const PREF_NS = 'composer-glass'
    /** Field inside that namespace; must match SETTINGS_FIELD in lib/index.js. */
    const PREF_FIELD = 'enabled'
    /** Choice with nothing stored yet; must match DEFAULT_ENABLED in lib/index.js. */
    const DEFAULT_ENABLED = true

    /**
     * The tuned material. These are the deliverable: frozen constants rather
     * than runtime variables, so the look cannot drift on its own.
     */
    const MATERIAL = {
      blur: 10,
      saturate: 165,
      brightness: 0.91,
      tint: 0.17,
      /** Slightly stronger tint for the floating button's hover cue. */
      tintHover: 0.25,
      radius: 22,
      ring: 0.34
    }

    /**
     * Surface tint token. Inlined into each `background-color` instead of being
     * routed through a `:root` custom property: DSH defines its `--dsw-*` tokens
     * on `body`, so a `var()` captured at `:root` would resolve to nothing and
     * silently drop the whole declaration. Referencing the token on the surface
     * itself keeps the resolution context the original rule worked in.
     */
    const GLASS_TINT = 'var(--dsw-specific-input-major)'

    // ---------------------------------------------------------------- locale

    /** Bilingual dictionaries. Every shipped locale id must be present. */
    const MESSAGES = {
      zh: {
        'row.title': '输入框毛玻璃',
        'row.desc': '让输入框变成整块均匀半透明的毛玻璃面板',
        'opt.on': '开启',
        'opt.off': '关闭'
      },
      en: {
        'row.title': 'Composer frosted glass',
        'row.desc': 'Turn the composer into a uniformly translucent frosted-glass pane',
        'opt.on': 'On',
        'opt.off': 'Off'
      }
    }

    // ----------------------------------------------------------------- style

    /**
     * Three preconditions make the pane read as glass. All three are required,
     * and each was learned by breaking it:
     *
     * 1. Clear the opaque chrome. The shipped rule is
     *      .wSkVaW_root{background:var(--dsw-alias-bg-base)}
     *    A `background` SHORTHAND also sets a background-image layer, so
     *    overriding background-color alone leaves that layer behind. Hence
     *    `background: none`.
     * 2. Remove the composer seat's downward fade,
     *      linear-gradient(180deg, transparent 0px, <base> 36px)
     *    which reads transparent -> SOLID and so makes the LOWER part opaque.
     *    It is the direct cause of "only the top of the card looks transparent".
     * 3. The pane's own low alpha. `tint` is the pane background-color's alpha
     *    and is the pane's own property; it does not depend on what sits behind.
     *
     * FRAGILITY: the `.wSkVaW_*` and `.EvIC1a_*` selectors are build-hashed class
     * names read out of the shipped bundles. They hold for the version this was
     * written against and can change on a DSH upgrade. If an effect silently
     * reverts, check these first: `[data-composer-card]`,
     * `[data-testid="todo-panel"]` and `[data-composer-stats]` are stable data
     * attributes and are preferred wherever one is available — only the
     * back-to-bottom button has none.
     */

    /**
     * The shared material declarations. Every surface this plugin turns to glass
     * — the composer card, the todo dock, the back-to-bottom button — uses
     * exactly these, so the three read as one material instead of three similar
     * effects. The recipe is written once; only the per-surface geometry below
     * differs.
     */
    const GLASS_SURFACE = [
      '  background-color: color-mix(in srgb, ' + GLASS_TINT + ' calc(' + MATERIAL.tint + ' * 100%), transparent) !important;',
      '  backdrop-filter: blur(' + MATERIAL.blur + 'px) saturate(' + MATERIAL.saturate + '%) brightness(' + MATERIAL.brightness + ');',
      '  -webkit-backdrop-filter: blur(' + MATERIAL.blur + 'px) saturate(' + MATERIAL.saturate + '%) brightness(' + MATERIAL.brightness + ');',
      '  box-shadow:',
      '    inset 0 0 0 1px var(--dsh-glass-ring),',
      '    inset 0 1px 0 0 var(--dsh-glass-inner),',
      '    inset 0 -12px 24px -18px var(--dsh-glass-shade),',
      '    var(--dsh-glass-halo) !important;',
      '  transition: background-color .18s ease, backdrop-filter .18s ease;'
    ]

    /** One glass surface rule; `extra` carries per-surface geometry (radius…). */
    const glassRule = (selector, extra) =>
      [':root[' + ROOT_ATTR + '="on"] ' + selector + ' {', ...GLASS_SURFACE, ...(extra || []), '}'].join('\n')

    /**
     * Exactly one decorative layer per surface. Every extra layer erodes the
     * uniformity that makes a pane read as a single piece of glass. The surface
     * must be positioned for `inset: 0` to resolve against it.
     */
    const SHEEN = [
      "  content: '';",
      '  position: absolute;',
      '  inset: 0;',
      '  border-radius: inherit;',
      '  pointer-events: none;',
      '  background: linear-gradient(170deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,0) 36%);',
      '  z-index: 0;'
    ]
    const sheenRule = (selector) =>
      [':root[' + ROOT_ATTR + '="on"] ' + selector + '::after {', ...SHEEN, '}'].join('\n')

    const CSS = [
      '.wSkVaW_root, .wSkVaW_scrollBody, .wSkVaW_body, .wSkVaW_viewArea { background: none !important; }',
      '.wSkVaW_composerSeat { background: none !important; }',

      ':root {',
      '  --dsh-glass-ring: rgba(255,255,255,0.34);',
      '  --dsh-glass-inner: rgba(255,255,255,0.05);',
      '  --dsh-glass-shade: rgba(0,0,0,0.12);',
      '  --dsh-glass-halo: 0 12px 36px rgba(0,0,0,0.28);',
      // Downward-only halo for the bottom status chip: its top edge sits a few
      // pixels under the composer card, so the shadow must not reach upward.
      // A negative spread cancels the blur's upward half.
      '  --dsh-glass-chip-halo: 0 8px 20px -8px rgba(0,0,0,0.30);',
      // Small soft lift for the floating 34px button: the card-sized halo is
      // far too heavy at that size.
      '  --dsh-glass-button-halo: 0 4px 12px rgba(0,0,0,0.20);',
      '}',
      // DSH carries its dark palette on body[data-ds-dark-theme]; a `.dark`
      // class is never used for tokens, so `.dark` selectors would never match.
      'body[data-ds-dark-theme] {',
      '  --dsh-glass-ring: rgba(255,255,255,0.22);',
      '  --dsh-glass-inner: rgba(255,255,255,0.04);',
      '  --dsh-glass-shade: rgba(0,0,0,0.18);',
      '  --dsh-glass-halo: 0 14px 40px rgba(0,0,0,0.45);',
      '  --dsh-glass-chip-halo: 0 10px 24px -10px rgba(0,0,0,0.55);',
      '  --dsh-glass-button-halo: 0 5px 14px rgba(0,0,0,0.42);',
      '}',

      // One material, four surfaces. The composer card keeps its own 22px
      // radius; the todo dock, the back-to-bottom button and the status chip
      // keep whatever shape their shipped rules give them, so only the material
      // is shared.
      glassRule('[data-composer-card]', ['  border-radius: ' + MATERIAL.radius + 'px;']),
      sheenRule('[data-composer-card]'),

      // The todo dock (`conversation.input.dock`). Its root carries the stable
      // `data-testid`; collapsed and expanded differ only by whether the nested
      // <ul> is mounted, so this single rule covers BOTH states. The shipped
      // `overflow:hidden` already clips the list to the same rounded rectangle.
      // `position:relative` anchors the sheen, and the glass ring replaces the
      // shipped hairline so the two edges never stack.
      glassRule('[data-testid="todo-panel"]', [
        '  position: relative;',
        '  border-color: transparent !important;'
      ]),
      sheenRule('[data-testid="todo-panel"]'),

      // The "back to bottom" button. It has no stable data attribute — only the
      // build-hashed `.EvIC1a_toBottom` class — so it is pinned by that name.
      // No sheen here: 34px is too small for the gradient to read. The shared
      // box-shadow is replaced wholesale: the card-sized halo reads as a dark
      // blob at this size, and the bottom-shade inset has a negative spread
      // wider than the circle, so it never drew anyway.
      glassRule('.EvIC1a_toBottom', [
        '  box-shadow:',
        '    inset 0 0 0 1px var(--dsh-glass-ring),',
        '    inset 0 1px 0 0 var(--dsh-glass-inner),',
        '    var(--dsh-glass-button-halo) !important;'
      ]),
      // The shared rule's background is `!important`, so the shipped :hover
      // rule would lose; restore a hover cue with a slightly stronger tint.
      ':root[' + ROOT_ATTR + '="on"] .EvIC1a_toBottom:hover {',
      '  background-color: color-mix(in srgb, ' + GLASS_TINT + ' calc(' + MATERIAL.tintHover + ' * 100%), transparent) !important;',
      '}',

      // The bottom status row: session statistics plus token usage. Both pills
      // already share one root, and that root carries the stable
      // `data-composer-stats` attribute, so a single rule puts BOTH in one chip.
      // It hugs its content instead of the shipped full-width row. The shipped
      // row sat FLUSH under the card — the container has no gap — and its only
      // spacing was 4px of its own top padding; this keeps that same 4px, so
      // the chip does not drift away from the composer. The halo is
      // downward-only for the same reason, and `overflow:hidden` clips the
      // pills' hover backgrounds to the chip's rounded ends.
      glassRule('[data-composer-stats]', [
        '  width: max-content;',
        '  max-width: 100%;',
        '  margin: 4px auto 0;',
        '  padding: 2px 10px;',
        '  gap: 8px;',
        '  border-radius: 999px;',
        '  overflow: hidden;',
        // Replaces the shared box-shadow wholesale: its bottom-shade layer is
        // tuned for tall surfaces, and this halo must not reach upward.
        '  box-shadow:',
        '    inset 0 0 0 1px var(--dsh-glass-ring),',
        '    inset 0 1px 0 0 var(--dsh-glass-inner),',
        '    var(--dsh-glass-chip-halo) !important;'
      ]),

      // DSH ships no global `* { box-sizing: border-box }` reset, so a row with
      // width/padding would overflow without its own.
      '.' + PREFIX + '-row, .' + PREFIX + '-row * { box-sizing: border-box; }',
      '.' + PREFIX + '-row {',
      '  border-bottom: .5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25));',
      '  align-items: center; gap: 8px; padding: 16px 0; display: flex;',
      '}',
      '.' + PREFIX + '-rowText { flex-direction: column; flex: 1; gap: 4px; min-width: 0; padding-right: 48px; display: flex; }',
      // Key colours are hardcoded with a token fallback: an alias token can be
      // absent or resolve to something unreadable in one of the themes, and a
      // failed var() fails silently.
      '.' + PREFIX + '-title { color: var(--dsw-alias-label-primary, #e8e8ea); font-size: 14px; font-weight: 400; line-height: 22px; }',
      '.' + PREFIX + '-desc { color: var(--dsw-alias-label-tertiary, #9a9aa0); font-size: 12px; font-weight: 400; line-height: 18px; }',
      '.' + PREFIX + '-seg {',
      '  background: var(--dsw-alias-bg-module-platform, rgba(128,128,128,.16));',
      '  border-radius: 18px; height: 36px; padding: 3px; display: inline-flex; gap: 2px; flex: none;',
      '}',
      '.' + PREFIX + '-seg button {',
      '  appearance: none; border: none; cursor: pointer; font: inherit;',
      '  font-size: 14px; line-height: 22px;',
      '  color: var(--dsw-alias-label-secondary, #b9b9c0);',
      '  background: transparent; border-radius: 15px; padding: 0 14px; height: 30px;',
      '}',
      '.' + PREFIX + '-seg button[data-active="true"] {',
      '  background: var(--dsw-alias-bg-overlay, rgba(90,90,100,.55));',
      '  color: var(--dsw-alias-label-primary, #fff);',
      '}'
    ].join('\n')

    // ------------------------------------------------------------------ state

    /**
     * Live enable state, owned by `apply`.
     *
     * A settings row unmounts when the user navigates away from the section, so
     * the state cannot live inside the component — and it must not live in this
     * module either, because client HMR re-runs `apply()` and a reload starts a
     * fresh module. The authoritative copy is the `composer-glass` settings
     * namespace on the Host (`lib/index.js`), reached through the `settingsScope`
     * bound in `apply`; this module keeps a mirror only so the CSS attribute and
     * the row can render synchronously.
     */
    let enabled = DEFAULT_ENABLED
    /** Bound in `apply`; null until then so the row can still mount. */
    let scope = null
    const listeners = []

    /**
     * Apply the preference to the pane.
     *
     * `persist` is true only for a user gesture. The first paint and every
     * settings-driven sync pass false: writing there would fabricate a user
     * override the user never made, and would loop the settings subscription
     * back into a write.
     */
    function setEnabled(next, persist) {
      const changed = enabled !== next
      enabled = next
      document.documentElement.setAttribute(ROOT_ATTR, next ? 'on' : 'off')
      if (changed) for (const notify of listeners) notify(next)
      if (persist && scope) {
        // The Host is the fact source, but a rejected write (no namespace yet
        // after an upgrade, or a memory-mode client) must not break the local
        // toggle — log and carry on.
        scope.set(PREF_FIELD, next).catch((err) => {
          console.error('[composer-glass] preference not persisted:', err)
        })
      }
    }

    /** The stored preference, or null while the settings document is unknown. */
    function storedPreference() {
      if (!scope) return null
      const snapshot = scope.getSnapshot()
      if (!snapshot || snapshot.status !== 'ready') return null
      const value = snapshot.value
      return value && typeof value[PREF_FIELD] === 'boolean' ? value[PREF_FIELD] : null
    }

    /** Adopt the Host value after the first mirror read or any later commit. */
    function syncFromScope() {
      const stored = storedPreference()
      if (stored !== null) setEnabled(stored, false)
    }

    // -------------------------------------------------------------------- row

    function GlassRow(props) {
      // Prefer the renderer's injected `t` seat, and fall back to a locally
      // bound translate so the row still works if the seat is absent.
      const t = props && props.t ? props.t : fallbackT
      const [on, setOn] = React.useState(enabled)

      React.useEffect(() => {
        const update = (value) => setOn(value)
        listeners.push(update)
        setOn(enabled)
        return () => {
          const at = listeners.indexOf(update)
          if (at >= 0) listeners.splice(at, 1)
        }
      }, [])

      const option = (label, value) =>
        React.createElement(
          'button',
          {
            key: label,
            type: 'button',
            'data-active': String(on === value),
            'aria-pressed': on === value,
            onClick: () => setEnabled(value, true)
          },
          label
        )

      return React.createElement(
        'div',
        { className: PREFIX + '-row' },
        React.createElement(
          'div',
          { className: PREFIX + '-rowText' },
          React.createElement('div', { className: PREFIX + '-title' }, t('row.title')),
          React.createElement('div', { className: PREFIX + '-desc' }, t('row.desc'))
        ),
        React.createElement(
          'div',
          { className: PREFIX + '-seg', role: 'radiogroup', 'aria-label': t('row.title') },
          option(t('opt.on'), true),
          option(t('opt.off'), false)
        )
      )
    }

    /** Bound translate, replaced in `apply` once the locale service is in hand. */
    let fallbackT = (key) => key

    // ----------------------------------------------------------------- plugin

    exports.inject = ['slots', 'locale', 'settingsScope']

    exports.apply = function apply(ctx) {
      // A formal package has no style service (the dynamic-plugin `styles`
      // symbol does not exist here), so the stylesheet is a plain tag this
      // plugin owns and removes with its fiber.
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-composer-glass'
        tag.dataset.pluginCss = 'dsh-composer-glass'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'composer-glass: styles')

      // Register one dictionary per shipped locale id. Registration bumps the
      // locale revision, so already-mounted outlets pick the texts up at once.
      ctx.effect(() => {
        const disposers = Object.keys(MESSAGES).map((id) => ctx.locale.register(NS, id, MESSAGES[id]))
        return () => disposers.forEach((dispose) => dispose())
      }, 'composer-glass: dictionaries')

      fallbackT = ctx.locale.bind(NS)

      // Durable home for the on/off choice. `decode` is explicit so the scope
      // hands back the section object regardless of the serialized wire schema;
      // the plugin owns the shape (see the matching schema in lib/index.js).
      scope = ctx.settingsScope.bind({
        namespace: PREF_NS,
        decode: (section) => ((section && typeof section === 'object') ? section : undefined)
      })

      // Every Host commit — including the first mirror read and this plugin's
      // own write — lands here; a changed value flips the pane without polling.
      ctx.effect(() => scope.subscribe(() => syncFromScope()), 'composer-glass: preference sync')

      // The pane must be correct on first paint, before Settings is ever opened.
      // A stored choice is adopted when the mirror already holds one (the common
      // case after a hot replace); otherwise start on, the schema default, and
      // let the subscription correct it a moment later.
      setEnabled(storedPreference() ?? DEFAULT_ENABLED, false)

      ctx.effect(
        () =>
          ctx.slots.inject('settings.general.item', () =>
            ctx.slots.register(
              { name: 'settings.general.item', id: ROW_ID, order: ROW_ORDER, locale: NS },
              GlassRow
            )
          ),
        'composer-glass: settings row'
      )

      ctx.effect(
        () => () => {
          listeners.length = 0
          document.documentElement.removeAttribute(ROOT_ATTR)
        },
        'composer-glass: teardown'
      )
    }

    return module.exports
  }
})

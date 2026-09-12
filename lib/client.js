/**
 * dsh-composer-glass — browser half.
 *
 * Bundle format: `window.__ModuleLoader__.load({ id, factory(require) })`. The
 * shell supplies the CJS shim and pre-registered modules (react, ...), so this
 * file needs no bundler and no build step.
 *
 * WHAT IT DOES
 * Turns the composer card into a single uniformly translucent pane. It is a
 * MATERIAL, not a refractor: measured behaviour of the target engine made real
 * backdrop refraction unworkable here, and the reasoning is recorded in the
 * repository notes rather than silently dropped.
 *
 * The one control is a preference row under Settings -> General. That slot's
 * runtime contract states the owner passes NO props, so the row draws its own
 * label, value and write path — the internals below mirror DSH's own General
 * rows (see `EnterBehaviorRow` in dsh-client-ui-conversation) field for field.
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

    /**
     * The tuned material. These are the deliverable: frozen constants rather
     * than runtime variables, so the look cannot drift on its own.
     */
    const MATERIAL = {
      blur: 10,
      saturate: 165,
      brightness: 0.91,
      tint: 0.17,
      radius: 22,
      ring: 0.34
    }

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
     * FRAGILITY: the `.wSkVaW_*` selectors are build-hashed class names read out
     * of the shipped bundle. They hold for the version this was written against
     * and can change on a DSH upgrade. If the effect silently reverts, check
     * these first. `[data-composer-card]` is a stable data attribute and is
     * preferred wherever one is available.
     */
    const CSS = [
      '.wSkVaW_root, .wSkVaW_scrollBody, .wSkVaW_body, .wSkVaW_viewArea { background: none !important; }',
      '.wSkVaW_composerSeat { background: none !important; }',

      ':root {',
      '  --dsh-glass-ring: rgba(255,255,255,0.34);',
      '  --dsh-glass-inner: rgba(255,255,255,0.05);',
      '  --dsh-glass-shade: rgba(0,0,0,0.12);',
      '  --dsh-glass-halo: 0 12px 36px rgba(0,0,0,0.28);',
      '}',
      // DSH carries its dark palette on body[data-ds-dark-theme]; a `.dark`
      // class is never used for tokens, so `.dark` selectors would never match.
      'body[data-ds-dark-theme] {',
      '  --dsh-glass-ring: rgba(255,255,255,0.22);',
      '  --dsh-glass-inner: rgba(255,255,255,0.04);',
      '  --dsh-glass-shade: rgba(0,0,0,0.18);',
      '  --dsh-glass-halo: 0 14px 40px rgba(0,0,0,0.45);',
      '}',

      ':root[' + ROOT_ATTR + '="on"] [data-composer-card] {',
      '  background-color: color-mix(in srgb, var(--dsw-specific-input-major) calc(' + MATERIAL.tint + ' * 100%), transparent) !important;',
      '  backdrop-filter: blur(' + MATERIAL.blur + 'px) saturate(' + MATERIAL.saturate + '%) brightness(' + MATERIAL.brightness + ');',
      '  -webkit-backdrop-filter: blur(' + MATERIAL.blur + 'px) saturate(' + MATERIAL.saturate + '%) brightness(' + MATERIAL.brightness + ');',
      '  box-shadow:',
      '    inset 0 0 0 1px var(--dsh-glass-ring),',
      '    inset 0 1px 0 0 var(--dsh-glass-inner),',
      '    inset 0 -12px 24px -18px var(--dsh-glass-shade),',
      '    var(--dsh-glass-halo) !important;',
      '  border-radius: ' + MATERIAL.radius + 'px;',
      '  transition: background-color .18s ease, backdrop-filter .18s ease;',
      '}',
      // Exactly one decorative layer. Every extra layer erodes the uniformity
      // that makes the pane read as a single piece of glass.
      ':root[' + ROOT_ATTR + '="on"] [data-composer-card]::after {',
      "  content: '';",
      '  position: absolute;',
      '  inset: 0;',
      '  border-radius: inherit;',
      '  pointer-events: none;',
      '  background: linear-gradient(170deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,0) 36%);',
      '  z-index: 0;',
      '}',

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
     * the state cannot live inside the component. It is deliberately module
     * scope rather than a settings namespace: a plugin's preference normally
     * belongs in `settingsScope`, which is the durable, cross-restart home — but
     * that requires a Host-side `settings.register()`, and that is the intended
     * next step for this package rather than something to fake here.
     */
    let enabled = true
    const listeners = []

    function setEnabled(next) {
      enabled = next
      document.documentElement.setAttribute(ROOT_ATTR, next ? 'on' : 'off')
      for (const notify of listeners) notify(next)
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
            onClick: () => setEnabled(value)
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

    exports.inject = ['slots', 'locale']

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

      // The pane must be correct on first paint, before Settings is ever opened.
      setEnabled(true)

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

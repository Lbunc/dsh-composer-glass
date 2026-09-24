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
 * The choice itself is NOT local state: it is the `enabled` field of this
 * plugin's own volatile Config (declared in `lib/index.js`), whose namespace is
 * the profile entry id `composer-glass`. It is read and written here through
 * `ctx.configForms.get('composer-glass')` — the same transport DSH's own
 * General rows use (ui-theme, ui-conversation). A refresh or a client
 * hot-replace therefore restores the user's last choice instead of resetting
 * to the schema default.
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
    /**
     * Profile entry id of this plugin's Loader row (from `cordis.patch.yml`).
     * In the 0.1.7 model the entry id IS the settings namespace; `lib/index.js`
     * declares the matching volatile Config under the same id.
     */
    const ENTRY_ID = 'composer-glass'
    /** Field inside the Config; must match SETTINGS_FIELD in lib/index.js. */
    const PREF_FIELD = 'enabled'
    /** Choice with nothing stored yet; must match DEFAULT_ENABLED in lib/index.js. */
    const DEFAULT_ENABLED = true

    /**
     * The tuned material as shipped. These are the deliverable defaults: every
     * surface group starts here and the card's reset button restores them.
     * Stored as slider-friendly integers (tint 17 = 17%, brightness 91 = 0.91);
     * `shadow` scales the shadow palette's alphas and `highlight` the edge
     * lights (100 = shipped values).
     * Must match PRESET in `lib/index.js`.
     */
    const PRESET = Object.freeze({ blur: 10, tint: 17, saturate: 165, brightness: 91, shadow: 100, highlight: 100 })

    /** Per-group scalar ranges; must match RANGE in `lib/index.js`. */
    const RANGE = Object.freeze({
      blur: { min: 0, max: 30, step: 1 },
      tint: { min: 0, max: 100, step: 1 },
      saturate: { min: 50, max: 200, step: 5 },
      brightness: { min: 50, max: 130, step: 1 },
      shadow: { min: 0, max: 200, step: 5 },
      highlight: { min: 0, max: 200, step: 5 },
    })

    /**
     * The surface groups, in card order. Each controls a bundle of surfaces that
     * share one visual role; must match GROUPS in `lib/index.js`.
     */
    const GROUPS = Object.freeze([
      { key: 'card', titleKey: 'group.card' },
      { key: 'docks', titleKey: 'group.docks' },
      { key: 'chips', titleKey: 'group.chips' },
      { key: 'toBottom', titleKey: 'group.toBottom' },
      { key: 'menu', titleKey: 'group.menu' },
      { key: 'plan', titleKey: 'group.plan' }
    ])

    const GROUP_KEYS = GROUPS.map((g) => g.key)

    /** One group's values: the shipped preset for every field. */
    function presetGroup() {
      return { on: true, blur: PRESET.blur, tint: PRESET.tint, saturate: PRESET.saturate, brightness: PRESET.brightness, shadow: PRESET.shadow, highlight: PRESET.highlight }
    }

    /** Fresh state for all groups. */
    function presetGroups() {
      const out = {}
      for (const key of GROUP_KEYS) out[key] = presetGroup()
      return out
    }

    /** Read one group's flat snapshot fields, falling back to the preset. */
    function groupFromSnapshot(value, key) {
      const num = (name, fallback) => (typeof value[name] === 'number' ? value[name] : fallback)
      return {
        on: typeof value[key + '_on'] === 'boolean' ? value[key + '_on'] : true,
        blur: num(key + '_blur', PRESET.blur),
        tint: num(key + '_tint', PRESET.tint),
        saturate: num(key + '_saturate', PRESET.saturate),
        brightness: num(key + '_brightness', PRESET.brightness),
        shadow: num(key + '_shadow', PRESET.shadow),
        highlight: num(key + '_highlight', PRESET.highlight)
      }
    }

    /** Hover cue: the group tint nudged up (matches the shipped 17% -> 25% gap). */
    const TINT_HOVER_DELTA = 8

    /**
     * Surface tint token. Inlined into each `background-color` instead of being
     * routed through a `:root` custom property: DSH defines its `--dsw-*` tokens
     * on `body`, so a `var()` captured at `:root` would resolve to nothing and
     * silently drop the whole declaration. Referencing the token on the surface
     * itself keeps the resolution context the original rule worked in.
     */
    const GLASS_TINT = 'var(--dsw-specific-input-major)'

    /** The group's blur stack. */
    const blurStack = (g) =>
      'blur(' + g.blur + 'px) saturate(' + g.saturate + '%) brightness(' + (g.brightness / 100) + ')'

    // ---------------------------------------------------------------- locale

    /** Bilingual dictionaries. Every shipped locale id must be present. */
    const MESSAGES = {
      zh: {
        'row.title': '输入区毛玻璃',
        'card.summary': '选择毛玻璃的开启或关闭',
        'opt.on': '开启',
        'opt.off': '关闭',
        'groups.title': '分部位调节',
        'reset': '重置为预设',
        'group.card': '输入卡片',
        'group.docks': '停靠条（任务清单 / 目标条）',
        'group.chips': '状态胶囊（会话统计 / 上下文用量）',
        'group.toBottom': '回到底部按钮',
        'group.menu': '指令菜单（/ 唤出）',
        'group.plan': 'Plan 卡片',
        'param.blur': '模糊',
        'param.tint': '透明度',
        'param.saturate': '饱和度',
        'param.brightness': '亮度',
        'param.shadow': '阴影',
        'param.highlight': '边缘高光'
      },
      en: {
        'row.title': 'Composer-area frosted glass',
        'card.summary': 'Choose whether frosted glass is on or off',
        'opt.on': 'On',
        'opt.off': 'Off',
        'groups.title': 'Per-group tuning',
        'reset': 'Reset to preset',
        'group.card': 'Composer card',
        'group.docks': 'Docks (todo list / goal bar)',
        'group.chips': 'Status capsules (stats / context usage)',
        'group.toBottom': 'Back-to-bottom button',
        'group.menu': 'Slash-command menu',
        'group.plan': 'Plan cards',
        'param.blur': 'Blur',
        'param.tint': 'Tint',
        'param.saturate': 'Saturation',
        'param.brightness': 'Brightness',
        'param.shadow': 'Shadow',
        'param.highlight': 'Edge highlight'
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
     * BOTH chrome-clearing rules below are gated by the on/off attribute. They are
     * part of the glass, not a permanent override: while unconditional they kept
     * the message flow running to the very bottom of the seat even with the
     * preference OFF, where the shipped fade has to mask it again.
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
     * The shared material declarations, parameterised by group. Every surface
     * this plugin turns to glass uses exactly these, so all surfaces read as
     * one material; only each group's own sliders change the numbers.
     */
    const tintDecl = (percent, important) =>
      '  background-color: color-mix(in srgb, ' + GLASS_TINT + ' calc(' + (percent / 100) + ' * 100%), transparent)' + (important ? ' !important' : '') + ';'

    /**
     * The shared edge/shadow bundle. The 1px edge line rides on `outline`
     * (offset -1px; Chromium rounds it along the border-radius), NOT on an
     * inset box-shadow layer: on surfaces whose render path carries a
     * backdrop-filter (the card's ::before underlay, the plan card's own
     * filter) the compositor scatters a 1px inset ring into a ~20px fog band
     * that pools white at the corners, while outline is rasterized by a
     * different path and stays a crisp 1px line. `highlight` keeps scaling the
     * same --dsh-glass-ring variable, so the parameter story is unchanged.
     */
    const GLASS_SHADOW = [
      '  box-shadow:',
      '    inset 0 1px 0 0 var(--dsh-glass-inner),',
      '    inset 0 -12px 24px -18px var(--dsh-glass-shade),',
      '    var(--dsh-glass-halo) !important;',
      '  outline: 1px solid var(--dsh-glass-ring);',
      '  outline-offset: -1px;'
    ]

    /**
     * The shadow palette, at scale 1.0, per theme. CSS_HEAD defines these as
     * the global `:root` / dark-body defaults a group at the preset strength
     * keeps using untouched.
     */
    const SHADOW_PALETTE = {
      light: {
        ring: [255, 255, 255, 0.34],
        inner: [255, 255, 255, 0.05],
        shade: [0, 0, 0, 0.12],
        halo: '0 12px 36px rgba(0,0,0,0.28)',
        chipHalo: '0 8px 20px -8px rgba(0,0,0,0.30)',
        buttonHalo: '0 4px 12px rgba(0,0,0,0.20)'
      },
      dark: {
        ring: [255, 255, 255, 0.22],
        inner: [255, 255, 255, 0.04],
        shade: [0, 0, 0, 0.18],
        halo: '0 14px 40px rgba(0,0,0,0.45)',
        chipHalo: '0 10px 24px -10px rgba(0,0,0,0.55)',
        buttonHalo: '0 5px 14px rgba(0,0,0,0.42)'
      }
    }

    /** Scale an rgba quad's alpha by k, clamped to visible range. */
    const scaledRGBA = (quad, k) =>
      'rgba(' + quad[0] + ',' + quad[1] + ',' + quad[2] + ',' + Math.min(1, Math.round(quad[3] * k * 1000) / 1000) + ')'

    /** Scale every rgba alpha inside a box-shadow list by k. */
    const scaledShadow = (list, k) =>
      list.replace(/rgba\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/g, (_, r, g2, b, a) =>
        'rgba(' + r + ',' + g2 + ',' + b + ',' + Math.min(1, Math.round(a * k * 1000) / 1000) + ')')

    /**
     * One group's glass-edge/shadow override declarations. A group at the
     * preset strengths (both 100) keeps the global variables untouched —
     * nothing is emitted, so the stylesheet stays byte-identical to the
     * shipped material. Any other strength redefines ALL six variables on the
     * group's surfaces (unused ones simply never resolve). `highlight` scales
     * the edge pair (ring stroke + inner top light), `shadow` scales the drop
     * pair (inner bottom shade + outer halos); alphas scale linearly, the
     * geometry stays.
     */
    function glassVarLines(g, dark) {
      if (g.shadow === PRESET.shadow && g.highlight === PRESET.highlight) return []
      const sk = g.shadow / 100
      const hk = g.highlight / 100
      const p = SHADOW_PALETTE[dark ? 'dark' : 'light']
      return [
        '  --dsh-glass-ring: ' + scaledRGBA(p.ring, hk) + ';',
        '  --dsh-glass-inner: ' + scaledRGBA(p.inner, hk) + ';',
        '  --dsh-glass-shade: ' + scaledRGBA(p.shade, sk) + ';',
        '  --dsh-glass-halo: ' + scaledShadow(p.halo, sk) + ';',
        '  --dsh-glass-chip-halo: ' + scaledShadow(p.chipHalo, sk) + ';',
        '  --dsh-glass-button-halo: ' + scaledShadow(p.buttonHalo, sk) + ';'
      ]
    }

    /**
     * The dark-theme twin of a light override: the dark palette hangs on
     * `body[data-ds-dark-theme]`, whose variables are defined after `:root`'s,
     * so an element-scoped override must be restated there or a scaled light
     * value would win in the dark theme too. The dark rule prefixes the same
     * `:root[data-dsh-glass]` gate BEFORE `body` (html is body's ancestor),
     * which both keeps the on/off gating and out-specifies the light override.
     */
    function pushGlassDarkRule(out, selector, g) {
      const lines = glassVarLines(g, true)
      if (lines.length) out.push([':root[' + ROOT_ATTR + '="on"] body[data-ds-dark-theme] ' + selector + ' {', ...lines, '}'].join('\n'))
    }

    const glassSurface = (g) => [
      tintDecl(g.tint, true),
      '  backdrop-filter: ' + blurStack(g) + ';',
      '  -webkit-backdrop-filter: ' + blurStack(g) + ';',
      ...GLASS_SHADOW,
      '  transition: background-color .18s ease, backdrop-filter .18s ease;'
    ]

    /** One glass surface rule; `extra` carries per-surface geometry (radius…). */
    const glassRule = (selector, extra, g) =>
      [':root[' + ROOT_ATTR + '="on"] ' + selector + ' {', ...glassSurface(g), ...(extra || []), '}'].join('\n')

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

    /** Static head: chrome-clearing rules and the shadow variables. */
    const CSS_HEAD = [
      ':root[' + ROOT_ATTR + '="on"] .wSkVaW_root, :root[' + ROOT_ATTR + '="on"] .wSkVaW_scrollBody, :root[' + ROOT_ATTR + '="on"] .wSkVaW_body, :root[' + ROOT_ATTR + '="on"] .wSkVaW_viewArea { background: none !important; }',
      ':root[' + ROOT_ATTR + '="on"] .wSkVaW_composerSeat { background: none !important; }',

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
      '}'
    ]

    /** Settings-card widgets: pills, sliders, group boxes, reset button. */
    const CSS_UI = [
      // DSH ships no global `* { box-sizing: border-box }` reset, so a row with
      // width/padding would overflow without its own.
      '.' + PREFIX + '-pills, .' + PREFIX + '-pills * { box-sizing: border-box; }',
      '.' + PREFIX + '-pills { display: inline-flex; gap: 6px; }',
      '.' + PREFIX + '-pill {',
      '  background: var(--dsw-alias-bg-module-platform, rgba(128,128,128,.16));',
      '  height: 32px; font: inherit; font-size: 13px; line-height: 20px;',
      '  color: var(--dsw-alias-label-secondary, #b6b6bc);',
      '  cursor: pointer; border: none; border-radius: 16px;',
      '  padding: 0 14px; display: inline-flex; align-items: center;',
      '}',
      '.' + PREFIX + '-pill:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.22)); }',
      // Selected state inverts the theme's own label/background pair, so it
      // stays readable in both themes (light: dark-on-white, dark: white-on-
      // dark). Brand tokens can resolve to near-white in the dark theme,
      // which used to pair with white text and disappear.
      '.' + PREFIX + '-pill.on {',
      '  background: var(--dsw-alias-label-primary, currentColor);',
      '  color: var(--dsw-alias-bg-layer-1, #101014); font-weight: 500;',
      '}',

      // Group panel layout for the per-surface tuning card.
      '.' + PREFIX + '-panel, .' + PREFIX + '-panel * { box-sizing: border-box; }',
      '.' + PREFIX + '-panel { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }',
      '.' + PREFIX + '-panelTitle { font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary, inherit); }',
      '.' + PREFIX + '-group {',
      '  border: 1px solid var(--dsw-alias-border, rgba(128,128,128,.22));',
      '  border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;',
      '}',
      '.' + PREFIX + '-groupHead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }',
      '.' + PREFIX + '-groupTitle { font-size: 13px; color: var(--dsw-alias-label-primary, inherit); }',
      // Compact pills inside group headers (32px is for the standalone row).
      '.' + PREFIX + '-group .' + PREFIX + '-pill { height: 26px; font-size: 12px; padding: 0 12px; border-radius: 13px; }',
      '.' + PREFIX + '-sliders { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }',
      '.' + PREFIX + '-slider { display: flex; align-items: center; gap: 8px; font-size: 12px; }',
      '.' + PREFIX + '-sliderLabel { width: 52px; flex: none; color: var(--dsw-alias-label-secondary, #b6b6bc); }',
      '.' + PREFIX + '-sliderVal { width: 44px; flex: none; text-align: right; color: var(--dsw-alias-label-secondary, #b6b6bc); font-variant-numeric: tabular-nums; }',
      '.' + PREFIX + '-slider input[type=range] { flex: 1; min-width: 0; margin: 0; accent-color: var(--dsw-alias-label-primary, currentColor); }',
      '.' + PREFIX + '-reset {',
      '  align-self: flex-start; cursor: pointer; font: inherit; font-size: 12px;',
      '  color: var(--dsw-alias-label-secondary, #b6b6bc);',
      '  background: none; border: 1px solid var(--dsw-alias-border, rgba(128,128,128,.3));',
      '  border-radius: 13px; padding: 5px 12px;',
      '}',
      '.' + PREFIX + '-reset:hover { color: var(--dsw-alias-label-primary, inherit); }'
    ]

    /**
     * Build the full stylesheet from the live group values. A group switched
     * off contributes nothing — the shipped opaque styles simply win again,
     * exactly like the global off switch.
     */
    function buildCSS(groups) {
      const out = CSS_HEAD.slice()
      const hoverTint = (g) => Math.min(100, g.tint + TINT_HOVER_DELTA)

      if (groups.card.on) {
        // One material, four surfaces. The composer card keeps its own 22px
        // radius; the todo dock, the back-to-bottom button and the status chip
        // keep whatever shape their shipped rules give them, so only the
        // material is shared.
        // The composer card itself must NOT carry a backdrop-filter: the
        // slash-command popover portals INSIDE the card, and an ancestor
        // backdrop-filter would make the card the popover's backdrop root,
        // blinding the popover's own blur to the transcript underneath (its
        // shipped 0.58 fill then lets text bleed through unblurred). The card's
        // blur therefore lives on a ::before underlay — visually identical, but
        // the card stays filter-free, so the popover blurs the real page.
        const g = groups.card
        pushGlassDarkRule(out, '[data-composer-card]', g)
        out.push(
          glassRule('[data-composer-card]', [
            ...glassVarLines(g, false),
            '  border-radius: 22px;',
            '  isolation: isolate;',
            '  backdrop-filter: none !important;',
            '  -webkit-backdrop-filter: none !important;'
          ], g),
          [
            ':root[' + ROOT_ATTR + '="on"] [data-composer-card]::before {',
            "  content: '';",
            '  position: absolute;',
            '  inset: 0;',
            '  z-index: -1;',
            '  border-radius: inherit;',
            '  pointer-events: none;',
            '  backdrop-filter: ' + blurStack(g) + ';',
            '  -webkit-backdrop-filter: ' + blurStack(g) + ';',
            '}'
          ].join('\n'),
          sheenRule('[data-composer-card]')
        )
      }

      if (groups.docks.on) {
        const g = groups.docks
        // The todo dock (`conversation.input.dock`). Its root carries the stable
        // `data-testid`; collapsed and expanded differ only by whether the nested
        // <ul> is mounted, so this single rule covers BOTH states. The shipped
        // `overflow:hidden` already clips the list to the same rounded rectangle.
        // `position:relative` anchors the sheen, and the glass ring replaces the
        // shipped hairline so the two edges never stack.
        pushGlassDarkRule(out, '[data-testid="todo-panel"]', g)
        pushGlassDarkRule(out, '.nLMEza_bar', g)
        out.push(
          glassRule('[data-testid="todo-panel"]', [
            ...glassVarLines(g, false),
            '  position: relative;',
            '  border-color: transparent !important;'
          ], g),
          sheenRule('[data-testid="todo-panel"]'),

          // The goal bar above the composer frosts itself, but with the official
          // menu recipe (0.58 menu fill + `--dsw-menu-backdrop-filter`, a 40px
          // blur) — visibly milkier than our material. Its backdrop lives on a
          // ::before, so both overrides target the pseudo-element and the bar:
          // the ::before gets the shared tint and blur stack, and the bar swaps
          // its `--dsw-elevation-panel` drop shadow for the glass ring/halo.
          // FRAGILITY: build-hashed like `.EvIC1a_toBottom`.
          ':root[' + ROOT_ATTR + '="on"] .nLMEza_bar::before {',
          tintDecl(g.tint, true),
          '  backdrop-filter: ' + blurStack(g) + ' !important;',
          '  -webkit-backdrop-filter: ' + blurStack(g) + ' !important;',
          '}',
          ':root[' + ROOT_ATTR + '="on"] .nLMEza_bar {',
          ...glassVarLines(g, false),
          // Top highlight + a small halo only: at 36px tall the material's
          // bottom shade pools too dark, and the full halo overpowers a bar
          // this thin — same call as the back-to-bottom button. The ring line
          // rides on outline (see GLASS_SHADOW): the bar's ::before blur
          // scatters inset ring layers into fog.
          '  --dsh-glass-halo: var(--dsh-glass-button-halo);',
          '  box-shadow:',
          '    inset 0 1px 0 0 var(--dsh-glass-inner),',
          '    var(--dsh-glass-halo) !important;',
          '  outline: 1px solid var(--dsh-glass-ring);',
          '  outline-offset: -1px;',
          '}'
        )
      }

      if (groups.plan.on) {
        const g = groups.plan
        // The plan cards in the transcript ("Completed Turn's submitted plans").
        // Shipped as an opaque fill (`--dsw-static-neutral-50`, dark: -850), so
        // unlike the goal bar — which already frosts itself with the official
        // `--dsw-menu-backdrop-filter` — the plan card gets the shared material.
        // FRAGILITY: build-hashed like `.EvIC1a_toBottom`; re-check on upgrades.
        // The card sits in the transcript, OUTSIDE the composer card, so its
        // backdrop root is the page and the blur is real.
        pushGlassDarkRule(out, '.k74WwW_card', g)
        out.push(
          glassRule('.k74WwW_card', [
            ...glassVarLines(g, false),
            '  border-color: transparent !important;'
          ], g),
          // The shared rule's background is `!important`, so the shipped :hover
          // rule would lose; restore a hover cue with a slightly stronger tint.
          ':root[' + ROOT_ATTR + '="on"] .k74WwW_card:hover {',
          tintDecl(hoverTint(g), true),
          '}'
        )
      }

      if (groups.toBottom.on) {
        const g = groups.toBottom
        // The "back to bottom" button. It has no stable data attribute — only
        // the build-hashed `.EvIC1a_toBottom` class — so it is pinned by that
        // name. No sheen here: 34px is too small for the gradient to read.
        // ONLY the outer drop shadow differs from the shared material:
        // redefining the halo variable on the button leaves its box-shadow
        // list — top highlight, bottom shade — and the shared outline line
        // byte-identical to every other surface.
        pushGlassDarkRule(out, '.EvIC1a_toBottom', g)
        out.push(
          glassRule('.EvIC1a_toBottom', [
            ...glassVarLines(g, false),
            '  --dsh-glass-halo: var(--dsh-glass-button-halo);'
          ], g),
          // The shared rule's background is `!important`, so the shipped :hover
          // rule would lose; restore a hover cue with a slightly stronger tint.
          ':root[' + ROOT_ATTR + '="on"] .EvIC1a_toBottom:hover {',
          tintDecl(hoverTint(g), true),
          '}'
        )
      }

      if (groups.chips.on) {
        const g = groups.chips
        // The bottom status row: session statistics plus token usage. Both pills
        // already share one root, and that root carries the stable
        // `data-composer-stats` attribute, so a single rule puts BOTH in one
        // chip. It hugs its content instead of the shipped full-width row. The
        // shipped row sat FLUSH under the card — the container has no gap — and
        // its only spacing was 4px of its own top padding; this keeps that same
        // 4px, so the chip does not drift away from the composer. The halo is
        // downward-only for the same reason, and `overflow:hidden` clips the
        // pills' hover backgrounds to the chip's rounded ends.
        pushGlassDarkRule(out, '[data-composer-stats]', g)
        pushGlassDarkRule(out, '.JObwrW_root', g)
        out.push(
          glassRule('[data-composer-stats]', [
            ...glassVarLines(g, false),
            '  width: max-content;',
            '  max-width: 100%;',
            '  margin: 4px auto 0;',
            '  padding: 2px 10px;',
            '  gap: 8px;',
            '  border-radius: 999px;',
            '  overflow: hidden;',
            // Replaces the shared box-shadow wholesale: its bottom-shade layer is
            // tuned for tall surfaces, and this halo must not reach upward. The
            // ring line stays on the shared outline from glassSurface.
            '  box-shadow:',
            '    inset 0 1px 0 0 var(--dsh-glass-inner),',
            '    var(--dsh-glass-chip-halo) !important;'
          ], g),

          // The context-usage pill ("上下文已用 N%") is the stats pill's sibling
          // in the status dock, wrapped one level apart, so no structural
          // selector (:has / ~) can single it out — the dock matches `:has(>)`
          // only through a wrapper div. Use the component's root class instead;
          // FRAGILITY: it is build-hashed like `EvIC1a_toBottom` above and must
          // be re-checked after every DSH upgrade (`.JObwrW_root` was the sole
          // match on page).
          glassRule('.JObwrW_root', [
            ...glassVarLines(g, false),
            '  width: max-content;',
            '  max-width: 100%;',
            '  margin: 4px 0 0;',
            '  padding: 2px 10px;',
            '  gap: 8px;',
            '  border-radius: 999px;',
            '  overflow: hidden;',
            '  box-shadow:',
            '    inset 0 1px 0 0 var(--dsh-glass-inner),',
            '    var(--dsh-glass-chip-halo) !important;'
          ], g)
        )
      }

      if (groups.menu.on) {
        // The slash-command popover (typing `/` in the composer) portals into
        // an overlay anchor INSIDE the composer card. Its menu container ships
        // a translucent fill but NO blur, so transcript text bleeds through
        // unblurred and collides with the items. Anchor by semantics — the page
        // hosts exactly one listbox, and this is its menu container — and give
        // it the standard material. This only blurs for real because the card
        // no longer carries a backdrop-filter (see the card rule above): with
        // the card filter-free, the popover's backdrop root is the page itself.
        pushGlassDarkRule(out, 'div:has(> [role=listbox])', groups.menu)
        out.push(
          glassRule('div:has(> [role=listbox])', [
            ...glassVarLines(groups.menu, false),
            '  overflow: hidden;'
          ], groups.menu)
        )
      }

      out.push(...CSS_UI)
      return out.join('\n')
    }

    // ------------------------------------------------------------------ state

    /**
     * Live preference, owned by `apply`: the global switch plus one value
     * object per surface group.
     *
     * A settings row unmounts when the user navigates away from the section, so
     * the state cannot live inside the component — and it must not live in this
     * module either, because client HMR re-runs `apply()` and a reload starts a
     * fresh module. The authoritative copy is the plugin's volatile Config on
     * the Host (`lib/index.js`), reached through the configForms form bound in
     * `apply`; this module keeps a mirror only so the CSS and the card can
     * render synchronously.
     */
    let enabled = DEFAULT_ENABLED
    let groups = presetGroups()
    /** Bound in `apply`; null until then so the row can still mount. */
    let form = null
    /** The style tag `apply` created; rebuilt whenever a group value moves. */
    let styleTag = null
    const listeners = []

    /** Re-render the stylesheet from the current mirror. */
    function rebuildCSS() {
      if (styleTag) styleTag.textContent = buildCSS(groups)
    }

    /** Push the mirror to every mounted component. */
    function notifyAll() {
      const snapshot = { enabled, groups }
      for (const notify of listeners) notify(snapshot)
    }

    /**
     * Apply the global switch to the pane.
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
      if (changed) notifyAll()
      if (persist && form) {
        // The Host is the fact source, but a rejected write (no entry yet
        // after an upgrade, or a memory-mode client) must not break the local
        // toggle — log and carry on.
        form.set(PREF_FIELD, next).catch((err) => {
          console.error('[composer-glass] preference not persisted:', err)
        })
      }
    }

    /**
     * Set one group field. `persist === 'live'` previews only (a slider mid-
     * drag); `true` also writes the flat Config field, matching the Host
     * schema (`<group>_<field>`). The write fires even when the mirror already
     * holds the value — a slider's commit follows a live preview that changed
     * it, so an equality early-return would silently skip the persist.
     */
    function setGroupField(key, field, value, persist) {
      if (groups[key][field] !== value) {
        groups[key][field] = value
        rebuildCSS()
        notifyAll()
      }
      if (persist === true && form) {
        form.set(key + '_' + field, value).catch((err) => {
          console.error('[composer-glass] group preference not persisted:', err)
        })
      }
    }

    /** Restore every group to the shipped preset and persist all 42 fields. */
    function resetGroups() {
      const fresh = presetGroups()
      groups = fresh
      rebuildCSS()
      notifyAll()
      if (form) {
        const writes = []
        for (const key of GROUP_KEYS) {
          for (const field of ['on', 'blur', 'tint', 'saturate', 'brightness', 'shadow', 'highlight']) {
            writes.push(form.set(key + '_' + field, fresh[key][field]))
          }
        }
        Promise.allSettled(writes).then((results) => {
          for (const r of results) {
            if (r.status === 'rejected') console.error('[composer-glass] reset write failed:', r.reason)
          }
        })
      }
    }

    /**
     * The stored preference, or null while the settings document is unknown.
     * Groups fall back to the preset field-by-field, so a profile written by
     * an older build (only `enabled`) still loads cleanly.
     */
    function storedPreference() {
      if (!form) return null
      const snapshot = form.getSnapshot()
      if (!snapshot || snapshot.status !== 'ready') return null
      const value = snapshot.value
      if (!value) return null
      const out = { enabled: null }
      for (const key of GROUP_KEYS) out[key] = groupFromSnapshot(value, key)
      if (typeof value[PREF_FIELD] === 'boolean') out.enabled = value[PREF_FIELD]
      return out
    }

    /** Adopt the Host value after the first mirror read or any later commit. */
    function syncFromForm() {
      const stored = storedPreference()
      if (!stored) return
      if (stored.enabled !== null) setEnabled(stored.enabled, false)
      const groupState = {}
      for (const key of GROUP_KEYS) groupState[key] = stored[key]
      groups = groupState
      rebuildCSS()
      notifyAll()
    }

    // -------------------------------------------------------------------- row

    /** Shared pill pair; `on` renders the first pill selected. */
    function PillPair(props) {
      const on = props.on
      const pick = (id) => props.onPick(id === 'on')
      return React.createElement(
        'div',
        { className: PREFIX + '-pills', role: 'radiogroup', 'aria-label': props.label },
        React.createElement(
          'button',
          {
            type: 'button',
            className: PREFIX + '-pill' + (on ? ' on' : ''),
            role: 'radio',
            'aria-checked': on,
            onClick: () => pick('on')
          },
          props.onText
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: PREFIX + '-pill' + (on ? '' : ' on'),
            role: 'radio',
            'aria-checked': !on,
            onClick: () => pick('off')
          },
          props.offText
        )
      )
    }

    function GlassRow(props) {
      // Prefer the renderer's injected `t` seat, and fall back to a locally
      // bound translate so the row still works if the seat is absent.
      const t = props && props.t ? props.t : fallbackT
      const [on, setOn] = React.useState(enabled)

      React.useEffect(() => {
        const update = (state) => setOn(state.enabled)
        listeners.push(update)
        setOn(enabled)
        return () => {
          const at = listeners.indexOf(update)
          if (at >= 0) listeners.splice(at, 1)
        }
      }, [])

      // Two plain pill buttons (the same pattern dsh-local-llm-controller uses
      // for slot/mode choices). New-loader plugins must not require
      // @deepseek-ai/dsh-client-ui-primitives — the profile does not ship it
      // and require() comes back undefined, which crashes the card with React
      // error #130. The card page already shows the plugin title and
      // description, so the row renders the switch alone.
      return React.createElement(PillPair, {
        on,
        onPick: (next) => setEnabled(next, true),
        label: t('row.title'),
        onText: t('opt.on'),
        offText: t('opt.off')
      })
    }

    /** One tuning slider: label, range input, formatted value. */
    function GlassSlider(props) {
      const fmt = props.format
      return React.createElement(
        'label',
        { className: PREFIX + '-slider' },
        React.createElement('span', { className: PREFIX + '-sliderLabel' }, props.label),
        React.createElement('input', {
          type: 'range',
          min: props.range.min,
          max: props.range.max,
          step: props.range.step,
          value: props.value,
          // Dragging previews live; the gesture's END reads the input's own
          // value — not a captured prop, which goes stale mid-gesture — and
          // persists it (pointer release, or blur/keyup for keyboard changes).
          onChange: (e) => props.onLive(Number(e.target.value)),
          onPointerUp: (e) => props.onCommit(Number(e.target.value)),
          onBlur: (e) => props.onCommit(Number(e.target.value)),
          onKeyUp: (e) => props.onCommit(Number(e.target.value))
        }),
        React.createElement('span', { className: PREFIX + '-sliderVal' }, fmt(props.value))
      )
    }

    const SLIDER_FIELDS = [
      { field: 'blur', labelKey: 'param.blur', format: (v) => v + 'px' },
      { field: 'tint', labelKey: 'param.tint', format: (v) => v + '%' },
      { field: 'saturate', labelKey: 'param.saturate', format: (v) => v + '%' },
      { field: 'brightness', labelKey: 'param.brightness', format: (v) => (v / 100).toFixed(2) },
      { field: 'shadow', labelKey: 'param.shadow', format: (v) => v + '%' },
      { field: 'highlight', labelKey: 'param.highlight', format: (v) => v + '%' }
    ]

    /** One group box: title + on/off pills, then the six tuning sliders. */
    function GroupPanel(props) {
      const t = props.t
      const key = props.group.key
      const value = props.value
      return React.createElement(
        'div',
        { className: PREFIX + '-group' },
        React.createElement(
          'div',
          { className: PREFIX + '-groupHead' },
          React.createElement('span', { className: PREFIX + '-groupTitle' }, t(props.group.titleKey)),
          React.createElement(PillPair, {
            on: value.on,
            onPick: (next) => setGroupField(key, 'on', next, true),
            label: t(props.group.titleKey),
            onText: t('opt.on'),
            offText: t('opt.off')
          })
        ),
        React.createElement(
          'div',
          { className: PREFIX + '-sliders' },
          SLIDER_FIELDS.map((s) =>
            React.createElement(GlassSlider, {
              key: s.field,
              label: t(s.labelKey),
              range: RANGE[s.field],
              format: s.format,
              value: value[s.field],
              onLive: (v) => setGroupField(key, s.field, v, 'live'),
              onCommit: (v) => setGroupField(key, s.field, v, true)
            })
          )
        )
      )
    }

    function GroupsPanel(props) {
      const t = props.t
      // Subscribe to the shared mirror so external commits (another card, a
      // later form sync) re-render the sliders too.
      const [, force] = React.useReducer((n) => n + 1, 0)
      React.useEffect(() => {
        const update = () => force()
        listeners.push(update)
        return () => {
          const at = listeners.indexOf(update)
          if (at >= 0) listeners.splice(at, 1)
        }
      }, [])
      return React.createElement(
        'div',
        { className: PREFIX + '-panel' },
        React.createElement('div', { className: PREFIX + '-panelTitle' }, t('groups.title')),
        React.createElement('button', { type: 'button', className: PREFIX + '-reset', onClick: resetGroups }, t('reset')),
        GROUPS.map((g) => React.createElement(GroupPanel, { key: g.key, group: g, value: groups[g.key], t }))
      )
    }

    /**
     * The Plugins-page row-config card (`plugins.row.config` slot). The page
     * renders the same component in two views: `summary` is the one-liner on
     * the collapsed row, `page` is the card the 配置 button opens — which is
     * just the preference row. This mirrors how dsh-local-llm-controller
     * branches on `view`.
     */
    function GlassCard(props) {
      const t = props && props.t ? props.t : fallbackT
      if (props.view === 'summary') {
        return React.createElement('div', { className: PREFIX + '-cardSummary' }, t('card.summary'))
      }
      return React.createElement(
        'div',
        null,
        React.createElement(GlassRow, { t }),
        React.createElement(GroupsPanel, { t })
      )
    }

    /** Bound translate, replaced in `apply` once the locale service is in hand. */
    let fallbackT = (key) => key

    // ----------------------------------------------------------------- plugin

    /**
     * `slots` hosts the Plugins-page config card, `locale` the card's
     * dictionaries, `configForms` the shared settings mirror and write queue,
     * and `remote` carries the forwarded settings invalidation that
     * `ctx.configForms.get()` subscribes to (the exact service list ui-theme
     * declares).
     */
    exports.inject = ['slots', 'locale', 'remote', 'configForms']

    exports.apply = function apply(ctx) {
      // A formal package has no style service (the dynamic-plugin `styles`
      // symbol does not exist here), so the stylesheet is a plain tag this
      // plugin owns and removes with its fiber. Its text is rebuilt from the
      // live group values whenever a slider, pill or the reset moves.
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-composer-glass'
        tag.dataset.pluginCss = 'dsh-composer-glass'
        styleTag = tag
        rebuildCSS()
        document.head.appendChild(tag)
        return () => {
          styleTag = null
          tag.remove()
        }
      }, 'composer-glass: styles')

      // Register the row's dictionaries in one call (the 0.1.7 signature maps
      // locale id -> dictionary). Registration bumps the locale revision, so
      // already-mounted outlets pick the texts up at once.
      ctx.effect(() => ctx.locale.register(NS, MESSAGES), 'composer-glass: dictionaries')

      fallbackT = ctx.locale.bind(NS)

      // Durable home for the on/off choice: the shared form over this plugin's
      // settings namespace (the profile entry id). The Host validates writes
      // against the Config schema declared in lib/index.js.
      form = ctx.configForms.get(ENTRY_ID)

      // Every Host commit — including the first mirror read and this plugin's
      // own write — lands here; a changed value flips the pane without polling.
      ctx.effect(() => form.subscribe(() => syncFromForm()), 'composer-glass: preference sync')

      // The pane must be correct on first paint, before Settings is ever opened.
      // A stored choice is adopted when the mirror already holds one (the common
      // case after a hot replace); otherwise start on the schema defaults and
      // let the subscription correct it a moment later.
      if (storedPreference()) syncFromForm()
      else setEnabled(DEFAULT_ENABLED, false)

      // The switch lives where 0.1.7 puts plugin switches: the Plugins page
      // row's 配置 button (`plugins.row.config` keyed slot). The key is
      // `<bundle package name>#<patch row id>` — it must match
      // cordis.patch.yml exactly or the page cannot pair the card with the
      // row. `locale` gives the rendered component its `t` seat; the slot
      // hands the component `view` ('summary' | 'page') and `entryKey`.
      ctx.effect(
        () =>
          ctx.slots.inject('plugins.row.config', () =>
            ctx.slots.register(
              { name: 'plugins.row.config', key: 'dsh-composer-glass#' + ENTRY_ID, locale: NS },
              GlassCard
            )
          ),
        'composer-glass: plugins-page card'
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

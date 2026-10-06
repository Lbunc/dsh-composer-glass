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
 * Assets: none of its own. No images, no fonts, no network — the glass is CSS.
 * The WALLPAPER feature adds one dynamic asset: the user's own image or video
 * file, served by the Host half over `/plugins/dsh-composer-glass/wallpaper`.
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
    /** Root attribute gating the wallpaper rules ("on" / "off"), independent of the glass switch. */
    const WALLPAPER_ATTR = 'data-dsh-wallpaper'
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
      { key: 'floaters', titleKey: 'group.floaters' },
      { key: 'chips', titleKey: 'group.chips' },
      { key: 'toBottom', titleKey: 'group.toBottom' },
      { key: 'sidebar', titleKey: 'group.sidebar' },
      { key: 'content', titleKey: 'group.content' },
      { key: 'dialogs', titleKey: 'group.dialogs' }
    ])

    const GROUP_KEYS = GROUPS.map((g) => g.key)

    /**
     * First-run defaults that differ from the shared PRESET, mirroring the
     * values the author actually runs with. Must match GROUP_DEFAULTS in
     * `lib/index.js`.
     */
    const GROUP_DEFAULTS = Object.freeze({
      card: { shadow: 55 },
      sidebar: { shadow: 0 },
      content: { shadow: 0 },
      dialogs: { shadow: 0 }
    })

    /** One field's first-run default for a group (override, else PRESET). */
    function presetFor(key, field) {
      const override = GROUP_DEFAULTS[key]
      return override && override[field] !== undefined ? override[field] : PRESET[field]
    }

    /** One group's values: the first-run defaults for every field. */
    function presetGroup(key) {
      return {
        on: true,
        blur: presetFor(key, 'blur'),
        tint: presetFor(key, 'tint'),
        saturate: presetFor(key, 'saturate'),
        brightness: presetFor(key, 'brightness'),
        shadow: presetFor(key, 'shadow'),
        highlight: presetFor(key, 'highlight')
      }
    }

    /** Fresh state for all groups. */
    function presetGroups() {
      const out = {}
      for (const key of GROUP_KEYS) out[key] = presetGroup(key)
      return out
    }

    /** Read one group's flat snapshot fields, falling back to the defaults. */
    function groupFromSnapshot(value, key) {
      const num = (name, fallback) => (typeof value[name] === 'number' ? value[name] : fallback)
      return {
        on: typeof value[key + '_on'] === 'boolean' ? value[key + '_on'] : true,
        blur: num(key + '_blur', presetFor(key, 'blur')),
        tint: num(key + '_tint', presetFor(key, 'tint')),
        saturate: num(key + '_saturate', presetFor(key, 'saturate')),
        brightness: num(key + '_brightness', presetFor(key, 'brightness')),
        shadow: num(key + '_shadow', presetFor(key, 'shadow')),
        highlight: num(key + '_highlight', presetFor(key, 'highlight'))
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
        'row.title': '毛玻璃动态壁纸',
        'card.summary': '选择毛玻璃与壁纸的开启或关闭',
        'opt.on': '开启',
        'opt.off': '关闭',
        'row.master': '毛玻璃总开关',
        'groups.title': '分部位调节',
        'reset': '重置为预设',
        'group.card': '输入卡片',
        'group.floaters': '浮动部件（停靠条 / 指令菜单 / Plan 卡片）',
        'group.chips': '状态胶囊（会话统计 / 上下文用量）',
        'group.toBottom': '回到底部按钮',
        'group.sidebar': '侧边栏',
        'group.content': '内容表面（壁纸）',
        'group.dialogs': '弹窗卡片（提问 / 权限审批）',
        'param.blur': '模糊',
        'param.tint': '透明度',
        'param.saturate': '饱和度',
        'param.brightness': '亮度',
        'param.shadow': '阴影',
        'param.highlight': '边缘高光',
        'wall.title': '壁纸',
        'wall.summary': '在界面底层显示壁纸或动态壁纸（视频循环播放）',
        'wall.on': '显示壁纸或动态壁纸',
        'wall.path': '文件路径',
        'wall.fit': '填充方式',
        'fit.cover': '铺满',
        'fit.contain': '完整显示',
        'param.dim': '调暗 / 调亮',
        'wall.hint': '支持图片（jpg / png / webp / avif / gif）与视频（mp4 / webm）；添加壁纸路径后刷新浏览器生效'
      },
      en: {
        'row.title': 'Frosted Glass & Dynamic Wallpaper',
        'card.summary': 'Choose whether the frosted glass and the wallpaper are on or off',
        'opt.on': 'On',
        'opt.off': 'Off',
        'row.master': 'Frosted glass master switch',
        'groups.title': 'Per-group tuning',
        'reset': 'Reset to preset',
        'group.card': 'Composer card',
        'group.floaters': 'Floating pieces (docks / slash menu / plans)',
        'group.chips': 'Status capsules (stats / context usage)',
        'group.toBottom': 'Back-to-bottom button',
        'group.sidebar': 'Sidebar',
        'group.content': 'Content surfaces (wallpaper)',
        'group.dialogs': 'Dialog cards (questions / approvals)',
        'param.blur': 'Blur',
        'param.tint': 'Tint',
        'param.saturate': 'Saturation',
        'param.brightness': 'Brightness',
        'param.shadow': 'Shadow',
        'param.highlight': 'Edge highlight',
        'wall.title': 'Wallpaper',
        'wall.summary': 'Show a wallpaper or looping video behind the UI',
        'wall.on': 'Show a wallpaper or video wallpaper',
        'wall.path': 'File path',
        'wall.fit': 'Fit',
        'fit.cover': 'Cover',
        'fit.contain': 'Contain',
        'param.dim': 'Dim / Brighten',
        'wall.hint': 'Images (jpg / png / webp / avif / gif) and videos (mp4 / webm) are supported; refresh the browser after adding a wallpaper path'
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
     * FRAGILITY: the `.wSkVaW_*`-style selectors are build-hashed class names
     * read out of the shipped bundles. web and desktop (DeepSeek Harness) are
     * TWO INDEPENDENT BUILDS whose hashes share no prefix — the difference is
     * per-platform packaging, not a dsh version boundary (the web hashes have
     * been stable across 0.1.7 → 0.2.0-rc.2). So every hashed surface below
     * lists BOTH builds' selectors side by side — a class that is absent from
     * the running build simply matches nothing. If an effect silently reverts,
     * check these first: `[data-composer-card]`, `[data-testid="todo-panel"]`,
     * `[data-composer-stats]` and `[data-trigger-menu]` (the slash-command
     * menu container) are stable data attributes shared by both builds and are
     * preferred wherever one is available — only the back-to-bottom button has
     * none in either build.
     */

    /**
     * The build-hashed surfaces, one entry per platform build. Verified
     * against: web build bundles shipped with dsh 0.1.7-rc.1 AND
     * 0.2.0-rc.2 (identical: `wSkVaW` = conversation layout, `nLMEza` =
     * GoalBar.module.css, `k74WwW` = PlanPreview.module.css, `EvIC1a` =
     * ChatView.module.css, `JObwrW` = ContextMeter.module.css) and the
     * desktop (DeepSeek Harness app.asar) build of dsh 0.2.0-rc.2 (`Dc7zOa`
     * / `nJdiTq` / `KuQXFq` / `xz4KEq` / `_2WTFBq`, same order).
     */
    const HASHED = {
      /** The opaque chrome the glass has to clear (pane, scroll body, bodies). */
      chrome: ['.wSkVaW_root', '.wSkVaW_scrollBody', '.wSkVaW_body', '.wSkVaW_viewArea', '.Dc7zOa_root', '.Dc7zOa_scrollBody', '.Dc7zOa_body', '.Dc7zOa_viewArea'],
      /** The composer seat — owner of the built-in 36px downward fade. */
      seat: ['.wSkVaW_composerSeat', '.Dc7zOa_composerSeat'],
      /** The goal bar above the composer (docks group). */
      goalBar: ['.nLMEza_bar', '.nJdiTq_bar'],
      /** The plan cards inside the transcript (plan group). */
      planCard: ['.k74WwW_card', '.KuQXFq_card'],
      /** The floating back-to-bottom button. */
      toBottom: ['.EvIC1a_toBottom', '.xz4KEq_toBottom'],
      /** The context-usage pill beside the stats chip (chips group). */
      contextPill: ['.JObwrW_root', '._2WTFBq_root'],
      /**
       * Wallpaper chrome, one entry per platform build. Verified against the
       * web build of dsh 0.2.0-rc.2 (`pI_x6G` / `hHd-Xa`, from
       * `dsh-client-ui-layout` AppFrame.module.css — `.pI_x6G_frame` paints
       * `--dsw-alias-bg-base`, `.pI_x6G_sidebarCol` the sidebar fill — and
       * `dsh-client-ui-sidebar` Sidebar.module.css, `.hHd-Xa_root` painting
       * the same fill again one level inside) and the desktop (DeepSeek
       * Harness app.asar) build of the same version (`BynINW` / `_2H3hWW`,
       * same modules, desktop re-hash).
       */
      frame: ['.pI_x6G_frame', '.BynINW_frame'],
      sidebarCol: ['.pI_x6G_sidebarCol', '.BynINW_sidebarCol'],
      sidebarRoot: ['.hHd-Xa_root', '._2H3hWW_root'],
      /**
       * The center column (conversation / global panels). The WEB build ships
       * it unpainted, but the desktop build paints it opaque — twice: the
       * titlebar variant `[data-windows-titlebar] …_centerCol` carries
       * `background: var(--dsw-alias-bg-base)` (plus the rounded content
       * corner) and a rightbar-adjacent variant carries the same fill. With
       * the wallpaper on it reads as a white slab over the photo — the
       * conversation area and the plugin page both sit inside this column —
       * so the wallpaper section clears it (glass-only mode keeps it: the
       * shipped chrome stays and the glass surfaces blur it, as on web).
       */
      centerCol: ['.pI_x6G_centerCol', '.BynINW_centerCol'],
      /**
       * The sidebar list's built-in bottom fade (`linear-gradient(transparent,
       * var(--dsw-specific-sidebar-fill))`): opaque by design so the list's
       * last row melts into the page fill. Whenever we take that fill away
       * (sidebar glass group or wallpaper), the strip surfaces as a hard white
       * band right above the settings row — clear it wherever the fill is gone.
       * A true fade (backdrop blur + mask) was tried here instead, but the
       * blur scatters at the strip's edges — invisible over flat fills, a
       * bright/dark fog band over a moving wallpaper — so fading is simply
       * dropped wherever we removed the fill. Per-platform module hashes:
       * `bhn1Oq` is the web build's sidebar list, `_9lTDKa` the desktop
       * (DeepSeek Harness) build's session list — the earlier claim that the
       * desktop ships no fade was wrong; its fade just lives in a different
       * module.
       */
      sidebarFade: ['.bhn1Oq_fade', '._9lTDKa_fade']
    }

    /**
     * Wallpaper content surfaces — the near-opaque whites DSH paints INSIDE
     * the transcript and sidebar, one entry per platform build: the
     * new-session pill (`--dsw-alias-button-elevated-fill`), the user
     * bubble (`--dsw-specific-bubble`), markdown code blocks (both the
     * `_7gxqk` block and the `_1pq26` card variants; `md-code-block` is the
     * one stable, non-hashed class among them — it and the two
     * content-hashed names are identical across BOTH builds), the code
     * block's sticky banner strip (`--dsw-alias-bg-base`), inline `<code>`
     * (`--dsw-alias-markdown-inline-code`) and file reference cards
     * (`--deliverable-fill`). The `dialogs` bundle carries the approval card
     * and the plan-review / question-composer / answer-bubble cards, which
     * paint `--dsw-specific-input-major` at full strength (the composer card
     * glassifies the same variable at 17%).
     * Web hashes verified against the dsh 0.2.0-rc.2 web build; desktop
     * twins against the DeepSeek Harness app.asar build of the same version
     * (`_2H3hWW` sidebar, `cJsG2q` chat bubble, `flL80G` deliverables file
     * card, `j_8BDW` approval, `P2izSq` PlanReviewPanel / `mAtvLq`
     * QuestionComposer / `v1fjQa` QuestionReplyView, `_3GBCTG` reasoning
     * row, `fO69Vq` plugin-manager page).
     */
    const WALL_CONTENT = {
      surfaces: [
        '.md-code-block',
        '._card_1pq26_1',
        '.hHd-Xa_newSession', '._2H3hWW_newSession',
        '.Sixlwa_bubble', '.cJsG2q_bubble',
        '.nyYjTG_file', '.flL80G_file'
      ],
      // The approval card and the plan-review / question cards paint
      // `--dsw-specific-input-major` at FULL strength (the composer card
      // glassifies the same variable at 17%), so over a wallpaper they read
      // as plain white slabs. `.ROF66W_bubble` / `.v1fjQa_bubble` are the
      // answer bubble inside the question card (same `--dsw-specific-bubble`
      // as `.Sixlwa_bubble` / `.cJsG2q_bubble`).
      // Owned by the `dialogs` group; same wallpaper gating as `surfaces`.
      dialogs: [
        '.mna1RW_card', '.LVzXQa_card', '.Mbwy4a_card', '.ROF66W_bubble',
        '.j_8BDW_card', '.P2izSq_card', '.mAtvLq_card', '.v1fjQa_bubble'
      ],
      codeBlocks: ['.md-code-block', '._card_1pq26_1'],
      banner: ['._bannerWrap_7gxqk_24'],
      // Inline code chips only: a bare `code` would also match the shiki
      // <code> inside every code block, painting a dark slab over the
      // frosted card (dark theme) / a white film (light theme).
      inline: ['code:not(pre code)'],
      hover: [
        '.hHd-Xa_newSession:hover', '._2H3hWW_newSession:hover',
        '.nyYjTG_file:hover', '.flL80G_file:hover'
      ],
      // Nested inside the question card: a tint is enough — the card's own
      // backdrop-filter already frosts what sits behind the whole subtree.
      nested: ['.Mbwy4a_customBlock', '.mAtvLq_customBlock'],
      // The expanded reasoning ("思考") row is a sticky header that paints an
      // opaque `--dsw-alias-bg-base` backdrop to mask the content scrolling
      // underneath — over a wallpaper that reads as a near-black bar. It
      // cannot be cleared to transparent (content would bleed through), so
      // frost it instead; the blur keeps the sticky masking.
      reasoningRow: [
        '.lcKema_root[data-expanded] [data-open] [data-disclosure-row]',
        '._3GBCTG_root[data-expanded] [data-open] [data-disclosure-row]'
      ],
      // The plugin-manager page column (no shipped fill at all): with the
      // wallpaper on the plugin rows sit right on the photo and the text
      // scatters against it. Frost the whole column into one glass panel so
      // the list reads against a single calm surface.
      pluginPage: ['.X_2TxG_page', '.fO69Vq_page']
    }

    /** Normalize a selector argument (string or array) to an array. */
    const sels = (selector) => (Array.isArray(selector) ? selector : [selector])

    /**
     * Comma-join the selectors with the on-gate prefix on EACH of them. A
     * naive `prefix + list.join(', ')` would leave every selector after the
     * first ungated, switching the pane on for logged-off states.
     */
    const gated = (selector, suffix) =>
      sels(selector).map((s) => ':root[' + ROOT_ATTR + '="on"] ' + s + (suffix || '')).join(', ')

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
      if (lines.length) {
        const sel = sels(selector)
          .map((s) => ':root[' + ROOT_ATTR + '="on"] body[data-ds-dark-theme] ' + s)
          .join(', ')
        out.push([sel + ' {', ...lines, '}'].join('\n'))
      }
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
      [gated(selector) + ' {', ...glassSurface(g), ...(extra || []), '}'].join('\n')

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
      [gated(selector, '::after') + ' {', ...SHEEN, '}'].join('\n')

    /**
     * The chrome-clearing preconditions (rules 1 and 2 of the note above). They
     * are part of the glass, not a permanent override: buildCSS emits them only
     * while at least one surface group is on, so "global on + every group off"
     * leaves the shipped opaque chrome standing instead of a stripped page with
     * no glass surface to show for the clearing.
     */
    const CSS_CLEAR = [
      gated(HASHED.chrome) + ' { background: none !important; }',
      gated(HASHED.seat) + ' { background: none !important; }'
    ]

    /**
     * The shadow palette as global `:root` / dark-body defaults — always
     * present, both for the surface rules and for a group's variable overrides
     * to scale against.
     */
    const CSS_VARS = [
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
      '.' + PREFIX + '-page { display: flex; flex-direction: column; gap: 10px; }',
      '.' + PREFIX + '-page .' + PREFIX + '-groupHead { padding: 0 2px; }',
      '.' + PREFIX + '-panel, .' + PREFIX + '-panel * { box-sizing: border-box; }',
      '.' + PREFIX + '-panel { display: flex; flex-direction: column; gap: 10px; }',
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
      '.' + PREFIX + '-reset:hover { color: var(--dsw-alias-label-primary, inherit); }',
      // The wallpaper path row: a full-width text input styled after the pills.
      '.' + PREFIX + '-inputRow { display: flex; align-items: center; gap: 8px; font-size: 12px; }',
      '.' + PREFIX + '-inputLabel { width: 52px; flex: none; color: var(--dsw-alias-label-secondary, #b6b6bc); }',
      '.' + PREFIX + '-input {',
      '  flex: 1; min-width: 0; font: inherit; font-size: 12px;',
      '  color: var(--dsw-alias-label-primary, inherit);',
      '  background: var(--dsw-alias-bg-module-platform, rgba(128,128,128,.16));',
      '  border: 1px solid transparent; border-radius: 8px; padding: 5px 10px;',
      '}',
      '.' + PREFIX + '-input:focus { outline: none; border-color: var(--dsw-alias-border, rgba(128,128,128,.3)); }',
      '.' + PREFIX + '-input::placeholder { color: var(--dsw-alias-label-tertiary, rgba(128,128,128,.6)); }',
      '.' + PREFIX + '-hint { font-size: 11px; color: var(--dsw-alias-label-tertiary, rgba(128,128,128,.6)); line-height: 1.5; }'
    ]

    /**
     * Build the full stylesheet from the live group values. A group switched
     * off contributes nothing — the shipped opaque styles simply win again,
     * exactly like the global off switch.
     */
    function buildCSS(groups) {
      const out = []
      // Clear the opaque chrome only while some glass surface exists to serve:
      // with every group off the shipped backgrounds must win again, exactly
      // like the global off switch (see CSS_CLEAR).
      if (GROUP_KEYS.some((key) => groups[key].on)) out.push(...CSS_CLEAR)
      out.push(...CSS_VARS)
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

      if (groups.floaters.on) {
        const g = groups.floaters
        // The pieces floating around the composer, one material driven by the
        // floaters sliders:
        // - the todo dock (`conversation.input.dock`). Its root carries the
        //   stable `data-testid`; collapsed and expanded differ only by whether
        //   the nested <ul> is mounted, so this single rule covers BOTH states.
        //   The shipped `overflow:hidden` already clips the list to the same
        //   rounded rectangle. `position:relative` anchors the sheen, and the
        //   glass ring replaces the shipped hairline so the two edges never
        //   stack.
        // - the goal bar above the composer. It frosts itself, but with the
        //   official menu recipe (0.58 menu fill + `--dsw-menu-backdrop-
        //   filter`, a 40px blur) — visibly milkier than our material. Its
        //   backdrop lives on a ::before, so both overrides target the pseudo-
        //   element and the bar: the ::before gets the shared tint and blur
        //   stack, and the bar swaps its `--dsw-elevation-panel` drop shadow
        //   for the glass ring/halo.
        // - the plan cards in the transcript ("Completed Turn's submitted
        //   plans"). Shipped as an opaque fill (`--dsw-static-neutral-50`,
        //   dark: -850), so unlike the goal bar they get the shared material
        //   outright; the cards sit OUTSIDE the composer card, so the blur is
        //   real.
        // - the slash-command popover (typing `/` in the composer). It portals
        //   into an overlay anchor INSIDE the composer card. Its menu container
        //   ships a translucent fill but NO blur, so transcript text bleeds
        //   through unblurred and collides with the items. Anchor on the
        //   container's own stable `data-trigger-menu` attribute — NOT on a
        //   structural `div:has(> [role=listbox])`, which would frost every
        //   other listbox holder on the page too. This only blurs for real
        //   because the card no longer carries a backdrop-filter (see the card
        //   rule above): with the card filter-free, the popover's backdrop root
        //   is the page itself.
        // FRAGILITY: the goal bar and plan card are build-hashed in both
        // platform builds (see HASHED.goalBar / HASHED.planCard).
        pushGlassDarkRule(out, '[data-testid="todo-panel"]', g)
        pushGlassDarkRule(out, HASHED.goalBar, g)
        pushGlassDarkRule(out, HASHED.planCard, g)
        pushGlassDarkRule(out, '[data-trigger-menu]', g)
        out.push(
          glassRule('[data-testid="todo-panel"]', [
            ...glassVarLines(g, false),
            '  position: relative;',
            '  border-color: transparent !important;'
          ], g),
          sheenRule('[data-testid="todo-panel"]'),
          // The goal bar's ::before gets the shared tint and blur stack…
          gated(HASHED.goalBar, '::before') + ' {',
          tintDecl(g.tint, true),
          '  backdrop-filter: ' + blurStack(g) + ' !important;',
          '  -webkit-backdrop-filter: ' + blurStack(g) + ' !important;',
          '}',
          // …and the bar itself swaps its drop shadow for the glass edge. Top
          // highlight + a small halo only: at 36px tall the material's bottom
          // shade pools too dark, and the full halo overpowers a bar this
          // thin — same call as the back-to-bottom button. The ring line rides
          // on outline (see GLASS_SHADOW): the bar's ::before blur scatters
          // inset ring layers into fog.
          gated(HASHED.goalBar) + ' {',
          ...glassVarLines(g, false),
          '  --dsh-glass-halo: var(--dsh-glass-button-halo);',
          '  box-shadow:',
          '    inset 0 1px 0 0 var(--dsh-glass-inner),',
          '    var(--dsh-glass-halo) !important;',
          '  outline: 1px solid var(--dsh-glass-ring);',
          '  outline-offset: -1px;',
          '}',
          glassRule(HASHED.planCard, [
            ...glassVarLines(g, false),
            '  border-color: transparent !important;'
          ], g),
          // The shared rule's background is `!important`, so the shipped :hover
          // rule would lose; restore a hover cue with a slightly stronger tint.
          gated(HASHED.planCard, ':hover') + ' {',
          tintDecl(hoverTint(g), true),
          '}',
          glassRule('[data-trigger-menu]', [
            ...glassVarLines(g, false),
            '  overflow: hidden;'
          ], g)
        )
      }

      if (groups.toBottom.on) {
        const g = groups.toBottom
        // The "back to bottom" button. It has no stable data attribute in
        // either platform build — only the build-hashed class — so it is pinned by
        // that name (see HASHED.toBottom). No sheen here: 34px is too small
        // for the gradient to read.
        // ONLY the outer drop shadow differs from the shared material:
        // redefining the halo variable on the button leaves its box-shadow
        // list — top highlight, bottom shade — and the shared outline line
        // byte-identical to every other surface.
        pushGlassDarkRule(out, HASHED.toBottom, g)
        out.push(
          glassRule(HASHED.toBottom, [
            ...glassVarLines(g, false),
            '  --dsh-glass-halo: var(--dsh-glass-button-halo);'
          ], g),
          // The shared rule's background is `!important`, so the shipped :hover
          // rule would lose; restore a hover cue with a slightly stronger tint.
          gated(HASHED.toBottom, ':hover') + ' {',
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
        // shipped 4px gap to the composer now lives in the status dock's own
        // padding-top (a 0.2.x build change — on 0.1.7 the row carried it as a
        // margin), so the chip adds NO top margin of its own: stacking the old
        // 4px margin on the dock's padding read as a doubled 8px gap. `auto`
        // keeps the chip centered. The halo is downward-only for the same
        // reason, and `overflow:hidden` clips the pills' hover backgrounds to
        // the chip's rounded ends.
        pushGlassDarkRule(out, '[data-composer-stats]', g)
        pushGlassDarkRule(out, HASHED.contextPill, g)
        out.push(
          glassRule('[data-composer-stats]', [
            ...glassVarLines(g, false),
            '  width: max-content;',
            '  max-width: 100%;',
            '  margin: 0 auto 0;',
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
          // FRAGILITY: it is build-hashed in both platform builds (see
          // HASHED.contextPill) and must be re-checked when either build ships
          // new hashes (web `.JObwrW_root`, desktop `._2WTFBq_root`).
          glassRule(HASHED.contextPill, [
            ...glassVarLines(g, false),
            '  width: max-content;',
            '  max-width: 100%;',
            // No top margin either: the dock's padding-top alone aligns this
            // capsule with the stats chip (the old 4px partner margin stacked
            // on top of it after the 0.2.x build change).
            '  margin: 0;',
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

      if (groups.sidebar.on) {
        // The left sidebar column (AppFrame grid child). The sidebar is a GRID
        // COLUMN, not an overlay: expanding/collapsing animates the column
        // width (`[data-animating]` on the frame), and these rules cover BOTH
        // states because the element never changes. The material frosts
        // whatever is painted behind the column — with the wallpaper on, that
        // is the wallpaper; without it, the opaque frame fill.
        //
        // The shipped fill lives on TWO stacked elements: the column itself
        // (`--dsw-specific-sidebar-fill`) and the sidebar root one level
        // inside, which paints the same fill again. The glass material goes on
        // the column (one blur for the whole sidebar); the inner root is only
        // CLEARED — an opaque child would otherwise hide the frost.
        //
        // FRAGILITY: the collapse toggle ([data-windows-titlebar] …_toggle,
        // both builds) is `position: fixed` — viewport-anchored into the
        // titlebar row — and a DOM descendant of this column, which also
        // ships `overflow: hidden`. A `backdrop-filter` ON THE COLUMN would
        // turn the column into that toggle's containing block: the button
        // re-anchors inside the column and vanishes under the overflow clip
        // (the misplaced-toggle bug). So the tint + blur live on the column's
        // ::before — a pseudo-element is nobody's ancestor, so the fixed
        // toggle keeps the viewport as its containing block — while the
        // column itself keeps only the fixed-safe parts: variables, relative
        // positioning, a transparent background (the wallpaper must show
        // through) and the shadow bundle (box-shadow/outline never create
        // fixed containing blocks). `z-index: 0` makes the column a stacking
        // context so the ::before's -1 keeps the frost BELOW the sidebar
        // content instead of escaping behind the frame (goalBar ::before
        // pattern, see the floaters group).
        const g = groups.sidebar
        pushGlassDarkRule(out, HASHED.sidebarCol, g)
        out.push(
          gated(HASHED.sidebarCol) + ' {',
          ...glassVarLines(g, false),
          '  position: relative;',
          '  z-index: 0;',
          '  background: transparent !important;',
          '  border-color: transparent !important;',
          ...GLASS_SHADOW,
          '}',
          gated(HASHED.sidebarCol, '::before') + ' {',
          "  content: '';",
          '  position: absolute;',
          '  inset: 0;',
          '  border-radius: inherit;',
          '  pointer-events: none;',
          '  z-index: -1;',
          tintDecl(g.tint, true),
          '  backdrop-filter: ' + blurStack(g) + ';',
          '  -webkit-backdrop-filter: ' + blurStack(g) + ';',
          '  transition: background-color .18s ease, backdrop-filter .18s ease;',
          '}',
          sheenRule(HASHED.sidebarCol),
          gated(HASHED.sidebarRoot) + ' { background: none !important; }',
          // Clearing the inner root also takes away the fill the shipped fade
          // melts into — drop the fade with it (a blur+mask fade scatters
          // visibly at the edges, see the HASHED.sidebarFade note).
          gated(HASHED.sidebarFade) + ' { background: none !important; }'
        )
      }

      // The wallpaper section, gated by its OWN attribute — independent of the
      // glass switch. It clears the window-level chrome so the fixed media
      // layer at `z-index:-1` shows through: body (its background propagates
      // to the canvas), the AppFrame root, the conversation chrome (the
      // same surfaces the glass CSS_CLEAR strips — duplicated here because the
      // wallpaper must work with the glass fully off), and the desktop-only
      // center column (titlebar + rightbar variants paint
      // `--dsw-alias-bg-base` — a slab web never had). The frame's ::before
      // titlebar drag strip is deliberately LEFT painted: it is the
      // window-caption region, and keeping the shipped theme fill there
      // (near-white light / near-black dark) is what stays consistent with
      // the OS-composited WCO window controls at its right end. The sidebar
      // fills are cleared too, EXCEPT the column itself when the sidebar
      // glass group is active: that rule already replaces the fill with the
      // tinted material, and a `background: none` here would fight it
      // (identical importance, later wins) and strip the tint.
      if (wallpaperActive()) {
        const wallGate = (selector) =>
          sels(selector).map((s) => ':root[' + WALLPAPER_ATTR + '="on"] ' + s).join(', ')
        const wallDarkGate = (selector) =>
          sels(selector)
            .map((s) => ':root[' + WALLPAPER_ATTR + '="on"] body[data-ds-dark-theme] ' + s)
            .join(', ')
        // The glass-gated wallpaper twins: the frosted content surfaces are
        // glass features, so they answer to the master switch too — glass off
        // leaves a bare wallpaper (chrome still cleared) with no frosting.
        const wallGlassGate = (selector) =>
          sels(selector)
            .map((s) => ':root[' + WALLPAPER_ATTR + '="on"][' + ROOT_ATTR + '="on"] ' + s)
            .join(', ')
        const wallGlassDarkGate = (selector) =>
          sels(selector)
            .map((s) => ':root[' + WALLPAPER_ATTR + '="on"][' + ROOT_ATTR + '="on"] body[data-ds-dark-theme] ' + s)
            .join(', ')
        out.push(
          wallGate('body') + ' { background: none !important; }',
          wallGate(HASHED.frame) + ' { background: none !important; }',
          // The desktop center column paints `--dsw-alias-bg-base` (titlebar +
          // rightbar variants) — the white slab that hid the wallpaper behind
          // the conversation and the plugin page.
          wallGate(HASHED.centerCol) + ' { background: none !important; }',
          wallGate([...HASHED.chrome, ...HASHED.seat]) + ' { background: none !important; }',
          wallGate(HASHED.sidebarRoot) + ' { background: none !important; }',
          // The list's bottom fade paints an opaque gradient toward the theme
          // fill; over a wallpaper it reads as a white band above the settings
          // row, so it goes the way of the other chrome. (A blur+mask fade was
          // tried instead — its edge scatter shows over a moving wallpaper.)
          wallGate(HASHED.sidebarFade) + ' { background: none !important; }'
        )
        if (!(enabled && groups.sidebar.on)) {
          out.push(wallGate(HASHED.sidebarCol) + ' { background: none !important; }')
        }

        // One shared material builder for the wallpaper content groups — the
        // white-tint frost over the group's own blur stack (light theme) and
        // the denser dark-theme base that tracks the tint slider.
        const wallFrost = (grp) => {
          const darkBase = Math.min(grp.tint + 28, 90) / 100
          return {
            frost: [
              '  background-color: rgba(255, 255, 255, ' + (grp.tint / 100) + ') !important;',
              '  backdrop-filter: ' + blurStack(grp) + ';',
              '  -webkit-backdrop-filter: ' + blurStack(grp) + ';',
              '  transition: background-color .18s ease, backdrop-filter .18s ease;'
            ],
            darkFrost:
              '  background-color: rgba(28, 28, 32, ' + darkBase + ') !important;\n' +
              '  backdrop-filter: blur(' + grp.blur + 'px) saturate(' + grp.saturate + '%);\n' +
              '  -webkit-backdrop-filter: blur(' + grp.blur + 'px) saturate(' + grp.saturate + '%);'
          }
        }

        // The content surfaces DSH paints in near-opaque whites — the new-
        // session pill, the user bubble, markdown code blocks, inline code,
        // file reference cards, the expanded reasoning row, the plugins page.
        // With the page fill gone these read as hard white patches over the
        // wallpaper. The `content` group owns them: one material driven by
        // that group's sliders (its shadow / highlight sliders are no-ops
        // here — these surfaces carry no glass edge or shadow of their own),
        // gated by the wallpaper attribute.
        if (groups.content.on) {
          const cg = groups.content
          const { frost, darkFrost } = wallFrost(cg)
          const hoverTint = Math.min(cg.tint + TINT_HOVER_DELTA + 1, 100)
          out.push(
          [wallGlassGate([...WALL_CONTENT.surfaces, ...WALL_CONTENT.banner, ...WALL_CONTENT.reasoningRow, ...WALL_CONTENT.pluginPage]) + ' {', ...frost, '}'].join('\n'),
          // Code blocks paint themselves through these variables (the shiki
          // <pre> carries its own !important background), so pinning the
          // variables to transparent is what actually clears them; the card's
          // backdrop-filter then does the frosting for the whole subtree.
          wallGlassGate(WALL_CONTENT.codeBlocks) +
            ' {\n  --dsl-code-block-background: transparent;\n  --dsw-alias-markdown-code-block: transparent;\n  --dsw-alias-markdown-code-block-banner: transparent;\n}',
          [wallGlassGate(WALL_CONTENT.inline) + ' {', ...frost, '}'].join('\n'),
          // Keep hover feedback alive: a slightly stronger tint replaces the
          // shipped hover fills our !important would otherwise flatten.
          wallGlassGate(WALL_CONTENT.hover) +
            ' { background-color: rgba(255, 255, 255, ' + (hoverTint / 100) + ') !important; }',
          [wallGlassDarkGate([...WALL_CONTENT.surfaces, ...WALL_CONTENT.banner, ...WALL_CONTENT.inline, ...WALL_CONTENT.reasoningRow, ...WALL_CONTENT.pluginPage]) + ' {', darkFrost, '}'].join('\n'),
          wallGlassDarkGate(WALL_CONTENT.hover) +
            ' { background-color: rgba(255, 255, 255, ' + (Math.round(cg.tint * 0.7) / 100) + ') !important; }'
          )
        }

        // The approval / ask-user dialog cards — their own group with the
        // same wallpaper-gated material, driven by the dialogs sliders (its
        // shadow / highlight sliders are no-ops, like the content group's).
        if (groups.dialogs.on) {
          const dg = groups.dialogs
          const { frost, darkFrost } = wallFrost(dg)
          out.push(
            [wallGlassGate(WALL_CONTENT.dialogs) + ' {', ...frost, '}'].join('\n'),
            // Nested inside the question card: a tint is enough — the card's
            // own backdrop-filter already frosts what sits behind the subtree.
            wallGlassGate(WALL_CONTENT.nested) +
              ' { background-color: rgba(255, 255, 255, ' + (dg.tint / 100) + ') !important; }',
            [wallGlassDarkGate([...WALL_CONTENT.dialogs, ...WALL_CONTENT.nested]) + ' {', darkFrost, '}'].join('\n')
          )
        }
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

    // -------------------------------------------------------------- wallpaper

    /** Host route serving the configured file; must match WALLPAPER_ROUTE in lib/index.js. */
    const WALLPAPER_URL = '/plugins/dsh-composer-glass/wallpaper'

    /** Field prefix in the Config; must match WALLPAPER_FIELDS_KEYS in lib/index.js. */
    const WALLPAPER_FIELD = 'wallpaper_'

    /** Fresh wallpaper state: off, no file, cover fit, no dimming. */
    function presetWallpaper() {
      return { on: false, path: '', fit: 'cover', dim: 0 }
    }

    /** Media kind for a wallpaper path from its extension; must mirror kindFor in lib/index.js. */
    function wallpaperKind(filePath) {
      const at = String(filePath || '').lastIndexOf('.')
      if (at < 0) return null
      const ext = filePath.slice(at + 1).toLowerCase()
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg'].includes(ext)) return 'image'
      if (['mp4', 'm4v', 'webm', 'mov', 'mkv', 'ogv'].includes(ext)) return 'video'
      return null
    }

    /**
     * Live wallpaper mirror (see `wall` semantics under the glass mirror).
     * The wallpaper is INDEPENDENT of the glass switch: it clears its own
     * chrome under `data-dsh-wallpaper`, so it works with the glass fully off.
     */
    let wall = presetWallpaper()
    /** The fixed bottom-of-stack layer holding the media element and the dim veil. */
    let wallLayer = null
    /** The current <img>/<video>; rebuilt when the media kind or path changes. */
    let wallMedia = null
    /** The dim veil above the media; its alpha follows the dim slider. */
    let wallDim = null

    /**
     * True when the wallpaper has something to show: switched on AND a path
     * whose extension maps to a media kind. Drives both the root attribute
     * and whether the stylesheet carries the wallpaper section at all.
     */
    function wallpaperActive() {
      return wall.on && wall.path !== '' && wallpaperKind(wall.path) !== null
    }

    /**
     * Reconcile the layer with the mirror. The layer is a body-level fixed
     * element at `z-index:-1` — below every in-flow surface (the app's #root
     * paints above it) but above the blank canvas. React never touches body
     * children it does not own, so the layer survives SPA re-renders; plugin
     * teardown removes it explicitly.
     */
    function syncWallpaper() {
      const kind = wallpaperKind(wall.path)
      const active = wallpaperActive()
      document.documentElement.setAttribute(WALLPAPER_ATTR, active ? 'on' : 'off')
      if (!active) {
        if (wallLayer) {
          wallLayer.remove()
          wallLayer = null
          wallMedia = null
          wallDim = null
        }
        return
      }
      if (!wallLayer || !wallLayer.isConnected) {
        wallDim = document.createElement('div')
        wallDim.className = PREFIX + '-wallpaper-dim'
        wallDim.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
        wallLayer = document.createElement('div')
        wallLayer.className = PREFIX + '-wallpaper'
        wallLayer.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;background:#000;'
        wallLayer.appendChild(wallDim)
        document.body.appendChild(wallLayer)
      }
      // Contained media letterboxes: black bars read as a video player, the
      // blank white canvas would not. Covered media hides the background fully.
      wallLayer.style.background = wall.fit === 'contain' ? '#000' : 'transparent'
      // The dim slider is bidirectional: negative values darken the wallpaper
      // with a black veil (useful in the dark theme), positive ones wash it
      // out with a white veil (the light-theme counterpart).
      wallDim.style.background =
        wall.dim < 0
          ? 'rgba(0,0,0,' + (-wall.dim / 100) + ')'
          : 'rgba(255,255,255,' + (wall.dim / 100) + ')'
      const signature = kind + '|' + wall.path
      if (wallMedia && wallMedia.dataset.wallpaper !== signature) {
        wallMedia.remove()
        wallMedia = null
      }
      if (!wallMedia) {
        if (kind === 'video') {
          // The browser autoplay policy requires muted + playsinline for a
          // programmatic start; loop makes it a dynamic wallpaper.
          const video = document.createElement('video')
          video.muted = true
          video.defaultMuted = true
          video.loop = true
          video.autoplay = true
          video.playsInline = true
          video.preload = 'auto'
          video.addEventListener('canplay', () => {
            video.play().catch(() => {})
          })
          video.addEventListener('error', () => {
            console.error('[composer-glass] wallpaper video failed to decode:', wall.path)
          })
          wallMedia = video
        } else {
          const img = document.createElement('img')
          img.alt = ''
          img.draggable = false
          img.addEventListener('error', () => {
            console.error('[composer-glass] wallpaper image failed to load:', wall.path)
          })
          wallMedia = img
        }
        wallMedia.dataset.wallpaper = signature
        wallMedia.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
        wallLayer.insertBefore(wallMedia, wallLayer.firstChild)
        wallMedia.src = WALLPAPER_URL
      }
      wallMedia.style.objectFit = wall.fit
    }

    /**
     * Set one wallpaper field. `persist === true` writes the flat Config field
     * (`wallpaper_<field>`), the same gesture rule as the glass sliders.
     */
    function setWallField(field, value, persist) {
      if (wall[field] !== value) {
        wall[field] = value
        // The wallpaper section of the stylesheet exists only while a media
        // file is actually activatable, so the gate state (on → off or the
        // reverse) has to rebuild it, same as a glass group change.
        rebuildCSS()
        syncWallpaper()
        notifyAll()
      }
      if (persist && form) {
        form.set(WALLPAPER_FIELD + field, value).catch((err) => {
          console.error('[composer-glass] wallpaper preference not persisted:', err)
        })
      }
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

    /** Restore every group to the shipped preset and persist all 49 fields. */
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
      out.wallpaper = {
        on: value[WALLPAPER_FIELD + 'on'] === true,
        path: typeof value[WALLPAPER_FIELD + 'path'] === 'string' ? value[WALLPAPER_FIELD + 'path'] : '',
        fit: value[WALLPAPER_FIELD + 'fit'] === 'contain' ? 'contain' : 'cover',
        dim: typeof value[WALLPAPER_FIELD + 'dim'] === 'number' ? value[WALLPAPER_FIELD + 'dim'] : 0
      }
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
      wall = stored.wallpaper
      rebuildCSS()
      syncWallpaper()
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
      // error #130. The card page shows the plugin title and description
      // above, but the switch itself ships no label of its own, so the row
      // spells out what the pills control.
      return React.createElement(
        'div',
        { className: PREFIX + '-groupHead' },
        React.createElement('span', { className: PREFIX + '-groupTitle' }, t('row.master')),
        React.createElement(PillPair, {
          on,
          onPick: (next) => setEnabled(next, true),
          label: t('row.title'),
          onText: t('opt.on'),
          offText: t('opt.off')
        })
      )
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
     * The wallpaper box: on/off pills, the local file path, the fit choice and
     * the dim slider. Reuses the group-box and slider widgets; the path writes
     * per keystroke (a volatile Config patch is cheap) so the pane follows the
     * text without a commit button.
     */
    function WallpaperPanel(props) {
      const t = props.t
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
        { className: PREFIX + '-group' },
        React.createElement(
          'div',
          { className: PREFIX + '-groupHead' },
          React.createElement('span', { className: PREFIX + '-groupTitle' }, t('wall.title')),
          React.createElement(PillPair, {
            on: wall.on,
            onPick: (next) => setWallField('on', next, true),
            label: t('wall.title'),
            onText: t('opt.on'),
            offText: t('opt.off')
          })
        ),
        React.createElement('div', { className: PREFIX + '-inputRow' },
          React.createElement('span', { className: PREFIX + '-inputLabel' }, t('wall.path')),
          React.createElement('input', {
            type: 'text',
            className: PREFIX + '-input',
            value: wall.path,
            placeholder: 'E:/Pictures/wallpaper/image.jpg',
            spellCheck: false,
            onChange: (e) => setWallField('path', e.target.value, true)
          })
        ),
        React.createElement(
          'div',
          { className: PREFIX + '-inputRow' },
          React.createElement('span', { className: PREFIX + '-inputLabel' }, t('wall.fit')),
          React.createElement(PillPair, {
            on: wall.fit === 'cover',
            onPick: (next) => setWallField('fit', next ? 'cover' : 'contain', true),
            label: t('wall.fit'),
            onText: t('fit.cover'),
            offText: t('fit.contain')
          })
        ),
        React.createElement(GlassSlider, {
          label: t('param.dim'),
          range: { min: -100, max: 100, step: 1 },
          format: (v) => v + '%',
          value: wall.dim,
          onLive: (v) => setWallField('dim', v, false),
          onCommit: (v) => setWallField('dim', v, true)
        }),
        React.createElement('div', { className: PREFIX + '-hint' }, t('wall.hint'))
      )
    }

    /**
     * The Plugins-page row-config card (`plugins.row.config` slot). The page
     * renders the same component in two views: `summary` is the one-liner on
     * the collapsed row, `page` is the card the 配置 button opens — the
     * wallpaper box first (the headline feature), then the glass master
     * switch, then the per-group tuning panel. This mirrors how
     * dsh-local-llm-controller branches on `view`.
     */
    function GlassCard(props) {
      const t = props && props.t ? props.t : fallbackT
      if (props.view === 'summary') {
        return React.createElement('div', { className: PREFIX + '-cardSummary' }, t('card.summary'))
      }
      return React.createElement(
        'div',
        { className: PREFIX + '-page' },
        React.createElement(WallpaperPanel, { t }),
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
      // let the subscription correct it a moment later. The wallpaper attribute
      // gets its initial value either way (off unless a stored state says on).
      if (storedPreference()) syncFromForm()
      else {
        setEnabled(DEFAULT_ENABLED, false)
        syncWallpaper()
      }

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
          document.documentElement.removeAttribute(WALLPAPER_ATTR)
          if (wallLayer) {
            wallLayer.remove()
            wallLayer = null
            wallMedia = null
          }
        },
        'composer-glass: teardown'
      )
    }

    return module.exports
  }
})

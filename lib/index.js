/**
 * dsh-composer-glass — Host half (DSH 0.1.7-rc.1 plugin API).
 *
 * The pane itself is CSS and one React row in the browser, so the Host has no
 * rendering to do. What it owns is the *preference*: whether the pane is on,
 * and how strongly each group of surfaces frosts.
 *
 * 0.1.7 model: the preference is the plugin's own `Config`, a Schemastery
 * object whose fields are marked `.volatile()` so edits never restart the row
 * and the settings projection (Settings → Plugins page) exposes them as form
 * fields. There is no `settings.register` any more: the namespace IS the
 * profile entry id (`composer-glass`, from `cordis.patch.yml`), and writes
 * land in the profile's `cordis.patch.yml` — durable across page reloads,
 * which is exactly what this plugin needs. The browser half reads and writes
 * the same fields through `ctx.configForms.get('composer-glass')`.
 *
 * Field layout is deliberately FLAT: every field is a top-level volatile
 * scalar (`card_blur`, `docks_tint`, …). The volatile field kind is the only
 * one the settings projection exposes, and nesting groups as objects would
 * make the whole group restart the row on every slider tick. Flat scalars
 * keep the already-proven single-field write path (`form.set(name, value)`).
 */

import z from '@deepseek-ai/schemastery'

/** Stable plugin name, matching `cordis.patch.yml` and the client module id. */
export const name = 'composer-glass'

/** Field holding the global on/off choice; matches the client's PREF_FIELD. */
export const SETTINGS_FIELD = 'enabled'

/** Value with no stored choice: fresh installs start with the pane on. */
export const DEFAULT_ENABLED = true

/**
 * The tuned material, as shipped. Every group starts here and the reset
 * button restores it. Percentages are stored as integers (tint 17 = 17%,
 * brightness 91 = 0.91) so slider steps stay exact. `shadow` scales the
 * glass shadow palette's alphas (100 = the shipped shadows, 0 = none) and
 * `highlight` the edge-light pair (ring stroke + inner top light).
 */
export const PRESET = Object.freeze({
  blur: 10,
  tint: 17,
  saturate: 165,
  brightness: 91,
  shadow: 100,
  highlight: 100,
})

/**
 * The surface groups the client draws, in card order. Each key prefixes seven
 * flat Config fields: `<key>_on`, `<key>_blur`, `<key>_tint`,
 * `<key>_saturate`, `<key>_brightness`, `<key>_shadow`, `<key>_highlight`.
 *
 * - `card`     the composer card itself (and its ::before blur underlay)
 * - `docks`    the horizontal strips above the composer: todo dock + goal bar
 * - `chips`    the bottom status capsules: session stats + context usage
 * - `toBottom` the floating back-to-bottom button
 * - `menu`     the slash-command popover
 * - `plan`     the plan cards inside the transcript
 */
export const GROUPS = Object.freeze(['card', 'docks', 'chips', 'toBottom', 'menu', 'plan'])

/** Per-group scalar ranges; the client renders sliders from the same table. */
export const RANGE = Object.freeze({
  blur: { min: 0, max: 30, step: 1 },
  tint: { min: 0, max: 100, step: 1 },
  saturate: { min: 50, max: 200, step: 5 },
  brightness: { min: 50, max: 130, step: 1 },
  shadow: { min: 0, max: 200, step: 5 },
  highlight: { min: 0, max: 200, step: 5 },
})

/** One group's seven flat fields, each volatile so edits never restart the row. */
function groupFields(key) {
  return {
    [key + '_on']: z.boolean().default(true).volatile(),
    [key + '_blur']: z.number().min(RANGE.blur.min).max(RANGE.blur.max).step(RANGE.blur.step).default(PRESET.blur).volatile(),
    [key + '_tint']: z.number().min(RANGE.tint.min).max(RANGE.tint.max).step(RANGE.tint.step).default(PRESET.tint).volatile(),
    [key + '_saturate']: z.number().min(RANGE.saturate.min).max(RANGE.saturate.max).step(RANGE.saturate.step).default(PRESET.saturate).volatile(),
    [key + '_brightness']: z.number().min(RANGE.brightness.min).max(RANGE.brightness.max).step(RANGE.brightness.step).default(PRESET.brightness).volatile(),
    [key + '_shadow']: z.number().min(RANGE.shadow.min).max(RANGE.shadow.max).step(RANGE.shadow.step).default(PRESET.shadow).volatile(),
    [key + '_highlight']: z.number().min(RANGE.highlight.min).max(RANGE.highlight.max).step(RANGE.highlight.step).default(PRESET.highlight).volatile(),
  }
}

/**
 * The live preference. One global switch plus one seven-field group per
 * surface bundle, all flat volatile scalars (see the header note).
 */
export const Config = z.object({
  [SETTINGS_FIELD]: z.boolean().default(DEFAULT_ENABLED).volatile(),
  ...GROUPS.reduce((fields, key) => Object.assign(fields, groupFields(key)), {}),
})

/**
 * The Host has nothing to run: the effect is CSS applied by the browser half,
 * and the preference is owned by Config. This `apply` exists only so the
 * Loader line has a body; the Config above is the whole contribution.
 */
export function apply() {}

/**
 * dsh-composer-glass — Host half.
 *
 * The pane itself is CSS and one React row in the browser, so the Host has no
 * rendering to do. What it does own is the *preference*: whether the pane is
 * on. That one bit must outlive a page reload, and browser module scope cannot
 * hold it — client HMR re-runs `apply()` on every edit and a reload starts a
 * fresh module, so the user's choice evaporated. DSH's durable home for plugin
 * preferences is a settings namespace: this file registers `composer-glass`,
 * and `lib/client.js` binds the same namespace through `settingsScope` to read
 * and write `enabled`.
 *
 * This is deliberately not an empty configuration surface: the value's owner is
 * the "Composer-area frosted glass" row under Settings -> General, registered by
 * browser half.
 */

/** Stable plugin name, matching `cordis.patch.yml` and the client module id. */
export const name = 'composer-glass'

/** The settings service owns namespace registration and persistence. */
export const inject = ['settings']

/** Settings namespace shared by the Host and browser halves. */
export const SETTINGS_NAMESPACE = 'composer-glass'

/** Field holding the on/off choice; the browser half writes this exact name. */
export const SETTINGS_FIELD = 'enabled'

/** Value with no stored choice: fresh installs start with the pane on. */
export const DEFAULT_ENABLED = true

/**
 * Resolve one section to `{ enabled: boolean }`.
 *
 * A plain callable with a `toJSON()` envelope rather than a schemastery schema
 * on purpose: negotiating a schemastery dependency into a profile is a
 * packaging problem this plugin does not need to solve, and the settings seam
 * only asks for a function that normalizes a value plus a JSON form for
 * `settings.describe` (the sibling `dsh-local-llm-controller` proves the
 * pattern on this DSH build).
 *
 * The whitelist below is load-bearing: the service persists the raw user layer
 * but every reader sees this resolved shape, so a field this function drops
 * would look written and still vanish. Add new preferences here in the same
 * change that introduces them.
 */
export function preferenceSchema(value) {
  const source = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {}
  return {
    [SETTINGS_FIELD]: typeof source[SETTINGS_FIELD] === 'boolean' ? source[SETTINGS_FIELD] : DEFAULT_ENABLED,
  }
}

/** Serialized schema for `settings.describe`; the browser half decodes loosely. */
preferenceSchema.toJSON = () => ({ type: 'object', dict: {} })

/**
 * Register the namespace. The returned owner scope is intentionally unused: the
 * browser half is the only reader and writer, and it reaches the same section
 * through `settingsScope`. Registering — and thereby making the value durable —
 * is the Host's whole job here.
 */
export function apply(ctx) {
  ctx.settings.register(SETTINGS_NAMESPACE, preferenceSchema, {
    // Composition layer below the user document: what an `unset` reverts to.
    // The schema default above and this base carry the same value on purpose —
    // neither is a place a second, divergent default may live.
    base: { [SETTINGS_FIELD]: DEFAULT_ENABLED },
  })
}

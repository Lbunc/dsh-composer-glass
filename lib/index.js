/**
 * dsh-composer-glass — Host half (DSH 0.1.7-rc.1 plugin API).
 *
 * The pane itself is CSS and one React row in the browser, so the Host has no
 * rendering to do. What it owns is the *preference*: whether the pane is on.
 *
 * 0.1.7 model: the preference is the plugin's own `Config`, a Schemastery
 * object whose fields are marked `.volatile()` so edits never restart the row
 * and the settings projection (Settings → Plugins page) exposes them as form
 * fields. There is no `settings.register` any more: the namespace IS the
 * profile entry id (`composer-glass`, from `cordis.patch.yml`), and writes
 * land in the profile's `cordis.patch.yml` — durable across page reloads,
 * which is exactly what this plugin needs. The browser half reads and writes
 * the same field through `ctx.configForms.get('composer-glass')`.
 */

import z from '@deepseek-ai/schemastery'

/** Stable plugin name, matching `cordis.patch.yml` and the client module id. */
export const name = 'composer-glass'

/** Field holding the on/off choice; the browser half writes this exact name. */
export const SETTINGS_FIELD = 'enabled'

/** Value with no stored choice: fresh installs start with the pane on. */
export const DEFAULT_ENABLED = true

/**
 * The live preference. One volatile boolean: volatile keeps user edits off the
 * restart path (the pane must flip without disposing the row) and is the only
 * field kind the settings projection exposes to forms.
 */
export const Config = z.object({
  [SETTINGS_FIELD]: z.boolean().default(DEFAULT_ENABLED).volatile(),
})

/**
 * The Host has nothing to run: the effect is CSS applied by the browser half,
 * and the preference is owned by Config. This `apply` exists only so the
 * Loader line has a body; the Config above is the whole contribution.
 */
export function apply() {}

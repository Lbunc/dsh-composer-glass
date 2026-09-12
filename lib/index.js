/**
 * dsh-composer-glass — Host half.
 *
 * This plugin is purely presentational: every byte of its behaviour is CSS and
 * one React row in the browser. It therefore has nothing to do here, and says so
 * explicitly rather than shipping an empty file that looks unfinished.
 *
 * Why the file exists at all: a bundle declares one plugin row, and the row's
 * package is loaded on the Host as well as served to the browser. Providing a
 * named, inert Host half keeps the composition symmetrical with every other DSH
 * plugin and keeps the door open for a settings namespace later.
 *
 * THE NEXT STEP, IF THE PREFERENCE SHOULD SURVIVE A RESTART
 * The on/off state currently lives in browser module scope, so it resets when
 * the page reloads. Persisting it needs a settings namespace:
 *
 *   export const inject = ['settings']
 *   export function apply(ctx) {
 *     const scope = ctx.settings.register('composer-glass', schema)
 *     // …and on the client: ctx.settingsScope.bind({ namespace: 'composer-glass' })
 *   }
 *
 * That is deliberately NOT stubbed out here: an unused namespace would show up
 * as a configuration surface in Settings with nothing behind it, and the client
 * half would still need its own binding. It is a real, separable change.
 */

/** Stable plugin name, matching `cordis.patch.yml`. */
export const name = 'composer-glass'

/** No Host services are consumed. */
export const inject = []

/** Intentionally a no-op; see the file header. */
export function apply() {}

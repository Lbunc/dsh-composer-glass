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
 * scalar (`card_blur`, `floaters_tint`, …). The volatile field kind is the only
 * one the settings projection exposes, and nesting groups as objects would
 * make the whole group restart the row on every slider tick. Flat scalars
 * keep the already-proven single-field write path (`form.set(name, value)`).
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
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
 * - `floaters` the pieces floating around the composer: todo dock + goal bar,
 *              the slash-command popover, the plan cards in the transcript
 * - `chips`    the bottom status capsules: session stats + context usage
 * - `toBottom` the floating back-to-bottom button
 * - `sidebar`  the left sidebar column — meaningful over a wallpaper, where it
 *              frosts the image/video the way the conversation panes do
 * - `content`  the wallpaper's content surfaces (new-session pill, user
 *              bubble, code blocks, inline code, file cards, reasoning row,
 *              plugins page) — gated by the wallpaper attribute; its
 *              shadow/highlight sliders are no-ops
 * - `dialogs`  the wallpaper's dialog cards (approval, ask-user question /
 *              option / answer bubbles) — same wallpaper gating as `content`
 */
export const GROUPS = Object.freeze(['card', 'floaters', 'chips', 'toBottom', 'sidebar', 'content', 'dialogs'])

/**
 * First-run defaults that differ from the shared PRESET, mirroring the values
 * the author actually runs with (a fresh install starts where the author's
 * setup does). Must match GROUP_DEFAULTS in `lib/client.js`.
 */
export const GROUP_DEFAULTS = Object.freeze({
  card: { shadow: 55 },
  sidebar: { shadow: 0 },
  content: { shadow: 0 },
  dialogs: { shadow: 0 },
})

/** Per-group scalar ranges; the client renders sliders from the same table. */
export const RANGE = Object.freeze({
  blur: { min: 0, max: 30, step: 1 },
  tint: { min: 0, max: 100, step: 1 },
  saturate: { min: 50, max: 200, step: 5 },
  brightness: { min: 50, max: 130, step: 1 },
  shadow: { min: 0, max: 200, step: 5 },
  highlight: { min: 0, max: 200, step: 5 },
})

/** One group's seven flat fields, each volatile so edits never restart the row.
 * Field defaults come from GROUP_DEFAULTS where overridden, else PRESET. */
function groupFields(key) {
  const fallback = (field) => (GROUP_DEFAULTS[key] && GROUP_DEFAULTS[key][field] !== undefined ? GROUP_DEFAULTS[key][field] : PRESET[field])
  return {
    [key + '_on']: z.boolean().default(true).volatile(),
    [key + '_blur']: z.number().min(RANGE.blur.min).max(RANGE.blur.max).step(RANGE.blur.step).default(fallback('blur')).volatile(),
    [key + '_tint']: z.number().min(RANGE.tint.min).max(RANGE.tint.max).step(RANGE.tint.step).default(fallback('tint')).volatile(),
    [key + '_saturate']: z.number().min(RANGE.saturate.min).max(RANGE.saturate.max).step(RANGE.saturate.step).default(fallback('saturate')).volatile(),
    [key + '_brightness']: z.number().min(RANGE.brightness.min).max(RANGE.brightness.max).step(RANGE.brightness.step).default(fallback('brightness')).volatile(),
    [key + '_shadow']: z.number().min(RANGE.shadow.min).max(RANGE.shadow.max).step(RANGE.shadow.step).default(fallback('shadow')).volatile(),
    [key + '_highlight']: z.number().min(RANGE.highlight.min).max(RANGE.highlight.max).step(RANGE.highlight.step).default(fallback('highlight')).volatile(),
  }
}

/**
 * The live preference. One global switch plus one seven-field group per
 * surface bundle, all flat volatile scalars (see the header note).
 */
export const Config = z.object({
  [SETTINGS_FIELD]: z.boolean().default(DEFAULT_ENABLED).volatile(),
  ...GROUPS.reduce((fields, key) => Object.assign(fields, groupFields(key)), {}),
  ...WALLPAPER_FIELDS(),
})

// ------------------------------------------------------------------ wallpaper

/** Wallpaper Config fields; matches the client's wallpaper snapshot reader. */
export const WALLPAPER_FIELDS_KEYS = Object.freeze({
  on: 'wallpaper_on',
  path: 'wallpaper_path',
  fit: 'wallpaper_fit',
  dim: 'wallpaper_dim',
})

/** Fresh wallpaper defaults: off, no path, cover fit, no veil. Dim is
 * bidirectional: negative darkens (black veil), positive lightens (white). */
export function WALLPAPER_FIELDS() {
  return {
    wallpaper_on: z.boolean().default(false).volatile(),
    wallpaper_path: z.string().default('').volatile(),
    wallpaper_fit: z.union([z.const('cover'), z.const('contain')]).default('cover').volatile(),
    wallpaper_dim: z.number().min(-100).max(100).step(1).default(0).volatile(),
  }
}

/**
 * The HTTP route the served wallpaper file lives under. It is a prefix route
 * nested INSIDE the client-modules `/plugins` namespace — the web server's
 * longest-prefix match picks the deeper one, so the bundle route is untouched.
 * The local file path itself never travels in the URL; it is read from Config
 * at request time, so a path edit takes effect on the next fetch (the ETag is
 * derived from the file's size+mtime, which also busts the browser cache).
 */
export const WALLPAPER_ROUTE = '/plugins/dsh-composer-glass/wallpaper'

/** Media content types this plugin knows how to declare. */
const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.ogv': 'video/ogg',
}

/**
 * Media kind for a wallpaper path: 'image', 'video', or null when the
 * extension is unknown (the client refuses to render unknown kinds).
 */
export function kindFor(filePath) {
  const ext = extname(String(filePath || '')).toLowerCase()
  if (MIME_BY_EXT[ext]?.startsWith('image/')) return 'image'
  if (MIME_BY_EXT[ext]?.startsWith('video/')) return 'video'
  return null
}

/** Content type for a wallpaper path; unknown extensions fall back to octet-stream. */
export function mimeFor(filePath) {
  return MIME_BY_EXT[extname(String(filePath || '')).toLowerCase()] || 'application/octet-stream'
}

/**
 * Parse one `Range: bytes=...` header against a known size. Returns
 * `{ start, end }` (end inclusive, clamped to size-1), `null` when the header
 * is absent or syntactically ignorable, and `'invalid'` when it is
 * unsatisfiable (the caller answers 416). Only the first range of a list is
 * honoured — media elements request one range at a time.
 * @returns {{start: number, end: number} | 'invalid' | null}
 */
export function parseRange(header, size) {
  if (typeof header !== 'string' || !header.startsWith('bytes=')) return null
  const spec = header.slice(6).split(',')[0].trim()
  const match = /^(\d*)-(\d*)$/.exec(spec)
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid'
  let start
  let end
  if (match[1] === '') {
    // Suffix form: the LAST N bytes.
    const suffix = Number(match[2])
    if (suffix === 0) return 'invalid'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }
  if (!Number.isSafeInteger(start) || start >= size || start > end) return 'invalid'
  return { start, end }
}

/**
 * Unwrap a volatile Config field. The loader resolves the plugin's Config with
 * `resolveConfig`, so every `.volatile()` field arrives as a frozen
 * `{ get() }` live reference — `form.set` commits land in that reference
 * (`updateVolatile`) and are visible to the next `get()`. Plain values pass
 * through untouched, which keeps the handler testable with bare objects.
 */
function unwrap(value) {
  return value && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/**
 * Serve the configured wallpaper file over the Web carrier. The handler reads
 * the live Config on every request, answers GET with byte ranges (206) so the
 * video element can loop/seek, and revalidates through an ETag built from the
 * file's size+mtime — a path or file change gets a fresh ETag, so the browser
 * refetches without any cache-busting query.
 *
 * The config comes from `apply`'s SECOND parameter, NOT from `ctx.config`:
 * cordis 4 gates the context's `config` property on an inject declaration and
 * throws `cannot get property "config" without inject` on any read — the
 * request-time read this handler originally used turned every GET/HEAD into a
 * bare 400 (the webServer wrapper's handler-rejection response), which the
 * browser rendered as a broken-image glyph at the media box's top-left corner.
 * The second parameter IS the fiber's resolved config: its volatile references
 * stay live across `form.set` commits, and a non-volatile change reloads the
 * fiber and re-runs `apply` with a fresh object.
 *
 * The route registers through the callback form of `ctx.inject`: the web
 * composition carries the `webServer` service, the Electron desktop build
 * does not (it loads the renderer from file:// and never starts node:http) —
 * there the callback simply never fires and the plugin still loads.
 */
export function serveWallpaper(config) {
  return async (req, res) => {
    const send = (code, message) => {
      res.statusCode = code
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ code: message }))
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD')
      send(405, 'method-not-allowed')
      return
    }
    const filePath = String(unwrap(config?.wallpaper_path) || '')
    if (!unwrap(config?.wallpaper_on) || filePath === '') {
      send(404, 'no-wallpaper')
      return
    }
    let fileStat
    try {
      fileStat = await stat(filePath)
    } catch {
      send(404, 'wallpaper-not-found')
      return
    }
    if (!fileStat.isFile()) {
      send(404, 'wallpaper-not-found')
      return
    }
    const size = fileStat.size
    const etag = '"' + size + '-' + Math.round(fileStat.mtimeMs) + '"'
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304
      res.end()
      return
    }
    const headers = {
      'content-type': mimeFor(filePath),
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
      etag,
    }
    if (req.method === 'HEAD') {
      res.writeHead(200, { ...headers, 'content-length': size })
      res.end()
      return
    }
    const range = parseRange(req.headers.range, size)
    if (range === 'invalid') {
      res.writeHead(416, { 'content-range': 'bytes */' + size })
      res.end()
      return
    }
    let stream
    try {
      stream = createReadStream(filePath, range === null ? undefined : { start: range.start, end: range.end })
    } catch {
      send(404, 'wallpaper-not-found')
      return
    }
    stream.on('error', () => res.destroy())
    if (range === null) {
      res.writeHead(200, { ...headers, 'content-length': size })
    } else {
      res.writeHead(206, {
        ...headers,
        'content-range': 'bytes ' + range.start + '-' + range.end + '/' + size,
        'content-length': range.end - range.start + 1,
      })
    }
    stream.pipe(res)
  }
}

/**
 * The Host registers the wallpaper route and owns nothing else: the effect is
 * CSS applied by the browser half, and the preference is owned by Config.
 * `config` is apply's second parameter (the fiber's resolved Config — see
 * `serveWallpaper` for why `ctx.config` is not an option).
 */
export function apply(ctx, config) {
  ctx.inject(['webServer'], (webCtx) => {
    ctx.effect(() => webCtx.webServer.register({
      kind: 'prefix',
      path: WALLPAPER_ROUTE,
      handler: serveWallpaper(config),
    }), 'composer-glass: wallpaper route')
  })
}

# Releasing

This package is **prepared** for npm but **not published**. Everything below is
what remains, and the traps that were hit building a comparable DSH plugin.

---

## Before the first publish

### 1. Confirm the package name is free

The name is `dsh-composer-glass` and **it is not reserved yet**. Confirm:

```sh
npm view dsh-composer-glass version
```

A 404 means the name is free. If you ever change it, it must match in four places:

- `package.json` → `name`
- `cordis.patch.yml` → the `name:` field of the inserted row
- `lib/client.js` → the `id` passed to `window.__ModuleLoader__.load({ id, ... })`
- `docs/RELEASING.md` and the READMEs, for the install commands

The client module id is how the browser build is served and cached, so a mismatch
means the bundle is served under one id and registered under another.

### 2. Fill in the repository URL

`package.json` ships a placeholder:

```json
"repository": { "url": "git+https://github.com/YOUR_GITHUB_USERNAME/dsh-composer-glass.git" }
```

Notes: the `git+https://` prefix is required — npm will otherwise rewrite it and
warn. Once a remote exists:

```sh
git remote add origin git+https://github.com/<you>/dsh-composer-glass.git
git push -u origin main
```

### 3. Confirm the locale peer range against the DSH being targeted

`peerDependencies` pins `@deepseek-ai/dsh-client-locale` at `^0.1.5-rc.1`. That
exact form matters: **a semver prerelease only satisfies a comparator whose
`x.y.z` matches exactly.** `^0.1.0-rc.7` does *not* accept `0.1.5-rc.1`. If the
target DSH moves, move this range with it.

---

## Publishing

```sh
# from the repo root
npm pack --dry-run          # verify the file list first
npm publish --access public
```

### Environment trap: the npm cache

In a restricted shell the system npm cache is not writable, and `npm pack` /
`npm publish` fail with:

```
npm error code EPERM
npm error path C:\Users\<you>\AppData\Local\npm-cache\_cacache\tmp\...
```

Redirect the cache into the workspace:

```sh
npm publish --access public --cache ./.npm-cache
```

`.npm-cache/` is gitignored.

### Authentication

If the account has 2FA enabled, either pass a one-time code or use a token with
bypass enabled:

```sh
npm publish --otp=<code> --cache ./.npm-cache
```

A granular access token needs **Read and write**; the older standalone
"Publish packages" scope no longer exists on the current npm settings page.

### After publishing

```sh
npm view dsh-composer-glass version
```

Confirm the remote version, and confirm the README on the npm page is the one you
just shipped — release the version bump and the README together, or the page keeps
showing the previous text.

---

## Verifying an install

The whole point of an installed package (as opposed to a dynamic plugin) is that
it survives restarts, so the smoke test must include one:

```sh
dsh plugin --profile web add dsh-composer-glass
# restart DSH
```

Then confirm, in order:

1. `dsh --dump-config` includes the `composer-glass` row
2. **Settings → General** shows the *Composer frosted glass* row
3. the composer renders as a translucent pane
4. toggling the row flips it live
5. **restart DSH again** — the row and the pane are still there

Step 5 is the one a dynamic plugin cannot pass, and the reason this package
exists.

### Uninstall leaves a junction on Windows

A `file:` install creates a junction that `pnpm remove` does not delete. Remove it
by hand or the next `add` is moved aside as `.ignored_*`:

```sh
rmdir node_modules\dsh-composer-glass
```

---

## Versioning

Currently `0.1.0`. The client half hot-reloads on edit, so most iteration needs no
release at all — publish only at a milestone.

**Do not hand-write a row for this package** in a profile's own
`cordis.patch.yml`. `dsh.bundle.patch` registers the row automatically, and a
hand-written `- insert:` for the same id inserts it twice.

---

## Optional next step: make the toggle durable

The one user-visible limitation is that the on/off state resets on page reload.
Fixing it is a real, separable change and needs both halves:

**Host** (`lib/index.js`):

```js
export const inject = ['settings']

export function apply(ctx) {
  ctx.settings.register('composer-glass', /* schema */)
}
```

**Client** (`lib/client.js`):

```js
exports.inject = ['slots', 'locale', 'settingsScope']
const scope = ctx.settingsScope.bind({ namespace: 'composer-glass' })
// read via scope.getSnapshot(), write via scope.set('enabled', value)
```

This also promotes the package to a `settings.plugin.item` card, which is the
richer surface — `settings.general.item` rows are meant for a single preference
with no page of its own, while a plugin card can carry more.

It was left undone deliberately: an empty namespace would put a configuration
surface in Settings with nothing behind it.

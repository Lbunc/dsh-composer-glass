<div align="center">

# 🧊 dsh-composer-glass

**Frosted Glass & Dynamic Wallpaper — one uniform frosted-glass layer for the DSH conversation UI, with a wallpaper or looping video underneath**

Sidebar Plugins → Frosted Glass & Dynamic Wallpaper → Configure

[中文](README.md) | **English**

[![npm version](https://img.shields.io/npm/v/dsh-composer-glass?color=blue)](https://www.npmjs.com/package/dsh-composer-glass)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DSH 0.2.0-rc.2](images/badge-dsh.svg)](https://www.npmjs.com/package/@deepseek-ai/dsh)
[![Type: DSH Plugin](https://img.shields.io/badge/Type-DSH%20Plugin-8A2BE2.svg)](https://github.com/topics/dsh-plugin)

</div>

***

## Demo

**Starting a session**

<video src="https://github.com/Lbunc/dsh-composer-glass/releases/download/v0.3.2/01-start.mp4" controls muted playsinline></video>

**In conversation**

<video src="https://github.com/Lbunc/dsh-composer-glass/releases/download/v0.3.2/02-in-conversation.mp4" controls muted playsinline></video>

## Features

- **One uniform frosted glass**: the composer card, todo list, goal bar, `/` command menu, plan cards, status capsules (session stats + context usage), the back-to-bottom button and the sidebar all share one material, instead of patchy frosting
- **Dynamic wallpaper**: a local image or looping video sits behind the UI; white content surfaces (new-session pill, user bubble, code blocks, inline code, file cards, question & approval dialogs, reasoning row, plugins page) are glassified automatically, so the wallpaper is never blocked by opaque patches
- **Per-group tuning**: 7 surface groups with individual switches and 6 sliders each — live preview while dragging, persisted on release, and turning a group off restores its shipped look at once
- **Wallpaper controls**: fit mode (cover / contain) plus a bidirectional dim slider (drag left to darken, right to brighten — works for both dark and light themes)
- **One-click reset** to the shipped preset; light / dark themes are tuned separately and switch automatically

## Configuration panel

**Frosted glass master switch**: turns the whole effect on or off; off restores the native look entirely.

**Wallpaper**:

| Setting | Description |
| :---------------- | :----------------------------------------------------------------------------------------------------------- |
| Show wallpaper | Images (jpg / png / webp / gif / avif / bmp / svg) or videos (mp4 / webm / mov / mkv, etc.); videos loop muted |
| File path | Local absolute path, read by the Host, never sent over the network; **refresh the browser after adding a path** |
| Fit | Cover / Contain |
| Dim / Brighten | −100 to +100: negative overlays a black veil, positive a white one |

**Per-group tuning** (7 groups, each with a switch + 6 sliders):

| Group | Surfaces |
| :- | :- |
| Composer card | The whole composer card and its blur underlay |
| Floating pieces | Todo list, goal bar, `/` command menu, plan cards |
| Status capsules | Session stats + context usage capsules |
| Back-to-bottom button | Floating button at the transcript's bottom-right |
| Sidebar | The entire left sidebar column |
| Content surfaces | Content surfaces over the wallpaper (see feature 2) |
| Dialog cards | Approval card, question / option / answer bubbles |

Sliders per group:

| Slider | Range | Preset |
| :- | :- | :- |
| Blur | 0 – 30 px | 10 |
| Tint | 0 – 100 % | 17 |
| Saturation | 50 – 200 % | 165 |
| Brightness | 50 – 130 % | 91 |
| Shadow | 0 – 200 % | 100 |
| Edge highlight | 0 – 200 % | 100 |

> A few groups ship with different shadow defaults: composer card 55; sidebar, content surfaces and dialog cards 0. The **Reset to preset** button restores the table above.

## Getting started

### Install

**Built-in plugin manager (recommended)**: sidebar Plugins → Add plugin, paste any address from the table below → Install → Enable.

**Command line**: `dsh plugin --profile web add "<address>"` (upgrading = running the same command again)

| Address | Description |
| :- | :- |
| `dsh-composer-glass` | Package name. Within ~24 h after a release you still get the previous one, see the tip below |
| `D:\path\to\dsh-composer-glass` | Local folder. A live `link:` — source edits apply on refresh; first choice for development |
| `D:\path\to\dsh-composer-glass-<version>.tgz` | The .tgz package from the releases page |
| `https://github.com/Lbunc/dsh-composer-glass` | GitHub repository. Tracks the latest push, may be unstable |

### Enable

Sidebar Plugins → Frosted Glass & Dynamic Wallpaper: the row switch toggles the plugin, the config card tunes the material and the wallpaper. Every adjustment applies at once — no DSH restart needed; **refresh the browser after changing the wallpaper path**.

### Uninstall

- **Plugin manager**: the **Uninstall** button on the plugin row
- **Command line**: `dsh plugin --profile web remove dsh-composer-glass`

> [!TIP]
> ⏳ **The displayed version ≠ the installed version**: the "latest" shown on the manager card comes from registry metadata and is not filtered; the actual install is resolved by pnpm, whose supply-chain cooldown (`minimumReleaseAge`) silently holds back releases younger than 24 hours and installs the previous one. Not a bug: wait it out, or use the folder path / tgz / GitHub addresses above to get the new version immediately.

> [!NOTE]
> - Uninstalling leaves configuration behind: the switch and slider values live in the `composer-glass` section of the profile's `cordis.patch.yml`, which `dsh plugin remove` does **not** delete; remove that section by hand for a full cleanup.
> - On Windows, if a junction remains, delete `node_modules\dsh-composer-glass`.

## Compatibility

| Item | Description |
| :- | :- |
| DSH version | ≥ 0.1.7-rc.1 (tested against 0.2.0-rc.2); 0.1.6 and older are not supported — use plugin v0.3.0+ |
| Platform | Frosted glass: both web and desktop (Harness); dynamic wallpaper: web only for now, desktop support planned |

## Development

- Tests: `node --test test/`
- Layout: `lib/index.js` is the Host half (volatile Config, wallpaper HTTP route with Range streaming and ETag negotiation); `lib/client.js` is the browser half (material styles and the config card, hand-drawn HTML, no UI-primitive dependency)

## License

<div align="center">

[MIT](LICENSE)

</div>

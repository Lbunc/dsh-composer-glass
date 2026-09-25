<div align="center">

# 🧊 dsh-composer-glass

**Turns the DSH composer area into one uniformly translucent frosted-glass material**

Switch and per-surface tuning panel live in Plugins → Composer-area frosted glass → Configure

[中文](README.md) | **English**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Type: DSH Plugin](https://img.shields.io/badge/Type-DSH%20Plugin-8A2BE2.svg)](#-quick-start)

</div>

***

> ⚠️ **DSH 0.1.7-rc.1 introduced sweeping changes; only plugin v0.3.0 and above is compatible.**

## 📸 Preview

**🟢 Starting a session**

![Starting a session](images/01-start-session.png)

**💬 In conversation**

![In conversation](images/02-in-conversation.png)

**⚙️ Plugins → Composer-area frosted glass → Configure**

![Settings](images/03-settings.png)

## ✨ Features

- 🧊 The composer is rendered as **one uniformly translucent frosted-glass material**, not partial blur
- 🧩 The same material covers the **to-do dock** and **goal bar** above it, the floating **back-to-bottom** button, the bottom chip that merges the **session statistics** and **token usage** pills, the **`/` command menu**, and the **Plan cards** in the transcript
- 🎛️ **Per-surface tuning**: six surface groups, each with its own on/off pill and six sliders — **blur / opacity / saturation / brightness / shadow / edge highlight**. Dragging previews live, releasing persists; switching a group off restores its original look instantly
- 🔄 **Reset to preset** restores the factory material in one click; light / dark themes are tuned separately and follow the active theme

## 🚀 Quick start

### Install

**DSH built-in plugin manager (recommended)**: sidebar **Plugins → Add plugin**, enter any address from the
table below → Install → Enable.

**CLI**: `dsh plugin --profile web add "<address>"` (to upgrade, re-run the same command)

| Address form | Notes |
| :- | :- |
| `dsh-composer-glass` | Package name. ⚠️ Within ~24h after a new release, the previous version is installed — see the tip below |
| `D:\path\to\dsh-composer-glass` | Local folder. Live link; source edits apply on refresh. Best for development |
| `D:\path\to\dsh-composer-glass-0.3.0.tgz` | releases .tgz package |
| `https://github.com/Lbunc/dsh-composer-glass` | GitHub repo. Latest pushed code; may be unstable |

### Enable

On versions before 0.1.7-rc.1 a restart is still required. Open **Plugins → Composer-area frosted glass → Configure** in the
sidebar and flip the switch; every surface can be tuned individually from the same card.

### Uninstall

- **Plugin manager**: the **Uninstall** button on the plugin row
- **CLI**: `dsh plugin --profile web remove dsh-composer-glass`

> [!TIP]
> ⏳ **Displayed version ≠ installed version**: the manager card shows the registry
> latest (e.g. 0.3.0) unfiltered, but the actual install is resolved by pnpm, whose
> supply-chain cooldown (`minimumReleaseAge`) silently picks the previous version when
> the new release is less than 24 hours old. Not a bug — wait out the 24h, or use the
> folder / tgz / GitHub forms above to get the new version immediately.

> [!NOTE]
> - 🧹 **Uninstalling leaves a config residue**: the switch and slider values live
>   in the `composer-glass` section of the profile's `cordis.patch.yml`, and
>   `dsh plugin remove` does **not** delete it — remove that section by hand for a
>   clean uninstall.
> - 🪟 On Windows, if a junction is left behind, just delete
>   `node_modules\dsh-composer-glass`.

## 📄 License

<div align="center">

[MIT](LICENSE)

</div>

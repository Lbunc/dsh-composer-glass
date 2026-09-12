<div align="center">

# dsh-composer-glass

**Turns the DSH composer area into one uniformly translucent frosted-glass material**

Selector lives in Settings → General

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Type: DSH Plugin](https://img.shields.io/badge/Type-DSH%20Plugin-8A2BE2.svg)](#quick-start)

</div>

***

## Preview

**Starting a session**

![Starting a session](images/01-start-session.png)

**In conversation**

![In conversation](images/02-in-conversation.png)

**Settings → General**

![Settings](images/03-settings.png)

## Features

- The composer is rendered as **one uniformly translucent frosted-glass material**, not partial blur
- The same material covers the **to-do dock** above it (collapsed and expanded alike), the floating **back-to-bottom** button, and the bottom chip that merges the **session statistics** and **token usage** pills
- A **selector** in **Settings → General** (On / Off) whose choice **persists** across page reloads and DSH restarts

## Quick start

| Action | Command |
| :- | :- |
| Install | `dsh plugin --profile web add dsh-composer-glass` |
| Upgrade | `dsh plugin --profile web add dsh-composer-glass@latest` |
| Uninstall | `dsh plugin --profile web remove dsh-composer-glass` |

Restart DSH, then set **Composer-area frosted glass** to On under **Settings → General**.

> [!NOTE]
> - **Uninstalling leaves a settings residue**: the switch is stored in the
>   `composer-glass` section of `settings.yaml` (`composer-glass.enabled`), and
>   `dsh plugin remove` does **not** delete it — remove that section by hand for a
>   clean uninstall.
> - On Windows, if a junction is left behind, just delete
>   `node_modules\dsh-composer-glass`.

## License

<div align="center">

[MIT](LICENSE)

</div>

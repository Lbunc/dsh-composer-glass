<div align="center">

# dsh-composer-glass

**Turns the DSH composer into a single uniformly translucent frosted-glass pane**

Toggle lives in Settings → General

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Type: DSH Plugin](https://img.shields.io/badge/Type-DSH%20Plugin-8A2BE2.svg)](#install)

</div>

***

## Preview

|                 Start a session                 |                  In conversation                  |
| :---------------------------------------------: | :-----------------------------------------------: |
| ![Start a session](images/01-start-session.png) | ![In conversation](images/02-in-conversation.png) |

## Features

- The composer is rendered as **one uniformly translucent frosted-glass material**, not partial blur
- A single on/off switch under **Settings → General**

![Settings](images/03-settings.png)

## Quick start

| Action    | Command                                                  |
| :-------- | :------------------------------------------------------- |
| Install   | `dsh plugin --profile web add dsh-composer-glass`        |
| Upgrade   | `dsh plugin --profile web add dsh-composer-glass@latest` |
| Uninstall | `dsh plugin --profile web remove dsh-composer-glass`     |

Restart DSH, then enable it under **Settings → General**.

> \[!NOTE]
> On Windows, if you clean up leftovers by hand, just delete
> `node_modules\dsh-composer-glass`.

## Notes

- **The switch does not persist**: it resets on page reload — persisting it
  needs a Host-side settings namespace, which is left as a follow-up change.
- **A material, not a refractor**: the composer sits over flat colour, so
  refracting it produces no visible change. The reasoning and the measurements
  are in [docs/WHY-NOT-REFRACTION.md](docs/WHY-NOT-REFRACTION.md).

## License

<div align="center">

[MIT](LICENSE)

</div>

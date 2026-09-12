<div align="center">

# dsh-composer-glass

**把 DSH 的输入框变成一整块均匀半透明的毛玻璃面板**

开关位于 设置 → 通用

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Type: DSH Plugin](https://img.shields.io/badge/Type-DSH%20Plugin-8A2BE2.svg)](#安装)

</div>

***

## 效果预览

|                 开始会话                 |                  会话效果                  |
| :----------------------------------: | :------------------------------------: |
| ![开始会话](images/01-start-session.png) | ![会话效果](images/02-in-conversation.png) |

## 特性

- 输入框整体呈现**均匀半透明的毛玻璃材质**，而非局部磨砂
- 同一材质覆盖输入框、其上的**任务清单**（收起与展开一致）以及 **回到底部** 悬浮按钮
- 在 **设置 → 通用** 中提供一键开关，选择**持久保存**（刷新页面、重启 DSH 后保持）

![设置页面](images/03-settings.png)

## 快速开始

| 操作 | 命令                                                       |
| :- | :------------------------------------------------------- |
| 安装 | `dsh plugin --profile web add dsh-composer-glass`        |
| 升级 | `dsh plugin --profile web add dsh-composer-glass@latest` |
| 卸载 | `dsh plugin --profile web remove dsh-composer-glass`     |

安装完成后重启 DSH，在 **设置 → 通用** 里打开开关。

> \[!NOTE]
> Windows 上如果手动清理残留目录，删掉 `node_modules\dsh-composer-glass` 即可。

## 说明

- **开关会持久化**：选择写进 Host 侧 `composer-glass` settings 命名空间（落在 `settings.yaml` 的 `composer-glass.enabled`），所以刷新页面或重启 DSH 后都保持。
- **材质，而非折射**：输入框背后是平坦纯色，折射它不会有任何可见变化。原因与实测记录见 [docs/WHY-NOT-REFRACTION.md](docs/WHY-NOT-REFRACTION.md)。

## 许可

<div align="center">

[MIT](LICENSE)

</div>

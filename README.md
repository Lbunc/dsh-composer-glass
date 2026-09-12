<div align="center">

# dsh-composer-glass

**把 DSH 的输入区变成一整块均匀半透明的毛玻璃**

开关位于 设置 → 通用

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Type: DSH Plugin](https://img.shields.io/badge/Type-DSH%20Plugin-8A2BE2.svg)](#快速开始)

</div>

***

## 效果预览

**开始会话**

![开始会话](images/01-start-session.png)

**会话中**

![会话中](images/02-in-conversation.png)

**设置 → 通用**

![设置页面](images/03-settings.png)

## 特性

- 输入框整体呈现**均匀半透明的毛玻璃材质**，而非局部磨砂
- 同一材质覆盖输入框、其上的**任务清单**（收起与展开一致）、**回到底部** 悬浮按钮，以及底部把**会话统计**与 **Token 用量** 合成一枚的玻璃胶囊
- 在 **设置 → 通用** 中以**下拉选择**（开启 / 关闭）控制，选择**持久保存** —— 刷新页面、重启 DSH 后都保持

## 快速开始

| 操作 | 命令 |
| :- | :- |
| 安装 | `dsh plugin --profile web add dsh-composer-glass` |
| 升级 | `dsh plugin --profile web add dsh-composer-glass@latest` |
| 卸载 | `dsh plugin --profile web remove dsh-composer-glass` |

安装完成后重启 DSH，在 **设置 → 通用** 里把「输入区毛玻璃」设为开启。

> [!NOTE]
> - **卸载会留下 settings 残留**：开关写在 `settings.yaml` 的 `composer-glass` 段（`composer-glass.enabled`），`dsh plugin remove` **不会**删除它；要彻底清理请手动删除该段。
> - Windows 上如果还留着 junction，删掉 `node_modules\dsh-composer-glass` 即可。

## 许可

<div align="center">

[MIT](LICENSE)

</div>

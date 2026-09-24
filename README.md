<div align="center">

# 🧊 dsh-composer-glass

**把 DSH 的输入区变成一整块均匀半透明的毛玻璃**

开关与分部位调节面板位于 插件面板 → 输入区毛玻璃 → 配置

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Type: DSH Plugin](https://img.shields.io/badge/Type-DSH%20Plugin-8A2BE2.svg)](#-快速开始)

</div>

***

## 📸 效果预览

**🟢 开始会话**

![开始会话](images/01-start-session.png)

**💬 会话中**

![会话中](images/02-in-conversation.png)

**⚙️ 插件 → 输入区毛玻璃 → 配置**

![设置页面](images/03-settings.png)

## ✨ 特性

- 🧊 输入框整体呈现**均匀半透明的毛玻璃材质**，而非局部磨砂
- 🧩 同一材质覆盖输入框、其上的**任务清单**与**目标条**、**回到底部** 悬浮按钮、底部把**会话统计**与 **Token 用量** 合成一枚的玻璃胶囊、**`/` 指令菜单**，以及转录中的 **Plan 卡片**
- 🎛️ **分部位调节**：六组表面各自独立开关，每组配 **模糊 / 透明度 / 饱和度 / 亮度 / 阴影 / 边缘高光** 六条滑杆——拖动**实时预览**，松手即**持久保存**，关闭某组立即还原该组原貌
- 🔄 **重置为预设** 一键恢复出厂材质；亮色 / 暗色主题分别调色，跟随主题自动切换

## 🚀 快速开始

| 操作 | 命令 |
| :- | :- |
| 📥 安装 | `dsh plugin --profile web add dsh-composer-glass` |
| ⬆️ 升级 | `dsh plugin --profile web add dsh-composer-glass@latest` |
| 🗑️ 卸载 | `dsh plugin --profile web remove dsh-composer-glass` |

安装完成后重启 DSH，在侧边栏 **插件 → 输入区毛玻璃 → 配置** 里打开开关，每块表面都能在配置卡里单独调节。

> [!NOTE]
> - 🧹 **卸载会留下配置残留**：开关与滑杆值写在 profile 的 `cordis.patch.yml` 的 `composer-glass` 段，`dsh plugin remove` **不会**删除它；要彻底清理请手动删除该段。
> - 🪟 Windows 上如果还留着 junction，删掉 `node_modules\dsh-composer-glass` 即可。

## 📄 许可

<div align="center">

[MIT](LICENSE)

</div>

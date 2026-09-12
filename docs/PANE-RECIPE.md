# 面板玻璃观感是怎么做出来的（可复现配方）

这份笔记记录的是**具体做法**，不是原理探讨。
之前我把它改坏过一次，原因写在「我当初怎么把它改坏的」一节。

**最终形态**：`frost-9 / pkg-27` —— 冻结的毛玻璃面板 + 设置页一行开关。
固定值：`blur 10 · saturate 165% · brightness 0.91 · tint 0.17 · radius 22px · ring 0.34`

---

## 效果定义

输入框是**一整块均匀透明的玻璃**，靠模糊造雾。
**关键特征是"均匀"** —— 不是上缘透明、下方渐实。

---

## 三个条件，缺一不可

### 1. 清掉应用的不透明背景

否则玻璃背后是纯色，透明等于看不出效果。

```css
.wSkVaW_root, .wSkVaW_scrollBody, .wSkVaW_body, .wSkVaW_viewArea {
  background: none !important;
}
```

注意用 **`background` 简写**，不是 `background-color`。
DSH 产物里是 `.wSkVaW_root{background:var(--dsw-alias-bg-base)}`，
简写**同时设了 background-image 层**，只覆盖 `background-color` 清不干净。

### 2. 移除输入框底部那道"向下渐实"的渐变

**这是"只有上面透明"的直接原因。**

```css
.wSkVaW_composerSeat { background: none !important; }
```

DSH 原产物有两条规则（`[data-phase=active]` 那条特异性更高，两条都要清）：

```css
.wSkVaW_composerSeat{background:linear-gradient(180deg, transparent 0px, var(--dsw-alias-bg-base) 36px);}
.wSkVaW_root[data-phase=active] .wSkVaW_composerSeat{background:linear-gradient(...);}
```

那个渐变的语义是「透明 → 底色」，即**让下方变实**。
它正好盖住输入框下半部，于是透明只留在上缘。

### 3. 卡片自身低透明度

```css
[data-composer-card] {
  background-color: color-mix(in srgb,
    var(--dsw-specific-input-major) 24%, transparent) !important;
  backdrop-filter: blur(10px) saturate(165%) brightness(1.05);
}
```

`tint` 要低（**0.18–0.30**）。这是"整块透明"的核心。

---

## 可选但推荐：背后铺一层

> ⚠️ **本节已被推翻，保留仅为记录。见文末「更正：壁纸是不必要的」。**

**纯透明的玻璃覆在纯色上 = 看不出玻璃。**
所以要么背后本来有内容，要么铺一层：

```css
:root[data-dsh-glass][data-dsh-glass-wall="on"] {
  background-image: var(--dsh-glass-wall);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}
```

本地图片要经 Host 读成 data URL —— `http://` 页面加载不了 `file://` 图片。

---

## 边缘处理：越少越好

这一版**只保留 1px 描边 + 一条极淡的顶部光泽**。

不要加的东西：
- ❌ 轮廓环（`mask-composite: exclude`）
- ❌ 侧边暗线
- ❌ 颗粒
- ❌ 厚重的 inset 阴影

**每多一层叠加，都在破坏"均匀"。** 这也是"玻璃材质"版（方向 A）
和"透明面板"版的根本差别：前者靠边缘结构，后者靠模糊 + 低透明度。

---

## 我当初怎么把它改坏的（教训）

我把它改成"上缘透明、下方渐实"，原因是照搬了一条**不适用的经验**：

> 「玻璃覆在纯色上会被看成灰盒子，所以主体要保持较高不透明度」

这条来自调研报告，**它只在"背后是纯色"时成立**。
而当时我刚好已经把背景清空了（条件 1），所以这条完全不适用。
我据此把 tint 从 0.22 提到 0.52–0.68，**同时把条件 1 和 2 都删了** ——
等于把三个条件里的三个全改错了。

**教训**：经验条目都带前提条件。照搬之前先确认前提在当前场景下成立。

---

## 更正：壁纸是不必要的（也是错误的做法）

我一度以为"透明面板需要背后铺一层壁纸"。**这是错的。**

**透明度是面板自身的属性。** `tint` 就是面板 `background-color` 的 alpha 值
（`color-mix(... 17%, transparent)` = 17% 不透明）。它**不依赖**背后是什么 ——
壁纸、纯色、任何东西都不参与这个计算。

壁纸唯一的作用是**让透明变得可见**。背后是纯色时面板一样是 17% 不透明，
只是没有对比所以看不出来。

我把**相关**当成了**因果**：在同一个版本里既做了透明面板又铺了壁纸，
看到效果好，就认定是壁纸的功劳。

### 为什么铺壁纸本身是个坏主意

1. **它改的是 `:root`** —— 影响整个应用，不是只改输入框。
   为了一个输入框好看而换掉整个 DSH 背景，代价过大。
2. **它和透明面板无关** —— 如上。
3. **原始需求里没有壁纸** —— 需求是"把对话框改成液体玻璃"。

### 实测补充

- 那个壁纸变量有 **1,917,250 字符**（963 KB PNG 的 base64）。
  把 190 万字符塞进一个 CSS 自定义属性，再靠 `background-attachment: fixed`
  在 `html` 上铺出来，是这个方案脆弱的根源。
- 探针确认「固定层 + 快照计数」的测量机制本身正常（红板可见度 0.815），
  但 `:root` 上那个背景图始终未变成可见像素。完整机制未查清 ——
  但因为壁纸本来就不该在，**没有再查的价值**。
- 注意 `body` 上才是 DSH 的 `--dsw-*` 令牌与底色，`:root`（`html`）另有其人。
  这可能是背景图不显示的原因之一，未验证。

### 去掉壁纸后仍然保留的两条

去掉壁纸**不等于**去掉全部样式。以下两条与壁纸无关，是面板透明的**先决条件**：

- 清掉应用不透明背景（`background: none` 简写）
- 移除输入框底部「向下渐实」的渐变

我上一版把这两条和壁纸捆在一起，导致去掉壁纸时会把它们一起删掉 ——
这是**又一个混淆**。

---

## 开关放在设置里（最终形态）

控件是**设置 → 通用**里的一行，用 `settings.general.item`（list slot）。

**关键约束**：该 slot 的运行时合同明确写着 **owner 不传任何 props** ——
「row 自己画自己的 label，值、写路径都是你自己的」。所以不能指望宿主给我样式，
只能照抄 DSH 自己的 General 行。

我取出了 `dsh-client-ui-conversation` 里 `EnterBehaviorRow` 模块的真实 CSS，
逐个数值对齐：

```css
/* 官方 EnterBehaviorRow（构建哈希前缀 T1PP_q） */
.T1PP_q_row      { border-bottom:.5px solid var(--dsw-alias-border-l2); padding:16px 0; display:flex; gap:8px }
.T1PP_q_rowText  { flex-direction:column; flex:1; gap:4px; min-width:0; padding-right:48px }
.T1PP_q_title    { color:var(--dsw-alias-label-primary);   font-size:14px; line-height:22px }
.T1PP_q_desc     { color:var(--dsw-alias-label-tertiary);  font-size:12px; line-height:18px }
.T1PP_q_selector { height:36px; border-radius:18px; padding:0 14px;
                   background:var(--dsw-alias-bg-module-platform) }
```

我的「开启 / 关闭」两段式控件据此做：外层 36px 高、圆角 18px、
内层按钮 30px 高、圆角 15px。

`order: 30` 排在官方各行之后：
`permission -20 · language 0 · appearance 10 · font-size 11 · transcript-view 12 · composer-enter 20`

### 这个开关**无法持久化**（动态插件的硬限制）

持久化需要 settings 命名空间：Host 侧 `settings.register(ns, schema)`、
Client 侧 `settingsScope.bind({namespace})`。

**动态插件两条都拿不到**：

- Host 半跑在 vm 沙箱里，沙箱只暴露 `harness` / `console` / `btoa` / `atob` /
  `TextEncoder` / `TextDecoder` —— **没有 `settings` 服务**
- Client 半也没有 `settingsScope`

所以状态只能放**本进程 Run 内的内存**（`enabled` + `listeners`），
停止插件或重启 DSH 会回到默认「开启」。

**要做到真正持久，必须把插件做成正式安装的 npm 包** —— 那才是有
`settings.register` / `settingsScope` 的形态。

### 文案走官方 locale，不能硬编码

同一行文案如果写死中文，英文界面下就是中文 —— 必须走 `locale.register`。

本机构建的 locale 列表：

```js
LOCALE_IDS = ["zh", "en"]
```

注册（每个已发布 locale 一份，双语平衡是合同要求）：

```js
ctx.locale.register(NS, 'zh', { 'row.title': '输入框毛玻璃', 'opt.on': '开启', … })
ctx.locale.register(NS, 'en', { 'row.title': 'Composer frosted glass', 'opt.on': 'On', … })
```

组件里用 `ctx.locale.bind(NS)` 取翻译函数，**不要自己存一份** ——
合同说明它「reads the active locale at call time」，语言切换无需重新注册；
插槽注册时带上 `locale: NS` 座位。

**一个有用的保障**：查词链是「当前语言 → 共享 `common` → 原样返回 key」。
所以漏了某个 key 时显示的是 key，**不是空白** —— 不会白屏。

### 按经验库避开的坑

| 条目 | 做法 |
|---|---|
| **C06** 无全局 `* { box-sizing }` | 自带作用域内 reset |
| **C07** 主题变量须核实、关键色硬编码兜底 | 每个 token 都带 fallback |
| **C03** 注册类副作用走 `ctx.effect` | 样式 / slot / 卸载全部包在 `ctx.effect` |
| 暗色主题 | 用 `body[data-ds-dark-theme]`，**不是** `.dark` |

> 暗色那条是我自己踩的：DSH 把暗色令牌挂在 `body[data-ds-dark-theme]`，
> 而我从第一版起一直写 `:root[...] .dark { ... }` —— **那些覆盖从未匹配过**，
> 暗色下用的其实是亮色分支的值。

---

## 脆弱点

`.wSkVaW_*` 是**构建哈希类名**，从 DSH 产物里读出来的。
当前安装下稳定，但 **DSH 升级后会变**。
若某次升级后毛玻璃效果悄悄消失，**先回来核对这几个哈希**。

`data-composer-card` 是稳定的 data 属性，优先用它；哈希类名只在
没有 data 属性可用时才用（这里是 `wSkVaW_` 系列，它们没有 data 属性）。

# 为什么输入框没有液态玻璃效果：三个原因，逐层排除

> ⚠️ **本文结论已被浏览器内实测修正。**
> 原因 A 的判断是**错的** —— 我把 WebKit 的 bug 外推成了全平台结论。
> 实测引擎是 **Edge 152（Chromium 152）**，`backdrop-filter: url()` **被接受**。
> 原因 B（无可折射背景）与原因 C（我自己的 `scale="var()"` bug）成立。
> 更正详情见文末「实测更正」。

---

## 原因 A（❌ 已推翻）：曾以为 `backdrop-filter: url()` 全平台不生效

**曾经的错误推理**：引用 WebKit bug 245510 / 297770，
断言"Chromium / WebKit 都不支持用 SVG 滤镜做背景滤镜"。

**为什么错**：那两个 bug 说的是 **WebKit** 的行为，不是 Chromium 的。
调研还发现 WPT 测试 `css/filter-effects/backdrop-filter-reference-filter.html`
在 **Chrome / Edge PASS**，Firefox / Safari FAIL；svgwg#1142 原文亦写明
*"Chromium may render some cases, while Safari/WebKit does not"*。

**这是一次典型的外推错误**：把"某引擎有 bug"读成了"平台不支持"，
并据此停止了整条路线。

---

## 原因 B（✅ 成立）：输入框背后没有可折射的内容

这条是实测得出的，与浏览器能力无关。

浏览器内探针沿 `[data-composer-card]` 向上遍历六层祖先，结果：

```
card: 661×98, radius 22px, backdrop-filter: none
behind-card:
  div  bg rgba(0,0,0,0)  bgImage none  canvas false  img false
  div  bg rgba(0,0,0,0)  bgImage none  canvas false  img false
  div  bg rgba(0,0,0,0)  bgImage none  canvas false  img false
  div  bg rgba(0,0,0,0)  bgImage none  canvas false  img false
  div  bg rgba(0,0,0,0)  bgImage none  canvas false  img false
  div  bg rgba(0,0,0,0)  bgImage linear-gradient(transparent 0px, rgb(21,21,23) 36px)
  div  bg rgba(0,0,0,0)  bgImage none
```

**上方、下方、背后六层祖先全部透明、无图、无 canvas。**
那个渐变只是把对话区向下淡出到底色。

### 这意味着什么

透明玻璃背后是**平坦的纯色** → 折射纯色 = 什么都没变。

所以无论位移图多正确、`scale` 多准、高光多亮，
**输入框上的折射都不会有任何可见效果**。
这解释了为什么修好三个几何 bug 后观感仍无变化。

> 顺带纠正一个几何假设：卡片 661×98、radius 22px，
> 圆角实际是 `22/49 ≈ 0.45`，**不是**我早先按胶囊假设的 0.71。

---

## 原因 C（✅ 成立，且是我自己的 bug）：`scale="var(--x)"` 不解析

我写下了：

```jsx
React.createElement('feDisplacementMap', { scale: 'var(--dsh-lg-disp-scale)', ... })
```

**SVG 呈现属性不是 CSS 属性，`var()` 在 `scale` 上不会解析**，
静默回退到规范默认值 **`scale=1`**。

位移量 = `通道偏移 × scale`。图上边缘偏移约 0.42，
乘 1 之后位移不到半个像素 —— **肉眼完全不可见**。

两个版本的失败原因**不同**：

| 版本 | `scale` 写法 | 是否生效 | 为何仍看不见 |
|---|---|---|---|
| pkg-2 | 字面量 `22` | ✅ 生效 | 位移图边缘偏移仅 0.07，1px 级别 |
| pkg-3 | `var(...)` | ❌ 回退为 1 | 叠加后更不可见 |

`objectBoundingBox` 单位下物理正确的 `scale` 约 **0.1**，
不是 22 也不是 96 —— 我两次的量级都错了。

---

## 结论：输入框是玻璃效果最差的目标

| 目标 | 背后有什么 | 适合真实折射？ |
|---|---|---|
| **输入框**（本次目标） | 纯色 + 一个淡出渐变 | ❌ **没有可折射内容** |
| 侧边栏 | 浮在会话列表/内容之上 | ✅ 可能有 |
| 消息气泡 | 滚动时掠过其他消息 | ✅ 可能有 |

输入框被钉在底部、背后是底色，**结构上就不具备产生折射的条件**。
这是产品设计使然，不是实现问题。

---

## 实测更正（本次调研新增）

浏览器内自包含能力测试（`gcapt-4`）的读数：

```
ua                      : ... Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0
supportsBackdropBlur    : true
supportsBackdropUrl     : true          ← CSS.supports 通过
A_after_svg             : url("#dsh-cap-invert")   ← 引用未被丢弃
A_reference_survived    : true
B_filterComputed_after  : url("#dsh-cap-disp")     ← 滤镜图被接受
B_graphAccepted         : true
```

**引擎是 Edge 152（Chromium 152），不是 Firefox。**
（先前 `-webkit-backdrop-filter: false` 指向 Gecko 的推断被推翻，
而 `corner-shape: true` 指向 Chromium 的那条才是对的 ——
两条特征曾互相矛盾，应以 UA 为准。）

因此：

- `backdrop-filter: url()` 在目标引擎上**可用**；原因 A 作废。
- 原因 C 成为最可能的**直接**故障点。
- 原因 B 是**根本**障碍：即使 A、C 全修好，输入框上依然看不到折射。

> 注：`A_after_svg` 只是"声明存活"的证据。声明存活 ≠ 像素被真正位移。
> 要断言像素级效果，需要视觉确认或截图比对，本轮未做。

---

## 方法论教训

1. **不要把某个引擎的 bug 当成平台结论。** WPT 分引擎列结果的意义正在于此。
2. **不要靠 `CSS.supports` 判断特性可用性。** 语法合法 ≠ 渲染生效。
   （反向也成立：`CSS.supports` 说 true 也不代表真的画出来。）
3. **引擎身份以 UA 为准**，不要靠特征检测拼凑 —— 本次两条特征互相矛盾，
   差点又得出错误结论。
4. **先验证"有没有东西可折"，再优化"怎么折"。** 我把顺序做反了 ——
   花了三轮调位移图，而那个目标从一开始就不可能出效果。
5. **不要把文档化的约定当作技术边界。** Client 端"无 DOM 权限"是约定
   （runner 源码第 201 行自己承认），我据此排除了 canvas/WebGL 方案，属错误排除。


---

## 若仍要做，两条路

**路 1：给输入框背后铺一层可折射的内容。**
利用已验证可达的 `document`（见 `investigation/FINDINGS.md`）注入一个
渐变/噪点/动态图层，让折射有东西可折。
但注意：这会**改变 DSH 的外观**，且必须包在 `ctx.effect(cleanup)` 里
否则卸载不会回滚。

**路 2：换目标。** 侧边栏或消息气泡有真实内容，折射会显现。
代价是改动面更大、影响可读性的风险更高。

**路 3：纯 CSS 拟态。** 放弃真实折射，只用渐变 + 内阴影 + 边缘高光做出
"像玻璃"的质感。稳定、零风险，**但不是液体玻璃**，只是玻璃感。

---

## 方法论教训

1. **不要靠 `CSS.supports` 判断特性可用性。** 语法合法 ≠ 渲染生效。
2. **先验证"有没有东西可折"，再优化"怎么折"。** 我把顺序做反了 ——
   花了三轮调位移图，而那个目标从一开始就不可能出效果。
3. **最小验证优先。** 十行的最小复现页能在第一轮暴露 A 和 B，
   而不是在三轮实现之后。
4. **不要把文档化的约定当作技术边界。** Client 端"无 DOM 权限"是约定
   （runner 源码第 201 行自己承认），我据此排除了 canvas/WebGL 方案，
   这是错误的排除。

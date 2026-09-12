# Liquid Glass / Glassmorphism-Refraction on the Web — Landscape Report (2025–2026)

**Scope:** factual survey, not a tutorial. Written for an Electron/Chromium target plus normal Chrome,
where **no page-scope JavaScript of our own is possible** — only injected CSS and framework-mounted
React components.

---

## 0. Headline: the premise in the brief is probably wrong, and that changes everything

The brief states: *"I have confirmed via WebKit bug reports 245510 and 297770 and W3C SVG WG issue #1142
that SVG-filter-referenced backdrop-filter is not interoperably supported"* — and concludes the browser
"silently ignored the `url()` part of `backdrop-filter`".

Those bugs are real and the **non-interoperability conclusion is correct**. But the inference drawn from it
is not. Read what the two WebKit bugs actually are:

- [WebKit 245510](https://bugs.webkit.org/show_bug.cgi?id=245510) — *"backdrop-filter: url(#some-svg-filter)
  doesn't work with SVG filters like feDisplacementMap"*. Comment 1 (2022): *"it does not show any effect on
  'Hello' **while Chrome Canary 108 does show distortion effect**"*. Status: **NEW** (still open), P2.
  In 2026 there are three open WebKit PRs (68613, 68614, 69566) implementing it, plus a report that on trunk
  the testcase *crashes the GPU process repeatedly* until 68613 lands.
- [WebKit 297770](https://bugs.webkit.org/show_bug.cgi?id=297770) — WebKit engineer Simon Fraser, comment 1:
  *"**Accelerated filters (including backdrop-filter) can't use SVG filters**, sadly."* That is a statement
  about **WebKit's compositor**, not about the web platform.

Both are **BUGS IN WEBKIT**. Neither says Chromium ignores `url()`. The W3C issue
([svgwg#1142](https://github.com/w3c/svgwg/issues/1142)) says only that the feature is *"not reliable"* and
*"not interoperable"* — and explicitly notes *"Chromium may render some cases, while Safari/WebKit does not."*
The SVG WG's Robert Longson replied: *"Well you should be able to use feDisplacementMap with backdrop filters.
The fact that you can't is down to usage."*

**Hard evidence that Chromium implements it.** From the live WPT results API
(`wpt.fyi/api/search?q=backdrop-filter`), run of **Chrome 155.0.8053.0 / Edge 155**, 2026-09-12 —
columns are [Chrome, Edge, Firefox 158, Safari 252 preview]:

| WPT test | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| `/css/filter-effects/backdrop-filter-svg.html` | **P** | **P** | P | F |
| `/css/filter-effects/backdrop-filter-reference-filter.html` | **P** | **P** | F | F |
| `/css/filter-effects/backdrop-filter-reference-filter-mutated.html` | **P** | **P** | F | F |
| `/css/filter-effects/backdrop-filter-feimage-crash.html` | **P** | **P** | P | P |
| `/css/filter-effects/backdrop-filter-svg-blur.html` | F | F | F | F |
| `/css/filter-effects/backdrop-filter-plus-filter.html` | P | P | P | P |
| `/css/filter-effects/backdrop-filter-plus-filter-2.html` | P | P | P | F |

`backdrop-filter-reference-filter.html` is literally `<div style="backdrop-filter: url(#svgInvert)">` with an
`feColorMatrix` in a `display:none` SVG. **Chromium passes it; Gecko and WebKit fail it.** And it has existed
since Chromium's original 2015 landmark implementation (the Blink code review for `backdrop-filter` includes
`backdrop-filter-interpolation` tests over `url(#svgfilter)`).

**Independent practitioner consensus agrees** — every serious implementation says the same sentence, and it is
the *opposite* of "Chromium ignores it":

| Project | Its own words |
|---|---|
| [sohumsuthar/liquid-glass](https://github.com/sohumsuthar/liquid-glass) | *"**Chrome-only.** Safari and Firefox ignore `url()` in `backdrop-filter`"* |
| [SquareMediaGroup/glassfx](https://github.com/SquareMediaGroup/glassfx) | *"Refraction (`backdrop-filter: url()`) is currently **Chromium-only**"* |
| [stormaref/LiquidGlassSkill](https://github.com/stormaref/LiquidGlassSkill) | *"`backdrop-filter` referencing an SVG filter **renders in Chromium only**"* |
| [francescocastronuovo.com](https://francescocastronuovo.com/kb/gsap-webflow/glassy-button/) (verified 2026-07-27) | *"Chromium (Chrome, Edge, Brave, Opera): **the full effect**"* |
| [html-in-canvas.dev](https://html-in-canvas.dev/liquid-glass-effect/) | *"`url()` filters in `backdrop-filter` are **Chromium-only**"* |
| [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) | Chrome 76+ / Edge 79+ ✅ full |
| [samasante/liquid-glass](https://github.com/samasante/liquid-glass) `BROWSERS.md` | *"Bending the *live* page uses `backdrop-filter: url()`, which ships in **Chrome/Edge only**"* |

So: **the technique works in your target browser, and your implementation failed for an ordinary,
fixable reason.** Section 7 gives the 30-second diagnostic that distinguishes the two possible causes.

> **Evidence limitation, stated plainly.** I could not run a browser to verify this myself. This sandbox
> cannot execute Chromium: it dies at `FATAL:mojo/public/cpp/platform/platform_channel.cc:183 Check failed: .
> : 拒绝访问 (0x5)` — Chromium's multi-process IPC needs named pipes, which the sandbox denies. Playwright's
> own browser download dies the same way (`child_process` piped stdio → EPERM), and the direct CDN download
> failed on SSL. So the Chromium-support claim above rests on **WPT results + seven independent
> implementations**, not on my own repro. Section 7 tells you how to settle it in one line.

---

## 1. Apple "Liquid Glass" (iOS 26 / macOS Tahoe 26) — what it physically does

Introduced at WWDC 2025 (2025-06-09), spanning iOS/iPadOS 26, macOS Tahoe 26, watchOS/tvOS/visionOS 26.
Apple's own framing, per [WWDC25 session 219 "Meet Liquid Glass"](https://developer.apple.com/videos/play/wwdc2025/219/)
and the [HIG Materials page](https://developer.apple.com/design/human-interface-guidelines/materials), is that
Liquid Glass is a **lensing** material, not a scattering one — the explicit opposite of frosted glass:

| Behaviour | What it is | Web equivalent |
|---|---|---|
| **Lensing / refraction** | Bends and concentrates the backdrop in real time; the backdrop is *displaced*, not just softened | **None natively.** Only `backdrop-filter: url()` (Chromium) or shader/clone workarounds |
| **Specular highlights** | A lit rim whose brightness follows a light axis, plus a travelling highlight on interaction | Fake: gradients + `inset box-shadow`. No CSS primitive derives it from geometry |
| **Tinting** | Adaptive tint; hue/brightness/saturation adjusted for legibility | Real: `background: rgba()`, `backdrop-filter: brightness()/saturate()` |
| **Adaptive contrast** | Glass senses backdrop luminance and flips its own light/dark appearance | **Impossible in CSS/JS** — the backdrop is not readable. Ship theme classes instead |
| **Adaptive shadows** | Shadow opacity rises over text, falls over white | Fake: static `box-shadow` |
| **Morphing / gel** | Elements merge, squash, spring; `GlassEffectContainer` shares a sampling region | CSS transitions/spring animations on transform; no metaball merge |
| **Glass never samples glass** | Apple's rule | Arrives as a hard constraint: any ancestor `filter`, `opacity<1`, `mask`, `isolation`, `transform`, `content-visibility` becomes a **backdrop root** and a nested `backdrop-filter` silently has nothing to sample |

**Material variants Apple actually ships** (this matters for choosing a recipe): exactly two.
`regular` (frosted, adaptive, for text-heavy surfaces: bars, cards, menus) and `clear` (highly translucent,
for media-rich backgrounds — **requires** a 35 % dimming layer per HIG, or the content is unreadable).

**Is there a native web equivalent? No.** There is no CSS property, no filter primitive, and no in-flight
standards proposal that gives an author "displace the live backdrop". The W3C issue that asks for one
([svgwg#1142](https://github.com/w3c/svgwg/issues/1142), opened 2026-06-25) is unimplemented and has a
"contribute it yourself" reply from the SVG WG. `feRefraction` in that issue is explicitly *"not a concrete
proposal, just an example"*.

**What people use to approximate it:** the four families in §2. In practice, for shipping UI, everybody
uses **`backdrop-filter: blur() saturate() brightness()` + a layered fake rim and tint**. Genuine refraction
appears only in showcase components (buttons, pills, a single hero panel), because it is priced per element.

---

## 2. Working web implementations, classified by *does it actually bend the backdrop*

### 2A. GENUINE refraction of the live backdrop — `backdrop-filter: url(#svg)`

The only CSS-native real refraction. **Chromium only.**

| Project | Technique | Real refraction? |
|---|---|---|
| [shuding/liquid-glass](https://github.com/shuding/liquid-glass) (the reference) | JS builds a canvas displacement map, `feImage` `href` = `canvas.toDataURL()`, `feDisplacementMap` scale = max displacement; `backdrop-filter: url(#id_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`. Filter uses `filterUnits="userSpaceOnUse"`, `colorInterpolationFilters="sRGB"` | **Yes** |
| [sohumsuthar/liquid-glass](https://github.com/sohumsuthar/liquid-glass) (npm `@sohumsuthar/liquid-glass`) | 4-layer React + CSS. Layer 0 carries `backdrop-filter: blur saturate brightness contrast var(--lg-refract)`; `--lg-refract = url(#lg-refract-sm)`. Ray-traced Snell's-law map (BK7 n=1.5168), Fresnel-faded rim, optional 3-pass RGB dispersion | **Yes** |
| [SquareMediaGroup/glassfx](https://github.com/SquareMediaGroup/glassfx) | Shared SVG filter injected once; map **built from filter primitives** (edge-distance ramp → signed lens vectors), backdrop displaced 3× at staggered scales (42/48/54) and recombined per channel; behind an `@supports` gate | **Yes** |
| [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) | Pure-CSS/SVG Astro components; `feDisplacementMap` + `feGaussianBlur` + `feColorMatrix`; explicit Safari "glassmorphism fallback" | **Yes** (Chromium) |
| [stormaref/LiquidGlassSkill](https://github.com/stormaref/LiquidGlassSkill) | An Angular directive bakes a canvas displacement map **per element size** and consumes it as `backdrop-filter: url(#filter)`; CSS layer is separate. Explicitly gates on **user-agent engine**, not `@supports` | **Yes** (Chromium) |
| [francescocastronuovo.com recipe](https://francescocastronuovo.com/kb/gsap-webflow/glassy-button/) | `primitiveUnits="objectBoundingBox"` so `scale=0.8` is a fraction of the button box; per-button filter **cloning** so hover on one doesn't warp others | **Yes** (Chromium) |

**Failure modes of this family, in engine order:**

- **Safari/WebKit:** parses the declaration and **paints nothing**. Hence `@supports (backdrop-filter: url(...))`
  **returns true in Safari while the element renders blank** — a `@supports` gate is actively harmful here.
  Every mature library therefore gates on engine/UA instead: `navigator.userAgentData.brands`, a `Chrome/`
  UA test, or `@supports (-moz-appearance: none)` to give Firefox its own blur-only declaration.
  (Firefox note: because Gecko never implemented `-webkit-backdrop-filter`, a url()-bearing declaration that
  Gecko drops leaves the element with **no filter at all** unless you give Firefox a separate fallback.)
- **Firefox/Gecko:** `backdrop-filter: url()` is not supported for `feDisplacementMap`. WPT shows Gecko does
  pass the `feComponentTransfer`/`feColorMatrix` reference-filter test but **fails**
  `backdrop-filter-reference-filter.html` — i.e. partial, unreliable, don't rely on it.
- **Chromium:** works, with sharp edges you must respect (see §4).

### 2B. GENUINE refraction — but of a **copy**, via `filter: url()` on a real element

This is the cross-browser answer, and it is what the sophisticated libraries actually ship.

**Key insight:** `filter: url(#svg)` applied to a *real element* works in **all three engines** —
Chromium, WebKit and Gecko. It's `backdrop-filter: url()` that is Chromium-only. So you duplicate the
backdrop (or wrap the content), counter-position the copy inside the lens, and displace *that*.

- [samasante/liquid-glass](https://github.com/samasante/liquid-glass) — explicitly built on this.
  Its README: *"Most 'liquid glass' libraries use `backdrop-filter: url()`, which only works in Chromium…
  This one runs an SVG displacement filter on the element itself (`filter: url()`), so it refracts the real,
  live DOM, and it works across browsers."* Its [BROWSERS.md](https://github.com/samasante/liquid-glass/blob/main/BROWSERS.md)
  claims ✅ displacement + chromatic aberration + specular in **Chromium, WebKit (verified via Playwright)
  and Gecko**. Three documented WebKit hardening fixes: no supersampling (WebKit silently drops the costlier
  chroma/specular passes past a source-graphic size ceiling), debounced shape-only map regeneration,
  per-update filter-id version bumping (WebKit caches filter output by id).
  Modes: wrap your own children (`size`/`center`), `refract={node}` to copy a sibling, or `src`/`draw`
  + WebGL for `<video>`/`<canvas>` (SVG filters can't reach live media).
- **The DOM-clone workaround** is described and critiqued at length in
  [svgwg#1142](https://github.com/w3c/svgwg/issues/1142): *"works in narrow cases, but requires duplicating
  DOM or media, causes scroll desynchronization, accessibility hazards, and performance problems"* —
  duplicate IDs, broken ARIA refs, hidden focusable elements, keyboard traps, lazy-loaded images, sticky
  elements, and main-thread-vs-compositor scroll lag. The stormaref skill ships an Angular directive for it;
  francescocastronuovo clones filters per button.
- **§4 covers whether this can rescue the specific `feImage` + `feDisplacementMap` route.**

### 2C. GENUINE refraction — WebGL/Three.js over a **snapshot** (`html2canvas` / `dom-to-image` / `foreignObject`)

- [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react) (npm `liquid-glass-react`,
  demo at liquid-glass.maxrovensky.com) — React component with `displacementScale`, `blurAmount`,
  `aberrationIntensity`, `elasticity`, modes `standard | polar | prominent | shader`
  (`shader` "most accurate but not most stable"). README warns: *"Safari and Firefox only partially support
  the effect (displacement will not be visible)."*
  samasante's comparison table characterises this family as *"WebGL ones rasterize an `html2canvas`
  **screenshot**, so the text under the glass is frozen and stale"* — i.e. **real refraction of a fake,
  frozen backdrop**. Keep that distinction; it's the whole point of this report.
- **`<foreignObject>`** is the other snapshot serializer: serialize a DOM subtree into an SVG
  `<foreignObject>`, load it as an `<img>`, draw to canvas, displace in WebGL (`dom-to-image` does this).
  Limitations are severe and well known: external stylesheets are lost (only inline styles survive),
  external images/fonts must be inlined as data URIs, the result is rasterized at a fixed size, and
  cross-origin content taints or blanks the canvas. **`<foreignObject>` is not a backdrop-capture
  mechanism** — it renders *its own children*, it cannot ask the browser for "what is painted behind me".

### 2D. GENUINE refraction — HTML-in-Canvas (`drawElementImage` + WebGL)

**The API exists, but the name in your brief is slightly off: there is no `drawElement()`.**
Per the [WICG html-in-canvas explainer](https://github.com/WICG/html-in-canvas), the primitives are:

- `layoutsubtree` attribute on `<canvas>` — opts descendants into layout
- `drawable` attribute on descendants — required for drawing; implies `isolation: isolate`
- `paint` event (+ `requestPaint()`) — fires in the rendering update so you can re-capture in sync
- **`ctx.drawElementImage(element, dx, dy, …)`** (2D), **`texElementSubImage2D`** (WebGL),
  **`drawElementImageToTexture`** (WebGPU); `captureElementImage()` → transferable `ElementImage`
  for OffscreenCanvas/workers

This *is* the real thing over **live DOM**: the HTML under the shader stays in the accessibility tree,
stays hit-testable (`updateElementGeometry`, `preserveHitTestOrder`), and re-captures on every `paint`.
[html-in-canvas.dev's Liquid Glass demo](https://html-in-canvas.dev/liquid-glass-effect/) does exactly the
refraction shader this way — dome-masked inward displacement, two drifting simplex fields for "liquidity",
three-tap per-channel sampling for chromatic aberration, Fresnel rim, specular exponent 28, plus a
blue-shifted tint `vec3(0.93,0.96,1.06)`.

**Availability is the problem:**
- Chromium: behind the **`chrome://flags/#canvas-draw-element`** dev-trial flag (Chrome Canary).
- **Microsoft Edge origin trial**, [trial page](https://developer.microsoft.com/en-us/microsoft-edge/origin-trials/trials/a297467e-0030-4c4c-8739-48e130026c03),
  **expires 2026-10-20**, requires registering your origin and shipping a token or `Origin-Trial` header.
- **Not available to an ordinary Chrome page today.** In an Electron app you could enable the Blink runtime
  feature, but not in "a normal Chrome browser".
- Also note the explainer's sensitivity list: `<feImage>`, `<use>`, `<pattern>` and cross-origin
  embedded content are excluded from `drawElementImage` output for read-back safety.

### 2E. `element()` / `-moz-element()` — **dead end for Chromium**

`element()` is *"Limited availability… not Baseline because it does not work in some of the most widely-used
browsers"* and *"Experimental"* per [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/element);
examples are prefixed `-moz-element()` and *"work in builds of Firefox"*. It is **Gecko-only** (plus
`document.mozSetImageElement()`). There is no Chromium equivalent, so it cannot capture a backdrop in your
Electron/Chrome target. It is a genuinely cross-boundary reference problem: the semantics of SVG/CSS
document-internal references across shadow trees were [never resolved in the Web Components spec](https://lists.w3.org/Archives/Public/public-webapps-github/2019Mar/1149.html).

### 2F. FAKE — looks glassy, does **not** refract

Everything below is legitimate and shippable; it just never bends a pixel of the backdrop.
Recipes and layer attribution in §5.

| Technique | API | Real refraction? |
|---|---|---|
| Frost | `backdrop-filter: blur() saturate() brightness() contrast()` | **No** — scattering, the opposite of lensing |
| Tint | `background: rgba()` / `linear-gradient()` (optionally `color-mix()`) | No |
| Specular rim | `inset box-shadow` (light top/bottom, dark flanks), 1px `rgba(255,255,255,…)` border | No |
| Bezel/Fresnel | stacked inset shadows with fast falloff; `mask-composite` masked gradient `::before` rim | No |
| Travelling highlight | `conic-gradient` rotated by a custom property / `@property` angle | No |
| Bloom / cursor glow | radial-gradient `::after`, JS writes `--mx`/`--my` | No |
| Grain | `feTurbulence` as an inline SVG data-URI background, `mix-blend-mode: soft-light` | No |
| Fake chromatic fringe | two offset duplicate layers + `mix-blend-mode: screen` / `hue-rotate` | No |

**"Fake rim lighting" via mask/composite is the most under-used trick**: a `::before` with a
`linear-gradient`/`conic-gradient` **masked to the border ring only** (`mask-composite: exclude` with a
slightly inset second radius, or `padding-box`/`border-box` mask layers) gives a rim that tracks
`border-radius` exactly and reads as a polished edge without any `box-shadow` stacking.

---

## 3. Browser support reality check (Chromium is the target)

| Capability | Chrome / Edge (Chromium 152–155) | Firefox 155–158 | Safari 26.x / WebKit |
|---|---|---|---|
| `backdrop-filter: blur()` etc. | ✅ Baseline (Chrome 76, 2019-07-30) | ✅ (FF 103, 2022-07-26) | ✅ (Safari 18, 2024-09-16) |
| `backdrop-filter: url(#svg)` + `feImage`+`feDisplacementMap` | ✅ **works** (WPT pass; 7 implementations) | ❌ unreliable / fails ref-filter WPT | ❌ **parses, paints nothing** (bugs 245510, 297770) |
| `filter: url(#svg)` + `feDisplacementMap` on a real element | ✅ | ✅ | ✅ |
| `filter: url()` + `backdrop-filter` on the **same element** | ⚠️ see §7 — the WPT crash test for this combination exists because it is a known conflict zone (Mozilla bug 1770063; WebKit 297770) | ⚠️ same | ❌ ignored (WebKit 297770) |
| `@supports (backdrop-filter: url(...))` as a gate | ✅ true (correctly) | false | ⚠️ **true but paints nothing — do not use** |
| HTML-in-Canvas `drawElementImage()` | flag / origin trial only | ❌ | ❌ |
| `element()` / `-moz-element()` | ❌ | ✅ prefixed, experimental | ❌ |
| `corner-shape: squircle` | ✅ Chrome 139+ | ❌ | ❌ |
| `prefers-reduced-transparency` | ✅ (Chromium; and Safari 26) | partial | ✅ |

Sources: [MDN `backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)
(Baseline 2024), [web-features explorer](https://web-platform-dx.github.io/web-features-explorer/features/backdrop-filter/),
[caniuse css-backdrop-filter](https://caniuse.com/css-backdrop-filter) (95.69 % global; Firefox 70–102 flagged,
Safari 9–17.6 prefixed `-webkit-`), [wpt.fyi](https://wpt.fyi/results?q=feature:backdrop-filter).
`backdrop-filter` is in **Interop 2025**; web-features expects "Widely available" from 2027-03-16.

---

## 4. The `feImage` + `feDisplacementMap` route specifically

### 4.1 Yes, it can work — but only three ways, and only two are real backdrop refraction

**(a) As `backdrop-filter` on a real element (Chromium only).** This is shuding's approach and it does
genuinely refract. Non-negotiable details, each of which fails silently:

1. **`colorInterpolationFilters="sRGB"` is mandatory.** In the default linearRGB, the 128-neutral drifts
   and the entire backdrop shifts by a constant offset. (sohumsuthar calls this out explicitly.)
2. **`feImage` needs a base64 data URL.** sohumsuthar's component header: *"the displacement map MUST be
   loaded via base64 data URL. **`feImage` silently fails to load PNGs from a `display:none` SVG** in some
   browsers."* Their SVG is mounted at `position:absolute; width:0; height:0; overflow:hidden` — **not**
   `display:none`. shuding does the same and feeds `canvas.toDataURL()`. The francesco recipe instead has a
   script `fetch` the map and inject it. **A relative/external `feImage href` is the single most likely
   cause of a silent no-op.**
3. **Filter region and units must match the element.** Use `filterUnits="objectBoundingBox"` +
   `primitiveUnits="objectBoundingBox"` with `x/y/width/height = 0/0/1/1` and `feImage` at `0/0/1/1`
   with `preserveAspectRatio="none"` (sohumsuthar, glassfx). shuding/francesco use `userSpaceOnUse` with
   explicit pixel extents and an oversized region (`x="-1" y="-1" width="3" height="3"`).
   A zero-area or mis-scaled filter region produces *nothing*.
4. **`scale` is coupled to the map.** Displacement = `scale × (channel/255 − 0.5)`. sohumsuthar's
   physically-exact default is `scale ≈ 0.1` in objectBoundingBox units; shuding's is
   `maxScale ≈ max|d|/2` in user units; glassfx uses 42/48/54 for the three RGB passes.
   **Changing the map without recomputing `scale` never yields the effect.**
5. **One filter per element if it animates.** A single shared filter mutated by two elements makes them
   fight (francesco clones `#glass` → `#glass-1`, `#glass-2` per button).

**(b) As `filter: url()` on a real element (all engines).** This is the way to *prove the filter graph
itself is correct* and the way to ship cross-browser. You must supply the displaced pixels yourself:
modify the element's own children (samasante's `size`/`center` mode), or feed a copied sibling
(`refract={node}`). **Limitations:** it is not the live backdrop (scroll desync, a11y hazards, duplicated
IDs); it cannot reach live `<video>`/`<canvas>` (Safari won't SVG-filter a live `<video>` — samasante falls
back to a WebGL surface for media); large lenses or many instances are GPU-bound; a single stretched lens
"blooms an oval" on very wide dock-style panels (sohumsuthar and samasante both warn about this).
The parent's own `NOTES-displacement-geometry.md` documents the same geometry traps independently
(aspect-ratio mismatch dividing the horizontal component, SDF half-widths collapsing on wide elements,
per-channel normalisation, and `scale`↔map coupling).

**(c) As a genuine `feDisplacementMap` over *cloned* backdrop content** — same as (b), the classic
"duplicate the content behind and counter-position it" workaround that svgwg#1142 spends a whole section
criticising.

### 4.2 What is *not* possible
- **`backdrop-filter` naming the backdrop as an explicit filter input** (e.g.
  `in="BackdropGraphic"`). Not specified, not implemented — svgwg#1142's central request.
- **WebGL/WebGPU sampling arbitrary DOM/backdrop pixels.** Blocked for security; you must rebuild the page
  in a canvas, or use the flag-gated HTML-in-Canvas APIs.
- **`element()`/`-moz-element()` in Chromium.** No equivalent exists.
- **`<foreignObject>` as a backdrop capture.** It renders its own children; it cannot read what's behind.

---

## 5. Known-good "looks like glass, is actually cheap" recipes

The consensus layer model — Apple's own decomposition (lens / tint / highlights / shadows, per WWDC 219),
mirrored by sohumsuthar's four absolutely-positioned layers. For a fake (non-refracting) surface you drop
layer 0's displacement and keep everything else.

| # | Layer | Produces | Concrete implementation |
|---|---|---|---|
| 0 | **Frost** | the "milky" backdrop, the only part touching real pixels | `backdrop-filter: blur(12px) saturate(180%) brightness(1.06) contrast(1.04)` (regular variant). Keep blur small (2–4 px) for "clear" |
| 1 | **Tint / veil** | the panel's own base colour so it exists over pure black | plain `rgba()` fill — **and never `rgba(255,255,255,0.1)` + `mix-blend-mode: overlay`**, the #1 tutorial mistake: it vanishes on black. sohumsuthar's measured Apple curve is `glass_L = 0.58 × backdrop_L + 34` → slope = `brightness`, intercept = tint alpha ≈ 0.134. Tint should be **neutral** (all colour arrives from the backdrop) |
| 2 | **Specular rim** | the polished edge — the single strongest "this is glass" cue | `box-shadow: inset 0 1px 0 rgba(255,255,255,.25), inset 0 -1px 0 rgba(255,255,255,.06)` + `border: 1px solid rgba(255,255,255,.18)`. For a real Fresnel read: asymmetry `top:bottom ≈ 0.18:0.25`, bright hairlines top **and** bottom, **dark flanks** left/right (−39 L vs +97 L measured on macOS Control Center) — a `conic-gradient` **cannot** express this (it brightens the flanks and dims the horizontals, the opposite of the measurement). Use two axis-aligned gradients instead |
| 3 | **Rim via mask** | radius-tracking glossy edge without shadow stacking | `::before` with a gradient masked to the border ring: `mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)`, or `mask-composite: exclude` on a 1px-inset copy |
| 4 | **Edge darkening** | convexity / thickness at the contour | `inset 0 0 … rgba(0,0,0,…)` shadow, or a dark `::before` gradient masked to the ring's inner side |
| 5 | **Grain** | kills the "flat plastic" read; sells the frost | inline SVG `feTurbulence` data-URI as `background-image`, `mix-blend-mode: soft-light`, low opacity (sohumsuthar: `::before` noise grain) |
| 6 | **Bloom / cursor glow** | interactivity; the "lit from within" press state | radial-gradient `::after`; JS writes pointer position into `--mx`/`--my`. Without JS, bloom from centre on `:hover`. glassfx gates this behind `.glass-refract`'s JS |
| 7 | **Elevation** | separation from the page | outer `box-shadow: 0 8px 32px rgba(0,0,0,.35)`; drop it while scrolling if perf bites |

**Tiering by element (this is where the cost lives).** Both mature libraries converge on the same advice:
refraction is **priced per surface**, so tier it. Chips/pills/badges → CSS only, small blur, **no** filter.
Cards/panels/topbars → full treatment. Menus/popovers → heavier blur + a ~55 % opaque wash, no displacement.
Modals → opaque-ish frost over a scrim. Dropdowns and dialogs trade transparency for legibility *on
purpose*; don't "fix" them back.

**Two rules that override everything else:**
1. **Glass needs something to refract.** Behind a flat colour there is nothing to bend and the panel reads
   as a grey outlined box — which sends people reaching for more blur and more opacity, exactly the move
   that kills it. Ship the ambient mesh (off-screen fixed radial glows in violet/pink/cyan) as part of the
   recipe, not as decoration. Verify the page looks *uneven* with all glass removed.
2. **One glass surface per stack.** Two rims + two tints stack, the inner panel reads darker and deader,
   and the effect inverts. And never wrap glass in `filter`, `opacity<1`, `mask`, `isolation`,
   `content-visibility`, or `transform` — each makes an ancestor a **backdrop root** and the nested
   `backdrop-filter` silently samples nothing.

**Accessibility parity (cheap, and Apple ships it):** `prefers-reduced-transparency` → swap refraction for a
frostier/more opaque surface (not fully transparent); `prefers-reduced-motion` → disable gel/squash/bloom;
`prefers-contrast` → add a real border. sohumsuthar implements exactly this mapping.

---

## 6. Recommendation, ranked for *your* constraints

Constraint recap: Electron/Chromium + normal Chrome; **no page-scope JavaScript of our own** — only injected
CSS and framework-mounted React components. (A framework-mounted React component *does* run in page context,
so "the component renders the `<svg>`" is available; arbitrary injected `<script>` is not.)

Ranked by (a) real refraction, then (b) feasibility under that constraint.

| Rank | Approach | Real refraction? | Feasible? | Verdict |
|---|---|---|---|---|
| **1** | **Fix the `backdrop-filter: url()` implementation** — Chromium-only, real lensing, of the **live** backdrop, zero JS at steady state once the SVG filter exists in the document | **Yes — the only CSS-native path** | ✅ **Best.** Inject the CSS; have a mounted React component render the `<svg><filter>` into the document (light DOM, not a shadow root); base64-embed the map; `colorInterpolationFilters="sRGB"`; `filterUnits="objectBoundingBox"`; keep a `blur()`-only fallback declaration **before** the url()-bearing one and gate on engine, not `@supports` | **Do this first.** §7 has the diagnostic |
| **2** | **Pure-CSS fake glass** (recipe §5, minus layer 0 displacement) | No | ✅ trivially — CSS only | **The safe default for every surface except 1–3 hero elements.** Indistinguishable from real glass for most viewers *provided the backdrop is not flat* |
| **3** | **`filter: url()` on a React-rendered copy** (samasante-style) if you can render a copy of the backdrop inside a React component | **Yes**, of a copy — all engines | ⚠️ needs React to render the cloned subtree and keep it positioned; scroll desync + a11y cost | Use only for a hero panel where cross-browser parity is required |
| **4** | **HTML-in-Canvas `drawElementImage` + WebGL** | **Yes**, of **live** DOM | ⚠️ Chromium flag / Edge origin trial (expires **2026-10-20**); needs `onpaint` JS in the page; **in an Electron shell you can flip the Blink feature — in a normal Chrome page, no** | Revisit when it ships unflagged; it is the eventual right answer |
| **5** | **html2canvas/`foreignObject` → WebGL displacement** | Yes, of a **frozen snapshot** | ❌ heavy (three.js or raw WebGL), text under glass goes stale, external CSS/images lost in `foreignObject` | Not worth it for UI chrome |
| **6** | `element()` / `-moz-element()` | — | ❌ Gecko-only, no Chromium equivalent | Rule out |
| **7** | Direct copy of shuding/liquid-glass into the page | Yes | ❌ it is a console script that creates its own DOM + event listeners; violates "no page-scope JS" | Reference design only, not a drop-in |

**Blunt summary.** For an Electron/Chromium app there is exactly one real-refraction path that respects your
constraint: **`backdrop-filter: url(#svg)` with an `feImage`(base64 data URL) + `feDisplacementMap` graph,
rendered into the light DOM by a React component.** Everything else is either fake (acceptable, cheap,
recommended for all but a few surfaces) or requires JS you've excluded. If the single-correction in §0 is
right, you are one bug away from the effect working, not blocked by the platform.

---

## 7. Diagnostics: the 30 seconds that settle your failure

Your symptom — *"`url()` ignored, only the plain `blur()` applied"* — has exactly two candidate mechanisms,
and they have different fixes. Both are testable without touching your build:

**Test 1 — did the declaration even survive parsing?**
```js
getComputedStyle(document.querySelector('.your-glass')).backdropFilter
```
- Returns `"blur(4px)"` (no `url(...)`) → the **url()-bearing declaration was dropped** and what you saw
  was a *different* declaration (a fallback, or `-webkit-backdrop-filter`). Cause: the reference did not
  resolve **at computed-value time**. Per Filter Effects, an unresolvable filter reference invalidates the
  **entire** `filter-value-list` — so the `blur()` in that same declaration dies with it. Check:
  (i) is the `<svg><filter>` actually in the document **light DOM**, not a shadow root? (ii) is it in the
  **same document** as the styled element? (iii) does the `id` exist **before** first paint of the element?
  (iv) is the SVG in a `display:none` ancestor? Cross-shadow-tree reference resolution was
  [never specified](https://lists.w3.org/Archives/Public/public-webapps-github/2019Mar/1149.html) — this is
  the most likely culprit given "injected CSS + React components".
- Returns `"blur(4px) url(\"#id\")"` → the declaration parsed; the **filter graph itself is producing no
  displacement**. Cause: `feImage` failed to load (external/relative href; `display:none` ancestor;
  cross-origin/CSP) or the displacement map is neutral/normalised wrong, or `scale` is decoupled from the map,
  or the filter region is zero-area.

**Test 2 — does the filter graph work at all in this document?**
Apply the *same* filter to a real element instead of the backdrop:
```css
.probe { filter: url(#your-lens); }
```
on an element whose own pixels you can see distort. If the probe distorts and the backdrop doesn't, the
problem is the backdrop path (Chromium/Electron-specific, or a backdrop root above the element). If the
probe *also* does nothing, the problem is the filter graph — `feImage` href, `sRGB`, region, or `scale`.
(Note `<div class="probe">` needs *content* to displace; apply it to an `<img>` or a text block.)

**Test 3 — is something above it a backdrop root?** Check every ancestor for `filter`, `opacity < 1`,
`mask`, `mix-blend-mode ≠ normal`, `isolation: isolate`, `will-change` on those, `clip-path`, or
`content-visibility`. Any one of them silently leaves a nested `backdrop-filter` with nothing to sample.
Also check that `filter` and `backdrop-filter` are not both set on the glass element — that exact
combination is the subject of
[WPT `backdrop-filter-feimage-crash.html`](https://github.com/web-platform-tests/wpt/blob/master/css/filter-effects/backdrop-filter-feimage-crash.html)
(`* { backdrop-filter: url(#a); filter: saturate(60%) }`, filed after Mozilla bug 1770063) and of
[WebKit 297770](https://bugs.webkit.org/show_bug.cgi?id=297770).

**Test 4 — minimal repro.** Copy `css/filter-effects/backdrop-filter-reference-filter.html` from WPT
(`feColorMatrix`, `display:none` SVG, `backdrop-filter: url(#svgInvert)`) into the app unchanged. Chromium
should invert the box. If it does, reference filters work in your document and the fault is in the map/units;
if it doesn't, the fault is environmental (shadow DOM / document scoping / Electron flags such as a
software-rendering or `--disable-gpu` path).

**And do not gate on `@supports`.** `@supports (backdrop-filter: url(#x))` returns **true in Safari** while
Safari paints nothing (per stormaref's `SKILL.md`). Gate on engine — `navigator.userAgentData.brands`,
`Chrome/` in the UA, or `@supports (-moz-appearance: none)` to hand Firefox a blur-only declaration.

---

## 8. Sources

**Primary / standards**
- [WebKit bug 245510 — `backdrop-filter: url(#…)` doesn't work with SVG filters like `feDisplacementMap`](https://bugs.webkit.org/show_bug.cgi?id=245510) (NEW; comment 1 confirms Chrome Canary 108 *did* distort; 2026 comments reference WebKit PRs 68613/68614/69566 and a GPU-process crash loop on trunk)
- [WebKit bug 297770 — `filter: url()` ignored when `backdrop-filter` applied](https://bugs.webkit.org/show_bug.cgi?id=297770) (REOPENED; smfr: *"Accelerated filters (including backdrop-filter) can't use SVG filters"*)
- [W3C svgwg issue #1142 — define interoperable backdrop displacement/refraction for "liquid glass" UI](https://github.com/w3c/svgwg/issues/1142) + [Robert Longson's reply](https://lists.w3.org/Archives/Public/public-svg-issues/2026Jun/0119.html)
- [WPT results for `backdrop-filter` (wpt.fyi API)](https://wpt.fyi/api/search?q=backdrop-filter) — Chrome 155/Edge 155 pass `backdrop-filter-reference-filter(.html|-mutated.html)`; Firefox 158 and Safari 252 preview fail
- [WPT `backdrop-filter-reference-filter.html`](https://github.com/web-platform-tests/wpt/blob/master/css/filter-effects/backdrop-filter-reference-filter.html), [`backdrop-filter-svg.html`](https://github.com/web-platform-tests/wpt/blob/master/css/filter-effects/backdrop-filter-svg.html), [`backdrop-filter-feimage-crash.html`](https://github.com/web-platform-tests/wpt/blob/master/css/filter-effects/backdrop-filter-feimage-crash.html)
- [MDN `backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) · [MDN `element()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/element)
- [web-features: backdrop-filter](https://web-platform-dx.github.io/web-features-explorer/features/backdrop-filter/) · [caniuse: css-backdrop-filter](https://caniuse.com/css-backdrop-filter)
- [mfreed7 Backdrop-filter Explainer](https://github.com/mfreed7/backdrop-filter-feature) (Chromium implementation notes: readback → filter → rounded clip)
- [W3C public-fxtf: "Backdrop filters should not use BackgroundImage" (#53)](https://lists.w3.org/Archives/Public/public-fxtf-archive/2024Nov/0009.html)
- [W3C public-webapps: SVG references in shadow DOM (#179)](https://lists.w3.org/Archives/Public/public-webapps-github/2019Mar/1149.html)

**Apple / Liquid Glass**
- [WWDC25 session 219 — Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) · [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [conorluddy/LiquidGlassReference — iOS 26 Swift/SwiftUI reference](https://github.com/conorluddy/LiquidGlassReference) (variants, `GlassEffectContainer`, accessibility, battery cost)
- [hig-doctor HIG materials snapshot](https://github.com/raintree-technology/hig-doctor/blob/main/skills/hig-foundations/references/materials.md) (35 % dimming layer for `clear`)

**Implementations**
- [shuding/liquid-glass](https://github.com/shuding/liquid-glass) · [sohumsuthar/liquid-glass](https://github.com/sohumsuthar/liquid-glass) (+ [`LiquidGlassFilter.jsx`](https://github.com/sohumsuthar/liquid-glass/blob/main/components/LiquidGlassFilter.jsx)) · [samasante/liquid-glass](https://github.com/samasante/liquid-glass) (+ [`BROWSERS.md`](https://github.com/samasante/liquid-glass/blob/main/BROWSERS.md)) · [SquareMediaGroup/glassfx](https://github.com/SquareMediaGroup/glassfx) · [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) · [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react) · [kevinbism/liquid-glass-effect](https://github.com/kevinbism/liquid-glass-effect)
- [stormaref/LiquidGlassSkill](https://github.com/stormaref/LiquidGlassSkill) (`SKILL.md`, `references/recipes.md`)
- [html-in-canvas.dev — Liquid Glass in CSS and WebGL](https://html-in-canvas.dev/liquid-glass-effect/)
- [WICG html-in-canvas explainer](https://github.com/WICG/html-in-canvas) · [Microsoft Edge origin trial (expires 2026-10-20)](https://developer.microsoft.com/en-us/microsoft-edge/origin-trials/trials/a297467e-0030-4c4c-8739-48e130026c03)
- [francescocastronuovo.com — glass button that refracts the page behind it](https://francescocastronuovo.com/kb/gsap-webflow/glassy-button/) (verified 2026-07-27) · [DEV: Recreating Apple's Liquid Glass Effect with Pure CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)
- Workspace-local prior art: `NOTES-displacement-geometry.md`, `liquid-glass-main/liquid-glass.js`, `tools/gen-displacement-map.mjs`

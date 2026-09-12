# Why this plugin does not refract

Both READMEs link here, so this is the single place the decision is recorded.
It is written against measurements, not impressions, because the measurements are
what changed the conclusion three times.

---

## The short version

The composer sits on **flat colour**. Refracting flat colour changes nothing
visible. Every refraction technique below was therefore working correctly and
still producing no perceptible result.

Measured in the live page, walking up from `[data-composer-card]`:

```
card: 661×98, radius 22px, background rgb(44,44,46)
behind-card, six ancestor layers:
  div  bg rgba(0,0,0,0)   bgImage none   canvas false   img false
  div  bg rgba(0,0,0,0)   bgImage none   canvas false   img false
  div  bg rgba(0,0,0,0)   bgImage none   canvas false   img false
  div  bg rgba(0,0,0,0)   bgImage none   canvas false   img false
  div  bg rgba(0,0,0,0)   bgImage none   canvas false   img false
  div  bg rgba(0,0,0,0)   bgImage linear-gradient(transparent 0px, rgb(21,21,23) 36px)
```

All transparent, no images, no canvas. The one gradient fades the conversation
area down to the base colour.

**This is a product-structure constraint, not a CSS limitation.** The composer is
pinned to the bottom of the viewport over the app's background. That is the
worst possible target for a glass effect — and the sidebar or message bubbles,
which sit over live content, would be better ones.

---

## Three approaches, and what each actually established

### 1. `backdrop-filter: url(#svgFilter)` — the CSS-native route

**State:** unproven. The declaration survives computed-style resolution
(`getComputedStyle(el).backdropFilter` returns `url("#id")`), but no measurement
confirmed it displaces a single pixel on the backdrop path.

**What went wrong along the way:** the filter *graph* was blamed first, then
external-image loading, then aspect ratio — all three were wrong, and all three
were "confirmed" by a measurement harness that was itself broken. That harness
serialised one element into a `foreignObject` while leaving the `<filter>`
definition out of the serialised fragment, so the reference dangled and was
dropped; it reported "0 pixels changed" for everything and was briefly taken as
decisive evidence.

Once fixed, the same test reported **68.7% of pixels changed** — proving the
filter chain works and that the harness had been lying.

**Lesson recorded:** a broken measurement is worse than no measurement. It
manufactures false confidence at exactly the moment real evidence is needed.

### 2. Canvas capture + SVG displacement — the bypass route

**State:** the pipeline is technically sound; it changes nothing here for reason 1.

The region behind the composer is cloned into an SVG `foreignObject`, rasterised,
displaced with `feImage` + `feDisplacementMap`, and mounted behind the card. This
deliberately avoids the unproven `backdrop-filter` path by applying the filter to
an ordinary `<img>`, where `filter: url()` is confirmed working.

It refracts the same flat colour, so it looks like nothing. It also carries an
inherent cost — a snapshot lags while the chat scrolls — which would only be worth
paying for a visible result.

### 3. Pure-CSS fake glass — what shipped

Real frosting, tint, ring and sheen, with no pretense of refraction. Stable, cheap,
zero assets.

---

## The tempting wrong turn, recorded so it is not repeated

The effect looked good in one iteration, and that iteration happened to also set a
wallpaper on `:root`. The conclusion drawn was "the transparency needs a backdrop",
and a wallpaper was bundled into the plugin.

**That was correlation read as cause.** A pane's transparency is its own property —
`tint` is simply the alpha of its `background-color`. It does not depend on what is
behind it. The wallpaper only made the transparency *visible*; it never
contributed to it.

The wallpaper was also a bad idea on its own terms: it changed `:root`, and so the
entire application's background, to flatter one input box. It has been removed.

---

## What would actually make refraction viable

Two honest options, neither of which this plugin does:

1. **Retarget.** Apply the effect to a surface that genuinely floats over content —
   the sidebar over the session list, or message bubbles over earlier messages.
   Same technique, better subject.
2. **Give the composer something to refract**, then lay the pane over it. That is a
   deliberate product change to DSH's appearance, not a plugin-local fix, and it
   should be a deliberate decision rather than a side effect.

---

## Where the supporting detail lives

- `docs/PANE-RECIPE.md` — the exact recipe for the look that shipped, the three
  preconditions, and the settings-row construction.
- `docs/DISPLACEMENT-GEOMETRY.md` — the three geometry traps in displacement-map
  construction, with reusable self-check code. Still valid for any future map-based
  work.
- `docs/investigation/FINDINGS.md` — the Cordis client sandbox boundary, measured,
  with source locations. Establishes that a dynamic plugin *can* reach the DOM, so
  canvas/WebGL was never actually ruled out on capability grounds.
- `docs/research/LIQUID-GLASS-LANDSCAPE.md` — the survey of existing web
  implementations, with per-engine WPT evidence and eight ranked approaches.

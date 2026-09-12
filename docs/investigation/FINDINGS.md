# Is "no DOM access" a real boundary for the DSH dynamic-client sandbox?

**Answer: No. It is a convenience contract, not a technical boundary.**
The evaluated code reaches the page's real `document` through the ordinary
scope chain. There is no escape trick needed — bare `document` resolves.

The runner's own source says so explicitly (`lib/client.js:201`):

> *This is API discipline, not a security boundary: a dynamic package's code is
> as trusted as the host process that accepted its definition.*

---

## 0. What is actually being tested (exact production code)

`…/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:152-181`:

```js
const traps = closureTraps();                       // :58-64
const parameters = [ 'React','console','styles','host','harness',
                     ...Object.keys(traps), 'process','Buffer' ];
closure = new Function(...parameters, `return (async () => {\n${clientCode}\n})()`);
returned = await closure(react, taggedConsole(...), styles, {call:...},
                         harnessTrap(), ...Object.values(traps), void 0, void 0);
```

```js
// :49-56
const DYNAMIC_CLIENT_REDIRECTS = {
  setTimeout, setInterval, clearTimeout, clearInterval,  // TIMER_REDIRECT
  fetch,                                                 // "network belongs to the HOST half"
  require,                                               // "modules cannot be imported here"
};
```

Two facts that decide everything:

1. `document`, `window` and `globalThis` are **not** in `parameters`.
   (`fetch` *is* a parameter — it is shadowed by a throwing function.)
2. The **only** `Proxy` is `harnessTrap()` — and it is passed as the *value of
   the `harness` parameter* (`:181`), i.e. it constrains `harness.x`.
   It is **not** the global object.

---

## 1. Verdict table

Measured in Node with the runner's exact parameter list and a synthetic page
global (`probe-core.mjs`, 32/32 probes). `new Function` is pure ECMAScript with
no DOM involvement, so these results are engine-portable; browser confirmation
is in `browser-proof.html`.

| # | Escape technique | Works? | Blocked by |
|---|---|---|---|
| A1 | bare `document` | **YES** | nothing — resolves via scope chain |
| A2 | bare `window` | **YES** | nothing |
| A3 | `globalThis.document` | **YES** | nothing |
| A4 | `globalThis['doc'+'ument']` | **YES** | nothing (defeats naive static analysis) |
| A5 | `(function(){return this})()` sloppy → global | **YES** | nothing (`this` cannot be a parameter) |
| A6 | `this.document` from that IIFE | **YES** | nothing |
| A7 | async-wrapper `this` | **YES** = global | nothing — wrapper is sloppy mode |
| A8 | `(function(){}).constructor('return document')()` | **YES** | nothing |
| A9 | `Object.getPrototypeOf(async function(){}).constructor` | **n/a** | *not a Function ctor* — it is `AsyncFunction`; returns a Promise, not `document` |
| A10 | `(async()=>{}).constructor(...)` | **n/a** | same as A9 |
| A11 | `Function.prototype.constructor(...)` | **YES** | nothing |
| A12 | `({}).constructor.constructor(...)` | **YES** | nothing |
| A13 | `(0).constructor.constructor(...)` | **YES** | nothing |
| A14 | `('').constructor.constructor(...)` | **YES** | nothing |
| A15 | `Reflect.construct(Function, [...])` | **YES** | nothing |
| A16 | direct `eval('document')` | **YES** | nothing (inherits the same scope) |
| A17 | indirect `(0,eval)('document')` | **YES** | nothing (global scope) |
| A18 | `globalThis.eval('document')` | **YES** | nothing |
| X1 | recover shadowed `process` via Function ctor | **YES** | nothing |
| X2 | recover shadowed `Buffer` via Function ctor | **YES** | nothing |
| X5 | `node.ownerDocument` from a passed DOM node | **YES** | nothing — needs no global at all |
| T1 | bare `fetch` (shadowed) | **BLOCKED** | parameter shadow — a real (if cosmetic) block |
| T2 | `globalThis.fetch` | **YES** | nothing — shadow is lexical only |
| T3 | `window.fetch` | **YES** | nothing |
| T4 | `harness.foo` | **BLOCKED** | `harnessTrap()` Proxy `get` throws |
| T5 | does that Proxy affect `globalThis.document`? | **NO** | it only guards `harness.*` |
| T6 | reassign shadow param `fetch = ...` | **YES** | nothing — parameters are writable |
| X3 | `arguments.callee` | **YES** (sloppy) | nothing |
| X4 | `fn.caller` chain | **YES** | nothing |
| X7 | dynamic `import()` | **UNMEASURED in browser** | CSP `script-src` may block it; irrelevant anyway (see §4) |

### What would actually block each escape

| Containment strategy | Blocks `document`? | Blocks Function-ctor re-entry? | Verdict |
|---|---|---|---|
| **S0** named parameters only (**= the real runner**) | No | No | **not a boundary** |
| **S1** also pass a throwing `document` param | bare name only | **No** | useless |
| **S2** pass poisoning `document`/`window`/`globalThis` params | bare name only | **No** | useless |
| **S3** wrap body in `with(denyingProxy)` | lexical names only | **No** | useless |
| **S4** `'use strict'` body | No | No | useless — changes `this`, not scope |
| **S5** fresh global object with no `document` (real realm isolation) | **YES** | **YES** | **this is the only thing that works** |

Decisive sub-test — `document`/`window`/`globalThis` all passed as throwing
poisoned proxies, then read back out:

```
bare document       -> THREW        (shadow works)
globalThis.document -> THREW        (shadow works)
Function ctor       -> PAGE_DOCUMENT   <-- shadow defeated
indirect eval       -> PAGE_DOCUMENT   <-- shadow defeated
```

**You cannot shadow the global environment by shadowing its names.**

### The Proxy question, answered precisely

* **Proxy as a parameter value** (`harness`, exactly as shipped): constrains only
  `harness.<prop>`. `globalThis.document` is untouched. — measured, CASE A.
* **Proxy as the realm's global object** (vm sandbox, `probe-proxy-global.mjs`
  CASE B): *does* block `bare document`, `globalThis.document`,
  `Function ctor`, even `eval` — but that is because the proxy denies those
  properties, **not** because proxying is inherently protective. This is not
  reachable in a normal browser page for the current realm: you cannot replace a
  realm's global object from script.
* **Proxy via `with` in the same realm** (CASE D): blocks bare names, but
  **`this.document` and `(function(){}).constructor('return document')()`
  still reach the real document.**
* Replacing the `globalThis` *property* with a denying proxy (measured, `probe-edges.mjs`):
  `globalThis.document` blocked, but `document`, `Function ctor`, `eval` all still
  reached it. Property-name replacement ≠ closing the environment.

---

## 2. Exact spec reasoning for the `new Function` scope chain

`new Function(...)` invokes `CreateDynamicFunction(constructor, newTarget, kind, args)`
([ECMA-262 §20.2.1.1 / §10.2.1.1](https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-createdynamicfunction)).
The three steps that matter:

1. Let `realmF` be **the current Realm Record**.
   → The function belongs to *the page's realm*. There is no "sandbox realm".
2. Let `F` be `OrdinaryFunctionCreate(%Function.prototype%, sourceText, parameters, body, "global", null, null)`.
   → `thisMode` is `"global"`, i.e. **sloppy mode unless the body itself opts in**.
   → The `env` argument is **`null`**.
3. Perform `SetFunctionName`/`MakeConstructor`… and set `F.[[Environment]]` to
   **`realmF.[[GlobalEnv]]`** — the realm's **Global Environment Record**.

That last assignment is the whole story. `F.[[Environment]]` is the function's
outer lexical environment, and it is **the global environment**, not the
environment of whoever called `new Function`. So when the body evaluates the
free identifier `document`:

```
ResolveBinding("document")
  → GetIdentifierReference(F's FunctionEnvironment, "document")
      → F.[[Environment]] === realmF.[[GlobalEnv]]      // step 3
        → Global Environment Record
            → Object Environment Record over the global object (window)
              → window.document exists  →  the real Document
```

Consequences, each one measured above:

* Adding names to `parameters` creates a **new innermost declarative environment**
  (the function environment) that shadows those *names*. It cannot remove or
  alter `F.[[Environment]]`, so it **cannot** shadow anything not named.
  → A1–A6, S1, S2.
* Since `env` is `null` and the environment is the global one, calling
  `F.[[Environment]]`'s Function constructor from *inside* the evaluated code
  produces a **second** function with the same `[[Environment]] = [[GlobalEnv]]`.
  Recursion depth does not help. → A8–A15.
* `'use strict'` in the body sets `thisMode` to `"strict"`; **`[[Environment]]`
  is unaffected**, so free-variable resolution is identical. Strict mode changes
  *how `this` binds*, not *where names resolve*. → S4; measured:
  `strict body free document -> PAGE_DOC` and `strict body Function-ctor escape -> PAGE_DOC`.
* `with(obj) { … }` inserts an Object Environment Record *innermost*, so it
  shadows identifier lookups — but `this`, property access, and newly
  Function-constructed code bypass it entirely. → S3.
* The one thing that genuinely closes the chain is giving the code a
  **different realm/global environment** whose global object has no `document`
  (S5). Then `F.[[Environment]]` is *that* realm's global env, and `document`
  simply is not a binding. → blocked, measured.

### Answer to Q3 ("is the page global still reachable with traps spread as parameters?")

**Yes.** The traps are ordinary parameters holding throwing functions. Each name
in `parameters` merely creates a binding in the new function environment.
`new Function` semantics guarantee the function's outer environment is the realm's
global environment regardless of the parameter list, so every global not named in
that list stays reachable — and even *named* globals stay reachable via
`globalThis`/`window`/`eval`, because the shadow is lexical, not a property
deletion. `fetch` is the proof: bare `fetch` throws (T1) while
`globalThis.fetch` returns the real function (T2/T3).

---

## 3. Q2 summary: what would actually block it

| Strategy | Effective? | Why |
|---|---|---|
| Add `document`/`window` params that throw | **No** | shadow is lexical; `globalThis`/`eval`/Function-ctor bypass it |
| `with` a denying Proxy (same realm) | **No** | `this` and Function-ctor bypass it |
| Strict-mode body | **No** | strictness ≠ scope isolation |
| Proxy on `globalThis` property | **No** | bare `document` and Function-ctor still resolve via the environment record |
| **Sandboxed `<iframe>` (no `allow-same-origin`)** | **Yes** | separate realm/global; `document` belongs to the frame |
| **Dedicated `Worker`** | **Yes** | no `document` in a worker global scope at all |
| **`ShadowRealm`** (`ShadowRealm.evaluate`) | **Yes** | separate realm, no DOM bindings |
| **`vm`-style fresh global object (Node analogue)** | **Yes** | measured, S5 |

Removing `new Function` and using a real module boundary does **not** help by
itself — a module's free identifiers still resolve to the global environment.

---

## 4. Q4: canvas / WebGL / raster — practical answer

Once `document` is obtained (trivially), everything in Part 2 of
`browser-proof.html` is available: `createElement('canvas')`,
`getContext('2d')`, `getImageData`, `putImageData`, `toDataURL`, `getContext('webgl2')`,
and direct DOM mutation (`document.body.appendChild`).

Real blockers, and only these:

| Blocker | Applies? |
|---|---|
| **No `document`** | ❌ not real — it is reachable |
| **CSP `unsafe-eval`** | ⚠️ *would* break the whole sandbox first: without `unsafe-eval`, `new Function` throws and **nothing runs at all**. So DSH necessarily permits it. |
| **CSP `img-src`/`connect-src`** | affects `new Image()`/`fetch`-based sampling, not canvas drawing |
| **Tainted canvas** (`SecurityError` on `getImageData`) | only if you draw a **cross-origin** image without CORS. Drawing your own canvas content, or same-origin/DOM-rendered content, is fine. |
| **`html2canvas`-style DOM→canvas** | not needed; the real DOM is directly reachable |
| **Cross-origin iframes** | cannot read their pixels — the usual rule |

So the README's conclusion *"dynamic Cordis plugins have no canvas, no
`document`, therefore canvas/WebGL is impossible in this form"* is **wrong on the
premise**. The capability is present. CSS-only is a *choice*, not a constraint.

---

## 5. Measurement provenance (what is fact vs. reasoning)

| Claim | Basis |
|---|---|
| Scope chain / `[[Environment]] = [[GlobalEnv]]` | **Spec** (ECMA-262 `CreateDynamicFunction`, step "set F.[[Environment]] to realmF.[[GlobalEnv]]") |
| All 32 escapes reach `document` | **Measured** — `probe-core.mjs`, runner-shaped, 32/32 |
| Containment grid Y/blocked | **Measured** — `probe-containment.mjs`, `probe-realm.mjs` |
| Proxy-as-parameter vs Proxy-as-global | **Measured** — `probe-proxy-global.mjs` |
| Strictness, `globalThis` replacement, `ownerDocument` | **Measured** — `probe-edges.mjs` |
| Dynamic `import()` behaviour | **NOT measured in a browser.** `probe-dynamic-import.mjs` ran in Node `vm`, where `import` is injected per-module — the result there is a Node artifact and must not be generalised. In a browser `import()` is host-defined (`HostImportModuleDynamically`) and may be blocked by CSP. Irrelevant to the verdict: `import` grants no capability that the scope chain has not already granted. |
| Canvas/WebGL reachable | **Measured under a DOM shim** (`exec-html-script.mjs` reaches the code paths), **plus spec-level certainty** that `document` is reachable. Not measured in a real browser here — see limitation below. |

### Limitation of this environment

I could **not** obtain a real-browser measurement. Launching Edge headless is
blocked by this session's sandbox:

```
FATAL:mojo\public\cpp\platform\platform_channel.cc:183] Check failed: 拒绝访问 (0x5)
```

Name resolution of free identifiers is engine-independent and cannot plausibly
differ between Node and any conformant browser, but I am labelling that step as
*reasoned*, not *browser-measured*. To close the gap, open
`investigation/browser-proof.html` by double-clicking it — it needs no server and
no network, runs synchronously, and prints its verdict in the page title
(`DONE — SANDBOX BYPASSED`). The page's own script was executed under a DOM shim
and reached exactly that conclusion.

---

## 6. Bottom line

`"no DOM access"` describes **what the author is handed**, not **what the code
can reach**. The parameter list is an ergonomic API surface and a set of
*teaching redirects*: it produces good error messages when a plugin author
reaches for `fetch` or `setTimeout`, and it keeps plugin code from accidentally
depending on globals the harness wants to route through services. That is real,
useful work — but it is documentation-as-code, not containment.

Anyone who can write plugin code can, in one expression,
`(function(){}).constructor('return document')()` — or simply write `document`.
The correct mental model is: **a dynamic package's code is as trusted as the
definition that was accepted**, which is exactly what the runner's own comment
concedes.

### Practical consequences

1. Do not rely on this boundary for safety. If genuinely untrusted code must run,
   it needs a real isolation primitive: sandboxed `<iframe>`, `Worker`,
   `ShadowRealm`, or a server-side sandbox.
2. The canvas/WebGL option is **open** to dynamic Cordis plugins. If you want
   real refraction (sample the pixels behind the composer, compute the lens, draw
   it), you can build it in a dynamic plugin today.
3. If the goal is to *keep* the contract honest, the only durable fix is to stop
   describing it as a capability limit. Call it an API surface. The runner already
   does.

---

### Artifacts

| File | Purpose |
|---|---|
| `investigation/probe-core.mjs` | runner-shaped escape matrix, 32 probes |
| `investigation/probe-containment.mjs` | escape × containment grid |
| `investigation/probe-realm.mjs` | realm-safe escape matrix + containment shapes |
| `investigation/probe-proxy-global.mjs` | Proxy-as-parameter vs Proxy-as-global-object |
| `investigation/probe-edges.mjs` | strictness, `globalThis` replacement, `ownerDocument` |
| `investigation/probe-dynamic-import.mjs` | `import()` in `vm` — explicitly non-generalizable |
| `investigation/browser-proof.html` | **double-clickable real-browser proof** (self-contained) |
| `investigation/exec-html-script.mjs` | runs that page's script under a DOM shim |
| `investigation/validate-html-script.mjs` | syntax-checks the HTML artifacts |

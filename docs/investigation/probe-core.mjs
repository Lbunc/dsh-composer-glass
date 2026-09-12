/**
 * probe-core.mjs
 * ---------------------------------------------------------------------------
 * Reproduces the EXACT evaluation shape of dsh-cordis-client-runner:
 *
 *   evaluateClientHalf()  (lib/client.js:152-181)
 *     parameters = ['React','console','styles','host','harness',
 *                   ...Object.keys(traps), 'process','Buffer']
 *     traps      = { setTimeout, setInterval, clearTimeout, clearInterval,
 *                    fetch, require }        // throwing teaching redirects
 *     closure    = new Function(...parameters, `return (async () => {\n${code}\n})()`)
 *     closure(react, taggedConsole, styles, hostStub, harnessProxy,
 *             ...Object.values(traps), undefined, undefined)
 *
 * This file measures which escape techniques reach a page-global `document`
 * that is deliberately NOT passed as a parameter.
 *
 * Node has no DOM. We therefore INSTALL a synthetic global `document`
 * (plus `window`) that behaves like a real page global, so that the only
 * question under test is *scope-chain reachability*, not the existence of
 * a DOM. Nothing about `new Function` semantics depends on what the global
 * happens to contain.
 *
 * IMPORTANT: this is Node, not a browser. `new Function` semantics used here
 * are exactly the ECMAScript semantics a browser uses, because both are
 * ordinary ECMAScript engines and `new Function` is pure spec (no DOM
 * involvement). Where a claim depends on browser-only machinery (CSP,
 * shadow realms, workers, tainted canvas) it is marked SPEC / UNMEASURED.
 */

// ---------------------------------------------------------------------------
// 1. Install synthetic page globals AFTER any module-level captures.
// ---------------------------------------------------------------------------
let docReads = 0;
const fakeHead = {
  append() {},
  appendChild() {},
};
const fakeDocument = {
  __tag: 'REAL_PAGE_DOCUMENT',
  head: fakeHead,
  body: {},
  createElement(tag) {
    return { tagName: String(tag).toUpperCase(), ownerDocument: fakeDocument };
  },
  getElementById() { return null; },
  querySelector() { return null; },
};
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  get() { docReads += 1; return fakeDocument; },
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  get() { return globalThis; },
});

// ---------------------------------------------------------------------------
// 2. Reproduce the runner verbatim.
// ---------------------------------------------------------------------------
const DYNAMIC_CLIENT_REDIRECTS = {
  setTimeout: 'browser timer globals are unavailable in dynamic packages.',
  setInterval: 'browser timer globals are unavailable in dynamic packages.',
  clearTimeout: 'browser timer globals are unavailable in dynamic packages.',
  clearInterval: 'browser timer globals are unavailable in dynamic packages.',
  fetch: 'network belongs to the HOST half.',
  require: 'modules cannot be imported here.',
};

function closureTraps() {
  const traps = {};
  for (const [name, redirect] of Object.entries(DYNAMIC_CLIENT_REDIRECTS)) {
    traps[name] = () => {
      throw new Error(`${name} is not available in a dynamic client half — ${redirect}`);
    };
  }
  return traps;
}

function harnessTrap() {
  return new Proxy({}, {
    get(_t, prop) {
      throw new Error(`harness.${String(prop)} belongs to the HOST half.`);
    },
  });
}

const react = { createElement() { return {}; } };
const styles = { insert() { return () => {}; } };
const hostStub = { call: async () => null };

/** Exactly the runner's construction. Returns the invoked result. */
async function evaluateClientHalf(clientCode) {
  const traps = closureTraps();
  const parameters = [
    'React', 'console', 'styles', 'host', 'harness',
    ...Object.keys(traps),
    'process', 'Buffer',
  ];
  const closure = new Function(...parameters, `return (async () => {\n${clientCode}\n})()`);
  return closure(
    react,
    console,
    styles,
    hostStub,
    harnessTrap(),
    ...Object.values(traps),
    void 0,
    void 0,
  );
}

/** Run one probe: the code must `return` the evidence. */
async function probe(label, code) {
  const before = docReads;
  let outcome;
  try {
    outcome = { ok: true, value: await evaluateClientHalf(code) };
  } catch (error) {
    outcome = { ok: false, error: `${error.constructor.name}: ${error.message}` };
  }
  return { label, ...outcome, docReadsDelta: docReads - before };
}

// ---------------------------------------------------------------------------
// 3. The escape matrix.
// ---------------------------------------------------------------------------
const MATRIX = [
  ['A1 bare `document`',
    `return typeof document !== 'undefined' ? document.__tag : 'undefined';`],

  ['A2 bare `window`',
    `return typeof window !== 'undefined' ? (window === globalThis ? 'window===globalThis' : 'window') : 'undefined';`],

  ['A3 bare `globalThis.document`',
    `return globalThis.document ? globalThis.document.__tag : 'undefined';`],

  ['A4 computed `globalThis["doc"+"ument"]`',
    `return globalThis['doc' + 'ument'].__tag;`],

  ['A5 sloppy `this` in IIFE -> global',
    `return (function () { return this })() === globalThis ? 'this===globalThis' : 'other';`],

  ['A6 `this.document` via sloppy IIFE',
    `return (function () { return this.document.__tag })();`],

  ['A7 the async-wrapper `this` (called undefined)',
    `return this === undefined ? 'this===undefined (async arrow/strict)' : typeof this;`],

  ["A8 (function(){}).constructor('return document')()",
    `return (function () {}).constructor('return document')().__tag;`],

  ["A9 (async function(){}).constructor escape",
    `const F = Object.getPrototypeOf(async function () {}).constructor;
     return F('return document')().__tag;`],

  ["A10 (async()=>{}).constructor escape",
    `const F = (async () => {}).constructor;
     return F('return globalThis.document')().__tag;`],

  ['A11 Function.prototype.constructor direct',
    `return Function.prototype.constructor('return document')().__tag;`],

  ['A12 ({}).constructor.constructor escape',
    `return ({}).constructor.constructor('return document')().__tag;`],

  ['A13 (0).constructor.constructor escape',
    `return (0).constructor.constructor('return document')().__tag;`],

  ["A14 ('').constructor.constructor escape",
    `return ('').constructor.constructor('return document')().__tag;`],

  ['A15 Reflect.construct(Function,[...])',
    `return Reflect.construct(Function, ['return document'])().__tag;`],

  ['A16 eval direct (inherits new Function scope)',
    `return eval('document').__tag;`],

  ['A17 indirect eval (0,eval) -> global scope',
    `return (0, eval)('document').__tag;`],

  ['A18 indirect eval via globalThis.eval',
    `return globalThis.eval('document').__tag;`],

  ['T1 trap: bare `fetch` (shadowed) tries global',
    `return typeof fetch;`],

  ['T2 trap: `globalThis.fetch` bypasses shadow',
    `return typeof globalThis.fetch;`],

  ['T3 trap: `window.fetch` bypasses shadow',
    `return typeof window.fetch;`],

  ['T4 trap: `harness.anything` (Proxy get throws)',
    `try { harness.foo; return 'NO THROW'; } catch (e) { return 'threw: ' + e.message.slice(0, 40); }`],

  ['T5 trap: does the harness Proxy affect `globalThis`?',
    `return globalThis.document.__tag;`],

  ['T6 shadow is a plain parameter — reassignment',
    `fetch = () => 'replaced'; return fetch();`],

  ['T7 Proxy trap applied to globalThis (hypothetical)',
    `return typeof globalThis.document;`],

  ['X1 `process` shadow = undefined -> recover via Function',
    `const F = (function(){}).constructor; return typeof F('return process')();`],

  ['X2 `Buffer` shadow = undefined -> recover via Function',
    `const F = (function(){}).constructor; return typeof F('return Buffer')();`],

  ['X3 arguments.callee (strict async body -> TypeError?)',
    `try { return String((function(){ return arguments.callee })()); } catch (e) { return e.constructor.name + ': ' + e.message.slice(0,50); }`],

  ['X4 caller chain from a passed function',
    `function outer(){ return inner(); } function inner(){ return String(inner.caller && inner.caller.name); }
     try { return outer(); } catch (e) { return e.constructor.name; }`],

  ['X5 document via passed object reference (ownerDocument)',
    `const el = { ownerDocument: document }; // param-free route already used
     const h = { safe: { ownerDocument: globalThis.document } };
     return h.safe.ownerDocument.__tag;`],

  ['X6 `new (function(){}).constructor("return document")`',
    `return new ((function(){}).constructor)('return document')().__tag;`],

  ['X7 import() dynamic (SPEC: may be blocked by CSP)',
    `try { await import('data:text/javascript,export default 1'); return 'import OK'; }
     catch (e) { return e.constructor.name + ': ' + String(e.message).slice(0, 40); }`],
];

// ---------------------------------------------------------------------------
// 4. Run.
// ---------------------------------------------------------------------------
const rows = [];
for (const [label, code] of MATRIX) {
  // eslint-disable-next-line no-await-in-loop
  rows.push(await probe(label, code));
}

const pad = (s, n) => String(s).padEnd(n);
const width = Math.max(...rows.map((r) => r.label.length)) + 2;
console.log('\n=== new Function escape matrix (runner-shaped, Node) ===\n');
let pass = 0;
for (const r of rows) {
  const verdict = r.ok ? `REACHED  ${JSON.stringify(r.value)}` : `BLOCKED  ${r.error}`;
  if (r.ok) pass += 1;
  console.log(`${pad(r.label, width)}${verdict}`);
}
console.log(`\n${pass}/${rows.length} probes returned a value; ${rows.length - pass} threw.`);
console.log(`globalThis.document getter invocations during the run: ${docReads}`);

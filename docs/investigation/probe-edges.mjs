/**
 * probe-edges.mjs
 * ---------------------------------------------------------------------------
 * Four remaining objectively-measurable questions:
 *
 *  E1. Is the async function created by the runner strict or sloppy? Does
 *      `this` inside it bind to the global object?
 *  E2. Does the runner body opt into strict mode? (It does not — but does it
 *      matter? A strict body still reaches the global for FREE VARIABLES.)
 *  E3. Can a caller replace `window.globalThis` (or `window.document`) to
 *      install a denying Proxy in a normal page?
 *  E4. How many distinct objects in a normal page hand out `.ownerDocument`
 *      (the "no DOM but here is a DOM node" leak)?
 */

const pad = (s, n) => String(s).padEnd(n);

// ---------------------------------------------------------------------------
// E1 / E2 — strictness and `this`
// ---------------------------------------------------------------------------
console.log('\n=== E1: strictness of the constructed async function ===\n');

// Exactly the runner's shape.
const runnerShape = new Function('React', 'console', 'return this;');
console.log('  runner shape, `this` === globalThis :', runnerShape({}, console) === globalThis);

// Does adding 'use strict' change FREE-VARIABLE resolution? No.
const PAGE_DOC = { __tag: 'PAGE_DOC' };
Object.defineProperty(globalThis, 'document', { configurable: true, get: () => PAGE_DOC });

const strictBody = new Function('__S', `'use strict';
  const out = {};
  out.thisIsGlobal = (this === globalThis);
  out.nestedStrictThis = (function(){ 'use strict'; return this; })() === undefined;
  try { out.freeVarDocument = document.__tag; } catch (e) { out.freeVarDocument = 'REF-ERR'; }
  try { out.fnCtor = (function(){}).constructor('return document')().__tag; } catch (e) { out.fnCtor = 'REF-ERR'; }
  return out;`);
console.log('\n=== E2: strict body still resolves FREE VARIABLES globally ===\n');
const e2 = strictBody();
console.log('  in strict body, this === globalThis      :', e2.thisIsGlobal, '(false = strict this rules apply)');
console.log('  nested strict fn this === undefined      :', e2.nestedStrictThis);
console.log('  strict body free `document`              :', e2.freeVarDocument);
console.log('  strict body Function-ctor escape         :', e2.fnCtor);
console.log('  => strict mode changes `this`, NOT the [[Environment]] scope chain.');

// ---------------------------------------------------------------------------
// E3 — can a page replace window.globalThis / window.document?
// ---------------------------------------------------------------------------
console.log('\n=== E3: is `globalThis` / `window` replaceable in a normal page? ===\n');
const dGlobalThis = Object.getOwnPropertyDescriptor(globalThis, 'globalThis');
const dWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const dDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const fmt = (d) => d ? `{writable:${d.writable}, enumerable:${d.enumerable}, configurable:${d.configurable}, get:${typeof d.get}, set:${typeof d.set}, value:${typeof d.value}}` : '(absent)';
console.log('  globalThis descriptor :', fmt(dGlobalThis));
console.log('  window     descriptor :', dWindow ? `{get:${typeof dWindow.get}, set:${typeof dWindow.set}, configurable:${dWindow.configurable}}` : '(absent in Node)');
console.log('  document   descriptor : {configurable:' + (dDocument && dDocument.configurable) + ', get:' + typeof (dDocument && dDocument.get) + ', set:' + typeof (dDocument && dDocument.set) + '}');
console.log('  => In a browser, `window` is [Replaceable] and `document` is an accessor on Window.prototype;');
console.log('     but `globalThis` itself is {writable:true, enumerable:false, configurable:true}, and even');
console.log('     after `globalThis.globalThis = proxy`, bare `document` and `Function("return document")`');
console.log('     still resolve through the REAL global environment record. Name replacement is not enough.');

// Demonstrate: replace globalThis property, escape still works.
{
  const real = globalThis.globalThis;
  const denying = new Proxy({}, { get(_t, p) { throw new Error('denied ' + String(p)); } });
  // IMPORTANT: after swapping globalThis.globalThis, do not read it again from
  // inside this harness — every read goes through the denying proxy.
  Object.defineProperty(globalThis, 'globalThis', { configurable: true, writable: true, value: denying });
  let r;
  try {
    const probe = new Function('return (function () {' +
      'const out = {};' +
      'try { out.viaName = globalThis.document.__tag; } catch (e) { out.viaName = "blocked"; }' +
      'try { out.viaBare = document.__tag; } catch (e) { out.viaBare = "blocked"; }' +
      'try { out.viaFn = (function(){}).constructor("return document")().__tag; } catch (e) { out.viaFn = "blocked"; }' +
      'try { out.viaEval = (0,eval)("document").__tag; } catch (e) { out.viaEval = "blocked"; }' +
      'try { out.viaWin = window.document.__tag; } catch (e) { out.viaWin = "blocked"; }' +
      'return out; })()');
    r = probe();
  } catch (e) {
    r = { compileOrCall: 'threw ' + e.constructor.name + ': ' + e.message };
  } finally {
    Object.defineProperty(globalThis, 'globalThis', { configurable: true, writable: true, value: real });
  }
  console.log('\n  after replacing the `globalThis` property with a denying Proxy:');
  for (const [k, v] of Object.entries(r)) console.log('    ' + pad(k, 10) + v);
  console.log('  (restored the real globalThis afterwards)');
}

// ---------------------------------------------------------------------------
// E4 — ownerDocument leak surface
// ---------------------------------------------------------------------------
console.log('\n=== E4: `ownerDocument` is a universal DOM leak ===\n');
console.log('  Any passed DOM node exposes .ownerDocument -> the real document.');
console.log('  Any React element\'s ref / event target / Slot prop does this in one hop:');
console.log('    element.ownerDocument.defaultView   -> window');
console.log('    element.ownerDocument.body          -> live DOM');
console.log('    element.getRootNode()               -> Document or ShadowRoot');
console.log('  The runner passes `React`; any React element the package renders carries');
console.log('  a ref/target that is a DOM node. This path does not even need `document`.');

console.log('\nDone.');

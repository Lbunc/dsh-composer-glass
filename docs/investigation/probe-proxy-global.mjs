/**
 * probe-proxy-global.mjs
 * ---------------------------------------------------------------------------
 * The user's specific question (Q2, last bullet):
 *   "if the harness passes a Proxy whose get throws for unknown names,
 *    does that block globalThis.document?"
 *
 * The real runner passes its Proxy as the value of the `harness` PARAMETER.
 * That is a completely different thing from making the Proxy the GLOBAL OBJECT.
 * This file measures both, plus the genuinely interesting middle case: a
 * vm context whose sandbox object is a Proxy (so the realm's global object
 * really is proxied).
 */

import vm from 'node:vm';

const PAGE_DOCUMENT = { __tag: 'PAGE_DOCUMENT' };
Object.defineProperty(globalThis, 'document', {
  configurable: true, get() { return PAGE_DOCUMENT; },
});

const PROBES = {
  'bare document':             `document`,
  'globalThis.document':       `globalThis.document`,
  'this.document':             `(function(){ return this.document })()`,
  'Function ctor':             `(function(){}).constructor('return document')()`,
  'indirect eval':             `(0,eval)('document')`,
};

const pad = (s, n) => String(s).padEnd(n);
const tag = (v) => {
  if (v && v.__tag === 'PAGE_DOCUMENT') return 'REACHED PAGE DOCUMENT';
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (v && typeof v === 'object') return 'object<' + (v.constructor ? v.constructor.name : '?') + '>';
  return typeof v + ': ' + String(v);
};

// ===========================================================================
// CASE A — Proxy passed as a PARAMETER (this is what the runner actually does)
// ===========================================================================
console.log('\n=== CASE A: Proxy as the value of a *parameter* named `harness` ===');
console.log('(identical to dsh-cordis-client-runner lib/client.js:66-70 + :181)\n');
{
  const harnessProxy = new Proxy({}, {
    get(_t, prop) {
      throw new Error(`harness.${String(prop)} belongs to the HOST half.`);
    },
  });
  const f = new Function('harness', `return (__src__)`.replace('__src__', '(() => { try { return document } catch (e) { return "REF-ERR" } })()'));
  // read harness first, then document
  const g = new Function('harness',
    'let h; try { h = harness.anything; } catch (e) { h = "harness threw"; }' +
    'let d; try { d = document; } catch (e) { d = "REF-ERR"; }' +
    'return { h, d };');
  const out = g(harnessProxy);
  console.log('  harness.anything ->', out.h);
  console.log('  bare document    ->', tag(out.d));
  console.log('  VERDICT: the Proxy constrains ONLY its own property lookups.');
}

// ===========================================================================
// CASE B — Proxy as the GLOBAL OBJECT of a real realm (vm sandbox = Proxy)
// ===========================================================================
console.log('\n=== CASE B: Proxy installed as the realm GLOBAL OBJECT (vm sandbox) ===');
console.log('(the closest runnable analogue of "globalThis is a denying Proxy")\n');
{
  const denials = [];
  const handler = {
    has(_t, key) {
      denials.push('has:' + String(key));
      // Claim common globals so identifier lookup hits us and throws.
      return ['document', 'window', 'fetch', 'self', 'top', 'parent', 'frames', 'globalThis'].includes(String(key));
    },
    get(_t, key) {
      denials.push('get:' + String(key));
      if (String(key) === Symbol.unscopables || String(key) === 'then') return undefined;
      if (['document', 'window', 'fetch', 'self', 'top', 'parent', 'frames'].includes(String(key))) {
        throw new Error('denied: ' + String(key));
      }
      return _t[key];
    },
    getOwnPropertyDescriptor(_t, key) {
      // report the property as non-existent so `has`-based with-logic works
      return undefined;
    },
    set(_t, key, v) { _t[key] = v; return true; },
    defineProperty(_t, key, desc) { Object.defineProperty(_t, key, desc); return true; },
  };
  const backing = {};
  const proxyGlobal = new Proxy(backing, handler);
  let ctx;
  try {
    ctx = vm.createContext(proxyGlobal);
    console.log('  vm.createContext(Proxy) accepted.');
  } catch (e) {
    console.log('  vm.createContext(Proxy) REJECTED:', e.constructor.name + ': ' + e.message);
  }

  if (ctx) {
    for (const [name, src] of Object.entries(PROBES)) {
      let out;
      try {
        out = vm.runInContext('(function(){ try { return (' + src + ') } catch (e) { return "ERR:" + e.message.slice(0,30) } })()', ctx);
      } catch (e) {
        out = 'HOSTTHROW ' + e.constructor.name;
      }
      console.log('  ' + pad(name, 22) + (typeof out === 'string' && out.startsWith('ERR:') ? out : tag(out)));
    }
    console.log('  proxy trap invocations:', denials.length);
    console.log('  sample:', denials.slice(0, 8).join(', '));
  }
}

// ===========================================================================
// CASE C — the decisive control: what a Proxy CANNOT reach
// ===========================================================================
console.log('\n=== CASE C: control — closing the global off entirely (no document) ===');
{
  const ctx = vm.createContext({});
  for (const [name, src] of Object.entries(PROBES)) {
    let out;
    try {
      out = vm.runInContext('(function(){ try { return (' + src + ') } catch (e) { return "REF-ERR" } })()', ctx);
    } catch (e) { out = 'HOSTTHROW'; }
    console.log('  ' + pad(name, 22) + (out === 'REF-ERR' ? 'refused' : tag(out)));
  }
  console.log('  ^ this is what actually closing the boundary looks like.');
}

// ===========================================================================
// CASE D — same realm, but a Proxy used with `with` (no realm change)
// ===========================================================================
console.log('\n=== CASE D: same realm, Proxy used via with(proxy) claiming all names ===');
{
  const proxy = new Proxy({}, {
    has: () => true,
    get(_t, p) { throw new Error('denied ' + String(p)); },
  });
  for (const [name, src] of Object.entries(PROBES)) {
    let out;
    try {
      out = new Function('p', `with (p) { return (${src}); }`)(proxy);
    } catch (e) { out = 'THREW ' + e.constructor.name; }
    console.log('  ' + pad(name, 22) + tag(out));
  }
}
console.log('\nDone.');

/**
 * probe-realm.mjs
 * ---------------------------------------------------------------------------
 * Realm-safe escape probe.
 *
 * probe-containment.mjs compared results against the OUTER realm's globalThis,
 * which produces false positives as soon as the code runs in a different realm
 * (S5). This version answers a single binary question per probe:
 *
 *     "can the evaluated code obtain a value v such that v.__tag === 'PAGE_DOCUMENT'?"
 *
 * and, when it cannot, prints exactly what it did get, so nothing is hidden.
 *
 * It also measures the decisive containment question directly: does replacing
 * the GLOBAL OBJECT (not the parameter list) block every escape?
 */

// ---------------------------------------------------------------------------
// A page global to defend.
// ---------------------------------------------------------------------------
const PAGE_DOCUMENT = { __tag: 'PAGE_DOCUMENT' };

/** Probe source. Each must evaluate to either a tagged document or a descriptive string. */
const PROBES = {
  'bare document':             `(()=>{ try { return document } catch(e){ return 'REF-ERR' } })()`,
  'globalThis.document':       `(()=>{ try { return globalThis.document } catch(e){ return 'REF-ERR' } })()`,
  'globalThis["doc"+"ument"]': `(()=>{ try { return globalThis['doc'+'ument'] } catch(e){ return 'REF-ERR' } })()`,
  'sloppy this IIFE':          `(()=>{ try { return (function(){ return this })() } catch(e){ return 'REF-ERR' } })()`,
  'this.document':             `(()=>{ try { return (function(){ return this.document })() } catch(e){ return 'REF-ERR' } })()`,
  'Function ctor':             `(()=>{ try { return (function(){}).constructor('return document')() } catch(e){ return 'REF-ERR' } })()`,
  'Object ctor chain':         `(()=>{ try { return ({}).constructor.constructor('return globalThis.document')() } catch(e){ return 'REF-ERR' } })()`,
  'Reflect.construct':         `(()=>{ try { return Reflect.construct(Function, ['return globalThis.document'])() } catch(e){ return 'REF-ERR' } })()`,
  'indirect eval':             `(()=>{ try { return (0,eval)('globalThis.document') } catch(e){ return 'REF-ERR' } })()`,
  'globalThis.eval':           `(()=>{ try { return globalThis.eval('globalThis.document') } catch(e){ return 'REF-ERR' } })()`,
  'new Function this':         `(()=>{ try { return (new Function('return this'))() } catch(e){ return 'REF-ERR' } })()`,
  'ownerDocument from node':   `(()=>{ try { return __passedNode.ownerDocument } catch(e){ return 'REF-ERR' } })()`,
};

function classify(v) {
  if (v && v.__tag === 'PAGE_DOCUMENT') return 'REACHED';
  if (v === 'REF-ERR') return 'refused';
  if (v && typeof v === 'object' && v.__isGlobalObjectMarker) return 'a global obj (no doc)';
  if (typeof v === 'object' && v !== null) return 'object: ' + (v.constructor ? v.constructor.name : '?');
  return 'value: ' + String(v);
}

// ---------------------------------------------------------------------------
// Containment shapes.
// ---------------------------------------------------------------------------

/** Shape 1: parameter shadowing only (what the real runner does, plus extras). */
function paramShadowing(params, argFor) {
  return (src) => {
    const f = new Function(...params, `return (${src})`);
    return f(...params.map(argFor));
  };
}

/** Shape 2: run in a FRESH REALM/global whose global object has no document. */
async function freshGlobal(src) {
  const vm = await import('node:vm');
  // A global object that genuinely lacks `document`, but is otherwise normal.
  const ctx = vm.createContext({ __passedNode: { ownerDocument: null } });
  // NOTE: vm's global is a *host object*; cross-realm Function-ctor behavior is
  // subtle, so we report raw values rather than forcing a boolean.
  const f = vm.runInContext('(function(){ return (' + src + ') })', ctx);
  return f();
}

/** Shape 3: replace the global OBJECT but keep the same realm (Proxy on globalThis). */
function proxiedGlobal(src) {
  // A Proxy whose `has`/`get` traps deny everything not explicitly allowed.
  // Installing it as the global object is possible via vm only; here we test
  // the closest same-realm analogue: evaluating with `with` over a proxy that
  // claims every name (see probe-containment S3), PLUS denying globalThis.
  const denied = [];
  const shadow = new Proxy({}, {
    has: () => true,
    get(_t, p) { denied.push(String(p)); throw new Error('denied: ' + String(p)); },
  });
  const f = new Function('__shadow__', `with (__shadow__) { return (${src}); }`);
  return f(shadow);
}

// ---------------------------------------------------------------------------
// Runner-shaped parameter list (the real one).
// ---------------------------------------------------------------------------
const TRAP_NAMES = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'require'];
const PARAMS = ['React', 'console', 'styles', 'host', 'harness', ...TRAP_NAMES, 'process', 'Buffer'];
const ARG_FOR = (name) => (TRAP_NAMES.includes(name) ? () => { throw new Error('trap'); }
  : (name === 'process' || name === 'Buffer') ? undefined
  : name === 'harness' ? new Proxy({}, { get(_t, p) { throw new Error('harness.' + String(p)); } })
  : name === 'console' ? console : {});

const pad = (s, n) => String(s).padEnd(n);

// ---------------------------------------------------------------------------
// Measure: same realm, page global present (this is the real DSH situation).
// ---------------------------------------------------------------------------
Object.defineProperty(globalThis, 'document', {
  configurable: true, get() { return PAGE_DOCUMENT; },
});
globalThis.__passedNode = { ownerDocument: PAGE_DOCUMENT };

console.log('\n=== SHAPE 1: same realm, page global present, param shadowing only ===');
console.log('(this is exactly the DSH runner situation)\n');
const s1 = paramShadowing(PARAMS, ARG_FOR);
for (const [name, src] of Object.entries(PROBES)) {
  let out;
  try { out = s1(src); } catch (e) { out = 'THREW ' + e.message.slice(0, 40); }
  console.log('  ' + pad(name, 26) + classify(out));
}

// ---------------------------------------------------------------------------
// Plus a shadowed `document` parameter, to prove name-shadowing is useless.
// ---------------------------------------------------------------------------
console.log('\n=== SHAPE 1b: same realm, PLUS `document`/`window` shadow params ===');
{
  const poison = new Proxy({}, {
    get(_t, p) { if (p === 'then') return undefined; throw new Error('withheld'); },
  });
  const f = new Function('document', 'window', ...PARAMS, '__SRC__', 'return (__SRC__)');
  for (const [name, src] of Object.entries(PROBES)) {
    let out;
    try { out = f(poison, poison, ...PARAMS.map(ARG_FOR), src); }
    catch (e) { out = 'THREW ' + e.message.slice(0, 60); }
    console.log('  ' + pad(name, 26) + classify(out));
  }
}

// ---------------------------------------------------------------------------
// Shape 2: fresh global object with no document.
// ---------------------------------------------------------------------------
console.log('\n=== SHAPE 2: fresh vm global object, NO document defined ===');
for (const [name, src] of Object.entries(PROBES)) {
  let out;
  try { out = await freshGlobal(src); }
  catch (e) { out = 'THREW ' + e.constructor.name + ': ' + e.message.slice(0, 40); }
  console.log('  ' + pad(name, 26) + classify(out));
}

// ---------------------------------------------------------------------------
// Shape 3: `with(proxy)` denying every name (the strongest same-realm attempt).
// ---------------------------------------------------------------------------
console.log('\n=== SHAPE 3: same realm, with(Proxy that claims EVERY name) ===');
for (const [name, src] of Object.entries(PROBES)) {
  let out;
  try { out = proxiedGlobal(src); }
  catch (e) { out = 'THREW ' + e.constructor.name; }
  console.log('  ' + pad(name, 26) + classify(out));
}

console.log('\nDone.');

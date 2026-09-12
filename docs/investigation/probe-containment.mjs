/**
 * probe-contain.md / probe-containment.mjs
 * ---------------------------------------------------------------------------
 * Part 1 measured that the escape works. Part 2 asks the question that
 * actually matters for the verdict: WHICH containment strategy blocks WHICH
 * escape, and which strategies are defeated by `new Function`'s spec-defined
 * "global environment" scope chain?
 *
 * Each containment strategy is implemented as a function that takes the exact
 * runner parameter list and evaluates the same probe body.
 */

// ---------------------------------------------------------------------------
// Synthetic page global, as in probe-core.mjs.
// ---------------------------------------------------------------------------
const PAGE_DOCUMENT = { __tag: 'PAGE_DOCUMENT' };
const PAGE_WINDOW = globalThis;
Object.defineProperty(globalThis, 'document', {
  configurable: true, get() { return PAGE_DOCUMENT; },
});

// ---------------------------------------------------------------------------
// The escape probes, as source strings evaluated inside each containment.
// ---------------------------------------------------------------------------
const ESCAPES = {
  'bare document':            `typeof document !== 'undefined' && document.__tag === 'PAGE_DOCUMENT'`,
  'globalThis.document':      `globalThis.document && globalThis.document.__tag === 'PAGE_DOCUMENT'`,
  'globalThis["doc"+"ument"]':`globalThis['doc'+'ument'] && globalThis['doc'+'ument'].__tag === 'PAGE_DOCUMENT'`,
  'sloppy this IIFE':         `(function(){ return this })() === globalThis`,
  'Function ctor':            `(function(){}).constructor('return document')() === globalThis.document`,
  'Object ctor chain':        `({}).constructor.constructor('return globalThis.document')() === globalThis.document`,
  'Reflect.construct':        `Reflect.construct(Function, ['return globalThis.document'])() === globalThis.document`,
  'indirect eval':            `(0, eval)('globalThis.document') === globalThis.document`,
  'globalThis.eval':          `globalThis.eval('globalThis.document') === globalThis.document`,
  'new Function this=global': `(new Function('return this'))() === globalThis`,
};

// ---------------------------------------------------------------------------
// Containment strategies.
// ---------------------------------------------------------------------------

/** S0 — the real runner: named params only, no document/window/fetch. */
function strategyRunner(params, argFor) {
  return (code) => {
    const f = new Function(...params, `return (${code})`);
    return f(...params.map(argFor));
  };
}

/** S1 — also pass a `document` parameter that is a throwing proxy/stub. */
function strategyShadowDocument(params, argFor) {
  const throwingDocument = new Proxy({}, {
    get(_t, p) { if (p === 'then') return undefined; throw new Error('document is withheld'); },
  });
  const p2 = ['document', ...params];
  return (code) => {
    const f = new Function(...p2, `return (${code})`);
    return f(throwingDocument, ...params.map(argFor));
  };
}

/** S2 — shadow document AND window AND globalThis as poisoning params. */
function strategyShadowAll(params, argFor) {
  const poison = (name) => new Proxy({}, {
    get(_t, p) { if (p === 'then') return undefined; throw new Error(name + ' is withheld'); },
  });
  const p2 = ['document', 'window', 'globalThis', ...params];
  return (code) => {
    const f = new Function(...p2, `return (${code})`);
    return f(poison('document'), poison('window'), poison('globalThis'), ...params.map(argFor));
  };
}

/** S3 — wrap the body in a `with` block bound to a shadowing scope object. */
function strategyWithBlock(params, argFor) {
  return (code) => {
    const shadow = new Proxy({}, {
      has() { return true; },                       // claim EVERY name
      get(_t, p) { throw new Error(`with: ${String(p)} withheld`); },
    });
    const f = new Function(...params, '__shadow__', `with (__shadow__) { return (${code}); }`);
    return f(...params.map(argFor), shadow);
  };
}

/** S4 — strict-mode body and strict-mode call: does `this` stop being global? */
function strategyStrictBody(params, argFor) {
  return (code) => {
    const f = new Function(...params, `'use strict';\nreturn (${code})`);
    return f(...params.map(argFor));
  };
}

/** S5 — run inside a vm context whose global has NO document (true isolation). */
async function runInIsolatedContext(code) {
  const vm = await import('node:vm');
  const ctx = vm.createContext({});   // no document at all
  const f = vm.runInContext('(function(){ return (' + code + ') })', ctx);
  return f();
}

// ---------------------------------------------------------------------------
// Build the runner-shaped parameter list.
// ---------------------------------------------------------------------------
const TRAP_NAMES = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'require'];
const PARAMS = ['React', 'console', 'styles', 'host', 'harness', ...TRAP_NAMES, 'process', 'Buffer'];
const ARG_FOR = (name) => (TRAP_NAMES.includes(name) ? () => { throw new Error('trap'); }
  : name === 'process' || name === 'Buffer' ? undefined
  : name === 'harness' ? new Proxy({}, { get(_t, p) { throw new Error('harness.' + String(p)); } })
  : name === 'console' ? console
  : {});

const STRATEGIES = [
  ['S0 runner (named params only)',        strategyRunner(PARAMS, ARG_FOR)],
  ['S1 + document param (throwing)',       strategyShadowDocument(PARAMS, ARG_FOR)],
  ['S2 + document/window/globalThis params', strategyShadowAll(PARAMS, ARG_FOR)],
  ['S3 body wrapped in with(shadow)',      strategyWithBlock(PARAMS, ARG_FOR)],
  ['S4 strict-mode body',                  strategyStrictBody(PARAMS, ARG_FOR)],
];

// ---------------------------------------------------------------------------
// Run: escape x strategy grid.
// ---------------------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const escapeNames = Object.keys(ESCAPES);

console.log('\n=== ESCAPE x CONTAINMENT grid (Y = escape reached the page document) ===\n');
console.log(pad('escape', 27) + STRATEGIES.map(([n]) => pad(n.slice(0, 18), 20)).join(''));
console.log('-'.repeat(27 + 20 * STRATEGIES.length));

for (const en of escapeNames) {
  const cells = [];
  for (const [, run] of STRATEGIES) {
    let mark;
    try {
      mark = run(ESCAPES[en]) === true ? 'Y' : 'n/value';
    } catch {
      mark = '.blocked';
    }
    cells.push(pad(mark, 20));
  }
  console.log(pad(en, 27) + cells.join(''));
}

// S5 needs async, so run it separately.
console.log('\n=== S5: vm context with NO document global (true isolation reference) ===\n');
for (const en of escapeNames) {
  let r;
  try {
    r = await runInIsolatedContext(ESCAPES[en]);
    r = r === true ? 'Y (!!)' : 'n/value';
  } catch (e) {
    r = '.blocked (' + e.constructor.name + ')';
  }
  console.log(pad(en, 27) + r);
}

// ---------------------------------------------------------------------------
// The decisive extra: even with document shadowed as a PARAMETER, does the
// Function constructor still reach the global document?
// ---------------------------------------------------------------------------
console.log('\n=== decisive: shadowed `document` param vs Function-ctor re-entry ===\n');
{
  const throwingDocument = new Proxy({}, {
    get(_t, p) { if (p === 'then') return undefined; throw new Error('document is withheld'); },
  });
  const f = new Function('document', 'window', 'globalThis', 'console',
    `'use strict';
     const out = {};
     try { out.bare = document.__tag; } catch (e) { out.bare = 'THREW'; }
     try { out.gt = globalThis.document.__tag; } catch (e) { out.gt = 'THREW'; }
     try { out.fn = (function(){}).constructor('return document')().__tag; } catch (e) { out.fn = 'THREW'; }
     try { out.fnStrict = (function(){'use strict'; return (function(){}).constructor('return globalThis.document')()})().__tag; } catch (e) { out.fnStrict = 'THREW'; }
     try { out.indirectEval = (0,eval)('document').__tag; } catch (e) { out.indirectEval = 'THREW'; }
     return out;`);
  console.log(JSON.stringify(f(throwingDocument, throwingDocument, throwingDocument, console), null, 2));
  console.log('\nInterpretation: shadowing the NAMES cannot shadow the global environment.');
}

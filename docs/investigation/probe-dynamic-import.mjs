/**
 * probe-dynamic-import.mjs
 * ---------------------------------------------------------------------------
 * Question: does `import()` work inside the evaluated code, in a context that
 * has no `require` and no module record — i.e. is the Function-constructor
 * escape of the `require` trap still able to pull in modules?
 *
 * Measured in Node via vm.SourceTextModule (an actual ES module record), with
 * --experimental-vm-modules. This DOES reflect the browser case for the part
 * that matters: `import()` in a non-module script always consults the
 * host-defined "import()" callback (spec: HostImportModuleDynamically), so CSP
 * may forbid it, but nothing about the Function-constructor sandbox does.
 */

import vm from 'node:vm';

const context = vm.createContext({
  console,
  // No `require`, no `process`, no `Buffer` — deliberately empty sandbox.
});

// A Function-constructor escape inside a real module record, reaching for import().
const moduleSource = `
const F = (function () {}).constructor;
// 1. can the Function ctor itself escape into the module's import()?
try {
  const fn = F('return import');
  const imp = fn();
  console.log('M1 typeof import via Function ctor :', typeof imp);
  if (typeof imp === 'function') {
    const m = await imp('node:path');
    console.log('M2 import("node:path") via escape : OK, keys=', Object.keys(m).length);
  }
} catch (e) {
  console.log('M1/M2 threw:', e.constructor.name + ': ' + e.message);
}

// 2. direct dynamic import in module scope (baseline)
try {
  const m = await import('node:os');
  console.log('M3 direct import("node:os")       : OK, keys=', Object.keys(m).length);
} catch (e) {
  console.log('M3 threw:', e.constructor.name + ': ' + e.message);
}

// 3. can plain script (non-module) eval reach import()? spec says syntax error
try {
  const r = F('return typeof import')();
  console.log('M4 Function ctor "typeof import"    :', r);
} catch (e) {
  console.log('M4 threw:', e.constructor.name + ': ' + e.message.slice(0, 60));
}
`;

const mod = new vm.SourceTextModule(moduleSource, { context });
await mod.link(() => { throw new Error('no imports expected'); });
try {
  await mod.evaluate();
} catch (e) {
  console.log('module evaluate threw:', e.constructor.name + ': ' + e.message);
}

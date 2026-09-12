/**
 * exec-html-script.mjs
 * ---------------------------------------------------------------------------
 * Runs the inline <script> of an HTML artifact under a minimal DOM shim.
 *
 * This is NOT a browser. It exists to catch runtime errors in the page's own
 * DOM-manipulation / reporting code (the part that is not under investigation),
 * so the artifact cannot be silently blank when the user double-clicks it.
 * The security-relevant measurement inside it is `new Function`, which behaves
 * identically here and in a browser.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
const html = readFileSync(file, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no inline <script>'); process.exit(1); }

// ---- minimal DOM shim ------------------------------------------------------
const made = [];
function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    style: { cssText: '' },
    dataset: {},
    id: '',
    className: '',
    _text: '',
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    set innerHTML(v) { this._html = String(v); },
    get innerHTML() { return this._html || ''; },
    appendChild(c) { this.children.push(c); made.push(c); return c; },
    append(...cs) { cs.forEach((c) => this.children.push(c)); },
    after(...nodes) {
      const parent = this.parentNode;
      const flat = nodes.flat();
      if (parent) {
        const i = parent.children.indexOf(this);
        parent.children.splice(i + 1, 0, ...flat);
      }
      flat.forEach((n) => made.push(n));
    },
    remove() {},
    getElementById() { return null; },
    querySelector() { return null; },
  };
  return el;
}

const body = makeEl('body');
const head = makeEl('head');
const pageTitle = { _t: '', set textContent(v) { this._t = String(v); }, get textContent() { return this._t; } };
const realDocument = {
  __tag: 'PAGE_DOCUMENT',
  body,
  head,
  title: 'init',
  createElement: (t) => makeEl(t),
  getElementById(id) {
    const walk = (n) => {
      for (const c of n.children || []) {
        if (c.id === id) return c;
        const r = walk(c); if (r) return r;
      }
      return null;
    };
    return walk(body);
  },
  querySelector: () => null,
};

// pre-create the two elements the page looks up
const uaEl = makeEl('p'); uaEl.id = 'ua'; body.appendChild(uaEl);
const verdictEl = makeEl('div'); verdictEl.id = 'verdict'; body.appendChild(verdictEl);

const sandbox = {
  console,
  document: realDocument,
  window: null,
  navigator: { userAgent: 'SHIM (not a real browser)' },
  Promise, Object, Array, String, Number, Boolean, Error, TypeError, Symbol,
  Reflect, Proxy, JSON, Math, Date, RegExp, Map, Set, WeakMap,
  setTimeout, clearTimeout,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
Object.defineProperty(sandbox, 'document', { configurable: true, get: () => realDocument });

vm.createContext(sandbox);

try {
  vm.runInContext(m[1], sandbox, { filename: file });
} catch (e) {
  console.error(`RUNTIME ERROR in ${file}: ${e.constructor.name}: ${e.message}`);
  console.error(e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

// main() is async; let microtasks drain.
await new Promise((r) => setTimeout(r, 50));

console.log(`OK: ${file} executed under DOM shim without throwing.`);
console.log(`    document.title -> ${JSON.stringify(sandbox.document.title)}`);
console.log(`    elements created/mounted: ${made.length}`);
const verdictText = (verdictEl.innerHTML || verdictEl.textContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log(`    #verdict text  -> ${verdictText.slice(0, 200)}`);
const tables = [];
(function collect(n) { for (const c of n.children || []) { if (c.tagName === 'TABLE') tables.push(c); collect(c); } })(body);
console.log(`    tables rendered: ${tables.length} (each takes <tr> rows via innerHTML, not shimmed)`);

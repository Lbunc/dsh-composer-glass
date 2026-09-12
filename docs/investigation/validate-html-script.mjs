/**
 * validate-html-script.mjs
 * Extracts the <script> body from an HTML file and syntax-checks it.
 * Catches typos that would make the browser artifact silently blank.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
if (!file) { console.error('usage: node validate-html-script.mjs <file.html>'); process.exit(2); }

const html = readFileSync(file, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no inline <script> found'); process.exit(1); }

const src = m[1];
try {
  new vm.Script(src, { filename: file });
  console.log(`OK: inline script parses (${src.length} chars) in ${file}`);
} catch (e) {
  console.error(`PARSE ERROR in ${file}: ${e.constructor.name}: ${e.message}`);
  process.exit(1);
}

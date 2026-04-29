/**
 * Recompute node positions for every graphs/<slug>/graph.json using the same
 * algorithm as editing-mode auto layout, then refresh data.js when present.
 *
 * Usage: node tools/relayout-all-bundled-graphs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { layoutBundledProject } from './bundled-auto-layout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const graphsDir = path.join(ROOT, 'graphs');

function writeBundledPair(dir, laid) {
  const json = JSON.stringify(laid) + '\n';
  fs.writeFileSync(path.join(dir, 'graph.json'), json, 'utf8');
  const dataJs =
    '// Bundled project — keep in sync with graph.json (file:// fallback).\n' +
    'window.PROJECT = ' +
    JSON.stringify(laid) +
    ';\n';
  fs.writeFileSync(path.join(dir, 'data.js'), dataJs, 'utf8');
}

for (const slug of fs.readdirSync(graphsDir)) {
  const dir = path.join(graphsDir, slug);
  if (!fs.statSync(dir).isDirectory()) continue;
  const gj = path.join(dir, 'graph.json');
  if (!fs.existsSync(gj)) continue;
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(gj, 'utf8'));
  } catch (e) {
    console.warn('skip (invalid json)', slug, e.message);
    continue;
  }
  if (!spec || !Array.isArray(spec.nodes)) continue;
  const laid = layoutBundledProject(spec);
  writeBundledPair(dir, laid);
  console.log('relayout', slug, laid.nodes.length, 'nodes', laid.canvasWidth, '×', laid.canvasHeight);
}

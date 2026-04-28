#!/usr/bin/env node
/**
 * One-off / CI: read graphs/<slug>/data.js (window.PROJECT), write graph.json + graphs/catalog.json
 *
 *   node scripts/export-graph-json.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const graphsDir = path.join(root, 'graphs');

const slugs = fs
  .readdirSync(graphsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => fs.existsSync(path.join(graphsDir, name, 'data.js')));

const catalog = { version: 1, graphs: [] };

for (const slug of slugs) {
  const dataJs = path.join(graphsDir, slug, 'data.js');
  const code = fs.readFileSync(dataJs, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const P = sandbox.window.PROJECT;
  if (!P) {
    console.warn('skip (no window.PROJECT):', slug);
    continue;
  }
  const outJson = path.join(graphsDir, slug, 'graph.json');
  fs.writeFileSync(outJson, JSON.stringify(P) + '\n');
  catalog.graphs.push({
    slug: P.slug || slug,
    title: P.title || slug,
    nodeCount: Array.isArray(P.nodes) ? P.nodes.length : 0,
    document: 'graph.json',
  });
  console.log('wrote', path.relative(root, outJson), 'nodes', P.nodes?.length ?? 0);
}

const catalogPath = path.join(graphsDir, 'catalog.json');
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log('wrote', path.relative(root, catalogPath), 'entries', catalog.graphs.length);

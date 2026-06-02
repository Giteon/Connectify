/* custom-node-detect.js — lightweight, client-side schema inference for
   custom nodes. The user picks a KIND first (model/dataset/logic/endpoint),
   then uploads a file; we read just enough of it to infer typed input/output
   ports, then discard the bytes (metadata-only storage).

   Public API:
     window.CustomNodeDetect.inferPorts(kind, file)
       → Promise<{ inputs:[{name,type}], outputs:[{name,type}], detail:string }>

   Port `type` values use the same semantic vocabulary as canvas-new.js's
   ADAPTOR_MAP / typePill (e.g. 'float','int','string','bool','tensor','json',
   'date','any') so inferred ports slot straight into the type system. */
(function (global) {
  'use strict';

  // ── File helpers ────────────────────────────────────────────
  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function readText(file, maxBytes) {
    return new Promise((resolve, reject) => {
      const blob = maxBytes ? file.slice(0, maxBytes) : file;
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('read failed'));
      r.readAsText(blob);
    });
  }

  // ── Type guessing ───────────────────────────────────────────
  // Infer a semantic type from a single sampled string value (CSV/JSON cell).
  function guessType(v) {
    if (v == null) return 'string';
    const s = String(v).trim();
    if (s === '') return 'string';
    if (/^-?\d+$/.test(s)) return 'int';
    if (/^-?(\d+\.\d*|\.\d+|\d+)(e-?\d+)?$/i.test(s) && /[.e]/i.test(s)) return 'float';
    if (/^(true|false)$/i.test(s)) return 'bool';
    if (/^\d{4}-\d{2}-\d{2}([ t]\d{2}:\d{2})?/i.test(s)) return 'date';
    return 'string';
  }
  // Map a Python type annotation to our semantic vocabulary.
  function mapPyType(t) {
    const k = String(t || '').toLowerCase().replace(/.*\./, '');
    return {
      int: 'int', float: 'float', str: 'string', bool: 'bool',
      bytes: 'string', list: 'json', dict: 'json', tuple: 'json',
      tensor: 'tensor', ndarray: 'tensor', dataframe: 'json',
    }[k] || 'any';
  }
  function jsonType(v) {
    if (v === null) return 'string';
    if (Array.isArray(v)) return 'json';
    switch (typeof v) {
      case 'number': return Number.isInteger(v) ? 'int' : 'float';
      case 'boolean': return 'bool';
      case 'object': return 'json';
      default: return 'string';
    }
  }

  // ── CSV ─────────────────────────────────────────────────────
  // Minimal RFC-4180-ish single-line splitter (handles quoted fields/commas).
  function splitCsvLine(line, sep) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === sep) {
        out.push(cur); cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }
  async function detectCsv(file, sep) {
    const text = await readText(file, 64 * 1024);
    const lines = text.split(/\r?\n/).filter(l => l.length);
    if (!lines.length) return { inputs: [], outputs: [], detail: 'empty file' };
    const headers = splitCsvLine(lines[0], sep);
    const sample = lines[1] ? splitCsvLine(lines[1], sep) : [];
    const outputs = headers.map((h, i) => ({
      name: h || ('column ' + (i + 1)),
      type: guessType(sample[i]),
    }));
    const rowNote = lines.length > 1 ? `${lines.length - 1}+ rows sampled` : 'header only';
    return { inputs: [], outputs, detail: `${headers.length} columns · ${rowNote}` };
  }

  // ── JSON ────────────────────────────────────────────────────
  async function detectJson(file, kind) {
    const text = await readText(file, 128 * 1024);
    let data;
    try { data = JSON.parse(text); }
    catch (_) {
      // Truncated read (large file) — fall back to generic ports.
      return kind === 'dataset'
        ? { inputs: [], outputs: [{ name: 'records', type: 'json' }], detail: 'JSON (too large to fully parse)' }
        : { inputs: [{ name: 'input', type: 'json' }], outputs: [{ name: 'output', type: 'json' }], detail: 'JSON' };
    }
    // Dataset shaped as array-of-objects → columns from first row's keys.
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const ports = Object.keys(row).map(k => ({ name: k, type: jsonType(row[k]) }));
      const count = Array.isArray(data) ? `${data.length} records` : 'object';
      if (kind === 'dataset') return { inputs: [], outputs: ports, detail: `${ports.length} fields · ${count}` };
      return { inputs: ports, outputs: [{ name: 'output', type: 'json' }], detail: `${ports.length} fields` };
    }
    return { inputs: [], outputs: [{ name: 'data', type: 'json' }], detail: 'JSON' };
  }

  // ── Per-kind detectors ──────────────────────────────────────
  async function detectDataset(file) {
    const ext = extOf(file.name);
    if (ext === 'json') return detectJson(file, 'dataset');
    if (ext === 'tsv') return detectCsv(file, '\t');
    if (ext === 'csv' || ext === 'txt' || ext === '') return detectCsv(file, ',');
    // Binary/opaque dataset (parquet, npz, images, etc.) — one generic output.
    return { inputs: [], outputs: [{ name: 'data', type: ext || 'binary' }], detail: `${(ext || 'binary').toUpperCase()} file` };
  }
  async function detectModel(file) {
    const ext = extOf(file.name);
    if (ext === 'json') {
      // A model config — try to read declared input/output shapes.
      try {
        const cfg = JSON.parse(await readText(file, 64 * 1024));
        const ins = cfg.inputs || cfg.input_shape || cfg.input;
        const outs = cfg.outputs || cfg.output_shape || cfg.output;
        if (ins || outs) {
          return {
            inputs: [{ name: 'input', type: 'tensor' }],
            outputs: [{ name: 'output', type: 'tensor' }],
            detail: 'model config (declared I/O)',
          };
        }
      } catch (_) { /* fall through */ }
    }
    const label = {
      pt: 'PyTorch', pth: 'PyTorch', onnx: 'ONNX', h5: 'Keras/HDF5',
      pb: 'TensorFlow', safetensors: 'SafeTensors', gguf: 'GGUF', bin: 'weights',
    }[ext] || (ext ? ext.toUpperCase() : 'model');
    return {
      inputs: [{ name: 'input', type: 'tensor' }],
      outputs: [{ name: 'output', type: 'tensor' }],
      detail: `${label} weights`,
    };
  }
  async function detectLogic(file) {
    const ext = extOf(file.name);
    if (ext && ext !== 'py' && ext !== 'txt' && ext !== 'js') {
      return { inputs: [{ name: 'input', type: 'any' }], outputs: [{ name: 'output', type: 'any' }], detail: `${ext.toUpperCase()} script` };
    }
    const text = await readText(file, 64 * 1024);
    // First top-level Python function signature → params in, result out.
    const m = /^def\s+(\w+)\s*\(([^)]*)\)\s*(->\s*([\w.\[\]]+))?/m.exec(text);
    if (m) {
      const fnName = m[1];
      const inputs = m[2]
        .split(',').map(s => s.trim()).filter(Boolean)
        .filter(p => p !== 'self' && p !== 'cls' && !p.startsWith('*'))
        .map(p => {
          const name = p.split(/[:=]/)[0].trim();
          const ann = /:\s*([\w.\[\]]+)/.exec(p);
          return { name, type: ann ? mapPyType(ann[1]) : 'any' };
        });
      const retType = m[4] ? mapPyType(m[4]) : 'any';
      return {
        inputs: inputs.length ? inputs : [{ name: 'input', type: 'any' }],
        outputs: [{ name: fnName + ' result', type: retType }],
        detail: `def ${fnName}(${inputs.map(i => i.name).join(', ')})`,
      };
    }
    return { inputs: [{ name: 'input', type: 'any' }], outputs: [{ name: 'output', type: 'any' }], detail: 'no function signature found' };
  }
  async function detectEndpoint(file) {
    const ext = extOf(file.name);
    if (ext === 'json') {
      // OpenAPI / schema-ish — surface request/response as JSON for now.
      return { inputs: [{ name: 'request', type: 'json' }], outputs: [{ name: 'response', type: 'json' }], detail: 'API schema (JSON)' };
    }
    return { inputs: [{ name: 'request', type: 'json' }], outputs: [{ name: 'response', type: 'json' }], detail: 'HTTP endpoint' };
  }

  // ── Public entry point ──────────────────────────────────────
  async function inferPorts(kind, file) {
    if (!file) return null;
    try {
      switch (kind) {
        case 'dataset': return await detectDataset(file);
        case 'model': return await detectModel(file);
        case 'logic': return await detectLogic(file);
        case 'endpoint': return await detectEndpoint(file);
        default: return await detectDataset(file);
      }
    } catch (e) {
      return { inputs: [], outputs: [], detail: 'could not read file', error: String(e) };
    }
  }

  // Sensible default ports when no file is provided for a kind.
  function defaultPorts(kind) {
    switch (kind) {
      case 'dataset': return { inputs: [], outputs: [{ name: 'data', type: 'json' }], detail: '' };
      case 'model': return { inputs: [{ name: 'input', type: 'tensor' }], outputs: [{ name: 'output', type: 'tensor' }], detail: '' };
      case 'logic': return { inputs: [{ name: 'input', type: 'any' }], outputs: [{ name: 'output', type: 'any' }], detail: '' };
      case 'endpoint': return { inputs: [{ name: 'request', type: 'json' }], outputs: [{ name: 'response', type: 'json' }], detail: '' };
      default: return { inputs: [{ name: 'input', type: 'any' }], outputs: [{ name: 'output', type: 'any' }], detail: '' };
    }
  }

  global.CustomNodeDetect = { inferPorts, defaultPorts };
})(window);

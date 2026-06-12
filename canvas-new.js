/**
 * Shared canvas module for ConnectifyAI.
 *
 * Owns a single source of truth for card objects across editing and view
 * modes. Nodes and their DOM / SVG overlay are kept together in `nodeState`
 * and mutated via a small CRUD API (addNode / removeNode / renderNode /
 * addConnection / removeConnection).
 *
 * Mode-specific capabilities (future: add/remove cards, drag-to-connect,
 * port editing) should be gated on `opts.editable`, which is set at init.
 */
window.Canvas = (function () {
  'use strict';

  // ── Constants + visual assets ────────────────────────
  const SVG_NS = 'http://www.w3.org/2000/svg';
  /** Edit mode: back (15005) draws blurred under-pass for member edges + all low edges.
   *  Front draws sharp member edges and must sit above subgroup shells (expanded + collapsed)
   *  so in-group connections stay visible while still using subgroup masking. */
  const Z_EDGE_BACK = 15005;
  const Z_EDGE_FRONT = 15240;
  const Z_NODE_BASE = 15100;
  const Z_NODE_RENORM_CEIL = 15240;
  const ICONS = {
    Dataset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></svg>`,
    Model:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16.008v-8.018a1.98 1.98 0 0 0 -1 -1.717l-7 -4.008a2.016 2.016 0 0 0 -2 0l-7 4.008c-.619 .355 -1 1.01 -1 1.718v8.018c0 .709 .381 1.363 1 1.717l7 4.008a2.016 2.016 0 0 0 2 0l7 -4.008c.619 -.355 1 -1.01 1 -1.718"/><path d="M12 22v-10"/><path d="M12 12l8.73 -5.04"/><path d="M3.27 6.96l8.73 5.04"/></svg>`,
    Logic:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 10h16M10 4v16"/></svg>`
  };
  const CARET     = `<svg class="caret" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4.5L6 8L9 4.5z"/></svg>`;
  const ARROW_IN  = `<svg class="dir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>`;
  const ARROW_OUT = `<svg class="dir-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>`;

  function typePill(type) {
    const LABELS = {
      string:'String', jpg:'JPG',   png:'PNG',   binary:'Binary', float:'Float',
      text:'Text',     image:'Image', audio:'Audio', lbl:'Label',     bbox:'BBox',
      id:'ID',         video:'Video', float32:'Float32',
      tensor:'Tensor', logits:'Logits', embedding:'Embedding', spectrogram:'Spectrogram',
      point_cloud:'Point cloud', adjacency:'Adjacency', spike:'Spike',
    };
    const raw = (type || '').toLowerCase();
    const key = raw === 'label' ? 'lbl' : raw;   // avoid clash with .type-label header class
    return `<span class="type-pill type-${key}">${LABELS[key] || raw.toUpperCase()}</span>`;
  }
  // ── Adaptor table ────────────────────────────────────
  // Curated set of known type→type bridges. Keeping the table hand-authored
  // (rather than inferring from names) gives us human-readable chip labels
  // and lets us refuse absurd conversions (e.g. audio→float) instead of
  // silently lying about what's possible. Direction matters: an entry is
  // one-way unless a mirror entry is also declared.
  const ADAPTOR_MAP = (function () {
    const codecParams = [
      { key: 'quality', label: 'Quality', type: 'range', min: 60, max: 100, step: 1 },
      {
        key: 'colorspace', label: 'Colorspace', type: 'select',
        options: [
          { value: 'sRGB', label: 'sRGB' },
          { value: 'display-p3', label: 'Display P3' },
          { value: 'rec709', label: 'Rec. 709' },
        ],
      },
      {
        key: 'resample', label: 'Resampling', type: 'select',
        options: [
          { value: 'lanczos3', label: 'Lanczos' },
          { value: 'bicubic', label: 'Bicubic' },
          { value: 'box', label: 'Box' },
        ],
      },
    ];
    const codecDefaults = { quality: 92, colorspace: 'sRGB', resample: 'lanczos3' };
    const raw = [
      {
        from: 'jpg', to: 'png', label: 'JPG→PNG',
        desc: 'Re-encodes the JPG bytes as a PNG. Lossless recompression; file size can grow slightly depending on quality and resampling.',
        defaultSettings: { ...codecDefaults },
        params: codecParams,
        preview: (s) => {
          const q = s?.quality ?? codecDefaults.quality;
          const pct = q >= 95 ? '+4% size' : '+12% size';
          return `JPG 1920×1080 → PNG 1920×1080, ${pct}`;
        },
      },
      {
        from: 'png', to: 'jpg', label: 'PNG→JPG',
        desc: 'Re-encodes PNG bytes as JPG. Lossy; drops alpha channel if present.',
        defaultSettings: { quality: 88, colorspace: 'sRGB', resample: 'lanczos3' },
        params: codecParams,
        preview: (s) => {
          const q = s?.quality ?? 88;
          const pct = q >= 92 ? '−18% size' : '−32% size';
          return `PNG 1920×1080 → JPG 1920×1080, ${pct}`;
        },
      },
      {
        from: 'image', to: 'jpg', label: 'Image→JPG',
        desc: 'Exports the generic image tensor as a JPG file.',
        defaultSettings: { ...codecDefaults, quality: 90 },
        params: codecParams,
        preview: (s) => `Image tensor 1920×1080 RGB → JPG file, ${(s?.quality ?? 90) >= 93 ? '−8% size' : '−22% size'}`,
      },
      {
        from: 'image', to: 'png', label: 'Image→PNG',
        desc: 'Exports the generic image tensor as a PNG file.',
        defaultSettings: { ...codecDefaults },
        params: codecParams,
        preview: (s) => `Image tensor 1920×1080 RGB → PNG file, ${(s?.quality ?? 92) >= 95 ? '+2% size' : '+9% size'}`,
      },
      {
        from: 'jpg', to: 'image', label: 'JPG→Image',
        desc: 'Decodes JPG bytes into an image tensor.',
        defaultSettings: { ...codecDefaults },
        params: codecParams,
        preview: (s) => `JPG file 2.4 MB → float image [1×3×1080×1920], ${s?.colorspace || 'sRGB'} decode`,
      },
      {
        from: 'png', to: 'image', label: 'PNG→Image',
        desc: 'Decodes PNG bytes into an image tensor.',
        defaultSettings: { ...codecDefaults },
        params: codecParams,
        preview: (s) => `PNG file 1.1 MB → float image [1×4×1080×1920] (alpha kept), ${s?.colorspace || 'sRGB'}`,
      },
      { from: 'jpg', to: 'binary', label: 'JPG→Binary', desc: 'Passes raw JPG bytes downstream as a binary blob.', preview: () => 'JPG container 2.4 MB → identical binary blob 2.4 MB' },
      { from: 'png', to: 'binary', label: 'PNG→Binary', desc: 'Passes raw PNG bytes downstream as a binary blob.', preview: () => 'PNG container 1.1 MB → identical binary blob 1.1 MB' },
      {
        from: 'binary', to: 'float', label: 'Binary→Float',
        desc: 'Interprets the binary payload as a float tensor.',
        defaultSettings: { endian: 'le', dtype: 'f32' },
        params: [
          { key: 'endian', label: 'Endianness', type: 'select', options: [{ value: 'le', label: 'Little-endian' }, { value: 'be', label: 'Big-endian' }] },
          { key: 'dtype', label: 'DType', type: 'select', options: [{ value: 'f32', label: 'float32' }, { value: 'f64', label: 'float64' }] },
        ],
        preview: (s) => `Binary blob 2.1 MB → float tensor [1×512], ${String(s?.dtype || 'f32').toUpperCase()} · ${s?.endian === 'be' ? 'BE' : 'LE'}`,
      },
      { from: 'float', to: 'float32', label: 'Float→F32', desc: 'Casts float values to 32-bit precision.', preview: () => 'Float tensor [1024] → float32 tensor [1024], same shape' },
      { from: 'float32', to: 'float', label: 'F32→Float', desc: 'Promotes 32-bit floats to the generic float type.', preview: () => 'float32 tensor [1024] → float tensor [1024], same shape' },
      {
        from: 'float', to: 'string', label: 'Float→Str',
        desc: 'Formats float values as strings.',
        defaultSettings: { decimals: 4, notation: 'plain' },
        params: [
          { key: 'decimals', label: 'Decimals', type: 'range', min: 0, max: 8, step: 1 },
          {
            key: 'notation', label: 'Notation', type: 'select',
            options: [{ value: 'plain', label: 'Plain' }, { value: 'scientific', label: 'Scientific' }],
          },
        ],
        preview: (s) => `Float vector [N] → UTF-8 strings (${(s?.notation === 'scientific' ? 'scientific' : 'fixed')}, ${s?.decimals ?? 4} dp)`,
      },
      {
        from: 'label', to: 'string', label: 'Label→Str',
        desc: 'Renders a classification label as its string form.',
        defaultSettings: { style: 'human' },
        params: [{ key: 'style', label: 'Label style', type: 'select', options: [{ value: 'human', label: 'Human-readable' }, { value: 'slug', label: 'Slug' }] }],
        preview: (s) => (s?.style === 'slug' ? 'Label id 42 → string "class_42"' : 'Label id 42 → string "Aircraft"'),
      },
      { from: 'string', to: 'text', label: 'Str→Text', desc: 'Wraps the string in a text payload.', preview: () => 'Plain string 1.2 KB → rich text document (UTF-8)' },
      { from: 'text', to: 'string', label: 'Text→Str', desc: 'Flattens text into a plain string.', preview: () => 'Rich text 4 KB → flat string 3.6 KB (markup stripped)' },
      {
        from: 'tensor', to: 'float', label: 'Tensor→Float',
        desc: 'Unfolds a dense tensor to a row-major float vector for legacy stats / sklearn-style heads.',
        preview: () => 'Tensor [B,C,H,W] → float vector [B·C·H·W]',
      },
      {
        from: 'float', to: 'tensor', label: 'Float→Tensor',
        desc: 'Packs a contiguous float vector into a rank-2 tensor view (shape metadata carried separately).',
        preview: () => 'float [N] → tensor [1, N]',
      },
      { from: 'float32', to: 'tensor', label: 'F32→Tensor', desc: 'Wraps a float32 weight buffer as a tensor handle for mixed-precision graphs.', preview: () => 'float32 [P] → tensor [1, P]' },
      { from: 'tensor', to: 'float32', label: 'Tensor→F32', desc: 'Materializes a tensor slice as float32 host memory for CUDA / Metal kernels.', preview: () => 'tensor view → float32 [N]' },
      { from: 'binary', to: 'tensor', label: 'Bin→Tensor', desc: 'Deserializes checkpoint / safetensors / ONNX raw bytes into a typed tensor.', preview: () => '8.4 MB blob → tensor weights' },
      { from: 'tensor', to: 'binary', label: 'Tensor→Bin', desc: 'Serializes tensor shards for disk, object store, or cross-service RPC.', preview: () => 'tensor tiles → protobuf blob' },
      { from: 'text', to: 'tensor', label: 'Text→Tensor', desc: 'Tokenizer output: UTF-8 text to int64 token-id tensor for transformer blocks.', preview: () => 'doc → int64 tensor [1, T]' },
      { from: 'tensor', to: 'text', label: 'Tensor→Text', desc: 'Greedy or sampled decode from vocabulary logits tensor to a string.', preview: () => 'logits [1, V] → UTF-8 string' },
      { from: 'image', to: 'tensor', label: 'Img→Tensor', desc: 'uint8 HWC image to normalized CHW float tensor for conv stacks.', preview: () => 'H×W×3 → tensor [1, 3, H, W]' },
      { from: 'tensor', to: 'image', label: 'Tensor→Img', desc: 'Maps normalized CHW activations to 8-bit RGB for thumbnails and QA.', preview: () => 'tensor [1,3,224,224] → RGB preview' },
      { from: 'logits', to: 'label', label: 'Logits→Label', desc: 'Argmax (or calibrated top-k) over class logits to a discrete label id.', preview: () => 'logits [C] → label id' },
      { from: 'point_cloud', to: 'binary', label: 'PC→Bin', desc: 'Packs XYZI point records into a compact binary frame (e.g. LAS-style).', preview: () => 'N×4 float → binary frame' },
      { from: 'binary', to: 'point_cloud', label: 'Bin→PC', desc: 'Parses LiDAR / depth-camera frame bytes into structured point_cloud [N, k].', preview: () => 'Velodyne packet → point_cloud' },
      { from: 'spectrogram', to: 'float', label: 'Spec→Float', desc: 'Flattens mel or STFT energy matrix to a float feature vector.', preview: () => 'mel [64, T] → float [64·T]' },
      { from: 'embedding', to: 'tensor', label: 'Emb→Tensor', desc: 'Stacks per-token embedding vectors into a single [T, D] tensor.', preview: () => 'T × float[D] → tensor [T, D]' },
      { from: 'tensor', to: 'embedding', label: 'Tensor→Emb', desc: 'Slices a [T, D] tensor row-wise as embedding payloads for sparse modules.', preview: () => 'tensor [T, D] → embedding stream' },
      { from: 'adjacency', to: 'tensor', label: 'Adj→Tensor', desc: 'COO / CSR sparse graph adjacency to dense or sparse tensor for GNN layers.', preview: () => 'sparse adjacency → tensor block' },
      { from: 'spike', to: 'float', label: 'Spike→Float', desc: 'Binned spike train or event list to a float rate / count vector.', preview: () => 'spike events → float [bins]' },
    ];
    const map = new Map();
    raw.forEach(r => {
      const id = `${r.from}-to-${r.to}`;
      map.set(`${r.from}>${r.to}`, {
        id,
        fromType: r.from,
        toType: r.to,
        label: r.label,
        desc: r.desc,
        preview: r.preview || null,
        params: r.params || null,
        defaultSettings: r.defaultSettings ? { ...r.defaultSettings } : null,
      });
    });
    return map;
  })();
  function _getAdaptor(fromType, toType) {
    if (!fromType || !toType) return null;
    if (fromType === toType) return null;
    return ADAPTOR_MAP.get(`${fromType.toLowerCase()}>${toType.toLowerCase()}`) || null;
  }
  function _persistableAdaptor(adaptor) {
    if (!adaptor) return null;
    return {
      id: adaptor.id,
      fromType: adaptor.fromType,
      toType: adaptor.toType,
      label: adaptor.label,
      desc: adaptor.desc,
    };
  }
  function snapshotConnection(c) {
    const o = { from: [...c.from], to: [...c.to] };
    if (c.adaptor) o.adaptor = _persistableAdaptor(c.adaptor);
    if (c.adaptorSettings && typeof c.adaptorSettings === 'object') o.adaptorSettings = { ...c.adaptorSettings };
    return o;
  }
  function getAdaptorUiModel(conn) {
    if (!conn || !conn.adaptor) return null;
    const cat = _getAdaptor(conn.adaptor.fromType, conn.adaptor.toType);
    const defaults = (cat && cat.defaultSettings) ? { ...cat.defaultSettings } : {};
    const settings = { ...defaults, ...(conn.adaptorSettings || {}) };
    let previewText = '';
    if (cat && typeof cat.preview === 'function') {
      try { previewText = String(cat.preview(settings) || ''); } catch (_) { previewText = ''; }
    }
    if (!previewText) {
      previewText = `${String(conn.adaptor.fromType || '').toUpperCase()} → ${String(conn.adaptor.toType || '').toUpperCase()} data preview`;
    }
    return {
      adaptor: _persistableAdaptor(conn.adaptor),
      desc: (cat && cat.desc) || conn.adaptor.desc || '',
      params: (cat && cat.params) || [],
      settings,
      previewText,
    };
  }
  function updateConnectionAdaptorSettings(idx, patch) {
    const c = CONNECTIONS[idx];
    if (!c || !c.adaptor) return false;
    c.adaptorSettings = Object.assign({}, c.adaptorSettings || {}, patch);
    drawEdges();
    _fireChange('adaptor-settings');
    return true;
  }

  function renderIoRows(rows, dir) {
    return (rows || []).map(r =>
      `<div class="io-row" data-io="${dir}:${r.name}" data-dir="${dir}" data-type="${(r.type||'').toLowerCase()}">` +
        `<span class="io-name" title="${r.name}">${r.name}</span>` +
        typePill(r.type) +
        `<span class="port-anchor" data-port="${dir}:${r.name}"></span>` +
      `</div>`
    ).join('');
  }

  // ── State ────────────────────────────────────────────
  let canvasEl, canvasInner, zoomValueEl;
  let opts = { offset: 0, editable: false, initialZoom: 1.0 };
  let onNodeClickCb = null;
  let onKebabClickCb = null;
  let onConnectionConflictCb = null;
  let onAdaptorRequiredCb = null;
  let onAdaptorChipClickCb = null;
  // Fired when the user starts dragging a role badge (Start/End) off a node.
  // Host implements the drop-target tracking and tag transfer.
  let onRoleBadgeDragStartCb = null;
  // Fired after any mutation that changes the graph structure or node
  // positions. Hosts can hook this for undo/redo, autosave, dirty flags.
  let onChangeCb = null;
  function _fireChange(kind) {
    if (onChangeCb) {
      try { onChangeCb(kind); } catch (_) { /* host error is non-fatal */ }
    }
  }

  // Single source of truth: id → { data, el, overlayEl }
  const nodeState = new Map();
  let CONNECTIONS = [];

  let zoom = 1, panX = 0, panY = 0;
  // Run-flow visual state: maps edge keys (`fromNode->toNode`) to phases so
  // hosts can animate only the currently executing path/group during runs.
  let runFlowEnabled = false;
  let runFlowTargetKeys = new Set();
  let runFlowDoneKeys = new Set();
  let runFlowActiveKeys = new Set();

  let edgeOverlay = null;
  let edgeOverlayBack = null;
  let edgeOverlayFront = null;

  function _edgeKeyFromNodes(fromNodeId, toNodeId) {
    if (!fromNodeId || !toNodeId) return '';
    return `${String(fromNodeId)}->${String(toNodeId)}`;
  }
  function _edgeKeyFromSpec(spec) {
    if (!spec) return '';
    if (typeof spec === 'string') return spec;
    return _edgeKeyFromNodes(spec.from || spec.fromId || spec.a, spec.to || spec.toId || spec.b);
  }
  function _edgeKeySet(specs) {
    const out = new Set();
    (specs || []).forEach(spec => {
      const k = _edgeKeyFromSpec(spec);
      if (k) out.add(k);
    });
    return out;
  }
  function _edgeLineRoots() {
    if (opts.editable && edgeOverlayBack && edgeOverlayFront) {
      const roots = [edgeOverlayBack, edgeOverlayFront];
      document.querySelectorAll('.sg-internal-edges').forEach((el) => roots.push(el));
      return roots;
    }
    if (edgeOverlay) return [edgeOverlay];
    return [];
  }
  function _edgeTouchesSubgraphMember(c) {
    const fromEl = nodeState.get(c.from[0])?.el;
    const toEl = nodeState.get(c.to[0])?.el;
    return !!(fromEl?.classList.contains('sg-member') || toEl?.classList.contains('sg-member'));
  }
  function _getSubgraphGroupIdForNode(nodeId) {
    if (typeof window.getSubgraphGroupIdForNode !== 'function') return null;
    try {
      const v = window.getSubgraphGroupIdForNode(nodeId);
      return v ? String(v) : null;
    } catch (_) {
      return null;
    }
  }
  /** Expanded `.subgraph-box` for a group id, or null (used for in-group edge layering). */
  function _expandedSubgraphBoxForGroupId(groupId) {
    if (!groupId) return null;
    try {
      return document.querySelector(`.subgraph-box.expanded[data-id="${CSS.escape(String(groupId))}"]`);
    } catch (_) {
      return null;
    }
  }
  /**
   * Sharp member↔member edges inside one expanded subgroup: render into an SVG child of
   * `.subgraph-box` so they paint above the dashed shell background but below member cards
   * (siblings at shell z+1), instead of on `edgeOverlayFront` above every node.
   */
  function _renderInternalSubgraphEdgeSvgs(byGroup) {
    document.querySelectorAll('.subgraph-box.expanded > .sg-internal-edges').forEach((svg) => {
      const gid = svg.closest('.subgraph-box')?.dataset?.id;
      if (!gid || !byGroup.has(gid)) svg.innerHTML = '';
    });
    byGroup.forEach((items, gid) => {
      if (!items || !items.length) return;
      const box = _expandedSubgraphBoxForGroupId(gid);
      if (!box) return;
      let svg = box.querySelector(':scope > .sg-internal-edges');
      if (!svg) {
        svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'node-overlay sg-internal-edges');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.pointerEvents = 'auto';
        svg.addEventListener('mousedown', _onEdgeSvgPointerDown, true);
        svg.addEventListener('click', _onEdgeSvgClick);
        const head = box.querySelector(':scope > .sg-head');
        if (head) box.insertBefore(svg, head);
        else box.appendChild(svg);
      }
      const left = parseFloat(box.style.left) || 0;
      const top = parseFloat(box.style.top) || 0;
      const body = items.map((it) => {
        const conn = it.c;
        const chip = conn && conn.adaptor ? _adaptorChipSvg(it.a, it.b, conn, it.i) : '';
        return (
          `<path class="edge-hit" data-conn-idx="${it.i}" d="${it.d}"/>` +
          `<path class="edge-line" data-edge-key="${it.edgeKey}" d="${it.d}"/>` +
          chip
        );
      }).join('');
      svg.innerHTML = `<g transform="translate(${-left} ${-top})">${body}</g>`;
    });
  }
  /** Black rects (luminance mask) over things that should hide this edge:
   *   - subgraph shells that are *not* endpoints of this edge
   *   - all nodes that are *not* endpoints of this edge (so edge appears behind nodes)
   * Result: subgroup-touching edges sit visually above the dashed shell but
   * behind every loose / member card. */
  let _occluderCache = null;
  function _buildOccluderCache() {
    const pad = 8;
    const groups = [];
    const nodes = [];
    const layer = document.getElementById('subgraphLayer');
    if (layer) {
      layer.querySelectorAll('.subgraph-box[data-id]').forEach((el) => {
        if (el.classList.contains('preview')) return;
        const gid = el.dataset.id;
        if (!gid) return;
        const x = parseFloat(el.style.left) || 0;
        const y = parseFloat(el.style.top) || 0;
        const w = parseFloat(el.style.width) || 0;
        const h = parseFloat(el.style.height) || 0;
        if (w < 4 || h < 4) return;
        groups.push({
          id: gid,
          x, y, w, h,
          rect: `<rect x="${x - pad}" y="${y - pad}" width="${w + pad * 2}" height="${h + pad * 2}" fill="black"/>`,
        });
      });
    }
    nodeState.forEach((s, id) => {
      const el = s.el;
      if (!el || el.classList.contains('sg-hidden')) return;
      const x = parseFloat(el.style.left) || 0;
      const y = parseFloat(el.style.top) || 0;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w < 4 || h < 4) return;
      nodes.push({ id, rect: `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" rx="10" ry="10" fill="black"/>` });
    });
    return { groups, nodes };
  }
  /* Build occluder rects for a masked subgroup-touching edge.
   * endpointGroupIds: Set of group IDs whose boxes are endpoint subgroups.
   * For each endpoint group, non-member nodes inside its box should not occlude
   * the edge (they're visually behind the box). We cancel them with a white rect
   * then re-add blacks only for member nodes (minus the two endpoints). */
  function _subgraphOccluderMaskRects(excludeGroupIds, excludeNodeIds, endpointGroupIds) {
    const cache = _occluderCache || _buildOccluderCache();
    const skipN = excludeNodeIds || new Set();
    const skipG = excludeGroupIds || new Set();
    let out = '';
    // Non-endpoint group shells
    for (let i = 0; i < cache.groups.length; i++) {
      if (!skipG.has(cache.groups[i].id)) out += cache.groups[i].rect;
    }
    // All non-endpoint nodes (black)
    for (let i = 0; i < cache.nodes.length; i++) {
      if (!skipN.has(cache.nodes[i].id)) out += cache.nodes[i].rect;
    }
    // For each endpoint group: white-cancel the interior so non-member nodes
    // can't occlude the edge inside the box, then re-add member node blacks.
    if (endpointGroupIds && endpointGroupIds.size > 0 && typeof window.getSubgraphMemberNodeIds === 'function') {
      const nodeMap = new Map();
      for (let i = 0; i < cache.nodes.length; i++) nodeMap.set(cache.nodes[i].id, cache.nodes[i].rect);
      endpointGroupIds.forEach(gid => {
        const g = cache.groups.find(e => e.id === gid);
        if (!g) return;
        // White rect cancels all node blacks inside this box
        out += `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="white"/>`;
        // Re-add member nodes (except the two endpoints) so they still occlude
        const members = window.getSubgraphMemberNodeIds(gid) || [];
        for (let j = 0; j < members.length; j++) {
          const mid = members[j];
          if (skipN.has(mid)) continue;
          const r = nodeMap.get(mid);
          if (r) out += r;
        }
      });
    }
    return out;
  }
  function _queryEdgeHitByConnIdx(idx) {
    const sel = `.edge-hit[data-conn-idx="${idx}"]`;
    if (opts.editable && edgeOverlayBack && edgeOverlayFront) {
      return (
        edgeOverlayBack.querySelector(sel) ||
        edgeOverlayFront.querySelector(sel) ||
        document.querySelector(`.sg-internal-edges ${sel}`)
      );
    }
    return edgeOverlay?.querySelector(sel) || null;
  }
  function _applyRunFlowClasses() {
    const lineRoots = _edgeLineRoots();
    if (!lineRoots.length) return;
    const lines = [];
    lineRoots.forEach(root => {
      root.querySelectorAll('path.edge-line:not(.edge-line--underflow)').forEach(p => lines.push(p));
    });
    const hasTargets = runFlowTargetKeys.size > 0;
    lines.forEach((line) => {
      line.classList.remove('run-flow-target', 'run-flow-done', 'run-flow-active');
      if (!runFlowEnabled) return;
      const key = line.dataset.edgeKey || '';
      if (!hasTargets) {
        line.classList.add('run-flow-target', 'run-flow-active');
        return;
      }
      if (!runFlowTargetKeys.has(key)) return;
      line.classList.add('run-flow-target');
      if (runFlowDoneKeys.has(key)) line.classList.add('run-flow-done');
      if (runFlowActiveKeys.has(key)) line.classList.add('run-flow-active');
    });
  }

  // ── Init ─────────────────────────────────────────────
  function init(options) {
    opts = Object.assign({
      canvasId: 'canvas',
      innerId: 'canvasInner',
      zoomValueId: 'zoomValue',
      offset: 0,
      editable: false,
      initialZoom: 1.0,
      /** When true, nodes render in the simplified "simple-node" mode: no
       *  per-port io rows; one hover-revealed anchor per side; drag a node's
       *  side anchor onto another node to auto-resolve compatible port pairs.
       *  Off restores the classic per-port rendering + rope drag exactly. */
      simpleNodes: false,
      /** When true, single-click on `.node-head` opens the inspector (same as node title). Edit mode handles this on canvas-inner capture; view mode sets this. */
      isNodeHeadSingleInspectOpen: null
    }, options || {});
    canvasEl    = document.getElementById(opts.canvasId);
    canvasInner = document.getElementById(opts.innerId);
    zoomValueEl = document.getElementById(opts.zoomValueId);
    zoom = opts.initialZoom;
    if (opts.simpleNodes && canvasInner) canvasInner.classList.add('simple-nodes-mode');
    _attachCanvasDrag();
    _attachCanvasPanZoom();
    if (opts.editable) {
      if (opts.simpleNodes) _attachSimplePortDrag();
      else _attachPortDrag();
      // Dismiss the edge delete bubble on any mousedown outside it (covers
      // pan start, node drag, rope drag, modal opens, etc.) and on Escape.
      // Capture phase so we beat other handlers that might stopPropagation.
      document.addEventListener('mousedown', e => {
        if (!edgeBubbleEl || !edgeBubbleEl.classList.contains('show')) return;
        if (edgeBubbleEl.contains(e.target)) return;
        // Don't swallow clicks on an edge here — let the overlay's click
        // handler toggle the bubble (click same edge twice to dismiss).
        if (e.target.closest && e.target.closest('.edge-hit')) return;
        _hideEdgeBubble();
      }, true);
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { _hideEdgeBubble(); _hideSimplePicker(); }
      });
    }
  }

  // ── CRUD API ─────────────────────────────────────────
  // addNode uses data.x/y as-is (world coordinates). The `opts.offset` is
  // applied only during initial build(P) so that per-project data.js files
  // can store view-mode coords and have editing-mode shift them uniformly.
  function addNode(data) {
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.nodeId = data.id;
    el.style.left = data.x + 'px';
    el.style.top  = data.y + 'px';
    const newZ = ++surfaceZSeq;
    el.style.zIndex = newZ;

    const overlayEl = document.createElementNS(SVG_NS, 'svg');
    overlayEl.setAttribute('class', 'node-overlay');
    overlayEl.dataset.overlayFor = data.id;
    overlayEl.style.zIndex = newZ;

    nodeState.set(data.id, { data, el, overlayEl });
    renderNode(data.id);

    canvasInner.appendChild(el);
    canvasInner.appendChild(overlayEl);
    _fireChange('add-node');
    /* Edges use port centroids; double-rAF after host onChange (subgraph shell, etc.) matches build() and removes one-frame glitches. */
    requestAnimationFrame(() => {
      drawEdges();
      _refreshOverlaps();
      requestAnimationFrame(() => drawEdges());
    });
    return el;
  }

  function removeNode(id) {
    const s = nodeState.get(id);
    if (!s) return;
    CONNECTIONS = CONNECTIONS.filter(c => c.from[0] !== id && c.to[0] !== id);
    s.el.remove();
    s.overlayEl.remove();
    nodeState.delete(id);
    drawEdges();
    _refreshOverlaps();
    _fireChange('remove-node');
  }

  function renderNode(id) {
    if (opts.simpleNodes) return renderSimpleNode(id);
    const s = nodeState.get(id);
    if (!s) return;
    const { data, el } = s;
    const hasIn  = data.inputs  && data.inputs.length  > 0;
    const hasOut = data.outputs && data.outputs.length > 0;
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const isStart = tags.includes('start');
    const isEnd   = tags.includes('end');
    // Auto-inferred role (transient, set by editor's recomputeAutoRoles).
    // Suppressed by any manual mark of the same role on the same node.
    const auto = data._autoRole;
    const autoStart = auto === 'start' && !isStart;
    const autoEnd   = auto === 'end'   && !isEnd;
    const showStart = isStart || autoStart;
    const showEnd   = isEnd   || autoEnd;
    // ▶ play triangle for Start, ■ square for End — small SVG glyphs.
    const startGlyph = `<span class="role-glyph"><svg viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9"/></svg></span>`;
    const endGlyph   = `<span class="role-glyph"><svg viewBox="0 0 10 10" fill="currentColor"><rect x="2" y="2" width="6" height="6" rx="0.5"/></svg></span>`;
    const roleBadgesHtml = (showStart || showEnd) ? `
      <div class="node-role-badges">
        ${showStart ? `<span class="node-role-badge start${autoStart ? ' auto' : ''}" title="${autoStart ? 'Auto-inferred start node — drag to move' : 'Start node — drag to move'}">${startGlyph}Start</span>` : ''}
        ${showEnd   ? `<span class="node-role-badge end${autoEnd ? ' auto' : ''}"   title="${autoEnd   ? 'Auto-inferred end node — drag to move'   : 'End node — drag to move'}">${endGlyph}End</span>`     : ''}
      </div>` : '';
    el.innerHTML = `
      ${roleBadgesHtml}
      <div class="node-head">
        <span class="type-icon">${ICONS[data.type]}</span>
        <span class="type-label">${data.type}</span>
        <span class="user-dot" style="background:${data.user.color}">${data.user.letter}</span>
        <span class="menu-dots">⋮</span>
      </div>
      <div class="node-body">
        <div class="node-item" data-title="1">
          <span class="dot" style="background:${data.color}"></span>${data.label}
        </div>
      </div>
      ${hasIn  ? `<div class="node-section" data-section="in"><span class="left">${ARROW_IN}<span>Inputs</span></span>${CARET}</div><div class="io-list" data-io-list="in">${renderIoRows(data.inputs,'in')}</div>` : ''}
      ${hasOut ? `<div class="node-section" data-section="out"><span class="left">${ARROW_OUT}<span>Outputs</span></span>${CARET}</div><div class="io-list" data-io-list="out">${renderIoRows(data.outputs,'out')}</div>` : ''}`;
    _syncNodeBottomCorners(el);
    _attachNodeListeners(id);
    _attachRoleBadgeDrag(id);
  }

  // Informational io rows for the hover-revealed detail section of a simple
  // node. No `.port-anchor` — connections are made via the unified side
  // anchors, so these rows exist purely to show what the node accepts/emits.
  // Find the expanded-list row for a given port (dir + name). Matches on
  // dataset rather than an attribute selector so port names with quotes or
  // other CSS-special characters resolve safely.
  function _simpleRowFor(el, dir, name) {
    const rows = el.querySelectorAll(`.nsp-row[data-io-dir="${dir}"]`);
    for (const r of rows) if (r.dataset.ioName === String(name)) return r;
    return null;
  }
  function _simpleIoDetailRows(rows, dir) {
    return (rows || []).map(r =>
      `<div class="nsp-row" data-io-dir="${dir}" data-io-name="${_escSvg(r.name)}" data-type="${(r.type || '').toLowerCase()}">` +
        `<span class="nsp-name" title="${_escSvg(r.name)}">${_escSvg(r.name)}</span>` +
        typePill(r.type) +
      `</div>`
    ).join('');
  }

  // Simplified card: head + label, with one unified anchor per side (in =
  // left edge, out = right edge) pinned to the stable top region. The full
  // input/output list lives in a hover-revealed detail section below, so the
  // card stays minimal until inspected. Connections are made by dragging a
  // side anchor onto another node (see the simple port-drag system below).
  // Reuses the same head/body markup + listeners as renderNode so dragging,
  // the kebab menu, role badges, and the inspector all still work.
  function renderSimpleNode(id) {
    const s = nodeState.get(id);
    if (!s) return;
    const { data, el } = s;
    const inCount  = (data.inputs  && data.inputs.length)  || 0;
    const outCount = (data.outputs && data.outputs.length) || 0;
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const isStart = tags.includes('start');
    const isEnd   = tags.includes('end');
    const auto = data._autoRole;
    const autoStart = auto === 'start' && !isStart;
    const autoEnd   = auto === 'end'   && !isEnd;
    const showStart = isStart || autoStart;
    const showEnd   = isEnd   || autoEnd;
    const startGlyph = `<span class="role-glyph"><svg viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9"/></svg></span>`;
    const endGlyph   = `<span class="role-glyph"><svg viewBox="0 0 10 10" fill="currentColor"><rect x="2" y="2" width="6" height="6" rx="0.5"/></svg></span>`;
    const roleBadgesHtml = (showStart || showEnd) ? `
      <div class="node-role-badges">
        ${showStart ? `<span class="node-role-badge start${autoStart ? ' auto' : ''}" title="${autoStart ? 'Auto-inferred start node — drag to move' : 'Start node — drag to move'}">${startGlyph}Start</span>` : ''}
        ${showEnd   ? `<span class="node-role-badge end${autoEnd ? ' auto' : ''}"   title="${autoEnd   ? 'Auto-inferred end node — drag to move'   : 'End node — drag to move'}">${endGlyph}End</span>`     : ''}
      </div>` : '';
    el.classList.add('node--simple');
    const inDetail  = inCount  ? _simpleIoDetailRows(data.inputs,  'in')  : '';
    const outDetail = outCount ? _simpleIoDetailRows(data.outputs, 'out') : '';
    // Per-port ghost anchors: one dot per input/output, fanned out from the
    // side anchor as the card expands. Positioned/faded each frame by
    // _layoutSimpleAnchors; draggable to start a connection from that exact port.
    const portAnchorsHtml =
      (data.inputs  || []).map(r =>
        `<span class="simple-port-anchor" data-io-dir="in"  data-io-name="${_escSvg(r.name)}" title="${_escSvg(r.name)} — drag to connect"></span>`).join('') +
      (data.outputs || []).map(r =>
        `<span class="simple-port-anchor" data-io-dir="out" data-io-name="${_escSvg(r.name)}" title="${_escSvg(r.name)} — drag to connect"></span>`).join('');
    el.innerHTML = `
      ${roleBadgesHtml}
      <div class="node-simple-core">
        <div class="node-head">
          <span class="type-icon">${ICONS[data.type]}</span>
          <span class="type-label">${data.type}</span>
          <span class="user-dot" style="background:${data.user.color}">${data.user.letter}</span>
          <span class="menu-dots">⋮</span>
        </div>
        <div class="node-body">
          <div class="node-item" data-title="1">
            <span class="dot" style="background:${data.color}"></span>${data.label}
          </div>
        </div>
        ${inCount  ? `<span class="simple-anchor simple-anchor-in"  data-simple-anchor="in"  title="${inCount} input${inCount === 1 ? '' : 's'} — drag a connection here"></span>` : ''}
        ${outCount ? `<span class="simple-anchor simple-anchor-out" data-simple-anchor="out" title="${outCount} output${outCount === 1 ? '' : 's'} — drag to connect"></span>` : ''}
      </div>
      ${(inCount || outCount) ? `<div class="node-simple-ports"><div class="nsp-inner">
        ${inCount  ? `<div class="nsp-group"><div class="nsp-label">Input${inCount === 1 ? '' : 's'}</div>${inDetail}</div>`  : ''}
        ${outCount ? `<div class="nsp-group"><div class="nsp-label">Output${outCount === 1 ? '' : 's'}</div>${outDetail}</div>` : ''}
      </div></div>` : ''}
      ${portAnchorsHtml}`;
    el._expandP = 0;
    _syncNodeBottomCorners(el);
    _attachNodeListeners(id);
    _attachRoleBadgeDrag(id);
    _attachSimpleHoverRedraw(id);
    // Defer initial anchor layout until the row geometry is measurable.
    requestAnimationFrame(() => _layoutSimpleAnchors(el));
  }

  // A simple card expands on hover (and while held open as a drop target). As
  // it expands, the single side anchor fans out into one per-port anchor per
  // input/output, and the connected edges glide from the side-anchor point to
  // their specific port row. `el._expandP` (0 collapsed → 1 expanded) drives
  // all of this: getPortPos interpolates edge endpoints, _layoutSimpleAnchors
  // positions/fades the dots. We animate it in JS (rather than reading static
  // CSS-clipped row positions) so the motion is a true fan-out, not a teleport.
  function _attachSimpleHoverRedraw(id) {
    const { el } = nodeState.get(id) || {};
    if (!el) return;
    el.addEventListener('mouseenter', () => {
      el.classList.add('simple-expanded');
      _animateSimpleExpand(el, 1);
    });
    el.addEventListener('mouseleave', () => {
      // Held open as an active drop target, or the source of an in-flight rope?
      // Stay expanded — the user is mid-connection and shouldn't lose the ports.
      // The simpleRopeState check covers the pre-commit window before the
      // `simple-rope-origin` class is applied (the cursor can leave the card
      // before the 3px drag threshold trips, since per-port anchors sit on the
      // very edge).
      if (el.classList.contains('simple-drop-open') || el.classList.contains('simple-rope-origin')) return;
      if (simpleRopeState && simpleRopeState.origin && simpleRopeState.origin.nodeId === id) return;
      el.classList.remove('simple-expanded');
      _animateSimpleExpand(el, 0);
    });
  }
  // Node-local center-Y of the simple node's label row (.node-item), in world
  // units. The side anchors, collapsed edge endpoints, and the per-port fan
  // origin all sit here so they line up with the node body instead of floating
  // up toward the head (the core's geometric center sits at the head/body seam).
  function _simpleCoreCY(el) {
    const item = el.querySelector('.node-item') || el.querySelector('.node-body');
    const core = el.querySelector('.node-simple-core');
    if (item) {
      // offsetTop is measured from the nearest positioned ancestor: for both
      // .node-item and .node-simple-core that's the .node card, so summing the
      // two yields the item's center in node-local space.
      const coreTop = core ? core.offsetTop : 0;
      return coreTop + item.offsetTop + item.offsetHeight / 2;
    }
    return core ? core.offsetTop + core.offsetHeight / 2 : el.offsetHeight / 2;
  }
  // Position + fade the per-port ghost anchors for the current _expandP, and
  // cross-fade the unified side anchors out as the card opens.
  // Only writes geometry + opacity (never pointer-events) so it's safe to run
  // every animation frame. Hit-testing is gated by the stable `.simple-anchors-out`
  // class (toggled once per expand/collapse, not per frame) — writing
  // pointer-events here would re-evaluate the element under the cursor each
  // frame and spuriously re-fire enter/leave, flickering the animation.
  function _layoutSimpleAnchors(el) {
    const p = (typeof el._expandP === 'number') ? el._expandP : 0;
    const coreCY = _simpleCoreCY(el);
    el.classList.toggle('simple-anchors-out', p > 0.5);
    // The side anchor stays put at the label-row center. Its visibility is left
    // to CSS: shown when collapsed, faded out when expanded (the .simple-anchors-out
    // class) unless hovered — so we only write its position here, never opacity.
    // Its offsetParent is .node-simple-core, so convert the node-local center
    // into core-local space.
    const core = el.querySelector('.node-simple-core');
    const sideTop = coreCY - (core ? core.offsetTop : 0);
    el.querySelectorAll('.simple-anchor').forEach(a => { a.style.top = sideTop + 'px'; });
    el.querySelectorAll('.simple-port-anchor').forEach(a => {
      const dir = a.dataset.ioDir;
      const row = _simpleRowFor(el, dir, a.dataset.ioName);
      const xLocal = dir === 'out' ? el.offsetWidth : 0;
      const rowCY = row ? row.offsetTop + row.offsetHeight / 2 : coreCY;
      a.style.left = xLocal + 'px';
      a.style.top  = (coreCY + (rowCY - coreCY) * p) + 'px';
      a.style.opacity = String(p);
    });
  }
  // Animate el._expandP toward target (0 or 1), keeping edges + anchors glued
  // to the interpolated geometry each frame.
  function _animateSimpleExpand(el, target) {
    if (el._expandRaf) { cancelAnimationFrame(el._expandRaf); el._expandRaf = null; }
    const from = (typeof el._expandP === 'number') ? el._expandP : 0;
    if (from === target) { el._expandP = target; _layoutSimpleAnchors(el); drawEdges(); return; }
    const start = performance.now();
    const dur = 220;
    const ease = t => (t < 0.5) ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const tick = (now) => {
      let t = (now - start) / dur;
      if (t >= 1) t = 1;
      el._expandP = from + (target - from) * ease(t);
      _layoutSimpleAnchors(el);
      drawEdges();
      if (t < 1) { el._expandRaf = requestAnimationFrame(tick); }
      else { el._expandRaf = null; el._expandP = target; _layoutSimpleAnchors(el); drawEdges(); }
    };
    el._expandRaf = requestAnimationFrame(tick);
  }

  // Wire role badges (Start / End) as drag handles. Mousedown fires the host
  // callback with (sourceNodeId, role, event); the host (editing-mode.js)
  // takes over with document-level move/up to track the drop target.
  function _attachRoleBadgeDrag(id) {
    const { el } = nodeState.get(id) || {};
    if (!el) return;
    el.querySelectorAll('.node-role-badge').forEach(badge => {
      badge.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        // Determine role from class list — 'start' or 'end'.
        const role = badge.classList.contains('start') ? 'start'
                   : badge.classList.contains('end')   ? 'end'
                   : null;
        if (!role) return;
        // Don't let the node-head drag handler claim this gesture.
        e.stopPropagation();
        e.preventDefault();
        if (onRoleBadgeDragStartCb) onRoleBadgeDragStartCb(id, role, e, badge);
      });
    });
  }

  // Keep section backgrounds clipped to the card's rounded bottom corners.
  // The bottom-most visible section can become a collapsed header; in that
  // case add an explicit class so its square background doesn't poke out.
  function _syncNodeBottomCorners(el) {
    if (!el) return;
    el.querySelectorAll('.node-section.bottom-edge-round').forEach(sec => sec.classList.remove('bottom-edge-round'));
    const kids = Array.from(el.children);
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i];
      if (!(k instanceof HTMLElement)) continue;
      if (k.classList.contains('io-list') && k.classList.contains('collapsed')) continue;
      if (k.classList.contains('node-section')) k.classList.add('bottom-edge-round');
      break;
    }
  }

  let suppressNodeFocus = null;
  /** True shortly after a committed node drag — host should skip inspector + head-driven selection. */
  function shouldSuppressPostDragActivation(nodeId) {
    if (!nodeId || !suppressNodeFocus) return false;
    return suppressNodeFocus.id === nodeId && Date.now() <= suppressNodeFocus.until;
  }
  function _attachNodeListeners(id) {
    const { el } = nodeState.get(id);
    el.querySelectorAll('.node-section').forEach(sec => {
      sec.addEventListener('click', () => {
        sec.classList.toggle('collapsed');
        sec.nextElementSibling.classList.toggle('collapsed');
        _syncNodeBottomCorners(el);
        drawEdges();
      });
    });
    el.querySelector('.node-item')?.addEventListener('click', e => {
      e.stopPropagation();
      if (suppressNodeFocus
        && suppressNodeFocus.id === id
        && Date.now() <= suppressNodeFocus.until) {
        return;
      }
      const { data } = nodeState.get(id);
      if (data && onNodeClickCb) onNodeClickCb(data);
    });
    el.querySelector('.menu-dots')?.addEventListener('click', e => {
      e.stopPropagation();
      if (onKebabClickCb) onKebabClickCb(id, e.currentTarget);
    });
    const head = el.querySelector('.node-head');
    if (head) {
      const headInspectSingleEnabled = () =>
        typeof opts.isNodeHeadSingleInspectOpen === 'function' && opts.isNodeHeadSingleInspectOpen();
      head.addEventListener('click', (e) => {
        if (e.target.closest('.menu-dots')) return;
        if (suppressNodeFocus
          && suppressNodeFocus.id === id
          && Date.now() <= suppressNodeFocus.until) {
          return;
        }
        if (!headInspectSingleEnabled()) return;
        e.stopPropagation();
        const { data } = nodeState.get(id);
        if (data && onNodeClickCb) onNodeClickCb(data);
      }, true);
      head.addEventListener('dblclick', (e) => {
        if (e.target.closest('.menu-dots')) return;
        if (suppressNodeFocus
          && suppressNodeFocus.id === id
          && Date.now() <= suppressNodeFocus.until) {
          return;
        }
        if (headInspectSingleEnabled()) return;
        e.preventDefault();
        e.stopPropagation();
        const { data } = nodeState.get(id);
        if (data && onNodeClickCb) onNodeClickCb(data);
      });
    }
  }

  function addConnection(from, to) {
    CONNECTIONS.push({ from, to });
    drawEdges();
    _fireChange('add-connection');
  }

  function removeConnection(from, to) {
    CONNECTIONS = CONNECTIONS.filter(c =>
      !(c.from[0] === from[0] && c.from[1] === from[1] && c.from[2] === from[2] &&
        c.to[0]   === to[0]   && c.to[1]   === to[1]   && c.to[2]   === to[2]));
    drawEdges();
    _fireChange('remove-connection');
  }

  // ── Build from project data ──────────────────────────
  function build(P) {
    canvasInner.style.width  = P.canvasWidth  + 'px';
    canvasInner.style.height = P.canvasHeight + 'px';
    CONNECTIONS = [...(P.connections || [])];
    (P.nodes || []).forEach(n => addNode({ ...n, x: n.x + opts.offset, y: n.y }));
    applyTransform();
    requestAnimationFrame(() => {
      drawEdges();
      _refreshOverlaps();
      requestAnimationFrame(() => drawEdges());
    });
  }

  // Wipe the canvas to an empty state so the caller can rebuild a different
  // graph (e.g. switching variants). Keeps pan/zoom, transform, and the
  // initialized references (canvasEl/canvasInner/overlays); only drops
  // nodes, connections, and the DOM children backing them. The edge overlay
  // and rope overlay are re-inserted lazily by drawEdges()/port drag on the
  // next build.
  function clear() {
    nodeState.forEach(({ el, overlayEl }) => {
      el.remove();
      overlayEl.remove();
    });
    nodeState.clear();
    CONNECTIONS = [];
    if (edgeOverlay) { edgeOverlay.remove(); edgeOverlay = null; }
    if (edgeOverlayBack) { edgeOverlayBack.remove(); edgeOverlayBack = null; }
    if (edgeOverlayFront) { edgeOverlayFront.remove(); edgeOverlayFront = null; }
    if (ropeOverlay) { ropeOverlay.remove(); ropeOverlay = null; }
    if (dotsOverlay) { dotsOverlay.remove(); dotsOverlay = null; }
    document.querySelectorAll('.sg-internal-edges').forEach((svg) => { svg.innerHTML = ''; });
    runFlowEnabled = false;
    runFlowTargetKeys = new Set();
    runFlowDoneKeys = new Set();
    runFlowActiveKeys = new Set();
    canvasEl?.classList.remove('running-edges');
    surfaceZSeq = Z_NODE_BASE - 1;
  }

  // World coordinates at the current viewport center (accounts for pan+zoom).
  function getViewportCenter() {
    const rect = canvasEl.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    return { x: (mx - panX) / zoom, y: (my - panY) / zoom };
  }

  // ── Edge drawing ─────────────────────────────────────
  // View mode: one low-z overlay. Edit mode: back holds non-member edges + blurred
  // under-pass for member edges; front (above subgraph shell) holds masked sharp member edges.
  function _onEdgeSvgClick(e) {
    const chip = e.target.closest && e.target.closest('.adaptor-chip');
    if (chip && onAdaptorChipClickCb) {
      const idx = parseInt(chip.dataset.connIdx, 10);
      if (Number.isFinite(idx) && CONNECTIONS[idx]) {
        e.stopPropagation();
        onAdaptorChipClickCb({
          connIndex: idx,
          connection: CONNECTIONS[idx],
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }
      return;
    }
    if (!opts.editable) return;
    const hit = e.target.closest('.edge-hit');
    if (!hit) return;
    e.stopPropagation();
    const conn = CONNECTIONS[parseInt(hit.dataset.connIdx, 10)];
    if (!conn) return;
    if (edgeBubbleConn === conn && edgeBubbleEl?.classList.contains('show')) {
      _hideEdgeBubble();
    } else {
      _showEdgeBubble(conn);
    }
  }
  function _onEdgeSvgPointerDown(e) {
    if (!opts.editable) return;
    const hit = e.target.closest && e.target.closest('.edge-hit');
    if (!hit) return;
    e.stopPropagation();
    const conn = CONNECTIONS[parseInt(hit.dataset.connIdx, 10)];
    if (!conn) return;
    if (edgeBubbleConn === conn && edgeBubbleEl?.classList.contains('show')) {
      _hideEdgeBubble();
    } else {
      _showEdgeBubble(conn);
    }
  }
  function _syncEdgeFrontAfterSubgraph() {
    if (!edgeOverlayFront || !canvasInner) return;
    const sg = document.getElementById('subgraphLayer');
    if (sg && sg.parentElement === canvasInner) {
      canvasInner.insertBefore(edgeOverlayFront, sg.nextSibling);
    }
  }
  function _ensureEdgeOverlaysEdit() {
    if (!edgeOverlayBack) {
      edgeOverlayBack = document.createElementNS(SVG_NS, 'svg');
      edgeOverlayBack.setAttribute('class', 'node-overlay edge-overlay-back');
      edgeOverlayBack.style.zIndex = String(Z_EDGE_BACK);
      edgeOverlayBack.style.pointerEvents = 'none';
      edgeOverlayBack.addEventListener('click', _onEdgeSvgClick);
      canvasInner.insertBefore(edgeOverlayBack, canvasInner.firstChild);
    }
    if (!edgeOverlayFront) {
      edgeOverlayFront = document.createElementNS(SVG_NS, 'svg');
      edgeOverlayFront.setAttribute('class', 'node-overlay edge-overlay-front');
      edgeOverlayFront.style.zIndex = String(Z_EDGE_FRONT);
      edgeOverlayFront.style.pointerEvents = 'none';
      edgeOverlayFront.addEventListener('click', _onEdgeSvgClick);
      canvasInner.appendChild(edgeOverlayFront);
    }
    _syncEdgeFrontAfterSubgraph();
    return { back: edgeOverlayBack, front: edgeOverlayFront };
  }
  function _ensureEdgeOverlay() {
    if (edgeOverlay) return edgeOverlay;
    edgeOverlay = document.createElementNS(SVG_NS, 'svg');
    edgeOverlay.setAttribute('class', 'node-overlay');
    edgeOverlay.style.zIndex = '1';
    edgeOverlay.style.pointerEvents = 'none';
    edgeOverlay.addEventListener('click', _onEdgeSvgClick);
    canvasInner.insertBefore(edgeOverlay, canvasInner.firstChild);
    return edgeOverlay;
  }

  // ── View-mode endpoint dots overlay ─────────────────
  // In view mode, connection endpoint circles must render ABOVE the node
  // cards so they sit on top of each card's edge, not underneath it. We
  // keep the edge paths in the low-z `edgeOverlay` (so a line never draws
  // through a card) but put the circles into this separate overlay with a
  // z-index higher than any node's dynamic z-index.
  let dotsOverlay = null;
  function _ensureDotsOverlay() {
    if (dotsOverlay) return dotsOverlay;
    dotsOverlay = document.createElementNS(SVG_NS, 'svg');
    dotsOverlay.setAttribute('class', 'node-overlay dots-overlay');
    dotsOverlay.style.zIndex = '9998';
    dotsOverlay.style.pointerEvents = 'none';
    canvasInner.appendChild(dotsOverlay);
    return dotsOverlay;
  }

  // ── Edge break-link bubble (edit mode) ───────────────
  // A small screen-fixed button with a break-link glyph anchored above the
  // midpoint of a clicked edge. Clicking it removes just that connection.
  // Stored by connection reference, not index, so it survives redraws.
  let edgeBubbleEl = null;
  let edgeBubbleConn = null;
  function _ensureEdgeBubble() {
    if (edgeBubbleEl) return edgeBubbleEl;
    edgeBubbleEl = document.createElement('button');
    edgeBubbleEl.type = 'button';
    edgeBubbleEl.className = 'edge-delete-bubble';
    edgeBubbleEl.setAttribute('aria-label', 'Break connection');
    // Lucide "unlink" — two chain halves with directional nubs so it reads
    // clearly at 14px. currentColor picks up the CSS grey.
    edgeBubbleEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>`;
    // Stop pan/drag handlers + the document-level dismiss from firing when
    // the user actually clicks the bubble to confirm deletion.
    edgeBubbleEl.addEventListener('mousedown', e => e.stopPropagation());
    edgeBubbleEl.addEventListener('click', e => {
      e.stopPropagation();
      if (!edgeBubbleConn) return;
      CONNECTIONS = CONNECTIONS.filter(c => c !== edgeBubbleConn);
      _hideEdgeBubble();
      drawEdges();
      _fireChange('remove-connection');
    });
    document.body.appendChild(edgeBubbleEl);
    return edgeBubbleEl;
  }
  function _showEdgeBubble(conn) {
    const bubble = _ensureEdgeBubble();
    // Compute the edge midpoint in screen coords. The cubic bezier we render
    // is symmetric (control points share endpoint Y), so its t=0.5 point is
    // simply the midpoint of the two endpoints — no bezier evaluation needed.
    const canvasRect = canvasEl.getBoundingClientRect();
    const a = getPortPos(conn.from[0], conn.from[1], conn.from[2], canvasRect);
    const b = getPortPos(conn.to[0],   conn.to[1],   conn.to[2],   canvasRect);
    if (!a || !b) return;
    const midScreenX = canvasRect.left + panX + ((a.x + b.x) / 2) * zoom;
    const midScreenY = canvasRect.top  + panY + ((a.y + b.y) / 2) * zoom;
    edgeBubbleConn = conn;
    const BW = 28, BH = 28, GAP = 10;
    let left = midScreenX - BW / 2;
    let top  = midScreenY - BH - GAP;
    if (top < 8) top = midScreenY + GAP;
    left = Math.max(8, Math.min(left, window.innerWidth - BW - 8));
    bubble.style.left = left + 'px';
    bubble.style.top  = top  + 'px';
    bubble.classList.add('show');
    // Keep the clicked edge visually "active" (blue) while the bubble is up.
    _refreshActiveEdge();
  }
  function _hideEdgeBubble() {
    if (!edgeBubbleEl) return;
    edgeBubbleEl.classList.remove('show');
    edgeBubbleConn = null;
    _refreshActiveEdge();
  }
  /** Remove the edge currently selected (blue highlight / break-link bubble). */
  function removeActiveEdgeSelection() {
    if (!opts.editable) return false;
    if (!edgeBubbleConn) return false;
    const conn = edgeBubbleConn;
    CONNECTIONS = CONNECTIONS.filter(c => c !== conn);
    _hideEdgeBubble();
    drawEdges();
    _fireChange('remove-connection');
    return true;
  }
  function _refreshActiveEdge() {
    _edgeLineRoots().forEach(root => {
      root.querySelectorAll('.edge-active').forEach(p => p.classList.remove('edge-active'));
    });
    document.querySelectorAll('.port-anchor.edge-hovered, .sg-row-port.edge-hovered')
      .forEach(a => a.classList.remove('edge-hovered'));
    if (!edgeBubbleConn) return;
    const idx = CONNECTIONS.indexOf(edgeBubbleConn);
    if (idx < 0) return;
    const conn = CONNECTIONS[idx];
    const hit = _queryEdgeHitByConnIdx(idx);
    if (hit) {
      hit.classList.add('edge-active');
      if (hit.nextElementSibling) hit.nextElementSibling.classList.add('edge-active');
    }
    const a = _getAnchorForEdgeEnd(conn?.from);
    const b = _getAnchorForEdgeEnd(conn?.to);
    a?.classList.add('edge-hovered');
    b?.classList.add('edge-hovered');
  }

  function _getAnchorForEdgeEnd(end) {
    if (!end || !end[0]) return null;
    const s = nodeState.get(end[0]);
    if (!s) return null;
    if (s.el.classList.contains('sg-hidden')) {
      if (typeof window.getSubgraphCollapsedPortAnchorEl === 'function') {
        try {
          const el = window.getSubgraphCollapsedPortAnchorEl(end[0], end[1]);
          if (el) return el;
        } catch (_) { /* host shell */ }
      }
      const dir = end[1];
      const sel = dir === 'in' ? '.sg-row-port-in' : '.sg-row-port-out';
      return document.querySelector(`.subgraph-box.collapsed .sg-node-row[data-node-id="${CSS.escape(end[0])}"] ${sel}`);
    }
    if (opts.simpleNodes) {
      return s.el.querySelector(end[1] === 'in' ? '.simple-anchor-in' : '.simple-anchor-out') || null;
    }
    return s.el.querySelector(`[data-io="${end[1]}:${end[2]}"] .port-anchor`) || null;
  }

  function getPortPos(nodeId, dir, ioName, canvasRect) {
    const s = nodeState.get(nodeId);
    if (!s) return null;
    const el  = s.el;
    if (opts.editable && el.classList.contains('sg-hidden') && typeof window.getSubgraphCollapsedPortWorld === 'function') {
      const alt = window.getSubgraphCollapsedPortWorld(nodeId, dir, ioName, canvasRect);
      if (alt) return alt;
    }
    // Simple-node mode: ports collapse to one anchor per side, so every
    // input resolves to the left-edge anchor and every output to the right.
    // BUT when the card is expanded (hovered, or held open as a drop target),
    // edges fan out to the specific port row they belong to, so connections
    // visibly originate from their own input/output.
    if (opts.simpleNodes && !el.classList.contains('sg-hidden')) {
      // Node-local offsets are world units (the node isn't independently
      // scaled — zoom comes from the ancestor .canvas-inner transform), so we
      // can work directly in el.style.left/top space without screen↔world math.
      // Endpoints interpolate from the stable core-center (collapsed) to their
      // specific port row (expanded) by el._expandP, giving a smooth fan-out
      // instead of a teleport. Rows keep their final offsetTop even while the
      // CSS grid clips them, so the target geometry is always measurable.
      const x0 = parseFloat(el.style.left) || 0;
      const y0 = parseFloat(el.style.top)  || 0;
      const xLocal = dir === 'out' ? el.offsetWidth : 0;
      const coreCY = _simpleCoreCY(el);
      let yLocal = coreCY;
      if (ioName != null) {
        const p = (typeof el._expandP === 'number') ? el._expandP : 0;
        if (p > 0) {
          const row = _simpleRowFor(el, dir, ioName);
          if (row) {
            const rowCY = row.offsetTop + row.offsetHeight / 2;
            yLocal = coreCY + (rowCY - coreCY) * p;
          }
        }
      }
      return { x: x0 + xLocal, y: y0 + yLocal };
    }
    const row = el.querySelector(`[data-io="${dir}:${ioName}"]`);
    if (row && row.offsetParent !== null) {
      if (opts.editable) {
        const anchor = row.querySelector('.port-anchor');
        if (anchor) {
          const ar = anchor.getBoundingClientRect();
          if (ar.width > 0) {
            const cr = canvasRect || canvasEl.getBoundingClientRect();
            return {
              x: (ar.left + ar.width  / 2 - cr.left - panX) / zoom,
              y: (ar.top  + ar.height / 2 - cr.top  - panY) / zoom
            };
          }
        }
      }
      const x0 = parseFloat(el.style.left) || 0;
      const y0 = parseFloat(el.style.top)  || 0;
      const bt = el.clientTop  || 0;
      const bl = el.clientLeft || 0;
      return {
        x: dir === 'out' ? x0 + el.offsetWidth - bl : x0 + bl,
        y: y0 + bt + row.offsetTop + row.offsetHeight / 2
      };
    }
    const x0 = parseFloat(el.style.left) || 0;
    const y0 = parseFloat(el.style.top)  || 0;
    const bt = el.clientTop  || 0;
    const sec = el.querySelector(`.node-section[data-section="${dir}"]`);
    return {
      x: dir === 'out' ? x0 + el.offsetWidth : x0,
      y: y0 + (sec ? bt + sec.offsetTop + sec.offsetHeight / 2 : el.offsetHeight / 2)
    };
  }

  function _isInternalCollapsedSubgraphEdge(c) {
    if (typeof window.isInternalCollapsedSubgraphEdge === 'function') {
      try { return !!window.isInternalCollapsedSubgraphEdge(c); } catch (_) { /* host shell */ }
    }
    return false;
  }
  function _pushCollapsedInternalEdgePlaceholder(c, i, parts) {
    const edgeKey = _edgeKeyFromNodes(c.from[0], c.to[0]);
    parts.push(`<path class="edge-hit edge--collapsed-internal" data-conn-idx="${i}" d="M0 0" style="pointer-events:none;display:none"/>`);
    parts.push(`<path class="edge-line edge--collapsed-internal" data-edge-key="${edgeKey}" d="M0 0" style="display:none"/>`);
  }
  function _escSvg(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));
  }
  // Render an "adaptor inserted here" chip at the bezier midpoint. The
  // cubic we draw is Y-symmetric in its control points, so t=0.5 lands
  // exactly on the endpoint midpoint — no curve evaluation required.
  function _adaptorChipSvg(a, b, conn, i) {
    const adaptor = conn && conn.adaptor;
    if (!adaptor) return '';
    const dotMode = zoom < 0.5;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const label = adaptor.label || `${adaptor.fromType || ''}→${adaptor.toType || ''}`;
    const title = _escSvg(adaptor.desc || label);
    const haloPad = 4;
    if (dotMode) {
      // Keep dot size in world space so it scales with zoom like anchors.
      const r = 4.5;
      return (
        `<g class="adaptor-chip adaptor-chip--dot" data-conn-idx="${i}" data-adaptor-id="${_escSvg(adaptor.id || '')}">` +
          `<title>${title}</title>` +
          `<circle class="adaptor-chip-halo" cx="${mx}" cy="${my}" r="${r + haloPad}" fill="var(--canvas-bg)" stroke="none"/>` +
          `<circle class="adaptor-chip-bg adaptor-chip-dot-body" cx="${mx}" cy="${my}" r="${r}"/>` +
        `</g>`
      );
    }
    const padX = 20;
    const w = Math.max(44, Math.round(label.length * 6.4) + padX);
    const h = 18;
    const x = Math.round(mx - w / 2);
    const y = Math.round(my - h / 2);
    const hx = x - haloPad;
    const hy = y - haloPad;
    const hw = w + haloPad * 2;
    const hh = h + haloPad * 2;
    return (
      `<g class="adaptor-chip" data-conn-idx="${i}" data-adaptor-id="${_escSvg(adaptor.id || '')}">` +
        `<title>${title}</title>` +
        `<rect class="adaptor-chip-halo" x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="11" ry="11"/>` +
        `<rect class="adaptor-chip-bg" x="${x}" y="${y}" width="${w}" height="${h}" rx="9" ry="9"/>` +
        `<text class="adaptor-chip-text" x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central">${_escSvg(label)}</text>` +
      `</g>`
    );
  }
  function drawEdges() {
    // During animated fit-to-view, canvas transform is tweening in CSS while
    // pan/zoom state is already at the destination. Reprojecting ports against
    // the destination transform mid-tween causes visible edge jumps; wait for
    // fit completion, then do one authoritative redraw.
    if (fitToNodes._transitioning) return;
    // Cache canvas rect once per redraw so N edges cost 1 DOM read instead of 2N.
    const canvasRect = opts.editable ? canvasEl.getBoundingClientRect() : null;
    _occluderCache = opts.editable ? _buildOccluderCache() : null;
    const dotParts = [];
    const pushConn = (c, i, parts) => {
      const a = getPortPos(c.from[0], c.from[1], c.from[2], canvasRect);
      const b = getPortPos(c.to[0],   c.to[1],   c.to[2],   canvasRect);
      if (!a || !b) return;
      const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
      const d = `M ${a.x} ${a.y} C ${a.x+dx} ${a.y}, ${b.x-dx} ${b.y}, ${b.x} ${b.y}`;
      if (opts.editable) parts.push(`<path class="edge-hit" data-conn-idx="${i}" d="${d}"/>`);
      const edgeKey = _edgeKeyFromNodes(c.from[0], c.to[0]);
      const edgeCls = opts.simpleNodes ? 'edge-line simple-edge' : 'edge-line';
      parts.push(`<path class="${edgeCls}" data-edge-key="${edgeKey}" d="${d}"/>`);
      if (c.adaptor) parts.push(_adaptorChipSvg(a, b, c, i));
      // Read-only mode marks edge endpoints with dots. In simple-node mode the
      // node's own anchors already sit at each endpoint, so these would render
      // as a redundant (unstyled, black) circle behind every anchor — skip them.
      if (!opts.editable && !opts.simpleNodes) {
        dotParts.push(`<circle cx="${a.x}" cy="${a.y}" r="4"/>`);
        dotParts.push(`<circle cx="${b.x}" cy="${b.y}" r="4"/>`);
      }
    };
    if (opts.editable) {
      const { back, front } = _ensureEdgeOverlaysEdit();
      const EDGE_FLOW_BLUR_DEFS =
        '<defs><filter id="edgeFlowBlur" filterUnits="userSpaceOnUse" x="-800000" y="-800000" width="1600000" height="1600000">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="1.25"/></filter></defs>';
      const backParts = [EDGE_FLOW_BLUR_DEFS];
      const frontDefs = [];
      const frontParts = [];
      const internalByGroup = new Map();
      CONNECTIONS.forEach((c, i) => {
        if (_isInternalCollapsedSubgraphEdge(c)) {
          _pushCollapsedInternalEdgePlaceholder(c, i, backParts);
          return;
        }
        const gf0 = _getSubgraphGroupIdForNode(c.from[0]);
        const gt0 = _getSubgraphGroupIdForNode(c.to[0]);
        if (gf0 && gf0 === gt0 && _expandedSubgraphBoxForGroupId(gf0)) {
          const a = getPortPos(c.from[0], c.from[1], c.from[2], canvasRect);
          const b = getPortPos(c.to[0], c.to[1], c.to[2], canvasRect);
          if (!a || !b) return;
          const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
          const d = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
          const edgeKey = _edgeKeyFromNodes(c.from[0], c.to[0]);
          if (!internalByGroup.has(gf0)) internalByGroup.set(gf0, []);
          internalByGroup.get(gf0).push({ i, d, edgeKey, c, a, b });
          return;
        }
        if (!_edgeTouchesSubgraphMember(c)) {
          pushConn(c, i, backParts);
          return;
        }
        const a = getPortPos(c.from[0], c.from[1], c.from[2], canvasRect);
        const b = getPortPos(c.to[0],   c.to[1],   c.to[2], canvasRect);
        if (!a || !b) return;
        const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
        const d = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
        const edgeKey = _edgeKeyFromNodes(c.from[0], c.to[0]);
        backParts.push(
          `<g filter="url(#edgeFlowBlur)" opacity="0.5" pointer-events="none">` +
          `<path class="edge-line edge-line--underflow" data-edge-key="${edgeKey}" d="${d}"/>` +
          `</g>`
        );
        const gf = _getSubgraphGroupIdForNode(c.from[0]);
        const gt = _getSubgraphGroupIdForNode(c.to[0]);
        const ex = new Set([gf, gt].filter(Boolean));
        const exNodes = new Set([c.from[0], c.to[0]]);
        const maskOk = typeof window.getSubgraphGroupIdForNode === 'function' && ex.size > 0;
        const maskId = `sg-edge-m-${i}`;
        if (maskOk) {
          const occluders = _subgraphOccluderMaskRects(ex, exNodes, ex);
          frontDefs.push(
            `<mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" ` +
            `x="-600000" y="-600000" width="1200000" height="1200000">` +
            `<rect x="-600000" y="-600000" width="1200000" height="1200000" fill="white"/>` +
            `${occluders}</mask>`
          );
          frontParts.push(
            `<g mask="url(#${maskId})">` +
            `<path class="edge-hit" data-conn-idx="${i}" d="${d}"/>` +
            `<path class="edge-line" data-edge-key="${edgeKey}" d="${d}"/>` +
            (c.adaptor ? _adaptorChipSvg(a, b, c, i) : '') +
            `</g>`
          );
        } else {
          frontParts.push(
            `<path class="edge-hit" data-conn-idx="${i}" d="${d}"/>` +
            `<path class="edge-line" data-edge-key="${edgeKey}" d="${d}"/>` +
            (c.adaptor ? _adaptorChipSvg(a, b, c, i) : '')
          );
        }
      });
      back.innerHTML = backParts.join('');
      front.innerHTML = (frontDefs.length ? `<defs>${frontDefs.join('')}</defs>` : '') + frontParts.join('');
      _renderInternalSubgraphEdgeSvgs(internalByGroup);
    } else {
      const svg = _ensureEdgeOverlay();
      const parts = [];
      CONNECTIONS.forEach((c, i) => {
        if (_isInternalCollapsedSubgraphEdge(c)) {
          _pushCollapsedInternalEdgePlaceholder(c, i, parts);
        } else {
          pushConn(c, i, parts);
        }
      });
      svg.innerHTML = parts.join('');
      _ensureDotsOverlay().innerHTML = dotParts.join('');
    }
    _updateConnectedPorts();
    if (typeof window.syncSubgraphCollapsedPortConnectedState === 'function') {
      try { window.syncSubgraphCollapsedPortConnectedState(CONNECTIONS); } catch (_) { /* host shell */ }
    }
    _wireEdgeHoverPips();
    if (edgeBubbleConn && !CONNECTIONS.includes(edgeBubbleConn)) _hideEdgeBubble();
    else _refreshActiveEdge();
    _applyRunFlowClasses();
  }

  // Sync endpoint pips to edge hover: when the user mouses over an edge's
  // transparent hit path, add `.edge-hovered` to the two corresponding
  // `.port-anchor` elements so the dots turn blue along with the line.
  // Without this the line changes color on hover but the pips stay grey,
  // which visually disconnects the line from the ports it attaches to.
  function _wireEdgeHoverPips() {
    if (!opts.editable) return;
    // Clear stale `.edge-hovered` from any anchor — re-rendering edges destroys
    // the hit path mid-hover, so its mouseleave never fires and the dot stays blue.
    document.querySelectorAll('.port-anchor.edge-hovered, .sg-row-port.edge-hovered')
      .forEach(a => a.classList.remove('edge-hovered'));
    const hits = [];
    if (edgeOverlayBack) hits.push(...edgeOverlayBack.querySelectorAll('.edge-hit'));
    if (edgeOverlayFront) hits.push(...edgeOverlayFront.querySelectorAll('.edge-hit'));
    document.querySelectorAll('.sg-internal-edges .edge-hit').forEach((h) => hits.push(h));
    if (!hits.length) return;
    hits.forEach(hit => {
      const idx = parseInt(hit.dataset.connIdx, 10);
      const c = CONNECTIONS[idx];
      if (!c) return;
      const a = _getAnchorForEdgeEnd(c.from);
      const b = _getAnchorForEdgeEnd(c.to);
      const on  = () => { a?.classList.add('edge-hovered');    b?.classList.add('edge-hovered'); };
      const off = () => { a?.classList.remove('edge-hovered'); b?.classList.remove('edge-hovered'); };
      hit.addEventListener('mouseenter', on);
      hit.addEventListener('mouseleave', off);
    });
  }

  function _updateConnectedPorts() {
    nodeState.forEach(s => {
      s.el.querySelectorAll('.port-anchor').forEach(a => a.classList.remove('connected'));
      if (opts.simpleNodes) s.el.querySelectorAll('.simple-anchor, .simple-port-anchor').forEach(a => a.classList.remove('connected'));
    });
    CONNECTIONS.forEach(c => {
      const mark = (nodeId, dir, ioName) => {
        const s = nodeState.get(nodeId);
        if (!s) return;
        if (opts.simpleNodes) {
          s.el.querySelector(dir === 'in' ? '.simple-anchor-in' : '.simple-anchor-out')?.classList.add('connected');
          const pa = s.el.querySelector(`.simple-port-anchor[data-io-dir="${dir}"][data-io-name="${CSS.escape(String(ioName))}"]`);
          pa?.classList.add('connected');
          return;
        }
        s.el.querySelector(`[data-io="${dir}:${ioName}"]`)
            ?.querySelector('.port-anchor')?.classList.add('connected');
      };
      mark(c.from[0], c.from[1], c.from[2]);
      mark(c.to[0],   c.to[1],   c.to[2]);
    });
  }

  // ── Drag (nodes) + unified surface stack (nodes share one z band with host shells) ──
  let dragState = null;
  /** Next z-index for interactive "bring to front" (loose nodes, subgraph shells, etc.). */
  let surfaceZSeq = Z_NODE_BASE - 1;
  function _setNodeZ(node, z) {
    node.style.zIndex = z;
    const s = nodeState.get(node.dataset.nodeId);
    if (s) s.overlayEl.style.zIndex = z;
  }
  function _renormSurfaceZStack() {
    const all = [...nodeState.values()].map(s => s.el)
      .sort((a, b) => (parseInt(a.style.zIndex, 10) || Z_NODE_BASE) - (parseInt(b.style.zIndex, 10) || Z_NODE_BASE));
    all.forEach((n, i) => _setNodeZ(n, Z_NODE_BASE + i));
    surfaceZSeq = Z_NODE_BASE + all.length;
    if (typeof window.__connectifyAfterSurfaceRenorm === 'function') {
      try { window.__connectifyAfterSurfaceRenorm(); } catch (_) { /* host shell */ }
    }
  }
  /** Reserve `count` consecutive z-indices at the top of the interactive stack (e.g. shell / members / head). */
  function allocSurfaceZSlots(count) {
    const n = Math.max(1, Number(count) || 1);
    surfaceZSeq += n;
    if (surfaceZSeq >= Z_NODE_RENORM_CEIL) {
      _renormSurfaceZStack();
      return allocSurfaceZSlots(n);
    }
    return surfaceZSeq - n + 1;
  }
  /** Assign z to a node + overlay without advancing the global counter (host keeps subgraph members aligned). */
  function setNodeSurfaceZ(nodeId, z, options) {
    const s = nodeState.get(nodeId);
    if (!s) return;
    const zi = Math.round(Number(z)) || Z_NODE_BASE;
    const prev = parseInt(s.el.style.zIndex, 10) || Z_NODE_BASE;
    if (prev === zi) return;
    _setNodeZ(s.el, zi);
    surfaceZSeq = Math.max(surfaceZSeq, zi);
    if (!options || options.redraw !== false) drawEdges();
  }
  function bumpNodeSurfaceFront(nodeId) {
    const s = nodeState.get(nodeId);
    if (!s) return;
    _bringToFront(s.el);
  }
  function _bringToFront(node) {
    const id = node.dataset.nodeId;
    if (id && typeof window.__connectifySurfaceBumpNode === 'function') {
      try {
        if (window.__connectifySurfaceBumpNode(id, node)) return;
      } catch (_) { /* host shell */ }
    }
    if (++surfaceZSeq >= Z_NODE_RENORM_CEIL) {
      _renormSurfaceZStack();
    }
    _setNodeZ(node, surfaceZSeq);
    drawEdges();
  }
  function _attachCanvasDrag() {
    canvasInner.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const head = e.target.closest('.node-head');
      if (!head || e.target.closest('.menu-dots')) return;
      e.preventDefault(); e.stopPropagation();
      // Use closest('.node') rather than head.parentElement: in simple-node mode
      // the head is nested inside .node-simple-core, so parentElement would grab
      // the inner wrapper and leave the positioned .node card behind.
      const node = head.closest('.node');
      dragState = {
        node,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: parseFloat(node.style.left)||0,
        startTop: parseFloat(node.style.top)||0,
        moved: false,
      };
      _bringToFront(node); node.classList.add('dragging');
      document.addEventListener('mousemove', _onDragMove);
      document.addEventListener('mouseup', _onDragEnd, { once: true });
    });
  }
  function _onDragMove(e) {
    if (!dragState) return;
    if (!dragState.moved && Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) > 2) {
      dragState.moved = true;
    }
    dragState.node.style.left = (dragState.startLeft + (e.clientX - dragState.startX) / zoom) + 'px';
    dragState.node.style.top  = (dragState.startTop  + (e.clientY - dragState.startY) / zoom) + 'px';
    drawEdges();
    _refreshOverlaps();
  }
  function _onDragEnd() {
    if (dragState) {
      // Sync the committed position back into the node's data object so
      // getAllNodes()/snapshots see the latest world coords (drag updates
      // only the DOM element style during the gesture).
      const nodeEl = dragState.node;
      const id = nodeEl.dataset.nodeId;
      const s = id && nodeState.get(id);
      if (s) {
        s.data.x = parseFloat(nodeEl.style.left) || 0;
        s.data.y = parseFloat(nodeEl.style.top)  || 0;
      }
      const didMove = !!dragState.moved;
      if (didMove) {
        suppressNodeFocus = {
          id,
          until: Date.now() + 480,
        };
      }
      dragState.node.classList.remove('dragging');
      dragState = null;
      // A plain click on a node head should not emit a move mutation; this
      // avoids unnecessary host re-layout work (and tiny subgroup reflow nudges).
      if (didMove) _fireChange('move-node');
    }
    document.removeEventListener('mousemove', _onDragMove);
    _refreshOverlaps();
  }

  let layoutAnimRaf = null;

  // Apply a batch of node positions in one mutation so hosts get a single
  // undo checkpoint (e.g. auto-layout). Supports optional smooth animation.
  function applyNodeLayout(layoutById, options) {
    if (!layoutById || typeof layoutById !== 'object') return false;
    const cfg = Object.assign({
      animate: false,
      duration: 460,
      easing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      onFrame: null,
      onComplete: null,
    }, options || {});

    const movers = [];
    for (const [id, pos] of Object.entries(layoutById)) {
      const s = nodeState.get(id);
      if (!s || !pos) continue;
      const nx = Number(pos.x), ny = Number(pos.y);
      if (!isFinite(nx) || !isFinite(ny)) continue;
      const ox = Number(s.data.x) || 0;
      const oy = Number(s.data.y) || 0;
      if (Math.abs(ox - nx) < 0.5 && Math.abs(oy - ny) < 0.5) continue;
      movers.push({ s, ox, oy, nx, ny });
    }
    if (!movers.length) return false;

    const complete = () => {
      _refreshOverlaps();
      _fireChange('layout-nodes');
      if (typeof cfg.onComplete === 'function') {
        try { cfg.onComplete(); } catch (_) { /* non-fatal host callback */ }
      }
    };

    if (!cfg.animate) {
      movers.forEach(m => {
        m.s.data.x = m.nx;
        m.s.data.y = m.ny;
        m.s.el.style.left = m.nx + 'px';
        m.s.el.style.top  = m.ny + 'px';
      });
      drawEdges();
      if (typeof cfg.onFrame === 'function') {
        try { cfg.onFrame(1); } catch (_) { /* non-fatal host callback */ }
      }
      complete();
      return true;
    }

    if (layoutAnimRaf) {
      cancelAnimationFrame(layoutAnimRaf);
      layoutAnimRaf = null;
    }
    const duration = Math.max(120, Number(cfg.duration) || 460);
    movers.forEach(m => {
      m.s.data.x = m.nx;
      m.s.data.y = m.ny;
      const prevTransition = m.s.el.style.transition || '';
      m.prevTransition = prevTransition;
      const sep = prevTransition && !prevTransition.trim().endsWith(',') ? ', ' : '';
      m.s.el.style.transition = `${prevTransition}${sep}left ${duration}ms ${cfg.easing}, top ${duration}ms ${cfg.easing}`;
      m.s.el.style.left = m.nx + 'px';
      m.s.el.style.top  = m.ny + 'px';
    });

    const startedAt = performance.now();
    const tick = () => {
      drawEdges();
      const elapsed = performance.now() - startedAt;
      if (typeof cfg.onFrame === 'function') {
        const progress = Math.max(0, Math.min(1, elapsed / duration));
        try { cfg.onFrame(progress); } catch (_) { /* non-fatal host callback */ }
      }
      if (elapsed < duration + 32) {
        layoutAnimRaf = requestAnimationFrame(tick);
        return;
      }
      layoutAnimRaf = null;
      movers.forEach(m => { m.s.el.style.transition = m.prevTransition; });
      drawEdges();
      complete();
    };
    layoutAnimRaf = requestAnimationFrame(tick);
    return true;
  }

  // ── Overlap detection: nodes whose bounding boxes intersect get a stronger shadow ──
  function _rectsOverlap(a, b) {
    return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  }
  function _refreshOverlaps() {
    const entries = [];
    nodeState.forEach(s => {
      const el = s.el;
      const left = parseFloat(el.style.left) || 0;
      const top  = parseFloat(el.style.top)  || 0;
      const w    = el.offsetWidth  || 200;
      const h    = el.offsetHeight || 100;
      const z    = parseInt(el.style.zIndex, 10) || 0;
      entries.push({ el, z, rect: { left, top, right: left + w, bottom: top + h } });
    });
    // Only the TOP card in each overlap pair gets the shadow.
    const onTop = new Set();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (_rectsOverlap(entries[i].rect, entries[j].rect)) {
          const top = entries[i].z >= entries[j].z ? entries[i] : entries[j];
          onTop.add(top.el);
        }
      }
    }
    entries.forEach(e => e.el.classList.toggle('overlapping', onTop.has(e.el)));
  }

  // ── Port drag (connections) ──────────────────────────
  let ropeState = null, ropeOverlay = null;

  function _ensureRopeOverlay() {
    if (ropeOverlay) return ropeOverlay;
    ropeOverlay = document.createElementNS(SVG_NS, 'svg');
    ropeOverlay.setAttribute('class', 'drag-rope-overlay');
    canvasInner.appendChild(ropeOverlay);
    return ropeOverlay;
  }
  function _mouseToWorld(e) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: (e.clientX - rect.left - panX) / zoom, y: (e.clientY - rect.top - panY) / zoom };
  }
  function _attachPortDrag() {
    canvasInner.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const anchor = e.target.closest('.port-anchor');
      if (!anchor) return;
      e.preventDefault(); e.stopPropagation();
      const row     = anchor.closest('.io-row');
      const nodeEl  = anchor.closest('.node');
      if (!row || !nodeEl) return;
      const nodeId  = nodeEl.dataset.nodeId;
      const dir     = row.dataset.dir;
      const type    = row.dataset.type;
      const ioName  = row.dataset.io.split(':').slice(1).join(':');

      // Only inputs can be "picked up" mid-drag. An input accepts exactly one
      // upstream source, so dragging its already-wired pip should detach the
      // existing edge and re-anchor the rope to the upstream output. Outputs
      // can fan out to many inputs, so dragging a wired output always starts
      // a NEW edge and leaves every existing edge on that output untouched.
      const origin = { nodeId, dir, type, ioName };
      const existingIdx = dir === 'in'
        ? CONNECTIONS.findIndex(c => c.to[0] === nodeId && c.to[2] === ioName)
        : -1;
      const pendingPickup = existingIdx >= 0 ? CONNECTIONS[existingIdx] : null;

      const startPos = getPortPos(origin.nodeId, origin.dir, origin.ioName);
      ropeState = {
        origin, startPos,
        endX: startPos.x, endY: startPos.y,
        mouseDownX: e.clientX, mouseDownY: e.clientY,
        committed: false,
        pendingPickup, clickedDir: dir, clickedType: type
      };
      document.addEventListener('mousemove', _onRopeMove);
      document.addEventListener('mouseup', _onRopeEnd, { once: true });
    });
  }
  function _onRopeMove(e) {
    if (!ropeState) return;
    if (!ropeState.committed) {
      const dx = e.clientX - ropeState.mouseDownX;
      const dy = e.clientY - ropeState.mouseDownY;
      if (Math.hypot(dx, dy) < 3) return;
      ropeState.committed = true;

      // If the user grabbed an already-wired port, pick up the connection now:
      // remove it from CONNECTIONS and re-anchor the rope to the OTHER end.
      if (ropeState.pendingPickup) {
        const existing = ropeState.pendingPickup;
        CONNECTIONS = CONNECTIONS.filter(c => c !== existing);
        const clickedDir = ropeState.clickedDir;
        const clickedType = ropeState.clickedType;
        if (clickedDir === 'out') {
          const other = nodeState.get(existing.to[0]);
          const p = (other?.data.inputs || []).find(pp => pp.name === existing.to[2]);
          ropeState.origin = { nodeId: existing.to[0], dir: 'in', type: (p?.type || clickedType).toLowerCase(), ioName: existing.to[2] };
        } else {
          const other = nodeState.get(existing.from[0]);
          const p = (other?.data.outputs || []).find(pp => pp.name === existing.from[2]);
          ropeState.origin = { nodeId: existing.from[0], dir: 'out', type: (p?.type || clickedType).toLowerCase(), ioName: existing.from[2] };
        }
        ropeState.startPos = getPortPos(ropeState.origin.nodeId, ropeState.origin.dir, ropeState.origin.ioName) || ropeState.startPos;
        ropeState.pendingPickup = null;
        drawEdges();
      }

      canvasInner.classList.add('dragging-rope');
      _markCompatibility(ropeState.origin);
      _ensureRopeOverlay().style.display = 'block';
    }
    const w = _mouseToWorld(e);
    ropeState.endX = w.x; ropeState.endY = w.y;

    // Auto-expand collapsed section when hovering its header or io-list region
    const elUnder = document.elementFromPoint(e.clientX, e.clientY);
    const sec = elUnder?.closest?.('.node-section.collapsed');
    if (sec) {
      sec.classList.remove('collapsed');
      sec.nextElementSibling?.classList.remove('collapsed');
      _markCompatibility(ropeState.origin);
      drawEdges();
      // Refresh origin port position in case the origin node's layout shifted
      ropeState.startPos = getPortPos(ropeState.origin.nodeId, ropeState.origin.dir, ropeState.origin.ioName) || ropeState.startPos;
    }

    // Track hovered droppable row so it can light up. Adaptable rows count
    // as a drop target too (they just route through the adaptor modal on
    // release instead of committing silently).
    const hoveredRow = elUnder?.closest?.('.io-row.compatible, .io-row.adaptable') || null;
    _setDropHover(hoveredRow);

    _drawRope();
  }
  function _drawRope() {
    if (!ropeState) return;
    const a = ropeState.startPos, b = { x: ropeState.endX, y: ropeState.endY };
    // Flip control point direction if origin is an input (rope flows the other way).
    const leftX  = ropeState.origin.dir === 'out' ? a.x : b.x;
    const rightX = ropeState.origin.dir === 'out' ? b.x : a.x;
    const dx = Math.max(40, Math.abs(rightX - leftX) / 2);
    const c1x = ropeState.origin.dir === 'out' ? a.x + dx : a.x - dx;
    const c2x = ropeState.origin.dir === 'out' ? b.x - dx : b.x + dx;
    const d = `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`;
    _ensureRopeOverlay().innerHTML = `<path d="${d}"/>`;
  }
  function _onRopeEnd(e) {
    document.removeEventListener('mousemove', _onRopeMove);
    if (!ropeState) return;
    const { origin, committed } = ropeState;

    // Capture target BEFORE clearing compatibility classes (which removes the marks).
    const under     = document.elementFromPoint(e.clientX, e.clientY);
    const targetRow = committed ? under?.closest?.('.io-row') : null;
    const isCompat  = targetRow?.classList.contains('compatible') ?? false;
    const isAdapt   = targetRow?.classList.contains('adaptable')  ?? false;
    const isValid   = isCompat || isAdapt;
    // Snapshot the target row's type BEFORE _clearCompatibility strips classes,
    // so we can resolve the adaptor after the overlay teardown.
    const targetType = targetRow?.dataset?.type || '';

    _clearCompatibility();
    canvasInner.classList.remove('dragging-rope');
    if (ropeOverlay) { ropeOverlay.style.display = 'none'; ropeOverlay.innerHTML = ''; }
    ropeState = null;

    if (!committed || !isValid || !targetRow) { drawEdges(); return; }

    const targetNodeEl = targetRow.closest('.node');
    const targetNodeId = targetNodeEl.dataset.nodeId;
    const targetIoName = targetRow.dataset.io.split(':').slice(1).join(':');
    const targetDir    = targetRow.dataset.dir;
    const from = origin.dir === 'out'
      ? [origin.nodeId, 'out', origin.ioName]
      : [targetNodeId,  'out', targetIoName];
    const to = origin.dir === 'out'
      ? [targetNodeId,  'in', targetIoName]
      : [origin.nodeId, 'in', origin.ioName];

    const pair = _ropeTypePair(origin, targetDir, targetType);
    const adaptor = isAdapt ? _getAdaptor(pair.fromType, pair.toType) : null;
    const existingOnInput = CONNECTIONS.find(c => c.to[0] === to[0] && c.to[2] === to[2]);

    // Commit helper — applied by every resolution path below so semantics
    // stay identical whether we went through a modal or not.
    const commit = (extra) => {
      if (existingOnInput) {
        CONNECTIONS = CONNECTIONS.filter(c => c !== existingOnInput);
      }
      const next = { from, to };
      if (adaptor) {
        next.adaptor = _persistableAdaptor(adaptor);
        const xs = extra && extra.adaptorSettings;
        if (xs && typeof xs === 'object' && Object.keys(xs).length) {
          next.adaptorSettings = { ...xs };
        }
      }
      CONNECTIONS.push(next);
      drawEdges();
      _fireChange('add-connection');
    };

    // If an adaptor is needed, surface it first (a single modal can describe
    // both "insert adaptor" and "replace existing"). Hosts that haven't
    // registered a callback fall through to the silent path, preserving
    // backward compatibility.
    if (adaptor && onAdaptorRequiredCb) {
      drawEdges();
      onAdaptorRequiredCb({
        pending: { from, to },
        adaptor: { ...adaptor },
        existing: existingOnInput || null,
      }, commit);
      return;
    }
    if (existingOnInput && onConnectionConflictCb) {
      drawEdges();
      onConnectionConflictCb(existingOnInput, { from, to, adaptor: adaptor ? { ...adaptor } : undefined }, commit);
      return;
    }
    commit();
  }
  function _alreadyConnected(origin, targetNodeId, targetDir, targetIoName) {
    return CONNECTIONS.some(c => {
      if (origin.dir === 'out') {
        return c.from[0] === origin.nodeId && c.from[2] === origin.ioName &&
               c.to[0]   === targetNodeId  && c.to[2]   === targetIoName;
      }
      return c.to[0]   === origin.nodeId && c.to[2]   === origin.ioName &&
             c.from[0] === targetNodeId  && c.from[2] === targetIoName;
    });
  }
  // Resolve the source/target types for an in-progress rope landing on `row`.
  // The source is always the output end, regardless of which direction the
  // user grabbed the rope from — so flipping drag direction doesn't flip the
  // adaptor table lookup.
  function _ropeTypePair(origin, rowDir, rowType) {
    const fromType = origin.dir === 'out' ? origin.type : rowType;
    const toType   = origin.dir === 'out' ? rowType     : origin.type;
    return { fromType, toType };
  }
  function _markCompatibility(origin) {
    nodeState.forEach(s => {
      s.el.querySelectorAll('.io-row').forEach(row => {
        row.classList.remove('compatible', 'adaptable', 'incompatible', 'rope-origin');
        const rowDir    = row.dataset.dir;
        const rowType   = row.dataset.type;
        const rowIoName = row.dataset.io.split(':').slice(1).join(':');
        // The row the rope is anchored at — keep it visible & highlighted
        if (s.data.id === origin.nodeId && rowDir === origin.dir && rowIoName === origin.ioName) {
          row.classList.add('rope-origin');
          return;
        }
        const structurallyValid =
          s.data.id !== origin.nodeId &&
          rowDir   !== origin.dir     &&
          !_alreadyConnected(origin, s.data.id, rowDir, rowIoName);
        if (!structurallyValid) { row.classList.add('incompatible'); return; }
        if (rowType === origin.type) { row.classList.add('compatible'); return; }
        const pair = _ropeTypePair(origin, rowDir, rowType);
        if (_getAdaptor(pair.fromType, pair.toType)) { row.classList.add('adaptable'); return; }
        row.classList.add('incompatible');
      });
    });
  }
  function _clearCompatibility() {
    nodeState.forEach(s => {
      s.el.querySelectorAll('.io-row').forEach(row => row.classList.remove('compatible', 'adaptable', 'incompatible', 'rope-origin', 'drop-hover'));
    });
  }
  function _setDropHover(row) {
    // Only one row carries .drop-hover at a time
    if (ropeState && ropeState._hoverRow === row) return;
    if (ropeState && ropeState._hoverRow) ropeState._hoverRow.classList.remove('drop-hover');
    if (ropeState) ropeState._hoverRow = row || null;
    if (row) row.classList.add('drop-hover');
  }

  // ── Simple-node connection system (opts.simpleNodes) ──
  // Low-friction model: drag a node's side anchor onto a *target node* (not a
  // precise port). On release we resolve every type-compatible (output→input)
  // pair between the two nodes and either connect directly (one match, routing
  // through the adaptor dialog when types differ), or pop a small picker (many
  // matches). Entirely parallel to the classic port-anchor rope above — none
  // of that code runs in simple mode, so flipping simpleNodes off is a clean
  // revert.
  let simpleRopeState = null;

  function _attachSimplePortDrag() {
    canvasInner.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      // A per-port ghost anchor pins the origin to one specific input/output;
      // the unified side anchor leaves the origin port open (resolved on drop).
      const portAnchor = e.target.closest('.simple-port-anchor');
      const anchor = portAnchor || e.target.closest('.simple-anchor');
      if (!anchor) return;
      e.preventDefault(); e.stopPropagation();
      const nodeEl = anchor.closest('.node');
      if (!nodeEl) return;
      const nodeId = nodeEl.dataset.nodeId;
      const dir = portAnchor
        ? (portAnchor.dataset.ioDir === 'in' ? 'in' : 'out')
        : (anchor.dataset.simpleAnchor === 'in' ? 'in' : 'out');
      const port = portAnchor ? portAnchor.dataset.ioName : null;
      const origin = port ? { nodeId, dir, port } : { nodeId, dir };
      const startPos = getPortPos(nodeId, dir, port) || { x: 0, y: 0 };
      simpleRopeState = {
        origin,
        startPos,
        endX: startPos.x, endY: startPos.y,
        mouseDownX: e.clientX, mouseDownY: e.clientY,
        committed: false, _hoverNode: null,
      };
      document.addEventListener('mousemove', _onSimpleRopeMove);
      document.addEventListener('mouseup', _onSimpleRopeEnd, { once: true });
    });
  }
  function _onSimpleRopeMove(e) {
    if (!simpleRopeState) return;
    if (!simpleRopeState.committed) {
      const dx = e.clientX - simpleRopeState.mouseDownX;
      const dy = e.clientY - simpleRopeState.mouseDownY;
      if (Math.hypot(dx, dy) < 3) return;
      simpleRopeState.committed = true;
      canvasInner.classList.add('dragging-rope', 'dragging-simple-rope');
      _ensureRopeOverlay();
      ropeOverlay.classList.add('simple');
      ropeOverlay.style.display = 'block';
      _markSimpleCompatibility(simpleRopeState.origin);
    }
    const w = _mouseToWorld(e);
    simpleRopeState.endX = w.x; simpleRopeState.endY = w.y;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    // A member row inside a collapsed subgraph is also a valid landing spot.
    // Its hidden member node is display:none, so the only thing under the
    // cursor is the box's summary row — resolve it before the .node lookup.
    const sgHit = _simpleCollapsedRowAt(under);
    const nodeEl = sgHit ? null : under?.closest?.('.node');
    _setSimpleDropHover(nodeEl?.dataset?.nodeId || null);
    const sgRow = (sgHit && sgHit.row.classList.contains('sg-drop-valid')) ? sgHit.row : null;
    _setSimpleSgRowHover(sgRow);
    // Snap the rope end onto the hovered member's receiving edge.
    if (sgRow) {
      const snap = _simpleSgRowPortWorld(sgRow, simpleRopeState.origin.dir === 'out' ? 'in' : 'out');
      if (snap) { simpleRopeState.endX = snap.x; simpleRopeState.endY = snap.y; }
    }
    // Track the specific input/output row the cursor is over so release can
    // connect to exactly that port (only meaningful inside the hovered target).
    const rowEl = (nodeEl && nodeEl.dataset.nodeId === simpleRopeState._hoverNode)
      ? under?.closest?.('.nsp-row') : null;
    _setSimpleRowHover(rowEl && rowEl.classList.contains('nsp-valid') ? rowEl : null);
    _drawSimpleRope();
  }
  function _drawSimpleRope() {
    if (!simpleRopeState) return;
    const a = simpleRopeState.startPos;
    const b = { x: simpleRopeState.endX, y: simpleRopeState.endY };
    const outDir = simpleRopeState.origin.dir === 'out';
    const leftX  = outDir ? a.x : b.x;
    const rightX = outDir ? b.x : a.x;
    const dx = Math.max(40, Math.abs(rightX - leftX) / 2);
    const c1x = outDir ? a.x + dx : a.x - dx;
    const c2x = outDir ? b.x - dx : b.x + dx;
    const d = `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`;
    _ensureRopeOverlay().innerHTML = `<path d="${d}"/>`;
  }
  function _onSimpleRopeEnd(e) {
    document.removeEventListener('mousemove', _onSimpleRopeMove);
    if (!simpleRopeState) return;
    const { origin, committed } = simpleRopeState;
    const under = committed ? document.elementFromPoint(e.clientX, e.clientY) : null;
    // Dropping on a valid member row of a collapsed subgraph wires to that
    // hidden node. The box exposes no per-port row, so there's no droppedPort —
    // pairs resolve generally (single match connects, many → picker).
    const sgHit = under ? _simpleCollapsedRowAt(under) : null;
    const sgTargetId = (sgHit && sgHit.row.classList.contains('sg-drop-valid')) ? sgHit.nodeId : null;
    const targetId = sgTargetId || under?.closest?.('.node')?.dataset?.nodeId || null;
    // If the cursor landed on a specific (valid) port row inside the target,
    // remember which port so we connect to exactly that one.
    const rowEl = sgTargetId ? null : under?.closest?.('.nsp-row');
    const droppedPort = (rowEl && rowEl.classList.contains('nsp-valid')
      && rowEl.closest('.node')?.dataset?.nodeId === targetId)
      ? { dir: rowEl.dataset.ioDir, name: rowEl.dataset.ioName } : null;
    const clientX = e.clientX, clientY = e.clientY;
    _clearSimpleCompatibility();
    canvasInner.classList.remove('dragging-rope', 'dragging-simple-rope');
    if (ropeOverlay) { ropeOverlay.classList.remove('simple'); ropeOverlay.style.display = 'none'; ropeOverlay.innerHTML = ''; }
    simpleRopeState = null;
    if (!committed || !targetId || targetId === origin.nodeId) { drawEdges(); return; }
    const { srcNodeId, dstNodeId, pairs } = _simpleValidPairs(origin, targetId);
    if (!pairs.length) { drawEdges(); return; }
    // Narrow to the dropped-on port, if any. Doing so flips which side still
    // needs disambiguating: the target port is now fixed, so any remaining
    // choice is on the origin side.
    let candidates = pairs;
    let pickSide = origin.dir === 'out' ? 'in' : 'out'; // side being chosen
    if (droppedPort) {
      candidates = pairs.filter(p =>
        (droppedPort.dir === 'in' ? p.in.name : p.out.name) === droppedPort.name);
      pickSide = origin.dir; // target port chosen → remaining choice is origin side
    }
    if (!candidates.length) { drawEdges(); return; }
    if (candidates.length === 1) {
      _commitSimpleConnection(srcNodeId, candidates[0].out, dstNodeId, candidates[0].in, candidates[0].adaptor);
      return;
    }
    const noun = pickSide === 'out' ? 'output' : 'input';
    _showSimplePortPicker({ srcNodeId, dstNodeId, pairs: candidates, clientX, clientY, title: `Select an ${noun}` });
  }
  // All connectable (output→input) pairs between the rope origin and a target
  // node, given the drag direction. Exact type matches sort ahead of adaptor
  // bridges; pairs already wired are skipped.
  function _simpleValidPairs(origin, targetNodeId) {
    const srcNodeId = origin.dir === 'out' ? origin.nodeId : targetNodeId;
    const dstNodeId = origin.dir === 'out' ? targetNodeId : origin.nodeId;
    let outs = (nodeState.get(srcNodeId)?.data.outputs) || [];
    let ins  = (nodeState.get(dstNodeId)?.data.inputs)  || [];
    // If the drag started from a specific port (ghost anchor), restrict the
    // origin side to just that port so only its compatible pairs are offered.
    if (origin.port) {
      if (origin.dir === 'out') outs = outs.filter(o => o.name === origin.port);
      else                      ins  = ins.filter(i => i.name === origin.port);
    }
    const pairs = [];
    outs.forEach(o => {
      ins.forEach(i => {
        const already = CONNECTIONS.some(c =>
          c.from[0] === srcNodeId && c.from[2] === o.name &&
          c.to[0]   === dstNodeId && c.to[2]   === i.name);
        if (already) return;
        const ot = (o.type || '').toLowerCase();
        const it = (i.type || '').toLowerCase();
        if (ot === it) { pairs.push({ out: o, in: i, adaptor: null, exact: true }); return; }
        const ad = _getAdaptor(ot, it);
        if (ad) pairs.push({ out: o, in: i, adaptor: ad, exact: false });
      });
    });
    pairs.sort((a, b) => (b.exact - a.exact));
    return { srcNodeId, dstNodeId, pairs };
  }
  function _commitSimpleConnection(srcNodeId, out, dstNodeId, inp, adaptor) {
    const from = [srcNodeId, 'out', out.name];
    const to   = [dstNodeId, 'in',  inp.name];
    const existingOnInput = CONNECTIONS.find(c => c.to[0] === to[0] && c.to[2] === to[2]);
    const commit = (extra) => {
      if (existingOnInput) CONNECTIONS = CONNECTIONS.filter(c => c !== existingOnInput);
      const next = { from, to };
      if (adaptor) {
        next.adaptor = _persistableAdaptor(adaptor);
        const xs = extra && extra.adaptorSettings;
        if (xs && typeof xs === 'object' && Object.keys(xs).length) next.adaptorSettings = { ...xs };
      }
      CONNECTIONS.push(next);
      drawEdges();
      _fireChange('add-connection');
    };
    if (adaptor && onAdaptorRequiredCb) {
      drawEdges();
      onAdaptorRequiredCb({ pending: { from, to }, adaptor: { ...adaptor }, existing: existingOnInput || null }, commit);
      return;
    }
    if (existingOnInput && onConnectionConflictCb) {
      drawEdges();
      onConnectionConflictCb(existingOnInput, { from, to, adaptor: adaptor ? { ...adaptor } : undefined }, commit);
      return;
    }
    commit();
  }
  function _markSimpleCompatibility(origin) {
    nodeState.forEach(s => {
      const el = s.el;
      el.classList.remove('simple-drop-ok', 'simple-drop-bad', 'simple-drop-hover', 'simple-rope-origin');
      if (s.data.id === origin.nodeId) {
        // Keep the source expanded for the whole drag so its ports stay put
        // even once the cursor leaves the card.
        el.classList.add('simple-rope-origin');
        _animateSimpleExpand(el, 1);
        return;
      }
      const { pairs } = _simpleValidPairs(origin, s.data.id);
      el.classList.add(pairs.length ? 'simple-drop-ok' : 'simple-drop-bad');
    });
    _markSimpleCollapsedTargets(origin);
  }
  function _clearSimpleCompatibility() {
    nodeState.forEach(s => {
      const wasExpanded = s.el.classList.contains('simple-rope-origin') || s.el.classList.contains('simple-drop-open');
      s.el.classList.remove('simple-drop-ok', 'simple-drop-bad', 'simple-drop-hover', 'simple-rope-origin', 'simple-drop-open', 'simple-expanded');
      s.el.querySelectorAll('.nsp-row').forEach(row =>
        row.classList.remove('nsp-valid', 'nsp-disabled', 'nsp-row-hover'));
      // Collapse anything left open by the drag (source or final drop target),
      // unless the cursor is physically resting on it.
      if (wasExpanded && !s.el.matches(':hover')) _animateSimpleExpand(s.el, 0);
    });
    _clearSimpleCollapsedTargets();
    if (simpleRopeState) simpleRopeState._hoverSgRow = null;
  }
  function _setSimpleDropHover(nodeId) {
    if (!simpleRopeState) return;
    if (simpleRopeState._hoverNode === nodeId) return;
    // Collapse the previously hovered target.
    if (simpleRopeState._hoverNode) _closeSimpleDropTarget(simpleRopeState._hoverNode);
    _setSimpleRowHover(null);
    simpleRopeState._hoverNode = nodeId || null;
    if (nodeId) {
      const el = nodeState.get(nodeId)?.el;
      if (el && el.classList.contains('simple-drop-ok')) {
        el.classList.add('simple-drop-hover');
        _openSimpleDropTarget(nodeId);
      }
    }
  }
  // Force-expand the hovered target and mark each port row: rows on the side
  // that can receive this rope get `.nsp-valid` when type-compatible, every
  // other row gets `.nsp-disabled` (greyed). Lets the user aim at one port.
  function _openSimpleDropTarget(nodeId) {
    if (!simpleRopeState) return;
    const s = nodeState.get(nodeId);
    if (!s) return;
    const { pairs } = _simpleValidPairs(simpleRopeState.origin, nodeId);
    const targetSide = simpleRopeState.origin.dir === 'out' ? 'in' : 'out';
    const validNames = new Set(pairs.map(p => targetSide === 'in' ? p.in.name : p.out.name));
    s.el.classList.add('simple-drop-open');
    s.el.querySelectorAll('.nsp-row').forEach(row => {
      row.classList.remove('nsp-valid', 'nsp-disabled', 'nsp-row-hover');
      if (row.dataset.ioDir === targetSide && validNames.has(row.dataset.ioName)) {
        row.classList.add('nsp-valid');
      } else {
        row.classList.add('nsp-disabled');
      }
    });
    _animateSimpleExpand(s.el, 1);
  }
  function _closeSimpleDropTarget(nodeId) {
    const s = nodeState.get(nodeId);
    if (!s) return;
    s.el.classList.remove('simple-drop-hover', 'simple-drop-open');
    s.el.querySelectorAll('.nsp-row').forEach(row =>
      row.classList.remove('nsp-valid', 'nsp-disabled', 'nsp-row-hover'));
    // Only collapse if the pointer isn't physically hovering the card, and
    // never collapse the rope's source node — it must stay open for the whole
    // drag even when the cursor moves off it onto empty canvas.
    if (!s.el.matches(':hover') && !s.el.classList.contains('simple-rope-origin')) {
      s.el.classList.remove('simple-expanded');
      _animateSimpleExpand(s.el, 0);
    }
  }
  function _setSimpleRowHover(rowEl) {
    if (!simpleRopeState) return;
    if (simpleRopeState._hoverRow === rowEl) return;
    simpleRopeState._hoverRow?.classList.remove('nsp-row-hover');
    simpleRopeState._hoverRow = rowEl || null;
    rowEl?.classList.add('nsp-row-hover');
  }

  // ── Connecting into collapsed subgraphs ──
  // A collapsed subgraph hides its member nodes (display:none) and shows a
  // summary box with one `.sg-node-row` per member. To let a rope land on a
  // hidden member, we treat those rows as drop targets: the row's data-node-id
  // is the real (hidden) node, which still lives in nodeState, so every
  // existing helper (_simpleValidPairs, _commitSimpleConnection) just works.
  // The edge then routes to the collapsed box via the host's
  // getSubgraphCollapsedPortWorld hook once renderSubgraphs re-runs on change.
  function _simpleCollapsedRowAt(under) {
    const row = under?.closest?.('.sg-node-row');
    if (!row || !row.closest('.subgraph-box.collapsed')) return null;
    const nodeId = row.dataset.nodeId;
    if (!nodeId || !nodeState.has(nodeId)) return null;
    return { row, nodeId };
  }
  function _setSimpleSgRowHover(rowEl) {
    if (!simpleRopeState) return;
    if (simpleRopeState._hoverSgRow === rowEl) return;
    simpleRopeState._hoverSgRow?.classList.remove('sg-drop-hover');
    simpleRopeState._hoverSgRow = rowEl || null;
    rowEl?.classList.add('sg-drop-hover');
  }
  // World position of a collapsed member row's receiving edge, so the rope can
  // snap to it (visual "it will land here"). `side` is the member's port side.
  function _simpleSgRowPortWorld(row, side) {
    const r = row.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    const x = side === 'in' ? r.left : r.right;
    return clientToWorld(x, r.top + r.height / 2);
  }
  // Mark every collapsed subgraph's member rows as valid / invalid drop targets
  // for the in-flight rope, and tag the box with the receiving side so the CSS
  // can place the connect dot on the correct edge.
  function _markSimpleCollapsedTargets(origin) {
    const memberSide = origin.dir === 'out' ? 'in' : 'out';
    document.querySelectorAll('.subgraph-box.collapsed').forEach(box => {
      box.classList.remove('sg-drop-ok', 'sg-drop-bad', 'sg-drop-side-in', 'sg-drop-side-out');
      let anyValid = false;
      box.querySelectorAll('.sg-node-row[data-node-id]').forEach(row => {
        row.classList.remove('sg-drop-valid', 'sg-drop-disabled', 'sg-drop-hover');
        const memberId = row.dataset.nodeId;
        if (!memberId || memberId === origin.nodeId) { row.classList.add('sg-drop-disabled'); return; }
        const { pairs } = _simpleValidPairs(origin, memberId);
        if (pairs.length) { row.classList.add('sg-drop-valid'); anyValid = true; }
        else row.classList.add('sg-drop-disabled');
      });
      box.classList.add(anyValid ? 'sg-drop-ok' : 'sg-drop-bad');
      box.classList.add(memberSide === 'in' ? 'sg-drop-side-in' : 'sg-drop-side-out');
    });
  }
  function _clearSimpleCollapsedTargets() {
    document.querySelectorAll('.subgraph-box.collapsed').forEach(box => {
      box.classList.remove('sg-drop-ok', 'sg-drop-bad', 'sg-drop-side-in', 'sg-drop-side-out');
      box.querySelectorAll('.sg-node-row').forEach(row =>
        row.classList.remove('sg-drop-valid', 'sg-drop-disabled', 'sg-drop-hover'));
    });
  }

  // ── Simple-node port picker (multi-pair disambiguation) ──
  let simplePickerEl = null;
  let _simplePickerDocHandler = null;
  function _ensureSimplePicker() {
    if (simplePickerEl) return simplePickerEl;
    simplePickerEl = document.createElement('div');
    simplePickerEl.className = 'simple-port-picker';
    simplePickerEl.addEventListener('mousedown', e => e.stopPropagation());
    document.body.appendChild(simplePickerEl);
    return simplePickerEl;
  }
  function _hideSimplePicker() {
    if (!simplePickerEl) return;
    simplePickerEl.classList.remove('show');
    simplePickerEl.innerHTML = '';
    if (_simplePickerDocHandler) {
      document.removeEventListener('mousedown', _simplePickerDocHandler, true);
      _simplePickerDocHandler = null;
    }
  }
  function _showSimplePortPicker({ srcNodeId, dstNodeId, pairs, clientX, clientY, title }) {
    const el = _ensureSimplePicker();
    const srcLabel = nodeState.get(srcNodeId)?.data.label || srcNodeId;
    const dstLabel = nodeState.get(dstNodeId)?.data.label || dstNodeId;
    const rows = pairs.map((p, idx) => {
      const chip = p.adaptor
        ? `<span class="spp-adaptor">${_escSvg(p.adaptor.label || (p.adaptor.fromType + '→' + p.adaptor.toType))}</span>`
        : '';
      return `<button type="button" class="spp-row" data-idx="${idx}">` +
               `<span class="spp-port spp-out">${_escSvg(p.out.name)}${typePill(p.out.type)}</span>` +
               `<span class="spp-arrow">→</span>` +
               `<span class="spp-port spp-in">${_escSvg(p.in.name)}${typePill(p.in.type)}</span>` +
               chip +
             `</button>`;
    }).join('');
    el.innerHTML =
      `<div class="spp-title">${_escSvg(title || 'Select a connection')}</div>` +
      `<div class="spp-head">${_escSvg(srcLabel)} <span class="spp-arrow">→</span> ${_escSvg(dstLabel)}</div>` +
      `<div class="spp-list">${rows}</div>`;
    el.classList.add('show');
    const w = el.offsetWidth || 240, h = el.offsetHeight || 200;
    let left = clientX + 8, top = clientY + 8;
    left = Math.max(8, Math.min(left, window.innerWidth  - w - 8));
    top  = Math.max(8, Math.min(top,  window.innerHeight - h - 8));
    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
    el.querySelectorAll('.spp-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = pairs[parseInt(btn.dataset.idx, 10)];
        _hideSimplePicker();
        if (p) _commitSimpleConnection(srcNodeId, p.out, dstNodeId, p.in, p.adaptor);
      });
    });
    _simplePickerDocHandler = (ev) => {
      if (simplePickerEl && simplePickerEl.contains(ev.target)) return;
      _hideSimplePicker();
    };
    document.addEventListener('mousedown', _simplePickerDocHandler, true);
    drawEdges();
  }

  // ── Pan + Zoom (canvas) ──────────────────────────────
  function applyTransform() {
    canvasInner.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
    if (zoomValueEl) zoomValueEl.textContent = Math.round(zoom * 100) + '%';
  }
  function zoomAtPoint(newZoom, cx, cy) {
    const rect = canvasEl.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top;
    const wx = (mx - panX) / zoom, wy = (my - panY) / zoom;
    zoom = Math.max(0.25, Math.min(2.5, newZoom));
    panX = mx - wx * zoom; panY = my - wy * zoom;
    applyTransform();
    drawEdges();
  }
  const PAN_CURSOR_THRESHOLD_PX = 3;
  let panState = null;
  function _attachCanvasPanZoom() {
    canvasEl.addEventListener('mousedown', e => {
      // Left-click only. Right-click is reserved for the canvas context
      // menu; middle-click / aux buttons shouldn't hijack the pan either.
      if (e.button !== 0) return;
      if (e.target.closest('.node')) return;
      e.preventDefault();
      panState = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panX,
        startPanY: panY,
        cursorActive: false,
      };
      document.addEventListener('mousemove', _onPan);
      document.addEventListener('mouseup', _onPanEnd, { once: true });
    });
    canvasEl.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey) { zoomAtPoint(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); }
      else { panX -= e.deltaX; panY -= e.deltaY; applyTransform(); }
    }, { passive: false });
  }
  function _onPan(e) {
    if (!panState) return;
    const dx = e.clientX - panState.startX;
    const dy = e.clientY - panState.startY;
    if (!panState.cursorActive && (Math.abs(dx) >= PAN_CURSOR_THRESHOLD_PX || Math.abs(dy) >= PAN_CURSOR_THRESHOLD_PX)) {
      panState.cursorActive = true;
      canvasEl.classList.add('panning');
    }
    panX = panState.startPanX + dx;
    panY = panState.startPanY + dy;
    applyTransform();
  }
  function _onPanEnd() {
    panState = null;
    canvasEl.classList.remove('panning');
    document.removeEventListener('mousemove', _onPan);
  }

  function zoomIn()  { const r = canvasEl.getBoundingClientRect(); zoomAtPoint(zoom + 0.1, r.left + r.width/2, r.top + r.height/2); }
  function zoomOut() { const r = canvasEl.getBoundingClientRect(); zoomAtPoint(zoom - 0.1, r.left + r.width/2, r.top + r.height/2); }

  // Smoothly pan+zoom so every node in `ids` is in view, accounting for any
  // screen-space reservations (e.g. the path-builder panel on the bottom or
  // the paths drawer on the right). `padding` is the minimum margin in screen
  // px to leave around the bounding box. `reserve` takes {left,right,top,bottom}
  // in screen px so callers can exclude overlapping UI chrome.
  function fitToNodes(ids, opts) {
    opts = opts || {};
    const padding = opts.padding != null ? opts.padding : 80;
    const reserve = opts.reserve || {};
    const maxZoom = opts.maxZoom != null ? opts.maxZoom : 1.0;
    const minZoom = opts.minZoom != null ? opts.minZoom : 0.25;
    const animate = opts.animate !== false;
    const ifNeeded = !!opts.ifNeeded; // skip if all nodes already in view
    if (!ids || !ids.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const s = nodeState.get(id);
      if (!s) continue;
      const el = s.el;
      const w = el.offsetWidth  || 200;
      const h = el.offsetHeight || 200;
      const x = parseFloat(el.style.left) || 0;
      const y = parseFloat(el.style.top)  || 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }
    if (!isFinite(minX)) return;
    const rect = canvasEl.getBoundingClientRect();
    const availW = Math.max(100, rect.width  - (reserve.left   || 0) - (reserve.right  || 0) - 2 * padding);
    const availH = Math.max(100, rect.height - (reserve.top    || 0) - (reserve.bottom || 0) - 2 * padding);
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, Math.min(availW / worldW, availH / worldH)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const viewportCX = (reserve.left || 0) + (rect.width  - (reserve.left || 0) - (reserve.right  || 0)) / 2;
    const viewportCY = (reserve.top  || 0) + (rect.height - (reserve.top  || 0) - (reserve.bottom || 0)) / 2;
    const newPanX = viewportCX - centerX * newZoom;
    const newPanY = viewportCY - centerY * newZoom;
    // If caller opts in, skip the fit when all nodes are already comfortably on-screen.
    if (ifNeeded) {
      const insetL = (reserve.left  || 0) + padding;
      const insetT = (reserve.top   || 0) + padding;
      const insetR = rect.width  - (reserve.right  || 0) - padding;
      const insetB = rect.height - (reserve.bottom || 0) - padding;
      let allIn = true;
      for (const id of ids) {
        const s = nodeState.get(id);
        if (!s) continue;
        const el = s.el;
        const nx = parseFloat(el.style.left) || 0;
        const ny = parseFloat(el.style.top)  || 0;
        const nw = el.offsetWidth  || 200;
        const nh = el.offsetHeight || 200;
        const sx1 = panX + nx * zoom;
        const sy1 = panY + ny * zoom;
        const sx2 = panX + (nx + nw) * zoom;
        const sy2 = panY + (ny + nh) * zoom;
        if (sx1 < insetL || sy1 < insetT || sx2 > insetR || sy2 > insetB) { allIn = false; break; }
      }
      if (allIn && Math.abs(newZoom - zoom) < zoom * 0.1) return;
    }
    zoom = newZoom;
    panX = newPanX;
    panY = newPanY;
    fitToNodes._transitioning = false;
    canvasInner.style.transition = animate ? 'transform 0.32s cubic-bezier(0.4, 0.0, 0.2, 1)' : '';
    applyTransform();
    if (fitToNodes._raf) {
      cancelAnimationFrame(fitToNodes._raf);
      fitToNodes._raf = null;
    }
    if (fitToNodes._onTransEnd) {
      canvasInner.removeEventListener('transitionend', fitToNodes._onTransEnd);
      fitToNodes._onTransEnd = null;
    }
    clearTimeout(fitToNodes._t);
    let _fitToNodesEnded = false;
    const finish = () => {
      if (_fitToNodesEnded) return;
      _fitToNodesEnded = true;
      clearTimeout(fitToNodes._t);
      fitToNodes._t = null;
      canvasInner.style.transition = '';
      if (fitToNodes._raf) {
        cancelAnimationFrame(fitToNodes._raf);
        fitToNodes._raf = null;
      }
      if (fitToNodes._onTransEnd) {
        canvasInner.removeEventListener('transitionend', fitToNodes._onTransEnd);
        fitToNodes._onTransEnd = null;
      }
      fitToNodes._transitioning = false;
      drawEdges();
    };
    if (animate) {
      fitToNodes._transitioning = true;
      fitToNodes._onTransEnd = (ev) => {
        if (ev.target !== canvasInner) return;
        if (ev.propertyName && ev.propertyName !== 'transform') return;
        finish();
      };
      canvasInner.addEventListener('transitionend', fitToNodes._onTransEnd);
      /* Fallback: no transition, reduced-motion, or missing transitionend. */
      fitToNodes._t = setTimeout(finish, 450);
    } else {
      fitToNodes._transitioning = false;
      fitToNodes._t = setTimeout(finish, 20);
    }
    if (!animate) drawEdges();
  }

  // ── Lookups ──────────────────────────────────────────
  function getNode(id)      { const s = nodeState.get(id); return s ? s.data : null; }
  function getAllNodes()    { return [...nodeState.values()].map(s => s.data); }
  function getConnections() { return [...CONNECTIONS]; }
  function isEditable()     { return !!opts.editable; }
  function getTransform()   { return { panX, panY, zoom }; }
  function clientToWorld(clientX, clientY) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
  }
  // Pan the viewport so a given world-space coordinate lands in the center
  // of the visible canvas. Used by "Show on canvas" links in the comments
  // drawer — simpler than fitToNodes for a single point target.
  function panToWorld(worldX, worldY) {
    const rect = canvasEl.getBoundingClientRect();
    panX = rect.width  / 2 - worldX * zoom;
    panY = rect.height / 2 - worldY * zoom;
    applyTransform();
  }
  // Center a world-space point and optionally set an explicit zoom level.
  // Used by "Show on canvas" from the comments drawer.
  function focusWorld(worldX, worldY, opts) {
    const o = opts || {};
    if (o.zoom != null) zoom = Math.max(0.25, Math.min(2.5, o.zoom));
    const rect = canvasEl.getBoundingClientRect();
    const reserve = o.reserve || {};
    const leftR = reserve.left || 0;
    const rightR = reserve.right || 0;
    const topR = reserve.top || 0;
    const bottomR = reserve.bottom || 0;
    const availW = Math.max(40, rect.width - leftR - rightR);
    const availH = Math.max(40, rect.height - topR - bottomR);
    const anchorXRatio = o.anchorXRatio != null ? o.anchorXRatio : 0.5;
    const anchorYRatio = o.anchorYRatio != null ? o.anchorYRatio : 0.5;
    const viewportCX = leftR + availW * anchorXRatio;
    const viewportCY = topR + availH * anchorYRatio;
    panX = viewportCX - worldX * zoom;
    panY = viewportCY - worldY * zoom;
    if (o.animate) {
      const dur = o.durationMs != null ? o.durationMs : 320;
      canvasInner.style.transition = `transform ${dur}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
    }
    applyTransform();
    if (!o.animate) drawEdges();
    if (o.animate) {
      clearTimeout(focusWorld._t);
      const dur = o.durationMs != null ? o.durationMs : 320;
      focusWorld._t = setTimeout(() => {
        canvasInner.style.transition = '';
        drawEdges();
      }, dur + 20);
    }
  }
  function getCanvasInner()  { return canvasInner; }
  function getCanvasEl()     { return canvasEl; }
  // Returns connections touching nodeId, enriched with labels, port types,
  // and whether each is an input or output relative to nodeId.
  function getNodeConnections(id) {
    return CONNECTIONS.filter(c => c.from[0] === id || c.to[0] === id).map(c => {
      const fromNode = nodeState.get(c.from[0]);
      const toNode   = nodeState.get(c.to[0]);
      const fromPortObj = (fromNode?.data.outputs || []).find(p => p.name === c.from[2]);
      const toPortObj   = (toNode?.data.inputs    || []).find(p => p.name === c.to[2]);
      return {
        raw:          c,
        isInput:      c.to[0]   === id,   // connection flows INTO nodeId
        isOutput:     c.from[0] === id,   // connection flows OUT of nodeId
        fromLabel:    fromNode ? fromNode.data.label : c.from[0],
        fromPort:     c.from[2],
        fromPortType: fromPortObj ? fromPortObj.type : null,
        toLabel:      toNode   ? toNode.data.label   : c.to[0],
        toPort:       c.to[2],
        toPortType:   toPortObj ? toPortObj.type : null,
      };
    });
  }
  function breakNodeConnections(id) {
    CONNECTIONS = CONNECTIONS.filter(c => c.from[0] !== id && c.to[0] !== id);
    drawEdges();
  }

  /**
   * Run-edge flow styling.
   * - `setRunFlowEdges(true|false)` keeps backwards compatibility (all edges).
   * - `setRunFlowEdges({ enabled, targetEdges, doneEdges, activeEdges })`
   *   scopes animation to specific edge groups as a run advances.
   */
  function setRunFlowEdges(config) {
    if (!canvasEl) return;
    if (typeof config === 'boolean') {
      runFlowEnabled = !!config;
      runFlowTargetKeys = new Set();
      runFlowDoneKeys = new Set();
      runFlowActiveKeys = new Set();
      canvasEl.classList.toggle('running-edges', runFlowEnabled);
      _applyRunFlowClasses();
      return;
    }
    const cfg = config || {};
    runFlowEnabled = !!cfg.enabled;
    runFlowTargetKeys = _edgeKeySet(cfg.targetEdges);
    runFlowDoneKeys = _edgeKeySet(cfg.doneEdges);
    runFlowActiveKeys = _edgeKeySet(cfg.activeEdges);
    canvasEl.classList.toggle('running-edges', runFlowEnabled);
    _applyRunFlowClasses();
  }

  // ── Public API ───────────────────────────────────────
  return {
    init, build, clear,
    // CRUD
    addNode, removeNode, renderNode,
    addConnection, removeConnection,
    // Rendering helpers (for modal code in HTML shells)
    drawEdges, ICONS, typePill,
    snapshotConnection, getAdaptorUiModel, updateConnectionAdaptorSettings,
    // Lookups
    getNode, getAllNodes, getConnections, getNodeConnections, breakNodeConnections,
    isEditable, getViewportCenter, getTransform, clientToWorld, panToWorld, focusWorld, getCanvasInner, getCanvasEl,
    fitToNodes,
    applyNodeLayout,
    setRunFlowEdges,
    removeActiveEdgeSelection,
    // Interaction
    onNodeClick(cb)          { onNodeClickCb          = cb; },
    shouldSuppressPostDragActivation,
    allocSurfaceZSlots,
    setNodeSurfaceZ,
    bumpNodeSurfaceFront,
    onKebabClick(cb)         { onKebabClickCb         = cb; },
    onConnectionConflict(cb) { onConnectionConflictCb = cb; },
    onAdaptorRequired(cb)    { onAdaptorRequiredCb    = cb; },
    onAdaptorChipClick(cb)    { onAdaptorChipClickCb    = cb; },
    onChange(cb)             { onChangeCb             = cb; },
    onRoleBadgeDragStart(cb) { onRoleBadgeDragStartCb = cb; },
    zoomIn, zoomOut
  };
})();

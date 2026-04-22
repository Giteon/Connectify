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
  const ICONS = {
    Dataset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></svg>`,
    Model:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2L21 7L21 17L12 22L3 17L3 7z"/><path d="M12 2L12 12M3 7L12 12M21 7L12 12M12 12L12 22"/></svg>`,
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
    };
    const raw = (type || '').toLowerCase();
    const key = raw === 'label' ? 'lbl' : raw;   // avoid clash with .type-label header class
    return `<span class="type-pill type-${key}">${LABELS[key] || raw.toUpperCase()}</span>`;
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

  // Single source of truth: id → { data, el, overlayEl }
  const nodeState = new Map();
  let CONNECTIONS = [];

  let zoom = 1, panX = 0, panY = 0;

  // ── Init ─────────────────────────────────────────────
  function init(options) {
    opts = Object.assign({
      canvasId: 'canvas',
      innerId: 'canvasInner',
      zoomValueId: 'zoomValue',
      offset: 0,
      editable: false,
      initialZoom: 1.0
    }, options || {});
    canvasEl    = document.getElementById(opts.canvasId);
    canvasInner = document.getElementById(opts.innerId);
    zoomValueEl = document.getElementById(opts.zoomValueId);
    zoom = opts.initialZoom;
    _attachCanvasDrag();
    _attachCanvasPanZoom();
    if (opts.editable) {
      _attachPortDrag();
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
        if (e.key === 'Escape') _hideEdgeBubble();
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
    const newZ = ++topNodeZ;
    el.style.zIndex = newZ;

    const overlayEl = document.createElementNS(SVG_NS, 'svg');
    overlayEl.setAttribute('class', 'node-overlay');
    overlayEl.dataset.overlayFor = data.id;
    overlayEl.style.zIndex = newZ;

    nodeState.set(data.id, { data, el, overlayEl });
    renderNode(data.id);

    canvasInner.appendChild(el);
    canvasInner.appendChild(overlayEl);
    requestAnimationFrame(_refreshOverlaps);
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
  }

  function renderNode(id) {
    const s = nodeState.get(id);
    if (!s) return;
    const { data, el } = s;
    const hasIn  = data.inputs  && data.inputs.length  > 0;
    const hasOut = data.outputs && data.outputs.length > 0;
    el.innerHTML = `
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
    _attachNodeListeners(id);
  }

  function _attachNodeListeners(id) {
    const { el } = nodeState.get(id);
    el.querySelectorAll('.node-section').forEach(sec => {
      sec.addEventListener('click', () => {
        sec.classList.toggle('collapsed');
        sec.nextElementSibling.classList.toggle('collapsed');
        drawEdges();
      });
    });
    el.querySelector('.node-item')?.addEventListener('click', e => {
      e.stopPropagation();
      const { data } = nodeState.get(id);
      if (data && onNodeClickCb) onNodeClickCb(data);
    });
    el.querySelector('.menu-dots')?.addEventListener('click', e => {
      e.stopPropagation();
      if (onKebabClickCb) onKebabClickCb(id, e.currentTarget);
    });
  }

  function addConnection(from, to) {
    CONNECTIONS.push({ from, to });
    drawEdges();
  }

  function removeConnection(from, to) {
    CONNECTIONS = CONNECTIONS.filter(c =>
      !(c.from[0] === from[0] && c.from[1] === from[1] && c.from[2] === from[2] &&
        c.to[0]   === to[0]   && c.to[1]   === to[1]   && c.to[2]   === to[2]));
    drawEdges();
  }

  // ── Build from project data ──────────────────────────
  function build(P) {
    canvasInner.style.width  = P.canvasWidth  + 'px';
    canvasInner.style.height = P.canvasHeight + 'px';
    CONNECTIONS = [...P.connections];
    P.nodes.forEach(n => addNode({ ...n, x: n.x + opts.offset, y: n.y }));
    applyTransform();
    requestAnimationFrame(() => { drawEdges(); _refreshOverlaps(); });
  }

  // World coordinates at the current viewport center (accounts for pan+zoom).
  function getViewportCenter() {
    const rect = canvasEl.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    return { x: (mx - panX) / zoom, y: (my - panY) / zoom };
  }

  // ── Edge drawing ─────────────────────────────────────
  // Single SVG overlay at z-index 1 (below all nodes at z≥2) so edge paths
  // never flicker when a node's z-index changes during drag/click.
  let edgeOverlay = null;
  function _ensureEdgeOverlay() {
    if (edgeOverlay) return edgeOverlay;
    edgeOverlay = document.createElementNS(SVG_NS, 'svg');
    edgeOverlay.setAttribute('class', 'node-overlay');
    edgeOverlay.style.zIndex = '1';
    edgeOverlay.style.pointerEvents = 'none';
    // Edit mode only: a wide transparent hit-path is drawn under each edge.
    // Hovering it simply restyles the line blue (CSS rule on `.edge-hit:hover
    // + path`). Clicking it opens the break-link bubble anchored at the edge
    // midpoint; a second click on the bubble removes the connection. Any
    // click outside the bubble dismisses it (see document mousedown listener
    // attached from init()).
    if (opts.editable) {
      edgeOverlay.addEventListener('click', e => {
        const hit = e.target.closest('.edge-hit');
        if (!hit) return;
        e.stopPropagation();
        const conn = CONNECTIONS[parseInt(hit.dataset.connIdx, 10)];
        if (!conn) return;
        // Toggle: clicking the same edge again hides the bubble.
        if (edgeBubbleConn === conn && edgeBubbleEl?.classList.contains('show')) {
          _hideEdgeBubble();
        } else {
          _showEdgeBubble(conn);
        }
      });
    }
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
  function _refreshActiveEdge() {
    if (!edgeOverlay) return;
    edgeOverlay.querySelectorAll('.edge-active').forEach(p => p.classList.remove('edge-active'));
    if (!edgeBubbleConn) return;
    const idx = CONNECTIONS.indexOf(edgeBubbleConn);
    if (idx < 0) return;
    const hit = edgeOverlay.querySelector(`.edge-hit[data-conn-idx="${idx}"]`);
    if (hit) {
      hit.classList.add('edge-active');
      if (hit.nextElementSibling) hit.nextElementSibling.classList.add('edge-active');
    }
  }

  function getPortPos(nodeId, dir, ioName, canvasRect) {
    const s = nodeState.get(nodeId);
    if (!s) return null;
    const el  = s.el;
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

  function drawEdges() {
    const svg = _ensureEdgeOverlay();
    // Edge paths live in `edgeOverlay` (below nodes, z=1) so lines never draw
    // on top of a card body. In view mode endpoint circles are split into
    // `dotsOverlay` (above nodes) so the dots appear on top of the card edge
    // they attach to — a requested visual detail.
    // Cache canvas rect once per redraw so N edges cost 1 DOM read instead of 2N.
    const canvasRect = opts.editable ? canvasEl.getBoundingClientRect() : null;
    const parts = [];
    const dotParts = [];
    CONNECTIONS.forEach((c, i) => {
      const a = getPortPos(c.from[0], c.from[1], c.from[2], canvasRect);
      const b = getPortPos(c.to[0],   c.to[1],   c.to[2],   canvasRect);
      if (!a || !b) return;
      const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
      const d = `M ${a.x} ${a.y} C ${a.x+dx} ${a.y}, ${b.x-dx} ${b.y}, ${b.x} ${b.y}`;
      if (opts.editable) parts.push(`<path class="edge-hit" data-conn-idx="${i}" d="${d}"/>`);
      parts.push(`<path d="${d}"/>`);
      // Edit-mode uses .port-anchor DOM pips inside each node for the endpoint
      // visual; view-mode draws circles here and renders them above cards.
      if (!opts.editable) {
        dotParts.push(`<circle cx="${a.x}" cy="${a.y}" r="4"/>`);
        dotParts.push(`<circle cx="${b.x}" cy="${b.y}" r="4"/>`);
      }
    });
    svg.innerHTML = parts.join('');
    if (!opts.editable) _ensureDotsOverlay().innerHTML = dotParts.join('');
    _updateConnectedPorts();
    // If the bubble was open for an edge that no longer exists, dismiss it.
    if (edgeBubbleConn && !CONNECTIONS.includes(edgeBubbleConn)) _hideEdgeBubble();
    else _refreshActiveEdge();
  }

  function _updateConnectedPorts() {
    nodeState.forEach(s => {
      s.el.querySelectorAll('.port-anchor').forEach(a => a.classList.remove('connected'));
    });
    CONNECTIONS.forEach(c => {
      const mark = (nodeId, dir, ioName) => {
        const s = nodeState.get(nodeId);
        s?.el.querySelector(`[data-io="${dir}:${ioName}"]`)
            ?.querySelector('.port-anchor')?.classList.add('connected');
      };
      mark(c.from[0], c.from[1], c.from[2]);
      mark(c.to[0],   c.to[1],   c.to[2]);
    });
  }

  // ── Drag (nodes) ─────────────────────────────────────
  let dragState = null, topNodeZ = 2;
  function _setNodeZ(node, z) {
    node.style.zIndex = z;
    const s = nodeState.get(node.dataset.nodeId);
    if (s) s.overlayEl.style.zIndex = z;
  }
  function _bringToFront(node) {
    if (++topNodeZ >= 9999) {
      const all = [...nodeState.values()].map(s => s.el)
        .sort((a,b) => (parseInt(a.style.zIndex)||2) - (parseInt(b.style.zIndex)||2));
      all.forEach((n, i) => _setNodeZ(n, 3 + i));
      topNodeZ = 3 + all.length;
    }
    _setNodeZ(node, topNodeZ);
    drawEdges();
  }
  function _attachCanvasDrag() {
    canvasInner.addEventListener('mousedown', e => {
      const head = e.target.closest('.node-head');
      if (!head || e.target.closest('.menu-dots')) return;
      e.preventDefault(); e.stopPropagation();
      const node = head.parentElement;
      dragState = { node, startX: e.clientX, startY: e.clientY, startLeft: parseFloat(node.style.left)||0, startTop: parseFloat(node.style.top)||0 };
      _bringToFront(node); node.classList.add('dragging');
      document.addEventListener('mousemove', _onDragMove);
      document.addEventListener('mouseup', _onDragEnd, { once: true });
    });
  }
  function _onDragMove(e) {
    if (!dragState) return;
    dragState.node.style.left = (dragState.startLeft + (e.clientX - dragState.startX) / zoom) + 'px';
    dragState.node.style.top  = (dragState.startTop  + (e.clientY - dragState.startY) / zoom) + 'px';
    drawEdges();
    _refreshOverlaps();
  }
  function _onDragEnd() {
    if (dragState) { dragState.node.classList.remove('dragging'); dragState = null; }
    document.removeEventListener('mousemove', _onDragMove);
    _refreshOverlaps();
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

    // Track hovered compatible row so it can light up grey
    const hoveredRow = elUnder?.closest?.('.io-row.compatible') || null;
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

    // Capture target BEFORE clearing compatibility classes (which removes .compatible).
    const under     = document.elementFromPoint(e.clientX, e.clientY);
    const targetRow = committed ? under?.closest?.('.io-row') : null;
    const isValid   = targetRow?.classList.contains('compatible') ?? false;

    _clearCompatibility();
    canvasInner.classList.remove('dragging-rope');
    if (ropeOverlay) { ropeOverlay.style.display = 'none'; ropeOverlay.innerHTML = ''; }
    ropeState = null;

    if (!committed || !isValid || !targetRow) { drawEdges(); return; }

    const targetNodeEl = targetRow.closest('.node');
    const targetNodeId = targetNodeEl.dataset.nodeId;
    const targetIoName = targetRow.dataset.io.split(':').slice(1).join(':');
    const from = origin.dir === 'out'
      ? [origin.nodeId, 'out', origin.ioName]
      : [targetNodeId,  'out', targetIoName];
    const to = origin.dir === 'out'
      ? [targetNodeId,  'in', targetIoName]
      : [origin.nodeId, 'in', origin.ioName];

    const existingOnInput = CONNECTIONS.find(c => c.to[0] === to[0] && c.to[2] === to[2]);
    if (existingOnInput) {
      if (onConnectionConflictCb) {
        drawEdges();
        onConnectionConflictCb(existingOnInput, { from, to }, () => {
          CONNECTIONS = CONNECTIONS.filter(c => c !== existingOnInput);
          CONNECTIONS.push({ from, to });
          drawEdges();
        });
        return;
      }
      CONNECTIONS = CONNECTIONS.filter(c => c !== existingOnInput);
    }
    CONNECTIONS.push({ from, to });
    drawEdges();
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
  function _markCompatibility(origin) {
    nodeState.forEach(s => {
      s.el.querySelectorAll('.io-row').forEach(row => {
        row.classList.remove('compatible', 'incompatible', 'rope-origin');
        const rowDir    = row.dataset.dir;
        const rowType   = row.dataset.type;
        const rowIoName = row.dataset.io.split(':').slice(1).join(':');
        // The row the rope is anchored at — keep it visible & highlighted
        if (s.data.id === origin.nodeId && rowDir === origin.dir && rowIoName === origin.ioName) {
          row.classList.add('rope-origin');
          return;
        }
        const ok = s.data.id !== origin.nodeId &&
                   rowDir   !== origin.dir     &&
                   rowType  === origin.type    &&
                   !_alreadyConnected(origin, s.data.id, rowDir, rowIoName);
        row.classList.add(ok ? 'compatible' : 'incompatible');
      });
    });
  }
  function _clearCompatibility() {
    nodeState.forEach(s => {
      s.el.querySelectorAll('.io-row').forEach(row => row.classList.remove('compatible', 'incompatible', 'rope-origin', 'drop-hover'));
    });
  }
  function _setDropHover(row) {
    // Only one row carries .drop-hover at a time
    if (ropeState && ropeState._hoverRow === row) return;
    if (ropeState && ropeState._hoverRow) ropeState._hoverRow.classList.remove('drop-hover');
    if (ropeState) ropeState._hoverRow = row || null;
    if (row) row.classList.add('drop-hover');
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
  }
  let panState = null;
  function _attachCanvasPanZoom() {
    canvasEl.addEventListener('mousedown', e => {
      if (e.target.closest('.node')) return;
      e.preventDefault();
      panState = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
      canvasEl.classList.add('panning');
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
    panX = panState.startPanX + (e.clientX - panState.startX);
    panY = panState.startPanY + (e.clientY - panState.startY);
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
    zoom = newZoom;
    panX = viewportCX - centerX * zoom;
    panY = viewportCY - centerY * zoom;
    canvasInner.style.transition = 'transform 0.32s cubic-bezier(0.4, 0.0, 0.2, 1)';
    applyTransform();
    clearTimeout(fitToNodes._t);
    fitToNodes._t = setTimeout(() => { canvasInner.style.transition = ''; drawEdges(); }, 340);
    drawEdges();
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

  // ── Public API ───────────────────────────────────────
  return {
    init, build,
    // CRUD
    addNode, removeNode, renderNode,
    addConnection, removeConnection,
    // Rendering helpers (for modal code in HTML shells)
    drawEdges, ICONS, typePill,
    // Lookups
    getNode, getAllNodes, getConnections, getNodeConnections, breakNodeConnections,
    isEditable, getViewportCenter, getTransform, clientToWorld, getCanvasInner, getCanvasEl,
    fitToNodes,
    // Interaction
    onNodeClick(cb)          { onNodeClickCb          = cb; },
    onKebabClick(cb)         { onKebabClickCb         = cb; },
    onConnectionConflict(cb) { onConnectionConflictCb = cb; },
    zoomIn, zoomOut
  };
})();

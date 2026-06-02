/* ──────────────────────────────────────────────────────────────
   editing-mode-new.html — wiring for the three-edge IA
   ────────────────────────────────────────────────────────────── */

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Destructive-action confirm. Uses the native-ish modal in the DOM so it
// themes correctly in dark mode (confirm()/prompt() don't follow CSS vars).
function confirmDialog({ title = 'Are you sure?', desc = '', confirmLabel = 'Delete', cancelLabel = 'Cancel', tone = 'danger' } = {}) {
  return new Promise(resolve => {
    const bd = document.getElementById('confirmBackdrop');
    const ok = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmDesc').innerHTML = desc;
    ok.textContent = confirmLabel;
    cancel.textContent = cancelLabel;
    ok.classList.toggle('primary', tone === 'danger');
    bd.classList.add('open');
    function cleanup(result) {
      bd.classList.remove('open');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      bd.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(e) { if (e.target === bd) cleanup(false); }
    function onKey(e) {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    bd.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    setTimeout(() => ok.focus(), 30);
  });
}

// Adaptor-offer dialog. Resolves with one of: 'accept' | 'configure' | 'cancel'.
// Shares the confirm backdrop look but is tri-state, because silently
// inserting a lossy conversion is the kind of "magic" that burns trust —
// the user should see what's being inserted before it happens.
function adaptorDialog({ adaptor, existingSummary = '' } = {}) {
  return new Promise(resolve => {
    const bd = document.getElementById('adaptorBackdrop');
    const accept = document.getElementById('adaptorAccept');
    const configure = document.getElementById('adaptorConfigure');
    const cancel = document.getElementById('adaptorCancel');
    const desc = document.getElementById('adaptorDesc');
    const summary = document.getElementById('adaptorSummary');
    const existingEl = document.getElementById('adaptorExisting');
    desc.textContent = adaptor?.desc || 'An adaptor will bridge these two port types.';
    const fromPill = Canvas.typePill(adaptor?.fromType || '');
    const toPill   = Canvas.typePill(adaptor?.toType   || '');
    summary.innerHTML = `${fromPill}<span class="adaptor-arrow">→</span>${toPill}<span class="adaptor-arrow" style="margin-left:auto;font-size:11px;">${esc(adaptor?.label || '')}</span>`;
    if (existingSummary) {
      existingEl.style.display = '';
      existingEl.innerHTML = existingSummary;
    } else {
      existingEl.style.display = 'none';
      existingEl.innerHTML = '';
    }
    bd.classList.add('open');
    function cleanup(result) {
      bd.classList.remove('open');
      accept.removeEventListener('click', onAccept);
      configure.removeEventListener('click', onConfigure);
      cancel.removeEventListener('click', onCancel);
      bd.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onAccept()    { cleanup('accept'); }
    function onConfigure() { cleanup('configure'); }
    function onCancel()    { cleanup('cancel'); }
    function onBackdrop(e) { if (e.target === bd) cleanup('cancel'); }
    function onKey(e) {
      if (e.key === 'Escape') cleanup('cancel');
      if (e.key === 'Enter')  cleanup('accept');
    }
    accept.addEventListener('click', onAccept);
    configure.addEventListener('click', onConfigure);
    cancel.addEventListener('click', onCancel);
    bd.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    setTimeout(() => accept.focus(), 30);
  });
}

// Adaptor details popover (chip click, or "Configure…" from the insert-adaptor modal).
let _adpPopoverCleanup = null;
function closeAdaptorDetailsPopover() {
  if (_adpPopoverCleanup) {
    try { _adpPopoverCleanup(); } catch (_) { /* noop */ }
    _adpPopoverCleanup = null;
  }
}
function openAdaptorDetailsPopover(opts) {
  return new Promise((resolveOuter) => {
    closeAdaptorDetailsPopover();
    const bd = document.getElementById('adaptorDetailsBackdrop');
    const pop = document.getElementById('adaptorDetailsPop');
    const ui = opts && opts.uiModel;
    if (!bd || !pop || !ui) {
      resolveOuter(null);
      return;
    }

    const draft = { ...(ui.settings || {}) };

    function livePreview() {
      const pseudo = { adaptor: ui.adaptor, adaptorSettings: { ...draft } };
      const m = Canvas.getAdaptorUiModel(pseudo);
      const el = document.getElementById('adpDetailsPreview');
      if (el) el.textContent = (m && m.previewText) ? m.previewText : '';
    }

    document.getElementById('adpDetailsDesc').textContent = ui.desc || '';
    document.getElementById('adpDetailsPill').innerHTML =
      `${Canvas.typePill(ui.adaptor.fromType)}<span class="adaptor-arrow">→</span>${Canvas.typePill(ui.adaptor.toType)}` +
      `<span style="margin-left:auto;font-weight:600;font-size:11px;">${esc(ui.adaptor.label || '')}</span>`;

    const paramsEl = document.getElementById('adpDetailsParams');
    paramsEl.innerHTML = '';
    (ui.params || []).forEach(p => {
      const wrap = document.createElement('div');
      wrap.className = 'adp-field';
      const lab = document.createElement('label');
      lab.textContent = p.label;
      wrap.appendChild(lab);
      if (p.type === 'range') {
        const inp = document.createElement('input');
        inp.type = 'range';
        inp.min = p.min;
        inp.max = p.max;
        inp.step = p.step != null ? p.step : 1;
        const cur = draft[p.key];
        inp.value = cur != null ? String(cur) : String(p.min);
        draft[p.key] = Number(inp.value);
        inp.addEventListener('input', () => {
          draft[p.key] = Number(inp.value);
          livePreview();
        });
        wrap.appendChild(inp);
      } else if (p.type === 'select') {
        const sel = document.createElement('select');
        (p.options || []).forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          sel.appendChild(opt);
        });
        const first = (p.options && p.options[0]) ? p.options[0].value : '';
        if (draft[p.key] == null) draft[p.key] = first;
        sel.value = String(draft[p.key]);
        sel.addEventListener('change', () => {
          draft[p.key] = sel.value;
          livePreview();
        });
        wrap.appendChild(sel);
      }
      paramsEl.appendChild(wrap);
    });
    livePreview();

    const actions = document.getElementById('adpDetailsActions');
    actions.innerHTML = '';

    function mkBtn(text, cls, fn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.className = cls;
      b.addEventListener('click', fn);
      return b;
    }

    if (opts.mode === 'offer') {
      actions.appendChild(mkBtn('Cancel', 'ghost', () => { cleanup(null); }));
      actions.appendChild(mkBtn('Insert adaptor', 'accent', () => {
        cleanup({ adaptorSettings: { ...draft } });
      }));
    } else {
      actions.appendChild(mkBtn('Close', 'ghost', () => { cleanup(null); }));
      if (opts.connIndex != null && (ui.params || []).length) {
        actions.appendChild(mkBtn('Apply', 'primary', () => {
          Canvas.updateConnectionAdaptorSettings(opts.connIndex, { ...draft });
          cleanup({ applied: true });
        }));
      }
    }

    const closeBtn = document.getElementById('adpDetailsClose');

    function position() {
      const pad = 12;
      const x = (opts.clientX != null ? opts.clientX : window.innerWidth / 2);
      const y = (opts.clientY != null ? opts.clientY : window.innerHeight / 3);
      bd.classList.add('open');
      bd.setAttribute('aria-hidden', 'false');
      const wr = bd.getBoundingClientRect();
      const pr = pop.getBoundingClientRect();
      let left = x - pr.width / 2;
      let top = y + pad;
      left = Math.max(pad, Math.min(left, wr.width - pr.width - pad));
      top = Math.max(pad, Math.min(top, wr.height - pr.height - pad));
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    }

    function cleanup(result) {
      document.removeEventListener('keydown', onKey);
      bd.removeEventListener('mousedown', onBackdropClick);
      closeBtn.removeEventListener('click', onCloseClick);
      bd.classList.remove('open');
      bd.setAttribute('aria-hidden', 'true');
      _adpPopoverCleanup = null;
      resolveOuter(result);
    }

    function onCloseClick() { cleanup(null); }
    function onKey(ev) {
      if (ev.key === 'Escape') cleanup(null);
    }
    function onBackdropClick(ev) {
      if (ev.target === bd) cleanup(null);
    }

    closeBtn.addEventListener('click', onCloseClick);
    document.addEventListener('keydown', onKey);
    bd.addEventListener('mousedown', onBackdropClick);
    _adpPopoverCleanup = () => cleanup(null);

    requestAnimationFrame(() => requestAnimationFrame(position));
  });
}

// ── Load project data then init ────────────────────────────
// Determine which project to load. `?project=…` is the primary source; fall
// back to sessionStorage hint, tutorial fork slug, and last-edited custom
// project when static-file servers strip the query string.
const slug = (() => {
  if (window.ConnectifyLeftnav && typeof window.ConnectifyLeftnav.resolveProjectSlug === 'function') {
    return window.ConnectifyLeftnav.resolveProjectSlug();
  }
  const fromQuery = new URLSearchParams(location.search).get('project');
  if (fromQuery) return fromQuery;
  try {
    const hint = sessionStorage.getItem('cfg.navHint.project');
    if (hint) {
      sessionStorage.removeItem('cfg.navHint.project');
      return hint;
    }
  } catch (_) {}
  return null;
})();
let IS_CUSTOM_PROJECT = false;
function _readCustomProjectBySlug(targetSlug) {
  try {
    const raw = localStorage.getItem('cfg.customProjects');
    const rows = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(rows)) return null;
    const hit = rows.find(r => r && r.slug === targetSlug);
    return hit && hit.project ? hit.project : null;
  } catch (_) {
    return null;
  }
}

// The onboarding starter (and any fork of it) is a throwaway sandbox for the
// guided tour. Every time it's opened we wipe its variant-scoped state so it
// returns to the pristine graph from data.js — as if the user had never
// touched it. The custom row's `project` stays pristine (graph edits live in
// cfg.variants, which we clear), so initApp re-seeds it fresh.
function _isOnboardingStarterSlug(s) {
  if (!s) return false;
  if (s === 'onboarding-starter') return true;
  if (s.indexOf('fork-onboarding-starter-') === 0) return true;
  try {
    const rows = JSON.parse(localStorage.getItem('cfg.customProjects') || '[]');
    const row = Array.isArray(rows) ? rows.find(r => r && r.slug === s) : null;
    if (row && row.forkedFrom === 'onboarding-starter') return true;
  } catch (_) {}
  return false;
}
function _resetOnboardingStarterStateIfNeeded(s) {
  if (!_isOnboardingStarterSlug(s)) return;
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '^cfg\\.(variants|activeVariant|variantPanelOpen)\\.' + esc + '$' +
    '|^cfg\\.(paths|runs|history)\\.' + esc + '\\.'
  );
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && re.test(k)) keys.push(k);
  }
  keys.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });

  // Ensure the pristine fork row still seeds at least one baseline run so the
  // tour's "compare runs" step has something to compare against (older forks
  // may predate the data.js fix that set this to 1).
  try {
    const rows = JSON.parse(localStorage.getItem('cfg.customProjects') || '[]');
    if (Array.isArray(rows)) {
      const idx = rows.findIndex(r => r && r.slug === s);
      if (idx >= 0 && rows[idx].project) {
        const proj = rows[idx].project;
        // The onboarding starter begins with no prior runs — the user's own
        // run is the first thing in the Runs panel.
        proj.demoRunCountByVariant = Object.assign({}, proj.demoRunCountByVariant, { v1: 0 });
        rows[idx].project = proj;
        localStorage.setItem('cfg.customProjects', JSON.stringify(rows));
      }
    }
  } catch (_) {}
}

if (!slug) {
  document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">No project specified. <a href="graphs-hub.html?tab=dashboard">Go to My Graphs</a></p>';
} else {
  _resetOnboardingStarterStateIfNeeded(slug);
  const customProject = _readCustomProjectBySlug(slug);
  if (customProject) {
    IS_CUSTOM_PROJECT = true;
    window.PROJECT = Object.assign({ slug }, customProject, { slug });
    /* Custom path calls initApp synchronously here; KEY / SUBGRAPHS / cloneGraph
       are declared later in this script → TDZ errors. Defer until this block finishes. */
    queueMicrotask(() => initApp());
  } else {
    const fail = () => {
      document.body.innerHTML = `<p style="padding:40px;font-family:sans-serif">Could not load project "${esc(slug)}". <a href="graphs-hub.html?tab=dashboard">Go to My Graphs</a></p>`;
    };
    if (typeof bootstrapBundledProject !== 'function') {
      fail();
    } else {
      bootstrapBundledProject(slug).then(() => { initApp(); }, fail);
    }
  }
}

/* ── Storage helpers ──────────────────────────────────────
   Variant-scoped data (paths, runs, history) keys off the project
   slug + active variant so experiments stay isolated. */
const KEY = {
  variants: `cfg.variants.${slug}`,
  active:   `cfg.activeVariant.${slug}`,
  projectTitle: `cfg.projectTitle.${slug}`,
  variantPanelOpen: `cfg.variantPanelOpen.${slug}`,
  paths:    (vid) => `cfg.paths.${slug}.${vid}`,
  runs:     (vid) => `cfg.runs.${slug}.${vid}`,
  history:  (vid) => `cfg.history.${slug}.${vid}`,
};
function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (_) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}
function _resolveProjectDisplayTitle(P) {
  try {
    const saved = localStorage.getItem(KEY.projectTitle);
    if (saved && saved.trim()) return saved.trim();
  } catch (_) {}
  if (P) {
    const fromProject = String(P.title || P.name || '').trim();
    if (fromProject) return fromProject;
  }
  try {
    const raw = localStorage.getItem('cfg.customProjects');
    const rows = raw ? JSON.parse(raw) : [];
    if (Array.isArray(rows)) {
      const row = rows.find(r => r && r.slug === slug);
      if (row) {
        const fromRow = (row.title || (row.project && row.project.title) || '').trim();
        if (fromRow) return fromRow;
      }
    }
  } catch (_) {}
  return '';
}
function _setProjectTitleUi(name) {
  const safe = (String(name || '').trim() || 'Untitled project');
  const el = document.getElementById('bcProject');
  if (el) el.textContent = safe;
  const ptName = document.getElementById('ptName');
  if (ptName && !ptName.isContentEditable) ptName.textContent = safe;
  const lpCur = document.getElementById('lpCurrentProjectName');
  if (lpCur) lpCur.textContent = safe;
  document.title = 'ConnectifyAI — ' + safe + ' (Editing, new)';
}
function _persistProjectTitle(name) {
  const safe = (String(name || '').trim() || 'Untitled project');
  try { localStorage.setItem(KEY.projectTitle, safe); } catch (_) { /* storage */ }
  if (window.PROJECT) window.PROJECT.title = safe;
  if (IS_CUSTOM_PROJECT) {
    try {
      const raw = localStorage.getItem('cfg.customProjects');
      const rows = raw ? JSON.parse(raw) : [];
      if (Array.isArray(rows)) {
        const idx = rows.findIndex(r => r && r.slug === slug);
        if (idx >= 0) {
          const row = rows[idx] || {};
          const proj = Object.assign({}, row.project || {}, { title: safe });
          rows[idx] = Object.assign({}, row, { project: proj });
          localStorage.setItem('cfg.customProjects', JSON.stringify(rows));
        }
      }
    } catch (_) { /* storage */ }
  }
  return safe;
}
function initProjectTitleRename() {
  function wireRename(nameEl) {
    if (!nameEl) return;
    nameEl.title = 'Click to rename project';
    const start = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (nameEl.isContentEditable) return;
      const original = (nameEl.textContent || '').trim() || 'Untitled project';
      nameEl.setAttribute('contenteditable', 'true');
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      const commit = () => {
        const next = (nameEl.textContent || '').trim() || original;
        nameEl.removeEventListener('blur', commit);
        nameEl.removeEventListener('keydown', onKey);
        nameEl.removeAttribute('contenteditable');
        const saved = _persistProjectTitle(next);
        _setProjectTitleUi(saved);
      };
      const onKey = (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); nameEl.blur(); }
        if (ke.key === 'Escape') { ke.preventDefault(); nameEl.textContent = original; nameEl.blur(); }
      };
      nameEl.addEventListener('blur', commit);
      nameEl.addEventListener('keydown', onKey);
    };
    nameEl.addEventListener('click', start);
    nameEl.addEventListener('keydown', (e) => {
      if (nameEl.isContentEditable) return;
      if (e.key === 'Enter' || e.key === ' ') start(e);
    });
  }
  wireRename(document.getElementById('bcProject'));
  wireRename(document.getElementById('ptName'));
}
function cloneGraph(g) {
  return {
    nodes: (g.nodes || []).map(n => ({
      ...n,
      inputs:  (n.inputs  || []).map(p => ({ ...p })),
      outputs: (n.outputs || []).map(p => ({ ...p })),
      custom: n.custom ? { ...n.custom } : undefined,
    })),
    connections: (g.connections || []).map(c => Canvas.snapshotConnection(c)),
    subgraphs: _cloneSubgraphs(g.subgraphs || []),
    canvasWidth: g.canvasWidth,
    canvasHeight: g.canvasHeight,
  };
}

// Active variant id lives here in memory; persisted to localStorage.
// Variant-scoped panels (paths, history, runs filter) read from this.
let ACTIVE_VID = 'v1';
const SUBGRAPHS = {
  items: [],
  layerEl: null,
  drag: null,
  dragGroup: null,
  layoutAnimating: false,
  stack: [],
  /** Shell z-index base per subgroup id (members use +1, lifted head +2). Filled on bump / renorm. */
  clusterShellZ: {},
  _suppressHeadroom: false,
  previewEl: null,
  selectedNodeIds: new Set(),
  marquee: null,
  marqueeTool: false,
  manualDraftName: 'New Group',
  manualDraftEl: null,
  _manualRenameBound: false,
  /** When expanded subgraph menu is portaled to `document.body` for stacking above nodes. */
  _menuPortal: null,
  _menuPortalRaf: null,
};
let _subgraphListenersBound = false;

function setPaletteTool(name) {
  const wasMarquee = SUBGRAPHS.marqueeTool;
  document.querySelectorAll('.tool-palette .tool').forEach(t => t.classList.toggle('active', t.dataset.tool === name));
  SUBGRAPHS.marqueeTool = (name === 'subgraph-marquee');
  document.body.classList.toggle('sg-marquee-tool', SUBGRAPHS.marqueeTool);
  if (!wasMarquee && SUBGRAPHS.marqueeTool && window.ConnectifyTutorial) {
    try { window.ConnectifyTutorial.notifyAction('marquee-tool-selected', {}); } catch (_) {}
  }
  if (!SUBGRAPHS.marqueeTool) {
    _setSelectedNodes([]);
    _clearManualSubgraphDraft();
  } else {
    _syncManualSubgraphDraftUi();
  }
}

function _sgShowInternalPins(g) {
  return g && g.showInternalPins !== false;
}
function _cloneSubgraphs(items) {
  return (items || []).map(g => ({
    id: g.id || ('sg_' + Date.now().toString(36)),
    name: (g.name || 'New Group').trim() || 'New Group',
    collapsed: !!g.collapsed,
    nodeIds: [...new Set((g.nodeIds || []).filter(Boolean))],
    showInternalPins: g.showInternalPins !== false,
  }));
}
function getSubgraphSnapshot() {
  return _cloneSubgraphs(SUBGRAPHS.items);
}
function _getNodeEl(nodeId) {
  return document.querySelector(`.node[data-node-id="${CSS.escape(nodeId)}"]`);
}
function _getSubgraphById(id) {
  return SUBGRAPHS.items.find(g => g.id === id) || null;
}
function _ensureSubgraphStack() {
  const ids = (SUBGRAPHS.items || []).map(g => g.id).filter(Boolean);
  const current = new Set(ids);
  SUBGRAPHS.stack = (SUBGRAPHS.stack || []).filter(id => current.has(id));
  ids.forEach(id => {
    if (!SUBGRAPHS.stack.includes(id)) SUBGRAPHS.stack.push(id);
  });
}
function _subgraphStackIndex(id) {
  _ensureSubgraphStack();
  const idx = SUBGRAPHS.stack.indexOf(id);
  return idx < 0 ? 0 : idx;
}
const Z_SURFACE_NODE_BASE = 15100;
function _subgraphShellZ(groupOrId) {
  const g = typeof groupOrId === 'string' ? _getSubgraphById(groupOrId) : groupOrId;
  if (!g) return Z_SURFACE_NODE_BASE + 8;
  const z = SUBGRAPHS.clusterShellZ && SUBGRAPHS.clusterShellZ[g.id];
  if (z != null && Number.isFinite(z)) return z;
  return Z_SURFACE_NODE_BASE + 20 + _subgraphStackIndex(g.id) * 6;
}
function reserveSubgraphShellZ(groupId) {
  const g = _getSubgraphById(groupId);
  if (!g || typeof Canvas.allocSurfaceZSlots !== 'function') return;
  const z0 = Canvas.allocSurfaceZSlots(3);
  if (!SUBGRAPHS.clusterShellZ) SUBGRAPHS.clusterShellZ = {};
  SUBGRAPHS.clusterShellZ[g.id] = z0;
}
function _applySubgraphClusterDomZ(groupId) {
  const z0 = SUBGRAPHS.clusterShellZ && SUBGRAPHS.clusterShellZ[groupId];
  if (z0 == null || !Number.isFinite(z0)) return;
  const g = _getSubgraphById(groupId);
  if (!g) return;
  const box = document.querySelector(`.subgraph-box[data-id="${CSS.escape(groupId)}"]`);
  if (box) box.style.zIndex = String(z0);
  const head = document.querySelector(`#subgraphHeadLayer .sg-head[data-sg-group="${CSS.escape(groupId)}"]`);
  if (head) {
    const Z_EDGE_FRONT = 15240;
    const order = _subgraphStackIndex(groupId);
    head.style.zIndex = String(Math.max(z0 + 2, Z_EDGE_FRONT + 16 + order * 2));
  }
  (g.nodeIds || []).forEach(id => {
    if (typeof Canvas.setNodeSurfaceZ === 'function') Canvas.setNodeSurfaceZ(id, z0 + 1, { redraw: false });
  });
}
function bumpSubgraphClusterSurface(groupId) {
  if (!groupId) return;
  reserveSubgraphShellZ(groupId);
  _applySubgraphClusterDomZ(groupId);
  Canvas.drawEdges();
}
function _syncSubgraphMemberSurfaceZToShell() {
  if (typeof Canvas.setNodeSurfaceZ !== 'function') return;
  (SUBGRAPHS.items || []).forEach(g => {
    const shell = _subgraphShellZ(g);
    (g.nodeIds || []).forEach(id => {
      const el = _getNodeEl(id);
      if (!el || el.classList.contains('sg-hidden')) return;
      Canvas.setNodeSurfaceZ(id, shell + 1, { redraw: false });
    });
  });
  Canvas.drawEdges();
}
function _bringSubgraphToFront(id, rerender = true) {
  if (!id) return;
  _ensureSubgraphStack();
  const idx = SUBGRAPHS.stack.indexOf(id);
  const moved = idx >= 0 && idx !== SUBGRAPHS.stack.length - 1;
  if (moved) {
    SUBGRAPHS.stack.splice(idx, 1);
    SUBGRAPHS.stack.push(id);
  }
  bumpSubgraphClusterSurface(id);
}
function _getSubgraphByNode(nodeId) {
  return SUBGRAPHS.items.find(g => (g.nodeIds || []).includes(nodeId)) || null;
}
function _detachSgMenuPortal() {
  if (SUBGRAPHS._menuPortalRaf != null) {
    cancelAnimationFrame(SUBGRAPHS._menuPortalRaf);
    SUBGRAPHS._menuPortalRaf = null;
  }
  const p = SUBGRAPHS._menuPortal;
  if (!p?.menu || !p.wrap) {
    SUBGRAPHS._menuPortal = null;
    return;
  }
  const { menu, wrap } = p;
  if (menu.parentNode !== wrap) wrap.appendChild(menu);
  menu.classList.remove('sg-menu-portal', 'open');
  menu.style.cssText = '';
  SUBGRAPHS._menuPortal = null;
}
function _syncSgMenuPortalPosition() {
  const p = SUBGRAPHS._menuPortal;
  const menu = p?.menu;
  const btn = p?.btn;
  if (!menu || !menu.classList.contains('sg-menu-portal') || !menu.classList.contains('open')) return;
  if (!btn || !btn.isConnected) {
    _detachSgMenuPortal();
    return;
  }
  const r = btn.getBoundingClientRect();
  const mw = Math.max(menu.getBoundingClientRect().width || menu.offsetWidth || 160, 150);
  menu.style.position = 'fixed';
  menu.style.top = `${Math.round(r.bottom + 4)}px`;
  menu.style.left = `${Math.round(Math.max(8, r.right - mw))}px`;
  menu.style.zIndex = '30050';
  menu.style.minWidth = '150px';
  menu.style.width = 'max-content';
  menu.style.maxWidth = 'min(300px, calc(100vw - 24px))';
}
function _menuPortalTick() {
  if (!SUBGRAPHS._menuPortal?.menu?.classList.contains('sg-menu-portal')
      || !SUBGRAPHS._menuPortal?.menu?.classList.contains('open')) {
    SUBGRAPHS._menuPortalRaf = null;
    return;
  }
  _syncSgMenuPortalPosition();
  SUBGRAPHS._menuPortalRaf = requestAnimationFrame(_menuPortalTick);
}
function _attachSgMenuPortal(menu, btn, wrap) {
  _detachSgMenuPortal();
  menu.classList.add('sg-menu-portal', 'open');
  document.body.appendChild(menu);
  SUBGRAPHS._menuPortal = { menu, wrap, btn };
  requestAnimationFrame(() => {
    _syncSgMenuPortalPosition();
    if (SUBGRAPHS._menuPortalRaf != null) cancelAnimationFrame(SUBGRAPHS._menuPortalRaf);
    SUBGRAPHS._menuPortalRaf = requestAnimationFrame(_menuPortalTick);
  });
}
function _closeAllSgMenusInLayer(layer) {
  _detachSgMenuPortal();
  layer?.querySelectorAll('.sg-menu.open').forEach(m => m.classList.remove('open'));
  document.getElementById('subgraphHeadLayer')?.querySelectorAll('.sg-menu.open').forEach(m => m.classList.remove('open'));
}
function _ensureSubgraphLayer() {
  const inner = Canvas.getCanvasInner();
  if (!inner) return null;
  if (SUBGRAPHS.layerEl && SUBGRAPHS.layerEl.isConnected) {
    inner.appendChild(SUBGRAPHS.layerEl);
    return SUBGRAPHS.layerEl;
  }
  const layer = document.createElement('div');
  layer.className = 'subgraph-layer';
  layer.id = 'subgraphLayer';
  inner.appendChild(layer);
  SUBGRAPHS.layerEl = layer;
  return layer;
}
/** Lift `.sg-head` out of `#subgraphLayer` for positioning; z 15017 keeps heads above the subgraph shell. */
function _ensureSubgraphHeadLayer() {
  const inner = Canvas.getCanvasInner();
  if (!inner) return null;
  let el = document.getElementById('subgraphHeadLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'subgraphHeadLayer';
    el.className = 'subgraph-head-layer';
    inner.appendChild(el);
  }
  const front = inner.querySelector('svg.edge-overlay-front');
  if (front?.parentElement === inner && el.parentElement === inner) {
    if (el.previousElementSibling !== front) inner.insertBefore(el, front.nextSibling);
  } else if (el.parentElement !== inner) {
    inner.appendChild(el);
  }
  return el;
}
function _subgraphBoxFromHead(head) {
  const gid = head?.dataset?.sgGroup;
  if (!gid) return null;
  return document.querySelector(`.subgraph-box[data-id="${CSS.escape(gid)}"]`);
}
/** While head is in the box (pre-lift) or after lift: keep collapsed list `top` and box height in sync with head block height. */
function _syncCollapsedSubgraphChromeFromHead(head, box) {
  if (!head || !box || !box.classList.contains('collapsed')) return;
  void head.offsetHeight;
  const headH = head.offsetHeight;
  const gap = 6;
  const listTop = Math.max(34, Math.ceil(headH + gap));
  box.style.setProperty('--sg-collapsed-list-top', `${listTop}px`);
  const list = box.querySelector('.sg-collapsed-list');
  const rowN = list ? list.querySelectorAll('.sg-node-row').length : 0;
  const rowStack = rowN === 0 ? 40 : rowN * 29 + 12;
  const bottomChrome = 8;
  const nextH = Math.max(96, Math.ceil(listTop + rowStack + bottomChrome));
  if (Math.abs((parseFloat(box.style.height) || 0) - nextH) > 0.5) {
    box.style.height = `${nextH}px`;
    box.dataset.height = String(nextH);
  }
}
function _presetCollapsedSubgraphHeightsFromHead(layer) {
  layer.querySelectorAll('.subgraph-box.collapsed[data-id]').forEach((box) => {
    const head = box.querySelector('.sg-head');
    if (!head) return;
    _syncCollapsedSubgraphChromeFromHead(head, box);
  });
}
function _positionLiftedSgHead(head, box) {
  if (!head || !box) return;
  const left = parseFloat(box.style.left) || 0;
  const top = parseFloat(box.style.top) || 0;
  const width = parseFloat(box.style.width) || 0;
  /* Match box border so the head sits on the inner side of the stroke (border-box sizing on .subgraph-box). */
  let bw = 0;
  if (box.classList.contains('expanded')) bw = 2;
  else if (box.classList.contains('collapsed')) bw = 1;
  else if (box.classList.contains('preview')) bw = 2;
  const innerLeft = left + bw;
  const innerTop = top + bw;
  const innerW = Math.max(0, width - bw * 2);
  head.style.position = 'absolute';
  head.style.left = `${innerLeft}px`;
  head.style.top = `${innerTop}px`;
  head.style.width = `${innerW}px`;
  head.style.right = 'auto';
  head.style.marginLeft = '0';
  head.style.boxSizing = 'border-box';
  const gid = box.dataset.id;
  if (gid) {
    const g = _getSubgraphById(gid);
    const shellZ = (g ? _subgraphShellZ(g) : Z_SURFACE_NODE_BASE + 20) + 2;
    /* Front edge overlay is z=15240; heads + kebab menus must sit above it. */
    const Z_EDGE_FRONT = 15240;
    const order = _subgraphStackIndex(gid);
    head.style.zIndex = String(Math.max(shellZ, Z_EDGE_FRONT + 16 + order * 2));
  }
  if (box.classList.contains('collapsed')) {
    _syncCollapsedSubgraphChromeFromHead(head, box);
  } else {
    box.style.removeProperty('--sg-collapsed-list-top');
  }
}
function _syncAllLiftedSgHeads() {
  const hl = document.getElementById('subgraphHeadLayer');
  if (!hl) return;
  hl.querySelectorAll('.sg-head[data-sg-group]').forEach(head => {
    const box = _subgraphBoxFromHead(head);
    if (box) _positionLiftedSgHead(head, box);
  });
}
function _liftSubgraphHeadsIntoOverlay(layer) {
  const headLayer = _ensureSubgraphHeadLayer();
  if (!headLayer) return;
  headLayer.replaceChildren();
  layer.querySelectorAll('.subgraph-box').forEach(box => {
    const head = box.querySelector('.sg-head');
    if (!head) return;
    const gid = box.dataset.id;
    if (gid) {
      head.dataset.sgGroup = gid;
      head.dataset.sgState = box.classList.contains('collapsed') ? 'collapsed' : 'expanded';
    }
    headLayer.appendChild(head);
    _positionLiftedSgHead(head, box);
  });
}
function _maybeRunLiftedHeadSyncLoop() {
  const step = () => {
    _syncAllLiftedSgHeads();
    if (document.querySelector('.subgraph-box.sg-animating')) requestAnimationFrame(step);
  };
  if (document.querySelector('.subgraph-box.sg-animating')) requestAnimationFrame(step);
}
/** World-space AABB for overlap checks; works while peers are `sg-hidden` (display:none) before the next render. */
function _sgMemberLayoutRect(nodeId) {
  const el = _getNodeEl(nodeId);
  const nd = Canvas.getNode(nodeId);
  if (!el || !nd) return null;
  const x = parseFloat(el.style.left) || Number(nd.x) || 0;
  const y = parseFloat(el.style.top) || Number(nd.y) || 0;
  let w = el.offsetWidth;
  let h = el.offsetHeight;
  if (el.classList.contains('sg-hidden') || w < 2 || h < 2) {
    w = Math.max(180, w || 200);
    h = Math.max(120, h || 120);
  }
  return { x, y, w, h };
}
/** Nudge a node that was just added to an expanded subgraph so it does not overlap other members. */
function _nudgeSubgraphMemberClearOverlaps(nodeId, group) {
  const GAP = 12;
  if (!group || group.collapsed || (group.nodeIds || []).length < 2) return;
  const el = _getNodeEl(nodeId);
  const n = Canvas.getNode(nodeId);
  if (!el || !n) return;
  for (let iter = 0; iter < 80; iter++) {
    const self = _sgMemberLayoutRect(nodeId);
    if (!self) return;
    let moved = false;
    for (const id of group.nodeIds) {
      if (id === nodeId) continue;
      const o = _sgMemberLayoutRect(id);
      if (!o) continue;
      const ox = Math.min(self.x + self.w, o.x + o.w) - Math.max(self.x, o.x);
      const oy = Math.min(self.y + self.h, o.y + o.h) - Math.max(self.y, o.y);
      if (ox <= 0 || oy <= 0) continue;
      let dx = 0;
      let dy = 0;
      if (ox <= oy) {
        const dir = (self.x + self.w / 2) <= (o.x + o.w / 2) ? -1 : 1;
        dx = dir * (ox + GAP);
      } else {
        const dir = (self.y + self.h / 2) <= (o.y + o.h / 2) ? -1 : 1;
        dy = dir * (oy + GAP);
      }
      const nx = (parseFloat(el.style.left) || 0) + dx;
      const ny = (parseFloat(el.style.top) || 0) + dy;
      n.x = nx;
      n.y = ny;
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      moved = true;
      break;
    }
    if (!moved) break;
  }
}
function _subgraphBounds(group) {
  const PAD_X = 32, PAD_Y = 36;
  /* Expanded: reserve enough top padding for full-width sg-head so nodes never sit under it. */
  const SG_HEAD_TOP_PAD = 56;
  /* A node with a Start/End badge has visible chrome ~30px above its card
     (badge height + 8px gap + notch). Treat that as part of the node's
     footprint when this group is expanded so the subgroup top expands to
     fit and the sg-head doesn't overlap the badge. */
  const ROLE_BADGE_OVERHANG = 30;
  const topPad = (group && !group.collapsed) ? Math.max(PAD_Y, SG_HEAD_TOP_PAD) : PAD_Y;
  const isExpanded = group && !group.collapsed;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  (group.nodeIds || []).forEach(id => {
    const el = _getNodeEl(id);
    if (!el) return;
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth || 200;
    const h = el.offsetHeight || 120;
    const yEffective = (isExpanded && el.querySelector('.node-role-badge'))
      ? y - ROLE_BADGE_OVERHANG
      : y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, yEffective);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  if (!isFinite(minX)) return null;
  const left = Math.round(minX - PAD_X);
  const top = Math.round(minY - topPad);
  const width = Math.round((maxX - minX) + PAD_X * 2);
  const height = Math.round((maxY - minY) + topPad + PAD_Y);
  return { left, top, width, height };
}
function _normalizeSubgraphs() {
  const validNodeIds = new Set(Canvas.getAllNodes().map(n => n.id));
  SUBGRAPHS.items = SUBGRAPHS.items
    .map(g => ({ ...g, nodeIds: [...new Set((g.nodeIds || []).filter(id => validNodeIds.has(id)))] }))
    .filter(g => g.nodeIds.length >= 1);
}
function _syncCollapsedNodeVisibility() {
  document.querySelectorAll('.node.sg-hidden').forEach(el => el.classList.remove('sg-hidden'));
  document.querySelectorAll('.node.sg-member').forEach(el => el.classList.remove('sg-member'));
  document.querySelectorAll('.node.sg-nonmember').forEach(el => el.classList.remove('sg-nonmember'));
  const memberIds = new Set();
  SUBGRAPHS.items.forEach(g => {
    (g.nodeIds || []).forEach(id => {
      memberIds.add(id);
      _getNodeEl(id)?.classList.add('sg-member');
    });
  });
  document.querySelectorAll('.node[data-node-id]').forEach(el => {
    const id = el.dataset.nodeId;
    if (!id || memberIds.has(id)) return;
    el.classList.add('sg-nonmember');
  });
  SUBGRAPHS.items.filter(g => g.collapsed).forEach(g => {
    (g.nodeIds || []).forEach(id => _getNodeEl(id)?.classList.add('sg-hidden'));
  });
}
function _detachSelectedNodesFromExistingSubgraphs() {
  /* While rectangle-marquee dragging, selection changes every move — do not
     mutate subgraph membership until mouseup (create flow handles that). */
  if (SUBGRAPHS.marquee) return;
  const sel = SUBGRAPHS.selectedNodeIds;
  if (!sel || !sel.size) return;
  let changed = false;
  SUBGRAPHS.items.forEach(g => {
    const before = (g.nodeIds || []).length;
    g.nodeIds = (g.nodeIds || []).filter(id => !sel.has(id));
    if ((g.nodeIds || []).length !== before) changed = true;
  });
  if (!changed) return;
  _normalizeSubgraphs();
  _markSubgraphMutation();
  renderSubgraphs();
  if (typeof Canvas !== 'undefined' && Canvas.drawEdges) Canvas.drawEdges();
}
function _setSelectedNodes(ids) {
  SUBGRAPHS.selectedNodeIds = new Set((ids || []).filter(Boolean));
  document.querySelectorAll('.node.sg-selected').forEach(n => n.classList.remove('sg-selected'));
  SUBGRAPHS.selectedNodeIds.forEach(id => _getNodeEl(id)?.classList.add('sg-selected'));
  if (SUBGRAPHS.marqueeTool && !SUBGRAPHS.marquee && SUBGRAPHS.selectedNodeIds.size) {
    _detachSelectedNodesFromExistingSubgraphs();
  }
  _syncManualSubgraphDraftUi();
}
function _syncManualSubgraphDraftUi() {
  const canvasArea = document.getElementById('canvasArea');
  if (!canvasArea) return;
  const nodeIds = [...SUBGRAPHS.selectedNodeIds].filter(id => !!Canvas.getNode(id));
  const shouldShow = SUBGRAPHS.marqueeTool && nodeIds.length >= 2;
  if (!shouldShow) {
    _clearManualSubgraphDraft();
    return;
  }
  if (!SUBGRAPHS.manualDraftEl || !SUBGRAPHS.manualDraftEl.isConnected) {
    const el = document.createElement('div');
    el.className = 'sg-builder-float';
    el.id = 'sgBuilderFloat';
    canvasArea.appendChild(el);
    SUBGRAPHS.manualDraftEl = el;
  }
  const draftName = (SUBGRAPHS.manualDraftName || 'New Group').trim() || 'New Group';
  const nodeCountLabel = `${nodeIds.length} node${nodeIds.length === 1 ? '' : 's'}`;
  SUBGRAPHS.manualDraftEl.innerHTML = `
    <div class="sg-head" data-sg-draft-head="1">
      <div class="sg-head-main">
        <svg class="sg-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <span class="sg-name" data-new-sg-name="1">${esc(draftName)}</span>
      </div>
      <div class="sg-head-trail">
        <span class="sg-head-tags"><span class="sg-pill">${esc(nodeCountLabel)}</span></span>
      </div>
    </div>
    <div class="sg-builder-list">${nodeIds.map(id => {
      const n = Canvas.getNode(id);
      const nm = (n?.label || n?.name || id);
      const dot = n?.color || '#94a3b8';
      return `<div class="sg-node-row" data-node-id="${esc(id)}">
        <span class="dot" style="background:${esc(dot)}"></span>
        <span class="icon">${_sgTypeIcon(n?.type)}</span>
        <span class="name">${esc(nm)}</span>
        <button class="remove-btn" type="button" data-new-sg-remove="${esc(id)}" title="Remove node">×</button>
      </div>`;
    }).join('')}</div>
    <div class="sg-builder-actions">
      <button class="cancel" type="button" data-new-sg-cancel="1">Cancel</button>
      <button class="create" type="button" data-new-sg-create="1">Create subgraph</button>
    </div>
  `;
}
function _clearManualSubgraphDraft() {
  if (SUBGRAPHS.manualDraftEl?.isConnected) SUBGRAPHS.manualDraftEl.remove();
  SUBGRAPHS.manualDraftEl = null;
  SUBGRAPHS.manualDraftName = 'New Group';
}
function _startManualDraftRename() {
  const nameEl = SUBGRAPHS.manualDraftEl?.querySelector('[data-new-sg-name]');
  if (!nameEl || nameEl.contentEditable === 'true') return;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  sel?.removeAllRanges();
  sel?.addRange(range);
  const commit = () => {
    const v = (nameEl.textContent || '').trim();
    SUBGRAPHS.manualDraftName = v || 'New Group';
    nameEl.textContent = SUBGRAPHS.manualDraftName;
    nameEl.contentEditable = 'false';
  };
  const cancel = () => {
    nameEl.textContent = SUBGRAPHS.manualDraftName || 'New Group';
    nameEl.contentEditable = 'false';
  };
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };
  nameEl.addEventListener('blur', commit, { once: true });
  nameEl.addEventListener('keydown', onKey, { once: true });
}
function _createSubgraphFromManualDraft() {
  const ids = [...SUBGRAPHS.selectedNodeIds].filter(Boolean);
  if (ids.length < 2) return;
  const g = _createSubgraph(ids, false);
  if (!g) return;
  // The tour pre-names this "Data group" (set in _createSubgraph) — don't
  // clobber it with the empty manual-draft name.
  if (!_tutorialActive()) {
    g.name = (SUBGRAPHS.manualDraftName || 'New Group').trim() || 'New Group';
  }
  _setSelectedNodes([]);
  _clearManualSubgraphDraft();
  _markSubgraphMutation();
  renderSubgraphs();
}
function _markSubgraphMutation() {
  if (typeof pushUndoSnapshot === 'function' && typeof HISTORY_APPLYING !== 'undefined' && !HISTORY_APPLYING) {
    pushUndoSnapshot();
  }
  if (typeof CANVAS_CHANGE_EPOCH !== 'undefined') CANVAS_CHANGE_EPOCH += 1;
  if (typeof LAST_AUTO_LAYOUT_EPOCH !== 'undefined') LAST_AUTO_LAYOUT_EPOCH = -1;
  snapshotActiveVariant();
}
function _startSubgraphRename(groupId) {
  const nameEl = document.querySelector(`#subgraphHeadLayer .sg-head[data-sg-group="${CSS.escape(groupId)}"] .sg-name`)
    || document.querySelector(`.subgraph-box[data-id="${CSS.escape(groupId)}"] .sg-name`);
  if (!nameEl) return;
  if (nameEl.contentEditable === 'true') return;
  const g = _getSubgraphById(groupId);
  if (!g) return;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  sel.removeAllRanges();
  sel.addRange(range);
  let done = false;
  const endEdit = () => {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    nameEl.removeEventListener('keydown', onKey);
    nameEl.removeEventListener('blur', onBlur);
  };
  const commit = () => {
    if (done) return;
    done = true;
    endEdit();
    const next = (nameEl.textContent || '').trim() || 'New Group';
    g.name = next;
    nameEl.textContent = next;
    nameEl.contentEditable = 'false';
    _markSubgraphMutation();
    requestAnimationFrame(() => {
      _syncAllLiftedSgHeads();
      if (typeof Canvas !== 'undefined' && Canvas.drawEdges) Canvas.drawEdges();
    });
  };
  const cancel = () => {
    if (done) return;
    done = true;
    endEdit();
    nameEl.textContent = g.name || 'New Group';
    nameEl.contentEditable = 'false';
    requestAnimationFrame(() => {
      _syncAllLiftedSgHeads();
      if (typeof Canvas !== 'undefined' && Canvas.drawEdges) Canvas.drawEdges();
    });
  };
  const onBlur = () => { commit(); };
  const onDocPointerDown = (ev) => {
    if (nameEl.contains(ev.target)) return;
    nameEl.blur();
  };
  const onKey = (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();
      nameEl.blur();
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      cancel();
    }
  };
  document.addEventListener('pointerdown', onDocPointerDown, true);
  nameEl.addEventListener('blur', onBlur);
  nameEl.addEventListener('keydown', onKey);
  nameEl.addEventListener('input', () => {
    requestAnimationFrame(() => {
      _syncAllLiftedSgHeads();
      if (typeof Canvas !== 'undefined' && Canvas.drawEdges) Canvas.drawEdges();
    });
  });
}
function _nodeAnchorWorld(nodeId, side) {
  const el = _getNodeEl(nodeId);
  if (!el) return null;
  const x = parseFloat(el.style.left) || 0;
  const y = parseFloat(el.style.top) || 0;
  const w = el.offsetWidth || 200;
  const h = el.offsetHeight || 120;
  return {
    x: side === 'in' ? x : (x + w),
    y: y + h * 0.5,
  };
}
function _nodePortAnchorWorld(nodeId, dir, portName) {
  const nodeEl = _getNodeEl(nodeId);
  if (!nodeEl) return null;
  const anchor = nodeEl.querySelector(`.port-anchor[data-port="${CSS.escape(dir + ':' + portName)}"]`);
  if (!anchor) return _nodeAnchorWorld(nodeId, dir === 'in' ? 'in' : 'out');
  const ar = anchor.getBoundingClientRect();
  return Canvas.clientToWorld(ar.left + ar.width / 2, ar.top + ar.height / 2);
}
function _subgraphExternalIo(group) {
  const members = new Set(group.nodeIds || []);
  const incoming = [];
  const outgoing = [];
  Canvas.getConnections().forEach(c => {
    const fromIn = members.has(c.from[0]);
    const toIn = members.has(c.to[0]);
    if (fromIn === toIn) return;
    if (!fromIn && toIn) incoming.push(c);
    if (fromIn && !toIn) outgoing.push(c);
  });
  return { incoming, outgoing };
}
function _collapsedRowBoundaryPorts(group, nodeId) {
  const members = new Set(group.nodeIds || []);
  let hasIn = false;
  let hasOut = false;
  Canvas.getConnections().forEach(c => {
    const fromIn = members.has(c.from[0]);
    const toIn = members.has(c.to[0]);
    if (fromIn === toIn) return;
    if (!fromIn && toIn && c.to[0] === nodeId) hasIn = true;
    if (fromIn && !toIn && c.from[0] === nodeId) hasOut = true;
  });
  return { hasIn, hasOut };
}
function _installSubgraphCollapsedPortHooks() {
  window.getSubgraphCollapsedPortAnchorEl = (nodeId, dir) => {
    const g = _getSubgraphByNode(nodeId);
    if (!g || !g.collapsed) return null;
    const box = document.querySelector(`.subgraph-box.collapsed[data-id="${CSS.escape(g.id)}"]`);
    if (!box) return null;
    if (_sgShowInternalPins(g)) {
      const sel = dir === 'in' ? '.sg-row-port-in' : '.sg-row-port-out';
      return box.querySelector(`.sg-node-row[data-node-id="${CSS.escape(String(nodeId))}"] ${sel}`);
    }
    const sel = dir === 'in' ? '.sg-port-bundle-in' : '.sg-port-bundle-out';
    return box.querySelector(sel);
  };
  window.getSubgraphCollapsedPortWorld = (nodeId, dir, _portName, _canvasRect) => {
    const g = _getSubgraphByNode(nodeId);
    if (!g || !g.collapsed) return null;
    const box = document.querySelector(`.subgraph-box.collapsed[data-id="${CSS.escape(g.id)}"]`);
    if (!box) return null;
    let port = null;
    if (_sgShowInternalPins(g)) {
      const row = box.querySelector(`.sg-node-row[data-node-id="${CSS.escape(String(nodeId))}"]`);
      if (!row) return null;
      const sel = dir === 'in' ? '.sg-row-port-in' : '.sg-row-port-out';
      port = row.querySelector(sel);
    } else {
      const sel = dir === 'in' ? '.sg-port-bundle-in' : '.sg-port-bundle-out';
      port = box.querySelector(sel);
    }
    if (!port) return null;
    const ar = port.getBoundingClientRect();
    if (!ar.width && !ar.height) return null;
    return Canvas.clientToWorld(ar.left + ar.width / 2, ar.top + ar.height / 2);
  };
  window.syncSubgraphCollapsedPortConnectedState = (connections) => {
    document.querySelectorAll('.sg-row-port.connected').forEach(el => el.classList.remove('connected'));
    document.querySelectorAll('.sg-row-port.edge-hovered').forEach(el => el.classList.remove('edge-hovered'));
    const memberToGroup = new Map();
    SUBGRAPHS.items.forEach(g => {
      if (!g.collapsed) return;
      (g.nodeIds || []).forEach(id => memberToGroup.set(id, g.id));
    });
    (connections || []).forEach(c => {
      const gidFrom = memberToGroup.get(c.from[0]);
      const gidTo = memberToGroup.get(c.to[0]);
      /* Edge between two *different* collapsed subgraphs: both ends are "in a group",
         so the one-sided branches below never ran — port dots stayed without `.connected`
         and looked invisible (they only get a fill from that class). */
      if (gidFrom && gidTo && gidFrom !== gidTo) {
        const gFrom = _getSubgraphById(gidFrom);
        const boxFrom = document.querySelector(`.subgraph-box.collapsed[data-id="${CSS.escape(gidFrom)}"]`);
        if (boxFrom && gFrom) {
          if (_sgShowInternalPins(gFrom)) {
            boxFrom.querySelector(`.sg-node-row[data-node-id="${CSS.escape(String(c.from[0]))}"] .sg-row-port-out`)?.classList.add('connected');
          } else {
            boxFrom.querySelector('.sg-port-bundle-out')?.classList.add('connected');
          }
        }
        const gTo = _getSubgraphById(gidTo);
        const boxTo = document.querySelector(`.subgraph-box.collapsed[data-id="${CSS.escape(gidTo)}"]`);
        if (boxTo && gTo) {
          if (_sgShowInternalPins(gTo)) {
            boxTo.querySelector(`.sg-node-row[data-node-id="${CSS.escape(String(c.to[0]))}"] .sg-row-port-in`)?.classList.add('connected');
          } else {
            boxTo.querySelector('.sg-port-bundle-in')?.classList.add('connected');
          }
        }
        return;
      }
      if (gidFrom && !gidTo) {
        const g = _getSubgraphById(gidFrom);
        const box = document.querySelector(`.subgraph-box.collapsed[data-id="${CSS.escape(gidFrom)}"]`);
        if (!box || !g) return;
        if (_sgShowInternalPins(g)) {
          box.querySelector(`.sg-node-row[data-node-id="${CSS.escape(String(c.from[0]))}"] .sg-row-port-out`)?.classList.add('connected');
        } else {
          box.querySelector('.sg-port-bundle-out')?.classList.add('connected');
        }
      }
      if (gidTo && !gidFrom) {
        const g = _getSubgraphById(gidTo);
        const box = document.querySelector(`.subgraph-box.collapsed[data-id="${CSS.escape(gidTo)}"]`);
        if (!box || !g) return;
        if (_sgShowInternalPins(g)) {
          box.querySelector(`.sg-node-row[data-node-id="${CSS.escape(String(c.to[0]))}"] .sg-row-port-in`)?.classList.add('connected');
        } else {
          box.querySelector('.sg-port-bundle-in')?.classList.add('connected');
        }
      }
    });
  };
  window.isInternalCollapsedSubgraphEdge = (c) => {
    if (!c?.from?.[0] || !c?.to?.[0]) return false;
    const ga = _getSubgraphByNode(c.from[0]);
    const gb = _getSubgraphByNode(c.to[0]);
    return !!(ga && gb && ga.id === gb.id && ga.collapsed);
  };
  /** Used by canvas-new.js to mask member edges over unrelated subgraph shells only. */
  window.getSubgraphGroupIdForNode = (nodeId) => {
    const g = _getSubgraphByNode(nodeId);
    return g ? g.id : null;
  };
  window.getSubgraphMemberNodeIds = (groupId) => {
    const g = _getSubgraphById(groupId);
    return g ? g.nodeIds : [];
  };
}
function _autoArrangeSubgraphNodes(nodeIds) {
  const ids = [...new Set((nodeIds || []).filter(Boolean))];
  if (ids.length < 2) return;
  const nodes = ids.map(id => {
    const el = _getNodeEl(id);
    return el ? {
      id,
      el,
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top) || 0,
      w: el.offsetWidth || 200,
      h: el.offsetHeight || 120,
    } : null;
  }).filter(Boolean);
  if (nodes.length < 2) return;
  nodes.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const avgW = nodes.reduce((s, n) => s + n.w, 0) / nodes.length;
  const avgH = nodes.reduce((s, n) => s + n.h, 0) / nodes.length;
  const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.ceil(nodes.length / cols);
  const stepX = avgW + 36;
  const stepY = avgH + 32;
  const startX = Math.round(cx - ((cols - 1) * stepX) / 2);
  const startY = Math.round(cy - ((rows - 1) * stepY) / 2);
  const layout = {};
  nodes.forEach((n, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const nx = startX + col * stepX;
    const ny = startY + row * stepY;
    layout[n.id] = { x: nx, y: ny };
  });
  const finish = () => {
    SUBGRAPHS.layoutAnimating = false;
    _markSubgraphMutation();
    renderSubgraphs();
    Canvas.drawEdges();
  };
  SUBGRAPHS.layoutAnimating = true;
  const changed = Canvas.applyNodeLayout(layout, {
    animate: true,
    duration: 440,
    easing: 'cubic-bezier(0.42, 0, 0.58, 1)',
    onFrame: () => {
      renderSubgraphs();
      Canvas.drawEdges();
    },
    onComplete: finish,
  });
  if (!changed) finish();
}
function _subgraphPreviewBounds(nodeIds) {
  const ids = [...new Set((nodeIds || []).filter(Boolean))];
  if (ids.length < 1) return null;
  const PAD_X = 32, PAD_Y = 36;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  ids.forEach(id => {
    const el = _getNodeEl(id);
    if (!el) return;
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth || 200;
    const h = el.offsetHeight || 120;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  if (!isFinite(minX)) return null;
  return {
    left: Math.round(minX - PAD_X),
    top: Math.round(minY - PAD_Y),
    width: Math.round((maxX - minX) + PAD_X * 2),
    height: Math.round((maxY - minY) + PAD_Y * 2),
  };
}
function _showSubgraphPreview(nodeIds) {
  const layer = _ensureSubgraphLayer();
  if (!layer) return;
  const b = _subgraphPreviewBounds(nodeIds);
  if (!b) return;
  if (!SUBGRAPHS.previewEl || !SUBGRAPHS.previewEl.isConnected) {
    const el = document.createElement('div');
    el.className = 'subgraph-box preview';
    el.id = 'sgPreview';
    layer.appendChild(el);
    SUBGRAPHS.previewEl = el;
  }
  const el = SUBGRAPHS.previewEl;
  el.style.left = `${b.left}px`;
  el.style.top = `${b.top}px`;
  el.style.width = `${b.width}px`;
  el.style.height = `${b.height}px`;
}
function _clearSubgraphPreview() {
  if (SUBGRAPHS.previewEl?.isConnected) SUBGRAPHS.previewEl.remove();
  SUBGRAPHS.previewEl = null;
}
function _flashSubgraphDance(groupId) {
  const el = document.querySelector(`.subgraph-box[data-id="${CSS.escape(groupId)}"]`);
  if (!el) return;
  el.classList.remove('sg-dance');
  void el.offsetWidth;
  el.classList.add('sg-dance');
}
function _sgTypeIcon(type) {
  const icon = Canvas?.ICONS?.[type];
  if (icon) return icon;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>';
}
function _nudgeSubgraphMembersBelowHead(layer) {
  // During subgroup drag we re-render every mousemove; auto-headroom nudges
  // would otherwise apply repeatedly to unrelated expanded groups.
  if (SUBGRAPHS.dragGroup || SUBGRAPHS._suppressHeadroom || SUBGRAPHS.layoutAnimating) return false;
  const { zoom } = Canvas.getTransform();
  const z = zoom || 1;
  const GAP = 8;
  const NUDGE_EPS = 1.5;
  let changed = false;
  layer.querySelectorAll('.subgraph-box.expanded[data-id]').forEach(box => {
    const gid = box.dataset.id;
    const g = _getSubgraphById(gid);
    if (!g) return;
    const head = box.querySelector('.sg-head');
    if (!head) return;
    const headWorld = Math.round(head.getBoundingClientRect().height / z);
    if (headWorld < 6) return;
    const boxTop = parseFloat(box.style.top) || 0;
    const floorY = Math.round(boxTop + headWorld + GAP);
    let minY = Infinity;
    (g.nodeIds || []).forEach(id => {
      const el = _getNodeEl(id);
      if (!el || el.classList.contains('sg-hidden')) return;
      minY = Math.min(minY, parseFloat(el.style.top) || 0);
    });
    const delta = floorY - minY;
    if (!isFinite(minY) || delta <= NUDGE_EPS) return;
    const dy = Math.max(1, Math.round(delta));
    (g.nodeIds || []).forEach(id => {
      const el = _getNodeEl(id);
      const n = Canvas.getNode(id);
      if (!el || !n) return;
      const ny = (parseFloat(el.style.top) || 0) + dy;
      n.y = ny;
      el.style.top = `${ny}px`;
    });
    changed = true;
  });
  return changed;
}
function renderSubgraphs() {
  _normalizeSubgraphs();
  _ensureSubgraphStack();
  _syncCollapsedNodeVisibility();
  const layer = _ensureSubgraphLayer();
  if (!layer) return;
  _detachSgMenuPortal();
  const prevLayoutByGroup = new Map();
  layer.querySelectorAll('.subgraph-box[data-id]').forEach(el => {
    const id = el.dataset.id;
    prevLayoutByGroup.set(id, {
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
      width: parseFloat(el.style.width) || 0,
      height: parseFloat(el.style.height) || 0,
    });
  });
  const boxLayoutByGroup = new Map();
  const groupsInStackOrder = [...SUBGRAPHS.items].sort((a, b) => _subgraphStackIndex(a.id) - _subgraphStackIndex(b.id));
  const html = groupsInStackOrder.map(group => {
    const b = _subgraphBounds(group);
    if (!b) return '';
    let left = b.left, top = b.top, width = b.width, height = b.height;
    if (group.collapsed) {
      const rowCount = (group.nodeIds || []).length;
      width = 290;
      /* ~head + rows (26px row + 6px gap) + small chrome; avoid tall empty min when few rows */
      height = Math.max(96, 40 + rowCount * 32 + 10);
      left = Math.round(b.left + Math.max(0, (b.width - width) / 2));
      top = Math.round(b.top + 10);
    } else {
      width = Math.max(350, width);
    }
    boxLayoutByGroup.set(group.id, { left, top, width, height });
    const nodeCountLabel = `${group.nodeIds.length} node${group.nodeIds.length === 1 ? '' : 's'}`;
    const io = group.collapsed ? _subgraphExternalIo(group) : { incoming: [], outgoing: [] };
    const pins = group.collapsed && _sgShowInternalPins(group);
    const bundleIn = group.collapsed && !pins && io.incoming.length
      ? '<span class="sg-row-port sg-port-bundle-in" aria-hidden="true"></span>'
      : '';
    const bundleOut = group.collapsed && !pins && io.outgoing.length
      ? '<span class="sg-row-port sg-port-bundle-out" aria-hidden="true"></span>'
      : '';
    const collapsedRows = group.collapsed
      ? `<div class="sg-collapsed-list">${(group.nodeIds || []).map(id => {
          const n = Canvas.getNode(id);
          const nm = (n?.label || n?.name || id);
          const dot = n?.color || '#94a3b8';
          let portIn = '';
          let portOut = '';
          if (pins) {
            const { hasIn, hasOut } = _collapsedRowBoundaryPorts(group, id);
            portIn = hasIn ? '<span class="sg-row-port sg-row-port-in"></span>' : '';
            portOut = hasOut ? '<span class="sg-row-port sg-row-port-out"></span>' : '';
          }
          return `<div class="sg-node-row" data-node-id="${esc(id)}">${portIn}${portOut}
            <span class="dot" style="background:${esc(dot)}"></span>
            <span class="icon">${_sgTypeIcon(n?.type)}</span>
            <span class="name">${esc(nm)}</span>
          </div>`;
        }).join('')}</div>`
      : '';
    const pinsMenuLabel = _sgShowInternalPins(group)
      ? 'Collapse internal ports'
      : 'Show internal ports';
    const shellZ = _subgraphShellZ(group);
    const headZ = shellZ + 2;
    return `
      <div class="subgraph-box ${group.collapsed ? 'collapsed' : 'expanded'}" data-id="${group.id}"
           data-left="${left}" data-top="${top}" data-width="${width}" data-height="${height}"
           style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;z-index:${shellZ};">
        ${bundleIn}${bundleOut}
        <div class="sg-head" data-sg-group="${group.id}" data-sg-state="${group.collapsed ? 'collapsed' : 'expanded'}" style="z-index:${headZ};">
          <div class="sg-head-main">
            <svg class="sg-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span class="sg-name" data-sg-name="${group.id}">${esc(group.name || 'New Group')}</span>
          </div>
          <div class="sg-head-trail">
            <span class="sg-head-tags"><span class="sg-pill">${esc(nodeCountLabel)}</span></span>
            ${!group.collapsed ? `<button type="button" class="sg-head-auto-layout" data-sg-head-auto-layout="${esc(group.id)}" title="Auto layout subgraph nodes" aria-label="Auto layout subgraph nodes"${group.nodeIds.length < 2 ? ' disabled' : ''}>
              <svg class="sg-head-auto-layout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="9" rx="1"/>
                <rect x="14" y="3" width="7" height="5" rx="1"/>
                <rect x="14" y="12" width="7" height="9" rx="1"/>
                <rect x="3" y="16" width="7" height="5" rx="1"/>
              </svg>
            </button>` : ''}
            <div class="sg-kebab-wrap">
              <button class="sg-kebab" data-sg-menu-btn="${group.id}" title="Subgraph actions">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
              </button>
              <div class="sg-menu" data-sg-menu="${group.id}">
                <button type="button" class="sg-menu-item" data-sg-toggle-pins="${group.id}"${group.collapsed ? '' : ' disabled title="Collapse this group to change port pins."'}>${esc(pinsMenuLabel)}</button>
                <button type="button" class="sg-menu-item" data-sg-auto-layout="${group.id}" ${group.collapsed || group.nodeIds.length < 2 ? 'disabled' : ''}>Auto layout subgraph nodes</button>
                <button type="button" class="sg-menu-item" data-sg-dissolve="${group.id}">Dissolve subgroup</button>
              </div>
            </div>
            <button class="sg-toggle" data-sg-toggle="${group.id}" title="${group.collapsed ? 'Expand' : 'Collapse'}">
              <img src="icons/${group.collapsed ? 'expand' : 'minimize'}.png" alt="${group.collapsed ? 'Expand' : 'Collapse'}" />
            </button>
          </div>
        </div>
        ${collapsedRows}
      </div>`;
  }).join('');
  layer.innerHTML = html;
  _presetCollapsedSubgraphHeightsFromHead(layer);
  const animateBoxes = !SUBGRAPHS.dragGroup && !SUBGRAPHS.layoutAnimating;
  layer.querySelectorAll('.subgraph-box[data-id]').forEach(el => {
    if (!animateBoxes) return;
    const prev = prevLayoutByGroup.get(el.dataset.id);
    if (!prev) return;
    const target = {
      left: parseFloat(el.dataset.left) || 0,
      top: parseFloat(el.dataset.top) || 0,
      width: parseFloat(el.dataset.width) || 0,
      height: parseFloat(el.dataset.height) || 0,
    };
    const moved = Math.abs(prev.left - target.left) > 0.5
      || Math.abs(prev.top - target.top) > 0.5
      || Math.abs(prev.width - target.width) > 0.5
      || Math.abs(prev.height - target.height) > 0.5;
    if (!moved) return;
    el.classList.add('sg-animating');
    el.style.left = `${prev.left}px`;
    el.style.top = `${prev.top}px`;
    el.style.width = `${prev.width}px`;
    el.style.height = `${prev.height}px`;
    requestAnimationFrame(() => {
      el.style.left = `${target.left}px`;
      el.style.top = `${target.top}px`;
      el.style.width = `${target.width}px`;
      el.style.height = `${target.height}px`;
    });
    el.addEventListener('transitionend', () => {
      el.classList.remove('sg-animating');
      _syncAllLiftedSgHeads();
      Canvas.drawEdges();
    }, { once: true });
  });
  if (_nudgeSubgraphMembersBelowHead(layer) && !SUBGRAPHS._headroomReflow) {
    SUBGRAPHS._headroomReflow = true;
    try {
      _markSubgraphMutation();
      Canvas.drawEdges();
      renderSubgraphs();
      return;
    } finally {
      SUBGRAPHS._headroomReflow = false;
    }
  }
  layer.querySelectorAll('[data-sg-toggle]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const g = _getSubgraphById(btn.dataset.sgToggle);
    if (!g) return;
    g.collapsed = !g.collapsed;
    _markSubgraphMutation();
    renderSubgraphs();
    requestAnimationFrame(() => {
      Canvas.drawEdges();
      requestAnimationFrame(() => Canvas.drawEdges());
    });
    // Tutorial: advance when the user collapses the subgroup they made.
    if (g.collapsed && window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('subgroup-collapsed', { id: g.id });
    }
  }));
  layer.querySelectorAll('[data-sg-menu-btn]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const wrap = btn.closest('.sg-kebab-wrap');
    const menu = wrap?.querySelector('.sg-menu');
    if (!menu) return;
    const wasOpen = menu.classList.contains('open');
    _closeAllSgMenusInLayer(layer);
    const willOpen = !wasOpen;
    if (!willOpen) return;
    const box = btn.closest('.subgraph-box') || _subgraphBoxFromHead(btn.closest('.sg-head'));
    if (box?.classList.contains('expanded')) {
      _attachSgMenuPortal(menu, btn, wrap);
    } else {
      menu.classList.add('open');
    }
  }));
  layer.querySelectorAll('[data-sg-auto-layout], [data-sg-head-auto-layout]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    if (btn.disabled) return;
    const gid = btn.dataset.sgAutoLayout || btn.dataset.sgHeadAutoLayout;
    const g = _getSubgraphById(gid);
    if (!g || g.collapsed || (g.nodeIds || []).length < 2) return;
    _autoArrangeSubgraphNodes(g.nodeIds);
    _closeAllSgMenusInLayer(layer);
  }));
  layer.querySelectorAll('[data-sg-toggle-pins]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    if (btn.disabled) return;
    const gid = btn.dataset.sgTogglePins;
    const g = _getSubgraphById(gid);
    if (!g) return;
    g.showInternalPins = !_sgShowInternalPins(g);
    _closeAllSgMenusInLayer(layer);
    _markSubgraphMutation();
    renderSubgraphs();
  }));
  layer.querySelectorAll('[data-sg-dissolve]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const gid = btn.dataset.sgDissolve;
    const g = _getSubgraphById(gid);
    if (!g) return;
    const label = (g.name || 'New Group').trim() || 'This group';
    _closeAllSgMenusInLayer(layer);
    confirmDialog({
      title: 'Dissolve subgroup?',
      desc: `Nodes stay on the canvas; only the <strong>${esc(label)}</strong> frame is removed.`,
      confirmLabel: 'Dissolve',
    }).then(ok => {
      if (!ok) return;
      const before = SUBGRAPHS.items.length;
      SUBGRAPHS.items = SUBGRAPHS.items.filter(x => x.id !== gid);
      if (SUBGRAPHS.items.length === before) return;
      if (SUBGRAPHS.clusterShellZ) delete SUBGRAPHS.clusterShellZ[gid];
      _setSelectedNodes([]);
      _markSubgraphMutation();
      renderSubgraphs();
    });
  }));
  layer.querySelectorAll('[data-sg-name]').forEach(nameEl => {
    nameEl.addEventListener('click', e => {
      e.stopPropagation();
      const id = nameEl.dataset.sgName;
      if (!_getSubgraphById(id)) return;
      _startSubgraphRename(id);
    });
  });
  _syncSubgraphMemberSurfaceZToShell();
  /* Move heads only after wiring controls (heads start under #subgraphLayer then reparent here). */
  _liftSubgraphHeadsIntoOverlay(layer);
  _maybeRunLiftedHeadSyncLoop();
  Canvas.drawEdges();
  requestAnimationFrame(() => Canvas.drawEdges());
}
function _addNodeToSubgraph(nodeId, groupId) {
  const g = _getSubgraphById(groupId);
  if (!g) return false;
  SUBGRAPHS.items.forEach(x => { x.nodeIds = x.nodeIds.filter(id => id !== nodeId); });
  if (!g.nodeIds.includes(nodeId)) g.nodeIds.push(nodeId);
  g.collapsed = false;
  _normalizeSubgraphs();
  const g2 = _getSubgraphById(groupId);
  if (g2) _nudgeSubgraphMemberClearOverlaps(nodeId, g2);
  return true;
}
function _createSubgraph(nodeIds, focusRename) {
  const ids = [...new Set((nodeIds || []).filter(Boolean))];
  if (ids.length < 1) return null;
  SUBGRAPHS.items.forEach(g => { g.nodeIds = g.nodeIds.filter(id => !ids.includes(id)); });
  const g = { id: 'sg_' + Date.now().toString(36), name: 'New Group', nodeIds: ids, collapsed: false, showInternalPins: true };
  // During the tour the subgroup is pre-named so the user immediately sees a
  // tidy "Data group" without the rename prompt. It stays expanded — a later
  // tour step asks the user to collapse it themselves.
  const tourSubgroup = _tutorialActive();
  if (tourSubgroup) { g.name = 'Data group'; }
  SUBGRAPHS.items.push(g);
  _autoArrangeSubgraphNodes(ids);
  _normalizeSubgraphs();
  renderSubgraphs();
  if (focusRename && !tourSubgroup) setTimeout(() => _startSubgraphRename(g.id), 20);
  // Tutorial Step 18: notify when a subgroup is created.
  if (window.ConnectifyTutorial) {
    window.ConnectifyTutorial.notifyAction('subgraph-created', { id: g.id, count: ids.length });
  }
  return g;
}
function _removeNodeFromSubgraph(nodeId, groupId) {
  const g = _getSubgraphById(groupId);
  if (!g) return false;
  g.nodeIds = g.nodeIds.filter(id => id !== nodeId);
  _normalizeSubgraphs();
  return true;
}
function _clearSubgraphDragUi() {
  document.querySelectorAll('.node.subgraph-merge-target').forEach(el => el.classList.remove('subgraph-merge-target'));
  document.querySelectorAll('.node.sg-drag-over-subgraph').forEach(el => el.classList.remove('sg-drag-over-subgraph'));
  document.querySelectorAll('.subgraph-box.drop-ready, .subgraph-box.detach-ready, .subgraph-box.member-drag-active')
    .forEach(el => el.classList.remove('drop-ready', 'detach-ready', 'member-drag-active'));
  _clearSubgraphPreview();
}
function _bestOverlapNode(draggedNodeId) {
  const sourceEl = _getNodeEl(draggedNodeId);
  if (!sourceEl) return null;
  const sr = sourceEl.getBoundingClientRect();
  let best = null;
  let bestArea = 0;
  document.querySelectorAll('.node').forEach(n => {
    if (n.dataset.nodeId === draggedNodeId) return;
    if (n.classList.contains('sg-hidden')) return;
    const nr = n.getBoundingClientRect();
    const overlapW = Math.max(0, Math.min(sr.right, nr.right) - Math.max(sr.left, nr.left));
    const overlapH = Math.max(0, Math.min(sr.bottom, nr.bottom) - Math.max(sr.top, nr.top));
    const area = overlapW * overlapH;
    if (area <= bestArea) return;
    bestArea = area;
    best = n;
  });
  return bestArea >= 64 ? best : null;
}
function _pointInRect(x, y, r) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
/** Ignore edge hit paths so drops register on the subgraph/card beneath. */
function _clientPickSubgraphBoxIdAt(x, y, dragNodeId) {
  for (const el of document.elementsFromPoint(x, y) || []) {
    if (el.tagName === 'path' && el.closest('svg.edge-overlay-front, svg.edge-overlay-back')) continue;
    const dragged = dragNodeId && _getNodeEl(dragNodeId);
    if (dragged && (el === dragged || dragged.contains(el))) continue;
    const hitNode = el.closest?.('.node');
    if (dragNodeId && hitNode && hitNode.dataset.nodeId !== dragNodeId) continue;
    const head = el.closest?.('.sg-head[data-sg-group]');
    if (head?.dataset?.sgGroup) return head.dataset.sgGroup;
    const box = el.closest?.('.subgraph-box');
    if (box?.dataset?.id && !box.classList.contains('preview')) return box.dataset.id;
  }
  return null;
}
function _clientReleaseOverNodeRect(nodeId, x, y, dragNodeId) {
  if (!nodeId || nodeId === dragNodeId) return false;
  const el = _getNodeEl(nodeId);
  if (!el || el.classList.contains('sg-hidden')) return false;
  return _pointInRect(x, y, el.getBoundingClientRect());
}
function _onSubgraphDragMove(e) {
  const d = SUBGRAPHS.drag;
  if (!d) return;
  const nodeEl = _getNodeEl(d.nodeId);
  if (!nodeEl) return;
  d.moved = true;
  _clearSubgraphDragUi();
  const targetNode = _bestOverlapNode(d.nodeId);
  d.hoverNodeId = null;
  d.hoverGroupId = null;
  if (targetNode && targetNode.dataset.nodeId !== d.nodeId) {
    const tId = targetNode.dataset.nodeId;
    const sgA = _getSubgraphByNode(d.nodeId);
    const sgB = _getSubgraphByNode(tId);
    if (!sgA || !sgB || sgA.id !== sgB.id) {
      d.hoverNodeId = tId;
      targetNode.classList.add('subgraph-merge-target');
      if (!sgA && !sgB) _showSubgraphPreview([d.nodeId, tId]);
    }
  }
  /* Use stack picking so the dragged node can sit above the subgraph (see `.sg-drag-over-subgraph`) without blocking the target. */
  const gidPick = _clientPickSubgraphBoxIdAt(e.clientX, e.clientY, d.nodeId);
  const box = gidPick ? document.querySelector(`.subgraph-box[data-id="${CSS.escape(gidPick)}"]`) : null;
  if (box) {
    const gid = box.dataset.id;
    const sg = _getSubgraphById(gid);
    const src = _getSubgraphByNode(d.nodeId);
    if (sg && (!src || src.id !== sg.id)) {
      d.hoverGroupId = gid;
      box.classList.add('drop-ready');
      if (d.lastHoverGroupId !== gid) _flashSubgraphDance(gid);
      d.lastHoverGroupId = gid;
    }
  }
  if (!d.hoverGroupId) d.lastHoverGroupId = null;
  if (d.hoverGroupId) nodeEl.classList.add('sg-drag-over-subgraph');
  const srcGroup = _getSubgraphByNode(d.nodeId);
  if (srcGroup && !srcGroup.collapsed) {
    const srcEl = document.querySelector(`.subgraph-box[data-id="${CSS.escape(srcGroup.id)}"]`);
    /* Always measure the live box — a frozen rect from mousedown goes stale as the
       member moves and the shell reflows, which falsely flagged in-group drops as “outside”. */
    const rect = srcEl?.getBoundingClientRect();
    if (rect && _pointInRect(e.clientX, e.clientY, rect)) srcEl?.classList.add('member-drag-active');
    if (rect && !_pointInRect(e.clientX, e.clientY, rect)) srcEl?.classList.remove('member-drag-active');
  }
}
function _onSubgraphDragUp(e) {
  document.removeEventListener('mousemove', _onSubgraphDragMove, true);
  document.removeEventListener('mouseup', _onSubgraphDragUp, true);
  const d = SUBGRAPHS.drag;
  SUBGRAPHS.drag = null;
  if (!d) return;
  _clearSubgraphDragUi();
  if (!d.moved) return;
  const x = e.clientX;
  const y = e.clientY;
  let mutated = false;
  const srcGroup = _getSubgraphByNode(d.nodeId);
  if (d.hoverNodeId) {
    const targetGroup = _getSubgraphByNode(d.hoverNodeId);
    if (!srcGroup && !targetGroup) {
      // hoverNodeId was set by mousemove (overlap >= 64 sq px) and triggered the
      // boundary preview — accept the drop without requiring an exact point-in-rect.
      mutated = !!_createSubgraph([d.nodeId, d.hoverNodeId], true);
    } else if (srcGroup && !targetGroup) {
      if (_clientReleaseOverNodeRect(d.hoverNodeId, x, y, d.nodeId)) {
        mutated = _addNodeToSubgraph(d.hoverNodeId, srcGroup.id);
      }
    } else if (!srcGroup && targetGroup) {
      const overTargetBox = _clientPickSubgraphBoxIdAt(x, y, d.nodeId) === targetGroup.id;
      const overHoverMember = _clientReleaseOverNodeRect(d.hoverNodeId, x, y, d.nodeId);
      if (overTargetBox || overHoverMember) {
        mutated = _addNodeToSubgraph(d.nodeId, targetGroup.id);
      }
    } else if (srcGroup && targetGroup && srcGroup.id !== targetGroup.id) {
      if (_clientPickSubgraphBoxIdAt(x, y, d.nodeId) === targetGroup.id) {
        srcGroup.nodeIds.forEach(id => _addNodeToSubgraph(id, targetGroup.id));
        srcGroup.nodeIds = [];
        mutated = true;
      }
    }
  } else if (d.hoverGroupId) {
    if (_clientPickSubgraphBoxIdAt(x, y, d.nodeId) === d.hoverGroupId) {
      mutated = _addNodeToSubgraph(d.nodeId, d.hoverGroupId);
    }
  } else if (srcGroup && !srcGroup.collapsed) {
    const srcEl = document.querySelector(`.subgraph-box[data-id="${CSS.escape(srcGroup.id)}"]`);
    const rect = srcEl?.getBoundingClientRect();
    /* Detach only if the release point is outside the *current* shell — not the last
       mousemove flag, so a quick return “into” the box still keeps membership. */
    if (rect && !_pointInRect(e.clientX, e.clientY, rect)) {
      mutated = _removeNodeFromSubgraph(d.nodeId, srcGroup.id);
    }
  }
  _normalizeSubgraphs();
  renderSubgraphs();
  if (mutated) _markSubgraphMutation();
}
function _collectMarqueeNodes(rect) {
  const picked = [];
  document.querySelectorAll('.node').forEach(n => {
    if (n.classList.contains('sg-hidden')) return;
    const nr = n.getBoundingClientRect();
    if (!(nr.right < rect.left || nr.left > rect.right || nr.bottom < rect.top || nr.top > rect.bottom)) {
      picked.push(n.dataset.nodeId);
    }
  });
  return picked;
}
function _previewMarqueeNodes(ids) {
  const set = new Set(ids || []);
  document.querySelectorAll('.node').forEach(n => {
    n.classList.toggle('sg-marquee-hit', set.has(n.dataset.nodeId));
  });
}
function _clearMarqueePreview() {
  document.querySelectorAll('.node.sg-marquee-hit').forEach(n => n.classList.remove('sg-marquee-hit'));
}
function _onSubgraphGroupDragMove(e) {
  const s = SUBGRAPHS.dragGroup;
  if (!s) return;
  const { zoom } = Canvas.getTransform();
  const dx = (e.clientX - s.startX) / zoom;
  const dy = (e.clientY - s.startY) / zoom;
  if (!s.moved && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) s.moved = true;
  s.nodeStart.forEach((pt, nodeId) => {
    const el = _getNodeEl(nodeId);
    if (!el) return;
    el.style.left = `${pt.x + dx}px`;
    el.style.top = `${pt.y + dy}px`;
  });
  // Fast path: only update the dragged group's box bounds; skip full renderSubgraphs rewrite.
  const group = _getSubgraphById(s.groupId);
  const box = document.querySelector(`.subgraph-box[data-id="${CSS.escape(s.groupId)}"]`);
  if (group && box) {
    const b = _subgraphBounds(group);
    if (b) {
      let left = b.left, top = b.top, width = b.width, height = b.height;
      if (group.collapsed) {
        const rowCount = (group.nodeIds || []).length;
        width = 290;
        height = Math.max(96, 40 + rowCount * 32 + 10);
        left = Math.round(b.left + Math.max(0, (b.width - width) / 2));
        top = Math.round(b.top + 10);
      } else {
        width = Math.max(350, width);
      }
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      _positionLiftedSgHead(
        document.querySelector(`#subgraphHeadLayer .sg-head[data-sg-group="${CSS.escape(group.id)}"]`),
        box
      );
    }
    box.classList.add('group-dragging');
  }
  Canvas.drawEdges();
}
function _onSubgraphGroupDragUp() {
  document.removeEventListener('mousemove', _onSubgraphGroupDragMove, true);
  document.removeEventListener('mouseup', _onSubgraphGroupDragUp, true);
  const s = SUBGRAPHS.dragGroup;
  SUBGRAPHS.dragGroup = null;
  if (!s) return;
  if (!s.moved) return;
  s.nodeStart.forEach((_, nodeId) => {
    const el = _getNodeEl(nodeId);
    const n = Canvas.getNode(nodeId);
    if (!el || !n) return;
    n.x = parseFloat(el.style.left) || 0;
    n.y = parseFloat(el.style.top) || 0;
  });
  _markSubgraphMutation();
  SUBGRAPHS._suppressHeadroom = true;
  try {
    renderSubgraphs();
  } finally {
    SUBGRAPHS._suppressHeadroom = false;
  }
}
function _onDocumentPointerDownCloseSgMenus(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest?.('.sg-kebab-wrap') || e.target.closest?.('.sg-menu')) return;
  const anyOpen = document.querySelector('.sg-menu.open');
  if (!anyOpen) return;
  _closeAllSgMenusInLayer(SUBGRAPHS.layerEl);
}
function _bindSubgraphFeatureListeners() {
  if (_subgraphListenersBound) return;
  _subgraphListenersBound = true;
  document.addEventListener('pointerdown', _onDocumentPointerDownCloseSgMenus, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.querySelector('.sg-menu.open')) return;
    _closeAllSgMenusInLayer(SUBGRAPHS.layerEl);
  }, true);
  const inner = Canvas.getCanvasInner();
  const canvas = Canvas.getCanvasEl();
  if (!inner || !canvas) return;
  inner.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.node-head')) return;
    const nodeEl = e.target.closest('.node');
    if (nodeEl && !nodeEl.classList.contains('sg-hidden') && !e.target.closest('.edge-hit')) {
      const nid = nodeEl.dataset.nodeId;
      if (nid) {
        const g = _getSubgraphByNode(nid);
        if (g) bumpSubgraphClusterSurface(g.id);
        else if (typeof Canvas.bumpNodeSurfaceFront === 'function') Canvas.bumpNodeSurfaceFront(nid);
      }
    }
  }, true);
  inner.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.sg-toggle, .sg-kebab, .sg-menu, [data-sg-head-auto-layout], .sg-head-auto-layout')) return;
    if (e.target.closest('[data-sg-name]')) return;
    if (e.target.closest('[data-sg-name][contenteditable="true"]')) return;
    let gid = e.target.closest('.subgraph-box')?.dataset?.id || '';
    if (!gid) {
      const h = e.target.closest('.sg-head[data-sg-group]');
      gid = h?.dataset?.sgGroup || '';
    }
    if (!gid) return;
    _bringSubgraphToFront(gid);
  }, true);
  inner.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const head = e.target.closest('.node-head');
    if (!head || e.target.closest('.menu-dots')) return;
    const node = head.closest('.node');
    if (!node) return;
    const sg = _getSubgraphByNode(node.dataset.nodeId);
    SUBGRAPHS.drag = {
      nodeId: node.dataset.nodeId,
      moved: false,
      hoverNodeId: null,
      hoverGroupId: null,
      lastHoverGroupId: null,
    };
    document.addEventListener('mousemove', _onSubgraphDragMove, true);
    document.addEventListener('mouseup', _onSubgraphDragUp, true);
  }, true);
  inner.addEventListener('click', e => {
    const head = e.target.closest('.node-head');
    if (!head) return;
    const node = head.closest('.node');
    if (!node) return;
    const id = node.dataset.nodeId;
    if (typeof Canvas.shouldSuppressPostDragActivation === 'function' && Canvas.shouldSuppressPostDragActivation(id)) {
      return;
    }
    if (!(typeof PATH_DRAW !== 'undefined' && PATH_DRAW.active)
      && _isInspectorDrawerActive()
      && !SUBGRAPHS.marqueeTool
      && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const nd = typeof Canvas !== 'undefined' && Canvas.getNode ? Canvas.getNode(id) : null;
      if (nd) {
        openInspector(nd);
        _setSelectedNodes([id]);
        e.stopPropagation();
        return;
      }
    }
    if (SUBGRAPHS.marqueeTool) {
      const next = new Set(SUBGRAPHS.selectedNodeIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      _setSelectedNodes([...next]);
      return;
    }
    if (e.shiftKey) {
      const next = new Set(SUBGRAPHS.selectedNodeIds);
      next.add(id);
      _setSelectedNodes([...next]);
      if (next.size >= 2) setPaletteTool('subgraph-marquee');
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(SUBGRAPHS.selectedNodeIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      _setSelectedNodes([...next]);
    } else {
      _setSelectedNodes([id]);
    }
  }, true);
  inner.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    // Let edge interactions inside expanded subgroups pass through to
    // canvas edge handlers (selection + delete bubble), not group drag.
    if (e.target.closest('.sg-internal-edges, .edge-hit, .adaptor-chip')) return;
    let box = e.target.closest('.subgraph-box');
    if (!box) {
      const h = e.target.closest('.sg-head[data-sg-group]');
      if (h?.dataset?.sgGroup) {
        box = document.querySelector(`.subgraph-box[data-id="${CSS.escape(h.dataset.sgGroup)}"]`);
      }
    }
    if (!box) return;
    if (e.target.closest('.sg-toggle, .sg-kebab, .sg-menu, [data-sg-head-auto-layout], .sg-head-auto-layout')) return;
    if (e.target.closest('[data-sg-name]')) return;
    if (e.target.closest('[data-sg-name][contenteditable="true"]')) return;
    const gid = box.dataset.id;
    const g = _getSubgraphById(gid);
    if (!g) return;
    _bringSubgraphToFront(gid, false);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const nodeStart = new Map();
    (g.nodeIds || []).forEach(id => {
      const el = _getNodeEl(id);
      if (!el) return;
      nodeStart.set(id, {
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
      });
    });
    if (!nodeStart.size) return;
    SUBGRAPHS.dragGroup = { groupId: gid, startX: e.clientX, startY: e.clientY, nodeStart, moved: false };
    document.addEventListener('mousemove', _onSubgraphGroupDragMove, true);
    document.addEventListener('mouseup', _onSubgraphGroupDragUp, true);
  }, true);
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const useMarquee = e.shiftKey || SUBGRAPHS.marqueeTool;
    if (!useMarquee) return;
    if (e.target.closest('.node, .subgraph-box, .sg-head[data-sg-group]')) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const rect = canvas.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'subgraph-marquee';
    canvas.parentElement?.appendChild(box);
    SUBGRAPHS.marquee = { box, sx: e.clientX - rect.left, sy: e.clientY - rect.top, rect };
    const onMove = (ev) => {
      if (!SUBGRAPHS.marquee) return;
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      const x = Math.min(SUBGRAPHS.marquee.sx, mx);
      const y = Math.min(SUBGRAPHS.marquee.sy, my);
      const w = Math.abs(mx - SUBGRAPHS.marquee.sx);
      const h = Math.abs(my - SUBGRAPHS.marquee.sy);
      Object.assign(box.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
      const picked = _collectMarqueeNodes(box.getBoundingClientRect());
      _setSelectedNodes(picked);
      _previewMarqueeNodes(picked);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      const r = box.getBoundingClientRect();
      box.remove();
      SUBGRAPHS.marquee = null;
      const picked = _collectMarqueeNodes(r);
      _clearMarqueePreview();
      _setSelectedNodes(picked);
      const g = picked.length >= 1 ? _createSubgraph(picked, true) : null;
      if (g) {
        _setSelectedNodes([]);
        _markSubgraphMutation();
      }
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  }, true);
  const canvasArea = document.getElementById('canvasArea');
  if (canvasArea && !SUBGRAPHS._manualDraftBound) {
    SUBGRAPHS._manualDraftBound = true;
    canvasArea.addEventListener('click', (e) => {
      if (!e.target.closest('#sgBuilderFloat')) return;
      const rmBtn = e.target.closest('[data-new-sg-remove]');
      if (rmBtn) {
        const id = rmBtn.dataset.newSgRemove;
        const next = new Set(SUBGRAPHS.selectedNodeIds);
        next.delete(id);
        _setSelectedNodes([...next]);
        return;
      }
      if (e.target.closest('[data-new-sg-cancel]')) {
        _setSelectedNodes([]);
        _clearManualSubgraphDraft();
        return;
      }
      if (e.target.closest('[data-new-sg-create]')) {
        _createSubgraphFromManualDraft();
        return;
      }
      if (e.target.closest('[data-new-sg-name]')) {
        _startManualDraftRename();
      }
    }, true);
  }
    document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (e.key.toLowerCase() !== 'g') return;
    if (SUBGRAPHS.selectedNodeIds.size < 1) return;
    e.preventDefault();
    const g = _createSubgraph([...SUBGRAPHS.selectedNodeIds], true);
    if (!g) return;
    _setSelectedNodes([]);
    _markSubgraphMutation();
  });
  if (inner && !SUBGRAPHS._sgDblclickInner) {
    SUBGRAPHS._sgDblclickInner = true;
    inner.addEventListener('dblclick', (e) => {
      const box = e.target.closest('.subgraph-box');
      const head = e.target.closest('.sg-head[data-sg-group]');
      const gid = box?.dataset?.id || head?.dataset?.sgGroup;
      if (!gid) return;
      const targetBox = box || document.querySelector(`.subgraph-box[data-id="${CSS.escape(gid)}"]`);
      if (!targetBox || targetBox.classList.contains('preview')) return;
      if (e.target.closest('.sg-kebab, .sg-menu, .sg-toggle, [data-sg-head-auto-layout], .sg-head-auto-layout')) return;
      if (e.target.closest('.sg-name')) return;
      const g = _getSubgraphById(gid);
      if (!g) return;
      e.preventDefault();
      e.stopPropagation();
      g.collapsed = !g.collapsed;
      _markSubgraphMutation();
      renderSubgraphs();
    }, true);
  }
}
function initSubgraphFeature(initialSubgraphs) {
  _installSubgraphCollapsedPortHooks();
  SUBGRAPHS.items = _cloneSubgraphs(initialSubgraphs);
  SUBGRAPHS.clusterShellZ = {};
  window.__connectifySurfaceBumpNode = (nodeId, _nodeEl) => {
    const g = _getSubgraphByNode(nodeId);
    if (!g) return false;
    bumpSubgraphClusterSurface(g.id);
    return true;
  };
  window.__connectifyAfterSurfaceRenorm = () => {
    SUBGRAPHS.clusterShellZ = {};
    _ensureSubgraphStack();
    SUBGRAPHS.stack.forEach((gid) => {
      if (_getSubgraphById(gid)) reserveSubgraphShellZ(gid);
    });
    renderSubgraphs();
  };
  _bindSubgraphFeatureListeners();
  renderSubgraphs();
}

function initApp() {
  const P = window.PROJECT;
  P.title = _resolveProjectDisplayTitle(P) || P.title || 'Untitled project';
  _setProjectTitleUi(P.title);
  document.getElementById('bcOrg').textContent = P.org;
  initProjectTitleRename();

  // ── Seed variants on first visit ──────────────────────
  let variants = readJSON(KEY.variants);
  if (!variants || !variants.length) {
    const base = cloneGraph({
      nodes: P.nodes, connections: P.connections,
      canvasWidth: P.canvasWidth, canvasHeight: P.canvasHeight,
      subgraphs: P.subgraphs,
    });
    variants = IS_CUSTOM_PROJECT
      ? [{ id: 'v1', name: 'Master', createdAt: Date.now(), ...base }]
      : Array.isArray(P.initialVariants) && P.initialVariants.length
        ? P.initialVariants.map((spec, i) => ({
            id: spec.id || ('v' + (i + 1)),
            name: spec.name || ('Variant ' + (i + 1)),
            createdAt: Date.now(),
            ...(i === 0 ? base : cloneGraph(base)),
          }))
        : [
            { id: 'v1', name: 'Master',        createdAt: Date.now(), ...base             },
            { id: 'v2', name: 'ResNet swap',   createdAt: Date.now(), ...cloneGraph(base) },
            { id: 'v3', name: 'Smaller LIDAR', createdAt: Date.now(), ...cloneGraph(base) },
          ];
    writeJSON(KEY.variants, variants);
  }
  ACTIVE_VID = localStorage.getItem(KEY.active) || variants[0].id;
  const activeVariant = variants.find(v => v.id === ACTIVE_VID) || variants[0];
  ACTIVE_VID = activeVariant.id;
  localStorage.setItem(KEY.active, ACTIVE_VID);

  // ── Canvas init with the active variant's graph ──────
  // offset=0 keeps saved positions 1:1 with what's rendered, so snapshot/
  // reload round-trips cleanly when switching variants.
  Canvas.init({ offset: 0, editable: true, initialZoom: 1.0 });
  Canvas.build({
    nodes: activeVariant.nodes,
    connections: activeVariant.connections,
    canvasWidth: activeVariant.canvasWidth || P.canvasWidth,
    canvasHeight: activeVariant.canvasHeight || P.canvasHeight,
  });
  recomputeAutoRoles();
  initSubgraphFeature(activeVariant.subgraphs || []);
  (function seedBundledDemoPaths() {
    if (IS_CUSTOM_PROJECT) return;
    const P = window.PROJECT;
    const demo = P && P.demoPaths;
    if (!demo || typeof demo !== 'object') return;
    const variantsList = readJSON(KEY.variants) || [];
    variantsList.forEach((v) => {
      const specs = demo[v.id];
      if (!specs || !specs.length) return;
      if ((readJSON(KEY.paths(v.id)) || []).length) return;
      const t = Date.now();
      const out = specs.map((p, i) => ({
        id: p.id || ('p_seed_' + v.id + '_' + i),
        name: p.name || ('Path ' + (i + 1)),
        nodeIds: [...(p.nodeIds || [])],
        nodes: [...(p.nodeIds || [])],
        author: p.author || 'Demo',
        createdAt: p.createdAt != null ? p.createdAt : (t - i * 1000),
      }));
      writeJSON(KEY.paths(v.id), out);
    });
  })();
  // Clicking a node either toggles it in the current path draft (if we're
  // in draw mode) or opens the Inspector — never both.
  Canvas.onNodeClick(nodeData => {
    // Path-draw mode intercepts card-body picks in capture phase. Any clicks
    // that reach this listener should keep the node item's normal behavior.
    openInspector(nodeData);
  });
  // When the user drops a rope on a port whose type differs from the source
  // but has a known bridge, surface the "insert adaptor?" dialog. A single
  // modal covers both "pure adaptor" and "adaptor + replace existing" because
  // chaining two sequential dialogs feels punishing for a single gesture.
  Canvas.onAdaptorRequired(async ({ pending, adaptor, existing }, resolve) => {
    let existingSummary = '';
    if (existing) {
      const fromNode = Canvas.getNode(existing.from[0]);
      const fromLabel = esc(fromNode ? fromNode.label : existing.from[0]);
      existingSummary =
        `This input is already wired from <strong>${fromLabel}</strong> · ${esc(existing.from[2])}. ` +
        `Accepting will replace that source with the new connection.`;
    }
    const result = await adaptorDialog({ adaptor, existingSummary });
    if (result === 'accept') {
      resolve();
      return;
    }
    if (result === 'configure') {
      const pseudoConn = {
        adaptor: {
          id: adaptor.id,
          fromType: adaptor.fromType,
          toType: adaptor.toType,
          label: adaptor.label,
          desc: adaptor.desc,
        },
        adaptorSettings: {},
      };
      const ui = Canvas.getAdaptorUiModel(pseudoConn);
      const out = await openAdaptorDetailsPopover({
        mode: 'offer',
        uiModel: ui,
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 3,
      });
      if (out && out.adaptorSettings) {
        resolve({ adaptorSettings: out.adaptorSettings });
      }
      return;
    }
  });
  Canvas.onAdaptorChipClick(({ connIndex, clientX, clientY }) => {
    const list = Canvas.getConnections();
    const conn = list[connIndex];
    if (!conn || !conn.adaptor) return;
    const ui = Canvas.getAdaptorUiModel(conn);
    openAdaptorDetailsPopover({
      mode: 'edge',
      connIndex,
      uiModel: ui,
      clientX,
      clientY,
    });
  });
  // Replace-existing confirm (falls through here only for same-type drops onto
  // an already-wired input; adaptor+existing cases are handled above).
  Canvas.onConnectionConflict((existing, pending, resolve) => {
    const toNode = Canvas.getNode(existing.to[0]);
    const toLabel = esc(toNode ? toNode.label : existing.to[0]);
    const fromNode = Canvas.getNode(existing.from[0]);
    const fromLabel = esc(fromNode ? fromNode.label : existing.from[0]);
    confirmDialog({
      title: 'Replace existing connection?',
      desc: `"${toLabel} · ${esc(existing.to[2])}" is already wired from <strong>${fromLabel}</strong> · ${esc(existing.from[2])}. Confirm to swap its input source.`,
      confirmLabel: 'Replace',
      tone: 'primary',
    }).then(ok => { if (ok) resolve(); });
  });

  initVariants(P);
  initPresence(P);
  initShareGraph(P);
  initLeftNav(P);
  initContribStatus(P);
  initDrawerToggles();
  initAddCustomModal();
  initDiscover();
  initHistory();
  initVersionKeyNav();
  initPaths();
  initToolPalette();
  initComments();
  initBottomPanel();
  initRunButton();
  initZoomControls();
  initHistoryStack();
  initFindBar();
  initMinimap();
  initKebab();
  initRoleBadgeDragTransfer();
  initCanvasContextMenu();
  initActiveEdgeDeleteKey();

  // V2 layout wiring — centered toolbar, rightnav strip, bottom strip,
  // variants show/hide, project title, leftnav credits, new inspector.
  initV2Layout(P);
  // On entry from view mode, start with a full-graph framing so users see
  // the entire workflow immediately. Empty graphs (e.g. new project) still
  // need a sensible viewport — fitAllNodesInView is a no-op with zero nodes.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!Canvas.getAllNodes().length) {
      const inner = Canvas.getCanvasInner();
      const cw = parseFloat(inner?.style.width) || P.canvasWidth || 2200;
      const ch = parseFloat(inner?.style.height) || P.canvasHeight || 1400;
      const leftEl = document.getElementById('drawerLeft');
      const rightEl = document.getElementById('drawerRight');
      Canvas.focusWorld(cw / 2, ch / 2, {
        zoom: (P.viewZoom != null && P.viewZoom > 0) ? P.viewZoom : 0.5,
        reserve: {
          top: 10,
          bottom: 10,
          left: leftEl?.classList.contains('open') ? 0 : 60,
          right: rightEl?.classList.contains('open') ? 0 : 20,
        },
      });
    } else {
      fitAllNodesInView();
    }
    stabilizeEdgeLayout();
  }));

  // Persist on unload so pending edits survive the tab closing.
  window.addEventListener('beforeunload', snapshotActiveVariant);

}

/* ── Tutorial wiring (resumes Steps 4-14 in edit mode) ──
   Runs independently of initApp() so it survives unrelated init
   errors elsewhere in the host app. The tooltip only needs DOM
   elements (canvasArea, leftnav, palette, toolbar) — not the
   project data — so we can wire it as soon as the document is
   parsed. We defer slightly to let the canvas paint first so
   getBoundingClientRect returns real numbers. */
function _initTutorialForEditing() {
  if (!window.ConnectifyTutorial || !window.ConnectifyTutorialSteps) return;
  try { window.ConnectifyTutorial.init({
    page: 'edit',
    steps: window.ConnectifyTutorialSteps.forPage('edit'),
  }); } catch (_) { return; }
  // If a fresh fork just landed and the tutorial state is on a view-phase
  // step (e.g. user landed here without going through normal fork flow),
  // bump them forward to the canvas tour.
  setTimeout(() => {
    const s = window.ConnectifyTutorial.getState();
    // Bump to the first edit-phase step (Welcome) if the user landed on the
    // canvas while the tour is still on a hub/view step.
    if (s.started && !s.skipped && !s.completed && s.currentStep < 3) {
      window.ConnectifyTutorial.advanceTo(3);
    }
  }, 300);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initTutorialForEditing);
} else {
  // Defer one tick so editing-mode.js finishes wiring up its own listeners first.
  setTimeout(_initTutorialForEditing, 0);
}

// Copy the live canvas state into the active variant slot. Called
// before variant switches and on page unload.
function snapshotActiveVariant() {
  const variants = readJSON(KEY.variants) || [];
  const idx = variants.findIndex(v => v.id === ACTIVE_VID);
  if (idx < 0) return;
  variants[idx].nodes = Canvas.getAllNodes().map(n => ({
    id: n.id, type: n.type, label: n.label || n.name, color: n.color, icon: n.icon,
    user: n.user, x: n.x, y: n.y,
    inputs:  (n.inputs  || []).map(p => ({ ...p })),
    outputs: (n.outputs || []).map(p => ({ ...p })),
    description: n.description, fn: n.fn, fw: n.fw, by: n.by,
    views: n.views, downloads: n.downloads,
    tags: Array.isArray(n.tags) ? [...n.tags] : [],
    custom: n.custom ? { ...n.custom } : undefined,
  }));
  variants[idx].connections = Canvas.getConnections().map(c => Canvas.snapshotConnection(c));
  variants[idx].subgraphs = getSubgraphSnapshot();
  writeJSON(KEY.variants, variants);
}

// Switch variant: snapshot the current graph, then reload the canvas
// from the target variant's saved state and refresh variant-scoped panels.
function switchVariant(vid) {
  if (vid === ACTIVE_VID) return;
  snapshotActiveVariant();
  const variants = readJSON(KEY.variants) || [];
  const target = variants.find(v => v.id === vid);
  if (!target) return;
  ACTIVE_VID = vid;
  localStorage.setItem(KEY.active, vid);
  if (PATH_DRAW.active) pathDrawCancel();
  // Suppress onChange-driven undo snapshots while we rebuild the canvas
  // for the new variant; we'll reset stacks after the switch completes.
  HISTORY_APPLYING = true;
  try {
    Canvas.clear();
    const P = window.PROJECT;
    const inner = Canvas.getCanvasInner();
    inner.style.width  = (target.canvasWidth  || P.canvasWidth)  + 'px';
    inner.style.height = (target.canvasHeight || P.canvasHeight) + 'px';
    (target.nodes || []).forEach(n => Canvas.addNode({ ...n }));
    (target.connections || []).forEach(c => Canvas.addConnection(c.from, c.to));
    Canvas.drawEdges();
    initSubgraphFeature(target.subgraphs || []);
  } finally {
    HISTORY_APPLYING = false;
  }
  if (typeof resetUndoRedo === 'function') resetUndoRedo();
  renderPaths();
  renderHistory();
  renderRuns();
  updateVariantStrip();
  document.getElementById('bcVariant').textContent = target.name;
}

let variantStripScrollAbort = null;

/** Press-and-drag on a tab (pointer) to reorder variants. */
let variantPointerSession = null;
let suppressVariantTabClick = false;
let suppressVariantNameRenameClick = false;
let pendingVariantSwitchAfterRename = null;
const VARIANT_DRAG_THRESHOLD_PX = 6;

function variantTabPointerDown(e) {
  if (e.button !== 0) return;
  const tab = e.currentTarget;
  if (tab.classList.contains('confirming')) return;
  if (e.target.closest('.tab-x')) return;
  if (tab.querySelector('.tab-name')?.isContentEditable) return;
  if (variantPointerSession) return;

  const strip = document.getElementById('variantStrip');
  variantPointerSession = {
    vid: tab.dataset.vid,
    tabEl: tab,
    startX: e.clientX,
    startY: e.clientY,
    onName: !!e.target.closest('.tab-name'),
    moved: false,
    dropTarget: null,
    strip,
  };

  const onMove = (ev) => {
    const s = variantPointerSession;
    if (!s) return;
    const dx = ev.clientX - s.startX;
    const dy = ev.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) >= VARIANT_DRAG_THRESHOLD_PX) {
      s.moved = true;
      s.tabEl.classList.add('dragging');
      document.body.style.userSelect = 'none';
      if (s.onName) ev.preventDefault();
    }
    if (!s.moved) return;
    clearVariantDragMarkers();
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const targetTab = el && el.closest && el.closest('.variant-tab');
    if (targetTab && targetTab.dataset.vid !== s.vid && s.strip.contains(targetTab)) {
      const rect = targetTab.getBoundingClientRect();
      const tabs = Array.from(s.strip.querySelectorAll('.variant-tab'));
      const draggedIdx = tabs.findIndex(t => t.dataset.vid === s.vid);
      const targetIdx = tabs.findIndex(t => t.dataset.vid === targetTab.dataset.vid);
      const isMovingRight = draggedIdx >= 0 && targetIdx > draggedIdx;
      // Swap threshold: 25% into the adjacent tab (instead of midpoint).
      // Rightward drag crosses at 25% from target's left edge; leftward drag
      // crosses at 25% from target's right edge (75% from left).
      const edgeRatio = isMovingRight ? 0.25 : 0.75;
      const before = ev.clientX < rect.left + rect.width * edgeRatio;
      s.dropTarget = { vid: targetTab.dataset.vid, before };
      targetTab.classList.add(before ? 'drag-insert-before' : 'drag-insert-after');
      const changed = reorderVariants(s.vid, s.dropTarget.vid, s.dropTarget.before);
      if (changed) {
        const liveTab = s.strip.querySelector(`.variant-tab[data-vid="${s.vid}"]`);
        if (liveTab) {
          liveTab.classList.add('dragging');
          s.tabEl = liveTab;
        }
      }
    } else {
      s.dropTarget = null;
    }
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    const s = variantPointerSession;
    variantPointerSession = null;
    if (!s) return;
    s.tabEl.classList.remove('dragging');
    document.body.style.userSelect = '';
    clearVariantDragMarkers();
    if (s.moved) {
      suppressVariantTabClick = true;
      if (s.onName) suppressVariantNameRenameClick = true;
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

function syncVariantScrollFades() {
  const el = document.getElementById('variantScroll');
  if (!el) return;
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  el.classList.toggle('can-scroll-left', el.scrollLeft > 2);
  el.classList.toggle('can-scroll-right', max > 2 && el.scrollLeft < max - 2);
}

function bindVariantScrollFade() {
  const el = document.getElementById('variantScroll');
  if (!el) return;
  if (variantStripScrollAbort) variantStripScrollAbort.abort();
  variantStripScrollAbort = new AbortController();
  const { signal } = variantStripScrollAbort;
  el.addEventListener('scroll', syncVariantScrollFades, { passive: true, signal });
  window.addEventListener('resize', syncVariantScrollFades, { signal });
  requestAnimationFrame(syncVariantScrollFades);
}

function clearVariantDragMarkers() {
  document.querySelectorAll('.variant-tab.drag-insert-before, .variant-tab.drag-insert-after').forEach(el => {
    el.classList.remove('drag-insert-before', 'drag-insert-after');
  });
}

function reorderVariants(fromVid, toVid, insertBefore) {
  const variants = readJSON(KEY.variants) || [];
  const prevOrder = variants.map(v => v.id).join('|');
  const fromI = variants.findIndex(v => v.id === fromVid);
  let toI = variants.findIndex(v => v.id === toVid);
  if (fromI < 0 || toI < 0 || fromVid === toVid) return false;
  const [moved] = variants.splice(fromI, 1);
  toI = variants.findIndex(v => v.id === toVid);
  if (toI < 0) {
    variants.splice(fromI, 0, moved);
    return false;
  }
  const insertAt = insertBefore ? toI : toI + 1;
  variants.splice(insertAt, 0, moved);
  const nextOrder = variants.map(v => v.id).join('|');
  if (nextOrder === prevOrder) return false;
  writeJSON(KEY.variants, variants);
  const sc = document.getElementById('variantScroll');
  const prevScroll = sc ? sc.scrollLeft : 0;
  updateVariantStrip();
  requestAnimationFrame(() => {
    const el = document.getElementById('variantScroll');
    if (el) el.scrollLeft = prevScroll;
    syncVariantScrollFades();
  });
  return true;
}

// Render the variant strip and bind tab clicks. Extracted so other
// code (switch, add, rename) can trigger a redraw without duplication.
function updateVariantStrip() {
  const strip = document.getElementById('variantStrip');
  const variants = readJSON(KEY.variants) || [];
  const parts = variants.map((v, i) => `
    <div class="variant-tab ${v.id === ACTIVE_VID ? 'active' : ''}" data-vid="${v.id}" role="button" tabindex="0">
      <span class="tab-dot"></span>
      <span class="tab-name" data-vid="${v.id}" title="Click to rename. Hold and drag the tab to reorder.">${esc(v.name)}</span>
      <button type="button" class="tab-chev" data-act="chev" data-vid="${v.id}" aria-label="Show details for variant ${esc(v.name)}" title="Show variant details">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 8l5 5 5-5"/></svg>
      </button>
    </div>
  `).join('');
  strip.innerHTML = `
    <div class="variant-scroll" id="variantScroll">
      <div class="variant-tabs-track" id="variantTabsTrack">
        ${parts}
        <button class="variant-add" id="variantAdd" type="button">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>
          New variant
        </button>
      </div>
    </div>
    <div class="variant-detail-panel" id="variantDetailPanel" aria-hidden="true"></div>`;

  strip.querySelectorAll('.variant-tab').forEach(t => {
    t.addEventListener('pointerdown', variantTabPointerDown);
    t.addEventListener('click', e => {
      if (suppressVariantTabClick) { suppressVariantTabClick = false; return; }
      if (e.target.closest('.tab-chev')) return;
      if (e.target.closest('.tab-name')) return;
      if (t.classList.contains('confirming')) return;
      switchVariant(t.dataset.vid);
    });
  });

  strip.querySelectorAll('.tab-name').forEach(n => {
    n.addEventListener('click', e => {
      if (suppressVariantNameRenameClick) {
        suppressVariantNameRenameClick = false;
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      if (n.isContentEditable) return;
      const tab = n.closest('.variant-tab');
      const vid = tab.dataset.vid;
      if (vid !== ACTIVE_VID) {
        switchVariant(vid);
        requestAnimationFrame(() => {
          const el = document.querySelector(`.tab-name[data-vid="${vid}"]`);
          if (el && !el.isContentEditable) startVariantRename(el);
        });
      } else {
        startVariantRename(n);
      }
    }, true);
  });

  strip.querySelectorAll('.tab-chev').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const vid = b.dataset.vid;
      // Click on a non-active tab's chevron: switch to it AND ensure panel is open.
      // Click on the active tab's chevron: toggle the panel.
      if (vid !== ACTIVE_VID) {
        switchVariant(vid);
        setVariantDetailPanelOpen(true);
      } else {
        const app = document.querySelector('.app');
        const isOpen = app && app.classList.contains('variant-detail-open');
        setVariantDetailPanelOpen(!isOpen);
      }
    });
  });

  document.getElementById('variantAdd').addEventListener('click', () => {
    snapshotActiveVariant();
    const all = readJSON(KEY.variants) || [];
    const active = all.find(v => v.id === ACTIVE_VID) || all[0];
    const newId = 'v' + (all.length + 1) + '_' + Date.now().toString(36).slice(-4);
    const forked = {
      id: newId,
      name: 'Experiment ' + (all.length + 1),
      createdAt: Date.now(),
      ...cloneGraph(active),
    };
    all.push(forked);
    writeJSON(KEY.variants, all);
    switchVariant(newId);
    // Tutorial "Make a variant" step: notify when a new variant is created.
    if (window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('variant-created', { id: newId });
    }
  });

  bindVariantScrollFade();
  renderVariantDetail();
}

function initVariants(P) {
  updateVariantStrip();
  const active = (readJSON(KEY.variants) || []).find(v => v.id === ACTIVE_VID);
  if (active) {
    document.getElementById('bcVariant').textContent = active.name;
  }
  // Restore detail panel state from localStorage; default closed.
  const wantOpen = localStorage.getItem(KEY.variantPanelOpen) === '1';
  setVariantDetailPanelOpen(wantOpen, { skipPersist: true });
}

// ── Variant detail panel ──────────────────────────────────
// One global panel shows info for the active variant. Chevron on any tab
// toggles open/close; switching variants keeps it open and refreshes content.
function setVariantDetailPanelOpen(open, opts = {}) {
  const app = document.querySelector('.app');
  if (!app) return;
  app.classList.toggle('variant-detail-open', !!open);
  const panel = document.getElementById('variantDetailPanel');
  if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (!opts.skipPersist) {
    localStorage.setItem(KEY.variantPanelOpen, open ? '1' : '0');
  }
  if (open) renderVariantDetail();
}

function renderVariantDetail() {
  const panel = document.getElementById('variantDetailPanel');
  if (!panel) return;
  const variants = readJSON(KEY.variants) || [];
  const v = variants.find(x => x.id === ACTIVE_VID) || variants[0];
  if (!v) { panel.innerHTML = ''; return; }

  const allowDelete = variants.length > 1;
  const nodeCount = (v.nodes || []).length;
  const connCount = (v.connections || []).length;
  const created = v.createdAt ? new Date(v.createdAt) : null;
  const createdStr = created
    ? created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const metaBits = [];
  if (createdStr) metaBits.push(`Created ${createdStr}`);
  metaBits.push(`${nodeCount} node${nodeCount === 1 ? '' : 's'}`);
  metaBits.push(`${connCount} connection${connCount === 1 ? '' : 's'}`);

  panel.innerHTML = `
    <div class="vd-content">
      <div class="vd-top-row">
        <span class="vd-desc-label">Description</span>
        <div class="vd-actions">
          <button type="button" class="vd-duplicate" id="vdDuplicate" title="Duplicate this variant">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="6" width="10" height="10" rx="1.5"/><path d="M4 14V5a1 1 0 0 1 1-1h9"/></svg>
            Duplicate variant
          </button>
          <button type="button" class="vd-delete" id="vdDelete" ${allowDelete ? '' : 'disabled'} title="${allowDelete ? 'Delete this variant' : 'Cannot delete the last remaining variant'}">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h12M8 6V4h4v2M7 6l1 10h4l1-10"/></svg>
            Delete
          </button>
        </div>
      </div>
      <textarea class="vd-desc" id="vdDesc" placeholder="Add a description for this variant…">${esc(v.description || '')}</textarea>
      <div class="vd-meta">${metaBits.join(' · ')}</div>
    </div>`;

  const descEl = panel.querySelector('#vdDesc');
  const dupBtn = panel.querySelector('#vdDuplicate');
  const delBtn = panel.querySelector('#vdDelete');

  let descTimer = null;
  const commitDesc = () => {
    const all = readJSON(KEY.variants) || [];
    const target = all.find(x => x.id === v.id);
    if (!target) return;
    const next = descEl.value || '';
    if ((target.description || '') === next) return;
    target.description = next;
    writeJSON(KEY.variants, all);
  };
  descEl.addEventListener('input', () => {
    clearTimeout(descTimer);
    descTimer = setTimeout(commitDesc, 250);
  });
  descEl.addEventListener('blur', () => { clearTimeout(descTimer); commitDesc(); });

  if (dupBtn) dupBtn.addEventListener('click', () => duplicateVariant(v.id));
  if (delBtn && allowDelete) {
    delBtn.addEventListener('click', () => startInlineVariantDelete(v.id));
  }
}

function duplicateVariant(vid) {
  snapshotActiveVariant();
  const all = readJSON(KEY.variants) || [];
  const src = all.find(v => v.id === vid) || all.find(v => v.id === ACTIVE_VID) || all[0];
  if (!src) return;
  const newId = 'v' + (all.length + 1) + '_' + Date.now().toString(36).slice(-4);
  const copy = {
    id: newId,
    name: 'Copy of ' + src.name,
    createdAt: Date.now(),
    description: src.description || '',
    ...cloneGraph(src),
  };
  all.push(copy);
  writeJSON(KEY.variants, all);
  switchVariant(newId);
}

// Inline rename of a variant tab. Commits on blur/Enter; Escape reverts.
function startVariantRename(nameEl) {
  const vid = nameEl.dataset.vid;
  const original = nameEl.textContent;
  pendingVariantSwitchAfterRename = null;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const commit = () => {
    nameEl.contentEditable = 'false';
    const name = (nameEl.textContent || '').trim() || original;
    const variants = readJSON(KEY.variants) || [];
    const v = variants.find(x => x.id === vid);
    if (v) { v.name = name; writeJSON(KEY.variants, variants); }
    nameEl.removeEventListener('blur', commit);
    nameEl.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    updateVariantStrip();
    if (pendingVariantSwitchAfterRename && pendingVariantSwitchAfterRename !== ACTIVE_VID) {
      const nextVid = pendingVariantSwitchAfterRename;
      pendingVariantSwitchAfterRename = null;
      switchVariant(nextVid);
      return;
    }
    pendingVariantSwitchAfterRename = null;
    if (vid === ACTIVE_VID) {
      document.getElementById('bcVariant').textContent = name;
    }
  };
  const onKey = e => {
    if (e.key === 'Enter')  { e.preventDefault(); nameEl.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); nameEl.textContent = original; nameEl.blur(); }
  };
  const onDocPointerDown = e => {
    const targetTab = e.target.closest?.('.variant-tab');
    if (targetTab && targetTab.dataset.vid !== vid) {
      pendingVariantSwitchAfterRename = targetTab.dataset.vid;
    }
    if (e.target === nameEl || nameEl.contains(e.target)) return;
    if (nameEl.isContentEditable) nameEl.blur();
  };
  nameEl.addEventListener('blur', commit);
  nameEl.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onDocPointerDown, true);
}

// Anchored confirm popover: appears directly below the clicked tab
// with the variant's name in the prompt ("Delete ResNet swap?"). More
// discoverable than a toast and visually tied to the chip that spawned it.
function startInlineVariantDelete(vid) {
  const tab = document.querySelector(`.variant-tab[data-vid="${vid}"]`);
  if (!tab) return;
  const variants = readJSON(KEY.variants) || [];
  if (variants.length <= 1) return;
  // If the same popover is already open for this tab, treat the second
  // click on × as "dismiss" (toggle semantics).
  const existing = document.querySelector('.variant-confirm-pop');
  if (existing) {
    const sameTab = existing.dataset.vid === vid;
    existing.remove();
    document.querySelectorAll('.variant-tab.confirming').forEach(t => t.classList.remove('confirming'));
    if (sameTab) return;
  }
  const v = variants.find(x => x.id === vid);
  if (!v) return;
  tab.classList.add('confirming');

  const pop = document.createElement('div');
  pop.className = 'variant-confirm-pop';
  pop.dataset.vid = vid;
  pop.innerHTML = `
    <div class="pop-msg">Delete <strong>${esc(v.name)}</strong>?</div>
    <div class="pop-actions">
      <button type="button" class="pop-no">Cancel</button>
      <button type="button" class="pop-yes">Delete</button>
    </div>`;
  document.body.appendChild(pop);

  // Anchor: flush-left with the tab, ~6px below it. Clamp inside viewport.
  const r = tab.getBoundingClientRect();
  const popW = pop.offsetWidth;
  let left = r.left;
  left = Math.min(Math.max(left, 8), window.innerWidth - popW - 8);
  pop.style.left = left + 'px';
  pop.style.top  = (r.bottom + 6) + 'px';

  const cleanup = () => {
    pop.remove();
    tab.classList.remove('confirming');
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey);
  };
  const onDoc = (e) => {
    if (pop.contains(e.target) || tab.contains(e.target)) return;
    cleanup();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    if (e.key === 'Enter')  { e.preventDefault(); cleanup(); deleteVariant(vid); }
  };
  pop.querySelector('.pop-yes').addEventListener('click', () => { cleanup(); deleteVariant(vid); });
  pop.querySelector('.pop-no').addEventListener('click', cleanup);
  // Deferred so the click that opened the popover doesn't immediately dismiss it.
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  document.addEventListener('keydown', onKey);
}

/** Same anchored UI as variant delete — below the node kebab, not full-screen. */
function startInlineNodeDeleteConfirm(nd, anchorEl) {
  if (!nd || !anchorEl || PATH_DRAW.active) return;
  const existing = document.querySelector('.variant-confirm-pop');
  if (existing) {
    const same = existing.dataset.nodeId === nd.id;
    existing.remove();
    document.querySelectorAll('.menu-dots.confirming').forEach((el) => el.classList.remove('confirming'));
    if (same) return;
  }
  anchorEl.classList.add('confirming');
  const label = nd.label || nd.name || nd.id;
  const pop = document.createElement('div');
  pop.className = 'variant-confirm-pop';
  pop.dataset.nodeId = nd.id;
  pop.innerHTML = `
    <div class="pop-msg">Remove <strong>${esc(label)}</strong> from the canvas? Connections to or from this node will be broken.</div>
    <div class="pop-actions">
      <button type="button" class="pop-no">Cancel</button>
      <button type="button" class="pop-yes">Delete node</button>
    </div>`;
  document.body.appendChild(pop);
  pop.style.position = 'fixed';
  pop.style.zIndex = '80';
  const r = anchorEl.getBoundingClientRect();
  const popW = pop.offsetWidth;
  let left = r.left;
  left = Math.min(Math.max(left, 8), window.innerWidth - popW - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${r.bottom + 6}px`;

  const cleanup = () => {
    pop.remove();
    anchorEl.classList.remove('confirming');
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey);
  };
  const onDoc = (e) => {
    if (pop.contains(e.target) || anchorEl.contains(e.target)) return;
    cleanup();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    if (e.key === 'Enter') { e.preventDefault(); cleanup(); Canvas.removeNode(nd.id); }
  };
  pop.querySelector('.pop-yes').addEventListener('click', () => { cleanup(); Canvas.removeNode(nd.id); });
  pop.querySelector('.pop-no').addEventListener('click', cleanup);
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  document.addEventListener('keydown', onKey);
}

// Deleting a variant wipes its graph + scoped paths/runs/history. Callers
// should drive through startInlineVariantDelete() so the user sees the
// in-place confirm; this function assumes confirmation already happened.
function deleteVariant(vid) {
  const variants = readJSON(KEY.variants) || [];
  if (variants.length <= 1) return; // keep at least one
  const v = variants.find(x => x.id === vid);
  if (!v) return;
  const remaining = variants.filter(x => x.id !== vid);
  writeJSON(KEY.variants, remaining);
  // Purge sibling storage so deleted variants don't silently reappear if
  // recreated with the same id.
  try {
    localStorage.removeItem(KEY.paths(vid));
    localStorage.removeItem(KEY.runs(vid));
    localStorage.removeItem(KEY.history(vid));
  } catch (_) { /* storage quirk, non-fatal */ }

  if (vid === ACTIVE_VID) {
    // Switch to a sibling first so snapshotActiveVariant doesn't write back
    // to the just-deleted id.
    const target = remaining[0];
    ACTIVE_VID = target.id;
    localStorage.setItem(KEY.active, ACTIVE_VID);
    if (PATH_DRAW.active) pathDrawCancel();
    HISTORY_APPLYING = true;
    try {
      Canvas.clear();
      const P = window.PROJECT;
      const inner = Canvas.getCanvasInner();
      inner.style.width  = (target.canvasWidth  || P.canvasWidth)  + 'px';
      inner.style.height = (target.canvasHeight || P.canvasHeight) + 'px';
      (target.nodes || []).forEach(n => Canvas.addNode({ ...n }));
      (target.connections || []).forEach(c => Canvas.addConnection(c.from, c.to));
      Canvas.drawEdges();
    } finally {
      HISTORY_APPLYING = false;
    }
    if (typeof resetUndoRedo === 'function') resetUndoRedo();
    renderPaths();
    renderHistory();
    renderRuns();
    document.getElementById('bcVariant').textContent = target.name;
  }
  updateVariantStrip();
}

/* ── Presence stack ────────────────────────────────────────
   Overlapping avatars + count. Click opens a dropdown listing all
   active collaborators. Avatars are pulled from P.contributors so
   they match the project's actual team. */
function initPresence(P) {
  const btn = document.getElementById('presenceBtn');
  const avatarsEl = document.getElementById('presenceAvatars');
  const countEl = document.getElementById('presenceCount');
  const dropdown = document.getElementById('presenceDropdown');
  // Presence UI is optional (e.g. hidden via HTML for MVP). Skip wiring
  // when any required element is missing so initApp can finish and the
  // rest of the canvas (Run, palette, role pill, share, etc.) stays alive.
  if (!btn || !avatarsEl || !countEl || !dropdown) return;

  const all = (P.contributors || []).slice(0, 8);
  const stackSize = Math.min(3, all.length);
  avatarsEl.innerHTML = all.slice(0, stackSize).map(c =>
    `<span class="pav" style="background:${c.bg || 'var(--avatar-5)'}">${esc(c.letter || '?')}</span>`
  ).join('');
  countEl.textContent = all.length;

  dropdown.innerHTML = `
    <div class="presence-label">Editing now (${all.length})</div>
    ${all.map(c => `
      <div class="presence-row">
        <span class="pav" style="background:${c.bg || 'var(--avatar-5)'}">${esc(c.letter || '?')}</span>
        <span class="name">${esc(c.name || 'Unknown')}</span>
        <span class="live" title="Active"></span>
      </div>
    `).join('')}
  `;

  btn.addEventListener('click', () => {
    dropdown.classList.toggle('open');
  });
  // Dismiss on outside click.
  document.addEventListener('mousedown', e => {
    if (!dropdown.classList.contains('open')) return;
    if (btn.contains(e.target) || dropdown.contains(e.target)) return;
    dropdown.classList.remove('open');
  });
}

function initShareGraph(P) {
  const modal = document.getElementById('shareGraphModal');
  const openBtn = document.getElementById('shareGraphBtn');
  const closeBtn = document.getElementById('shareGraphClose');
  const inviteInput = document.getElementById('shareInviteInput');
  const permSelect = document.getElementById('sharePermSelect');
  const collabList = document.getElementById('shareCollaboratorsList');
  const discoverToggle = document.getElementById('shareDiscoverToggle');
  const inviteBtn = document.getElementById('shareInviteLinkBtn');
  const viewBtn = document.getElementById('shareViewLinkBtn');
  const toast = document.getElementById('shareToast');
  const toastText = document.getElementById('shareToastText');
  if (!modal || !openBtn || !closeBtn || !inviteInput || !permSelect || !collabList || !discoverToggle || !inviteBtn || !viewBtn || !toast || !toastText) return;

  let discoverVisible = true;
  let toastTimer = null;
  const contribs = (P?.contributors || []).slice();
  const othersCount = Math.max(0, contribs.length - 5);
  const inviteLink = `${location.origin}${location.pathname}?project=${encodeURIComponent(P?.slug || P?.id || 'graph')}&invite=push`;
  const viewLink = `${location.origin}${location.pathname.replace('editing-mode-new.html', 'view-mode-new.html')}?project=${encodeURIComponent(P?.slug || P?.id || 'graph')}&mode=contributor`;

  const roleFor = (idx, c) => {
    const raw = String(c?.role || '').toLowerCase();
    if (raw === 'owner' || raw === 'admin' || raw === 'contributor') return raw;
    if (idx === 0) return 'owner';
    if (idx === 1) return 'admin';
    return 'contributor';
  };
  const roleLabel = (role) => {
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    return 'Can push';
  };
  const renderCollabs = () => {
    const lead = contribs.slice(0, 5).map((c, idx) => {
      const role = roleFor(idx, c);
      const pushCount = (idx % 3) + 1;
      return `
        <div class="share-collab-row">
          <span class="av" style="background:${esc(c?.bg || 'var(--avatar-5)')}">${esc(c?.letter || '?')}</span>
          <div class="share-collab-meta">
            <span class="nm">${esc(c?.name || 'Unknown')}${idx === 0 ? ' (you)' : ''}</span>
            <span class="sub">${pushCount} push${pushCount === 1 ? '' : 'es'}</span>
          </div>
          <span class="share-collab-role">${roleLabel(role)}</span>
        </div>
      `;
    }).join('');
    const more = othersCount > 0 ? `<div class="share-others-row">${othersCount} others</div>` : '';
    collabList.innerHTML = lead + more;
  };

  const showToast = (msg) => {
    toastText.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  };
  const copyToClipboard = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast(msg);
    }
  };
  const close = () => {
    modal.classList.remove('show');
    toast.classList.remove('show');
    if (toastTimer) clearTimeout(toastTimer);
  };
  const open = () => {
    renderCollabs();
    modal.classList.add('show');
    setTimeout(() => inviteInput.focus(), 30);
  };

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('show')) return;
    if (e.key === 'Escape') close();
  });
  inviteBtn.addEventListener('click', async () => {
    const id = inviteInput.value.trim();
    const scope = permSelect.value === 'view' ? 'view' : 'push';
    const link = id
      ? `${inviteLink}&for=${encodeURIComponent(id)}&perm=${scope}`
      : `${inviteLink}&perm=${scope}`;
    await copyToClipboard(link, 'Collaborator invite link copied to clipboard');
  });
  viewBtn.addEventListener('click', async () => {
    await copyToClipboard(viewLink, 'View-only link copied to clipboard');
  });
  discoverToggle.addEventListener('click', () => {
    discoverVisible = !discoverVisible;
    discoverToggle.classList.toggle('on', discoverVisible);
  });

  discoverToggle.classList.add('on');
}

/* Bottom panel layout helpers (runs / logs / problems dock). */
function readCssLengthPx(varName, fallback, el) {
  const target = el || document.documentElement;
  const raw = getComputedStyle(target).getPropertyValue(varName).trim();
  const m = raw.match(/^([\d.]+)px$/i);
  if (m) return parseFloat(m[1]);
  return fallback;
}
function bpShellTopPx() {
  const app = document.querySelector('.app');
  const el = app || document.documentElement;
  return readCssLengthPx('--topbar-h', 52, el) + readCssLengthPx('--variant-h', 38, el);
}
const BP_TOP_ANIM_MS = 320;
function beginBpTopAnim() {
  document.querySelector('.app')?.classList.add('bp-animating');
}
function endBpTopAnim() {
  document.querySelector('.app')?.classList.remove('bp-animating');
}
function stashBpDockHeight(panel) {
  if (!panel?.classList.contains('open') || panel.classList.contains('expanded')) return;
  panel.dataset.bpDockH = String(Math.round(panel.getBoundingClientRect().height));
}
function readBpDockHeightPx(panel) {
  const stored = panel?.dataset?.bpDockH;
  if (stored) return Math.max(140, parseFloat(stored) || bpDefaultDockedHeightPx());
  const v = getComputedStyle(panel).getPropertyValue('--bp-h').trim();
  const m = v.match(/^([\d.]+)px$/i);
  if (m) return parseFloat(m[1]);
  return bpDefaultDockedHeightPx();
}
function bpDefaultDockedHeightPx() {
  return readCssLengthPx('--bottom-h', 240);
}
function bpMaxDockedHeightPx() {
  const minMain = 96;
  return Math.max(160, window.innerHeight - bpShellTopPx() - minMain);
}
function bpFullOverlayHeightPx() {
  return window.innerHeight - bpShellTopPx();
}
function collapseVariantsRowIfOpen() {
  const app = document.querySelector('.app');
  if (!app || app.classList.contains('variants-hidden')) return;
  app.classList.add('variants-hidden');
  try { localStorage.setItem('cfg.variantsHidden', '1'); } catch (_) {}
}

function syncBpAppShell() {
  const app = document.querySelector('.app');
  const bp = document.getElementById('bottomPanel');
  if (!app || !bp) return;
  const expanding = bp.classList.contains('open') && bp.classList.contains('expanded');
  const wasExpanded = app.classList.contains('bp-expanded');
  app.classList.toggle('bp-expanded', expanding);
  if (expanding && !wasExpanded) collapseVariantsRowIfOpen();
}

/** Docked Runs/Logs/Problems peek (not full-height overlay). */
function openRunsPanelPeek() {
  const panel = document.getElementById('bottomPanel');
  if (!panel) return;
  panel.classList.add('open');
  document.getElementById('tglRuns')?.classList.add('active');
  panel.querySelectorAll('.bp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'runs'));
  panel.querySelectorAll('.bp-panel').forEach(b => b.classList.toggle('active', b.id === 'bpRuns'));
  if (panel.classList.contains('expanded')) {
    panel.classList.remove('expanded', 'bp-top-anim');
    panel.style.removeProperty('top');
  }
  if (!panel.style.getPropertyValue('--bp-h')) {
    panel.style.setProperty('--bp-h', bpDefaultDockedHeightPx() + 'px');
  }
  syncBpAppShell();
  if (typeof renderRuns === 'function') renderRuns();
}

/** Animate docked peek → full-height overlay (same as #bpExpand). */
function expandRunsPanelSmoothly(onComplete) {
  const panel = document.getElementById('bottomPanel');
  const done = () => { try { onComplete && onComplete(); } catch (_) {} };
  if (!panel || !panel.classList.contains('open')) { done(); return; }
  if (panel.classList.contains('expanded')) { done(); return; }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    panel.removeEventListener('transitionend', onEnd);
    clearTimeout(fallback);
    done();
  };
  const onEnd = (e) => {
    if (e.target !== panel) return;
    if (e.propertyName && e.propertyName !== 'top') return;
    if (!panel.classList.contains('expanded')) return;
    finish();
  };
  panel.addEventListener('transitionend', onEnd);
  const fallback = setTimeout(finish, BP_TOP_ANIM_MS + 40);
  document.getElementById('bpExpand')?.click();
}

/* ── Drawer toggles (topbar) ───────────────────────────────
   Rules:
     • One drawer per side. Opening a left-side tab while the left
       drawer is closed opens the drawer to that tab; clicking the
       already-active tab's topbar button closes the drawer.
     • Right drawer works the same way.
     • Bottom panel toggled separately via Run button or its own
       close X.
     • Tabs inside a drawer share the drawer — clicking a tab just
       switches the panel, doesn't close/reopen. */
function initDrawerToggles() {
  const leftEl = document.getElementById('drawerLeft');
  const rightEl = document.getElementById('drawerRight');
  // Accept topbar toggles, topbar icon buttons, and the "+" tool-palette
  // button (data-side="left" data-tab="discover") as drawer entry points.
  const toggles = document.querySelectorAll('.tb-toggle[data-side], .tb-icon-toggle[data-side], .tool[data-side]');
  function activate(side, tab) {
    const el = side === 'left' ? leftEl : rightEl;
    const tabs = el.querySelectorAll('.drawer-tab');
    const panels = el.querySelectorAll('.drawer-panel');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    panels.forEach(p => p.classList.toggle('active', p.id.toLowerCase().endsWith(tab)));
    // Search bar shows on Discover always; on My Uploads only when there are
    // already custom nodes (empty state owns the "+ Custom" CTA on its own).
    if (side === 'left') {
      const ds = document.getElementById('discoverSearch');
      if (ds) {
        let show = tab === 'discover';
        if (tab === 'uploads') {
          renderUploadsPanel();
          let custom = [];
          try { custom = JSON.parse(localStorage.getItem('cfg.customNodes') || '[]'); } catch (_) {}
          show = custom.length > 0;
        }
        ds.style.display = show ? 'flex' : 'none';
      }
    }
    // Sync every entry-point's active state (topbar + floating pill).
    document.querySelectorAll(`[data-side="${side}"]`).forEach(t => {
      if (!t.dataset.tab) return;
      t.classList.toggle('active', t.dataset.tab === tab && el.classList.contains('open'));
    });
  }
  toggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.side;
      const tab = btn.dataset.tab;
      const el = side === 'left' ? leftEl : rightEl;
      const currentlyActive = btn.classList.contains('active');
      if (currentlyActive) {
        // Close the drawer.
        el.classList.remove('open');
        btn.classList.remove('active');
      } else {
        // Open the drawer to this tab.
        el.classList.add('open');
        activate(side, tab);
      }
      syncPathDrawFloatOverlay();
    });
  });
  // Clicking a tab inside the drawer switches panel but keeps drawer open.
  document.querySelectorAll('.drawer-tabs .drawer-tab').forEach(t => {
    t.addEventListener('click', () => {
      const drawer = t.closest('.drawer');
      const side = drawer.classList.contains('drawer-left') ? 'left' : 'right';
      activate(side, t.dataset.tab);
      syncPathDrawFloatOverlay();
    });
  });
  // Close × on each drawer: collapse the drawer and clear every entry point.
  document.querySelectorAll('.drawer-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.side;
      const el = side === 'left' ? leftEl : rightEl;
      el.classList.remove('open');
      document.querySelectorAll(`[data-side="${side}"]`).forEach(t => {
        if (t.dataset.tab) t.classList.remove('active');
      });
      syncPathDrawFloatOverlay();
    });
  });
  // Runs topbar toggle (bottom panel). Separate from the Run button so users
  // can open/close the results panel without triggering a new run.
  const bottomEl = document.getElementById('bottomPanel');
  const tglRuns = document.getElementById('tglRuns');
  if (tglRuns && bottomEl) {
    tglRuns.addEventListener('click', () => {
      const open = bottomEl.classList.toggle('open');
      tglRuns.classList.toggle('active', open);
      if (open) {
        // Default to the Runs tab when opening via the topbar shortcut.
        bottomEl.querySelectorAll('.bp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'runs'));
        bottomEl.querySelectorAll('.bp-panel').forEach(p => p.classList.toggle('active', p.id === 'bpRuns'));
      } else {
        bottomEl.classList.remove('expanded');
        bottomEl.style.removeProperty('top');
      }
      syncBpAppShell();
    });
  }
  // Drawers start collapsed by default on entry; users can open Discover
  // explicitly via the + button or History via the topbar toggle.
}

/* ── Discover drawer (full catalog + filters) ──────────────
   Data lives in catalog-data.js (shared w/ the old modal) so the
   drawer can present the exact same 200+ items, tabbed by type and
   narrowed with the same Function/Category/I-O/Owner filters. */
const DISCOVER = {
  activeType: 'Model',           // 'Model' | 'Dataset' | 'Logic'
  query: '',
  // Owner/creator filter removed — the catalog will always surface every
  // creator in the system; filtering happens by Function/Category/I-O.
  filters: { Function: new Set(), Category: new Set(), Input: new Set(), Output: new Set() },
};

// Small inline icons for the Model/Dataset/Logic type tabs — same glyphs
// we use on the nodes themselves so users connect the dots across UI.
const DISC_TYPE_ICONS = {
  Model:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16.008v-8.018a1.98 1.98 0 0 0 -1 -1.717l-7 -4.008a2.016 2.016 0 0 0 -2 0l-7 4.008c-.619 .355 -1 1.01 -1 1.718v8.018c0 .709 .381 1.363 1 1.717l7 4.008a2.016 2.016 0 0 0 2 0l7 -4.008c.619 -.355 1 -1.01 1 -1.718"/><path d="M12 22v-10"/><path d="M12 12l8.73 -5.04"/><path d="M3.27 6.96l8.73 5.04"/></svg>`,
  Dataset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/></svg>`,
  Logic:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
};

/* Renders the My Uploads panel. For now: a simple empty state with a
   call-to-action that opens the Add-Custom-Node modal. Custom nodes
   added via the modal are persisted to localStorage under
   'cfg.customNodes' and listed here. */
function renderUploadsPanel() {
  const panel = document.getElementById('panelUploads');
  if (!panel) return;
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('cfg.customNodes') || '[]'); } catch (_) {}

  if (!custom.length) {
    panel.innerHTML = `
      <div class="uploads-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <div class="uploads-empty-title">No custom nodes yet</div>
        <div>Add your own model, dataset, logic, or endpoint.</div>
        <button type="button" class="uploads-empty-cta" id="uploadsEmptyCta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add custom
        </button>
      </div>`;
    document.getElementById('uploadsEmptyCta')?.addEventListener('click', () => {
      document.getElementById('addCustomBtn')?.click();
    });
    return;
  }

  panel.innerHTML = custom.map(c => {
    const p = c.inferredPorts || {};
    const ins = (p.inputs || []).length;
    const outs = (p.outputs || []).length;
    const portsLine = (ins || outs)
      ? `${ins} in · ${outs} out`
      : '';
    const meta = [c.file && c.file.name, portsLine].filter(Boolean).join(' · ');
    return `
    <div class="item-card kind-${esc(c.kind)}" data-custom-id="${esc(c.id)}" role="button" tabindex="0" title="Add ${esc(c.name)} to canvas">
      <div class="row">
        <span class="kind-dot"></span>
        <strong class="title">${esc(c.name)}</strong>
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">${esc(c.kind)}</span>
      </div>
      ${meta ? `<div class="sub">${esc(meta)}</div>` : ''}
    </div>`;
  }).join('');

  // Clicking (or Enter/Space on) a card drops that definition onto the canvas.
  panel.querySelectorAll('.item-card[data-custom-id]').forEach(card => {
    const drop = () => {
      const def = custom.find(c => c.id === card.dataset.customId);
      if (def) dropCustomNode(def);
    };
    card.addEventListener('click', drop);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(); }
    });
  });
}

/* Add-Custom-Node modal — opened from the "+ Add" button in the left
   drawer search row. Two-step flow: (1) pick a kind, (2) upload a file we
   inspect to infer typed ports (see custom-node-detect.js). On confirm we
   persist a reusable definition to 'cfg.customNodes' and drop it on canvas.
   Files are read for schema only — bytes are discarded (metadata-only). */
function initAddCustomModal() {
  const backdrop = document.getElementById('addCustomBackdrop');
  const openBtn = document.getElementById('addCustomBtn');
  const closeBtn = document.getElementById('addCustomClose');
  if (!backdrop || !openBtn) return;

  const stepKind = backdrop.querySelector('[data-step="kind"]');
  const stepUpload = backdrop.querySelector('[data-step="upload"]');
  const backBtn = backdrop.querySelector('#acBack');
  const kindName = backdrop.querySelector('#acKindName');
  const drop = backdrop.querySelector('#acDrop');
  const fileInput = backdrop.querySelector('#acFileInput');
  const dropTitle = backdrop.querySelector('#acDropTitle');
  const dropSub = backdrop.querySelector('#acDropSub');
  const nameInput = backdrop.querySelector('#acName');
  const preview = backdrop.querySelector('#acPreview');
  const previewDetail = backdrop.querySelector('#acPreviewDetail');
  const previewInputs = backdrop.querySelector('#acPreviewInputs');
  const previewOutputs = backdrop.querySelector('#acPreviewOutputs');
  const addBtn = backdrop.querySelector('#acAddBtn');

  let curKind = null, curFile = null, curPorts = null;

  function open() {
    resetFlow();
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
  }
  function close() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  function showStep(step) {
    if (stepKind) stepKind.hidden = step !== 'kind';
    if (stepUpload) stepUpload.hidden = step !== 'upload';
  }
  function resetFlow() {
    curKind = null; curFile = null; curPorts = null;
    if (nameInput) nameInput.value = '';
    if (drop) drop.classList.remove('has-file', 'dragover');
    if (dropTitle) dropTitle.textContent = 'Drop a file or click to browse';
    if (dropSub) dropSub.textContent = 'CSV, JSON, .py, .pt — we’ll infer the ports';
    if (preview) preview.hidden = true;
    if (addBtn) addBtn.disabled = true;
    if (fileInput) fileInput.value = '';
    showStep('kind');
  }
  function updateAddEnabled() {
    if (addBtn) addBtn.disabled = !(nameInput && nameInput.value.trim());
  }
  function renderPorts(el, ports) {
    if (!el) return;
    if (!ports || !ports.length) { el.innerHTML = '<div class="ac-port-empty">None</div>'; return; }
    el.innerHTML = ports.map(p =>
      `<div class="ac-port-row"><span class="ac-port-name" title="${esc(p.name)}">${esc(p.name)}</span><span class="ac-port-type">${esc(p.type || 'any')}</span></div>`
    ).join('');
  }
  function showPreview() {
    if (!curPorts) { if (preview) preview.hidden = true; return; }
    if (preview) preview.hidden = false;
    if (previewDetail) previewDetail.textContent = curPorts.detail || '';
    renderPorts(previewInputs, curPorts.inputs);
    renderPorts(previewOutputs, curPorts.outputs);
  }
  async function handleFile(file) {
    if (!file) return;
    curFile = file;
    if (drop) drop.classList.add('has-file');
    if (dropTitle) dropTitle.textContent = file.name;
    if (dropSub) dropSub.textContent = _humanFileSize(file.size);
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = String(file.name).replace(/\.[^.]+$/, '');
    }
    curPorts = await (window.CustomNodeDetect
      ? CustomNodeDetect.inferPorts(curKind, file)
      : Promise.resolve(null));
    showPreview();
    updateAddEnabled();
  }

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backBtn?.addEventListener('click', () => { resetFlow(); });
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) close();
  });

  backdrop.querySelectorAll('.add-custom-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      curKind = btn.dataset.kind;
      if (kindName) kindName.textContent = curKind;
      showStep('upload');
    });
  });

  // Drag/drop + click-to-browse on the drop zone.
  ['dragenter', 'dragover'].forEach(ev => drop?.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('dragover');
  }));
  ['dragleave', 'dragend'].forEach(ev => drop?.addEventListener(ev, () => drop.classList.remove('dragover')));
  drop?.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  fileInput?.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) handleFile(f);
  });
  nameInput?.addEventListener('input', updateAddEnabled);

  addBtn?.addEventListener('click', () => {
    const name = nameInput && nameInput.value.trim();
    if (!name || !curKind) return;
    const fallback = window.CustomNodeDetect
      ? CustomNodeDetect.defaultPorts(curKind)
      : { inputs: [], outputs: [] };
    const havePorts = curPorts && ((curPorts.inputs || []).length || (curPorts.outputs || []).length);
    const ports = havePorts
      ? { inputs: curPorts.inputs, outputs: curPorts.outputs }
      : { inputs: fallback.inputs, outputs: fallback.outputs };
    const def = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      kind: curKind,
      name,
      desc: curFile ? curFile.name : '',
      file: curFile ? { name: curFile.name, size: curFile.size } : null,
      detected: curPorts ? (curPorts.detail || '') : '',
      inferredPorts: { inputs: ports.inputs, outputs: ports.outputs },
      createdAt: new Date().toISOString(),
    };
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('cfg.customNodes') || '[]'); } catch (_) {}
    custom.push(def);
    try { localStorage.setItem('cfg.customNodes', JSON.stringify(custom)); } catch (_) {}
    close();
    dropCustomNode(def);
    renderUploadsPanel();
  });
}

// Human-readable byte size for upload chips ("2.4 KB", "1.1 MB").
function _humanFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function initDiscover() {
  const panel = document.getElementById('panelDiscover');
  const input = document.getElementById('discoverQuery');
  const searchWrap = document.getElementById('discoverSearch');
  const clearBtn = document.getElementById('discoverQueryClear');
  const syncSearchUi = () => {
    if (!searchWrap) return;
    searchWrap.classList.toggle('has-value', !!input.value.trim());
  };
  input.addEventListener('input', () => {
    DISCOVER.query = input.value;
    syncSearchUi();
    renderDiscover();
  });
  clearBtn?.addEventListener('click', e => {
    e.stopPropagation();
    DISCOVER.query = '';
    input.value = '';
    syncSearchUi();
    renderDiscover();
    input.focus();
  });
  // Close any open filter dropdown when clicking elsewhere. The dropdown
  // itself is rendered outside the pill (position: fixed) so we need to
  // check both the pill and the dropdown container.
  document.addEventListener('click', e => {
    if (e.target.closest('.disc-filter-pill')) return;
    if (e.target.closest('#discFilterDropdown')) return;
    panel.querySelectorAll('.disc-filter-pill.open').forEach(p => p.classList.remove('open'));
    const drop = document.getElementById('discFilterDropdown');
    if (drop) drop.style.display = 'none';
  });
  syncSearchUi();
  renderDiscover();
}

function resetDiscover() {
  DISCOVER.query = '';
  const qEl = document.getElementById('discoverQuery');
  const searchWrap = document.getElementById('discoverSearch');
  qEl.value = '';
  searchWrap?.classList.remove('has-value');
  Object.keys(DISCOVER.filters).forEach(k => DISCOVER.filters[k].clear());
  renderDiscover();
}

function renderDiscover() {
  const panel = document.getElementById('panelDiscover');
  const CATALOG = window.DISCOVER_CATALOG || [];
  const FN_TO_CAT = window.DISCOVER_FN_TO_CAT || {};
  const q = DISCOVER.query.trim().toLowerCase();
  const f = DISCOVER.filters;
  const tourOn = typeof _tutorialActive === 'function' && _tutorialActive();
  const items = CATALOG.filter(it => {
    if (it.type !== DISCOVER.activeType) return false;
    // Tutorial-only sample entries stay hidden outside the guided tour.
    if (it.tutorial && !tourOn) return false;
    if (q && !(it.label.toLowerCase().includes(q) || it.by.toLowerCase().includes(q) || (it.fn && it.fn.toLowerCase().includes(q)))) return false;
    if (f.Function.size && !f.Function.has(it.fn)) return false;
    if (f.Category.size && !f.Category.has(FN_TO_CAT[it.fn] || '')) return false;
    if (f.Input.size    && ![...f.Input ].some(v => (it.inputs  || '').toLowerCase().includes(v.toLowerCase()))) return false;
    if (f.Output.size   && ![...f.Output].some(v => (it.outputs || '').toLowerCase().includes(v.toLowerCase()))) return false;
    return true;
  });
  // Pin tutorial samples to the top so the tour can reliably anchor to them.
  if (tourOn) items.sort((a, b) => (b.tutorial ? 1 : 0) - (a.tutorial ? 1 : 0));
  const anyFilter = Object.values(f).some(s => s.size);
  const narrowed = !!q || anyFilter;
  const typeLabel = DISCOVER.activeType === 'Model' ? 'models' : DISCOVER.activeType === 'Dataset' ? 'datasets' : 'logic';
  const typeLabelSingular = DISCOVER.activeType === 'Model' ? 'model' : DISCOVER.activeType === 'Dataset' ? 'dataset' : 'logic block';
  const label = items.length === 1 ? typeLabelSingular : typeLabel;
  const countPrefix = narrowed
    ? (q ? `Showing ${items.length} ${label} for` : `Showing ${items.length} ${label}`)
    : `Showing all ${items.length.toLocaleString()} ${typeLabel}`;

  panel.innerHTML = `
    <div class="disc-head">
      <div class="disc-type-tabs">
        ${['Model','Dataset','Logic'].map(t => `
          <button class="disc-type-tab ${t === DISCOVER.activeType ? 'active' : ''}" data-type="${t}">
            ${DISC_TYPE_ICONS[t] || ''}
            ${t === 'Model' ? 'Models' : t === 'Dataset' ? 'Datasets' : 'Logic'}
          </button>`).join('')}
      </div>
      <div class="disc-filter-row">
        ${['Function','Input','Output'].map(k => {
          const count = DISCOVER.filters[k].size;
          return `<div class="disc-filter-pill ${count ? 'has-selection' : ''}" data-filter="${k}">
            ${esc(k)}${count ? `<span class="pill-badge">${count}</span>` : ''}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;"><path d="M5 8l5 5 5-5"/></svg>
          </div>`;
        }).join('')}
        ${anyFilter ? `<button type="button" class="disc-clear-filters" id="discClearFiltersLink" style="margin-left:auto;">Clear filters</button>` : ''}
      </div>
      <!-- Shared dropdown container, positioned via fixed coords so it
           escapes the drawer's scroll/stacking context. -->
      <div class="disc-filter-dropdown" id="discFilterDropdown"></div>
    </div>
    <div class="disc-count-row">
      <div class="disc-count-main">${esc(countPrefix)}${q ? ` "<span class="disc-count-query" title="${esc(DISCOVER.query)}">${esc(DISCOVER.query)}</span>"` : ''}</div>
    </div>
    <div class="disc-results">
      ${items.length === 0
        ? `<div class="disc-empty">
            <div>${narrowed ? `No matching ${typeLabel}. Try refining your search or removing filters.` : `No ${typeLabel} available yet.`}</div>
            ${narrowed ? `<button class="disc-empty-reset" id="discReset">${q && anyFilter ? 'Reset search &amp; filters' : q ? 'Clear search' : 'Clear filters'}</button>` : ''}
          </div>`
        : items.map((it, i) => renderDiscoverCard(it, i)).join('')}
    </div>`;

  // Wire up type tabs.
  panel.querySelectorAll('.disc-type-tab').forEach(t => t.addEventListener('click', () => {
    DISCOVER.activeType = t.dataset.type;
    renderDiscover();
  }));
  // Wire up filter pill dropdowns. One shared dropdown floats in `position:
  // fixed` coords below whichever pill was clicked; this prevents the
  // drawer's scroll container from clipping it.
  const drop = document.getElementById('discFilterDropdown');
  panel.querySelectorAll('.disc-filter-pill').forEach(pill => {
    const k = pill.dataset.filter;
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = pill.classList.contains('open');
      panel.querySelectorAll('.disc-filter-pill.open').forEach(p => p.classList.remove('open'));
      if (wasOpen) { drop.style.display = 'none'; return; }
      pill.classList.add('open');
      buildFilterDropdown(drop, k);
      // Position under the pill; flip to the left edge if it'd overflow.
      const r = pill.getBoundingClientRect();
      drop.style.display = 'block';
      const dropW = 240;
      const preferredLeft = r.left;
      const maxLeft = window.innerWidth - dropW - 8;
      drop.style.left = Math.min(preferredLeft, maxLeft) + 'px';
      drop.style.top  = (r.bottom + 4) + 'px';
    });
  });
  // Reset button in empty state.
  const reset = document.getElementById('discReset');
  if (reset) reset.addEventListener('click', resetDiscover);
  const clearFiltersLink = document.getElementById('discClearFiltersLink');
  if (clearFiltersLink) clearFiltersLink.addEventListener('click', () => {
    Object.keys(DISCOVER.filters).forEach(k => DISCOVER.filters[k].clear());
    renderDiscover();
  });
  // Add button on each card.
  panel.querySelectorAll('.add-btn[data-cat-idx]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const item = CATALOG[parseInt(b.dataset.catIdx, 10)];
    addCatalogNode(item);
  }));
  // Expand / collapse on card body click (not on the Add button).
  panel.querySelectorAll('.disc-card-row').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.add-btn')) return;
      const willExpand = !card.classList.contains('expanded');
      panel.querySelectorAll('.disc-card-row.expanded').forEach(c => c.classList.remove('expanded'));
      if (willExpand) card.classList.add('expanded');
    });
  });
}

// Icons used in meta-row (views / downloads / likes). Small to keep the
// card compact like HF's model list.
const DISC_META_ICONS = {
  views:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  downloads: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  likes:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
};

function renderDiscoverCard(it, i) {
  const idx = (window.DISCOVER_CATALOG || []).indexOf(it);
  // Stable pseudo-random "likes" etc. for catalog items that don't have
  // them — so the card reads plausibly without us hardcoding values.
  let h = 0; for (let k = 0; k < (it.label||'').length; k++) h = (h * 31 + it.label.charCodeAt(k)) | 0;
  const likes = Math.abs(h) % 9000 + 120;
  const updated = ['2d ago','1w ago','3w ago','last month','2 months ago'][Math.abs(h) % 5];
  const license = ['Apache 2.0','MIT','CC-BY-4.0','OpenRAIL','Custom'][Math.abs(h>>2) % 5];
  const views = it.views || ((Math.abs(h>>3) % 900 + 40) + 'k');
  const downloads = it.downloads || ((Math.abs(h>>5) % 400 + 5) + 'k');
  // Longer description for the expanded state — placeholder copy that
  // reads like an HF model card summary.
  const desc = it.description || `${it.label} is a ${(it.fn||'multi-purpose').toLowerCase()} ${it.type.toLowerCase()} released by ${it.by}. Trained on ${it.fw || 'standard benchmarks'} with a focus on ${(it.fn||'general-purpose tasks').toLowerCase()}.`;

  return `
    <div class="disc-card-row"${it.tutorial ? ` data-tutorial-id="${esc(it.tutorial)}"` : ''}>
      <div class="disc-card-main">
        <div class="t">
          <span class="dot" style="background:${it.color}"></span>
          <span>${esc(it.label)}</span>
          <span class="disc-caret" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </div>
        <div class="s">by ${esc(it.by)}${it.fn ? ' · ' + esc(it.fn) : ''}</div>
        <div class="meta-row">
          <span class="meta-item">${DISC_META_ICONS.downloads}${esc(downloads)}</span>
          <span class="meta-item">${DISC_META_ICONS.views}${esc(views)}</span>
          <span class="meta-item">${DISC_META_ICONS.likes}${likes.toLocaleString()}</span>
        </div>
        <div class="tags">
          ${it.inputs  ? `<span class="tag">← ${esc(it.inputs)}</span>`  : ''}
          ${it.outputs ? `<span class="tag">→ ${esc(it.outputs)}</span>` : ''}
          ${it.fw ? `<span class="tag">${esc(it.fw)}</span>` : ''}
        </div>
      </div>
      <div class="disc-card-expand">
        <div class="desc">${esc(desc)}</div>
        <div class="grid">
          <div class="row"><span class="k">Author</span><span class="v">${esc(it.by)}</span></div>
          <div class="row"><span class="k">Task</span><span class="v">${esc(it.fn || '—')}</span></div>
          <div class="row"><span class="k">Framework</span><span class="v">${esc(it.fw || '—')}</span></div>
          <div class="row"><span class="k">License</span><span class="v">${esc(license)}</span></div>
          <div class="row"><span class="k">Updated</span><span class="v">${esc(updated)}</span></div>
          <div class="row"><span class="k">Likes</span><span class="v">${likes.toLocaleString()}</span></div>
          ${it.inputs  ? `<div class="row"><span class="k">Inputs</span><span class="v">${esc(it.inputs)}</span></div>`  : ''}
          ${it.outputs ? `<div class="row"><span class="k">Outputs</span><span class="v">${esc(it.outputs)}</span></div>` : ''}
        </div>
      </div>
      <button class="add-btn" data-cat-idx="${idx}">Add</button>
    </div>`;
}

// Computes how many catalog entries a given filter option would match,
// respecting the ACTIVE type tab and OTHER filters already on. This makes
// counts behave like HF / Linear filter menus: selecting "PyTorch" in
// Framework, for instance, will update the count next to each Function
// option so users can see which ones still have live results.
function countForFilterOption(key, opt) {
  const CATALOG = window.DISCOVER_CATALOG || [];
  const FN_TO_CAT = window.DISCOVER_FN_TO_CAT || {};
  const f = DISCOVER.filters;
  return CATALOG.filter(it => {
    if (it.type !== DISCOVER.activeType) return false;
    // Apply all filters EXCEPT the one whose dropdown we're counting for —
    // otherwise every unselected option would read "0" as soon as the user
    // picks one in the same group.
    for (const k of Object.keys(f)) {
      if (k === key) continue;
      if (!f[k].size) continue;
      if (k === 'Function' && !f.Function.has(it.fn)) return false;
      if (k === 'Category' && !f.Category.has(FN_TO_CAT[it.fn] || '')) return false;
      if (k === 'Input'    && ![...f.Input ].some(v => (it.inputs  || '').toLowerCase().includes(v.toLowerCase()))) return false;
      if (k === 'Output'   && ![...f.Output].some(v => (it.outputs || '').toLowerCase().includes(v.toLowerCase()))) return false;
    }
    // And the option itself applied to this row:
    if (key === 'Function') return it.fn === opt;
    if (key === 'Category') return (FN_TO_CAT[it.fn] || '') === opt;
    if (key === 'Input')    return (it.inputs  || '').toLowerCase().includes(opt.toLowerCase());
    if (key === 'Output')   return (it.outputs || '').toLowerCase().includes(opt.toLowerCase());
    return false;
  }).length;
}

function buildFilterDropdown(drop, key) {
  const opts = (window.DISCOVER_FILTERS || {})[key] || [];
  const set = DISCOVER.filters[key];
  // Decorate each option with a live count, sort: any options currently
  // selected float to the top (so they never "vanish" below the fold when
  // their count hits 0), then live options by count desc, then 0-count
  // options at the bottom (greyed out).
  const decorated = opts.map(opt => ({
    opt,
    count: countForFilterOption(key, opt),
    selected: set.has(opt),
  }));
  decorated.sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    if ((a.count === 0) !== (b.count === 0)) return a.count === 0 ? 1 : -1;
    return b.count - a.count;
  });
  drop.innerHTML = `
    <div class="disc-filter-search">
      <input type="text" placeholder="Search ${esc(key.toLowerCase())}…" />
    </div>
    <div class="disc-filter-clear ${set.size ? '' : 'disabled'}">Clear selections</div>
    <div class="disc-filter-list">
      ${decorated.map(({ opt, count, selected }) => {
        const disabled = count === 0 && !selected;
        return `<label class="disc-filter-opt ${disabled ? 'disabled' : ''}" data-opt="${esc(opt)}">
          <input type="checkbox" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
          <span>${esc(opt)}</span>
          <span class="count">${count}</span>
        </label>`;
      }).join('')}
    </div>
  `;
  const search = drop.querySelector('.disc-filter-search input');
  search.addEventListener('input', () => {
    const qq = search.value.trim().toLowerCase();
    drop.querySelectorAll('.disc-filter-opt').forEach(r => {
      const ok = !qq || r.dataset.opt.toLowerCase().includes(qq);
      r.classList.toggle('hidden', !ok);
    });
  });
  drop.querySelectorAll('.disc-filter-opt').forEach(row => {
    const cb = row.querySelector('input');
    // Prevent the label from closing the dropdown — we stop propagation so
    // the outer document listener doesn't fire, and we only re-render the
    // panel body. Dropdown stays open; checkbox counts update.
    row.addEventListener('click', e => {
      if (row.classList.contains('disabled')) return;
      e.stopPropagation();
    });
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const opt = row.dataset.opt;
      if (cb.checked) set.add(opt); else set.delete(opt);
      // Re-render the main results but KEEP the dropdown open. Rebuild the
      // dropdown in place with new counts / ordering.
      renderDiscover();
      // renderDiscover replaces the pill element, so we need to reopen the
      // same filter's dropdown at the new pill's coords.
      const pill = document.querySelector(`.disc-filter-pill[data-filter="${key}"]`);
      if (!pill) return;
      document.querySelectorAll('.disc-filter-pill.open').forEach(p => p.classList.remove('open'));
      pill.classList.add('open');
      const newDrop = document.getElementById('discFilterDropdown');
      buildFilterDropdown(newDrop, key);
      const r = pill.getBoundingClientRect();
      newDrop.style.display = 'block';
      newDrop.style.left = Math.min(r.left, window.innerWidth - 268) + 'px';
      newDrop.style.top  = (r.bottom + 4) + 'px';
    });
  });
  const clear = drop.querySelector('.disc-filter-clear');
  if (clear) clear.addEventListener('click', e => {
    e.stopPropagation();
    if (!set.size) return;
    set.clear();
    renderDiscover();
    const pill = document.querySelector(`.disc-filter-pill[data-filter="${key}"]`);
    if (!pill) return;
    pill.classList.add('open');
    const newDrop = document.getElementById('discFilterDropdown');
    buildFilterDropdown(newDrop, key);
    const r = pill.getBoundingClientRect();
    newDrop.style.display = 'block';
    newDrop.style.left = Math.min(r.left, window.innerWidth - 268) + 'px';
    newDrop.style.top  = (r.bottom + 4) + 'px';
  });
}

// Stable letter + color for the creator bubble. We hash the creator name
// into one of the avatar colors so the same org always lights up the same
// way ("Meta" always blue, etc.) without needing a real identity service.
const CREATOR_PALETTE = ['var(--avatar-1)', 'var(--avatar-2)', 'var(--avatar-3)', 'var(--avatar-4)', 'var(--avatar-5)', 'var(--avatar-6)', 'var(--avatar-7)'];
function creatorAvatar(by) {
  const name = String(by || '').trim() || 'Unknown';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const color = CREATOR_PALETTE[Math.abs(hash) % CREATOR_PALETTE.length];
  // Grab the first alphanumeric character — handles names like "stability AI".
  const letterMatch = name.match(/[A-Za-z0-9]/);
  const letter = (letterMatch ? letterMatch[0] : '?').toUpperCase();
  return { letter, color };
}

function applyNewNodeBadge(el) {
  if (!el) return;
  const existing = el.querySelector('.node-new-badge');
  if (existing) existing.remove();
  const badge = document.createElement('span');
  badge.className = 'node-new-badge';
  badge.textContent = 'New';
  el.appendChild(badge);
  const clear = () => badge.remove();
  el.addEventListener('pointerdown', clear, { once: true, capture: true });
}

// Drops a saved custom-node definition (from My Uploads) onto the canvas.
// The definition carries inferred ports + file metadata; we map its `kind`
// to a canvas node `type` and attach a `custom` block for the Inspector and
// for persistence (see snapshotActiveVariant's whitelist).
const CUSTOM_KIND_TYPE = { model: 'Model', dataset: 'Dataset', logic: 'Logic', endpoint: 'Logic' };
const CUSTOM_KIND_COLOR = { model: 'blue', dataset: 'green', logic: 'purple', endpoint: 'yellow' };
function dropCustomNode(def) {
  if (!def) return;
  const center = Canvas.getViewportCenter();
  const id = 'n_' + Date.now().toString(36);
  const ports = def.inferredPorts || {};
  const node = {
    id,
    type: CUSTOM_KIND_TYPE[def.kind] || 'Model',
    label: def.name || 'Custom node',
    icon: 'square',
    color: CUSTOM_KIND_COLOR[def.kind] || 'blue',
    user: creatorAvatar('You'),
    x: center.x - 110, y: center.y - 60,
    inputs: (ports.inputs || []).map(p => ({ ...p })),
    outputs: (ports.outputs || []).map(p => ({ ...p })),
    custom: {
      defId: def.id,
      kind: def.kind,
      fileName: def.file ? def.file.name : null,
      fileSize: def.file ? def.file.size : null,
      detected: def.detected || '',
    },
  };
  const el = Canvas.addNode(node);
  el.classList.add('drop-in');
  setTimeout(() => { el.classList.remove('drop-in'); applyNewNodeBadge(el); }, 700);
  const added = (Canvas.getNode && Canvas.getNode(node.id)) || node;
  if (typeof _setSelectedNodes === 'function') _setSelectedNodes([node.id]);
  if (typeof openInspector === 'function') openInspector(added);
}

// Drops a catalog item onto the canvas at the viewport center.
// Maps the catalog color + I/O strings into the node data shape Canvas expects.
function addCatalogNode(item) {
  const center = Canvas.getViewportCenter();
  const id = 'n_' + Date.now().toString(36);
  // Map "var(--dot-blue)" → "blue" for the node color token.
  const colorMatch = /var\(--dot-(\w+)\)/.exec(item.color || '');
  const color = colorMatch ? colorMatch[1] : 'blue';
  const portList = (str) => (str || '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .map((name, i) => ({ name: name + (i ? ' ' + (i+1) : ''), type: name }));
  const node = {
    id,
    // Canvas keys ICONS off the capitalized type ("Model"/"Dataset"/"Logic")
    // and renders `label` as the title; using those field names keeps the
    // new card looking identical to hand-authored nodes in data.js.
    type: item.type,
    label: item.label,
    icon: 'square', color,
    user: creatorAvatar(item.by),
    x: center.x - 110, y: center.y - 60,
    inputs:  item.type === 'Dataset' ? [] : portList(item.inputs  || 'input'),
    outputs: portList(item.outputs || 'output'),
    fn: item.fn, fw: item.fw, by: item.by,
    views: item.views, downloads: item.downloads,
  };
  // Tutorial: the Sample Dataset/Model are tagged Start/End on add so the
  // user immediately sees role tags and can trace a path between them.
  if (_tutorialActive() && item.tutorial === 'dataset') {
    node.tags = ['start'];
    window._tutorialDatasetNodeId = node.id;
    // Place it to the left of the existing chain so the connection the user
    // draws to the preprocessor reads cleanly left → right.
    try {
      const ns = (Canvas.getAllNodes && Canvas.getAllNodes()) || [];
      if (ns.length) {
        const minX = Math.min(...ns.map(n => n.x || 0));
        const avgY = ns.reduce((s, n) => s + (n.y || 0), 0) / ns.length;
        node.x = minX - 440;
        node.y = avgY;
      }
    } catch (_) {}
  } else if (_tutorialActive() && item.tutorial === 'model') {
    node.tags = ['end'];
    window._tutorialModelNodeId = node.id;
  }
  const el = Canvas.addNode(node);
  el.classList.add('drop-in');
  if (Array.isArray(node.tags) && node.tags.length && typeof recomputeAutoRoles === 'function') {
    recomputeAutoRoles();
  }
  setTimeout(() => {
    el.classList.remove('drop-in');
    applyNewNodeBadge(el);
  }, 700);
  // A freshly added node opens its Inspector automatically, mirroring the
  // node-click behavior, so the user can configure it right away.
  const added = (Canvas.getNode && Canvas.getNode(node.id)) || node;
  if (typeof _setSelectedNodes === 'function') _setSelectedNodes([node.id]);
  if (typeof openInspector === 'function') openInspector(added);
  // Tutorial: center on the new node for palette-add steps, but not right
  // before "Chain them up" — that step fits the whole pipeline zoomed out.
  if (_tutorialActive()) {
    const tutStep = window.ConnectifyTutorial?.getState?.()?.currentStep;
    const skipFocus = tutStep >= 6;
    if (!skipFocus) {
      setTimeout(() => {
        try {
          const n = (Canvas.getNode && Canvas.getNode(node.id)) || node;
          if (n && Canvas.focusWorld) Canvas.focusWorld((n.x || 0) + 110, (n.y || 0) + 60, { animate: true });
        } catch (_) {}
      }, 80);
    }
  }
  // Notify the tour after a Dataset/Model is added via the palette.
  // (notifyAction is a no-op when the tour isn't running.)
  if (window.ConnectifyTutorial) {
    window.ConnectifyTutorial.notifyAction('node-added', { type: item.type, id: node.id });
  }
}

// Is the guided tour currently running (started, not skipped/completed)?
function _tutorialActive() {
  try {
    if (!window.ConnectifyTutorial) return false;
    const s = window.ConnectifyTutorial.getState();
    return !!(s && s.started && !s.skipped && !s.completed);
  } catch (_) { return false; }
}

/* ── History (mocked timeline) ─────────────────────────────
   Real version reads Git-style snapshots. Wireframe shows a handful
   of believable entries so the IA reads correctly. */
/* ── History (per-variant snapshots + revert) ──────────────
   Stored under cfg.history.${slug}.${vid}. "Save snapshot" captures
   the current canvas state; "Revert" swaps the live graph back to a
   past snapshot. History is variant-scoped because the node IDs in a
   snapshot only make sense within the same variant. */
// Tab / Shift+Tab cycle through versions when the History panel is visible
// in the left drawer. The active (or previewing) card is the anchor; Tab
// moves older, Shift+Tab moves newer. Each step starts a preview so the
// user can scrub through versions at the keyboard.
function initVersionKeyNav() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    // Don't interfere with text entry / form focus.
    const target = e.target;
    if (target && target.matches('input, textarea, [contenteditable="true"], select, button')) return;
    // Only when the History tab is open in the left drawer.
    const leftEl = document.getElementById('drawerLeft');
    if (!leftEl || !leftEl.classList.contains('open')) return;
    const historyPanel = document.getElementById('panelHistory');
    if (!historyPanel || !historyPanel.classList.contains('active')) return;
    const hist = (readJSON(KEY.history(ACTIVE_VID)) || []).slice().reverse(); // newest first
    if (!hist.length) return;
    e.preventDefault();
    // Anchor: currently previewing id, else the first ("current") entry.
    const anchorId = HIST_PREVIEW.id || hist[0].id;
    const idx = Math.max(0, hist.findIndex(h => h.id === anchorId));
    const next = e.shiftKey ? idx - 1 : idx + 1;
    // Clamp — once you hit the end in either direction, don't wrap; most
    // apps don't wrap Tab cycles and wrapping makes it easy to miss that
    // you're back at the top.
    if (next < 0 || next >= hist.length) return;
    const targetEntry = hist[next];
    if (next === 0 && !HIST_PREVIEW.id) return; // already on current
    startHistoryPreview(targetEntry.id);
    // Scroll the matching card into view inside the panel.
    const card = historyPanel.querySelector(`.history-item[data-id="${targetEntry.id}"]`);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function initHistory() {
  // Seed an initial snapshot on first visit per variant so the list
  // isn't empty out-of-the-gate.
  const variants = readJSON(KEY.variants) || [];
  variants.forEach(v => {
    const existing = readJSON(KEY.history(v.id));
    if (!existing || !existing.length) {
      writeJSON(KEY.history(v.id), [{
        id: 'h_' + Date.now().toString(36) + '_' + v.id,
        msg: 'Initial version', by: 'System', at: Date.now(),
        nodes: (v.nodes || []).map(n => ({ ...n })),
        connections: (v.connections || []).map(c => Canvas.snapshotConnection(c)),
        canvasWidth: v.canvasWidth, canvasHeight: v.canvasHeight,
      }]);
    }
  });
  renderHistory();
}

// Preview mode tracks: is a snapshot currently being previewed, and
// what's the id + the live state we'd need to restore if the user exits
// preview without committing. Storing the pre-preview state avoids
// mutating history on every peek — preview is non-destructive.
const HIST_PREVIEW = { id: null, savedState: null };

function renderHistory() {
  document.querySelector('.history-confirm-pop')?._cleanup?.();
  const panel = document.getElementById('panelHistory');
  if (!panel) return; // History panel was removed in v2 layout — exit cleanly.
  const hist = (readJSON(KEY.history(ACTIVE_VID)) || []).slice().reverse(); // newest first
  const previewingId = HIST_PREVIEW.id;
  panel.innerHTML = `
    <div class="history-head">
      <button class="history-save" id="historySave" title="Save a snapshot of the current graph" ${previewingId ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save snapshot
      </button>
      <div style="font-size:11.5px;color:var(--text-muted);">${hist.length} version${hist.length === 1 ? '' : 's'}</div>
    </div>
    ${hist.map((h, i) => {
      const isCurrent = i === 0;
      const isPreview = previewingId === h.id;
      return `
      <div class="history-item ${isCurrent ? 'current' : ''} ${isPreview ? 'previewing' : ''}" data-id="${h.id}" data-current="${isCurrent ? '1' : '0'}">
        <div class="hi-top">
          <div class="ver">v${hist.length - i}${isCurrent ? '<span class="current-tag">· current</span>' : ''}${isPreview ? '<span class="preview-tag">· previewing</span>' : ''}</div>
          ${hist.length > 1 ? `<button class="hi-del" data-id="${h.id}" title="Delete version" aria-label="Delete version">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>` : ''}
        </div>
        <button class="msg hi-name" data-act="rename-history" title="Click to rename version">${esc(h.msg || 'Snapshot')}</button>
        <div class="time">${esc(h.by || 'You')} · ${formatRelativeTime(h.at)}</div>
      </div>
      `;
    }).join('')}
  `;
  document.getElementById('historySave').addEventListener('click', () => saveHistorySnapshot());
  // Click anywhere on a card enters preview (unless it's already current
  // and nothing is being previewed).
  panel.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('button') || e.target.closest('[contenteditable="true"]')) return;
      if (!HIST_PREVIEW.id && item.dataset.current === '1') return;
      if (HIST_PREVIEW.id && item.dataset.current === '1') { exitHistoryPreview(); return; }
      const id = item.dataset.id;
      if (HIST_PREVIEW.id === id) {
        exitHistoryPreview();
      } else {
        startHistoryPreview(id);
      }
    });
  });
  panel.querySelectorAll('.hi-name').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      startInlineHistoryRename(btn.closest('.history-item')?.dataset.id, btn);
    }, true);
  });
  panel.querySelectorAll('.hi-del').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const id = b.dataset.id;
      startInlineHistoryDelete(id, b);
    });
  });
  renderHistoryPreviewBox();
}

function startInlineHistoryRename(historyId, nameEl) {
  if (!historyId || !nameEl || nameEl.isContentEditable) return;
  const original = nameEl.textContent;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const commit = () => {
    nameEl.contentEditable = 'false';
    const name = (nameEl.textContent || '').trim() || original || 'Snapshot';
    const hist = readJSON(KEY.history(ACTIVE_VID)) || [];
    const h = hist.find(x => x.id === historyId);
    if (h) { h.msg = name; writeJSON(KEY.history(ACTIVE_VID), hist); }
    nameEl.removeEventListener('blur', commit);
    nameEl.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    renderHistory();
  };
  const onKey = e => {
    if (e.key === 'Enter')  { e.preventDefault(); nameEl.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); nameEl.textContent = original; nameEl.blur(); }
  };
  const onDocPointerDown = e => {
    if (e.target === nameEl || nameEl.contains(e.target)) return;
    if (nameEl.isContentEditable) nameEl.blur();
  };
  nameEl.addEventListener('blur', commit);
  nameEl.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onDocPointerDown, true);
}

function startInlineHistoryDelete(historyId, btnEl) {
  const hist = readJSON(KEY.history(ACTIVE_VID)) || [];
  const target = hist.find(h => h.id === historyId);
  if (!target || !btnEl) return;
  const existing = document.querySelector('.history-confirm-pop');
  if (existing) {
    const same = existing.dataset.historyId === historyId;
    existing._cleanup?.();
    if (same) return;
  }

  const pop = document.createElement('div');
  pop.className = 'variant-confirm-pop history-confirm-pop';
  pop.dataset.historyId = historyId;
  pop.innerHTML = `
    <div class="pop-msg">Delete <strong>${esc(target.msg || 'Snapshot')}</strong>?</div>
    <div class="pop-actions">
      <button type="button" class="pop-no">Cancel</button>
      <button type="button" class="pop-yes">Delete</button>
    </div>`;
  document.body.appendChild(pop);

  const r = btnEl.getBoundingClientRect();
  const popW = pop.offsetWidth;
  let left = r.right - popW;
  left = Math.min(Math.max(left, 8), window.innerWidth - popW - 8);
  pop.style.left = left + 'px';
  pop.style.top  = (r.bottom + 6) + 'px';

  const cleanup = () => {
    pop.remove();
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey);
  };
  pop._cleanup = cleanup;

  const onDoc = (e) => {
    if (pop.contains(e.target) || btnEl.contains(e.target)) return;
    cleanup();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    if (e.key === 'Enter')  { e.preventDefault(); cleanup(); deleteHistoryVersion(historyId); }
  };
  pop.querySelector('.pop-yes').addEventListener('click', () => { cleanup(); deleteHistoryVersion(historyId); });
  pop.querySelector('.pop-no').addEventListener('click', cleanup);
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  document.addEventListener('keydown', onKey);
}

function renderHistoryPreviewBox() {
  const host = document.getElementById('canvasArea');
  if (!host) return;
  let box = document.getElementById('historyPreviewFloat');
  if (!HIST_PREVIEW.id) {
    box?.remove();
    return;
  }
  if (!box) {
    box = document.createElement('div');
    box.id = 'historyPreviewFloat';
    box.className = 'history-preview-float';
    host.appendChild(box);
  }
  const hist = readJSON(KEY.history(ACTIVE_VID)) || [];
  const previewed = hist.find(h => h.id === HIST_PREVIEW.id);
  const previewName = previewed?.msg || 'past version';
  box.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    <span class="hp-text">Previewing ${esc(previewName)} — canvas is read-only.</span>
    <button class="hp-exit" id="historyExitPreview">Exit preview</button>
    <button class="hp-revert" id="historyCommitRevert">Revert to this version</button>
  `;
  box.querySelector('#historyExitPreview')?.addEventListener('click', exitHistoryPreview);
  box.querySelector('#historyCommitRevert')?.addEventListener('click', commitHistoryPreview);
}

function saveHistorySnapshot(msg) {
  const hist = readJSON(KEY.history(ACTIVE_VID)) || [];
  const snapshot = {
    id: 'h_' + Date.now().toString(36),
    msg: typeof msg === 'string' ? msg : 'Manual snapshot',
    by: 'You', at: Date.now(),
    nodes: Canvas.getAllNodes().map(n => ({
      id: n.id, type: n.type, label: n.label || n.name, color: n.color, icon: n.icon,
      user: n.user, x: n.x, y: n.y,
      inputs:  (n.inputs  || []).map(p => ({ ...p })),
      outputs: (n.outputs || []).map(p => ({ ...p })),
      description: n.description, fn: n.fn, fw: n.fw, by: n.by,
      views: n.views, downloads: n.downloads,
    })),
    connections: Canvas.getConnections().map(c => Canvas.snapshotConnection(c)),
    subgraphs: getSubgraphSnapshot(),
  };
  hist.push(snapshot);
  writeJSON(KEY.history(ACTIVE_VID), hist);
  renderHistory();
  // Tutorial Step 20: notify when a history snapshot is saved.
  if (window.ConnectifyTutorial) {
    window.ConnectifyTutorial.notifyAction('snapshot-saved', { id: snapshot.id });
  }
}

// Preview a snapshot non-destructively: we save the live state so we can
// restore it if the user exits without committing. No new history entries
// are created. The canvas is visually marked as "in preview" so the user
// knows not to edit.
function startHistoryPreview(id) {
  const hist = readJSON(KEY.history(ACTIVE_VID)) || [];
  if (!hist.length) return;
  if (hist[hist.length - 1]?.id === id) { exitHistoryPreview(); return; }
  const target = hist.find(h => h.id === id);
  if (!target) return;
  // First time entering preview — snapshot the live state.
  if (!HIST_PREVIEW.id) {
    HIST_PREVIEW.savedState = captureCanvasState();
  }
  HIST_PREVIEW.id = id;
  paintCanvasFromSnapshot(target);
  document.body.classList.add('history-previewing');
  renderHistory();
}

function exitHistoryPreview() {
  if (!HIST_PREVIEW.id) return;
  if (HIST_PREVIEW.savedState) restoreCanvasState(HIST_PREVIEW.savedState);
  HIST_PREVIEW.id = null;
  HIST_PREVIEW.savedState = null;
  document.body.classList.remove('history-previewing');
  renderHistory();
}

// Commit the previewed snapshot: the live state is *already* the snapshot
// (we painted during preview), so we just drop the saved "live" state.
// This replaces the older multi-step revert; the act of reverting is a
// single canvas mutation captured by the session undo stack.
function commitHistoryPreview() {
  if (!HIST_PREVIEW.id) return;
  HIST_PREVIEW.id = null;
  HIST_PREVIEW.savedState = null;
  document.body.classList.remove('history-previewing');
  // Push a single undo snapshot so the revert is undoable via the normal
  // undo/redo stack (no new history list entry is created). We only call
  // if the undo-stack utilities exist (they're declared later in the
  // script but function declarations are hoisted).
  pushUndoSnapshot();
  snapshotActiveVariant();
  renderHistory();
}

function paintCanvasFromSnapshot(target) {
  // Suppress undo-stack writes while we rehydrate from the snapshot —
  // previewing a version shouldn't pollute the session undo history.
  HISTORY_APPLYING = true;
  try {
    Canvas.clear();
    const inner = Canvas.getCanvasInner();
    const P = window.PROJECT;
    inner.style.width  = (target.canvasWidth  || P.canvasWidth)  + 'px';
    inner.style.height = (target.canvasHeight || P.canvasHeight) + 'px';
    (target.nodes || []).forEach(n => Canvas.addNode({ ...n }));
    (target.connections || []).forEach(c => Canvas.addConnection(c.from, c.to));
    Canvas.drawEdges();
    initSubgraphFeature(target.subgraphs || []);
  } finally {
    HISTORY_APPLYING = false;
  }
}

function deleteHistoryVersion(id) {
  // If the deleted version is the one being previewed, exit preview first.
  if (HIST_PREVIEW.id === id) exitHistoryPreview();
  const hist = readJSON(KEY.history(ACTIVE_VID)) || [];
  const next = hist.filter(h => h.id !== id);
  writeJSON(KEY.history(ACTIVE_VID), next);
  renderHistory();
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000)      return 'just now';
  if (diff < 3_600_000)   return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000)  return Math.floor(diff / 3_600_000) + 'h ago';
  return Math.floor(diff / 86_400_000) + 'd ago';
}

/* ── Paths (draw mode + saved list) ────────────────────────
   Paths store an ordered list of node IDs (`nodeIds`) per variant.
   Draw mode UX mirrors the original modal version but now lives
   entirely inside the right-hand Paths drawer:

     1. User enters draw mode (via "+ new path", the path tool in
        the floating palette, or a per-node "Start path from here"
        kebab item).
     2. Eligible nodes get the `.path-candidate` class; ineligible
        ones get `.path-ineligible` and grey out. The hover rule
        only fires on candidates so you can "see what you'd click".
     3. Each click advances the chain. Direction is strictly
        downstream (output → input). Clicking the most-recent pick
        removes it; clicking an earlier pick shows a hint.
     4. After every pick the canvas auto-pans/zooms so the last
        pick + its candidates are on-screen with a little padding
        and reserved space for the drawer and topbar. */
const PATH_DRAW = {
  active: false,
  nodeIds: [],
  editingPathId: null,
  hintTimer: null,
};
/** Mousedown position for path picks — ignore click after a drag (e.g. node move). */
const PATH_PICK = { x: 0, y: 0, nodeId: null, armed: false };
let FOCUSED_PATH_ID = null; // drawer item currently highlighted on the canvas

function initPaths() {
  renderPaths();
}

/* ── Left nav rail (collapsed by default) ─────────────────
   Minimal rail; the "expand" state is persisted in localStorage so the
   user's preference sticks across sessions. Keeps parity with the
   original editing-mode.html navigation affordance. */
function initLeftNav(P) {
  const app = document.querySelector('.app');
  const toggle = document.getElementById('navToggle');
  const topbarToggle = document.getElementById('topbarMenuToggle');
  // Pre-paint script on <html> already applied state via data-leftnav; mirror it onto .app.
  if (document.documentElement.getAttribute('data-leftnav') === 'expanded') {
    app.classList.add('leftnav-expanded');
  }
  // During the guided tour the canvas opens with the leftnav collapsed so the
  // user starts with a clean, uncluttered workspace.
  if (typeof _tutorialActive === 'function' && _tutorialActive()) {
    app.classList.remove('leftnav-expanded');
    document.documentElement.removeAttribute('data-leftnav');
  }
  toggle?.addEventListener('click', () => {
    const expanded = app.classList.toggle('leftnav-expanded');
    try { localStorage.setItem('cfg.leftnav.expanded', expanded ? '1' : '0'); } catch (_) {}
    if (expanded) document.documentElement.setAttribute('data-leftnav', 'expanded');
    else document.documentElement.removeAttribute('data-leftnav');
  });
  topbarToggle?.addEventListener('click', () => toggle?.click());
  // Track the last graph opened in edit mode so the Edit nav link in the hub
  // can jump straight back to it.
  try {
    const slug = P?.slug || new URLSearchParams(location.search).get('project');
    if (slug) localStorage.setItem('cfg.lastEditedSlug', slug);
  } catch (_) {}
  const editLink = document.getElementById('navEditLink');
  if (editLink) {
    try {
      const last = localStorage.getItem('cfg.lastEditedSlug');
      if (last) editLink.href = `editing-mode-new.html?project=${encodeURIComponent(last)}`;
    } catch (_) {}
  }
  document.querySelectorAll('.nav-item-plus[data-new-graph-link]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const href = btn.getAttribute('data-new-graph-link');
      if (href) window.location.assign(href);
    });
  });
}

/* ── Role pill + dropdown (ported from old build) ──────────
   Three role states for the wireframe:
     - contributor (default, active edit access)
     - admin       (elevated — after approval)
     - view-mode   (navigates to view-mode-new.html)
   The "Request Admin" flow uses a dedicated modal and stashes a per-project
   "pending" flag in sessionStorage so the pill remembers the in-flight
   request if the user roundtrips through view mode. */
const ROLE_LABELS = { contributor: 'Contributor', admin: 'Admin' };
let currentRole      = 'contributor';
let adminRequestSent = false;

function initContribStatus(P) {
  const rolePillBtn  = document.getElementById('rolePillBtn');
  const roleDropdown = document.getElementById('roleDropdown');
  if (!rolePillBtn || !roleDropdown) return;
  const slug = new URLSearchParams(location.search).get('project');

  function updateRoleUI(role) {
    currentRole = role;
    const label = ROLE_LABELS[role] || role;
    const textEl = document.getElementById('rolePillText');
    if (textEl) textEl.textContent = label;
    rolePillBtn.title = `Role: ${label}`;
    rolePillBtn.setAttribute('aria-label', `Current role: ${label}. Open menu to change.`);
    document.querySelectorAll('#roleDropdown .role-opt').forEach(opt => {
      const r = opt.dataset.role;
      opt.classList.toggle('current', r === role);
      const existingCheck = opt.querySelector('.role-check');
      if (r === role && !existingCheck) {
        opt.querySelector('span.role-badge')?.remove();
        opt.insertAdjacentHTML('beforeend', `<svg class="role-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`);
      } else if (r !== role && existingCheck) {
        existingCheck.remove();
        // view-mode row never carries a badge; admin does.
        if (r === 'admin' && !opt.querySelector('.role-badge')) {
          opt.insertAdjacentHTML('beforeend', `<span class="role-badge">${ROLE_LABELS.admin}</span>`);
        }
      }
    });
  }

  rolePillBtn.addEventListener('click', e => {
    e.stopPropagation();
    const r = rolePillBtn.getBoundingClientRect();
    const open = roleDropdown.classList.contains('open');
    roleDropdown.classList.toggle('open', !open);
    if (!open) {
      const menuW = 220;
      let left = r.right - menuW;
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      roleDropdown.style.left = left + 'px';
      roleDropdown.style.top  = (r.bottom + 6) + 'px';
    }
  });
  document.addEventListener('click', () => roleDropdown.classList.remove('open'));
  roleDropdown.addEventListener('click', e => e.stopPropagation());

  document.getElementById('roleOptViewMode').addEventListener('click', () => {
    roleDropdown.classList.remove('open');
    window.location.href = 'view-mode-new.html?project=' + slug + '&mode=contributor';
  });

  document.getElementById('roleOptAdmin').addEventListener('click', () => {
    if (currentRole !== 'contributor') return;
    roleDropdown.classList.remove('open');
    openAdminRequestModal(P);
  });

  // ── Request Admin modal ──
  const requestAdminModal = document.getElementById('requestAdminModal');
  document.getElementById('requestAdminClose').addEventListener('click',  () => requestAdminModal.classList.remove('show'));
  document.getElementById('requestAdminCancel').addEventListener('click', () => requestAdminModal.classList.remove('show'));
  requestAdminModal.addEventListener('click', e => { if (e.target === requestAdminModal) requestAdminModal.classList.remove('show'); });

  function applyAdminPending() {
    adminRequestSent = true;
    const adminOpt = document.getElementById('roleOptAdmin');
    const badge = adminOpt.querySelector('.role-badge');
    if (badge) {
      badge.outerHTML = `<span class="role-badge" style="background:rgba(234,179,8,0.12);color:#a16207;border:1px solid rgba(234,179,8,0.3);">Pending</span>`;
    }
    adminOpt.style.pointerEvents = 'none';
  }

  document.getElementById('requestAdminSubmit').addEventListener('click', () => {
    requestAdminModal.classList.remove('show');
    document.getElementById('adminReasonInput').value = '';
    document.getElementById('adminScopeInput').value  = '';
    applyAdminPending();
    try { sessionStorage.setItem('adminRequestPending_' + slug, 'true'); } catch (_) {}
  });
  try {
    if (sessionStorage.getItem('adminRequestPending_' + slug) === 'true') applyAdminPending();
  } catch (_) {}

  // ── Permissions info modal ──
  const permsModal = document.getElementById('permsModal');
  const PERMS = {
    contributor: {
      title: 'Contributor — your current permissions',
      items: [
        'Add, edit, and delete nodes on the canvas',
        'Create and remove connections between nodes',
        'Push local changes to the public graph for review',
        'Rename your own nodes and edit their metadata',
        'Browse all node details, inputs, and outputs',
      ],
    },
    admin: {
      title: 'Admin — your current permissions',
      items: [
        'Everything in Contributor',
        'Add and remove contributors from the project',
        'Merge and approve pushed changes',
        'Edit or delete any node or connection',
        'Rename the project and update its description and tags',
        'Archive or lock the project',
      ],
    },
  };

  document.getElementById('rolePermsLink').addEventListener('click', () => {
    roleDropdown.classList.remove('open');
    const info = PERMS[currentRole] || PERMS.contributor;
    document.getElementById('permsModalTitle').textContent = info.title;
    document.getElementById('permsModalBody').innerHTML =
      `<ul style="padding-left:18px;margin:0;display:flex;flex-direction:column;gap:7px;">${info.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    permsModal.classList.add('show');
  });
  document.getElementById('permsClose').addEventListener('click', () => permsModal.classList.remove('show'));
  permsModal.addEventListener('click', e => { if (e.target === permsModal) permsModal.classList.remove('show'); });

  updateRoleUI('contributor');
}

// Populate the Request-Admin modal with the project's owners/admins as
// recipients. Exposed outside initContribStatus because it reads from
// window.PROJECT which is guaranteed to be present when opened.
function openAdminRequestModal(P) {
  P = P || window.PROJECT || {};
  const owners = (P.contributors || []).filter(c => c.role === 'Owner' || c.role === 'Admin');
  const names  = owners.length
    ? owners.map(c => c.name).join(', ')
    : (P.contributors && P.contributors[0] && P.contributors[0].name) || 'project owners';
  document.getElementById('adminRecipientNames').textContent = names;
  document.getElementById('requestAdminModal').classList.add('show');
}

/* ── Floating tool palette ─────────────────────────────────
   Minimal set after the consolidation:
   - "+" (tool-primary) opens Discover in the left drawer — single entry
     point to add any content (models/datasets/logic).
   - select/pan is the default cursor state (V)
   - group marquee: drag on empty canvas to box-select; ⌘/Ctrl+G to group
   - comment enters comment-drop mode (C)
   - path enters path-draw mode (P)
   Discover no longer has a dedicated pill; the "+" tool *is* the pill. */
function initToolPalette() {
  // Select / pan — re-sets the active state and exits other modes.
  document.querySelector('[data-tool="select"]')?.addEventListener('click', () => {
    if (PATH_DRAW.active) pathDrawCancel();
    if (COMMENTS.dropping) stopCommentDrop();
    setPaletteTool('select');
  });

  document.getElementById('toolSubgraphMarquee')?.addEventListener('click', () => {
    if (PATH_DRAW.active) pathDrawCancel();
    if (COMMENTS.dropping) stopCommentDrop();
    setPaletteTool('subgraph-marquee');
  });

  // Comment tool toggles comment-drop mode.
  const tc = document.getElementById('toolComment');
  tc?.addEventListener('click', () => {
    if (COMMENTS.dropping) { stopCommentDrop(); return; }
    startCommentDrop();
    setPaletteTool('comment');
  });

  // Keyboard shortcuts (V / M / C / P / N). N toggles Discover like the + tool.
  document.addEventListener('keydown', (e) => {
    // Don't swallow shortcuts while typing in inputs / content-editables.
    const t = e.target;
    if (t && (t.matches('input, textarea, [contenteditable="true"]'))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'n') {
      e.preventDefault();
      if (PATH_DRAW.active) pathDrawCancel();
      if (COMMENTS.dropping) stopCommentDrop();
      document.getElementById('toolDiscover')?.click();
      return;
    }
    if (key === 'v') {
      setPaletteTool('select');
      if (PATH_DRAW.active) pathDrawCancel();
      if (COMMENTS.dropping) stopCommentDrop();
    }
    if (key === 'm') {
      if (PATH_DRAW.active) pathDrawCancel();
      if (COMMENTS.dropping) stopCommentDrop();
      setPaletteTool('subgraph-marquee');
    }
    if (key === 'c') tc?.click();
    if (key === 'p') document.querySelector('[data-tool="path"]')?.click();
  });
}

function pathDrawStart(opts) {
  opts = opts || {};
  if (PATH_DRAW.active) pathDrawCancel(); // re-entry resets state
  PATH_DRAW.active = true;
  PATH_DRAW.nodeIds = Array.isArray(opts.seedIds) ? opts.seedIds.filter(id => Canvas.getNode(id)) : [];
  PATH_DRAW.editingPathId = opts.editingPathId || null;
  document.body.classList.add('building-path');
  clearFocusedPath();
  const rightEl = document.getElementById('drawerRight');
  rightEl.classList.add('open');
  rightEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'paths'));
  rightEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelPaths'));
  document.querySelectorAll('.tb-toggle[data-side="right"]').forEach(t => t.classList.toggle('active', t.dataset.tab === 'paths'));
  setPaletteTool('path');
  attachPathClickCapture();
  renderPaths();
  applyPathHighlights();
  if (PATH_DRAW.nodeIds.length) {
    if (PATH_DRAW.editingPathId) fitPathNodes(PATH_DRAW.nodeIds);
    else fitAroundSelection();
  }
}

function pathDrawCancel() {
  PATH_DRAW.active = false;
  PATH_DRAW.nodeIds = [];
  PATH_DRAW.editingPathId = null;
  document.body.classList.remove('building-path');
  setPaletteTool('select');
  detachPathClickCapture();
  clearPathHighlights();
  renderPaths();
}

// Downstream neighbors of a node: nodes whose inputs connect to this
// node's outputs. This defines "eligible next pick" in draw mode.
function downstreamOf(id) {
  const out = new Set();
  Canvas.getConnections().forEach(c => {
    if (c.from[0] === id && c.to[0] !== id) out.add(c.to[0]);
  });
  return out;
}

// Capture-phase click: intercept before Canvas's own node-item listener
// so we can claim the event regardless of where inside the card the
// user clicked. Kebab and port handles are let through.
function onPathPointerDownCapture(e) {
  if (e.button !== 0 || !PATH_DRAW.active) return;
  const nodeEl = e.target.closest('.node');
  if (!nodeEl) {
    PATH_PICK.armed = false;
    return;
  }
  if (e.target.closest('.menu-dots')) return;
  if (e.target.closest('.port-anchor')) return;
  if (e.target.closest('.node-section')) return;
  if (e.target.closest('.node-item')) return;
  const id = nodeEl.dataset.nodeId;
  if (!id) return;
  PATH_PICK.armed = true;
  PATH_PICK.x = e.clientX;
  PATH_PICK.y = e.clientY;
  PATH_PICK.nodeId = id;
}
function onPathClickCapture(e) {
  const nodeEl = e.target.closest('.node');
  if (!nodeEl) return;
  if (e.target.closest('.menu-dots'))   return;
  if (e.target.closest('.port-anchor')) return;
  if (e.target.closest('.node-section')) return;
  if (e.target.closest('.node-item'))    return;
  const id = nodeEl.dataset.nodeId;
  if (!id) return;
  if (PATH_PICK.armed && PATH_PICK.nodeId === id) {
    const d = Math.hypot(e.clientX - PATH_PICK.x, e.clientY - PATH_PICK.y);
    if (d > 8) {
      PATH_PICK.armed = false;
      return;
    }
  }
  PATH_PICK.armed = false;
  e.stopPropagation();
  e.preventDefault();
  handlePathPick(id);
}
function attachPathClickCapture() {
  const inner = Canvas.getCanvasInner();
  inner.addEventListener('mousedown', onPathPointerDownCapture, true);
  inner.addEventListener('click', onPathClickCapture, true);
}
function detachPathClickCapture() {
  const inner = Canvas.getCanvasInner();
  inner.removeEventListener('mousedown', onPathPointerDownCapture, true);
  inner.removeEventListener('click', onPathClickCapture, true);
  PATH_PICK.armed = false;
}

function handlePathPick(id) {
  if (!PATH_DRAW.active) return;
  const ids = PATH_DRAW.nodeIds;
  const lastIdx = ids.length - 1;
  const existingIdx = ids.indexOf(id);

  if (existingIdx >= 0) {
    if (existingIdx === lastIdx) {
      ids.pop();
      setPathHint(ids.length
        ? 'Removed. Pick a downstream node, or hit Save.'
        : 'Removed. Click a node to start again.');
    } else {
      setPathHint('Only the most recently added node can be removed.', true);
      return;
    }
  } else if (ids.length === 0) {
    ids.push(id);
    setPathHint('Pick a downstream node to extend the path.');
  } else {
    const last = ids[lastIdx];
    const down = downstreamOf(last);
    if (!down.has(id)) {
      const lastName = (Canvas.getNode(last)?.label) || (Canvas.getNode(last)?.name) || last;
      setPathHint(`“${lastName}” doesn’t feed into that node.`, true);
      return;
    }
    ids.push(id);
    setPathHint('Keep going downstream, or hit Save when you’re done.');
  }
  // Slice 3 — if the newest pick is an End-marked node (manual or auto)
  // and the path has at least 2 nodes, nudge the user toward saving.
  // Doesn't force-save (user may want to extend past the marker).
  if (ids.length >= 2 && typeof nodeHasRole === 'function') {
    const head = ids[ids.length - 1];
    if (nodeHasRole(head, 'end')) {
      const headName = (Canvas.getNode(head)?.label) || (Canvas.getNode(head)?.name) || head;
      setPathHint(`Reached “${headName}” (End node). Save when ready, or keep going.`);
    }
  }
  renderPaths();
  applyPathHighlights();
  fitAroundSelection();
  // Tutorial Step 6: advance the highlight to the next node in the suggested
  // path so guidance stays one step ahead of the user's clicks.
  if (window._tutorialPathStepActive && window.TutorialHooks) {
    window.TutorialHooks.markPathTargets();
  }
  // Notify each time the path grows so the step can advance once enough nodes
  // are chained (guard checks ctx.count).
  if (window.ConnectifyTutorial) {
    window.ConnectifyTutorial.notifyAction('path-node-picked', { count: PATH_DRAW.nodeIds.length });
  }
}

function pathDrawUndo() {
  if (!PATH_DRAW.nodeIds.length) return;
  PATH_DRAW.nodeIds.pop();
  renderPaths();
  applyPathHighlights();
  if (PATH_DRAW.nodeIds.length) fitAroundSelection();
}

function pathDrawSave() {
  if (PATH_DRAW.nodeIds.length < 2) return;
  const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];
  let savedPathId = PATH_DRAW.editingPathId;
  if (PATH_DRAW.editingPathId) {
    const existing = paths.find(p => p.id === PATH_DRAW.editingPathId);
    if (existing) {
      existing.nodeIds = [...PATH_DRAW.nodeIds];
      // Legacy field — keep in sync so view mode can still read it.
      existing.nodes = [...PATH_DRAW.nodeIds];
      savedPathId = existing.id;
    }
  } else {
    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    paths.push({
      id,
      name: 'Path ' + (paths.length + 1),
      nodeIds: [...PATH_DRAW.nodeIds],
      nodes: [...PATH_DRAW.nodeIds],
      author: 'You',
      createdAt: Date.now(),
    });
    savedPathId = id;
  }
  writeJSON(KEY.paths(ACTIVE_VID), paths);
  pathDrawCancel();
  if (savedPathId) {
    // Show drawer highlight immediately, then re-apply full focus after
    // the post-cancel render cycle settles.
    FOCUSED_PATH_ID = savedPathId;
    renderPaths();
    requestAnimationFrame(() => focusSavedPath(savedPathId));
  }
  // Tutorial Step 12: notify that a path was saved.
  if (window.ConnectifyTutorial) {
    window.ConnectifyTutorial.notifyAction('path-saved', { pathId: savedPathId });
  }
}

// Three-state canvas highlighting — see CSS for visuals.
function applyPathHighlights() {
  const inner = Canvas.getCanvasInner();
  if (!inner) return;
  inner.querySelectorAll('.node').forEach(el => {
    el.classList.remove('path-selected', 'path-ineligible', 'path-candidate');
    el.removeAttribute('data-path-idx');
  });
  const ids = PATH_DRAW.nodeIds;
  ids.forEach((id, i) => {
    const el = inner.querySelector(`.node[data-node-id="${CSS.escape(id)}"]`);
    if (el) {
      el.classList.add('path-selected');
      el.setAttribute('data-path-idx', i + 1);
    }
  });
  if (ids.length === 0) {
    // Any node is a valid first pick.
    inner.querySelectorAll('.node').forEach(el => el.classList.add('path-candidate'));
    return;
  }
  const eligible = downstreamOf(ids[ids.length - 1]);
  inner.querySelectorAll('.node').forEach(el => {
    const nid = el.dataset.nodeId;
    if (!nid || ids.includes(nid)) return;
    if (eligible.has(nid)) el.classList.add('path-candidate');
    else                   el.classList.add('path-ineligible');
  });
}

function clearPathHighlights() {
  const inner = Canvas.getCanvasInner();
  if (!inner) return;
  inner.querySelectorAll('.node').forEach(el => {
    el.classList.remove('path-selected', 'path-ineligible', 'path-candidate');
    el.removeAttribute('data-path-idx');
  });
}

// Auto pan/zoom around the most-recent pick + its candidates. Reserves
// space for the right drawer (if open) and the topbar/variant strip so
// nodes aren't obscured. Zoom is maxed without crowding the edge of the
// viewport (padding: 40px).
function fitAroundSelection() {
  const ids = PATH_DRAW.nodeIds;
  if (!ids.length) return;
  const recent = ids.length > 5 ? ids.slice(-5) : ids.slice();
  const last = ids[ids.length - 1];
  const nextCandidates = Array.from(downstreamOf(last)).filter(id => !ids.includes(id));
  const focusIds = [...new Set([...recent, ...nextCandidates])];
  const rightEl = document.getElementById('drawerRight');
  const leftEl  = document.getElementById('drawerLeft');
  Canvas.fitToNodes(focusIds, {
    padding: 40,
    reserve: {
      top:    10,
      bottom: 10,
      left:   leftEl?.classList.contains('open') ? 0 : 60,
      right:  rightEl?.classList.contains('open') ? 0 : 20,
    },
    maxZoom: 2.0,
    minZoom: 0.3,
    animate: true,
  });
}

function fitPathNodes(ids) {
  const validIds = (ids || []).filter(id => Canvas.getNode(id));
  if (!validIds.length) return;
  const rightEl = document.getElementById('drawerRight');
  const leftEl  = document.getElementById('drawerLeft');
  Canvas.fitToNodes(validIds, {
    padding: 40,
    reserve: {
      top:    10,
      bottom: 10,
      left:   leftEl?.classList.contains('open') ? 0 : 60,
      right:  rightEl?.classList.contains('open') ? 0 : 20,
    },
    maxZoom: 2.0,
    minZoom: 0.3,
    animate: false,
  });
}

function setPathHint(text, isError) {
  const els = document.querySelectorAll('[data-path-hint]');
  if (!els.length) return;
  els.forEach(el => {
    el.textContent = text;
    el.classList.toggle('error', !!isError);
  });
  if (PATH_DRAW.hintTimer) { clearTimeout(PATH_DRAW.hintTimer); PATH_DRAW.hintTimer = null; }
  if (isError) {
    PATH_DRAW.hintTimer = setTimeout(() => {
      const hint = PATH_DRAW.nodeIds.length
        ? 'Pick the next downstream node, or hit Save.'
        : 'Click a node to start.';
      document.querySelectorAll('[data-path-hint]').forEach(el => {
        el.classList.remove('error');
        el.textContent = hint;
      });
    }, 2200);
  }
}

function wirePathDrawBanner(root) {
  if (!root) return;
  root.querySelectorAll('[data-pd-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.pdAct;
      if (a === 'cancel') pathDrawCancel();
      else if (a === 'undo') pathDrawUndo();
      else if (a === 'save') pathDrawSave();
    });
  });
}

function syncPathDrawFloatOverlay() {
  const fo = document.getElementById('pathDrawFloatOverlay');
  if (!fo) return;
  if (!PATH_DRAW.active) {
    fo.hidden = true;
    fo.innerHTML = '';
    return;
  }
  const rightEl = document.getElementById('drawerRight');
  const pathsOpen = rightEl?.classList.contains('open')
    && document.getElementById('panelPaths')?.classList.contains('active');
  if (pathsOpen) {
    fo.hidden = true;
    fo.innerHTML = '';
    return;
  }
  fo.hidden = false;
  fo.innerHTML = renderPathDrawBanner();
  wirePathDrawBanner(fo);
}

function renderPaths() {
  document.querySelector('.path-confirm-pop')?._cleanup?.();
  const panel = document.getElementById('panelPaths');
  if (!panel) return;
  const newBtn = document.getElementById('pathsNewBtn');
  const drawHost = document.getElementById('pathsDrawHost');
  const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];

  // Normalize legacy records that used `nodes` instead of `nodeIds`.
  paths.forEach(p => { if (!p.nodeIds && p.nodes) p.nodeIds = p.nodes; });

  // Pinned chrome lives outside the scroll list: the New-path button when idle,
  // the draw banner (Cancel/Undo/Save) when actively tracing.
  if (newBtn) newBtn.hidden = PATH_DRAW.active;
  if (drawHost) {
    drawHost.innerHTML = PATH_DRAW.active ? renderPathDrawBanner() : '';
    if (PATH_DRAW.active) wirePathDrawBanner(drawHost);
  }

  const list = paths.length ? paths.map(p => renderPathItem(p)).join('') : (PATH_DRAW.active ? '' : `
    <div class="empty-state" style="padding:24px 14px;text-align:center;color:var(--text-muted);font-size:12.5px;">
      No saved paths yet. Click "New path" to trace a subgraph.
    </div>`);

  panel.innerHTML = list;
  panel.querySelectorAll('.path-item').forEach(item => wirePathItem(item));
  syncPathDrawFloatOverlay();
}

function renderPathDrawBanner() {
  const ids = PATH_DRAW.nodeIds;
  const hint = ids.length
    ? (ids.length >= 2 ? 'Pick the next downstream node, or hit Save.' : 'Pick a downstream node to extend the path.')
    : 'Click a node to start. Paths flow in the direction of data: output → input.';
  const chainHtml = ids.length
    ? `<div class="path-draw-chain">${ids.map((id, i) => {
        const n = Canvas.getNode(id);
        const name = n?.label || n?.name || id;
        const arrow = i > 0 ? `<span class="pd-arrow">→</span>` : '';
        return `${arrow}<span class="pd-step"><span class="pd-step-idx">${i+1}</span>${esc(name)}</span>`;
      }).join('')}</div>`
    : '';
  return `
    <div class="path-draw-banner">
      <div class="title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5C10 13 14 11 17.5 6.5" stroke-dasharray="3 3"/></svg>
        ${PATH_DRAW.editingPathId ? 'Editing path' : 'Drawing path'} · ${ids.length} node${ids.length === 1 ? '' : 's'}
      </div>
      <div class="path-draw-hint" data-path-hint>${esc(hint)}</div>
      ${chainHtml}
      <div class="path-draw-actions">
        <button type="button" data-pd-act="cancel">Cancel</button>
        <button type="button" data-pd-act="undo" ${ids.length ? '' : 'disabled'}>Undo</button>
        <button type="button" class="primary" data-pd-act="save" ${ids.length >= 2 ? '' : 'disabled'}>Save</button>
      </div>
    </div>`;
}

function renderPathItem(p) {
  const nodeIds = p.nodeIds || p.nodes || [];
  const pathRunCount = (readJSON(KEY.runs(ACTIVE_VID)) || []).filter(r => r.pathId === p.id).length;
  const MAX_PREVIEW = 3;
  const previewIds = nodeIds.slice(0, MAX_PREVIEW);
  const chainPills = previewIds.map((id, i) => {
    const n = Canvas.getNode(id);
    const name = n?.label || n?.name || id;
    const arrow = i > 0 ? `<span class="pd-arrow">→</span>` : '';
    return `${arrow}<span class="pd-pill">${esc(name)}</span>`;
  }).join('');
  const more = nodeIds.length - previewIds.length;
  const tail = more > 0 ? `<span class="pd-arrow">→</span><span class="pd-pill">+${more}</span>` : '';
  const focused = FOCUSED_PATH_ID === p.id ? ' focused' : '';
  // Slice 3 — end-to-end chip: shown when path starts at a Start-marked node
  // AND ends at an End-marked node. Tells the user at a glance "this path
  // covers your full data flow." Uses the same nodeHasRole check as the
  // draw-mode hint so manual and auto marks both count.
  const startsAtMarked = nodeIds.length >= 2
    && typeof nodeHasRole === 'function'
    && nodeHasRole(nodeIds[0], 'start');
  const endsAtMarked = nodeIds.length >= 2
    && typeof nodeHasRole === 'function'
    && nodeHasRole(nodeIds[nodeIds.length - 1], 'end');
  const endToEndChip = (startsAtMarked && endsAtMarked)
    ? `<span class="path-end-to-end-chip" title="Path covers a marked Start to a marked End"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><polyline points="20 6 9 17 4 12"/></svg>end-to-end</span>`
    : '';
  return `
    <div class="path-item${focused}" data-id="${p.id}">
      <div class="path-item-top">
        <div class="t" data-act="rename-inline" role="button" tabindex="0" title="Click to rename">${esc(p.name)}</div>
        ${endToEndChip}
      </div>
      <div class="path-item-chain">${chainPills}${tail}</div>
      <div class="path-item-foot">
        <div class="m">${nodeIds.length} node${nodeIds.length === 1 ? '' : 's'}${pathRunCount ? ` · ${pathRunCount} run${pathRunCount === 1 ? '' : 's'}` : ''}</div>
        <div class="path-item-actions">
          <button data-act="edit" title="Edit path"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button data-act="extract" title="Extract to variant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
          <button data-act="duplicate" title="Duplicate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="danger" data-act="delete" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
        </div>
      </div>
      <button class="path-item-run" data-act="run">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
        Run experiment
      </button>
    </div>`;
}

function wirePathItem(item) {
  const id = item.dataset.id;
  // Click on the row body focuses the path (pans/zooms + highlights).
  item.addEventListener('click', e => {
    // Don't trigger focus for button clicks or rename edits.
    if (e.target.closest('button') || e.target.closest('[contenteditable="true"]')) return;
    focusSavedPath(id);
  });
  item.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', e => {
    if (b.isContentEditable) return;
    e.stopPropagation();
    handlePathAction(id, b.dataset.act, b);
  }));
  const renameEl = item.querySelector('[data-act="rename-inline"]');
  if (renameEl) {
    renameEl.addEventListener('click', e => {
      e.stopPropagation();
      startInlineRename(id, renameEl);
    });
    renameEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (renameEl.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      startInlineRename(id, renameEl);
    });
  }
}

function startInlinePathDelete(pathId, btnEl) {
  const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];
  const p = paths.find(x => x.id === pathId);
  if (!p || !btnEl) return;
  const existing = document.querySelector('.path-confirm-pop');
  if (existing) {
    const same = existing.dataset.pathId === pathId;
    existing._cleanup?.();
    if (same) return;
  }

  const pop = document.createElement('div');
  pop.className = 'variant-confirm-pop path-confirm-pop';
  pop.dataset.pathId = pathId;
  pop.innerHTML = `
    <div class="pop-msg">Delete <strong>${esc(p.name)}</strong>?</div>
    <div class="pop-actions">
      <button type="button" class="pop-no">Cancel</button>
      <button type="button" class="pop-yes">Delete</button>
    </div>`;
  document.body.appendChild(pop);

  const r = btnEl.getBoundingClientRect();
  const popW = pop.offsetWidth;
  let left = r.right - popW;
  left = Math.min(Math.max(left, 8), window.innerWidth - popW - 8);
  pop.style.left = left + 'px';
  pop.style.top  = (r.bottom + 6) + 'px';

  const cleanup = () => {
    pop.remove();
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey);
  };
  pop._cleanup = cleanup;

  const doDelete = () => {
    const all = readJSON(KEY.paths(ACTIVE_VID)) || [];
    writeJSON(KEY.paths(ACTIVE_VID), all.filter(x => x.id !== pathId));
    if (FOCUSED_PATH_ID === pathId) clearFocusedPath();
    cleanup();
    renderPaths();
  };
  const onDoc = (e) => {
    if (pop.contains(e.target) || btnEl.contains(e.target)) return;
    cleanup();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    if (e.key === 'Enter')  { e.preventDefault(); doDelete(); }
  };
  pop.querySelector('.pop-yes').addEventListener('click', doDelete);
  pop.querySelector('.pop-no').addEventListener('click', cleanup);
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  document.addEventListener('keydown', onKey);
}

function startInlinePathExtract(pathId, btnEl) {
  const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];
  const p = paths.find(x => x.id === pathId);
  if (!p || !btnEl) return;
  const existing = document.querySelector('.path-confirm-pop');
  if (existing) {
    const same = existing.dataset.pathId === pathId && existing.dataset.mode === 'extract';
    existing._cleanup?.();
    if (same) return;
  }

  const pop = document.createElement('div');
  pop.className = 'variant-confirm-pop path-confirm-pop extract';
  pop.dataset.pathId = pathId;
  pop.dataset.mode = 'extract';
  pop.innerHTML = `
    <div class="pop-msg">Extract <strong>${esc(p.name)}</strong> to new variant?</div>
    <div class="pop-actions">
      <button type="button" class="pop-no">Cancel</button>
      <button type="button" class="pop-yes">Confirm</button>
    </div>`;
  document.body.appendChild(pop);

  const r = btnEl.getBoundingClientRect();
  const popW = pop.offsetWidth;
  let left = r.right - popW;
  left = Math.min(Math.max(left, 8), window.innerWidth - popW - 8);
  const tailLeft = Math.min(Math.max((r.left + r.width / 2) - left - 5, 10), popW - 18);
  pop.style.setProperty('--pop-tail-left', `${tailLeft}px`);
  pop.style.left = left + 'px';
  pop.style.top  = (r.bottom + 6) + 'px';

  const cleanup = () => {
    pop.remove();
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey);
  };
  pop._cleanup = cleanup;

  const doExtract = () => {
    cleanup();
    extractPathToVariant(pathId, { includeDependencies: false });
  };
  const onDoc = (e) => {
    if (pop.contains(e.target) || btnEl.contains(e.target)) return;
    cleanup();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    if (e.key === 'Enter')  { e.preventDefault(); doExtract(); }
  };
  pop.querySelector('.pop-yes').addEventListener('click', doExtract);
  pop.querySelector('.pop-no').addEventListener('click', cleanup);
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  document.addEventListener('keydown', onKey);
}

function handlePathAction(pathId, act, btnEl) {
  const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];
  const p = paths.find(x => x.id === pathId);
  if (!p) return;
  if (act === 'delete') {
    startInlinePathDelete(pathId, btnEl);
  } else if (act === 'duplicate') {
    const copy = {
      ...p,
      id: 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      name: p.name + ' (copy)',
      createdAt: Date.now(),
      nodeIds: [...(p.nodeIds || p.nodes || [])],
      nodes:   [...(p.nodeIds || p.nodes || [])],
    };
    const idx = paths.findIndex(x => x.id === pathId);
    paths.splice(idx + 1, 0, copy);
    writeJSON(KEY.paths(ACTIVE_VID), paths);
    renderPaths();
  } else if (act === 'edit') {
    pathDrawStart({ seedIds: (p.nodeIds || p.nodes || []).slice(), editingPathId: p.id });
  } else if (act === 'extract') {
    startInlinePathExtract(p.id, btnEl);
  } else if (act === 'rename-inline') {
    startInlineRename(pathId, btnEl);
  } else if (act === 'run') {
    startRun({
      pathId: p.id,
      pathName: p.name,
      pathNodeIds: (p.nodeIds || p.nodes || []).slice(),
    });
    document.getElementById('bottomPanel')?.classList.add('open');
    document.getElementById('tglRuns')?.classList.add('active');
    syncBpAppShell();
  }
}

function extractPathToVariant(pathId, opts) {
  opts = opts || {};
  const includeDependencies = opts.includeDependencies !== false;
  snapshotActiveVariant();
  const variants = readJSON(KEY.variants) || [];
  const active = variants.find(v => v.id === ACTIVE_VID);
  if (!active) return;
  const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];
  const p = paths.find(x => x.id === pathId);
  if (!p) return;
  const pathIds = (p.nodeIds || p.nodes || []).filter(id => active.nodes?.some(n => n.id === id));
  if (!pathIds.length) return;

  const keep = new Set(pathIds);
  const conns = active.connections || [];
  if (includeDependencies) {
    let changed = true;
    while (changed) {
      changed = false;
      conns.forEach(c => {
        const from = c?.from?.[0], to = c?.to?.[0];
        if (!from || !to) return;
        if (!keep.has(to) || keep.has(from)) return;
        keep.add(from);
        changed = true;
      });
    }
  }

  const keptNodes = (active.nodes || [])
    .filter(n => keep.has(n.id))
    .map(n => ({ ...n, inputs: (n.inputs || []).map(i => ({ ...i })), outputs: (n.outputs || []).map(o => ({ ...o })) }));
  const keptConns = conns
    .filter(c => keep.has(c?.from?.[0]) && keep.has(c?.to?.[0]))
    .map(c => Canvas.snapshotConnection(c));
  const keptSubgraphs = _cloneSubgraphs((active.subgraphs || []).map(g => ({
    ...g,
    nodeIds: (g.nodeIds || []).filter(id => keep.has(id)),
  }))).filter(g => g.nodeIds.length >= 1);
  if (!keptNodes.length) return;

  const newId = 'v' + (variants.length + 1) + '_' + Date.now().toString(36).slice(-4);
  const baseName = `${p.name} (extracted)`;
  const taken = new Set(variants.map(v => (v.name || '').toLowerCase()));
  let name = baseName;
  let i = 2;
  while (taken.has(name.toLowerCase())) {
    name = `${baseName} ${i}`;
    i += 1;
  }
  variants.push({
    id: newId,
    name,
    createdAt: Date.now(),
    nodes: keptNodes,
    connections: keptConns,
    subgraphs: keptSubgraphs,
    canvasWidth: active.canvasWidth || window.PROJECT?.canvasWidth,
    canvasHeight: active.canvasHeight || window.PROJECT?.canvasHeight,
  });
  writeJSON(KEY.variants, variants);

  const extractedPathId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  writeJSON(KEY.paths(newId), [{
    id: extractedPathId,
    name: p.name,
    nodeIds: [...pathIds],
    nodes: [...pathIds],
    author: 'You',
    createdAt: Date.now(),
  }]);

  switchVariant(newId);
  requestAnimationFrame(() => focusSavedPath(extractedPathId));
}

function startInlineRename(pathId, nameEl) {
  if (!nameEl) return;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  // Select-all for faster rename.
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const commit = () => {
    nameEl.contentEditable = 'false';
    const name = (nameEl.textContent || '').trim() || 'Untitled path';
    const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];
    const p = paths.find(x => x.id === pathId);
    if (p) { p.name = name; writeJSON(KEY.paths(ACTIVE_VID), paths); }
    nameEl.removeEventListener('blur', commit);
    nameEl.removeEventListener('keydown', onKey);
    renderPaths();
  };
  const onKey = e => {
    if (e.key === ' ') {
      // While editing inside a <button>, Space can synthesize a click that
      // restarts rename/select-all. Stop bubbling; let the space character
      // insert normally.
      e.stopPropagation();
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    if (e.key === 'Escape') { nameEl.textContent = nameEl.dataset.origName || nameEl.textContent; nameEl.blur(); }
  };
  nameEl.dataset.origName = nameEl.textContent;
  nameEl.addEventListener('blur', commit);
  nameEl.addEventListener('keydown', onKey);
}

function focusSavedPath(pathId) {
  const paths = readJSON(KEY.paths(ACTIVE_VID)) || [];
  const p = paths.find(x => x.id === pathId);
  if (!p) return false;
  FOCUSED_PATH_ID = pathId;
  const ids = (p.nodeIds || p.nodes || []).filter(id => Canvas.getNode(id));
  if (ids.length) {
    const rightEl = document.getElementById('drawerRight');
    const leftEl  = document.getElementById('drawerLeft');
    Canvas.fitToNodes(ids, {
      padding: 40,
      reserve: {
        top: 10, bottom: 10,
        left:  leftEl?.classList.contains('open')  ? 0 : 60,
        right: rightEl?.classList.contains('open') ? 0 : 20,
      },
      maxZoom: 1.5, minZoom: 0.3,
    });
    const set = new Set(ids);
    document.querySelectorAll('.node').forEach(el => {
      el.classList.remove('path-highlight', 'path-dim', 'path-selected', 'path-ineligible', 'path-candidate');
      el.removeAttribute('data-path-idx');
      const nid = el.dataset.nodeId;
      if (!nid || !set.has(nid)) return;
      el.classList.add('path-selected');
      el.setAttribute('data-path-idx', (ids.indexOf(nid) + 1).toString());
    });
  } else {
    clearPathHighlights();
  }
  renderPaths();
  return true;
}

function clearFocusedPath() {
  FOCUSED_PATH_ID = null;
  document.querySelectorAll('.node.path-highlight, .node.path-dim, .node.path-selected, .node.path-ineligible, .node.path-candidate').forEach(el => {
    el.classList.remove('path-highlight', 'path-dim', 'path-selected', 'path-ineligible', 'path-candidate');
    el.removeAttribute('data-path-idx');
  });
}

/* ── Comments ────────────────────────────────────────────────
   Full-featured port of the old build's comment system:
   - Canvas-anchored cards with per-author theming (CSS vars cmt-bg /
     cmt-border / cmt-accent / cmt-accent-deep).
   - Comment tool enters placement mode: a ghost follows the cursor; a
     click on the canvas opens the compose modal which captures text +
     tags.
   - Cards are draggable by their header (world coords scale with zoom).
   - Cards support collapse, edit, delete, and threaded replies.
   - Right-drawer Comments tab is an inbox that mirrors + links back to
     the card.

   `COMMENTS.items[i]` shape:
     { id, x, y, text, tags[], collapsed, replies[],
       author: { name, letter, color, colorDeep, bg, border }, at } */
const COMMENTS = {
  dropping: false,
  ghostEl: null,
  editState: null, // { mode: 'create'|'edit', x, y, id?, tags: [] }
  items: [],
};
// Stand-in for real auth. Every comment/reply is attributed to this user
// for now; swap these values in when session is wired up. Matches the
// "Guest" identity shown elsewhere in the leftnav user tab.
const CURRENT_USER = {
  name: 'Guest', letter: 'G',
  color: '#3b82f6', colorDeep: '#1e40af',
  bg: '#eff6ff', border: '#bfdbfe'
};
const COMMENT_THEME = {
  bg: '#f5f8fc',
  border: '#d8e3ef',
  accent: '#7ca3c8',
  accentDeep: '#3f5f7e',
};
const COMMENT_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

function _nextCommentId() { return 'cmt-' + Date.now() + '-' + Math.floor(Math.random() * 10000); }
function _relTime(ms) {
  const d = Date.now() - ms;
  if (d < 60000) return 'just now';
  if (d < 3600000) return Math.round(d / 60000) + 'm ago';
  if (d < 86400000) return Math.round(d / 3600000) + 'h ago';
  return Math.round(d / 86400000) + 'd ago';
}

function initComments() {
  _wireCommentModal();
  renderCommentsDrawer();
  renderCommentCards();
  if (!COMMENTS.dismissWired) {
    COMMENTS.dismissWired = true;
    document.addEventListener('mousedown', e => {
      if (e.target.closest('.comment-card')) return;
      setPinnedComment(null);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') setPinnedComment(null);
    });
  }
}

function getCanvasOcclusionReserve() {
  const canvasArea = document.getElementById('canvasArea');
  if (!canvasArea) return { left: 0, right: 0, top: 0, bottom: 0 };
  const cr = canvasArea.getBoundingClientRect();
  const reserve = { left: 0, right: 0, top: 0, bottom: 0 };
  ['drawerLeft', 'drawerRight'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains('open')) return;
    const r = el.getBoundingClientRect();
    const overlapW = Math.max(0, Math.min(cr.right, r.right) - Math.max(cr.left, r.left));
    const overlapH = Math.max(0, Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top));
    if (overlapW <= 0 || overlapH <= 0) return;
    if (r.left <= cr.left + 1) reserve.left = Math.max(reserve.left, overlapW);
    if (r.right >= cr.right - 1) reserve.right = Math.max(reserve.right, overlapW);
    if (r.top <= cr.top + 1) reserve.top = Math.max(reserve.top, overlapH);
    if (r.bottom >= cr.bottom - 1) reserve.bottom = Math.max(reserve.bottom, overlapH);
  });
  return reserve;
}

function renderCommentsDrawer() {
  const panel = document.getElementById('panelComments');
  if (!panel) return;
  const badge = document.getElementById('commentsBadge');
  if (!COMMENTS.items.length) {
    panel.innerHTML = `<div class="empty-state">No comments yet. Use the Comment tool to drop one anywhere on the canvas.</div>`;
    if (badge) { badge.hidden = true; badge.textContent = '0'; }
    return;
  }
  panel.innerHTML = COMMENTS.items.map(c => {
    const a = c.author || CURRENT_USER;
    return `
    <div class="comment-item" data-cid="${c.id}">
      <div class="hd">
        <span class="av" style="background:${COMMENT_THEME.accent}">${esc(a.letter)}</span>
        <span class="nm">${esc(a.name)}</span>
        <span class="tm">${esc(_relTime(c.at || Date.now()))}</span>
      </div>
      <div class="tx">${esc(c.text || '')}</div>
      <div class="lnk" data-act="show">↗ Show on canvas</div>
    </div>`;
  }).join('');
  panel.querySelectorAll('.comment-item').forEach(el => {
    el.addEventListener('click', () => {
      const c = COMMENTS.items.find(x => x.id === el.dataset.cid);
      if (!c) return;
      setPinnedComment(c.id);
      if (typeof Canvas.focusWorld === 'function') {
        Canvas.focusWorld(c.x, c.y, {
          zoom: 1.5,
          anchorXRatio: 0.5,
          anchorYRatio: 0.5,
          reserve: getCanvasOcclusionReserve(),
          animate: true,
          durationMs: 340
        });
      }
      else if (typeof Canvas.panToWorld === 'function') Canvas.panToWorld(c.x, c.y);
    });
  });
  if (badge) { badge.textContent = COMMENTS.items.length; badge.hidden = false; }
}

function setPinnedComment(targetId) {
  let dirty = false;
  COMMENTS.items.forEach(c => {
    const next = !!targetId && c.id === targetId;
    if (!!c.pinnedOpen !== next) {
      c.pinnedOpen = next;
      dirty = true;
    }
  });
  if (dirty) renderCommentCards();
}

// Render (or re-render) a single comment card into canvas-inner. Re-using
// the same DOM element lets collapse state / drag handlers persist across
// re-renders triggered by edits or reply posts.
function renderCommentCard(cmt) {
  const inner = Canvas.getCanvasInner();
  let el = inner.querySelector(`.comment-card[data-comment-id="${cmt.id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'comment-card';
    el.dataset.commentId = cmt.id;
    inner.appendChild(el);
    _attachCommentInteractions(el);
  }
  el.style.left = cmt.x + 'px';
  el.style.top  = cmt.y + 'px';
  const a = cmt.author || CURRENT_USER;
  el.style.setProperty('--cmt-bg',          COMMENT_THEME.bg);
  el.style.setProperty('--cmt-border',      COMMENT_THEME.border);
  el.style.setProperty('--cmt-accent',      COMMENT_THEME.accent);
  el.style.setProperty('--cmt-accent-deep', COMMENT_THEME.accentDeep);
  if (cmt.collapsed !== true) cmt.collapsed = true;
  el.classList.toggle('collapsed', true);
  el.classList.toggle('pinned-open', !!cmt.pinnedOpen);

  const tagsHtml = (cmt.tags || []).map(t => `<span class="comment-tag">${esc(t)}</span>`).join('');
  const repliesHtml = (cmt.replies || []).map(r => {
    const ra = r.author || CURRENT_USER;
    return `
      <div class="comment-reply">
        <span class="reply-avatar" style="background:${COMMENT_THEME.accent}">${esc(ra.letter || '?')}</span>
        <div class="reply-body">
          <span class="reply-author">${esc(ra.name || 'Unknown')}</span>
          <span class="reply-text">${esc(r.text || '')}</span>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="comment-head" data-role="pin-toggle">
      <span class="comment-pin" title="Open comment">${COMMENT_ICON_SVG}</span>
      <span class="comment-avatar" title="${esc(a.name)}">${esc(a.letter || '?')}</span>
      <span class="author">${esc(a.name || 'Comment')}</span>
      <span class="actions">
        <button type="button" class="edit" data-role="edit" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>
        </button>
        <button type="button" class="delete" data-role="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </span>
    </div>
    <div class="comment-body" data-role="body">
      ${cmt.text ? `<div class="comment-text" data-role="edit-text">${esc(cmt.text)}</div>` : ''}
      ${tagsHtml ? `<div class="comment-tags">${tagsHtml}</div>` : ''}
      ${repliesHtml ? `<div class="comment-replies">${repliesHtml}</div>` : ''}
      <div class="comment-reply-compose">
        <textarea data-role="reply-input" placeholder="Reply…" rows="1"></textarea>
        <button type="button" data-role="reply-send" disabled>Reply</button>
      </div>
    </div>`;
}

function renderCommentCards() {
  const inner = document.getElementById('canvasInner');
  if (!inner) return;
  // Remove orphaned cards (comments that were deleted).
  const keep = new Set(COMMENTS.items.map(c => c.id));
  inner.querySelectorAll('.comment-card').forEach(el => {
    if (!keep.has(el.dataset.commentId)) el.remove();
  });
  COMMENTS.items.forEach(renderCommentCard);
}

function removeComment(id) {
  COMMENTS.items = COMMENTS.items.filter(c => c.id !== id);
  const el = document.querySelector(`.comment-card[data-comment-id="${id}"]`);
  if (el) el.remove();
  renderCommentsDrawer();
}

// Attach drag + body-click handlers once per card. We read zoom once at
// mousedown (cs.zoom) so the drag stays accurate even if the user scrolls
// the wheel mid-drag (not common, but the alternative is reading zoom on
// every mousemove which is slightly worse).
function _attachCommentInteractions(el) {
  let cs = null;
  el.addEventListener('mousedown', e => {
    // Drag only when grabbing the header — but not on an action button.
    if (e.target.closest('button')) return;
    const isCollapsedPin = el.classList.contains('collapsed') && !el.classList.contains('pinned-open');
    // Allow immediate drag when the collapsed pin is hover-expanded.
    if (isCollapsedPin && !el.matches(':hover')) return;
    const head = e.target.closest('.comment-head');
    if (!head) return;
    const cmt = COMMENTS.items.find(c => c.id === el.dataset.commentId);
    if (isCollapsedPin && cmt && !cmt.pinnedOpen) {
      // Preserve the expanded state through drag and after drop.
      setPinnedComment(cmt.id);
    }
    e.preventDefault(); e.stopPropagation();
    const t = Canvas.getTransform();
    cs = {
      startX: e.clientX, startY: e.clientY,
      startLeft: parseFloat(el.style.left) || 0,
      startTop:  parseFloat(el.style.top)  || 0,
      moved: false, zoom: t.zoom
    };
    el.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp, { once: true });
  });
  function onMove(e) {
    if (!cs) return;
    const dx = (e.clientX - cs.startX) / cs.zoom;
    const dy = (e.clientY - cs.startY) / cs.zoom;
    if (Math.hypot(dx, dy) > 2) cs.moved = true;
    el.style.left = (cs.startLeft + dx) + 'px';
    el.style.top  = (cs.startTop  + dy) + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    el.classList.remove('dragging');
    if (cs && cs.moved) {
      const cmt = COMMENTS.items.find(c => c.id === el.dataset.commentId);
      if (cmt) {
        cmt.x = parseFloat(el.style.left) || 0;
        cmt.y = parseFloat(el.style.top)  || 0;
      }
      // Suppress the head click handler right after a drag gesture so we
      // don't toggle pin-open accidentally on mouseup.
      el.dataset.justDragged = '1';
      setTimeout(() => { delete el.dataset.justDragged; }, 0);
    }
    cs = null;
  }
  el.addEventListener('click', e => {
    const role = e.target.closest('[data-role]')?.dataset?.role;
    if (!role) return;
    const cmt = COMMENTS.items.find(c => c.id === el.dataset.commentId);
    if (!cmt) return;
    if (role === 'pin-toggle') {
      if (el.dataset.justDragged === '1') return;
      e.stopPropagation();
      if (cmt.pinnedOpen) setPinnedComment(null);
      else setPinnedComment(cmt.id);
      return;
    }
    if (role === 'edit' || role === 'edit-text') {
      e.stopPropagation();
      openCommentModal({ mode: 'edit', id: cmt.id, x: cmt.x, y: cmt.y, text: cmt.text, tags: [...(cmt.tags || [])] });
      return;
    }
    if (role === 'delete') { e.stopPropagation(); removeComment(cmt.id); return; }
    if (role === 'reply-send') {
      e.stopPropagation();
      const ta = el.querySelector('[data-role="reply-input"]');
      const text = (ta?.value || '').trim();
      if (!text) return;
      (cmt.replies = cmt.replies || []).push({
        id: _nextCommentId() + '-r', author: { ...CURRENT_USER },
        text, at: Date.now(),
      });
      renderCommentCard(cmt);
    }
  });
  el.addEventListener('input', e => {
    if (e.target?.dataset?.role !== 'reply-input') return;
    const btn = el.querySelector('[data-role="reply-send"]');
    if (btn) btn.disabled = !e.target.value.trim();
  });
  el.addEventListener('keydown', e => {
    if (e.target?.dataset?.role !== 'reply-input') return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.querySelector('[data-role="reply-send"]')?.click();
    }
  });
}

/* ── Comment placement mode ──
   A ghost element tracks the cursor while the Comment tool is active.
   Clicking inside the canvas converts screen→world coords and opens the
   compose modal. Clicks outside the canvas (or Escape) cancel. */
function startCommentDrop() {
  COMMENTS.dropping = true;
  document.body.classList.add('placing-comment');
  if (!COMMENTS.ghostEl) {
    COMMENTS.ghostEl = document.createElement('div');
    COMMENTS.ghostEl.className = 'comment-ghost';
    COMMENTS.ghostEl.innerHTML = COMMENT_ICON_SVG;
    document.body.appendChild(COMMENTS.ghostEl);
  }
  COMMENTS.ghostEl.style.display = 'grid';
  document.addEventListener('mousemove', _onCommentPlaceMove);
  document.addEventListener('click',     _onCommentPlaceClick, { capture: true });
  document.addEventListener('keydown',   _onCommentPlaceKey);
}
function stopCommentDrop() {
  COMMENTS.dropping = false;
  document.body.classList.remove('placing-comment');
  if (COMMENTS.ghostEl) COMMENTS.ghostEl.style.display = 'none';
  document.removeEventListener('mousemove', _onCommentPlaceMove);
  document.removeEventListener('click',     _onCommentPlaceClick, { capture: true });
  document.removeEventListener('keydown',   _onCommentPlaceKey);
  setPaletteTool('select');
}
function _onCommentPlaceMove(e) {
  if (!COMMENTS.ghostEl) return;
  COMMENTS.ghostEl.style.left = e.clientX + 'px';
  COMMENTS.ghostEl.style.top  = e.clientY + 'px';
}
function _onCommentPlaceKey(e) { if (e.key === 'Escape') stopCommentDrop(); }
function _onCommentPlaceClick(e) {
  const canvasEl = Canvas.getCanvasEl();
  const r = canvasEl.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
    stopCommentDrop();
    return;
  }
  e.preventDefault(); e.stopPropagation();
  const { x, y } = Canvas.clientToWorld(e.clientX, e.clientY);
  stopCommentDrop();
  openCommentModal({ mode: 'create', x, y, tags: [] });
}

/* ── Comment modal (create / edit) ──
   Single modal reused for both modes; `editState.mode` toggles title,
   delete-button visibility, and whether OK creates a new item or patches
   an existing one. */
function _wireCommentModal() {
  const modal = document.getElementById('commentModal');
  const text  = document.getElementById('commentText');
  const tagEditor = document.getElementById('commentTagEditor');
  const tagInput  = document.getElementById('commentTagInput');
  const okBtn = document.getElementById('commentOk');
  const cancelBtn = document.getElementById('commentCancel');

  const renderChips = () => {
    tagEditor.querySelectorAll('.tag-chip').forEach(c => c.remove());
    (COMMENTS.editState?.tags || []).forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `<span>${esc(t)}</span><button type="button" aria-label="Remove">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        COMMENTS.editState.tags = COMMENTS.editState.tags.filter(x => x !== t);
        renderChips();
      });
      tagEditor.insertBefore(chip, tagInput);
    });
  };
  COMMENTS._renderChips = renderChips;

  tagInput.addEventListener('keydown', e => {
    if (!COMMENTS.editState) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const raw = tagInput.value.trim().replace(/,$/, '').trim();
      if (raw && !COMMENTS.editState.tags.includes(raw)) {
        COMMENTS.editState.tags.push(raw);
        renderChips();
      }
      tagInput.value = '';
    } else if (e.key === 'Backspace' && !tagInput.value && COMMENTS.editState.tags.length) {
      COMMENTS.editState.tags.pop();
      renderChips();
    }
  });
  tagEditor.addEventListener('click', () => tagInput.focus());

  const close = () => { modal.classList.remove('show'); COMMENTS.editState = null; };
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show')) close();
  });

  okBtn.addEventListener('click', () => {
    if (!COMMENTS.editState) return;
    // Commit any pending tag text.
    const pending = tagInput.value.trim();
    if (pending && !COMMENTS.editState.tags.includes(pending)) COMMENTS.editState.tags.push(pending);
    const body = text.value.trim();
    if (!body && !COMMENTS.editState.tags.length) { close(); return; }
    if (COMMENTS.editState.mode === 'create') {
      const cmt = {
        id: _nextCommentId(),
        x: COMMENTS.editState.x, y: COMMENTS.editState.y,
        text: body, tags: [...COMMENTS.editState.tags],
        author: { ...CURRENT_USER },
        at: Date.now(), replies: [], collapsed: true, pinnedOpen: false,
      };
      COMMENTS.items.push(cmt);
      renderCommentCard(cmt);
      setPinnedComment(cmt.id);
    } else {
      const cmt = COMMENTS.items.find(c => c.id === COMMENTS.editState.id);
      if (cmt) { cmt.text = body; cmt.tags = [...COMMENTS.editState.tags]; renderCommentCard(cmt); }
    }
    renderCommentsDrawer();
    close();
  });
}

function openCommentModal(state) {
  COMMENTS.editState = state;
  const modal = document.getElementById('commentModal');
  document.getElementById('commentModalTitle').textContent = state.mode === 'edit' ? 'Edit comment' : 'Add comment';
  document.getElementById('commentText').value = state.text || '';
  document.getElementById('commentTagInput').value = '';
  document.getElementById('commentOk').textContent = state.mode === 'edit' ? 'Save' : 'Post';
  COMMENTS._renderChips?.();
  modal.classList.add('show');
  setTimeout(() => document.getElementById('commentText').focus(), 30);
}

/* ── Node click → Inspector ────────────────────────────────
   Opening the right drawer and switching to the Inspector tab makes
   "click a node to inspect it" feel native, like Figma's right
   panel. We don't open a modal, which would block the rest of the
   graph from being visible. */
function _isInspectorDrawerActive() {
  const rightEl = document.getElementById('drawerRight');
  if (!rightEl?.classList.contains('open')) return false;
  const tab = rightEl.querySelector('.drawer-tab[data-tab="inspector"]');
  const panel = document.getElementById('panelInspector');
  return !!(tab?.classList.contains('active') && panel?.classList.contains('active'));
}
// Delegates to v2 master/detail inspector once initV2Layout has run; before
// that, falls back to a minimal version that won't crash on the v2 DOM.
function openInspector(nodeData) {
  if (typeof openInspectorV2 === 'function') {
    return openInspectorV2(nodeData);
  }
  const rightEl = document.getElementById('drawerRight');
  rightEl.classList.add('open');
  rightEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'inspector'));
  rightEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelInspector'));
}
function renderInspector(n) {
  const colorRaw = String(n.color || '').trim();
  let color = 'blue';
  if (/^var\(--dot-/.test(colorRaw)) {
    const m = /var\(--dot-(\w+)\)/.exec(colorRaw);
    color = m ? m[1] : 'blue';
  } else if (/^(blue|green|purple|yellow|red)$/.test(colorRaw)) {
    color = colorRaw;
  }
  const name = n.label || n.name || n.id;
  const portRows = (label, list) => `
    <div class="insp-section">
      <h4>${label} <span class="insp-count">${(list||[]).length}</span></h4>
      ${(list||[]).map(p => `
        <div class="insp-port-row">
          <span class="pname">${esc(p.name)}</span>
          ${Canvas.typePill(p.type)}
        </div>
      `).join('') || `<div class="sub" style="font-size:12px;color:var(--text-muted)">No ${label.toLowerCase()}</div>`}
    </div>`;

  // HuggingFace-style "plausible" metrics. Hash the node id so values are
  // stable for a given card but vary across the graph.
  let h = 0;
  for (let i = 0; i < n.id.length; i++) h = (h * 31 + n.id.charCodeAt(i)) | 0;
  const rng = (seed, min, max) => min + (Math.abs((h + seed * 2654435761) | 0) % 1000) / 1000 * (max - min);

  const kind = n.type || 'Node';
  const by = n.by || n.user?.letter || 'community';
  const views = n.views || (Math.round(rng(1, 2, 900)) + 'k');
  const downloads = n.downloads || (Math.round(rng(2, 1, 400)) + 'k');
  const likes = Math.round(rng(3, 20, 4800));
  const updated = ['3 days ago','last week','2 weeks ago','last month','3 months ago'][Math.abs(h) % 5];
  const license = ['Apache 2.0','MIT','CC-BY-4.0','Custom (research)','OpenRAIL'][Math.abs(h>>3) % 5];
  const fw = n.fw || (kind === 'Dataset' ? 'Parquet' : 'PyTorch');
  const fn = n.fn || (kind === 'Dataset' ? 'Tabular' : kind === 'Logic' ? 'Transform' : 'Classification');

  // Per-kind detail blocks — models get eval metrics, datasets get splits,
  // logic blocks get IO types. Closest to what you'd see on HF.
  let kindBlock = '';
  if (kind === 'Model') {
    kindBlock = `
      <div class="insp-section">
        <h4>Evaluation</h4>
        <div class="insp-row"><span class="k">Accuracy</span><span class="v">${rng(10, 78, 94).toFixed(1)}%</span></div>
        <div class="insp-row"><span class="k">F1 (macro)</span><span class="v">${rng(11, 0.72, 0.92).toFixed(3)}</span></div>
        <div class="insp-row"><span class="k">Latency (p50)</span><span class="v">${Math.round(rng(12, 12, 180))} ms</span></div>
        <div class="insp-row"><span class="k">Params</span><span class="v">${rng(13, 0.1, 70).toFixed(1)}B</span></div>
      </div>
      <div class="insp-section">
        <h4>Training</h4>
        <div class="insp-row"><span class="k">batch_size</span><span class="v">${[16,32,64,128][Math.abs(h) % 4]}</span></div>
        <div class="insp-row"><span class="k">learning_rate</span><span class="v">${['1e-3','5e-4','2e-4','1e-4'][Math.abs(h>>1) % 4]}</span></div>
        <div class="insp-row"><span class="k">optimizer</span><span class="v">${['AdamW','SGD','Lion','Adafactor'][Math.abs(h>>2) % 4]}</span></div>
        <div class="insp-row"><span class="k">epochs</span><span class="v">${[3,5,10,20][Math.abs(h>>3) % 4]}</span></div>
      </div>`;
  } else if (kind === 'Dataset') {
    kindBlock = `
      <div class="insp-section">
        <h4>Splits</h4>
        <div class="insp-row"><span class="k">train</span><span class="v">${Math.round(rng(20, 50, 2400))}k rows</span></div>
        <div class="insp-row"><span class="k">validation</span><span class="v">${Math.round(rng(21, 5, 80))}k rows</span></div>
        <div class="insp-row"><span class="k">test</span><span class="v">${Math.round(rng(22, 5, 80))}k rows</span></div>
      </div>
      <div class="insp-section">
        <h4>Data fields</h4>
        <div class="insp-row"><span class="k">format</span><span class="v">${fw}</span></div>
        <div class="insp-row"><span class="k">size</span><span class="v">${rng(23, 0.5, 240).toFixed(1)} GB</span></div>
        <div class="insp-row"><span class="k">languages</span><span class="v">${['en','en · es','multi (30+)','code'][Math.abs(h) % 4]}</span></div>
      </div>`;
  } else {
    kindBlock = `
      <div class="insp-section">
        <h4>Behavior</h4>
        <div class="insp-row"><span class="k">category</span><span class="v">${fn}</span></div>
        <div class="insp-row"><span class="k">deterministic</span><span class="v">${(Math.abs(h) % 2) ? 'yes' : 'no'}</span></div>
        <div class="insp-row"><span class="k">stateless</span><span class="v">yes</span></div>
      </div>`;
  }

  return `
    <div class="inspector-hd">
      <span class="dot" style="--dot-base: var(--dot-${color})"></span>
      <span class="name">${esc(name)}</span>
      <span class="kind">${esc(kind)}</span>
    </div>
    <div class="insp-stats">
      <div class="insp-stat"><span class="k">Likes</span><span class="v">${likes.toLocaleString()}</span></div>
      <div class="insp-stat"><span class="k">Downloads</span><span class="v">${downloads}</span></div>
      <div class="insp-stat"><span class="k">Views</span><span class="v">${views}</span></div>
    </div>
    <div class="insp-section">
      <h4>About</h4>
      <div class="insp-row"><span class="k">Author</span><span class="v">${esc(by)}</span></div>
      <div class="insp-row"><span class="k">Task</span><span class="v">${esc(fn)}</span></div>
      <div class="insp-row"><span class="k">Framework</span><span class="v">${esc(fw)}</span></div>
      <div class="insp-row"><span class="k">License</span><span class="v">${esc(license)}</span></div>
      <div class="insp-row"><span class="k">Updated</span><span class="v">${updated}</span></div>
      <div class="insp-row"><span class="k">Node ID</span><span class="v">${esc(n.id)}</span></div>
    </div>
    ${portRows('Inputs',  n.inputs)}
    ${portRows('Outputs', n.outputs)}
    ${kindBlock}
    <div class="insp-section">
      <h4>Tags</h4>
      <div class="insp-tags">
        ${[fn, fw, license, kind.toLowerCase()].map(t => `<span class="insp-tag">${esc(t)}</span>`).join('')}
      </div>
    </div>`;
}

/* ── Bottom panel (Runs / Logs / Problems) ──────────────────
   Runs are per-variant: training the "ResNet swap" variant shouldn't
   contaminate the "Master" variant's history. */
function initBottomPanel() {
  const panel = document.getElementById('bottomPanel');
  const closeBtn = document.getElementById('bpClose');
  const expandBtn = document.getElementById('bpExpand');
  const resizeEl = document.getElementById('bpResize');
  const tabs = panel.querySelectorAll('.bp-tab');
  const bodies = panel.querySelectorAll('.bp-panel');
  const BP_MIN_H = 140;
  let bpDrag = null;

  function onBpResizeMove(e) {
    if (!bpDrag || !panel.classList.contains('open')) return;
    if (bpDrag.mode === 'expanded') {
      const newTop = bpDrag.startTop + (e.clientY - bpDrag.startY);
      const minTop = bpShellTopPx();
      const maxTop = window.innerHeight - BP_MIN_H;
      panel.style.top = Math.max(minTop, Math.min(newTop, maxTop)) + 'px';
      return;
    }
    const delta = bpDrag.startY - e.clientY;
    let h = bpDrag.startH + delta;
    h = Math.max(BP_MIN_H, Math.min(h, bpMaxDockedHeightPx()));
    panel.style.setProperty('--bp-h', Math.round(h) + 'px');
  }
  function onBpResizeUp() {
    document.removeEventListener('mousemove', onBpResizeMove);
    if (!bpDrag) return;
    panel.classList.remove('bp-dragging');
    if (bpDrag.mode === 'expanded') {
      const h = panel.getBoundingClientRect().height;
      const fullH = bpFullOverlayHeightPx();
      if (h < fullH * 0.88) {
        panel.classList.remove('expanded');
        panel.style.removeProperty('top');
        let dockH = Math.max(BP_MIN_H, Math.min(Math.round(h), bpMaxDockedHeightPx()));
        const defH = bpDefaultDockedHeightPx();
        const maxD = bpMaxDockedHeightPx();
        const mid = (defH + maxD) / 2;
        if (dockH >= mid) dockH = maxD;
        else if (Math.abs(dockH - defH) < 30) dockH = defH;
        panel.style.setProperty('--bp-h', dockH + 'px');
      } else {
        panel.style.removeProperty('top');
      }
    } else {
      const h = Math.round(panel.getBoundingClientRect().height);
      const maxD = bpMaxDockedHeightPx();
      const defH = bpDefaultDockedHeightPx();
      if (h >= maxD - 12) {
        panel.classList.add('expanded');
        panel.style.removeProperty('--bp-h');
        panel.style.removeProperty('top');
      } else {
        const mid = (defH + maxD) / 2;
        if (h >= mid) panel.style.setProperty('--bp-h', maxD + 'px');
        else if (h <= (defH + BP_MIN_H) / 2) panel.style.setProperty('--bp-h', defH + 'px');
        else panel.style.setProperty('--bp-h', h + 'px');
      }
    }
    bpDrag = null;
    syncBpAppShell();
  }

  function activate(tab) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    bodies.forEach(b => b.classList.toggle('active', b.id.toLowerCase().endsWith(tab)));
  }
  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));
  panel.querySelector('.bp-tabs')?.addEventListener('dblclick', e => {
    if (!panel.classList.contains('open')) return;
    if (e.target.closest('.bp-expand, .bp-close')) return;
    e.preventDefault();
    if (!panel.classList.contains('expanded')) {
      expandBtn?.click();
      return;
    }
    panel.style.setProperty('--bp-h', BP_MIN_H + 'px');
    expandBtn?.click();
  });
  let bpTopAnimGen = 0;
  function clearBpTopAnimListener() {
    if (panel._bpTopAnimEnd) {
      panel.removeEventListener('transitionend', panel._bpTopAnimEnd);
      panel._bpTopAnimEnd = null;
    }
    endBpTopAnim();
  }
  function startBpTopAnim(toTop, onComplete, fromTop, opts) {
    opts = opts || {};
    const start = typeof fromTop === 'number' ? fromTop : panel.getBoundingClientRect().top;
    beginBpTopAnim();
    panel.classList.add('bp-top-anim');
    panel.style.top = `${start}px`;
    if (opts.expand) {
      panel.classList.add('expanded');
      syncBpAppShell();
      panel.style.removeProperty('--bp-h');
    }
    void panel.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.style.top = `${toTop}px`;
      });
    });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      panel.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
      endBpTopAnim();
      onComplete();
    };
    const onEnd = e => {
      if (e.target !== panel) return;
      if (e.propertyName && e.propertyName !== 'top') return;
      finish();
    };
    panel._bpTopAnimEnd = onEnd;
    panel.addEventListener('transitionend', onEnd);
    const fallback = setTimeout(finish, BP_TOP_ANIM_MS + 40);
  }
  expandBtn?.addEventListener('click', () => {
    clearBpTopAnimListener();
    panel.classList.remove('bp-top-anim');
    bpTopAnimGen++;
    const gen = bpTopAnimGen;
    const willExpand = !panel.classList.contains('expanded');
    if (willExpand) {
      collapseVariantsRowIfOpen();
      void panel.offsetHeight;
      stashBpDockHeight(panel);
      const startTop = panel.getBoundingClientRect().top;
      const targetTop = bpShellTopPx();
      startBpTopAnim(targetTop, () => {
        if (gen !== bpTopAnimGen) return;
        if (!panel.classList.contains('expanded')) return;
        panel.style.top = `${bpShellTopPx()}px`;
        void panel.offsetHeight;
        panel.classList.remove('bp-top-anim');
        panel.style.removeProperty('top');
        if (panel._bpTopAnimEnd) {
          panel.removeEventListener('transitionend', panel._bpTopAnimEnd);
          panel._bpTopAnimEnd = null;
        }
      }, startTop, { expand: true });
      expandBtn.title = 'Collapse panel';
      expandBtn.setAttribute('aria-label', 'Collapse panel');
    } else {
      const h = Math.round(readBpDockHeightPx(panel));
      panel.style.setProperty('--bp-h', `${h}px`);
      const targetTop = window.innerHeight - h;
      startBpTopAnim(targetTop, () => {
        if (gen !== bpTopAnimGen) return;
        panel.style.setProperty('--bp-h', `${h}px`);
        panel.classList.remove('expanded', 'bp-top-anim');
        panel.style.removeProperty('top');
        if (panel._bpTopAnimEnd) {
          panel.removeEventListener('transitionend', panel._bpTopAnimEnd);
          panel._bpTopAnimEnd = null;
        }
        syncBpAppShell();
        expandBtn.title = 'Expand panel';
        expandBtn.setAttribute('aria-label', 'Expand panel');
      });
    }
  });
  closeBtn.addEventListener('click', () => {
    clearBpTopAnimListener();
    bpTopAnimGen++;
    panel.classList.remove('bp-top-anim');
    panel.classList.remove('expanded');
    panel.classList.remove('open');
    panel.style.removeProperty('top');
    document.getElementById('tglRuns')?.classList.remove('active');
    // Tutorial Step 11: notify when the Runs panel is closed.
    if (window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('runs-panel-closed', {});
    }
    if (expandBtn) {
      expandBtn.title = 'Expand panel';
      expandBtn.setAttribute('aria-label', 'Expand panel');
    }
    syncBpAppShell();
  });
  resizeEl?.addEventListener('mousedown', e => {
    if (e.button !== 0 || !panel.classList.contains('open')) return;
    e.preventDefault();
    if (panel.classList.contains('expanded')) {
      const rect = panel.getBoundingClientRect();
      bpDrag = { mode: 'expanded', startY: e.clientY, startTop: rect.top };
    } else {
      bpDrag = { mode: 'docked', startY: e.clientY, startH: panel.getBoundingClientRect().height };
    }
    panel.classList.add('bp-dragging');
    document.addEventListener('mousemove', onBpResizeMove);
    document.addEventListener('mouseup', onBpResizeUp, { once: true });
  });
  // Seed a couple of completed runs per variant on first load so the
  // empty state isn't the first thing users see.
  const variants = readJSON(KEY.variants) || [];
  variants.forEach(v => {
    if ((readJSON(KEY.runs(v.id)) || []).length) return;
    const P = window.PROJECT;
    const map = P && P.demoRunCountByVariant;
    let n = 1;
    if (map && typeof map === 'object' && map[v.id] != null) {
      n = Math.max(0, Math.min(10, Math.floor(Number(map[v.id]))));
    }
    const runs = [];
    for (let i = 0; i < n; i++) {
      const seeded = makeRunResults(v.id.length * 1337 + i * 97);
      runs.push({
        id: 'r_' + v.id + '_' + i,
        name: v.name + (n > 1 ? ' · run ' + (i + 1) : ' · baseline'),
        at: Date.now() - (n - i) * 3600000,
        status: 'ok',
        progress: 100,
        ...seeded,
        pathId: null,
        pathName: null,
        pathNodeIds: [],
        edgeGroups: [],
      });
    }
    writeJSON(KEY.runs(v.id), runs);
  });
  renderRuns();
  renderLogs();
  renderProblems();
  activate('runs');
}

// Single in-flight run per active variant. We keep a reference so the
// interval can be cancelled if the user switches variants mid-run.
let ACTIVE_RUN = null;
let RUN_DETAIL_ID = null;
let RUN_COMPARE_IDS = [];
let RUN_COMPARE_LOSS_MODE = 'overlay'; // overlay | split | delta
let RUN_COMPARE_VISIBLE = { a: true, b: true };

function _num(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function _round(n, digits) {
  const p = 10 ** (digits || 0);
  return Math.round(n * p) / p;
}
function makeRunResults(seed) {
  const s = _num(seed, Math.random() * 10000);
  const baseAcc = 86 + ((s * 0.013) % 4.8);
  const baseF1 = 0.79 + ((s * 0.011) % 0.11);
  const baseLoss = 0.22 + ((s * 0.017) % 0.14);
  const classes = ['Car', 'Pedestrian', 'Cyclist', 'Truck'];
  const lossCurve = [];
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const noise = (((s + i * 17) % 9) - 4) * 0.003;
    const y = Math.max(0.08, 0.92 - t * 0.66 + (1 - t) * 0.05 + noise);
    lossCurve.push(_round(y, 3));
  }
  const confusion = [
    [126, 8, 3, 6],
    [7, 98, 11, 2],
    [4, 12, 103, 6],
    [5, 3, 6, 89],
  ];
  const perClass = [
    { cls: 'Car',        precision: 0.93, recall: 0.90, f1: 0.92, support: 143 },
    { cls: 'Pedestrian', precision: 0.84, recall: 0.83, f1: 0.83, support: 118 },
    { cls: 'Cyclist',    precision: 0.84, recall: 0.82, f1: 0.83, support: 125 },
    { cls: 'Truck',      precision: 0.86, recall: 0.86, f1: 0.86, support: 103 },
  ];
  return {
    acc: _round(baseAcc, 1),
    f1: _round(baseF1, 2),
    loss: _round(baseLoss, 2),
    iter: (10 + Math.floor(((s * 0.07) % 6))) + 'k',
    wallSec: 220 + Math.floor((s * 0.19) % 190),
    lossCurve,
    classes,
    confusion,
    perClass,
  };
}
function formatWallSec(sec) {
  const s = Math.max(0, Math.floor(_num(sec, 0)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, '0')}s`;
}
function _seriesPath(arr, mapX, mapY) {
  if (!arr.length) return '';
  return arr.map((v, i) => `${i ? 'L' : 'M'} ${mapX(i, arr.length).toFixed(2)} ${mapY(v).toFixed(2)}`).join(' ');
}
function buildLossCurveSvg(primary, secondary, opts) {
  const o = opts || {};
  const p = Array.isArray(primary?.lossCurve) ? primary.lossCurve : [];
  const s = Array.isArray(secondary?.lossCurve) ? secondary.lossCurve : [];
  const mode = o.mode || 'single'; // single | overlay | delta
  const showA = o.showA !== false;
  const showB = o.showB !== false;
  const includeHover = !!o.includeHover;
  const visibleSeries = [];
  if (showA && p.length) visibleSeries.push(p);
  if (showB && s.length) visibleSeries.push(s);
  if (!visibleSeries.length) return '<div style="font-size:12px;color:var(--text-muted);">No loss data.</div>';

  const W = 560, H = 130, left = 36, right = 10, top = 8, bottom = 22;
  const iw = W - left - right, ih = H - top - bottom;
  const mapX = (i, len) => left + (iw * i / Math.max(1, len - 1));

  let chartA = p;
  let chartB = s;
  let allVals = visibleSeries.flat();
  let yLabel = 'loss';
  let epochMax = Math.max(p.length, s.length);
  if (mode === 'delta') {
    const len = Math.min(p.length, s.length);
    chartA = Array.from({ length: len }, (_, i) => _round(_num(p[i], 0) - _num(s[i], 0), 4));
    chartB = [];
    allVals = chartA;
    yLabel = 'delta';
    epochMax = len;
  }
  if (!allVals.length) return '<div style="font-size:12px;color:var(--text-muted);">No loss data.</div>';
  const minY = Math.min(...allVals);
  const maxY = Math.max(...allVals);
  const pad = mode === 'delta' ? 0.015 : 0.03;
  const lo = minY - pad;
  const hi = maxY + pad;
  const mapY = (v) => top + (hi - v) * (ih / Math.max(0.0001, hi - lo));
  const endA = chartA.length ? { x: mapX(chartA.length - 1, chartA.length), y: mapY(chartA[chartA.length - 1]) } : null;
  const endB = chartB.length ? { x: mapX(chartB.length - 1, chartB.length), y: mapY(chartB[chartB.length - 1]) } : null;

  const dataA = chartA.join(',');
  const dataB = chartB.join(',');
  const hoverSvg = includeHover ? `
      <line class="hover-line" data-hover-line x1="${left}" y1="${top}" x2="${left}" y2="${H - bottom}"></line>
      <circle class="hover-dot a" data-hover-a cx="${left}" cy="${H - bottom}"></circle>
      ${mode === 'overlay' ? `<circle class="hover-dot b" data-hover-b cx="${left}" cy="${H - bottom}"></circle>` : ''}
      ${mode === 'delta' ? `<circle class="hover-dot delta" data-hover-delta cx="${left}" cy="${H - bottom}"></circle>` : ''}
      <rect data-loss-hover-zone x="${left}" y="${top}" width="${iw}" height="${ih}" fill="transparent"
        data-min-x="${left}" data-max-x="${left + iw}" data-min-y="${top}" data-max-y="${H - bottom}"
        data-series-a="${esc(dataA)}" data-series-b="${esc(dataB)}" data-mode="${mode}" data-epoch-max="${epochMax}"></rect>` : '';
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="Loss curve">
      <line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${H - bottom}" />
      <line class="axis" x1="${left}" y1="${H - bottom}" x2="${W - right}" y2="${H - bottom}" />
      <line class="grid" x1="${left}" y1="${top + ih * 0.33}" x2="${W - right}" y2="${top + ih * 0.33}" />
      <line class="grid" x1="${left}" y1="${top + ih * 0.66}" x2="${W - right}" y2="${top + ih * 0.66}" />
      ${mode === 'delta' ? `<line class="grid" x1="${left}" y1="${mapY(0)}" x2="${W - right}" y2="${mapY(0)}"></line>` : ''}
      <text class="lbl" x="${left}" y="${H - 4}">epoch 1</text>
      <text class="lbl" x="${W - right - 58}" y="${H - 4}">epoch ${Math.max(1, epochMax)}</text>
      <text class="lbl" x="5" y="${top + 5}">${yLabel}</text>
      ${chartA.length ? `<path class="series ${mode === 'delta' ? 'delta' : ''}" d="${_seriesPath(chartA, mapX, mapY)}" />` : ''}
      ${mode === 'overlay' && chartB.length ? `<path class="series compare" d="${_seriesPath(chartB, mapX, mapY)}" />` : ''}
      ${endA ? `<circle class="series-end ${mode === 'delta' ? 'delta' : 'a'}" cx="${endA.x}" cy="${endA.y}" r="3.5"></circle><text class="end-tag" x="${Math.min(W - right - 62, endA.x + 7)}" y="${endA.y - 6}">${_num(chartA[chartA.length - 1], 0).toFixed(3)}</text>` : ''}
      ${endB && mode === 'overlay' ? `<circle class="series-end b" cx="${endB.x}" cy="${endB.y}" r="3.5"></circle><text class="end-tag" x="${Math.min(W - right - 62, endB.x + 7)}" y="${endB.y + 13}">${_num(chartB[chartB.length - 1], 0).toFixed(3)}</text>` : ''}
      ${hoverSvg}
    </svg>`;
}
function wireLossCurveHover(root) {
  if (!root) return;
  const zone = root.querySelector('[data-loss-hover-zone]');
  if (!zone) return;
  const tip = root.querySelector('.loss-curve-tip');
  const hoverLine = root.querySelector('[data-hover-line]');
  const dotA = root.querySelector('[data-hover-a]');
  const dotB = root.querySelector('[data-hover-b]');
  const dotD = root.querySelector('[data-hover-delta]');
  const minX = _num(zone.dataset.minX, 0);
  const maxX = _num(zone.dataset.maxX, 1);
  const minY = _num(zone.dataset.minY, 0);
  const maxY = _num(zone.dataset.maxY, 1);
  const mode = zone.dataset.mode || 'overlay';
  const arrA = (zone.dataset.seriesA || '').split(',').filter(Boolean).map(v => _num(v, 0));
  const arrB = (zone.dataset.seriesB || '').split(',').filter(Boolean).map(v => _num(v, 0));
  const epochMax = Math.max(1, _num(zone.dataset.epochMax, Math.max(arrA.length, arrB.length)));
  const valToY = (v) => {
    const all = [...arrA, ...arrB];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    return minY + (hi - v) * ((maxY - minY) / Math.max(0.0001, hi - lo));
  };
  const setVisible = (on) => {
    const op = on ? '1' : '0';
    if (hoverLine) hoverLine.style.opacity = op;
    if (dotA) dotA.style.opacity = op;
    if (dotB) dotB.style.opacity = op;
    if (dotD) dotD.style.opacity = op;
    if (tip) tip.style.opacity = op;
  };
  zone.addEventListener('mouseleave', () => setVisible(false));
  zone.addEventListener('mousemove', e => {
    const rect = zone.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const i = Math.min(epochMax - 1, Math.max(0, Math.round(t * (epochMax - 1))));
    const x = minX + (maxX - minX) * (i / Math.max(1, epochMax - 1));
    if (hoverLine) { hoverLine.setAttribute('x1', x); hoverLine.setAttribute('x2', x); }
    if (arrA.length && dotA) {
      const idx = Math.min(arrA.length - 1, i);
      dotA.setAttribute('cx', x);
      dotA.setAttribute('cy', valToY(arrA[idx]));
    }
    if (arrB.length && dotB) {
      const idx = Math.min(arrB.length - 1, i);
      dotB.setAttribute('cx', x);
      dotB.setAttribute('cy', valToY(arrB[idx]));
    }
    if (arrA.length && dotD && mode === 'delta') {
      const idx = Math.min(arrA.length - 1, i);
      dotD.setAttribute('cx', x);
      dotD.setAttribute('cy', valToY(arrA[idx]));
    }
    if (tip) {
      const aVal = arrA.length ? arrA[Math.min(arrA.length - 1, i)] : null;
      const bVal = arrB.length ? arrB[Math.min(arrB.length - 1, i)] : null;
      tip.innerHTML = mode === 'delta'
        ? `<span class="k">epoch ${i + 1}</span><span class="d">Δ ${(aVal == null ? 0 : aVal).toFixed(3)}</span>`
        : `<span class="k">epoch ${i + 1}</span>${aVal == null ? '' : `<span class="a">A ${aVal.toFixed(3)}</span>`}${bVal == null ? '' : ` <span class="b">B ${bVal.toFixed(3)}</span>`}`;
      const hostRect = root.getBoundingClientRect();
      const tipX = ((e.clientX - hostRect.left) / Math.max(1, hostRect.width)) * root.clientWidth;
      tip.style.left = `${Math.max(28, Math.min(root.clientWidth - 28, tipX))}px`;
      tip.style.top = `${Math.max(12, ((e.clientY - hostRect.top) / Math.max(1, hostRect.height)) * root.clientHeight)}px`;
    }
    setVisible(true);
  });
}
function renderCompareLossSection(a, b) {
  const showA = RUN_COMPARE_VISIBLE.a !== false;
  const showB = RUN_COMPARE_VISIBLE.b !== false;
  const canDelta = showA && showB;
  if (RUN_COMPARE_LOSS_MODE === 'delta' && !canDelta) RUN_COMPARE_LOSS_MODE = 'overlay';
  const overlayHtml = `
    <div class="loss-curve compare-overlay" data-compare-curve="overlay">
      ${buildLossCurveSvg(a, b, { mode: 'overlay', showA, showB, includeHover: true })}
      <div class="loss-curve-tip"></div>
    </div>`;
  const splitCols = [];
  if (showA) splitCols.push(`<div class="loss-curve">${buildLossCurveSvg(a, null, { mode: 'single', showA: true, showB: false })}</div>`);
  if (showB) splitCols.push(`<div class="loss-curve">${buildLossCurveSvg(b, null, { mode: 'single', showA: true, showB: false })}</div>`);
  const splitHtml = `
    <div class="loss-compare-split">
      ${splitCols.join('')}
    </div>`;
  const deltaHtml = `
    <div class="loss-curve compare-overlay" data-compare-curve="delta">
      ${buildLossCurveSvg(a, b, { mode: 'delta', showA: true, showB: true, includeHover: true })}
      <div class="loss-curve-tip"></div>
    </div>`;
  return `
    <div class="loss-compare-controls">
      <div class="loss-mode-toggle">
        <button type="button" data-loss-mode="overlay" class="${RUN_COMPARE_LOSS_MODE === 'overlay' ? 'active' : ''}">Overlay</button>
        <button type="button" data-loss-mode="split" class="${RUN_COMPARE_LOSS_MODE === 'split' ? 'active' : ''}">Split</button>
        <button type="button" data-loss-mode="delta" ${canDelta ? '' : 'disabled'} class="${RUN_COMPARE_LOSS_MODE === 'delta' ? 'active' : ''}">Delta</button>
      </div>
      <div class="loss-legend">
        <label><span class="swatch a"></span>${esc(a.name)}</label>
        <label><span class="swatch b"></span>${esc(b.name)}</label>
      </div>
    </div>
    ${RUN_COMPARE_LOSS_MODE === 'overlay' ? overlayHtml : (RUN_COMPARE_LOSS_MODE === 'split' ? splitHtml : deltaHtml)}`;
}
function renderConfusion(run) {
  const labels = run?.classes || [];
  const mat = run?.confusion || [];
  if (!labels.length || !mat.length) return '<div style="font-size:12px;color:var(--text-muted);">No confusion matrix.</div>';
  const head = `<div class="conf-row" style="--conf-cols:${labels.length};"><div>True \\ Pred</div>${labels.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
  const rows = labels.map((lbl, i) => {
    const r = Array.isArray(mat[i]) ? mat[i] : [];
    return `<div class="conf-row" style="--conf-cols:${labels.length};"><div>${esc(lbl)}</div>${labels.map((_, j) => `<div>${_num(r[j], 0)}</div>`).join('')}</div>`;
  }).join('');
  return `<div class="confusion-grid">${head}${rows}</div>`;
}
function renderPerClass(run) {
  const rows = Array.isArray(run?.perClass) ? run.perClass : [];
  if (!rows.length) return '<div style="font-size:12px;color:var(--text-muted);">No per-class metrics.</div>';
  return `
    <table class="per-class-table">
      <thead><tr><th>Class</th><th style="text-align:right;">Precision</th><th style="text-align:right;">Recall</th><th style="text-align:right;">F1</th><th style="text-align:right;">Support</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${esc(r.cls)}</td><td class="num">${_num(r.precision, 0).toFixed(2)}</td><td class="num">${_num(r.recall, 0).toFixed(2)}</td><td class="num">${_num(r.f1, 0).toFixed(2)}</td><td class="num">${_num(r.support, 0)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}
function flattenEdgeGroups(groups) {
  const out = [];
  (groups || []).forEach(g => (g || []).forEach(e => out.push(e)));
  return out;
}
function buildPathEdgeGroups(pathNodeIds) {
  const ids = (pathNodeIds || []).filter(Boolean);
  if (ids.length < 2) return [];
  const conns = Canvas.getConnections() || [];
  const groups = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const from = ids[i];
    const to = ids[i + 1];
    const matches = conns
      .filter(c => c?.from?.[0] === from && c?.to?.[0] === to)
      .map(() => ({ from, to }));
    if (matches.length) groups.push(matches);
  }
  return groups;
}
function buildGraphEdgeGroups() {
  const conns = Canvas.getConnections() || [];
  if (!conns.length) return [];
  const nodeIds = new Set();
  const depth = new Map();
  const edges = conns.map(c => ({ from: c?.from?.[0], to: c?.to?.[0] })).filter(e => e.from && e.to && e.from !== e.to);
  edges.forEach(e => { nodeIds.add(e.from); nodeIds.add(e.to); });
  nodeIds.forEach(id => depth.set(id, 0));
  for (let pass = 0; pass < nodeIds.size; pass++) {
    let changed = false;
    edges.forEach(e => {
      const next = (_num(depth.get(e.from), 0)) + 1;
      if (next > _num(depth.get(e.to), 0)) {
        depth.set(e.to, next);
        changed = true;
      }
    });
    if (!changed) break;
  }
  const map = new Map();
  edges.forEach(e => {
    const d = _num(depth.get(e.from), 0);
    if (!map.has(d)) map.set(d, []);
    map.get(d).push({ from: e.from, to: e.to });
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(x => x[1]);
}
function getRunEdgeGroups(run) {
  const pathIds = run?.pathNodeIds || [];
  if (pathIds.length >= 2) return buildPathEdgeGroups(pathIds);
  return buildGraphEdgeGroups();
}
function applyRunFlowVisual(run) {
  if (!run || run.status !== 'running') {
    Canvas.setRunFlowEdges(false);
    return;
  }
  const groups = Array.isArray(run.edgeGroups) ? run.edgeGroups : [];
  if (!groups.length) {
    Canvas.setRunFlowEdges(true);
    return;
  }
  const total = groups.length;
  const pct = Math.max(0, Math.min(100, _num(run.progress, 0)));
  const activeIdx = Math.min(total - 1, Math.max(0, Math.floor((pct / 100) * total)));
  Canvas.setRunFlowEdges({
    enabled: true,
    targetEdges: flattenEdgeGroups(groups),
    doneEdges: flattenEdgeGroups(groups.slice(0, activeIdx)),
    activeEdges: groups[activeIdx] || [],
  });
}

function renderRuns() {
  const panel = document.getElementById('bpRuns');
  const runs = (readJSON(KEY.runs(ACTIVE_VID)) || []).slice().sort((a, b) => _num(b.at, 0) - _num(a.at, 0));
  const runById = new Map(runs.map(r => [r.id, r]));
  RUN_COMPARE_IDS = RUN_COMPARE_IDS.filter(id => runById.has(id));
  if (!RUN_DETAIL_ID || !runById.has(RUN_DETAIL_ID)) RUN_DETAIL_ID = runs[0]?.id || null;
  document.getElementById('runsCount').textContent = runs.length;
  if (!runs.length) {
    panel.innerHTML = `<div class="empty-state" style="padding:28px;text-align:center;color:var(--text-muted);font-size:12.5px;">No runs yet. Click <b>Run</b> to kick one off.</div>`;
    return;
  }
  panel.innerHTML = `
    <div class="runs-grid">
      <div class="runs-list">
        ${runs.map(r => renderRunCard(r, r.id === RUN_DETAIL_ID, RUN_COMPARE_IDS.includes(r.id))).join('')}
      </div>
      <div class="run-detail" id="runDetail"></div>
    </div>`;
  panel.querySelectorAll('.run-card').forEach(c => c.addEventListener('click', () => {
    RUN_DETAIL_ID = c.dataset.id;
    renderRuns();
  }));
  panel.querySelectorAll('.run-compare-check').forEach(chk => {
    chk.addEventListener('click', e => {
      e.stopPropagation();
      RUN_DETAIL_ID = chk.dataset.id;
      panel.querySelectorAll('.run-card').forEach(x => x.classList.toggle('active', x.dataset.id === RUN_DETAIL_ID));
      if (RUN_COMPARE_IDS.length === 2) showRunComparison(RUN_COMPARE_IDS[0], RUN_COMPARE_IDS[1]);
      else showRunDetail(RUN_DETAIL_ID);
    });
    chk.addEventListener('change', e => {
      e.stopPropagation();
      const id = chk.dataset.id;
      RUN_COMPARE_IDS = RUN_COMPARE_IDS.filter(x => x !== id);
      if (chk.checked) RUN_COMPARE_IDS.push(id);
      if (RUN_COMPARE_IDS.length > 2) RUN_COMPARE_IDS = RUN_COMPARE_IDS.slice(RUN_COMPARE_IDS.length - 2);
      // Tutorial Step 10: notify once two runs are selected for comparison.
      if (RUN_COMPARE_IDS.length === 2 && window.ConnectifyTutorial) {
        window.ConnectifyTutorial.notifyAction('runs-compared', { ids: RUN_COMPARE_IDS.slice() });
      }
      renderRuns();
    });
  });
  panel.querySelectorAll('.run-del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      startInlineRunDelete(btn.dataset.id, btn);
    });
  });
  if (RUN_COMPARE_IDS.length === 2) showRunComparison(RUN_COMPARE_IDS[0], RUN_COMPARE_IDS[1]);
  else showRunDetail(RUN_DETAIL_ID);
}

function renderRunCard(r, active, compareChecked) {
  const statusClass = r.status === 'failed' ? 'failed' : (r.status === 'running' ? 'running' : '');
  const subtitle = r.status === 'running'
    ? `running · ${Math.round(r.progress || 0)}%`
    : (r.status === 'failed' ? 'failed' : `${formatRelativeTime(r.at)} · ${_num(r.acc, 0)}% acc`);
  const pathPill = r.pathName ? `<span class="run-pill path">Path: ${esc(r.pathName)}</span>` : '';
  return `
    <div class="run-card ${active ? 'active' : ''}" data-id="${r.id}">
      <div class="run-card-top">
        <input class="run-compare-check" type="checkbox" data-id="${r.id}" ${compareChecked ? 'checked' : ''} title="Compare this run" />
        <div class="t"><span class="status ${statusClass}"></span> ${esc(r.name)}</div>
        <button class="run-del-btn" data-id="${r.id}" title="Delete run" aria-label="Delete run" style="margin-left:auto;width:22px;height:22px;border:1px solid var(--border-light);background:transparent;border-radius:6px;color:var(--text-muted);display:grid;place-items:center;cursor:pointer;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      <div class="m">${esc(subtitle)}</div>
      ${pathPill}
      ${r.status === 'running' ? `<div class="progress-bar"><div class="progress-fill" style="width:${r.progress || 0}%"></div></div>` : ''}
    </div>`;
}

function startInlineRunDelete(runId, btnEl) {
  const runs = readJSON(KEY.runs(ACTIVE_VID)) || [];
  const r = runs.find(x => x.id === runId);
  if (!r || !btnEl) return;
  const existing = document.querySelector('.run-confirm-pop');
  if (existing) {
    const same = existing.dataset.runId === runId;
    existing._cleanup?.();
    if (same) return;
  }
  const pop = document.createElement('div');
  pop.className = 'variant-confirm-pop run-confirm-pop';
  pop.dataset.runId = runId;
  pop.innerHTML = `
    <div class="pop-msg">Delete <strong>${esc(r.name)}</strong>?</div>
    <div class="pop-actions">
      <button type="button" class="pop-no">Cancel</button>
      <button type="button" class="pop-yes">Delete</button>
    </div>`;
  document.body.appendChild(pop);
  const rect = btnEl.getBoundingClientRect();
  const popW = pop.offsetWidth;
  let left = rect.right - popW;
  left = Math.min(Math.max(left, 8), window.innerWidth - popW - 8);
  pop.style.left = left + 'px';
  pop.style.top = (rect.bottom + 6) + 'px';

  const cleanup = () => {
    pop.remove();
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey);
  };
  pop._cleanup = cleanup;
  const doDelete = () => {
    const list = readJSON(KEY.runs(ACTIVE_VID)) || [];
    const next = list.filter(x => x.id !== runId);
    writeJSON(KEY.runs(ACTIVE_VID), next);
    RUN_COMPARE_IDS = RUN_COMPARE_IDS.filter(id => id !== runId);
    if (RUN_DETAIL_ID === runId) RUN_DETAIL_ID = next[0]?.id || null;
    cleanup();
    renderRuns();
  };
  const onDoc = (e) => {
    if (pop.contains(e.target) || btnEl.contains(e.target)) return;
    cleanup();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    if (e.key === 'Enter') { e.preventDefault(); doDelete(); }
  };
  pop.querySelector('.pop-yes').addEventListener('click', doDelete);
  pop.querySelector('.pop-no').addEventListener('click', cleanup);
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
  document.addEventListener('keydown', onKey);
}

function showRunDetail(id) {
  const runs = readJSON(KEY.runs(ACTIVE_VID)) || [];
  const r = runs.find(x => x.id === id);
  const host = document.getElementById('runDetail');
  if (!host) return;
  if (!r) { host.innerHTML = ''; return; }
  if (r.status === 'running') {
    const pathPill = r.pathName ? `<span class="run-pill path">Path: ${esc(r.pathName)}</span>` : '<span class="run-pill warn">Full graph run</span>';
    host.innerHTML = `
      <div class="run-detail-head">
        <div class="title">${esc(r.name)}</div>
        <div class="sub">Running · ${Math.round(r.progress || 0)}%</div>
        ${pathPill}
      </div>
      <div style="margin-top:10px;">${'<div class="progress-bar"><div class="progress-fill" style="width:' + (r.progress || 0) + '%"></div></div>'}</div>
      <div style="margin-top:14px;font-size:12px;color:var(--text-muted);">Run flow is highlighting edge groups as execution advances from start nodes to downstream outputs.</div>`;
    return;
  }
  if (r.status === 'failed') {
    const pathPill = r.pathName ? `<span class="run-pill path">Path: ${esc(r.pathName)}</span>` : '';
    host.innerHTML = `
      <div class="run-detail-head">
        <div class="title">${esc(r.name)} — failed</div>
        ${pathPill}
      </div>
      <div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;">The run crashed at ${esc(r.iter || 'unknown step')}. See Logs tab for details.</div>`;
    return;
  }
  const pathPill = r.pathName ? `<span class="run-pill path">Path: ${esc(r.pathName)}</span>` : '<span class="run-pill">Full graph run</span>';
  host.innerHTML = `
    <div class="run-detail-head">
      <div class="title">${esc(r.name)}</div>
      <div class="sub">${formatRelativeTime(r.at)} · ${esc(r.iter)} iters · wall ${formatWallSec(r.wallSec)}</div>
      ${pathPill}
      <div class="run-head-actions">
        <button class="tb-toggle" style="height:28px;" id="rerunBtn">Re-run</button>
        <button class="tb-toggle" style="height:28px;" id="compareWithLatestBtn">Compare…</button>
      </div>
    </div>
    <div class="metric-grid">
      <div class="metric"><div class="lbl">Accuracy</div><div class="num">${_num(r.acc, 0).toFixed(1)}%</div><div class="delta">run metric</div></div>
      <div class="metric"><div class="lbl">F1</div><div class="num">${_num(r.f1, 0).toFixed(2)}</div><div class="delta">macro</div></div>
      <div class="metric"><div class="lbl">Loss</div><div class="num">${_num(r.loss, 0).toFixed(2)}</div><div class="delta" style="color:var(--dot-red);">final</div></div>
      <div class="metric"><div class="lbl">Wall time</div><div class="num">${formatWallSec(r.wallSec)}</div><div class="delta" style="color:var(--text-muted);">${esc(r.iter || '—')}</div></div>
    </div>
    <div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Loss curve</div>
      <div class="loss-curve">${buildLossCurveSvg(r)}</div>
    </div>
    <div class="run-two-col">
      <div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Confusion matrix</div>
        ${renderConfusion(r)}
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Per-class metrics</div>
        ${renderPerClass(r)}
      </div>
    </div>`;
  document.getElementById('rerunBtn')?.addEventListener('click', () => {
    startRun({
      pathId: r.pathId || null,
      pathName: r.pathName || null,
      pathNodeIds: (r.pathNodeIds || []).slice(),
    });
  });
  document.getElementById('compareWithLatestBtn')?.addEventListener('click', () => {
    const other = runs.find(x => x.id !== r.id && x.status !== 'running');
    if (!other) return;
    RUN_COMPARE_IDS = [r.id, other.id];
    renderRuns();
  });
}

function showRunComparison(aId, bId) {
  const runs = readJSON(KEY.runs(ACTIVE_VID)) || [];
  const a = runs.find(x => x.id === aId);
  const b = runs.find(x => x.id === bId);
  const host = document.getElementById('runDetail');
  if (!host) return;
  if (!a || !b) { host.innerHTML = ''; return; }
  const dAcc = _round(_num(a.acc, 0) - _num(b.acc, 0), 1);
  const dF1 = _round(_num(a.f1, 0) - _num(b.f1, 0), 2);
  const dLoss = _round(_num(a.loss, 0) - _num(b.loss, 0), 2);
  host.innerHTML = `
    <div class="run-detail-head">
      <div class="title">Run comparison</div>
      <span class="run-pill active">${esc(a.name)}</span>
      <span class="run-pill active">${esc(b.name)}</span>
      <div class="run-head-actions">
        <button class="tb-toggle" style="height:28px;" id="clearRunCompareBtn">Clear compare</button>
      </div>
    </div>
    <div class="compare-delta">
      Δ Accuracy: ${dAcc >= 0 ? '+' : ''}${dAcc}% · Δ F1: ${dF1 >= 0 ? '+' : ''}${dF1} · Δ Loss: ${dLoss >= 0 ? '+' : ''}${dLoss}
    </div>
    ${renderCompareLossSection(a, b)}
    <div class="compare-grid">
      ${[a, b].map(r => `
        <div class="compare-card">
          <div class="title">${esc(r.name)}${r.pathName ? ` · <span class="run-pill path">Path: ${esc(r.pathName)}</span>` : ''}</div>
          <div class="compare-metric-list">
            <div class="compare-metric-item"><div class="k">Accuracy</div><div class="v">${_num(r.acc, 0).toFixed(1)}%</div></div>
            <div class="compare-metric-item"><div class="k">F1</div><div class="v">${_num(r.f1, 0).toFixed(2)}</div></div>
            <div class="compare-metric-item"><div class="k">Loss</div><div class="v">${_num(r.loss, 0).toFixed(2)}</div></div>
            <div class="compare-metric-item"><div class="k">Wall</div><div class="v">${formatWallSec(r.wallSec)}</div></div>
          </div>
          ${renderPerClass(r)}
        </div>`).join('')}
    </div>`;
  host.querySelectorAll('[data-loss-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      RUN_COMPARE_LOSS_MODE = btn.dataset.lossMode || 'overlay';
      showRunComparison(aId, bId);
    });
  });
  host.querySelectorAll('[data-loss-show]').forEach(chk => {
    chk.addEventListener('change', () => {
      RUN_COMPARE_VISIBLE[chk.dataset.lossShow] = chk.checked;
      if (!RUN_COMPARE_VISIBLE.a && !RUN_COMPARE_VISIBLE.b) RUN_COMPARE_VISIBLE.a = true;
      showRunComparison(aId, bId);
    });
  });
  wireLossCurveHover(host.querySelector('[data-compare-curve="overlay"]'));
  wireLossCurveHover(host.querySelector('[data-compare-curve="delta"]'));
  document.getElementById('clearRunCompareBtn')?.addEventListener('click', () => {
    RUN_COMPARE_IDS = [];
    RUN_COMPARE_LOSS_MODE = 'overlay';
    RUN_COMPARE_VISIBLE = { a: true, b: true };
    renderRuns();
  });
}

// Kick off a simulated run. Stored under the *current* variant's key
// so switching variants mid-run doesn't pollute another variant's feed.
function startRun(opts) {
  if (ACTIVE_RUN) return; // one at a time (wireframe constraint)
  openRunsPanelPeek();
  // Tutorial: advance to "Your run is underway" a beat AFTER the progress bar
  // has visibly started moving, rather than the instant Run is clicked.
  if (window.ConnectifyTutorial) {
    setTimeout(() => {
      try { window.ConnectifyTutorial.notifyAction('run-started', { opts: opts || {} }); } catch (_) {}
    }, 650);
  }
  const cfg = opts || {};
  const vid = ACTIVE_VID;
  const variants = readJSON(KEY.variants) || [];
  const v = variants.find(x => x.id === vid);
  const runs = readJSON(KEY.runs(vid)) || [];
  const pathNodeIds = Array.isArray(cfg.pathNodeIds) ? cfg.pathNodeIds.filter(Boolean) : [];
  const pathName = cfg.pathName || '';
  const run = {
    id: 'r_' + Date.now().toString(36),
    name: `${(v?.name || 'Variant')} · run ${runs.length + 1}`,
    at: Date.now(),
    status: 'running',
    progress: 0,
    vid,
    pathId: cfg.pathId || null,
    pathName: pathName || null,
    pathNodeIds,
    edgeGroups: [],
  };
  run.edgeGroups = getRunEdgeGroups(run);
  runs.push(run);
  writeJSON(KEY.runs(vid), runs);
  RUN_DETAIL_ID = run.id;
  renderRuns();
  applyRunFlowVisual(run);

  ACTIVE_RUN = setInterval(() => {
    const list = readJSON(KEY.runs(vid)) || [];
    const r = list.find(x => x.id === run.id);
    if (!r) {
      clearInterval(ACTIVE_RUN);
      ACTIVE_RUN = null;
      Canvas.setRunFlowEdges(false);
      return;
    }
    r.progress = Math.min(100, _num(r.progress, 0) + 8 + Math.random() * 6);
    let justCompleted = false;
    if (r.progress >= 100) {
      r.status = 'ok';
      r.progress = 100;
      Object.assign(r, makeRunResults(r.at));
      clearInterval(ACTIVE_RUN);
      ACTIVE_RUN = null;
      Canvas.setRunFlowEdges(false);
      justCompleted = true;
    } else {
      applyRunFlowVisual(r);
    }
    writeJSON(KEY.runs(vid), list);
    if (vid === ACTIVE_VID) renderRuns();
    // Once the progress bar completes, grow the Runs drawer to full height
    // (same animation as #bpExpand). Tutorial waits for the transition before
    // advancing so the spotlight measures the expanded panel.
    if (justCompleted && vid === ACTIVE_VID) {
      expandRunsPanelSmoothly(() => {
        try {
          if (window.ConnectifyTutorial) {
            window.ConnectifyTutorial.notifyAction('run-finished', { id: r.id });
          }
          window.dispatchEvent(new Event('resize'));
        } catch (_) {}
      });
    }
  }, 450);
}

function renderLogs() {
  const panel = document.getElementById('bpLogs');
  panel.innerHTML = `<pre class="logs">[13:42:01] <span class="ok">✓</span> Graph compiled — 42 nodes, 67 edges
[13:42:02] <span class="ok">✓</span> Adaptors inserted automatically: 3 (image→tensor, tensor→bbox, text→embedding)
[13:42:03] Loading dataset: nuScenes (v1.1, 1000 scenes)
[13:42:10] <span class="warn">!</span> Low confidence on 14 samples (expected for edge-case evaluation)
[13:42:14] epoch 1/3 · loss 0.54 · acc 76.1%
[13:43:01] epoch 2/3 · loss 0.38 · acc 84.6%
[13:43:49] epoch 3/3 · loss 0.31 · acc <span class="ok">87.3%</span>
[13:43:49] <span class="ok">✓</span> Run complete — results saved</pre>`;
}

const MOCK_PROBLEMS = [
  { sev: 'warn',  msg: 'Unused output on "Sensor Fusion"',        loc: 'n12.out.secondary' },
  { sev: 'error', msg: 'Incompatible types on "Decision Tree"',   loc: 'n18.in.label ← n17.out.tensor' },
];
function renderProblems() {
  const panel = document.getElementById('bpProblems');
  document.getElementById('problemsCount').textContent = MOCK_PROBLEMS.length;
  if (!MOCK_PROBLEMS.length) {
    panel.innerHTML = `<div class="empty-state">No problems detected. Graph is valid.</div>`;
    return;
  }
  panel.innerHTML = `<div class="problems-list">${
    MOCK_PROBLEMS.map(p => `
      <div class="problem-row">
        <span class="sev ${p.sev === 'warn' ? 'warn' : ''}">
          ${p.sev === 'warn'
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`
          }
        </span>
        <span class="msg">${esc(p.msg)}</span>
        <span class="loc">${esc(p.loc)}</span>
      </div>`).join('')
  }</div>`;
}

/* ── Run button ────────────────────────────────────────────
   Opens the bottom panel, switches to Runs tab, (in a real product)
   queues a new run. Wireframe: just opens the panel. */
function initRunButton() {
  document.getElementById('runBtn').addEventListener('click', () => startRun());
}

/* ── Zoom controls ────────────────────────────────────────── */
function fitAllNodesInView() {
  const ids = Canvas.getAllNodes().map(n => n.id);
  if (!ids.length) return;
  const rightEl = document.getElementById('drawerRight');
  const leftEl  = document.getElementById('drawerLeft');
  Canvas.fitToNodes(ids, {
    padding: 10,
    reserve: {
      top: 10, bottom: 10,
      left:  leftEl?.classList.contains('open')  ? 0 : 60,
      right: rightEl?.classList.contains('open') ? 0 : 20,
    },
    maxZoom: 1.5, minZoom: 0.15,
  });
}
function stabilizeEdgeLayout() {
  Canvas.drawEdges();
  requestAnimationFrame(() => {
    renderSubgraphs();
    Canvas.drawEdges();
    requestAnimationFrame(() => Canvas.drawEdges());
  });
}

function _waitMs(ms) {
  return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms | 0)));
}

async function autoLayoutNodes() {
  if (HIST_PREVIEW.id) return;
  if (autoLayoutNodes._running) return;
  if (LAST_AUTO_LAYOUT_EPOCH === CANVAS_CHANGE_EPOCH) return;
  autoLayoutNodes._running = true;
  try {
    // Step 1: collapse expanded groups first so layout targets are stable.
    let collapsedAny = false;
    (SUBGRAPHS.items || []).forEach(g => {
      if (!g.collapsed) {
        g.collapsed = true;
        collapsedAny = true;
      }
    });
    if (collapsedAny) {
      renderSubgraphs();
      Canvas.drawEdges();
      await _waitMs(340);
    }

    const nodes = Canvas.getAllNodes();
    if (nodes.length < 2) {
      fitAllNodesInView();
      LAST_AUTO_LAYOUT_EPOCH = CANVAS_CHANGE_EPOCH;
      return;
    }
    const byId = new Map(nodes.map(n => [n.id, n]));
    const nodeToGroup = new Map();
    (SUBGRAPHS.items || []).forEach(g => (g.nodeIds || []).forEach(id => nodeToGroup.set(id, g.id)));

    const blocks = [];
    const blockById = new Map();
    const nodeToBlock = new Map();

    (SUBGRAPHS.items || []).forEach(g => {
      const ids = (g.nodeIds || []).filter(id => byId.has(id));
      if (!ids.length) return;
      const boxEl = document.querySelector(`.subgraph-box[data-id="${CSS.escape(g.id)}"]`);
      const b = _subgraphBounds(g);
      if (!b && !boxEl) return;
      const x = boxEl ? (parseFloat(boxEl.style.left) || 0) : b.left;
      const y = boxEl ? (parseFloat(boxEl.style.top) || 0) : b.top;
      const width = boxEl ? (parseFloat(boxEl.style.width) || 260) : b.width;
      const height = boxEl ? (parseFloat(boxEl.style.height) || 180) : b.height;
      const block = { id: `sg:${g.id}`, kind: 'subgraph', groupId: g.id, nodeIds: ids, x, y, width, height };
      blocks.push(block);
      blockById.set(block.id, block);
      ids.forEach(id => nodeToBlock.set(id, block.id));
    });

    nodes.forEach(n => {
      if (nodeToGroup.has(n.id)) return;
      const el = document.querySelector(`.node[data-node-id="${CSS.escape(n.id)}"]`);
      const width = Math.max(180, Math.round(el?.offsetWidth || 200));
      const height = Math.max(120, Math.round(el?.offsetHeight || 170));
      const block = { id: `n:${n.id}`, kind: 'node', nodeId: n.id, x: Number(n.x) || 0, y: Number(n.y) || 0, width, height };
      blocks.push(block);
      blockById.set(block.id, block);
      nodeToBlock.set(n.id, block.id);
    });

    if (blocks.length < 2) {
      LAST_AUTO_LAYOUT_EPOCH = CANVAS_CHANGE_EPOCH;
      fitAllNodesInView();
      return;
    }

    const blockIds = blocks.map(b => b.id);
    const succ = new Map(blockIds.map(id => [id, []]));
    const pred = new Map(blockIds.map(id => [id, []]));
    const edges = [];
    for (const c of Canvas.getConnections()) {
      const fromId = c?.from?.[0];
      const toId = c?.to?.[0];
      if (!fromId || !toId || fromId === toId) continue;
      const fromBlock = nodeToBlock.get(fromId);
      const toBlock = nodeToBlock.get(toId);
      if (!fromBlock || !toBlock || fromBlock === toBlock) continue;
      succ.get(fromBlock)?.push(toBlock);
      pred.get(toBlock)?.push(fromBlock);
      edges.push([fromBlock, toBlock]);
    }

    const orphanIds = blockIds.filter(id => (succ.get(id)?.length || 0) === 0 && (pred.get(id)?.length || 0) === 0);
    const connectedIds = blockIds.filter(id => !orphanIds.includes(id));
    const layer = new Map(connectedIds.map(id => [id, 0]));
    for (let pass = 0; pass < connectedIds.length; pass++) {
      let changed = false;
      for (const [a, b] of edges) {
        if (!layer.has(a) || !layer.has(b)) continue;
        const next = (layer.get(a) || 0) + 1;
        if (next > (layer.get(b) || 0)) {
          layer.set(b, next);
          changed = true;
        }
      }
      if (!changed) break;
    }
    let minLayer = Infinity;
    layer.forEach(v => { if (v < minLayer) minLayer = v; });
    if (layer.size && isFinite(minLayer) && minLayer !== 0) layer.forEach((v, id) => layer.set(id, v - minLayer));

    const layers = new Map();
    connectedIds.forEach(id => {
      const l = layer.get(id) || 0;
      if (!layers.has(l)) layers.set(l, []);
      layers.get(l).push(id);
    });

    const ROW_GAP = 92;
    const COL_GAP = 220;
    const minX = Math.min(...blocks.map(b => Number(b.x) || 0));
    const avgY = blocks.reduce((sum, b) => sum + (Number(b.y) || 0), 0) / Math.max(1, blocks.length);
    const startX = Math.max(40, minX);
    const placedCenterY = new Map();
    const blockLayout = new Map();
    const blockHeight = id => blockById.get(id)?.height || 160;
    const blockWidth = id => blockById.get(id)?.width || 240;

    if (orphanIds.length) {
      const colIds = [...orphanIds].sort((a, b) => (blockById.get(a)?.y || 0) - (blockById.get(b)?.y || 0));
      const totalColH = colIds.reduce((sum, id) => sum + blockHeight(id), 0) + Math.max(0, colIds.length - 1) * ROW_GAP;
      let cursorY = Math.round(avgY - (totalColH / 2));
      const x = startX;
      colIds.forEach(id => {
        const h = blockHeight(id);
        const y = Math.round(cursorY);
        blockLayout.set(id, { x, y });
        placedCenterY.set(id, y + (h / 2));
        cursorY += h + ROW_GAP;
      });
    }

    const layerKeys = Array.from(layers.keys()).sort((a, b) => a - b);
    const layerWidths = new Map(layerKeys.map(l => [l, Math.max(...(layers.get(l) || []).map(id => blockWidth(id)), 220)]));
    let currentX = startX + (orphanIds.length ? (Math.max(...orphanIds.map(id => blockWidth(id)), 220) + COL_GAP) : 0);
    const layerX = new Map();
    layerKeys.forEach(l => {
      layerX.set(l, currentX);
      currentX += (layerWidths.get(l) || 220) + COL_GAP;
    });

    for (const l of layerKeys) {
      const colIds = layers.get(l) || [];
      colIds.sort((a, b) => {
        const score = (id) => {
          const ps = (pred.get(id) || []).filter(pid => placedCenterY.has(pid));
          if (!ps.length) return (blockById.get(id)?.y || 0) + (blockHeight(id) / 2);
          return ps.reduce((sum, pid) => sum + (placedCenterY.get(pid) || 0), 0) / ps.length;
        };
        return score(a) - score(b);
      });
      const totalColH = colIds.reduce((sum, id) => sum + blockHeight(id), 0) + Math.max(0, colIds.length - 1) * ROW_GAP;
      let cursorY = Math.round(avgY - (totalColH / 2));
      const x = layerX.get(l) || startX;
      colIds.forEach(id => {
        const h = blockHeight(id);
        const y = Math.round(cursorY);
        blockLayout.set(id, { x, y });
        placedCenterY.set(id, y + (h / 2));
        cursorY += h + ROW_GAP;
      });
    }

    const layout = {};
    blocks.forEach(block => {
      const target = blockLayout.get(block.id);
      if (!target) return;
      const dx = target.x - block.x;
      const dy = target.y - block.y;
      if (block.kind === 'node') {
        layout[block.nodeId] = { x: target.x, y: target.y };
        return;
      }
      (block.nodeIds || []).forEach(id => {
        const n = byId.get(id);
        if (!n) return;
        layout[id] = {
          x: Math.round((Number(n.x) || 0) + dx),
          y: Math.round((Number(n.y) || 0) + dy),
        };
      });
    });

    const finish = () => {
      SUBGRAPHS.layoutAnimating = false;
      renderSubgraphs();
      Canvas.drawEdges();
      LAST_AUTO_LAYOUT_EPOCH = CANVAS_CHANGE_EPOCH;
      requestAnimationFrame(() => fitAllNodesInView());
    };
    SUBGRAPHS.layoutAnimating = true;
    const changed = Canvas.applyNodeLayout(layout, {
      animate: true,
      duration: 500,
      easing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      onFrame: () => {
        renderSubgraphs();
        Canvas.drawEdges();
      },
      onComplete: finish,
    });
    if (!changed) finish();
  } finally {
    autoLayoutNodes._running = false;
  }
}

function initZoomControls() {
  document.getElementById('zoomIn').addEventListener('click', () => Canvas.zoomIn());
  document.getElementById('zoomOut').addEventListener('click', () => Canvas.zoomOut());
  document.getElementById('zoomFit').addEventListener('click', fitAllNodesInView);
  document.getElementById('autoLayoutBtn')?.addEventListener('click', autoLayoutNodes);
  // Undo/redo wire-up is done in initHistoryStack so the stacks are ready
  // before Canvas.onChange fires.
  document.getElementById('undoBtn').addEventListener('click', historyUndo);
  document.getElementById('redoBtn').addEventListener('click', historyRedo);
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (e.shiftKey) historyRedo(); else historyUndo();
    } else if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      historyRedo();
    }
  });
}

/* ── In-session undo/redo stack ────────────────────────────
   Canvas.onChange fires after any structural mutation (add/remove node,
   add/remove connection, node drag commit). We snapshot before every
   mutation into UNDO_STACK so one "undo" replays the pre-mutation state.
   Variant switches and explicit revertToHistory() reset both stacks so
   you can't cross variant boundaries with ⌘Z. */
const UNDO_STACK = [];
const REDO_STACK = [];
const MAX_UNDO = 50;
let HISTORY_APPLYING = false; // suppress change events while we're restoring
let CANVAS_CHANGE_EPOCH = 0;
let LAST_AUTO_LAYOUT_EPOCH = -1;

function captureCanvasState() {
  return {
    nodes: Canvas.getAllNodes().map(n => ({
      id: n.id, type: n.type, label: n.label || n.name, color: n.color, icon: n.icon,
      user: n.user, x: n.x, y: n.y,
      inputs:  (n.inputs  || []).map(p => ({ ...p })),
      outputs: (n.outputs || []).map(p => ({ ...p })),
      description: n.description, fn: n.fn, fw: n.fw, by: n.by,
      views: n.views, downloads: n.downloads,
    })),
    connections: Canvas.getConnections().map(c => Canvas.snapshotConnection(c)),
    subgraphs: getSubgraphSnapshot(),
  };
}

function restoreCanvasState(state) {
  HISTORY_APPLYING = true;
  try {
    Canvas.clear();
    (state.nodes || []).forEach(n => Canvas.addNode({ ...n }));
    (state.connections || []).forEach(c => Canvas.addConnection(c.from, c.to));
    Canvas.drawEdges();
    initSubgraphFeature(state.subgraphs || []);
  } finally {
    HISTORY_APPLYING = false;
  }
}

function pushUndoSnapshot() {
  UNDO_STACK.push(captureCanvasState());
  if (UNDO_STACK.length > MAX_UNDO) UNDO_STACK.shift();
  REDO_STACK.length = 0; // new branch invalidates redo history
  refreshUndoRedoUI();
}

function historyUndo() {
  if (UNDO_STACK.length === 0) return;
  REDO_STACK.push(captureCanvasState());
  const prev = UNDO_STACK.pop();
  restoreCanvasState(prev);
  refreshUndoRedoUI();
}

function historyRedo() {
  if (REDO_STACK.length === 0) return;
  UNDO_STACK.push(captureCanvasState());
  const next = REDO_STACK.pop();
  restoreCanvasState(next);
  refreshUndoRedoUI();
}

function resetUndoRedo() {
  UNDO_STACK.length = 0;
  REDO_STACK.length = 0;
  refreshUndoRedoUI();
}

function refreshUndoRedoUI() {
  const u = document.getElementById('undoBtn');
  const r = document.getElementById('redoBtn');
  if (u) u.disabled = UNDO_STACK.length === 0;
  if (r) r.disabled = REDO_STACK.length === 0;
}

/** Node ids targeted by Delete/Backspace (marquee/multi-select, else inspector focus). */
function _keyboardDeleteTargetNodeIds() {
  const ids = [...SUBGRAPHS.selectedNodeIds].filter(id => Canvas.getNode(id));
  if (ids.length) return ids;
  if (typeof _currentInspectorNode !== 'undefined' && _currentInspectorNode?.id) {
    const id = _currentInspectorNode.id;
    if (Canvas.getNode(id)) return [id];
  }
  const el = document.querySelector('.node.selected[data-node-id]');
  const id = el?.dataset?.nodeId;
  if (id && Canvas.getNode(id)) return [id];
  return [];
}

function _clearInspectorIfNodeDeleted(nodeId) {
  if (typeof _currentInspectorNode === 'undefined' || !_currentInspectorNode) return;
  if (_currentInspectorNode.id !== nodeId) return;
  _currentInspectorNode = null;
  const empty = document.getElementById('inspectorEmpty');
  const shell = document.getElementById('inspectorShell');
  const detail = document.getElementById('inspectorDetail');
  if (empty) empty.style.display = '';
  if (shell) shell.style.display = 'none';
  if (detail) detail.style.display = 'none';
}

/** Delete key on selected nodes (no confirm pop — kebab menu still confirms). */
function _deleteNodesByKeyboard(ids) {
  if (!ids?.length) return false;
  if (PATH_DRAW.active) return false;
  if (document.querySelector('.variant-confirm-pop')) return false;

  const remove = (id) => {
    Canvas.removeNode(id);
    _clearInspectorIfNodeDeleted(id);
  };

  if (ids.length === 1) {
    remove(ids[0]);
  } else {
    if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot();
    HISTORY_APPLYING = true;
    try {
      ids.forEach(remove);
    } finally {
      HISTORY_APPLYING = false;
    }
  }

  if (typeof _setSelectedNodes === 'function') _setSelectedNodes([]);
  document.querySelectorAll('.node.selected').forEach(n => n.classList.remove('selected'));
  return true;
}

/* Delete key removes the active edge (break-link bubble) or selected node(s). */
function initActiveEdgeDeleteKey() {
  document.addEventListener('keydown', e => {
    const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace';
    if (!isDeleteKey) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && t.matches && t.matches('input, textarea, [contenteditable="true"]')) return;
    if (t && t.closest && t.closest('input, textarea, [contenteditable="true"]')) return;

    if (typeof Canvas.removeActiveEdgeSelection === 'function') {
      if (typeof pushUndoSnapshot === 'function') pushUndoSnapshot();
      if (Canvas.removeActiveEdgeSelection()) {
        e.preventDefault();
        return;
      }
    }

    const nodeIds = _keyboardDeleteTargetNodeIds();
    if (_deleteNodesByKeyboard(nodeIds)) e.preventDefault();
  });
}

/* ── Right-click canvas context menu ──────────────────────
   Surfaces the handful of actions a user most often wants at a specific
   spot on the canvas. "Add a node here" opens the Discover drawer (the
   home for anything you'd place); "Drop a comment" primes the comment
   tool; the viewport shortcuts mirror the bottom-left controls for
   discoverability. Right-clicking a node instead opens that node's
   kebab menu so we don't duplicate per-node actions here. */
function initCanvasContextMenu() {
  const canvasEl = document.getElementById('canvas');
  const menu = document.getElementById('canvasCtxMenu');
  if (!canvasEl || !menu) return;

  function hide() { menu.classList.remove('open'); }

  canvasEl.addEventListener('contextmenu', e => {
    // Right-clicking a node hands off to its kebab menu instead.
    if (e.target.closest('.node')) return;
    if (e.target.closest('.comment-card')) return;
    e.preventDefault();

    // Stash where the user right-clicked in world coords so "Drop a comment"
    // creates the card exactly where they clicked (not at a random canvas
    // center), and "Add a node" can drop at that location later.
    const world = Canvas.clientToWorld(e.clientX, e.clientY);
    menu.dataset.worldX = world.x;
    menu.dataset.worldY = world.y;

    menu.innerHTML = `
      <div class="ctx-item" data-act="add-node">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        Add a node…
      </div>
      <div class="ctx-item" data-act="add-comment">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Drop a comment
      </div>
      <div class="ctx-item" data-act="start-path">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5C10 13 14 11 17.5 6.5" stroke-dasharray="3 3"/></svg>
        Draw a path
      </div>
      <div class="ctx-item" data-act="sg-marquee">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 3"/><path d="M9 9h6v6H9z"/></svg>
        Draw subgraph boundary
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" data-act="fit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M20 8V5a1 1 0 0 0-1-1h-3"/><path d="M4 16v3a1 1 0 0 0 1 1h3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/></svg>
        Zoom to fit
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" data-act="undo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
        Undo<span class="ctx-shortcut">⌘Z</span>
      </div>`;

    // Position: fixed at cursor, clamped to viewport.
    menu.classList.add('open');
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const x = Math.min(e.clientX, vw - rect.width  - 8);
    const y = Math.min(e.clientY, vh - rect.height - 8);
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';

    menu.querySelectorAll('.ctx-item').forEach(i => i.addEventListener('click', () => {
      const act = i.dataset.act;
      hide();
      if (act === 'add-node') {
        // Open the Discover drawer on the left so the user can pick what
        // to add next to where they right-clicked.
        const tgl = document.getElementById('toolDiscover');
        const leftEl = document.getElementById('drawerLeft');
        if (leftEl && !leftEl.classList.contains('open')) tgl?.click();
        else {
          // Already open — just make sure the Discover tab is active.
          leftEl?.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'discover'));
          leftEl?.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelDiscover'));
          document.getElementById('discoverSearch').style.display = 'flex';
          document.getElementById('discoverQuery')?.focus();
        }
      } else if (act === 'add-comment') {
        // Skip placement mode entirely — we already know the exact spot.
        const x = parseFloat(menu.dataset.worldX) || 0;
        const y = parseFloat(menu.dataset.worldY) || 0;
        openCommentModal({ mode: 'create', x, y, tags: [] });
      } else if (act === 'start-path') {
        pathDrawStart();
      } else if (act === 'sg-marquee') {
        if (PATH_DRAW.active) pathDrawCancel();
        document.getElementById('toolSubgraphMarquee')?.click();
      } else if (act === 'fit') {
        document.getElementById('zoomFit')?.click();
      } else if (act === 'undo') {
        historyUndo();
      }
    }));
  });

  document.addEventListener('mousedown', e => {
    if (!menu.classList.contains('open')) return;
    if (menu.contains(e.target)) return;
    hide();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  window.addEventListener('blur', hide);
}

function initHistoryStack() {
  // Snapshot state BEFORE each mutation: stash the most recent state in
  // `lastState` via a throttled capture, then push the prior snapshot when
  // a change fires. This matches what users expect from ⌘Z ("undo the
  // thing I just did").
  let lastState = captureCanvasState();
  Canvas.onChange((kind) => {
    renderSubgraphs();
    CANVAS_CHANGE_EPOCH += 1;
    // Re-infer auto start/end roles after any structural mutation
    // (add/remove node, add/remove connection, layout). Cheap O(N+E).
    recomputeAutoRoles();
    // Tutorial Step 11: an edge was just drawn between two nodes.
    // Skip while history is being applied — undo/redo, variant switches and
    // demo-path seeding all replay 'add-connection' under HISTORY_APPLYING, and
    // those should NOT count as the user dragging a new edge.
    if (kind === 'add-connection'
        && !HISTORY_APPLYING
        && window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('connection-added', { kind });
    }
    if (HISTORY_APPLYING) { lastState = captureCanvasState(); return; }
    UNDO_STACK.push(lastState);
    if (UNDO_STACK.length > MAX_UNDO) UNDO_STACK.shift();
    REDO_STACK.length = 0;
    lastState = captureCanvasState();
    refreshUndoRedoUI();
  });
}

/* ── Find bar (Cmd/Ctrl+F) ─────────────────────────────────
   Simplified version: searches node names, pans/zooms to matches
   via Canvas.fitToNodes. Enter cycles through matches. */
/* ── Find (Cmd/Ctrl+F) ─────────────────────────────────────
   Live-filters node labels as the user types, shows "N matches" in
   the bar, and on Enter pans/zooms the canvas to fit every match with
   a flash (drop-in animation) so the target(s) stand out. Matches
   the old build's behavior. */
function initFindBar() {
  const bar = document.getElementById('findBar');
  const input = document.getElementById('findInput');
  const count = document.getElementById('findCount');
  const close = document.getElementById('findClose');
  const prev = document.getElementById('findPrev');
  const next = document.getElementById('findNext');
  const canvasEl = document.getElementById('canvas');
  let activeMatchIds = [];
  let findDanceTimer = null;
  let matches = [];   // node objects matching the query, in stable order
  let cursor = -1;    // index of the active match within `matches`

  const matchesFor = (q) => {
    const qn = q.trim().toLowerCase();
    if (!qn) return [];
    return Canvas.getAllNodes()
      .filter(n => (n.label || n.name || '').toLowerCase().includes(qn));
  };
  const clearHighlights = () => {
    document.querySelectorAll('.node.find-match-active')
      .forEach(el => el.classList.remove('find-match-active'));
    if (!activeMatchIds.length) return;
    activeMatchIds.forEach(id => {
      const el = document.querySelector(`.node[data-node-id="${id}"]`);
      el?.classList.remove('find-match');
    });
    activeMatchIds = [];
  };
  const applyDimming = (ids) => {
    const keep = new Set(ids);
    document.querySelectorAll('.node').forEach(el => {
      const id = el.dataset.nodeId;
      const dim = ids.length > 0 && !keep.has(id);
      el.classList.toggle('find-dim', dim);
    });
  };
  const applyHighlights = (ids) => {
    const nextSet = new Set(ids);
    activeMatchIds.forEach(id => {
      if (nextSet.has(id)) return;
      const el = document.querySelector(`.node[data-node-id="${id}"]`);
      el?.classList.remove('find-match');
    });
    ids.forEach(id => {
      const el = document.querySelector(`.node[data-node-id="${id}"]`);
      el?.classList.add('find-match');
    });
    activeMatchIds = ids.slice();
  };
  const danceNodes = (ids) => {
    ids.forEach(id => {
      const el = document.querySelector(`.node[data-node-id="${id}"]`);
      if (!el) return;
      el.classList.remove('find-dance');
      void el.offsetWidth;
      el.classList.add('find-dance');
      setTimeout(() => el.classList.remove('find-dance'), 560);
    });
  };
  const getReserve = () => {
    const occ = (typeof getCanvasOcclusionReserve === 'function')
      ? getCanvasOcclusionReserve()
      : { left: 0, right: 0, top: 0, bottom: 0 };
    return {
      left:   (occ.left   || 0) + 18,
      right:  (occ.right  || 0) + 18,
      top:    (occ.top    || 0) + 72,   // topbar + find bar
      bottom: (occ.bottom || 0) + 22,
    };
  };
  // Center the active match while preserving the user's current zoom.
  // `ifNeeded` skips the pan when the node is already comfortably on-screen,
  // so stepping between nearby matches doesn't jiggle the view.
  const centerOn = (id) => {
    const z = (Canvas.getTransform && Canvas.getTransform().zoom) || 1;
    Canvas.fitToNodes([id], {
      padding: 80,
      reserve: getReserve(),
      maxZoom: z,
      minZoom: z,
      ifNeeded: true,
    });
  };
  const setActive = (idx) => {
    if (!matches.length) { cursor = -1; return; }
    cursor = ((idx % matches.length) + matches.length) % matches.length;
    const activeId = matches[cursor].id;
    document.querySelectorAll('.node.find-match-active')
      .forEach(el => el.classList.remove('find-match-active'));
    document.querySelector(`.node[data-node-id="${activeId}"]`)
      ?.classList.add('find-match-active');
    count.textContent = (cursor + 1) + ' of ' + matches.length;
    centerOn(activeId);
    if (findDanceTimer) { clearTimeout(findDanceTimer); findDanceTimer = null; }
    findDanceTimer = setTimeout(() => {
      danceNodes([activeId]);
      findDanceTimer = null;
    }, 200);
  };
  const syncMatches = () => {
    const q = input.value.trim();
    if (!q) {
      clearHighlights();
      applyDimming([]);
      count.textContent = '';
      matches = [];
      cursor = -1;
      return;
    }
    matches = matchesFor(q);
    const ids = matches.map(n => n.id);
    applyHighlights(ids);
    applyDimming(ids);
    if (!ids.length) {
      count.textContent = 'no matches';
      cursor = -1;
      if (findDanceTimer) { clearTimeout(findDanceTimer); findDanceTimer = null; }
      return;
    }
    setActive(0);
  };
  const updateCount = () => { syncMatches(); };
  const step = (dir) => {
    if (!matches.length) return;
    setActive(cursor + dir);
  };

  function open()  {
    // Re-pressing Cmd+F while the bar is open re-selects the query (browser-style).
    if (!bar.hidden && input.value) { input.focus(); input.select(); return; }
    bar.hidden = false;
    input.value = '';
    count.textContent = '';
    matches = [];
    cursor = -1;
    if (findDanceTimer) { clearTimeout(findDanceTimer); findDanceTimer = null; }
    clearHighlights();
    applyDimming([]);
    input.focus();
  }
  function closeBar() {
    bar.hidden = true;
    input.value = '';
    count.textContent = '';
    matches = [];
    cursor = -1;
    if (findDanceTimer) { clearTimeout(findDanceTimer); findDanceTimer = null; }
    clearHighlights();
    applyDimming([]);
  }

  document.addEventListener('keydown', e => {
    const isFindShortcut = (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'f';
    if (isFindShortcut) { e.preventDefault(); open(); return; }
    const isFindNext = (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'g';
    if (isFindNext && !bar.hidden) { e.preventDefault(); step(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Escape' && !bar.hidden) closeBar();
  });
  close.addEventListener('click', closeBar);
  prev?.addEventListener('click', () => { step(-1); input.focus(); });
  next?.addEventListener('click', () => { step(1);  input.focus(); });
  input.addEventListener('input', updateCount);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')          { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape')    { e.preventDefault(); closeBar(); }
  });
  canvasEl?.addEventListener('mousedown', e => {
    if (bar.hidden) return;
    if (bar.contains(e.target)) return;
    if (e.target.closest('.node.find-match')) return;
    closeBar();
  });
}

/* ── Minimap ───────────────────────────────────────────────
   A 200×140 canvas that paints the bounding boxes of every node in
   world space, scaled to fit. Refreshed every ~1s (cheap enough for
   wireframe; a real build would redraw on transform/mutation). */
function initMinimap() {
  const mm = document.getElementById('minimap');
  const cnv = document.getElementById('minimapCanvas');
  const zoomHint = document.getElementById('mmZoomHint');
  function draw() {
    if (!mm.isConnected) return;
    const rect = mm.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width, h = rect.height;
    cnv.width = w * dpr; cnv.height = h * dpr;
    cnv.style.width = w + 'px'; cnv.style.height = h + 'px';
    const ctx = cnv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#0a1122' : '#fafbfd';
    ctx.fillRect(0, 0, w, h);

    const nodes = Canvas.getAllNodes();
    if (!nodes.length) return;
    // Compute world-space bounds.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);  minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 200); maxY = Math.max(maxY, n.y + 120);
    });
    const pad = 12;
    const scale = Math.min((w - pad*2) / (maxX - minX), (h - pad*2 - 22) / (maxY - minY));
    const offX = pad + ((w - pad*2) - (maxX - minX) * scale) / 2 - minX * scale;
    const offY = 22 + pad + ((h - pad*2 - 22) - (maxY - minY) * scale) / 2 - minY * scale;

    // Draw edges (thin grey). Canvas connections are [nodeId, dir, portName]
    // tuples on `from`/`to`; we only need the node id for a rough minimap line.
    ctx.strokeStyle = isDark ? '#64748b' : '#cbd5e1';
    ctx.lineWidth = 0.5;
    Canvas.getConnections().forEach(c => {
      const s = nodes.find(n => n.id === c.from[0]);
      const e = nodes.find(n => n.id === c.to[0]);
      if (!s || !e) return;
      ctx.beginPath();
      ctx.moveTo(s.x * scale + offX + 100*scale, s.y * scale + offY + 60*scale);
      ctx.lineTo(e.x * scale + offX + 100*scale, e.y * scale + offY + 60*scale);
      ctx.stroke();
    });

    // Draw nodes.
    nodes.forEach(n => {
      const x = n.x * scale + offX;
      const y = n.y * scale + offY;
      const nw = 200 * scale;
      const nh = 120 * scale;
      ctx.fillStyle = isDark ? '#1e293b' : '#e0e7ef';
      ctx.strokeStyle = isDark ? '#334160' : '#b4c0d3';
      ctx.fillRect(x, y, nw, nh);
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, nw, nh);
    });

    // Draw viewport rect.
    const t = Canvas.getTransform();
    const ca = document.getElementById('canvasArea').getBoundingClientRect();
    const vw = ca.width / t.zoom, vh = ca.height / t.zoom;
    const vx = -t.panX / t.zoom, vy = -t.panY / t.zoom;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx * scale + offX, vy * scale + offY, vw * scale, vh * scale);

    zoomHint.textContent = Math.round(t.zoom * 100) + '%';
  }
  draw();
  setInterval(draw, 1000);
  // Click to recenter.
  cnv.addEventListener('click', () => {
    const nodes = Canvas.getAllNodes();
    if (nodes.length) Canvas.fitToNodes(nodes.map(n => n.id), { padding: 80 });
  });
}

/* ── Node role tags (start/end) ───────────────────────────
   Manual marking via node.tags[]; auto-inference via node._autoRole.
   Two-layer system:
     - node.tags includes 'start'/'end' → manual mark (persisted)
     - node._autoRole === 'start'/'end' → inferred (transient, not persisted)
   Rendering shows manual badges solid, auto badges dashed/dim.
   Manual marks suppress auto for that role across the whole graph. */

/* Recompute _autoRole on every node. Only assigns when the graph is
   unambiguous: either a single node OR a strictly linear chain
   (1 connected component, every node has in/out degree ≤ 1, no cycles).
   Any manual 'start' tag suppresses all auto-start; same for 'end'. */
function recomputeAutoRoles() {
  if (typeof Canvas === 'undefined' || !Canvas.getAllNodes) return;
  const nodes = Canvas.getAllNodes();
  const conns = Canvas.getConnections() || [];

  // Build in/out degrees and an undirected adjacency for component check.
  const inDeg = new Map();
  const outDeg = new Map();
  const adj = new Map();
  nodes.forEach(n => { inDeg.set(n.id, 0); outDeg.set(n.id, 0); adj.set(n.id, new Set()); });
  conns.forEach(c => {
    const from = c?.from?.[0], to = c?.to?.[0];
    if (!from || !to || from === to) return;
    if (!inDeg.has(from) || !inDeg.has(to)) return;
    outDeg.set(from, outDeg.get(from) + 1);
    inDeg.set(to, inDeg.get(to) + 1);
    adj.get(from).add(to);
    adj.get(to).add(from);
  });

  // Linear-chain check: every node has in≤1 AND out≤1, and (if any nodes)
  // the graph is a single connected component. Cycles are allowed by the
  // degree check alone; we don't auto-tag cycles since they have no 0-deg
  // endpoints anyway.
  let isLinear = true;
  for (const n of nodes) {
    if (inDeg.get(n.id) > 1 || outDeg.get(n.id) > 1) { isLinear = false; break; }
  }
  if (isLinear && nodes.length > 1) {
    // BFS from any node; must reach all.
    const seen = new Set();
    const queue = [nodes[0].id];
    seen.add(nodes[0].id);
    while (queue.length) {
      const id = queue.shift();
      adj.get(id).forEach(nbr => { if (!seen.has(nbr)) { seen.add(nbr); queue.push(nbr); } });
    }
    if (seen.size !== nodes.length) isLinear = false;
  }

  // Suppression: a manual mark anywhere kills auto for that role.
  const hasManualStart = nodes.some(n => Array.isArray(n.tags) && n.tags.includes('start'));
  const hasManualEnd   = nodes.some(n => Array.isArray(n.tags) && n.tags.includes('end'));

  const changed = [];
  nodes.forEach(n => {
    let next = null;
    if (isLinear) {
      if (nodes.length === 1) {
        // Single node: auto-start only (per spec).
        next = 'start';
      } else {
        if (inDeg.get(n.id) === 0) next = 'start';
        else if (outDeg.get(n.id) === 0) next = 'end';
      }
    }
    if (next === 'start' && hasManualStart) next = null;
    if (next === 'end'   && hasManualEnd)   next = null;
    if ((n._autoRole || null) !== next) {
      n._autoRole = next;
      changed.push(n.id);
    }
  });
  changed.forEach(id => Canvas.renderNode(id));
  // Subgroup bounds factor in role-badge overhang (see _subgraphBounds);
  // re-render so any expanded subgroup containing a changed node grows or
  // shrinks its top padding to match.
  if (changed.length && typeof renderSubgraphs === 'function') {
    renderSubgraphs();
  }
}

/* Return node IDs that carry the given role, either manually (node.tags)
   or via auto-inference (node._autoRole). Used by paths integration to
   seed/validate path drawing. */
function findNodesWithRole(role) {
  if (typeof Canvas === 'undefined' || !Canvas.getAllNodes) return [];
  return Canvas.getAllNodes()
    .filter(n => (Array.isArray(n.tags) && n.tags.includes(role)) || n._autoRole === role)
    .map(n => n.id);
}

function nodeHasRole(nodeId, role) {
  const n = Canvas.getNode && Canvas.getNode(nodeId);
  if (!n) return false;
  return (Array.isArray(n.tags) && n.tags.includes(role)) || n._autoRole === role;
}

/* Move a role from one node to another. Handles both manual (tag removed
   from source, added to target) and auto-inferred (no removal needed; the
   manual mark on the target will suppress the source's auto-role via
   recomputeAutoRoles). Idempotent if source === target. */
function moveNodeRole(sourceId, targetId, role) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  if (role !== 'start' && role !== 'end') return;
  const src = Canvas.getNode(sourceId);
  const tgt = Canvas.getNode(targetId);
  if (!tgt) return;
  // Remove manual tag from source (no-op for auto-only badges).
  if (src && Array.isArray(src.tags)) {
    const i = src.tags.indexOf(role);
    if (i >= 0) src.tags.splice(i, 1);
  }
  if (!Array.isArray(tgt.tags)) tgt.tags = [];
  if (!tgt.tags.includes(role)) tgt.tags.push(role);
  snapshotActiveVariant();
  Canvas.renderNode(sourceId);
  Canvas.renderNode(targetId);
  recomputeAutoRoles();
  if (typeof renderSubgraphs === 'function') renderSubgraphs();
  // If inspector is open on either node, refresh it.
  if (typeof renderInspectorSubtab === 'function' && _currentInspectorNode) {
    if (_currentInspectorNode.id === sourceId || _currentInspectorNode.id === targetId) {
      const nd = Canvas.getNode(_currentInspectorNode.id);
      if (nd) {
        _currentInspectorNode.tags = nd.tags;
        renderInspectorSubtab();
      }
    }
  }
}

/* Drag-to-transfer for role badges. Canvas fires onRoleBadgeDragStart when
   the user mousedowns a Start/End badge; we take over with document-level
   move/up to follow the cursor with a ghost badge, highlight other nodes
   as drop targets, and finalize the transfer on release. */
function initRoleBadgeDragTransfer() {
  if (typeof Canvas === 'undefined' || !Canvas.onRoleBadgeDragStart) return;
  Canvas.onRoleBadgeDragStart((sourceId, role, downEvent, badgeEl) => {
    // Hide the original (visibility, not display — preserves layout) so the
    // ghost reads as the real tag being lifted off rather than a duplicate.
    // Don't copy the source's bounding box: getBoundingClientRect captures
    // the post-canvas-zoom visual size, which would make the ghost huge at
    // 2x zoom or tiny at 0.5x. The ghost lives in document.body (outside
    // the canvas transform), so let it render at its natural CSS size so
    // it stays consistent regardless of how zoomed the canvas is.
    const ghost = badgeEl.cloneNode(true);
    ghost.classList.add('node-role-badge-ghost');
    ghost.style.left = downEvent.clientX + 'px';
    ghost.style.top  = downEvent.clientY + 'px';
    document.body.appendChild(ghost);
    badgeEl.classList.add('dragging');
    document.body.style.cursor = 'grabbing';
    // Mark every OTHER node as a drop candidate.
    const inner = Canvas.getCanvasInner();
    const allNodes = inner ? Array.from(inner.querySelectorAll('.node')) : [];
    allNodes.forEach(n => { if (n.dataset.nodeId !== sourceId) n.classList.add('role-drop-candidate'); });
    let lastHover = null;
    const findTargetUnder = (x, y) => {
      // Temporarily hide the ghost so elementFromPoint sees what's under.
      ghost.style.display = 'none';
      const el = document.elementFromPoint(x, y);
      ghost.style.display = '';
      if (!el) return null;
      const node = el.closest('.node[data-node-id]');
      if (!node) return null;
      if (node.dataset.nodeId === sourceId) return null;
      return node;
    };
    const onMove = (e) => {
      ghost.style.left = e.clientX + 'px';
      ghost.style.top  = e.clientY + 'px';
      const target = findTargetUnder(e.clientX, e.clientY);
      if (target !== lastHover) {
        if (lastHover) lastHover.classList.remove('role-drop-hover');
        if (target)    target.classList.add('role-drop-hover');
        lastHover = target;
      }
    };
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      document.removeEventListener('keydown', onKey, true);
      ghost.remove();
      // If the original badge element still exists (cancel case), un-hide it.
      // On successful drop, renderNode rebuilds the badge so this is a no-op.
      badgeEl.classList.remove('dragging');
      document.body.style.cursor = '';
      allNodes.forEach(n => n.classList.remove('role-drop-candidate', 'role-drop-hover'));
    };
    const onUp = (e) => {
      const target = findTargetUnder(e.clientX, e.clientY);
      cleanup();
      if (target) moveNodeRole(sourceId, target.dataset.nodeId, role);
    };
    const onKey = (e) => { if (e.key === 'Escape') cleanup(); };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    document.addEventListener('keydown', onKey, true);
  });
}

function toggleNodeRole(nodeId, role) {
  const nd = Canvas.getNode(nodeId);
  if (!nd || (role !== 'start' && role !== 'end')) return;
  if (!Array.isArray(nd.tags)) nd.tags = [];
  const i = nd.tags.indexOf(role);
  if (i >= 0) nd.tags.splice(i, 1);
  else nd.tags.push(role);
  snapshotActiveVariant();
  Canvas.renderNode(nodeId);
  // Manual mark may have just suppressed/freed auto-roles across the graph.
  // recomputeAutoRoles re-renders affected nodes and (if anything flipped)
  // calls renderSubgraphs. If only the manual tag changed and no auto-role
  // flipped, we still need a subgroup re-render so its bounds account for
  // the badge appearing/disappearing.
  recomputeAutoRoles();
  if (typeof renderSubgraphs === 'function') renderSubgraphs();
  // If the inspector is open on this node, refresh it so the toggle reflects.
  if (typeof renderInspectorSubtab === 'function'
      && _currentInspectorNode && _currentInspectorNode.id === nodeId) {
    _currentInspectorNode.tags = nd.tags;
    renderInspectorSubtab();
  }
}

/* ── Kebab menu on nodes ──────────────────────────────────
   Tiny stub — just a Delete item, for completeness. Canvas's
   onKebabClick surfaces the trigger location. */
function initKebab() {
  const menu = document.getElementById('kebabMenu');
  function hide() { menu.classList.remove('open'); menu._nodeId = null; }
  // Canvas fires onKebabClick with (nodeId, kebabEl); we position the menu
  // relative to the kebab button that was clicked.
  Canvas.onKebabClick((nodeId, kebabEl) => {
    const deleteDisabled = PATH_DRAW.active;
    const nd0 = Canvas.getNode(nodeId);
    const tags0 = Array.isArray(nd0?.tags) ? nd0.tags : [];
    const isStart = tags0.includes('start');
    const isEnd   = tags0.includes('end');
    const checkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const startIcon = isStart ? checkSvg : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
    const endIcon   = isEnd   ? checkSvg : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>`;
    menu._nodeId = nodeId;
    menu.innerHTML = `
      <div class="kebab-item" data-action="inspect">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        Open in inspector
      </div>
      <div class="kebab-item" data-action="start-path">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5C10 13 14 11 17.5 6.5" stroke-dasharray="3 3"/></svg>
        Start path from here
      </div>
      <div class="kebab-item" data-action="toggle-start">
        ${startIcon}
        ${isStart ? 'Unmark as Start' : 'Mark as Start'}
      </div>
      <div class="kebab-item" data-action="toggle-end">
        ${endIcon}
        ${isEnd ? 'Unmark as End' : 'Mark as End'}
      </div>
      <div class="kebab-item danger${deleteDisabled ? ' disabled' : ''}" data-action="delete" aria-disabled="${deleteDisabled ? 'true' : 'false'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/></svg>
        Delete node
      </div>`;
    const rect = kebabEl.getBoundingClientRect();
    menu.style.left = (rect.right - 4) + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.classList.add('open');
    menu.querySelectorAll('.kebab-item').forEach(i => i.addEventListener('click', () => {
      if (i.classList.contains('disabled')) return;
      const act = i.dataset.action;
      const nd = Canvas.getNode(menu._nodeId);
      hide();
      if (act === 'inspect'    && nd) openInspector(nd);
      if (act === 'start-path' && nd) pathDrawStart({ seedIds: [nd.id] });
      if (act === 'toggle-start' && nd) toggleNodeRole(nd.id, 'start');
      if (act === 'toggle-end'   && nd) toggleNodeRole(nd.id, 'end');
      if (act === 'delete'     && nd) {
        if (PATH_DRAW.active) return;
        startInlineNodeDeleteConfirm(nd, kebabEl);
      }
    }));
  });
  document.addEventListener('mousedown', e => {
    if (!menu.classList.contains('open')) return;
    if (menu.contains(e.target)) return;
    hide();
  });
}

/* ════════════════════════════════════════════════════════════
   V2 LAYOUT — chrome wiring + new inspector / run data drawer.
   These additions are non-destructive: legacy IDs (undoBtn, zoomIn,
   tglRuns, etc.) still exist as hidden shadows and remain wired.
   The new chrome here either delegates to those, or adds behavior
   that didn't exist before (rightnav, bottom-strip, variants toggle).
   ════════════════════════════════════════════════════════════ */

function initV2Layout(P) {
  initProjectTitle(P);
  initVariantsToggle();
  initLeftnavCredits();
  initRightnavStrip();
  initBottomStrip();
  initCanvasToolbarBridge();
  // Override openInspector with the v2 master-detail version.
  window.openInspector = openInspectorV2;
}

/* ── Project title chip in topbar ──────────────────────────── */
function initProjectTitle(P) {
  const variantLabel = document.getElementById('ptVariantLabel');
  const projectName = _resolveProjectDisplayTitle(P) || (P && P.title) || 'Untitled project';
  if (P) P.title = projectName;
  _setProjectTitleUi(projectName);

  // Owner breadcrumb: prefer explicit org/owner field, else the first
  // contributor with role Owner, else the first contributor, else "Guest".
  const ownerEl = document.getElementById('ptOwner');
  const sepEl = document.querySelector('.project-title .pt-sep');
  if (ownerEl) {
    let ownerName = '';
    if (P) {
      if (typeof P.org === 'string' && P.org.trim()) ownerName = P.org.trim();
      else if (typeof P.owner === 'string' && P.owner.trim()) ownerName = P.owner.trim();
      else if (Array.isArray(P.contributors) && P.contributors.length) {
        const owner = P.contributors.find(c => c && String(c.role) === 'Owner');
        ownerName = (owner && owner.name) || (P.contributors[0] && P.contributors[0].name) || '';
      }
    }
    if (!ownerName) ownerName = 'Guest';
    ownerEl.textContent = ownerName;
    ownerEl.title = ownerName;
    // Hide both owner + slash if for some reason ownerName is blank.
    const hideOwner = !ownerName;
    ownerEl.hidden = hideOwner;
    if (sepEl) sepEl.hidden = hideOwner;
  }

  // Mirror the variant chip with the active variant tab.
  function syncVariant() {
    const active = document.querySelector('.variant-tab.active .tab-name');
    if (active && variantLabel) variantLabel.textContent = active.textContent || 'Master';
  }
  syncVariant();
  // Variant strip is rebuilt on changes; re-sync via observer.
  const strip = document.getElementById('variantStrip');
  if (strip) {
    new MutationObserver(syncVariant).observe(strip, { childList: true, subtree: true, characterData: true });
  }
  // Variant chip toggles the strip; if expanding, scroll active tab into view.
  const chip = document.getElementById('ptVariant');
  const app = document.querySelector('.app');
  if (chip && app) {
    chip.addEventListener('click', () => {
      const hidden = app.classList.toggle('variants-hidden');
      localStorage.setItem('cfg.variantsHidden', hidden ? '1' : '0');
      if (!hidden) {
        requestAnimationFrame(() => {
          const active = document.querySelector('.variant-tab.active');
          if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        });
      }
    });
  }
}

/* ── Variants show/hide toggle ─────────────────────────────── */
function initVariantsToggle() {
  // Restore saved collapsed state. Toggle is now wired in initProjectTitle via ptVariant.
  const app = document.querySelector('.app');
  if (app && localStorage.getItem('cfg.variantsHidden') === '1') {
    app.classList.add('variants-hidden');
  }
}

/* ── Leftnav credits (centered overlay modal) ──────────────── */
function initLeftnavCredits() {
  const btn = document.getElementById('leftnavCredits');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (window.ConnectifyLeftnav && typeof window.ConnectifyLeftnav.showCreditsModal === 'function') {
      window.ConnectifyLeftnav.showCreditsModal();
    }
  });
}

/* ── Right nav strip behavior ──────────────────────────────── */
function initRightnavStrip() {
  const drawer = document.getElementById('drawerRight');
  if (!drawer) return;
  document.querySelectorAll('.rightnav-btn[data-side="right"]').forEach(btn => {
    const tab = btn.dataset.tab;
    btn.addEventListener('click', () => {
      const isActive = btn.classList.contains('active');
      if (isActive) {
        drawer.classList.remove('open');
      } else {
        drawer.classList.add('open');
        drawer.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        drawer.querySelectorAll('.drawer-panel').forEach(p => {
          const id = p.id.toLowerCase();
          p.classList.toggle('active', id.endsWith(tab) || (tab === 'rundata' && id === 'panelrundata'));
        });
      }
      syncRightnavActive();
    });
  });
  // Sync active state when drawer changes via other entry points.
  function syncRightnavActive() {
    const open = drawer.classList.contains('open');
    document.querySelectorAll('.rightnav-btn[data-side="right"]').forEach(b => {
      const tab = b.dataset.tab;
      const tabEl = drawer.querySelector(`.drawer-tab[data-tab="${tab}"]`);
      const isActive = open && tabEl?.classList.contains('active');
      b.classList.toggle('active', !!isActive);
    });
  }
  // Re-sync after any drawer-tab click or close.
  drawer.querySelectorAll('.drawer-tab').forEach(t => t.addEventListener('click', () => setTimeout(syncRightnavActive, 0)));
  drawer.querySelector('.drawer-close')?.addEventListener('click', () => setTimeout(syncRightnavActive, 0));
}

/* ── Bottom strip (Runs / Console / Problems chips) ────────── */
function initBottomStrip() {
  const strip = document.getElementById('bottomStrip');
  const panel = document.getElementById('bottomPanel');
  if (!strip || !panel) return;
  strip.querySelectorAll('.bs-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tab = chip.dataset.bpTab;
      panel.classList.add('open');
      panel.querySelectorAll('.bp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      panel.querySelectorAll('.bp-panel').forEach(p => p.classList.toggle('active', p.id === ('bp' + tab.charAt(0).toUpperCase() + tab.slice(1))));
      document.getElementById('tglRuns')?.classList.add('active');
      try { syncBpAppShell(); } catch (_) {}
    });
  });
  // Refresh badge counts periodically (cheap; reads existing DOM counts).
  function refreshBadges() {
    const runs = document.getElementById('runsCount')?.textContent;
    const probs = document.getElementById('problemsCount')?.textContent;
    const rb = document.getElementById('bsRunsBadge');
    const pb = document.getElementById('bsProblemsBadge');
    if (rb && runs != null && runs !== '') rb.textContent = runs;
    if (pb && probs != null && probs !== '') pb.textContent = probs;
    // Hide problems badge if zero
    if (pb) pb.style.display = (pb.textContent === '0') ? 'none' : '';
  }
  refreshBadges();
  setInterval(refreshBadges, 1500);
}

/* ── Canvas toolbar bridge ─────────────────────────────────── */
/* The new centered toolbar buttons forward clicks to the legacy IDs
   (undoBtn, redoBtn, zoomIn, zoomOut, zoomFit, autoLayoutBtn) and
   the legacy tool palette buttons (data-tool=...). State (active
   tool, undo/redo enabled, zoom %) is mirrored back from the legacy
   elements via mutation observers. */
function initCanvasToolbarBridge() {
  const tb = document.getElementById('canvasToolbar');
  if (!tb) return;

  function clickLegacyTool(name) {
    const el = document.querySelector(`.tool-palette [data-tool="${name}"]`);
    if (el) el.click();
  }
  function clickLegacyId(id) {
    document.getElementById(id)?.click();
  }

  tb.querySelector('#ctbSelect')?.addEventListener('click', () => clickLegacyTool('select'));
  tb.querySelector('#ctbMarquee')?.addEventListener('click', () => clickLegacyTool('subgraph-marquee'));
  tb.querySelector('#ctbComment')?.addEventListener('click', () => clickLegacyTool('comment'));
  tb.querySelector('#ctbPath')?.addEventListener('click', () => clickLegacyTool('path'));
  tb.querySelector('#ctbUndo')?.addEventListener('click', () => clickLegacyId('undoBtn'));
  tb.querySelector('#ctbRedo')?.addEventListener('click', () => clickLegacyId('redoBtn'));
  tb.querySelector('#ctbZoomOut')?.addEventListener('click', () => clickLegacyId('zoomOut'));
  tb.querySelector('#ctbZoomIn')?.addEventListener('click', () => clickLegacyId('zoomIn'));
  tb.querySelector('#ctbZoomFit')?.addEventListener('click', () => clickLegacyId('zoomFit'));
  tb.querySelector('#ctbAutoLayout')?.addEventListener('click', () => clickLegacyId('autoLayoutBtn'));

  // Mirror active tool onto the new toolbar.
  function syncActiveTool() {
    const active = document.querySelector('.tool-palette .tool.active')?.dataset?.tool;
    tb.querySelectorAll('.ctb-btn[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === active);
    });
  }
  // Mirror undo/redo disabled state.
  function syncUndoRedo() {
    const u = document.getElementById('undoBtn');
    const r = document.getElementById('redoBtn');
    if (u) tb.querySelector('#ctbUndo').disabled = u.disabled;
    if (r) tb.querySelector('#ctbRedo').disabled = r.disabled;
  }
  // Mirror zoom value.
  function syncZoom() {
    const z = document.getElementById('zoomValue')?.textContent;
    if (z) tb.querySelector('#ctbZoomValue').textContent = z;
  }
  syncActiveTool(); syncUndoRedo(); syncZoom();
  const palette = document.querySelector('.tool-palette');
  if (palette) new MutationObserver(syncActiveTool).observe(palette, { subtree: true, attributes: true, attributeFilter: ['class'] });
  ['undoBtn','redoBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(syncUndoRedo).observe(el, { attributes: true, attributeFilter: ['disabled'] });
  });
  const zv = document.getElementById('zoomValue');
  if (zv) new MutationObserver(syncZoom).observe(zv, { childList: true, characterData: true, subtree: true });
}

/* ════════════════════════════════════════════════════════════
   New Inspector — master/detail with Config + Variables sections.
   ════════════════════════════════════════════════════════════ */

// Stub data: variables are derived from node ports + a few synthetic
// extras so the table is populated even for nodes with no ports yet.
function _stubVariablesForNode(n) {
  const inputs = (n.inputs || []).map(p => ({
    id: 'in:' + p.name, name: p.name, type: p.type, dir: 'input',
    desc: 'Input variable from upstream node.',
    sample: _stubSampleValue(p.type, p.name)
  }));
  const outputs = (n.outputs || []).map(p => ({
    id: 'out:' + p.name, name: p.name, type: p.type, dir: 'output',
    desc: 'Output produced by this node.',
    sample: _stubSampleValue(p.type, p.name)
  }));
  // Add some synthetic variables based on node type so the table isn't
  // empty for nodes without explicit ports.
  if (!inputs.length) {
    ['raw_input', 'config'].forEach((nm, i) => inputs.push({
      id: 'in:' + nm, name: nm, type: i === 0 ? 'tensor' : 'json', dir: 'input',
      desc: 'Synthetic input variable.', sample: _stubSampleValue(i === 0 ? 'tensor' : 'json', nm)
    }));
  }
  if (!outputs.length) {
    ['result', 'metadata'].forEach((nm, i) => outputs.push({
      id: 'out:' + nm, name: nm, type: i === 0 ? 'tensor' : 'json', dir: 'output',
      desc: 'Synthetic output variable.', sample: _stubSampleValue(i === 0 ? 'tensor' : 'json', nm)
    }));
  }
  return { inputs, outputs };
}

function _stubSampleValue(type, name) {
  const t = String(type || '').toLowerCase();
  if (t.includes('tensor')) return '[1024 × 768] float32';
  if (t.includes('image')) return 'PNG 512×512 RGB';
  if (t.includes('text') || t.includes('str')) return '"customer feedback batch"';
  if (t.includes('int') || t.includes('num')) return String(Math.floor(Math.random() * 1000));
  if (t.includes('bool')) return Math.random() > .5 ? 'true' : 'false';
  if (t.includes('json') || t.includes('obj')) return '{ schema_v: 2, rows: 10000 }';
  return `<${type || 'any'}>`;
}

function _stubConfigForNode(n) {
  const kind = n.type || 'Node';
  if (kind === 'Model') {
    return [
      ['Framework', n.fw || 'PyTorch'],
      ['Task', n.fn || 'Classification'],
      ['Batch size', '32'],
      ['Learning rate', '5e-4'],
      ['Optimizer', 'AdamW'],
      ['Epochs', '5'],
      ['Random seed', '42'],
    ];
  }
  if (kind === 'Dataset') {
    return [
      ['Format', 'Parquet'],
      ['Rows', '124,580'],
      ['Splits', 'train · val · test'],
      ['Schema version', '2'],
      ['Source', 'gs://datasets/customer/'],
    ];
  }
  return [
    ['Category', n.fn || 'Transform'],
    ['Deterministic', 'yes'],
    ['Stateless', 'yes'],
    ['Timeout', '30s'],
  ];
}

function _stubRunsForVariant() {
  const now = Date.now();
  return [
    { id: 'run_3a1c', label: 'Run #14', when: '2 min ago', status: 'ok', ts: now - 2 * 60000 },
    { id: 'run_29bf', label: 'Run #13', when: '17 min ago', status: 'ok', ts: now - 17 * 60000 },
    { id: 'run_277e', label: 'Run #12', when: '1 hr ago', status: 'failed', ts: now - 60 * 60000 },
    { id: 'run_24aa', label: 'Run #11', when: '3 hr ago', status: 'ok', ts: now - 180 * 60000 },
  ];
}

let _currentInspectorNode = null;
let _currentSubtab = 'config';
let _selectedRunId = null;

function openInspectorV2(nodeData) {
  const rightEl = document.getElementById('drawerRight');
  rightEl.classList.add('open');
  rightEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'inspector'));
  rightEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelInspector'));

  document.querySelectorAll('.tb-toggle[data-side="right"]').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rightnav-btn[data-side="right"]').forEach(t => t.classList.toggle('active', t.dataset.tab === 'inspector'));

  document.querySelectorAll('.node.selected').forEach(n => n.classList.remove('selected'));
  document.querySelector(`.node[data-node-id="${nodeData.id}"]`)?.classList.add('selected');

  _currentInspectorNode = nodeData;
  if (!_selectedRunId) _selectedRunId = _stubRunsForVariant()[0]?.id;

  document.getElementById('inspectorEmpty').style.display = 'none';
  document.getElementById('inspectorShell').style.display = 'flex';
  document.getElementById('inspectorDetail').style.display = 'none';

  renderInspectorHead(nodeData);
  renderInspectorSubtab();
  bindSubtabClicks();
}

function renderInspectorHead(n) {
  const colorRaw = String(n.color || '').trim();
  let color = 'blue';
  const m = /var\(--dot-(\w+)\)/.exec(colorRaw);
  if (m) color = m[1];
  else if (/^(blue|green|purple|yellow|red)$/.test(colorRaw)) color = colorRaw;
  const name = n.label || n.name || n.id;
  const kind = n.type || 'Node';
  const head = document.getElementById('inspectorHead');
  if (!head) return;
  head.innerHTML = `
    <span class="dot" style="background: var(--dot-${color})"></span>
    <span class="name">${esc(name)}</span>
    <span class="kind">${esc(kind)}</span>
  `;
}

function bindSubtabClicks() {
  const tabs = document.getElementById('inspectorSubtabs');
  if (!tabs || tabs._bound) return;
  tabs._bound = true;
  tabs.addEventListener('click', e => {
    const btn = e.target.closest('.insp-subtab');
    if (!btn) return;
    _currentSubtab = btn.dataset.subtab;
    tabs.querySelectorAll('.insp-subtab').forEach(b => b.classList.toggle('active', b === btn));
    // Always return to master view when switching sub-tabs.
    document.getElementById('inspectorDetail').style.display = 'none';
    document.getElementById('inspectorMaster').style.display = 'block';
    renderInspectorSubtab();
  });
}

function renderInspectorSubtab() {
  const master = document.getElementById('inspectorMaster');
  if (!master || !_currentInspectorNode) return;
  master.style.display = 'block';
  if (_currentSubtab === 'config') {
    master.innerHTML = renderConfigSubtab(_currentInspectorNode);
  } else {
    master.innerHTML = renderRunDataSubtab(_currentInspectorNode);
  }
  bindSubtabContentEvents(_currentInspectorNode);
}

/* Config sub-tab — config k/v list + variables table (types/structure). */
function renderConfigSubtab(n) {
  const cfg = _stubConfigForNode(n);
  const { inputs, outputs } = _stubVariablesForNode(n);
  const cfgRows = cfg.map(([k, v]) => `<div class="cfg-row"><span class="k">${esc(k)}</span><span class="v">${esc(String(v))}</span></div>`).join('');
  const tags = Array.isArray(n.tags) ? n.tags : [];
  const isStart = tags.includes('start');
  const isEnd   = tags.includes('end');
  return `
    <div class="insp-section-v2" data-sec="role">
      <button type="button" class="insp-sec-head">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>
        Role
      </button>
      <div class="insp-sec-body">
        <div class="cfg-row" style="gap:10px;align-items:center;">
          <span class="k">Mark as</span>
          <span class="v" style="display:flex;gap:6px;flex-wrap:wrap;">
            <label class="role-chip ${isStart ? 'on start' : ''}" data-role-toggle="start">
              <input type="checkbox" ${isStart ? 'checked' : ''} data-role-input="start" style="display:none;" />
              <span class="dot start"></span>Start
            </label>
            <label class="role-chip ${isEnd ? 'on end' : ''}" data-role-toggle="end">
              <input type="checkbox" ${isEnd ? 'checked' : ''} data-role-input="end" style="display:none;" />
              <span class="dot end"></span>End
            </label>
          </span>
        </div>
      </div>
    </div>

    <div class="insp-section-v2" data-sec="config">
      <button type="button" class="insp-sec-head">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>
        Properties
      </button>
      <div class="insp-sec-body">
        ${cfgRows || '<div class="cfg-row"><span class="v" style="color:var(--text-muted);font-style:italic">No configuration.</span></div>'}
      </div>
    </div>

    <div class="insp-section-v2" data-sec="variables">
      <button type="button" class="insp-sec-head">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>
        Variables
      </button>
      <div class="insp-sec-body">
        <div class="vars-filter">
          <input type="text" placeholder="Filter variables…" id="varsFilterInput" />
        </div>
        <div class="vars-grid">
          ${renderVarsColumn('Inputs', inputs)}
          ${renderVarsColumn('Outputs', outputs)}
        </div>
      </div>
    </div>
  `;
}

/* Run Data sub-tab — run selector + variables with actual values + before/after diff. */
function renderRunDataSubtab(n) {
  const runs = _stubRunsForVariant();
  const run = runs.find(r => r.id === _selectedRunId) || runs[0];
  const { inputs, outputs } = _stubVariablesForNode(n);
  const runOptions = runs.map(r => `<option value="${esc(r.id)}" ${r.id === run.id ? 'selected' : ''}>${esc(r.label)} · ${esc(r.when)} · ${esc(r.status)}</option>`).join('');

  // Pair inputs and outputs by index for before/after blocks.
  const pairs = Math.max(inputs.length, outputs.length);
  let blocks = '';
  for (let i = 0; i < pairs; i++) {
    const inp = inputs[i];
    const out = outputs[i];
    const name = (out?.name || inp?.name || `var_${i}`);
    const type = (out?.type || inp?.type || 'any');
    blocks += `
      <div class="diff-block">
        <div class="diff-head">
          <span>${esc(name)}</span>
          <span class="vr-type">${esc(type)}</span>
        </div>
        <div class="diff-cols">
          <div class="diff-side before">
            <div class="diff-side-head">Before · input</div>
            ${inp ? esc(_stubBeforeAfter(inp, 'before')) : '<span style="color:var(--text-muted)">—</span>'}
          </div>
          <div class="diff-side after">
            <div class="diff-side-head">After · output</div>
            ${out ? esc(_stubBeforeAfter(out, 'after')) : '<span style="color:var(--text-muted)">—</span>'}
          </div>
        </div>
      </div>`;
  }

  // Also include the variables table (clickable for drill-down) so users
  // can jump from a run's data into a specific variable's full detail.
  return `
    <div class="rd-context">
      <span>Run:</span>
      <select id="rdRunSelect">${runOptions}</select>
      <span style="margin-left:auto;color:${run.status === 'failed' ? '#dc2626' : 'var(--text-muted)'}">${esc(run.status)}</span>
    </div>

    <div class="insp-section-v2" data-sec="diff">
      <button type="button" class="insp-sec-head">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>
        Before / after
      </button>
      <div class="insp-sec-body" style="padding:0 0 12px;">
        ${blocks || '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:12px;">No variable data for this run.</div>'}
      </div>
    </div>

    <div class="insp-section-v2" data-sec="variables">
      <button type="button" class="insp-sec-head">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l5 5 5-5"/></svg>
        Variables
      </button>
      <div class="insp-sec-body">
        <div class="vars-filter">
          <input type="text" placeholder="Filter variables…" id="varsFilterInput" />
        </div>
        <div class="vars-grid">
          ${renderVarsColumn('Inputs', inputs)}
          ${renderVarsColumn('Outputs', outputs)}
        </div>
      </div>
    </div>
  `;
}

function renderVarsColumn(label, list) {
  return `
    <div class="vars-col">
      <div class="vars-col-head">${esc(label)} · ${list.length}</div>
      ${list.length === 0
        ? `<div class="vars-col-empty">No ${label.toLowerCase()}</div>`
        : list.map(v => `
          <div class="var-row" data-var-id="${esc(v.id)}">
            <div class="vr-name">${esc(v.name)}</div>
            <div class="vr-meta"><span class="vr-type">${esc(v.type || 'any')}</span></div>
          </div>`).join('')}
    </div>`;
}

function bindSubtabContentEvents(n) {
  const master = document.getElementById('inspectorMaster');
  if (!master) return;
  // Section collapse toggles
  master.querySelectorAll('.insp-sec-head').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });
  // Variable row → drill-down detail
  const { inputs, outputs } = _stubVariablesForNode(n);
  const all = inputs.concat(outputs);
  master.querySelectorAll('.var-row').forEach(row => {
    row.addEventListener('click', () => {
      const v = all.find(x => x.id === row.dataset.varId);
      if (v) openVariableDetail(n, v);
    });
  });
  // Filter
  const filterInput = master.querySelector('#varsFilterInput');
  if (filterInput) {
    filterInput.addEventListener('input', () => {
      const q = filterInput.value.trim().toLowerCase();
      master.querySelectorAll('.var-row').forEach(row => {
        const name = row.querySelector('.vr-name')?.textContent.toLowerCase() || '';
        const type = row.querySelector('.vr-type')?.textContent.toLowerCase() || '';
        row.style.display = (!q || name.includes(q) || type.includes(q)) ? '' : 'none';
      });
    });
  }
  // Run selector (only present in Run Data sub-tab)
  master.querySelector('#rdRunSelect')?.addEventListener('change', e => {
    _selectedRunId = e.target.value;
    renderInspectorSubtab();
  });
  // Role chips (Start / End) — mirror the kebab toggles.
  master.querySelectorAll('[data-role-toggle]').forEach(chip => {
    chip.addEventListener('click', e => {
      e.preventDefault();
      const role = chip.dataset.roleToggle;
      if (!_currentInspectorNode || !role) return;
      toggleNodeRole(_currentInspectorNode.id, role);
    });
  });
}

function openVariableDetail(node, v) {
  document.getElementById('inspectorMaster').style.display = 'none';
  const detail = document.getElementById('inspectorDetail');
  detail.style.display = 'block';

  const upstream = v.dir === 'input' ? '(inherited from connected upstream output)' : 'this node';
  const downstream = v.dir === 'output' ? '(consumed by connected downstream inputs)' : 'this node';

  detail.innerHTML = `
    <div class="insp-detail-head">
      <button type="button" class="insp-detail-back" id="varDetailBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back
      </button>
      <span class="insp-detail-title">${esc(v.name)}</span>
    </div>
    <div class="insp-detail-body">
      <span class="vd-pill">${esc(v.dir)} · ${esc(v.type || 'any')}</span>
      <div class="vd-row"><span class="k">Description</span><span class="v">${esc(v.desc || '—')}</span></div>
      <div class="vd-row"><span class="k">Last value</span><span class="v">${esc(v.sample)}</span></div>
      <div class="vd-row"><span class="k">Source</span><span class="v">${esc(upstream)}</span></div>
      <div class="vd-row"><span class="k">Used by</span><span class="v">${esc(downstream)}</span></div>
      <div class="vd-row"><span class="k">Shape</span><span class="v">${esc(_stubShape(v.type))}</span></div>
      <div class="vd-row"><span class="k">Observation IDs</span><span class="v">obs_001 → obs_124580</span></div>
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px;">Trace (last run)</div>
        <div class="vd-trace">${esc(_stubTrace(v))}</div>
      </div>
    </div>`;

  detail.querySelector('#varDetailBack')?.addEventListener('click', () => {
    detail.style.display = 'none';
    document.getElementById('inspectorMaster').style.display = 'block';
  });
}

function _stubShape(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('tensor')) return '[batch=32, features=768]';
  if (t.includes('image')) return '[3, 512, 512]';
  if (t.includes('json') || t.includes('obj')) return 'object';
  return 'scalar';
}
function _stubTrace(v) {
  return [
    `[${new Date().toISOString().slice(11,19)}] ${v.name} resolved`,
    `  type: ${v.type || 'any'}`,
    `  size: ${v.sample}`,
    `  duration: ${(Math.random() * 80 + 4).toFixed(1)}ms`,
    `  cache: ${Math.random() > .5 ? 'hit' : 'miss'}`,
  ].join('\n');
}

/* ════════════════════════════════════════════════════════════
   Before/after stub helper used by the Run Data sub-tab.
   ════════════════════════════════════════════════════════════ */

function _stubBeforeAfter(v, side) {
  const t = String(v.type || '').toLowerCase();
  if (t.includes('tensor')) {
    return side === 'before'
      ? '[1024 × 768] float32\nmean=0.482, std=0.214\nnan_count=12'
      : '[1024 × 768] float32 (normalized)\nmean=0.000, std=1.000\nnan_count=0';
  }
  if (t.includes('json') || t.includes('obj')) {
    return side === 'before'
      ? '{\n  "rows": 10000,\n  "schema_v": 1,\n  "nulls": 47\n}'
      : '{\n  "rows": 9953,\n  "schema_v": 2,\n  "nulls": 0\n}';
  }
  if (t.includes('text') || t.includes('str')) {
    return side === 'before'
      ? '"  Hello, world!  \\n\\t"'
      : '"hello world"';
  }
  return v.sample || '—';
}

/* ══════════════════════════════════════════════════════════════
   V3 Layout Patches
   Function redeclarations override earlier definitions (hoisting).
   ══════════════════════════════════════════════════════════════ */

function initV2Layout(P) {
  initProjectTitle(P);
  initVariantsToggle();
  initLeftnavCredits();
  // V3: rightnav removed — skip initRightnavStrip()
  initBottomStrip();
  initCanvasToolbarBridge();
  initInspectorEdgeTab();
  initPathsFloatPanel();
  initCanvasNavMenu();
  initCanvasNavActions();
  updateCloudSpendColor();
  window.openInspector = openInspectorV2;
}

function initInspectorEdgeTab() {
  const tab = document.getElementById('inspectorEdgeTab');
  if (!tab) return;
  const open = () => {
    const rightEl = document.getElementById('drawerRight');
    if (!rightEl) return;
    rightEl.classList.add('open');
    tab.hidden = true;
    // Reopen with last node if available
    if (_currentInspectorNode) {
      document.getElementById('inspectorEmpty').style.display = 'none';
      document.getElementById('inspectorShell').style.display = 'flex';
    }
  };
  tab.addEventListener('click', open);
  tab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

  // Re-wire the right drawer close button to also show the edge tab
  const closeBtn = document.querySelector('.drawer-close[data-side="right"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => { tab.hidden = false; });
  }

  // Escape closes inspector and shows edge tab
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const rightEl = document.getElementById('drawerRight');
    if (rightEl?.classList.contains('open')) {
      rightEl.classList.remove('open');
      tab.hidden = false;
    }
  });
}

function initPathsFloatPanel() {
  const panel = document.getElementById('pathsFloatPanel');
  if (!panel) return;

  // Close button hides panel but keeps path draw mode active (banner takes over)
  const closeBtn = document.getElementById('pathsFloatClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.hidden = true;
      document.getElementById('tglPaths')?.classList.remove('active');
      syncPathDrawFloatOverlay();
    });
  }

  // "New path" button in float panel
  const newBtn = document.getElementById('pathsNewBtn');
  if (newBtn) {
    newBtn.addEventListener('click', () => pathDrawStart());
  }

  // V3: replace #ctbPath with a clone to strip old listener, then wire directly
  const oldCtbPath = document.getElementById('ctbPath');
  if (oldCtbPath) {
    const newCtbPath = oldCtbPath.cloneNode(true);
    oldCtbPath.parentNode.replaceChild(newCtbPath, oldCtbPath);
    newCtbPath.addEventListener('click', () => {
      if (PATH_DRAW.active) { pathDrawCancel(); return; }
      pathDrawStart();
    });
  }
}

function pathDrawStart(opts) {
  opts = opts || {};
  if (PATH_DRAW.active) pathDrawCancel();
  PATH_DRAW.active = true;
  PATH_DRAW.nodeIds = Array.isArray(opts.seedIds) ? opts.seedIds.filter(id => Canvas.getNode(id)) : [];
  PATH_DRAW.editingPathId = opts.editingPathId || null;

  // Slice 3 — auto-seed from a marked Start node when the user enters draw
  // mode cold (no caller-provided seed, not editing). If exactly one Start
  // node exists in the graph, drop it in as the first pick so the user can
  // immediately keep extending downstream. Multiple Starts → no auto-seed
  // (the post-render hint will tell them to pick one).
  let autoSeededFromStart = false;
  // During the guided tour the path starts empty so the user clicks the first
  // node themselves (Step 6) — skip the convenience auto-seed.
  if (!PATH_DRAW.nodeIds.length && !PATH_DRAW.editingPathId && !_tutorialActive()) {
    const starts = (typeof findNodesWithRole === 'function') ? findNodesWithRole('start') : [];
    if (starts.length === 1) {
      PATH_DRAW.nodeIds = [starts[0]];
      autoSeededFromStart = true;
    }
  }

  document.body.classList.add('building-path');
  clearFocusedPath();

  // V3: show paths float panel instead of opening the right drawer
  const floatPanel = document.getElementById('pathsFloatPanel');
  if (floatPanel) floatPanel.hidden = false;
  document.getElementById('tglPaths')?.classList.add('active');

  setPaletteTool('path');
  attachPathClickCapture();
  renderPaths();
  applyPathHighlights();
  if (PATH_DRAW.nodeIds.length) {
    if (PATH_DRAW.editingPathId) fitPathNodes(PATH_DRAW.nodeIds);
    else fitAroundSelection();
  }
  // Surface the auto-seed in the banner hint so it's not magic.
  if (autoSeededFromStart) {
    const seedId = PATH_DRAW.nodeIds[0];
    const seedName = Canvas.getNode(seedId)?.label || Canvas.getNode(seedId)?.name || seedId;
    setPathHint(`Started at “${seedName}” (your Start node). Pick the next downstream node.`);
  } else if (!PATH_DRAW.nodeIds.length) {
    const starts = (typeof findNodesWithRole === 'function') ? findNodesWithRole('start') : [];
    if (starts.length > 1) {
      setPathHint(`Multiple Start nodes — pick one of the ${starts.length} marked Starts to begin.`);
    }
  }
  // Tutorial Step 5: notify when path-draw mode is entered.
  if (window.ConnectifyTutorial) {
    window.ConnectifyTutorial.notifyAction('path-mode-started', { seeded: PATH_DRAW.nodeIds.length });
  }
}

function syncPathDrawFloatOverlay() {
  const fo = document.getElementById('pathDrawFloatOverlay');
  if (!fo) return;
  if (!PATH_DRAW.active) {
    fo.hidden = true;
    fo.innerHTML = '';
    return;
  }
  // V3: banner shows only when float panel is hidden
  const fp = document.getElementById('pathsFloatPanel');
  if (fp && !fp.hidden) {
    fo.hidden = true;
    fo.innerHTML = '';
    return;
  }
  fo.hidden = false;
  fo.innerHTML = renderPathDrawBanner();
  wirePathDrawBanner(fo);
}

function openInspectorV2(nodeData) {
  const rightEl = document.getElementById('drawerRight');
  rightEl.classList.add('open');

  // V3: hide edge tab when inspector is open
  const edgeTab = document.getElementById('inspectorEdgeTab');
  if (edgeTab) edgeTab.hidden = true;

  document.querySelectorAll('.node.selected').forEach(n => n.classList.remove('selected'));
  document.querySelector(`.node[data-node-id="${nodeData.id}"]`)?.classList.add('selected');

  _currentInspectorNode = nodeData;
  if (!_selectedRunId) _selectedRunId = _stubRunsForVariant()[0]?.id;

  document.getElementById('inspectorEmpty').style.display = 'none';
  document.getElementById('inspectorShell').style.display = 'flex';
  document.getElementById('inspectorDetail').style.display = 'none';

  renderInspectorHead(nodeData);
  renderInspectorSubtab();
  bindSubtabClicks();

  // Tutorial Step 14: notify when a node's Inspector is opened.
  if (window.ConnectifyTutorial) {
    window.ConnectifyTutorial.notifyAction('inspector-opened', { type: nodeData.type, id: nodeData.id });
  }
}

// V3: Canvas-mode nav (expand/collapse toggle)
function initCanvasNavMenu() {
  const app = document.querySelector('.app');
  app.classList.add('canvas-mode');

  const navToggleBtn = document.getElementById('navToggleBtn');
  if (navToggleBtn) {
    navToggleBtn.addEventListener('click', () => {
      const expanded = app.classList.toggle('leftnav-expanded');
      localStorage.setItem('cfg.leftnav.expanded', expanded ? '1' : '0');
      navToggleBtn.title = expanded ? 'Collapse navigation' : 'Expand navigation';
      navToggleBtn.setAttribute('aria-label', expanded ? 'Collapse navigation' : 'Expand navigation');
    });
  }
}

// V3: Wire up canvas nav actions (Add nodes, Paths, History)
function initCanvasNavActions() {
  const leftEl = document.getElementById('drawerLeft');

  const navActionBtns = [
    document.getElementById('navAddNodes'),
    document.getElementById('navHistory'),
  ].filter(Boolean);

  // Tab → navActionBtn map
  const TAB_TO_BTN = {
    discover: document.getElementById('navAddNodes'),
    history:  document.getElementById('navHistory'),
  };

  function syncLeftnavActive() {
    if (!leftEl) return;
    const isOpen = leftEl.classList.contains('open');
    const activeTab = leftEl.querySelector('.drawer-tab.active')?.dataset?.tab;
    navActionBtns.forEach(b => b.classList.remove('active'));
    if (isOpen && activeTab && TAB_TO_BTN[activeTab]) {
      TAB_TO_BTN[activeTab].classList.add('active');
    }
  }

  function openLeftDrawerTab(tab, triggerBtn) {
    if (!leftEl) return;
    const isOpen = leftEl.classList.contains('open');
    const alreadyActive = triggerBtn?.classList.contains('active');
    if (isOpen && alreadyActive) {
      leftEl.classList.remove('open');
      navActionBtns.forEach(b => b.classList.remove('active'));
    } else {
      leftEl.classList.add('open');
      leftEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      leftEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id.toLowerCase().endsWith(tab)));
      const ds = document.getElementById('discoverSearch');
      if (ds) ds.style.display = tab === 'discover' ? 'flex' : 'none';
      navActionBtns.forEach(b => b.classList.remove('active'));
      if (triggerBtn) triggerBtn.classList.add('active');
    }
    if (typeof syncPathDrawFloatOverlay === 'function') syncPathDrawFloatOverlay();
  }

  // Unfocus leftnav when the drawer close (X) button is clicked.
  leftEl?.querySelector('.drawer-close')?.addEventListener('click', () => {
    setTimeout(syncLeftnavActive, 0);
  });

  // Sync when any drawer-tab is clicked directly (e.g. inside the drawer header).
  leftEl?.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => setTimeout(syncLeftnavActive, 0));
  });

  // MutationObserver: keep leftnav in sync if anything else opens/closes the drawer.
  if (leftEl) {
    new MutationObserver(() => syncLeftnavActive()).observe(leftEl, {
      attributes: true, attributeFilter: ['class'],
      subtree: true,
    });
  }

  const addNodesBtn = document.getElementById('navAddNodes');
  if (addNodesBtn) {
    addNodesBtn.addEventListener('click', () => openLeftDrawerTab('discover', addNodesBtn));
  }

  const pathsBtn = document.getElementById('navPaths');
  if (pathsBtn) {
    pathsBtn.addEventListener('click', () => pathDrawStart({}));
  }

  const historyBtn = document.getElementById('navHistory');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => openLeftDrawerTab('history', historyBtn));
  }
}

// V3: Color-code cloud spend button based on amount
function updateCloudSpendColor() {
  const spendBtn = document.getElementById('leftnavCredits');
  if (!spendBtn) return;

  const creditsValue = document.getElementById('leftnavCreditsValue');
  if (creditsValue) {
    const match = creditsValue.textContent.match(/[\d.]+/);
    if (match) {
      const amount = parseFloat(match[0]);
      spendBtn.setAttribute('data-credits', String(Math.round(amount * 10) / 10));
    }
  }
}

// V4: Wire up floating tool palette (top-left of canvas)
function initFloatPalette() {
  const palette = document.getElementById('floatPalette');
  if (!palette) return;

  function clickLegacyTool(name) {
    const el = document.querySelector(`.tool-palette [data-tool="${name}"]`);
    if (el) el.click();
  }

  function openDiscoverWith(activeType) {
    if (typeof DISCOVER !== 'undefined' && activeType) {
      DISCOVER.activeType = activeType;
      if (typeof renderDiscover === 'function') renderDiscover();
    }
    // Tutorial Step 12: notify when the catalog drawer is opened from the palette.
    if (window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('drawer-opened', { type: activeType });
    }
    const leftEl = document.getElementById('drawerLeft');
    const isOpen = !!leftEl && leftEl.classList.contains('open');
    const activeTab = leftEl?.querySelector('.drawer-tab.active')?.dataset?.tab;
    // If the drawer is already open on Discover, palette button clicks
    // act like the in-drawer type tabs — switch type, don't toggle the
    // drawer closed. Same goes for switching FROM another tab (Uploads,
    // History) to Discover with a specific type pre-selected.
    if (isOpen) {
      if (activeTab !== 'discover') {
        leftEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'discover'));
        leftEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelDiscover'));
        const ds = document.getElementById('discoverSearch');
        if (ds) ds.style.display = 'flex';
      }
      return;
    }
    const tgl = document.getElementById('toolDiscover');
    if (tgl) tgl.click();
  }

  palette.querySelector('#fpModel')?.addEventListener('click', () => openDiscoverWith('Model'));
  palette.querySelector('#fpDataset')?.addEventListener('click', () => openDiscoverWith('Dataset'));
  palette.querySelector('#fpLogic')?.addEventListener('click', () => openDiscoverWith('Logic'));

  palette.querySelector('#fpMarquee')?.addEventListener('click', () => clickLegacyTool('subgraph-marquee'));
  palette.querySelector('#fpComment')?.addEventListener('click', () => clickLegacyTool('comment'));
  palette.querySelector('#fpPath')?.addEventListener('click', () => {
    if (typeof PATH_DRAW !== 'undefined' && PATH_DRAW.active && typeof pathDrawCancel === 'function') {
      pathDrawCancel();
      return;
    }
    if (typeof pathDrawStart === 'function') pathDrawStart();
  });

  // Mirror active tool state from legacy palette onto float palette
  function syncActive() {
    const active = document.querySelector('.tool-palette .tool.active')?.dataset?.tool;
    palette.querySelectorAll('.fp-btn[data-fp-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.fpTool === active);
    });
  }
  syncActive();
  const legacy = document.querySelector('.tool-palette');
  if (legacy) {
    new MutationObserver(syncActive).observe(legacy, {
      attributes: true, subtree: true, attributeFilter: ['class']
    });
  }
}

// V4: Collapsable section toggles in leftnav (Projects, My Teams)
function initLeftnavProjects() {
  // Render the projects tree from cfg.customProjects. Current project is
  // highlighted. If the active project isn't in the customs (e.g. bundled),
  // it still won't appear in the tree — by design: the tree shows the user's
  // own projects, forked or created.
  if (window.ConnectifyLeftnav && typeof window.ConnectifyLeftnav.renderProjects === 'function') {
    const activeSlug = (window.PROJECT && window.PROJECT.slug) || slug || '';
    window.ConnectifyLeftnav.renderProjects(activeSlug);
  }

  // Persist projects/teams collapsable state across page navigations via
  // the shared helper in leftnav.js.
  const wireCollapsable = (window.ConnectifyLeftnav && window.ConnectifyLeftnav.wireCollapsable) || function() {};
  wireCollapsable('leftnavProjects', 'lpHeaderToggle');

  document.getElementById('lpAddProject')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'graphs-hub.html?tab=dashboard&new=1';
  });

  document.getElementById('leftnavSearch')?.addEventListener('click', () => {
    if (window.CommandPalette) window.CommandPalette.open();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  });

  registerCommandPaletteEditorProviders();

  // Auth: render chip + wire click → login modal or account menu. See
  // auth.js for the full surface.
  if (window.ConnectifyAuth && typeof window.ConnectifyAuth.wireLeftnavAuth === 'function') {
    window.ConnectifyAuth.wireLeftnavAuth();
  }
}

/**
 * Contribute editor-specific results to the ⌘K palette: every node in the
 * current graph (jump + inspect), plus the canvas actions a power user reaches
 * for most. Items are pulled fresh on each open, so the node list always
 * reflects the live graph.
 */
function registerCommandPaletteEditorProviders() {
  const CP = window.CommandPalette;
  if (!CP) return;

  CP.register({
    id: 'editor-nodes',
    getItems() {
      if (typeof Canvas === 'undefined' || !Canvas.getAllNodes) return [];
      return Canvas.getAllNodes().map(n => ({
        group: 'Nodes',
        title: n.label || n.name || n.id,
        subtitle: [n.type, n.name].filter(Boolean).join(' · '),
        swatch: n.color || 'var(--border)',
        keywords: ['node', n.type, n.name, ...(n.tags || [])].filter(Boolean),
        tag: n.type,
        run: () => {
          Canvas.fitToNodes([n.id], { maxZoom: 1, animate: true });
          const fresh = Canvas.getNode(n.id);
          if (fresh && typeof openInspectorV2 === 'function') openInspectorV2(fresh);
        }
      }));
    }
  });

  CP.register({
    id: 'editor-actions',
    getItems() {
      const items = [{
        group: 'Actions',
        title: 'Add node',
        subtitle: 'Open the Discover panel',
        icon: CP.ICONS.plus,
        keywords: ['add', 'new', 'node', 'create', 'discover', 'model', 'dataset', 'logic'],
        run: () => document.getElementById('toolDiscover')?.click()
      }];
      if (typeof historyUndo === 'function') {
        items.push({
          group: 'Actions', title: 'Undo', keywords: ['undo', 'revert', 'back'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
          run: () => historyUndo()
        });
      }
      if (typeof historyRedo === 'function') {
        items.push({
          group: 'Actions', title: 'Redo', keywords: ['redo', 'forward'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>',
          run: () => historyRedo()
        });
      }
      if (typeof Canvas !== 'undefined' && Canvas.getAllNodes && Canvas.fitToNodes) {
        items.push({
          group: 'Actions', title: 'Zoom to fit', keywords: ['fit', 'zoom', 'frame', 'center', 'view'],
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
          run: () => {
            const ids = Canvas.getAllNodes().map(n => n.id);
            if (ids.length) Canvas.fitToNodes(ids, { animate: true });
          }
        });
      }
      return items;
    }
  });
}

// Topbar Paths button → toggles the floating Paths panel.
function initTopbarPaths() {
  const btn = document.getElementById('tglPaths');
  const panel = document.getElementById('pathsFloatPanel');
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    const willShow = panel.hidden;
    panel.hidden = !willShow;
    btn.classList.toggle('active', willShow);
    if (willShow) renderPaths();
    syncPathDrawFloatOverlay();
  });
}

// V4: Topbar history button → opens left drawer history tab
function initTopbarHistory() {
  const btn = document.getElementById('tbHistoryBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const leftEl = document.getElementById('drawerLeft');
    if (!leftEl) return;
    const isOpen = leftEl.classList.contains('open');
    const historyActive = leftEl.querySelector('.drawer-tab.active')?.dataset?.tab === 'history';
    if (isOpen && historyActive) {
      leftEl.classList.remove('open');
      btn.classList.remove('active');
      return;
    }
    leftEl.classList.add('open');
    leftEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'history'));
    leftEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelHistory'));
    const ds = document.getElementById('discoverSearch');
    if (ds) ds.style.display = 'none';
    if (typeof renderHistory === 'function') { try { renderHistory(); } catch (_) {} }
    btn.classList.add('active');
    // Tutorial: advance once the History panel is opened from the topbar.
    if (window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('history-opened');
    }
  });
}

// Boot the V4 initializers after DOM is ready (idempotent — guards on null)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFloatPalette();
    initLeftnavProjects();
    initTopbarHistory();
    initTopbarPaths();
  });
} else {
  initFloatPalette();
  initLeftnavProjects();
  initTopbarHistory();
}

/* ── Tutorial hooks ────────────────────────────────────────
   Small DOM helpers the guided tour (tutorial-steps.js) calls from its
   onBeforeShow / onAfterHide handlers. Defined only on the editing page,
   so the steps guard with `window.TutorialHooks &&` before calling. */
window.TutorialHooks = {
  // Highlight the NEXT node the user should click while building a path
  // (Step 6). We compute the first three nodes of the starter chain and pulse
  // only the first one not yet in the path, so guidance stays sequential:
  // click "Input Data" → it becomes #1 → the highlight moves downstream.
  markPathTargets() {
    this.clearPathTargets();
    if (typeof Canvas === 'undefined' || !Canvas.getAllNodes) return;
    const nodes = Canvas.getAllNodes() || [];
    const conns = Canvas.getConnections() || [];
    const inDeg = new Map();
    const nextOf = new Map();
    nodes.forEach(n => inDeg.set(n.id, 0));
    conns.forEach(c => {
      const f = c && c.from && c.from[0];
      const t = c && c.to && c.to[0];
      if (!f || !t || !inDeg.has(t)) return;
      inDeg.set(t, (inDeg.get(t) || 0) + 1);
      if (!nextOf.has(f)) nextOf.set(f, t);
    });
    let start = nodes.find(n => inDeg.get(n.id) === 0) || nodes[0];
    const chain = [];
    let cur = start && start.id;
    while (cur && chain.length < 6 && !chain.includes(cur)) {
      chain.push(cur);
      cur = nextOf.get(cur);
    }
    // Dim the canvas (inside its own stacking context so the highlighted node
    // can pop above it — the global fixed overlay can't be escaped from inside
    // the transformed canvas).
    this.ensurePathDim();
    const picked = (typeof PATH_DRAW !== 'undefined' && PATH_DRAW.nodeIds) || [];
    const inner = (Canvas.getCanvasInner && Canvas.getCanvasInner()) || document;
    const lift = (id) => {
      const el = inner.querySelector(`.node[data-node-id="${CSS.escape(id)}"]`);
      if (el) el.classList.add('tt-node-target');
    };
    // Keep every node already in the path bright (un-dimmed), plus pulse the
    // next node the user should click.
    picked.forEach(lift);
    const next = chain.find(id => !picked.includes(id));
    if (next) lift(next);
  },
  clearPathTargets() {
    document.querySelectorAll('.tt-node-target')
      .forEach(el => el.classList.remove('tt-node-target'));
    this.removePathDim();
  },
  ensurePathDim() {
    if (typeof Canvas === 'undefined' || !Canvas.getCanvasInner) return;
    const inner = Canvas.getCanvasInner();
    if (!inner || inner.querySelector('.tt-canvas-dim')) return;
    const dim = document.createElement('div');
    dim.className = 'tt-canvas-dim';
    inner.appendChild(dim);
  },
  removePathDim() {
    document.querySelectorAll('.tt-canvas-dim').forEach(el => el.remove());
  },

  // Open the Runs panel as a normal bottom peek (docked, NOT expanded) with
  // the Runs tab active (Steps 9-10). It grows to full height on its own once
  // the run finishes — see expandRunsSmoothly().
  ensureRunsOpen() {
    const pf = document.getElementById('pathsFloatPanel');
    if (pf) pf.hidden = true;
    if (typeof openRunsPanelPeek === 'function') openRunsPanelPeek();
  },

  expandRunsSmoothly(onComplete) {
    if (typeof expandRunsPanelSmoothly === 'function') expandRunsPanelSmoothly(onComplete);
    else { try { onComplete && onComplete(); } catch (_) {} }
  },

  _openCatalog(type) {
    const leftEl = document.getElementById('drawerLeft');
    if (!leftEl) return;
    leftEl.classList.add('open');
    leftEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'discover'));
    leftEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelDiscover'));
    const ds = document.getElementById('discoverSearch');
    if (ds) ds.style.display = 'flex';
    if (typeof DISCOVER !== 'undefined') DISCOVER.activeType = type;
    if (typeof renderDiscover === 'function') renderDiscover();
  },
  openDatasetCatalog() { this._openCatalog('Dataset'); },
  openModelCatalog() { this._openCatalog('Model'); },

  // All nodes on the tutorial canvas for the "Chain them up" step (dataset +
  // starter transformer + output) — keep the view zoomed out on the full chain.
  _tutorialChainNodeIds() {
    try {
      const nodes = (Canvas.getAllNodes && Canvas.getAllNodes()) || [];
      const ids = nodes.map(n => n.id).filter(Boolean);
      if (ids.length) return ids;
    } catch (_) {}
    return this._wiringNodeIds();
  },

  // The two nodes the user wires together in the "Chain them up" step:
  // [datasetId, headId] where head is the chain's first model (the node with
  // inputs and no incoming connection, other than the just-added dataset).
  _wiringNodeIds() {
    const ids = [];
    const dsId = window._tutorialDatasetNodeId;
    if (dsId) ids.push(dsId);
    try {
      const nodes = (Canvas.getAllNodes && Canvas.getAllNodes()) || [];
      const conns = (Canvas.getConnections && Canvas.getConnections()) || [];
      const inDeg = new Map();
      nodes.forEach(n => inDeg.set(n.id, 0));
      conns.forEach(c => {
        const t = c && c.to && c.to[0];
        if (inDeg.has(t)) inDeg.set(t, inDeg.get(t) + 1);
      });
      const head = nodes.find(n =>
        n.id !== dsId &&
        Array.isArray(n.inputs) && n.inputs.length &&
        (inDeg.get(n.id) || 0) === 0);
      if (head) ids.push(head.id);
    } catch (_) {}
    return ids;
  },

  // Pulse the output anchor of the dataset and the input anchor of the head
  // model for the "Chain them up" step.
  markWirePorts() {
    this.clearWirePorts();
    const pick = (nodeId, sel) => nodeId
      ? document.querySelector(`.node[data-node-id="${CSS.escape(nodeId)}"] ${sel}`)
      : null;
    const [dsId, headId] = this._wiringNodeIds();
    const out = pick(dsId, '.port-anchor[data-port^="out:"]');
    if (out) out.classList.add('tt-port-target');
    const inp = pick(headId, '.port-anchor[data-port^="in:"]');
    if (inp) inp.classList.add('tt-port-target');
  },

  // Pulse the two wiring nodes (no canvas dim — the canvas stays fully bright).
  markWireNodes() {
    this.clearPathTargets();
    const inner = (Canvas.getCanvasInner && Canvas.getCanvasInner()) || document;
    this._wiringNodeIds().forEach(id => {
      const el = inner.querySelector(`.node[data-node-id="${CSS.escape(id)}"]`);
      if (el) el.classList.add('tt-node-target');
    });
  },

  // Collapse the catalog (left) drawer — used after a node is added so the
  // canvas + Inspector are clearly visible.
  closeLeftDrawer() {
    const el = document.getElementById('drawerLeft');
    if (el) el.classList.remove('open');
  },
  // Close the Inspector (right) drawer — used before the wiring step so the
  // port anchors aren't hidden behind a panel.
  closeRightDrawer() {
    const el = document.getElementById('drawerRight');
    if (el) el.classList.remove('open');
  },

  // Collapse the left (catalog), right (inspector), and bottom (runs) drawers
  // so the canvas is unobstructed — used for the "Click along the path" step.
  collapseAllDrawers() {
    const left = document.getElementById('drawerLeft');
    if (left) left.classList.remove('open');
    const right = document.getElementById('drawerRight');
    if (right) right.classList.remove('open');
    const bottom = document.getElementById('bottomPanel');
    if (bottom) bottom.classList.remove('open', 'expanded');
    if (typeof syncBpAppShell === 'function') { try { syncBpAppShell(); } catch (_) {} }
  },

  // Zoom out to show the full starter chain (dataset + transformer + output);
  // reserve left space for the top-left tooltip.
  fitForWiring() {
    try {
      const ids = this._tutorialChainNodeIds();
      if (ids.length && Canvas.fitToNodes) {
        Canvas.fitToNodes(ids, {
          padding: 96,
          reserve: { top: 72, bottom: 48, left: 360, right: 48 },
          maxZoom: 0.62,
          minZoom: 0.15,
        });
      }
    } catch (_) {}
  },
  clearWirePorts() {
    document.querySelectorAll('.port-anchor.tt-port-target')
      .forEach(el => el.classList.remove('tt-port-target'));
  },

  // Reveal the variant strip (the "variant row") if it's collapsed, so the
  // "New variant" + button is visible for the Make-a-variant step.
  openVariantRow() {
    const app = document.querySelector('.app');
    if (app && app.classList.contains('variants-hidden')) {
      app.classList.remove('variants-hidden');
      try { localStorage.setItem('cfg.variantsHidden', '0'); } catch (_) {}
    }
  },

  // After a variant is created during the tour, pan to an empty region of the
  // canvas (right of the starter chain) so newly-added nodes drop into open
  // space. addCatalogNode() places nodes at the viewport center, so centering
  // here lines the next adds up cleanly.
  zoomToEmptyArea() {
    if (typeof Canvas === 'undefined' || typeof Canvas.focusWorld !== 'function') return;
    let x = 2200, y = 380;
    try {
      const nodes = (Canvas.getAllNodes && Canvas.getAllNodes()) || [];
      if (nodes.length) {
        const maxX = Math.max(...nodes.map(n => n.x || 0));
        const avgY = nodes.reduce((s, n) => s + (n.y || 0), 0) / nodes.length;
        x = maxX + 620;
        y = avgY;
      }
    } catch (_) {}
    Canvas.focusWorld(x, y, { zoom: 0.9, animate: true });
  },

  // Compare step: pulse BOTH run compare checkboxes so the user knows to tick
  // each one. Cleared on step exit.
  markCompareChecks() {
    this.clearCompareChecks();
    document.querySelectorAll('.runs-list .run-compare-check')
      .forEach(el => el.classList.add('tt-check-target'));
  },
  clearCompareChecks() {
    document.querySelectorAll('.run-compare-check.tt-check-target')
      .forEach(el => el.classList.remove('tt-check-target'));
  },

  // "Collapse the subgroup" step — legacy; collapse now uses the spotlight
  // on .sg-toggle directly. Kept for any external callers.
  markSubgroupTarget() {
    this.clearPathTargets();
  },

  // Open the left drawer on the History tab for the snapshot step.
  openHistoryTab() {
    const leftEl = document.getElementById('drawerLeft');
    if (!leftEl) return;
    leftEl.classList.add('open');
    leftEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'history'));
    leftEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelHistory'));
    const ds = document.getElementById('discoverSearch');
    if (ds) ds.style.display = 'none';
    if (typeof renderHistory === 'function') renderHistory();
  },
};

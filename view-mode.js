const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Determine which project to load. Primary source is `?project=…` in the URL,
// with fallbacks via ConnectifyLeftnav.resolveProjectSlug() when a static-file
// server (notably `npx serve` with clean-URLs) drops the query string.
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
const PUBLIC_GRAPH_EDIT_OPT_IN_KEY = 'cfg.publicGraphEditOptInSlugs';
function rememberPublicGraphEditOptIn(s) {
  if (!s) return;
  try {
    const parsed = JSON.parse(localStorage.getItem(PUBLIC_GRAPH_EDIT_OPT_IN_KEY) || '[]');
    const set = new Set(Array.isArray(parsed) ? parsed : []);
    set.add(s);
    localStorage.setItem(PUBLIC_GRAPH_EDIT_OPT_IN_KEY, JSON.stringify([...set]));
  } catch (_) { /* storage */ }
}

function _readJSONStore(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (_) {
    return fallback;
  }
}

function _readCustomProjectBySlug(targetSlug) {
  try {
    const rows = _readJSONStore('cfg.customProjects', []);
    const hit = Array.isArray(rows) ? rows.find(r => r && r.slug === targetSlug) : null;
    return hit && hit.project ? hit.project : null;
  } catch (_) {
    return null;
  }
}

function _readVariantsForSlug(targetSlug) {
  const rows = _readJSONStore('cfg.variants.' + targetSlug, []);
  return Array.isArray(rows) ? rows : [];
}

function _activeVariantIdForSlug(targetSlug, variants) {
  const fromStorage = localStorage.getItem('cfg.activeVariant.' + targetSlug);
  if (fromStorage && variants.some(v => v && v.id === fromStorage)) return fromStorage;
  return variants[0] && variants[0].id ? variants[0].id : null;
}

/** Is the current viewer the owner/admin of this project?
 *  Custom projects live in cfg.customProjects and are user-owned by definition
 *  (forks make you Admin; user-created projects make you Owner). Bundled
 *  community graphs are not owned by the viewer. */
function _isOwnerOfSlug(targetSlug) {
  if (!targetSlug) return false;
  const rows = _readJSONStore('cfg.customProjects', []);
  if (!Array.isArray(rows)) return false;
  return rows.some((r) => r && r.slug === targetSlug);
}

/** All persisted runs for a project (newest first), merged across variants. */
function _getRunsForSlug(targetSlug) {
  if (!targetSlug) return [];
  const prefix = 'cfg.runs.' + targetSlug + '.';
  const all = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (Array.isArray(v)) all.push(...v);
    } catch (_) { /* ignore parse errors */ }
  }
  return all.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
}

/** Merge saved variant state (same keys as edit mode) so view matches last edit session. */
function _buildCanvasProjectFromVariantBase(slug, baseP) {
  const variants = _readJSONStore('cfg.variants.' + slug, null);
  if (!variants || !variants.length) return baseP;
  const activeId = localStorage.getItem('cfg.activeVariant.' + slug) || variants[0].id;
  const v = variants.find(x => x.id === activeId) || variants[0];
  if (!v) return baseP;
  return {
    ...baseP,
    canvasWidth: v.canvasWidth || baseP.canvasWidth,
    canvasHeight: v.canvasHeight || baseP.canvasHeight,
    nodes: v.nodes || [],
    connections: v.connections || [],
  };
}

if (!slug) {
  document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">No project specified. <a href="graphs-hub.html?tab=dashboard">Go to Home</a></p>';
} else {
  const custom = _readCustomProjectBySlug(slug);
  if (custom) {
    window.PROJECT = Object.assign({ slug }, custom, { slug });
    // Defer to a microtask so module-level const declarations further down
    // (MOCK_RUNS, etc.) finish initializing before initApp() reads them.
    // Without this, the synchronous call hits a TDZ error and halts before
    // wiring half of the UI.
    queueMicrotask(() => initApp());
  } else {
    const fail = () => {
      document.body.innerHTML = `<p style="padding:40px;font-family:sans-serif">Could not load project "${esc(slug)}". <a href="graphs-hub.html?tab=dashboard">Go to Home</a></p>`;
    };
    if (typeof bootstrapBundledProject !== 'function') {
      fail();
    } else {
      bootstrapBundledProject(slug).then(() => { initApp(); }, fail);
    }
  }
}


function openViewAdaptorDetails(ui, clientX, clientY) {
  const bd = document.getElementById('adaptorDetailsBackdrop');
  const pop = document.getElementById('adaptorDetailsPop');
  if (!bd || !pop || !ui) return;
  document.getElementById('adpDetailsDesc').textContent = ui.desc || '';
  document.getElementById('adpDetailsPill').innerHTML =
    `${Canvas.typePill(ui.adaptor.fromType)}<span class="adaptor-arrow">→</span>${Canvas.typePill(ui.adaptor.toType)}` +
    `<span style="margin-left:auto;font-weight:600;font-size:11px;">${esc(ui.adaptor.label || '')}</span>`;
  document.getElementById('adpDetailsPreview').textContent = ui.previewText || '';
  const pe = document.getElementById('adpDetailsParams');
  pe.innerHTML = (ui.params || []).map(p => {
    const v = ui.settings && ui.settings[p.key] != null ? String(ui.settings[p.key]) : '—';
    return `<div><strong>${esc(p.label)}</strong>: ${esc(v)}</div>`;
  }).join('') || '<div style="opacity:.6">No tunable parameters.</div>';
  const act = document.getElementById('adpDetailsActions');
  act.innerHTML = '<button type="button" id="adpViewCloseBtn">Close</button>';

  function position() {
    const pad = 12;
    const x = clientX != null ? clientX : window.innerWidth / 2;
    const y = clientY != null ? clientY : window.innerHeight / 3;
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

  function cleanup() {
    document.removeEventListener('keydown', onKey);
    bd.removeEventListener('mousedown', onBackdrop);
    document.getElementById('adpDetailsClose').removeEventListener('click', cleanup);
    document.getElementById('adpViewCloseBtn').removeEventListener('click', cleanup);
    bd.classList.remove('open');
    bd.setAttribute('aria-hidden', 'true');
  }
  function onKey(ev) { if (ev.key === 'Escape') cleanup(); }
  function onBackdrop(ev) { if (ev.target === bd) cleanup(); }

  document.getElementById('adpDetailsClose').addEventListener('click', cleanup);
  document.getElementById('adpViewCloseBtn').addEventListener('click', cleanup);
  document.addEventListener('keydown', onKey);
  bd.addEventListener('mousedown', onBackdrop);
  requestAnimationFrame(() => requestAnimationFrame(position));
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
  const basePath = location.pathname;
  const inviteLink = `${location.origin}${basePath}?project=${encodeURIComponent(P?.slug || P?.id || 'graph')}&invite=push`;
  const viewLink = `${location.origin}${String(basePath).replace('editing-mode-new.html', 'view-mode-new.html')}?project=${encodeURIComponent(P?.slug || P?.id || 'graph')}&mode=contributor`;
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

function _initTutorialForView() {
  if (!window.ConnectifyTutorial || !window.ConnectifyTutorialSteps) return;
  window.ConnectifyTutorial.init({
    page: 'view',
    steps: window.ConnectifyTutorialSteps.forPage('view'),
  });
  // If preview navigation landed here while state is still on step 1, bump
  // to step 2 (the fork step) so resume doesn't no-op on this page.
  setTimeout(() => {
    const s = window.ConnectifyTutorial.getState();
    if (s.started && !s.skipped && !s.completed && s.currentStep < 2) {
      window.ConnectifyTutorial.advanceTo(2);
    }
  }, 300);
}

function initApp() {
  const P0 = window.PROJECT;
  const P = _buildCanvasProjectFromVariantBase(slug, P0);
  document.title = 'ConnectifyAI — ' + P.title;
  document.getElementById('bcOrg').textContent = P.org;
  document.getElementById('bcProject').textContent = P.title;

  Canvas.init({
    offset: 0,
    editable: false,
    initialZoom: (P.viewZoom || 1.0),
    isNodeHeadSingleInspectOpen: isInspectorDrawerActive,
  });
  Canvas.build(P);

  // On entry, run the same auto-layout animation the editor's button performs —
  // but only when the user *opened* this view page fresh. Switching to view mode
  // from edit mode sets cfg.navHint.fromEditMode so we preserve the current
  // layout instead of re-flowing it.
  let cameFromEditMode = false;
  try {
    cameFromEditMode = sessionStorage.getItem('cfg.navHint.fromEditMode') === '1';
    if (cameFromEditMode) sessionStorage.removeItem('cfg.navHint.fromEditMode');
  } catch (_) {}

  requestAnimationFrame(() => {
    const nodes = Canvas.getAllNodes();
    if (!nodes.length) return;
    if (cameFromEditMode) {
      // Preserve layout — just fit it into view, no re-flow.
      if (typeof Canvas.fitToNodes === 'function') {
        Canvas.fitToNodes(nodes.map(n => n.id), { padding: 80, animate: false });
      }
    } else {
      viewAutoLayout();
    }
  });

  Canvas.onNodeClick(openInspector);
  Canvas.onAdaptorChipClick(({ connIndex, clientX, clientY }) => {
    const conn = Canvas.getConnections()[connIndex];
    if (!conn || !conn.adaptor) return;
    const ui = Canvas.getAdaptorUiModel(conn);
    openViewAdaptorDetails(ui, clientX, clientY);
  });

  initInfoPanel(P);
  initVariants();
  initPresence(P);
  initShareGraph(P);
  initDrawerToggles();
  initPaths();
  initBottomPanel();
  initZoomControls();
  initFindBar();
  initLeftNav(P);
  initRolePill();
  initRequestContributorModal(P);
  initForkFromView(P);

  // ───── Tutorial wiring (resumes Step 2 in view mode) ─────
  _initTutorialForView();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!Canvas.getAllNodes().length) {
      const inner = Canvas.getCanvasInner();
      const cw = parseFloat(inner?.style.width) || P.canvasWidth || 2200;
      const ch = parseFloat(inner?.style.height) || P.canvasHeight || 1400;
      Canvas.focusWorld(cw / 2, ch / 2, {
        zoom: (P.viewZoom != null && P.viewZoom > 0) ? P.viewZoom : 0.5,
        reserve: { top: 10, bottom: 10, left: 0, right: 0 },
      });
    }
  }));
}

/* ── Entry auto-layout ─────────────────────────────────────
   Read-only port of the editor's animated auto-layout (autoLayoutNodes).
   View mode has no subgraphs, so this is a node-only layered DAG flow:
   left→right by dependency depth, vertically centered per layer, animated
   into place and then fit into view. Mirrors the look of pressing the
   editor's auto-layout button. */
function viewAutoLayout() {
  if (viewAutoLayout._running) return;
  const nodes = Canvas.getAllNodes();
  const fit = (animate) => {
    if (typeof Canvas.fitToNodes === 'function') {
      Canvas.fitToNodes(nodes.map(n => n.id), { padding: 80, animate });
    }
  };
  if (nodes.length < 2) { fit(false); return; }
  viewAutoLayout._running = true;

  const byId = new Map(nodes.map(n => [n.id, n]));
  const sizeOf = (id) => {
    const el = document.querySelector(`.node[data-node-id="${CSS.escape(id)}"]`);
    return {
      width: Math.max(180, Math.round(el?.offsetWidth || 200)),
      height: Math.max(120, Math.round(el?.offsetHeight || 170)),
    };
  };
  const dim = new Map(nodes.map(n => [n.id, sizeOf(n.id)]));
  const blockHeight = id => dim.get(id)?.height || 160;
  const blockWidth = id => dim.get(id)?.width || 240;

  const ids = nodes.map(n => n.id);
  const succ = new Map(ids.map(id => [id, []]));
  const pred = new Map(ids.map(id => [id, []]));
  const edges = [];
  for (const c of Canvas.getConnections()) {
    const fromId = c?.from?.[0];
    const toId = c?.to?.[0];
    if (!fromId || !toId || fromId === toId) continue;
    if (!byId.has(fromId) || !byId.has(toId)) continue;
    succ.get(fromId).push(toId);
    pred.get(toId).push(fromId);
    edges.push([fromId, toId]);
  }

  const orphanIds = ids.filter(id => succ.get(id).length === 0 && pred.get(id).length === 0);
  const connectedIds = ids.filter(id => !orphanIds.includes(id));
  const layer = new Map(connectedIds.map(id => [id, 0]));
  for (let pass = 0; pass < connectedIds.length; pass++) {
    let changed = false;
    for (const [a, b] of edges) {
      if (!layer.has(a) || !layer.has(b)) continue;
      const next = (layer.get(a) || 0) + 1;
      if (next > (layer.get(b) || 0)) { layer.set(b, next); changed = true; }
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
  const minX = Math.min(...ids.map(id => Number(byId.get(id).x) || 0));
  const avgY = ids.reduce((sum, id) => sum + (Number(byId.get(id).y) || 0), 0) / Math.max(1, ids.length);
  const startX = Math.max(40, minX);
  const placedCenterY = new Map();
  const layout = {};

  if (orphanIds.length) {
    const colIds = [...orphanIds].sort((a, b) => (Number(byId.get(a).y) || 0) - (Number(byId.get(b).y) || 0));
    const totalColH = colIds.reduce((sum, id) => sum + blockHeight(id), 0) + Math.max(0, colIds.length - 1) * ROW_GAP;
    let cursorY = Math.round(avgY - (totalColH / 2));
    colIds.forEach(id => {
      const h = blockHeight(id);
      const y = Math.round(cursorY);
      layout[id] = { x: startX, y };
      placedCenterY.set(id, y + (h / 2));
      cursorY += h + ROW_GAP;
    });
  }

  const layerKeys = Array.from(layers.keys()).sort((a, b) => a - b);
  const layerWidths = new Map(layerKeys.map(l => [l, Math.max(...layers.get(l).map(id => blockWidth(id)), 220)]));
  let currentX = startX + (orphanIds.length ? (Math.max(...orphanIds.map(id => blockWidth(id)), 220) + COL_GAP) : 0);
  const layerX = new Map();
  layerKeys.forEach(l => { layerX.set(l, currentX); currentX += (layerWidths.get(l) || 220) + COL_GAP; });

  for (const l of layerKeys) {
    const colIds = layers.get(l) || [];
    colIds.sort((a, b) => {
      const score = (id) => {
        const ps = (pred.get(id) || []).filter(pid => placedCenterY.has(pid));
        if (!ps.length) return (Number(byId.get(id).y) || 0) + (blockHeight(id) / 2);
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
      layout[id] = { x, y };
      placedCenterY.set(id, y + (h / 2));
      cursorY += h + ROW_GAP;
    });
  }

  const finish = () => {
    viewAutoLayout._running = false;
    Canvas.drawEdges();
    requestAnimationFrame(() => fit(true));
  };
  const changed = Canvas.applyNodeLayout(layout, {
    animate: true,
    duration: 500,
    easing: 'cubic-bezier(0.42, 0, 0.58, 1)',
    onFrame: () => Canvas.drawEdges(),
    onComplete: finish,
  });
  if (!changed) finish();
}

/* ── Info panel ───────────────────────────────────────────
   Always-visible project identity block. Mirrors the old view-mode
   sidebar (title, author, tags, contributors, description) but lives
   inside the new grid layout instead of being a separate aside. */
function initInfoPanel(P) {
  document.getElementById('ipTitle').textContent = P.title || 'Untitled project';
  const author = (P.contributors || []).find(c => c.role === 'Owner') || (P.contributors || [])[0];
  document.getElementById('ipAuthor').textContent = author ? ('By ' + author.name) : '—';

  // Stars and forks stats — same ★/↯ glyphs as the community card stats row.
  const starCount = P.stars || 0;
  const forkCount = P.forks || 0;
  document.getElementById('ipStarCount').textContent = `${starCount} ★`;
  document.getElementById('ipForkCount').textContent = `${forkCount} ↯`;

  // Star button interaction
  const starBtn = document.getElementById('starBtn');
  let isStarred = false;
  try {
    const starredProjects = JSON.parse(localStorage.getItem('cfg.starredProjects') || '[]');
    isStarred = starredProjects.includes(slug);
  } catch (_) {}

  const updateStarButton = () => {
    if (isStarred) {
      starBtn.classList.add('starred');
      starBtn.setAttribute('title', 'Unstar this project');
    } else {
      starBtn.classList.remove('starred');
      starBtn.setAttribute('title', 'Star this project');
    }
  };
  updateStarButton();

  starBtn.addEventListener('click', () => {
    try {
      let starredProjects = JSON.parse(localStorage.getItem('cfg.starredProjects') || '[]');
      if (!Array.isArray(starredProjects)) starredProjects = [];
      if (isStarred) {
        starredProjects = starredProjects.filter(s => s !== slug);
        P.stars = Math.max(0, (P.stars || 1) - 1);
      } else {
        starredProjects.push(slug);
        P.stars = (P.stars || 0) + 1;
      }
      localStorage.setItem('cfg.starredProjects', JSON.stringify(starredProjects));
      isStarred = !isStarred;
      document.getElementById('ipStarCount').textContent = `${P.stars} ★`;
      updateStarButton();
    } catch (_) {}
  });

  const tagRow = document.getElementById('ipTagRow');
  const variantCount = _readVariantsForSlug(slug).length || 1;
  const extraTags = [`${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}`];
  tagRow.innerHTML = [...(P.tags || []), ...extraTags].map(t => `<span class="ip-tag">${esc(t)}</span>`).join('');

  const contribs = P.contributors || [];
  document.getElementById('ipContribCount').textContent =
    (typeof P.contributorCount === 'number' ? P.contributorCount : contribs.length) + ' Contributors';
  document.getElementById('ipContribs').innerHTML = contribs.map(c => `
    <div class="ip-contrib">
      <span class="av" style="background:${c.bg || 'var(--avatar-5)'}">${esc(c.letter || '?')}</span>
      <div class="body">
        <span class="name">${esc(c.name)}${c.role ? ` <span class="role">(${esc(c.role)})</span>` : ''}</span>
        ${typeof c.pushes === 'number' ? `<span class="meta">${c.pushes} pushes</span>` : ''}
      </div>
    </div>`).join('');

  const desc = P.description || 'No description provided.';
  const descEl = document.getElementById('ipDesc');
  const toggleEl = document.getElementById('ipDescToggle');
  descEl.textContent = desc;
  descEl.classList.add('clamp');
  toggleEl.classList.remove('expanded');
  toggleEl.querySelector('.ip-desc-toggle-label').textContent = 'Read more';

  if (!toggleEl.dataset.bound) {
    toggleEl.dataset.bound = '1';
    toggleEl.addEventListener('click', () => {
      const expanded = toggleEl.classList.toggle('expanded');
      descEl.classList.toggle('clamp', !expanded);
      toggleEl.querySelector('.ip-desc-toggle-label').textContent = expanded ? 'Read less' : 'Read more';
    });
  }

  // Remove the Read-more affordance if content does not overflow.
  requestAnimationFrame(() => {
    const overflowing = descEl.scrollHeight > descEl.clientHeight + 2;
    toggleEl.hidden = !overflowing;
    toggleEl.style.display = overflowing ? 'inline-flex' : 'none';
  });

  // Owners/Admins can edit the description inline. Click → contenteditable,
  // commit on blur/Enter, revert on Escape. Persists to cfg.customProjects.
  if (_isOwnerOfSlug(slug) && !descEl.dataset.editableBound) {
    descEl.dataset.editableBound = '1';
    descEl.title = 'Click to edit description';
    descEl.style.cursor = 'text';
    descEl.addEventListener('click', () => {
      if (descEl.isContentEditable) return;
      const original = (descEl.textContent || '').trim();
      descEl.classList.remove('clamp');
      descEl.setAttribute('contenteditable', 'true');
      descEl.focus();
      const range = document.createRange();
      range.selectNodeContents(descEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const commit = () => {
        descEl.removeEventListener('blur', commit);
        descEl.removeEventListener('keydown', onKey);
        descEl.removeAttribute('contenteditable');
        const next = (descEl.textContent || '').trim();
        _persistProjectDescription(slug, next);
        if (P) P.description = next;
        if (!next) descEl.textContent = 'No description provided.';
        descEl.classList.add('clamp');
      };
      const onKey = (ke) => {
        if (ke.key === 'Enter' && !ke.shiftKey) { ke.preventDefault(); descEl.blur(); }
        if (ke.key === 'Escape') { ke.preventDefault(); descEl.textContent = original; descEl.blur(); }
      };
      descEl.addEventListener('blur', commit);
      descEl.addEventListener('keydown', onKey);
    });
  }

  // Run summary: only show when this project has real persisted runs.
  const summaryEl = document.getElementById('ipRunSummary');
  if (!summaryEl) return;
  const latestRuns = _getRunsForSlug(slug).slice(0, 3);
  if (!latestRuns.length) {
    summaryEl.hidden = true;
    summaryEl.innerHTML = '';
    return;
  }
  summaryEl.hidden = false;
  const successRate = Math.round(
    (latestRuns.filter(r => String(r.status).toLowerCase() === 'success').length / latestRuns.length) * 100
  );
  const avgRuntime = Math.round(
    latestRuns.reduce((sum, r) => sum + Number(r.runtimeMin || 0), 0) / latestRuns.length
  );
  summaryEl.innerHTML = `
    <div class="row"><span class="k">Run Results Summary</span><span class="v">${latestRuns.length} recent runs</span></div>
    <div class="row"><span class="k">Success rate</span><span class="v">${successRate}%</span></div>
    <div class="row"><span class="k">Avg runtime</span><span class="v">${avgRuntime} min</span></div>
  `;
}

/** Persist an edited description to cfg.customProjects for this slug. */
function _persistProjectDescription(targetSlug, nextDesc) {
  try {
    const rows = JSON.parse(localStorage.getItem('cfg.customProjects') || '[]');
    if (!Array.isArray(rows)) return;
    const idx = rows.findIndex((r) => r && r.slug === targetSlug);
    if (idx < 0) return;
    const row = rows[idx] || {};
    const proj = Object.assign({}, row.project || {}, { description: nextDesc });
    rows[idx] = Object.assign({}, row, { project: proj });
    localStorage.setItem('cfg.customProjects', JSON.stringify(rows));
  } catch (_) { /* storage */ }
}

/* ── Variants (read-only — switch but no add/rename/delete) ── */
function initVariants() {
  const strip = document.getElementById('variantStrip');
  const storedVariants = _readVariantsForSlug(slug);
  const variants = (storedVariants.length ? storedVariants : [
    { id: 'v1', name: 'Master' },
    { id: 'v2', name: 'ResNet swap' },
    { id: 'v3', name: 'Smaller LIDAR' },
  ]).map(v => ({ id: v.id, name: v.name || 'Untitled variant', active: false }));
  const initialActiveId = _activeVariantIdForSlug(slug, variants) || variants[0]?.id;
  variants.forEach(v => { v.active = (v.id === initialActiveId); });
  function render() {
    strip.innerHTML = variants.map((v, i) => `
      <button class="variant-tab ${v.active ? 'active' : ''}" data-vid="${v.id}">
        <span class="tab-dot"></span><span>v${i+1} · ${esc(v.name)}</span>
      </button>`).join('');
    strip.querySelectorAll('.variant-tab').forEach(t => t.addEventListener('click', () => {
      variants.forEach(v => v.active = (v.id === t.dataset.vid));
      const active = variants.find(v => v.active);
      document.getElementById('bcVariant').textContent =
        'v' + (variants.indexOf(active)+1) + ' ' + active.name;
      render();
    }));
  }
  render();
}

/* ── Presence ─────────────────────────────────────────────── */
function initPresence(P) {
  const btn = document.getElementById('presenceBtn');
  const avatarsEl = document.getElementById('presenceAvatars');
  const countEl = document.getElementById('presenceCount');
  const dropdown = document.getElementById('presenceDropdown');
  // Presence stack is optional in view-mode chrome (may be omitted from HTML).
  if (!btn || !avatarsEl || !countEl || !dropdown) return;
  const all = (P.contributors || []).slice(0, 8);
  const stack = Math.min(3, all.length);
  avatarsEl.innerHTML = all.slice(0, stack).map(c =>
    `<span class="pav" style="background:${c.bg || 'var(--avatar-5)'}">${esc(c.letter || '?')}</span>`).join('');
  countEl.textContent = all.length;
  // No "Viewing now" header — the row list is self-explanatory and the
  // label felt redundant when the dropdown only has one section.
  dropdown.innerHTML = all.map(c => `
    <div class="presence-row">
      <span class="pav" style="background:${c.bg || 'var(--avatar-5)'}">${esc(c.letter || '?')}</span>
      <span class="name">${esc(c.name || 'Unknown')}</span>
    </div>`).join('');
  btn.addEventListener('click', () => dropdown.classList.toggle('open'));
  document.addEventListener('mousedown', e => {
    if (!dropdown.classList.contains('open')) return;
    if (btn.contains(e.target) || dropdown.contains(e.target)) return;
    dropdown.classList.remove('open');
  });
}

/* ── Drawer toggles ───────────────────────────────────────── */
function initDrawerToggles() {
  const rightEl = document.getElementById('drawerRight');
  function activate(tab) {
    rightEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    rightEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id.toLowerCase().endsWith(tab)));
    document.querySelectorAll('.tb-toggle[data-tab]').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab && rightEl.classList.contains('open')));
  }
  document.querySelectorAll('.tb-toggle[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (btn.classList.contains('active')) {
        rightEl.classList.remove('open');
        btn.classList.remove('active');
      } else {
        rightEl.classList.add('open');
        activate(tab);
      }
    });
  });
  rightEl.querySelectorAll('.drawer-tab').forEach(t =>
    t.addEventListener('click', () => activate(t.dataset.tab)));
  document.getElementById('drawerRightClose').addEventListener('click', () => {
    rightEl.classList.remove('open');
    document.querySelectorAll('.tb-toggle[data-tab]').forEach(t => t.classList.remove('active'));
  });

  // Results button opens the bottom panel on the "runs" tab (editing-mode only).
  const resBtn = document.getElementById('tglResults');
  if (resBtn) {
    resBtn.addEventListener('click', () => {
      const panel = document.getElementById('bottomPanel');
      if (!panel) return;
      const isOpen = panel.classList.contains('open');
      panel.classList.toggle('open');
      resBtn.classList.toggle('active', !isOpen);
      if (panel.classList.contains('open')) {
        panel.querySelectorAll('.bp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'runs'));
        panel.querySelectorAll('.bp-panel').forEach(b => b.classList.toggle('active', b.id === 'bpRuns'));
      }
    });
  }
}

/* ── Paths (read-only). Reuses localStorage from editing-mode-new. ── */
function initPaths() {
  const panel = document.getElementById('panelPaths');
  const variants = _readVariantsForSlug(slug);
  const activeVid = _activeVariantIdForSlug(slug, variants);
  const storageKeys = [];
  if (activeVid) storageKeys.push('cfg.paths.' + slug + '.' + activeVid);
  variants.forEach(v => {
    if (!v || !v.id) return;
    const k = 'cfg.paths.' + slug + '.' + v.id;
    if (!storageKeys.includes(k)) storageKeys.push(k);
  });
  storageKeys.push('cfg.paths.' + slug); // legacy fallback
  let storedRaw = null;
  for (const key of storageKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        storedRaw = raw;
        break;
      }
    } catch (_) {}
  }
  let paths = [];
  try { paths = storedRaw ? JSON.parse(storedRaw) : []; } catch (_) { paths = []; }
  paths = (Array.isArray(paths) ? paths : []).map((p, i) => {
    const nodeIds = Array.isArray(p?.nodeIds) ? p.nodeIds : (Array.isArray(p?.nodes) ? p.nodes : []);
    const author = typeof p?.author === 'string'
      ? p.author
      : (p?.author && typeof p.author.name === 'string' ? p.author.name : 'Unknown');
    return {
      ...p,
      id: p?.id || ('path_' + i),
      name: p?.name || ('Path ' + (i + 1)),
      nodeIds,
      author,
    };
  });
  if (!paths.length) {
    panel.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M6.5 17.5C10 13 14 11 17.5 6.5" stroke-dasharray="3 3"/></svg>
      <div>No saved paths for this graph yet.</div>
    </div>`;
    return;
  }
  panel.innerHTML = paths.map((p, i) => `
    <div class="path-item" data-idx="${i}">
      <div class="t">${esc(p.name || 'Untitled path')}</div>
      <div class="m">${(p.nodeIds||[]).length} node${(p.nodeIds||[]).length === 1 ? '' : 's'} · ${esc(p.author || 'Unknown')}</div>
    </div>`).join('');
  panel.querySelectorAll('.path-item').forEach(el => el.addEventListener('click', () => {
    const idx = parseInt(el.dataset.idx, 10);
    focusPath(paths[idx]);
  }));
}

function focusPath(p) {
  const ids = p.nodeIds || p.nodes || [];
  document.querySelectorAll('.node').forEach(n => n.classList.remove('path-highlight', 'path-dim'));
  if (!ids.length) return;
  const set = new Set(ids);
  document.querySelectorAll('.node').forEach(n => {
    n.classList.add(set.has(n.dataset.nodeId) ? 'path-highlight' : 'path-dim');
  });
  Canvas.fitToNodes(ids, { padding: 80, maxZoom: 1.6 });
}

/* ── Inspector ────────────────────────────────────────────── */
function isInspectorDrawerActive() {
  const rightEl = document.getElementById('drawerRight');
  if (!rightEl?.classList.contains('open')) return false;
  const tab = rightEl.querySelector('.drawer-tab[data-tab="inspector"]');
  const panel = document.getElementById('panelInspector');
  return !!(tab?.classList.contains('active') && panel?.classList.contains('active'));
}
function openInspector(n) {
  const rightEl = document.getElementById('drawerRight');
  rightEl.classList.add('open');
  rightEl.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'inspector'));
  rightEl.querySelectorAll('.drawer-panel').forEach(p => p.classList.toggle('active', p.id === 'panelInspector'));
  document.querySelectorAll('.tb-toggle[data-tab]').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.node.selected').forEach(e => e.classList.remove('selected'));
  document.querySelector(`.node[data-node-id="${n.id}"]`)?.classList.add('selected');

  const empty = document.getElementById('inspectorEmpty');
  const content = document.getElementById('inspectorContent');
  empty.style.display = 'none';
  content.style.display = 'block';
  const color = n.color || 'blue';
  const portRows = (label, list) => `
    <div class="insp-section">
      <h4>${label} (${(list||[]).length})</h4>
      ${(list||[]).map(p => `
        <div class="insp-port-row"><span class="pname">${esc(p.name)}</span>${Canvas.typePill(p.type)}</div>
      `).join('') || `<div style="font-size:12px;color:var(--text-muted)">No ${label.toLowerCase()}</div>`}
    </div>`;
  content.innerHTML = `
    <div class="inspector-hd">
      <span class="dot" style="background: var(--dot-${color})"></span>
      <span class="name">${esc(n.name || n.label || 'Untitled')}</span>
      <span class="kind">${esc(n.type || '')}</span>
    </div>
    <div class="insp-section">
      <h4>Metadata</h4>
      <div class="insp-row"><span class="k">ID</span><span class="v">${esc(n.id)}</span></div>
      <div class="insp-row"><span class="k">Owner</span><span class="v">${esc(n.user?.letter || '—')}</span></div>
    </div>
    ${portRows('Inputs',  n.inputs)}
    ${portRows('Outputs', n.outputs)}`;
}

/* ── Bottom panel (Results) ──────────────────────────────── */
function initBottomPanel() {
  const panel = document.getElementById('bottomPanel');
  const tabs = panel.querySelectorAll('.bp-tab');
  const bodies = panel.querySelectorAll('.bp-panel');
  function activate(tab) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    bodies.forEach(b => b.classList.toggle('active', b.id.toLowerCase().endsWith(tab)));
  }
  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));
  document.getElementById('bpClose').addEventListener('click', () => {
    panel.classList.remove('open');
    document.getElementById('tglResults')?.classList.remove('active');
  });
  renderRuns();
  renderLogs();
  activate('runs');
}

const MOCK_RUNS = [
  { id: 'r3', name: 'v3 · Smaller LIDAR', when: '2 min ago',  status: 'ok', acc: 87.3, f1: 0.82, loss: 0.31, iter: '12k' },
  { id: 'r2', name: 'v2 · ResNet swap',   when: '18 min ago', status: 'ok', acc: 89.1, f1: 0.85, loss: 0.28, iter: '12k' },
  { id: 'r1', name: 'v1 · Master',        when: 'yesterday',  status: 'ok', acc: 88.4, f1: 0.83, loss: 0.30, iter: '10k' },
];
function renderRuns() {
  const panel = document.getElementById('bpRuns');
  document.getElementById('runsCount').textContent = MOCK_RUNS.length;
  const activeId = MOCK_RUNS[0].id;
  panel.innerHTML = `
    <div class="runs-grid">
      <div class="runs-list">
        ${MOCK_RUNS.map(r => `
          <div class="run-card ${r.id === activeId ? 'active' : ''}" data-id="${r.id}">
            <div class="t"><span class="status"></span> ${esc(r.name)}</div>
            <div class="m">${esc(r.when)} · ${r.acc}% acc</div>
          </div>
        `).join('')}
      </div>
      <div class="run-detail" id="runDetail"></div>
    </div>`;
  panel.querySelectorAll('.run-card').forEach(c => c.addEventListener('click', () => {
    panel.querySelectorAll('.run-card').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    showRunDetail(c.dataset.id);
  }));
  showRunDetail(activeId);
}
function showRunDetail(id) {
  const r = MOCK_RUNS.find(x => x.id === id);
  const host = document.getElementById('runDetail');
  if (!r || !host) return;
  host.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:14px;font-weight:600;">${esc(r.name)}</div>
      <div style="font-size:12px;color:var(--text-muted);">${esc(r.when)} · ${esc(r.iter)} iters</div>
    </div>
    <div class="metric-grid">
      <div class="metric"><div class="lbl">Accuracy</div><div class="num">${r.acc}%</div></div>
      <div class="metric"><div class="lbl">F1</div><div class="num">${r.f1}</div></div>
      <div class="metric"><div class="lbl">Loss</div><div class="num">${r.loss}</div></div>
      <div class="metric"><div class="lbl">Iters</div><div class="num">${esc(r.iter)}</div></div>
    </div>`;
}
function renderLogs() {
  document.getElementById('bpLogs').innerHTML = `
    <pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.65;color:var(--text-secondary);white-space:pre-wrap;padding:8px;background:var(--bg);border:1px solid var(--border-light);border-radius:7px;">[13:42:01] Graph compiled — 42 nodes, 67 edges
[13:43:49] epoch 3/3 · loss 0.31 · acc 87.3%
[13:43:49] Run complete — results saved</pre>`;
}

/* ── Zoom ─────────────────────────────────────────────────── */
function initZoomControls() {
  document.getElementById('zoomIn').addEventListener('click', () => Canvas.zoomIn());
  document.getElementById('zoomOut').addEventListener('click', () => Canvas.zoomOut());
  document.getElementById('zoomFit').addEventListener('click', () => {
    const ids = Canvas.getAllNodes().map(n => n.id);
    if (ids.length) Canvas.fitToNodes(ids, { padding: 80 });
  });
  // Keep the zoom percentage live.
  setInterval(() => {
    const t = Canvas.getTransform();
    document.getElementById('zoomValue').textContent = Math.round(t.zoom * 100) + '%';
  }, 500);
}

/* ── Find bar ─────────────────────────────────────────────── */
function initFindBar() {
  const bar = document.getElementById('findBar');
  const input = document.getElementById('findInput');
  const count = document.getElementById('findCount');
  const close = document.getElementById('findClose');

  const matchesFor = (q) => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return Canvas.getAllNodes().filter(n => {
      const hay = ((n.name || '') + ' ' + (n.label || '')).toLowerCase();
      return hay.includes(lower);
    });
  };
  const updateCount = () => {
    const ms = matchesFor(input.value.trim());
    count.textContent = ms.length ? ms.length + ' match' + (ms.length === 1 ? '' : 'es') : (input.value.trim() ? 'no matches' : '');
  };
  const flashNode = (id) => {
    const el = document.querySelector(`.node[data-node-id="${id}"]`);
    if (!el) return;
    el.classList.remove('find-flash');
    void el.offsetWidth;
    el.classList.add('find-flash');
  };
  const jump = () => {
    const ms = matchesFor(input.value.trim());
    if (!ms.length) return;
    Canvas.fitToNodes(ms.map(m => m.id), { padding: 80, maxZoom: 1.8 });
    setTimeout(() => ms.forEach(m => flashNode(m.id)), 220);
  };

  function open()  { bar.hidden = false; input.value = ''; count.textContent = ''; input.focus(); }
  function closeBar() { bar.hidden = true; }

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); open(); return; }
    if (e.key === 'Escape' && !bar.hidden) closeBar();
  });
  close.addEventListener('click', closeBar);
  input.addEventListener('input', updateCount);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); jump(); }
    if (e.key === 'Escape') { e.preventDefault(); closeBar(); }
  });
}

/* ── Leftnav ──────────────────────────────────────────────── */
function initLeftNav(P) {
  const app = document.querySelector('.app');
  if (document.documentElement.getAttribute('data-leftnav') === 'expanded') {
    app.classList.add('leftnav-expanded');
  }
  const navToggleBtn = document.getElementById('navToggleBtn');
  if (navToggleBtn) {
    navToggleBtn.addEventListener('click', () => {
      const expanded = app.classList.toggle('leftnav-expanded');
      localStorage.setItem('cfg.leftnav.expanded', expanded ? '1' : '0');
      navToggleBtn.title = expanded ? 'Collapse navigation' : 'Expand navigation';
      navToggleBtn.setAttribute('aria-label', expanded ? 'Collapse navigation' : 'Expand navigation');
    });
  }

  // Persist projects/teams collapsable state across page navigations via
  // the shared helper in leftnav.js.
  const wireCollapsable = (window.ConnectifyLeftnav && window.ConnectifyLeftnav.wireCollapsable) || function() {};
  wireCollapsable('leftnavProjects', 'lpHeaderToggle');

  // Render the projects tree from cfg.customProjects (forks + user-created).
  // These are the user's own projects, so clicks go straight to edit mode.
  if (window.ConnectifyLeftnav && typeof window.ConnectifyLeftnav.renderProjects === 'function') {
    window.ConnectifyLeftnav.renderProjects(slug);
  }

  document.getElementById('lpAddProject')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'graphs-hub.html?tab=dashboard&new=1';
  });

  document.getElementById('leftnavSearch')?.addEventListener('click', () => {
    const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
    document.dispatchEvent(ev);
  });

  // Auth: render chip + wire click → login modal or account menu. See
  // auth.js for the full surface. Falls back silently if auth.js is not
  // loaded on this page.
  if (window.ConnectifyAuth && typeof window.ConnectifyAuth.wireLeftnavAuth === 'function') {
    window.ConnectifyAuth.wireLeftnavAuth();
  }
  document.getElementById('leftnavCredits')?.addEventListener('click', () => {
    if (window.ConnectifyLeftnav && typeof window.ConnectifyLeftnav.showCreditsModal === 'function') {
      window.ConnectifyLeftnav.showCreditsModal({ remaining: 100, cap: 100 });
    }
  });
  const editLink = document.getElementById('navEditLink');
  if (editLink) {
    try {
      const last = localStorage.getItem('cfg.lastEditedSlug');
      const slug = last || new URLSearchParams(location.search).get('project');
      if (slug) editLink.href = `editing-mode-new.html?project=${encodeURIComponent(slug)}`;
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

/* ── Role pill ────────────────────────────────────────────── */
function initRolePill() {
  const btn  = document.getElementById('rolePillBtn');
  const menu = document.getElementById('roleDropdown');
  if (!btn || !menu) return;
  const isOwner = _isOwnerOfSlug(slug);

  // Update role pill text and dropdown options based on user permissions
  const pillText = document.getElementById('rolePillText');
  const currentOpt = document.getElementById('roleOptCurrent');
  const currentOptText = document.getElementById('roleOptCurrentText');
  const editModeOpt = document.getElementById('roleOptEditMode');
  const requestContribOpt = document.getElementById('roleOptRequestContributor');
  const requestAdminOpt = document.getElementById('roleOptAdmin');
  const divider = menu.querySelector('.role-divider');

  if (isOwner) {
    // User is owner/admin/contributor: show "View Mode" with "Switch to Edit Mode" option
    pillText.textContent = 'View Mode';
    currentOptText.textContent = 'View Mode';
    editModeOpt.style.display = '';
    requestContribOpt.style.display = 'none';
    requestAdminOpt.style.display = 'none';
    divider.style.display = 'none';
  } else {
    // User is view-only: show "View Only" with "Request Contributor" option
    pillText.textContent = 'View Only';
    currentOptText.textContent = 'View Only';
    editModeOpt.style.display = 'none';
    requestContribOpt.style.display = '';
    requestAdminOpt.style.display = '';
    requestAdminOpt.classList.add('disabled');
    divider.style.display = 'none';
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const r = btn.getBoundingClientRect();
    const open = menu.classList.contains('open');
    menu.classList.toggle('open', !open);
    if (!open) {
      const menuW = 220;
      let left = r.right - menuW;
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      menu.style.left = left + 'px';
      menu.style.top  = (r.bottom + 6) + 'px';
    }
  });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.addEventListener('click', e => e.stopPropagation());

  editModeOpt.addEventListener('click', () => {
    menu.classList.remove('open');
    rememberPublicGraphEditOptIn(slug);
    window.location.href = 'editing-mode-new.html?project=' + encodeURIComponent(slug);
  });

  requestContribOpt.addEventListener('click', () => {
    menu.classList.remove('open');
    const modal = document.getElementById('requestContributorModal');
    if (modal) modal.classList.add('show');
  });
}

/* ── Request Contributor (public graph) — same modal pattern as edit-mode
   Request Admin; wireframe only (no backend). */
function initRequestContributorModal(P) {
  const modal = document.getElementById('requestContributorModal');
  const closeBtn = document.getElementById('requestContributorClose');
  const cancelBtn = document.getElementById('requestContributorCancel');
  const submitBtn = document.getElementById('requestContributorSubmit');
  const recipEl = document.getElementById('contributorRecipientNames');
  const reasonEl = document.getElementById('contributorReasonInput');
  const scopeEl = document.getElementById('contributorScopeInput');
  const openBtn = document.getElementById('contributeBtn');
  if (!modal || !closeBtn || !cancelBtn || !submitBtn || !recipEl || !openBtn) return;

  // Owners/Admins skip the contribute-request flow. The button becomes "edit"
  // (same lightning bolt) and links straight to the editor.
  if (_isOwnerOfSlug(slug)) {
    openBtn.classList.remove('primary');
    openBtn.classList.add('primary'); // keep primary blue
    openBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13h6L9 22l8.5-11h-6L13 2z"/></svg> edit`;
    openBtn.addEventListener('click', () => {
      window.location.href = 'editing-mode-new.html?project=' + encodeURIComponent(slug);
    });
    return;
  }

  function recipientNames() {
    const owners = (P.contributors || []).filter(
      (c) => c && (String(c.role) === 'Owner' || String(c.role) === 'Admin')
    );
    return owners.length
      ? owners.map((c) => c.name).join(', ')
      : (P.contributors && P.contributors[0] && P.contributors[0].name) || 'project owners';
  }

  const close = () => {
    modal.classList.remove('show');
    if (reasonEl) reasonEl.value = '';
    if (scopeEl) scopeEl.value = '';
  };

  function setPendingState() {
    openBtn.classList.remove('primary');
    openBtn.classList.add('pending');
    openBtn.disabled = true;
    openBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> pending`;
  }

  // Restore pending state if request was already sent this session
  try {
    if (sessionStorage.getItem('contributorRequestPending_' + slug) === 'true') setPendingState();
  } catch (_) { /* ignore */ }

  openBtn.addEventListener('click', () => {
    recipEl.textContent = recipientNames();
    modal.classList.add('show');
  });
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  submitBtn.addEventListener('click', () => {
    try {
      sessionStorage.setItem('contributorRequestPending_' + slug, 'true');
    } catch (_) { /* ignore */ }
    close();
    setPendingState();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) close();
  });
}

/** Fork public/custom graph into My Graphs; user becomes Admin on the copy.
 *  For owned/admin projects, the same button becomes "duplicate" and always
 *  creates a fresh copy (bypassing the fork-dedup) since the user is asking
 *  for an explicit duplicate of their own project. */
function initForkFromView(P) {
  const btn = document.getElementById('forkBtn');
  const modal = document.getElementById('forkConfirmModal');
  if (!btn || !slug || !window.ConnectifyFork) return;

  if (_isOwnerOfSlug(slug)) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/></svg> duplicate`;
    btn.title = 'Duplicate this project';
    btn.addEventListener('click', () => {
      window.ConnectifyFork.forkProjectToMyGraphs(slug, {
        title: P?.title || 'Project',
        owner: 'You',
        domain: (P?.tags || [])[0] || '',
        method: (P?.tags || [])[1] || '',
        abstract: P?.description || '',
      }, { forceCreate: true });
    });
    return;
  }

  if (!modal) return;

  function forkBodyText() {
    const t = ((P && P.title) || 'this graph').trim() || 'this graph';
    return (
      `Create your own copy of "${t}" with its canvas, variants, paths, and experiments?`
    );
  }

  function openForkModal() {
    const bodyEl = document.getElementById('forkConfirmBody');
    if (bodyEl) bodyEl.textContent = forkBodyText();
    modal.classList.add('show');
    try {
      document.body.style.overflow = 'hidden';
    } catch (_) {}
  }

  function closeForkModal() {
    modal.classList.remove('show');
    try {
      document.body.style.overflow = '';
    } catch (_) {}
  }

  function runFork() {
    const tag0 = (P.tags || [])[0];
    const tag1 = (P.tags || [])[1];
    window.ConnectifyFork.forkProjectToMyGraphs(slug, {
      title: P.title,
      owner: P.org || 'Community',
      domain: tag0 || 'General',
      method: tag1 || 'Custom',
      abstract: P.description || '',
    }).catch(() => {
      alert('Could not fork this graph. If you are offline, try again when the project can load.');
    });
  }

  btn.addEventListener('click', () => {
    // Notify tutorial Step 3 (fork-clicked) before the modal opens.
    // (notifyAction is a no-op when the tour isn't running.)
    if (window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('fork-clicked', { slug });
    }
    // During the guided tour, skip the confirm dialog entirely — clicking Fork
    // takes the user straight to their editable canvas.
    let tourOn = false;
    try {
      const s = window.ConnectifyTutorial && window.ConnectifyTutorial.getState();
      tourOn = !!(s && s.started && !s.skipped && !s.completed);
    } catch (_) {}
    if (tourOn) { runFork(); return; }
    openForkModal();
  });

  if (modal.dataset.forkBound === '1') return;
  modal.dataset.forkBound = '1';

  document.getElementById('forkConfirmClose')?.addEventListener('click', closeForkModal);
  document.getElementById('forkConfirmCancel')?.addEventListener('click', closeForkModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeForkModal();
  });
  document.getElementById('forkConfirmOk')?.addEventListener('click', () => {
    // Notify tutorial Step 3 (fork-confirmed). The page is about to
    // redirect into editing mode, so persist state immediately.
    if (window.ConnectifyTutorial) {
      window.ConnectifyTutorial.notifyAction('fork-confirmed', { slug });
    }
    closeForkModal();
    runFork();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.classList.contains('show')) return;
    e.preventDefault();
    closeForkModal();
  });
}

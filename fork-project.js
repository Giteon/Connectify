/**
 * Fork a graph into cfg.customProjects: deep-clone project data, copy
 * variant-scoped localStorage (paths / runs / history / variants), reset
 * people on the fork, and navigate to the editor.
 */
(function (global) {
  'use strict';

  function readJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* quota */ }
  }
  function readCustomProjects() {
    const rows = readJSON('cfg.customProjects', []);
    return Array.isArray(rows) ? rows : [];
  }
  function writeCustomProjects(rows) {
    writeJSON('cfg.customProjects', rows || []);
  }

  /** @param {string} base includes trailing " Copy" if desired */
  function uniqueForkTitle(base) {
    const rows = readCustomProjects();
    const taken = new Set(rows.map((r) => r && r.title).filter(Boolean));
    let title = base;
    let n = 2;
    while (taken.has(title)) title = `${base} (${n++})`;
    return title;
  }

  function copyProjectStorage(fromSlug, toSlug) {
    if (!fromSlug || !toSlug || fromSlug === toSlug) return;
    const esc = fromSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      '^cfg\\.(variants|activeVariant|projectTitle)\\.' + esc + '$|^cfg\\.(paths|runs|history)\\.' + esc + '\\.'
    );
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && re.test(k)) keys.push(k);
    }
    keys.forEach((k) => {
      const nk = k.split(fromSlug).join(toSlug);
      if (nk === k) return;
      try {
        const v = localStorage.getItem(k);
        if (v != null) localStorage.setItem(nk, v);
      } catch (_) { /* quota */ }
    });
  }

  /**
   * @param {object} project
   * @param {string} newSlug
   * @param {string} newTitle
   * @param {'Admin'|'Owner'} roleYou
   */
  function stripPeopleFork(project, newSlug, newTitle, roleYou) {
    const p = JSON.parse(JSON.stringify(project));
    p.slug = newSlug;
    p.title = newTitle;
    p.contributors = [
      { name: 'You', role: roleYou || 'Admin', letter: 'JS', bg: 'var(--avatar-5)', pushes: 0 },
    ];
    p.contributorCount = 1;
    p.othersCount = 0;
    p.othersPreview = '';
    p.others = [];
    delete p.comments;
    return p;
  }

  /**
   * Fork into My Graphs and open the editor. Requires bootstrapBundledProject
   * on global when forking a bundled slug without a custom row.
   * @param {string} sourceSlug
   * @param {{title?:string,owner?:string,domain?:string,method?:string,abstract?:string}} meta
   */
  async function forkProjectToMyGraphs(sourceSlug, meta, opts) {
    meta = meta || {};
    opts = opts || {};
    const customs = readCustomProjects();
    // If this source has already been forked, open the existing fork instead
    // of creating a duplicate row in the leftnav projects tree. Callers can
    // opt out by passing { forceCreate: true } (used by the "duplicate"
    // action on user-owned projects, which should always make a fresh copy).
    if (!opts.forceCreate) {
      const existingFork = customs.find((r) => r && r.forkedFrom === sourceSlug);
      if (existingFork && existingFork.slug) {
        try { sessionStorage.setItem('cfg.navHint.project', existingFork.slug); } catch (_) {}
        global.location.href =
          'editing-mode-new.html?project=' + encodeURIComponent(existingFork.slug);
        return;
      }
    }
    const row = customs.find((r) => r && r.slug === sourceSlug);
    let base = null;
    if (row && row.project) {
      base = JSON.parse(JSON.stringify(row.project));
    } else if (typeof global.bootstrapBundledProject === 'function') {
      try {
        await global.bootstrapBundledProject(sourceSlug);
        if (global.PROJECT) {
          base = JSON.parse(JSON.stringify(global.PROJECT));
          delete global.PROJECT;
        }
      } catch (_) {
        /* fall through to shell */
      }
    }
    if (!base) {
      base = {
        org: meta.owner || 'Community',
        tags: [meta.domain, meta.method].filter(Boolean),
        description: meta.abstract || '',
        nodes: [],
        connections: [],
        subgraphs: [],
        canvasWidth: 2400,
        canvasHeight: 1600,
        viewZoom: 0.52,
      };
    }
    const newSlug = 'fork-' + sourceSlug + '-' + Date.now().toString(36);
    const baseTitle = (meta.title || 'Graph') + ' Copy';
    const title = uniqueForkTitle(baseTitle);
    const project = stripPeopleFork(base, newSlug, title, 'Admin');
    try {
      localStorage.setItem('cfg.projectTitle.' + newSlug, title);
    } catch (_) { /* ignore */ }
    copyProjectStorage(sourceSlug, newSlug);
    customs.unshift({
      slug: newSlug,
      title,
      createdAt: Date.now(),
      forkedFrom: sourceSlug,
      project,
    });
    writeCustomProjects(customs);
    try { sessionStorage.setItem('cfg.navHint.project', newSlug); } catch (_) {}
    global.location.href =
      'editing-mode-new.html?project=' + encodeURIComponent(newSlug);
  }

  global.ConnectifyFork = {
    copyProjectStorage,
    forkProjectToMyGraphs,
    uniqueForkTitle,
    stripPeopleFork,
  };
})(window);

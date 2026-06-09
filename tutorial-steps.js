/* ============================================================
   tutorial-steps.js — Step definitions for the guided tour.
   Loaded after tutorial-system.js. Exposes:
     ConnectifyTutorialSteps.forPage('hub' | 'view' | 'edit')
   Each page passes its filtered slice into ConnectifyTutorial.init.

   Each step:
     id              — sequential 1..N (must match array order)
     phase           — 'hub' | 'view' | 'edit'
     title           — short header
     text            — body copy (1–2 short sentences)
     selector        — CSS selector or function returning Element; null = no target
     position        — 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center'
                      | 'top-left' | 'top-right' | 'page-top-left'
     highlight       — 'box' (default) | 'none'
     highlightPadding— extra px around target rect
     dimCanvasOnly   — dim the canvas itself (so highlighted nodes pop) instead
                       of the full-screen backdrop
     noDim           — suppress all backdrop/canvas dimming (canvas stays bright)
     video           — optional MP4 URL (images/videos/...)
     videoInline     — render the video small/zoomed inside the tooltip body
     videoZoom       — inline-video CSS zoom factor
     actionTrigger   — name passed to notifyAction() that advances this step
                       (omit/null = step advances on "Next" button click)
     actionGuard     — optional function(ctx) returning truthy when payload matches
     onBeforeShow    — optional pre-show hook (e.g. open a panel, switch a tab)
     onAfterHide     — optional teardown hook (undo temporary DOM tweaks)

   Action steps show no advance button (they advance on the user's action);
   the user can leave the tour any time via the × in the tooltip corner.
   ============================================================ */
(function (global) {
  'use strict';

  // Edit-page-only helpers; guarded so hub/view pages don't blow up.
  const H = () => global.TutorialHooks || null;

  const STEPS = [
    // ───── Phase 1: hub (start-new-graph modal) ─────
    {
      id: 1,
      phase: 'hub',
      title: 'Preview the Tutorial Graph',
      text:
        "Preview this starter graph to see what's possible.",
      onBeforeShow: () => {
        try {
          const openFn = window.openNewGraphModal_ || null;
          if (typeof openFn === 'function') {
            openFn();
          } else {
            const modal = document.getElementById('newGraphModal');
            if (modal && modal.hidden) {
              modal.hidden = false;
              document.body.style.overflow = 'hidden';
            }
          }
          // Force the card's hover overlay open so the Preview button (the
          // highlight target) is actually visible.
          const card = document.querySelector('.ng-card[data-graph-slug="onboarding-starter"]');
          if (card) card.classList.add('tt-force-overlay');
        } catch (_) {}
      },
      onAfterHide: () => {
        try {
          document.querySelectorAll('.ng-card.tt-force-overlay')
            .forEach(c => c.classList.remove('tt-force-overlay'));
        } catch (_) {}
      },
      // Highlight the Preview button itself (pulses, since this is an action step).
      selector: () =>
        document.querySelector('.ng-card[data-graph-slug="onboarding-starter"] [data-ng-action="preview"]') ||
        document.querySelector('.ng-card[data-graph-slug="onboarding-starter"]'),
      position: 'left',
      highlightPadding: 6,
      actionTrigger: 'preview-clicked',
      actionGuard: (ctx) => ctx && ctx.slug === 'onboarding-starter',
    },

    // ───── Phase 2: view-mode ─────
    {
      id: 2,
      phase: 'view',
      title: 'Fork to make it yours',
      text:
        "Fork to create your own editable copy.",
      selector: '#forkBtn',
      position: 'right',
      highlightPadding: 6,
      video: 'images/videos/fork%20(zoomed).mp4',
      videoZoom: 2,
      // Advance the moment Fork is clicked (the fork + redirect happen next).
      actionTrigger: 'fork-clicked',
    },

    // ───── Phase 3: editing-mode canvas ─────
    {
      id: 3,
      phase: 'edit',
      title: 'Welcome to the canvas',
      text:
        "Pan by dragging, zoom with scroll. Let's build and run this pipeline.",
      selector: '#canvasArea',
      position: 'center',
      highlight: 'none',
    },

    // ── Build: open the catalog, add a dataset, inspect it, chain it in ──
    {
      id: 4,
      phase: 'edit',
      title: 'Open the catalog',
      text:
        "Click Dataset to open the catalog.",
      selector: '#fpDataset',
      position: 'right',
      highlightPadding: 4,
      actionTrigger: 'drawer-opened',
      actionGuard: (ctx) => ctx && ctx.type === 'Dataset',
    },
    {
      id: 5,
      phase: 'edit',
      title: "Add the dataset",
      text:
        "Click Add on the Sample Dataset.",
      // Safety: make sure the Datasets tab is showing even if the drawer was
      // toggled. (No-op if it's already there.)
      onBeforeShow: () => { try { H() && H().openDatasetCatalog(); } catch (_) {} },
      selector: () =>
        document.querySelector('[data-tutorial-id="dataset"] .add-btn') ||
        document.getElementById('panelDiscover'),
      position: 'right',
      highlightPadding: 6,
      video: 'images/videos/add-node.mp4',
      videoInline: true,
      videoZoom: 2,
      actionTrigger: 'node-added',
      actionGuard: (ctx) => ctx && ctx.type === 'Dataset',
    },
    {
      id: 6,
      phase: 'edit',
      title: 'The Inspector',
      text:
        "The Inspector shows a node's config and run data. Click any node to reopen it.",
      // Collapse the catalog now that the dataset is placed. Don't dim the
      // canvas here, so the dataset the user just added stays bright.
      onBeforeShow: () => { try { H() && H().closeLeftDrawer(); } catch (_) {} },
      selector: () =>
        document.getElementById('inspectorShell') ||
        document.getElementById('drawerRight'),
      position: 'left',
      highlight: 'none',
      dimCanvasOnly: true,
    },
    {
      id: 7,
      phase: 'edit',
      title: 'Chain them up',
      text:
        "Drag from dataset output to transformer input.",
      onBeforeShow: () => {
        try {
          const h = H(); if (!h) return;
          h.collapseAllDrawers();
          const prime = () => {
            try { h.fitForWiring(); h.markWireNodes(); h.markWirePorts(); } catch (_) {}
          };
          prime();
          setTimeout(prime, 120);
          setTimeout(prime, 400);
        } catch (_) {}
      },
      onShow: () => {
        try { H() && H().fitForWiring(); } catch (_) {}
      },
      onAfterHide: () => {
        try { const h = H(); if (h) { h.clearWirePorts(); h.clearPathTargets(); } } catch (_) {}
      },
      // Tooltip tucked into the top-left corner so it never sits over the chain.
      selector: () => document.getElementById('canvasArea'),
      position: 'top-left',
      highlight: 'none',
      noDim: true,
      video: 'images/videos/connection%20(zoomed).mp4',
      videoInline: true,
      videoZoom: 2,
      actionTrigger: 'connection-added',
    },

    // ── Run an experiment: build a path, save it, run it ──
    {
      id: 8,
      phase: 'edit',
      title: "Let's run an experiment",
      text:
        "Click Path to trace a slice of the graph.",
      selector: '#fpPath',
      position: 'right',
      highlightPadding: 4,
      actionTrigger: 'path-mode-started',
    },
    {
      id: 9,
      phase: 'edit',
      title: 'Click along the path',
      text:
        "Click highlighted nodes left-to-right.",
      onBeforeShow: () => {
        try {
          global._tutorialPathStepActive = true;
          H() && H().collapseAllDrawers();
          H() && H().markPathTargets();
        } catch (_) {}
      },
      onAfterHide: () => {
        try { global._tutorialPathStepActive = false; H() && H().clearPathTargets(); } catch (_) {}
      },
      // Top-left corner keeps the tooltip clear of the mid-canvas nodes the
      // user has to click. The make-path video plays here, while they trace.
      selector: () => document.getElementById('canvasArea'),
      position: 'top-left',
      highlight: 'none',
      dimCanvasOnly: true,
      video: 'images/videos/make-path.mp4',
      videoInline: true,
      videoZoom: 2,
      actionTrigger: 'path-node-picked',
      actionGuard: (ctx) => ctx && ctx.count >= 3,
    },
    {
      id: 10,
      phase: 'edit',
      title: 'Save the path',
      text:
        "Click Save path.",
      selector: () => {
        const btns = Array.from(document.querySelectorAll('[data-pd-act="save"]'));
        return btns.find(b => b.getBoundingClientRect().width > 0) || btns[0] ||
          document.getElementById('pathsFloatPanel');
      },
      position: 'left',
      highlightPadding: 6,
      actionTrigger: 'path-saved',
    },
    {
      id: 11,
      phase: 'edit',
      title: 'Run it',
      text:
        "Click Run to execute the path.",
      selector: '#runBtn',
      position: 'bottom',
      highlightPadding: 4,
      actionTrigger: 'run-started',
    },

    // ── Runs panel: underway → summary → close ──
    {
      id: 12,
      phase: 'edit',
      title: 'Your run is underway',
      text:
        "Results appear here as the pipeline executes.",
      onBeforeShow: () => { try { H() && H().ensureRunsOpen(); } catch (_) {} },
      selector: () => document.getElementById('bottomPanel'),
      position: 'top',
      highlight: 'none',
      noDim: true,
      // Auto-advances to the summary when the run completes.
      actionTrigger: 'run-finished',
    },
    {
      id: 13,
      phase: 'edit',
      title: 'Run summary',
      text:
        "View your metrics and results.",
      // Spotlight the expanded drawer; tooltip sits at the page top-left.
      selector: () => document.getElementById('bottomPanel'),
      position: 'page-top-left',
      highlightPadding: 4,
    },
    {
      id: 14,
      phase: 'edit',
      title: 'Close the Runs panel',
      text:
        "Close with the × button.",
      selector: () => document.getElementById('bpClose'),
      position: 'left',
      highlightPadding: 6,
      actionTrigger: 'runs-panel-closed',
    },

    // ── Organize what you ran: group the three nodes, then collapse it ──
    {
      id: 15,
      phase: 'edit',
      title: 'Create a subgroup',
      text:
        'Click Subgroup to organize nodes.',
      selector: '#fpMarquee',
      position: 'right',
      highlightPadding: 4,
      actionTrigger: 'marquee-tool-selected',
    },
    {
      id: 16,
      phase: 'edit',
      title: 'Draw a subgroup',
      text:
        'Drag a box to select nodes, then confirm.',
      selector: () => document.getElementById('canvasArea'),
      position: 'top-left',
      highlight: 'none',
      noDim: true,
      video: 'images/videos/make-subgroup.mp4',
      videoInline: true,
      videoZoom: 2,
      actionTrigger: 'subgraph-created',
    },
    {
      id: 17,
      phase: 'edit',
      title: 'Tidy it away',
      text:
        "Subgroups collapse into a single block to keep your graph clean.",
      // Auto-collapses the group ~1s after it forms (smooth animation), then
      // advances the tour on its own — no click required.
      onBeforeShow: () => { try { H() && H().autoCollapseSubgroup(); } catch (_) {} },
      selector: () => document.getElementById('canvasArea'),
      position: 'top-left',
      highlight: 'none',
      noDim: true,
    },

    // ── Organize: variant, snapshot ──
    {
      id: 18,
      phase: 'edit',
      title: 'Make a variant',
      text:
        "Variants let you A/B test ideas. Click + to create one.",
      onBeforeShow: () => { try { H() && H().openVariantRow(); } catch (_) {} },
      selector: () => document.getElementById('variantAdd'),
      position: 'bottom',
      highlightPadding: 6,
      actionTrigger: 'variant-created',
    },
    {
      id: 19,
      phase: 'edit',
      title: 'Open version history',
      text:
        "Click History to save snapshots.",
      selector: () => document.getElementById('tbHistoryBtn'),
      position: 'bottom',
      highlightPadding: 6,
      actionTrigger: 'history-opened',
    },
    {
      id: 20,
      phase: 'edit',
      title: 'Save a snapshot',
      text:
        "Click Save snapshot.",
      selector: () => document.getElementById('historySave'),
      position: 'right',
      highlightPadding: 6,
      video: 'images/videos/version-history.mp4',
      videoInline: true,
      videoZoom: 2,
      actionTrigger: 'snapshot-saved',
    },

    // ── Power tip: find any node fast (⌘F / Ctrl+F) ──
    {
      id: 21,
      phase: 'edit',
      title: 'Find any node',
      text:
        "Press ⌘F (Ctrl+F) to search your graph by name.",
      selector: () => document.getElementById('canvasArea'),
      position: 'center',
      highlight: 'none',
      actionTrigger: 'find-opened',
    },
    {
      id: 22,
      phase: 'edit',
      title: 'Jump between matches',
      text:
        "Type a name, then press Enter to cycle through matches.",
      selector: () => document.getElementById('findBar'),
      position: 'bottom',
      highlightPadding: 6,
      // Close the find bar when leaving this step.
      onAfterHide: () => { try { H() && H().closeFindBar(); } catch (_) {} },
    },

    // ───── Phase 4: completion ─────
    {
      id: 23,
      phase: 'edit',
      title: "You're all set!",
      text:
        "You've completed the tour! Explore more when ready.",
      selector: null,
      position: 'center',
      highlight: 'none',
    },
  ];

  function forPage(page) {
    return STEPS.filter(s => s.phase === page);
  }

  global.ConnectifyTutorialSteps = {
    all: STEPS,
    forPage,
  };
})(window);

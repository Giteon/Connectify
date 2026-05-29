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
        "This is a small graph built for first-time users. Click its Preview button to see how a graph looks before you build your own.",
      onBeforeShow: () => {
        try {
          const modal = document.getElementById('newGraphModal');
          if (modal && modal.hidden) {
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
            const openFn = window.openNewGraphModal_ || null;
            if (typeof openFn === 'function') openFn();
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
        "View mode is read-only. Click Fork to create your own editable copy — we'll drop you straight onto the canvas.",
      selector: '#forkBtn',
      position: 'right',
      highlightPadding: 6,
      video: 'images/videos/fork-project.mp4',
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
        "This is your editing canvas. Nodes are connected by edges that carry data. Pan by dragging and zoom with scroll. Let's finish building this pipeline, then run it.",
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
        "This graph still needs an input. Click the Dataset tool in the palette to open the catalog drawer.",
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
        "Click Add on the Sample Dataset — it drops onto the canvas, tagged as your Start node, and its Inspector opens automatically.",
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
        "Adding a node opens its Inspector automatically — your home for a node's config, run data, and variables. Reopen it any time by clicking a node, or via the tab on the right edge.",
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
        "Drag from the new dataset's output anchor to the transformer model's input anchor to connect them, like this:",
      onBeforeShow: () => {
        try {
          const h = H(); if (!h) return;
          h.collapseAllDrawers();
          setTimeout(() => {
            try { h.fitForWiring(); h.markWireNodes(); h.markWirePorts(); } catch (_) {}
          }, 80);
        } catch (_) {}
      },
      onAfterHide: () => {
        try { const h = H(); if (h) { h.clearWirePorts(); h.clearPathTargets(); } } catch (_) {}
      },
      // Tooltip tucked into the top-left corner so it never sits over the two
      // centered nodes the user is wiring together.
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
        "Now make a path — the slice of the graph you want to run. Click the Path tool in the toolbar to start tracing.",
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
        "Click the highlighted node to add it to the path. Work left to right through all three nodes — the dataset first, then each one downstream.",
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
        "All three nodes are chained. Click Save path to keep this trace so you can run and re-run it as an experiment.",
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
        "Now click Run to execute your path. Watch the edges animate as data flows through the graph.",
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
        "The Runs panel peeks up from the bottom while your run progresses. When it finishes, it grows to full height automatically.",
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
        "Here's the output of your run — accuracy, F1, loss, and the per-class breakdown. Every run you kick off is saved with results like these.",
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
        "When you're done reviewing, close the panel with the × in its top-right corner to get your canvas back.",
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
        'Subgroups keep related nodes together. Click the Subgroup tool in the palette to start.',
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
        'Drag a box around all three nodes to select them, then confirm the subgroup — like this:',
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
      title: 'Collapse the subgroup',
      text:
        "Nice — that's your subgroup. Click the collapse toggle on its header to tuck the nodes away into a single tidy block.",
      selector: () => {
        const boxes = document.querySelectorAll('.subgraph-box');
        const box = boxes.length ? boxes[boxes.length - 1] : null;
        return box ? box.querySelector('.sg-toggle') : null;
      },
      position: 'right',
      highlightPadding: 6,
      noDim: true,
      actionTrigger: 'subgroup-collapsed',
    },

    // ── Organize: variant, snapshot ──
    {
      id: 18,
      phase: 'edit',
      title: 'Make a variant',
      text:
        "Variants are parallel copies of your graph for ablation studies — tweak one thing, run it, and compare. Open the variants row in the top bar if it's collapsed, then click + to spin up a fresh one.",
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
        "Version history lets you save and revert snapshots of your graph. Click History in the top bar to open it.",
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
        "Now click Save snapshot to capture this moment. You can always revert to it later.",
      selector: () => document.getElementById('historySave'),
      position: 'right',
      highlightPadding: 6,
      video: 'images/videos/version-history.mp4',
      videoInline: true,
      videoZoom: 2,
      actionTrigger: 'snapshot-saved',
    },

    // ───── Phase 4: completion ─────
    {
      id: 21,
      phase: 'edit',
      title: "You're all set!",
      text:
        "You've previewed, forked, built a pipeline, run an experiment, and organized it. Explore more node types, paths, and collaborators when you're ready.",
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

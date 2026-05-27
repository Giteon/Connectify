/* ============================================================
   tutorial-steps.js — Step definitions for the 14-step tour.
   Loaded after tutorial-system.js. Exposes:
     ConnectifyTutorialSteps.forPage('hub' | 'view' | 'edit')
   Each page passes its filtered slice into ConnectifyTutorial.init.

   Each step:
     id              — 1..14
     phase           — 'hub' | 'view' | 'edit'
     title           — short header
     text            — body copy (1–2 short sentences)
     selector        — CSS selector or function returning Element; null = no target
     position        — 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center'
     highlight       — 'box' (default) | 'none'
     highlightPadding— extra px around target rect
     video           — optional MP4 URL (tutorials/...)
     actionTrigger   — name passed to notifyAction() that advances this step
                       (omit/null = step advances on "Next" button click)
     actionGuard     — optional function(ctx) returning truthy when payload matches
     onBeforeShow    — optional pre-show hook (e.g. open modal, switch tab)
   ============================================================ */
(function (global) {
  'use strict';

  const STEPS = [
    // ───── Phase 1: hub (start-new-graph modal) ─────
    {
      id: 1,
      phase: 'hub',
      title: 'Preview the starter graph',
      text:
        "This is a small starter graph designed for first-time users. Click its Preview button to see how a graph looks before you build your own.",
      // Self-healing: if the New-Graph modal isn't open (e.g. user landed on
      // hub without ?new=1 and the tour is mid-restart), force it open so the
      // starter card can render before the tooltip tries to anchor to it.
      onBeforeShow: () => {
        try {
          const modal = document.getElementById('newGraphModal');
          if (modal && modal.hidden) {
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
            // Trigger the regular open path if available so the grid actually
            // renders (the modal element being un-hidden alone won't populate it).
            const openFn = window.openNewGraphModal_ || null;
            if (typeof openFn === 'function') openFn();
          }
        } catch (_) {}
      },
      selector: '.ng-card[data-graph-slug="onboarding-starter"]',
      position: 'left',
      highlightPadding: 6,
      video: 'tutorials/step-01-preview-example.mp4',
      actionTrigger: 'preview-clicked',
      actionGuard: (ctx) => ctx && ctx.slug === 'onboarding-starter',
    },

    // ───── Phase 2: view-mode ─────
    {
      id: 2,
      phase: 'view',
      title: 'Fork to make it yours',
      text:
        "This is read-only view mode — you can explore but not edit. Click the Fork button to create your own editable copy.",
      selector: '#forkBtn',
      position: 'right',
      highlightPadding: 6,
      video: 'tutorials/step-02-fork-button.mp4',
      actionTrigger: 'fork-clicked',
    },
    {
      id: 3,
      phase: 'view',
      title: 'Confirm the fork',
      text:
        "Confirm to create your own editable copy. The graph and its history will be cloned to your account.",
      selector: '#forkConfirmOk',
      position: 'top',
      highlightPadding: 6,
      video: 'tutorials/step-03-confirm-fork.mp4',
      actionTrigger: 'fork-confirmed',
    },

    // ───── Phase 3: editing-mode canvas tour ─────
    {
      id: 4,
      phase: 'edit',
      title: 'Welcome to the canvas',
      text:
        "This is your editing canvas. Nodes are connected by edges that carry data. Pan with mouse drag and zoom with scroll. You'll build on this graph next.",
      selector: '#canvasArea',
      position: 'center',
      highlight: 'none',
      video: 'tutorials/step-04-canvas-overview.mp4',
    },
    {
      // NEW: Topnav orientation. Briefly explains what lives across the top.
      id: 5,
      phase: 'edit',
      title: 'Top bar',
      text:
        "Up here: your project title and variant switcher on the left, the Run button + Runs/History/Role/Share on the right. Everything you need to drive an experiment.",
      selector: '.topbar',
      position: 'bottom',
      highlightPadding: 0,
      video: 'tutorials/step-05-topnav.mp4',
    },
    {
      id: 6,
      phase: 'edit',
      title: 'Inspector panel',
      text:
        "Click any node to open the Inspector on the right — it shows config, run data, and variables. The tab on the right edge reopens it after you close it.",
      selector: () =>
        document.querySelector('.inspector-edge-tab') ||
        document.getElementById('drawerRight') ||
        document.querySelector('.canvas-area'),
      position: 'left',
      highlightPadding: 6,
      video: 'tutorials/step-06-inspector-panel.mp4',
    },
    {
      id: 7,
      phase: 'edit',
      title: 'Canvas toolbar',
      text:
        "Select nodes, draw marquees, undo/redo, zoom, and auto-layout from this floating toolbar at the bottom of the canvas.",
      selector: '#canvasToolbar',
      position: 'top',
      highlightPadding: 6,
      video: 'tutorials/step-07-canvas-toolbar.mp4',
    },
    {
      id: 8,
      phase: 'edit',
      title: 'Paths panel',
      text:
        "Paths trace data flows through your graph — output → input chains you can run as targeted experiments. The panel docks to the top-right when you're tracing.",
      // Make sure the float panel is visible so we have something to anchor to.
      onBeforeShow: () => {
        try {
          const panel = document.getElementById('pathsFloatPanel');
          if (panel && panel.hidden) {
            panel.hidden = false;
            panel.dataset.ttToggled = '1';
          }
        } catch (_) {}
      },
      // Re-hide the panel when leaving this step (Next, Back, Skip, or close),
      // so we don't leave the host UI in a weird state if the user dismisses.
      onAfterHide: () => {
        try {
          const panel = document.getElementById('pathsFloatPanel');
          if (panel && panel.dataset.ttToggled === '1') {
            panel.hidden = true;
            delete panel.dataset.ttToggled;
          }
        } catch (_) {}
      },
      selector: () =>
        document.getElementById('pathsFloatPanel') ||
        document.querySelector('[data-side="right"][data-tab="paths"]') ||
        document.getElementById('canvasArea'),
      position: 'left',
      highlightPadding: 6,
      video: 'tutorials/step-08-paths-panel.mp4',
    },
    {
      // Moved: Left navigation is now the last orientation step before the
      // hands-on build phase begins.
      id: 9,
      phase: 'edit',
      title: 'Left navigation',
      text:
        "Browse community graphs, manage your projects, and explore your teams from this rail. Click the hamburger to expand it.",
      // Anchor to the inner content column instead of the whole `.leftnav`,
      // which has a wider hit-box than its visible chrome and would let the
      // highlight bleed past the right edge of the sidebar.
      selector: () =>
        document.querySelector('.leftnav .leftnav-top') ||
        document.querySelector('.leftnav'),
      position: 'right',
      highlightPadding: 2,
      video: 'tutorials/step-09-leftnav.mp4',
    },

    // ───── Phase 4: building actions ─────
    {
      id: 10,
      phase: 'edit',
      title: 'Add a Dataset node',
      text:
        "Now you'll build. Click the Dataset icon in the floating palette on the left to add a new Dataset node.",
      selector: '#fpDataset',
      position: 'right',
      highlightPadding: 4,
      video: 'tutorials/step-10-add-dataset.mp4',
      actionTrigger: 'node-added',
      actionGuard: (ctx) => ctx && ctx.type === 'Dataset',
    },
    {
      id: 11,
      phase: 'edit',
      title: 'Add a Model node',
      text:
        "Now add a Model node. Click the Model icon in the palette — models process data from datasets.",
      selector: '#fpModel',
      position: 'right',
      highlightPadding: 4,
      video: 'tutorials/step-11-add-model.mp4',
      actionTrigger: 'node-added',
      actionGuard: (ctx) => ctx && ctx.type === 'Model',
    },
    {
      id: 12,
      phase: 'edit',
      title: 'Connect the nodes',
      text:
        "Drag from the Dataset's output port (right side) to the Model's input port (left side) to create a connection.",
      // Anchor to the canvas toolbar so the tooltip sits at the bottom and
      // doesn't cover the nodes the user needs to drag between.
      selector: () =>
        document.getElementById('canvasToolbar') ||
        document.getElementById('canvasArea'),
      position: 'top',
      highlight: 'none',
      video: 'tutorials/step-12-connect-nodes.mp4',
      actionTrigger: 'connection-added',
    },
    {
      // Was step 13 in the original deck; the explicit "Create a path" step
      // was removed per simpler-onboarding feedback. The top-bar Run button
      // runs the whole connected graph, so the user can run without first
      // saving a path.
      id: 13,
      phase: 'edit',
      title: 'Run an experiment',
      text:
        "Click the Run button to execute the graph. Watch the bottom panel for results and the edges for animated run-flow.",
      selector: '#runBtn',
      position: 'bottom',
      highlightPadding: 4,
      video: 'tutorials/step-13-run-experiment.mp4',
      actionTrigger: 'run-started',
    },

    // ───── Phase 5: completion ─────
    {
      id: 14,
      phase: 'edit',
      title: "You're all set!",
      text:
        "You've learned the basics — preview, fork, build, connect, and run. Explore more node types, variants, paths, and collaborators when you're ready.",
      selector: null,
      position: 'center',
      highlight: 'none',
      video: null,
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

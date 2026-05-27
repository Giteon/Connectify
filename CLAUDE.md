# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**ConnectifyAI** is a visual graph editor for AI/ML workflows. Users create nodes (Dataset, Model, Logic, Custom), connect them with edges, and build computational pipelines. The app runs entirely in the browser with localStorage persistence. Four pages: `index.html` (landing page — served at the site root), `graphs-hub.html` (project browser), `editing-mode-new.html` (editor), `view-mode-new.html` (read-only). `landing-page.html` remains as a legacy redirect shim pointing back to the root.

## Getting Started

**Dev server:**
```bash
npx serve .
```
Navigate to http://localhost:8000/editing-mode-new.html

**File structure:**
- `editing-mode-new.html`, `editing-mode.js`, `editing-mode.css` — Main graph editor
- `canvas-new.js` — 2D rendering, pan/zoom, nodes/edges, type system (2KB LOC)
- `graphs-hub.html`, `graphs-hub.js` — Project browser and catalog
- `index.html`, `landing-page.js`, `landing-page.css` — Landing page served at the site root
- `landing-page.html` — Legacy redirect shim → `./`
- `view-mode-new.html`, `view-mode.js` — Read-only graph viewer
- `graphs/` — 30+ example graphs (catalog.json indexes them)
- `tools/` — Build scripts (bundled layouts, community graphs)
- `docs/` — Detailed architecture guides

## Architecture

### Layout
4-column CSS Grid: **Leftnav | Drawer-Left | Canvas | Drawer-Right**. Topbar and variant-strip span columns 2–4. V3 redesign: right drawer removed, Inspector is context-driven modal + right-edge tab, Paths is floating panel (top-right).

### Globals
Five mutable objects hold runtime state:
- **`ACTIVE_VID`** — Current variant ID (e.g., `'v1'`, `'v2'`)
- **`GRAPH`** — In-memory graph: `{ nodes, connections, subgraphs, canvasWidth, canvasHeight }`
- **`CLIPBOARD`** — Nodes copied for paste (cleared IDs to avoid collisions)
- **`PATH_DRAW`** — Path tracing mode state: `{ active, targetMode, targetPortId }`
- **`SELECTION`** — Set of selected node IDs (multi-select, marquee, subgraph ops)

### Data Model

**Node** (computational unit):
```js
{
  id: 'node_1704067200000',
  type: 'Dataset' | 'Model' | 'Logic' | 'Custom',
  label: 'CIFAR-10',           // Display name
  name: 'dataset_cifar10',      // Slug
  x: 100, y: 200,              // Canvas position
  inputs: [{ id: 'in_0', label: 'filter', type: 'string', optional: false }],
  outputs: [{ id: 'out_0', label: 'data', type: 'tensor', optional: false }],
  color: '#ff6b6b',
  config: { /* Key-value pairs; structure TBD until backend */ },
  user: { id, letter, color },
  collapsed: false,
  tags: [],
  notes: ''
}
```

**Connection** (edge with optional adaptor):
```js
{
  from: ['node_100', 'out_0', 'no-adaptor'],  // [nodeId, portId, adaptorId]
  to: ['node_200', 'in_0', 'no-adaptor'],
  adaptor: {  // Optional; inserted when types differ
    id: 'jpg-to-png',
    label: 'JPG→PNG',
    settings: { quality: 92, colorspace: 'sRGB', resample: 'lanczos3' }
  }
}
```

**Type System**: Semantic types (`'jpg'`, `'png'`, `'tensor'`, `'float'`, `'string'`, `'label'`, etc.). Two ports connect if types match or an adaptor exists. Adaptor map in `canvas-new.js` (~line 51).

**Subgraph** (visual group, collapsible):
```js
{
  id: 'sg_1704067200000',
  name: 'Data Preprocessing',
  collapsed: false,
  nodeIds: ['node_100', 'node_101'],
  showInternalPins: true  // Hide internal edges if false
}
```

**Variant** (ablation study copy):
```js
{
  id: 'v1',
  name: 'Baseline',
  baselineVariantId: 'v1',  // Optional
  hidden: false
}
```

### State Management

**Mutation pattern:**
1. Mutate in-memory: `GRAPH.nodes.push(newNode)` or modify properties
2. Push to history: `pushHistory('Add node')` snapshots state
3. Persist: History saved to `localStorage.graphs.{projectId}.history.{variantId}`
4. Notify canvas: `Canvas.drawEdges()` or `Canvas.renderNode(id)` update DOM

**localStorage schema:**
```
cfg.theme                          // 'light' | 'dark'
cfg.leftnav.expanded               // Boolean
cfg.variantsHidden                 // Hidden variant IDs (stringified Set)
graphs.{projectId}.title           // Project name
graphs.{projectId}.{variantId}     // Full GRAPH JSON
graphs.{projectId}.history.{variantId}  // Undo/redo snapshots (array)
```

**History & Undo/Redo** (~2800 lines in editing-mode.js):
- `pushHistory(label)` clones GRAPH and stores snapshot with label
- `popHistory()` / `redoHistory()` restore prior/next snapshots
- Max 50 snapshots per variant; older ones dropped
- Variant-scoped: each variant has independent history

**Switching variants** (`switchVariant(variantId)`):
1. Save current GRAPH to localStorage
2. Load target GRAPH from localStorage
3. Update ACTIVE_VID
4. Re-render with `Canvas.build(GRAPH)`

### Subsystems (editing-mode.js)

**Inspector** (~7415 lines):
- Config tab: Edit node properties, label, custom config
- Run Data tab: Show run results, diff against previous run, trace variables
- Triggered by `openInspectorV2(nodeData)`; dismissed by canvas click or Escape
- V3: Pops as context-driven modal; edge tab (6-8px sliver) on right canvas edge reopens it

**Paths** (~3900 lines):
- Trace subgraphs: output → input chains
- Float panel at top-right shows traced paths
- `renderPaths()` populates panel; click path chip to highlight
- Currently UI-only; backend integration pending

**Variants** (~2100 lines):
- Tabs at top switch between ablation copies
- Each variant has own GRAPH, history, Paths, Runs
- Hidden variants stored in localStorage.cfg.variantsHidden

**Toolbar**:
- Select, Path, Marquee, + Node buttons synced via MutationObserver (~5900 lines)
- Canvas toolbar primary; legacy tool palette fallback

## Common Patterns

**Confirm Dialog** (destructive actions):
```js
const ok = await confirmDialog({
  title: 'Delete node?',
  desc: 'This cannot be undone.',
  confirmLabel: 'Delete',
  tone: 'danger'  // Optional: 'danger' → red accent
});
```

**Adaptor Dialog** (incompatible port types):
```js
const result = await adaptorDialog({
  adaptor: { fromType: 'jpg', toType: 'png', label: 'JPG→PNG' },
  existingSummary: '<chip>existing</chip>'  // Optional
});
// 'accept' | 'configure' | 'cancel'
```

**Show Inspector**:
```js
openInspectorV2({ id, label, name, type, inputs, outputs });
```

**Show/Hide Paths Panel**:
```js
document.getElementById('pathsFloatPanel').hidden = false;
renderPaths();
```

**Graph Cloning** (always use for snapshots; shallow copies unsafe):
```js
function cloneGraph(g) {
  return {
    nodes: g.nodes.map(n => ({ ...n, inputs: n.inputs.map(p => ({...p})), outputs: n.outputs.map(p => ({...p})) })),
    connections: g.connections.map(c => Canvas.snapshotConnection(c)),
    subgraphs: g.subgraphs.map(sg => ({...sg, nodeIds: [...sg.nodeIds]})),
    canvasWidth: g.canvasWidth,
    canvasHeight: g.canvasHeight
  };
}
```

## UI Patterns

**Context-driven Inspector**: Opens only when needed (node click); closes on canvas click or Escape. Edge-tab reopen affordance on right canvas edge.

**Floating Paths Panel**: Fixed-position at top-right; appears when path-draw mode active. Banner on canvas offers to reopen when closed.

**Modal Dialogs**: Confirm dialog (destructive), Adaptor dialog (type bridge), Adaptor Details popover (parameters).

**Type Pills**: Semantic colors for port types (image=blue, float=purple, text=green).

**Multi-Select & Subgraphs**: Marquee tool draws selection rect; nodes inside added to SELECTION Set and get `.selected` class. Right-click subgroup → rename, collapse, toggle internal pins, delete.

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| Delete | Remove selected node(s) |
| Escape | Close inspector/dropdowns, deselect |
| Cmd+Z / Ctrl+Z | Undo |
| Cmd+Shift+Z / Ctrl+Shift+Z | Redo |
| Cmd+C / Ctrl+C | Copy selected nodes |
| Cmd+V / Ctrl+V | Paste at cursor |
| Cmd+A / Ctrl+A | Select all |

**Run Flow Visualization**: On run completion, edges carrying changed data get `.run-flow-active` (animated green) or `.run-flow-done` (solid green) classes.

## Debugging

| Problem | Steps |
|---------|-------|
| ACTIVE_VID out of sync | Check `localStorage.graphs.{projectId}.activeVariant` vs global `ACTIVE_VID` |
| Graph not rendering | Verify `GRAPH` has nodes, `Canvas.getCanvasInner()` exists |
| History lost | localStorage quota exceeded? Verify `graphs.{projectId}.history` key exists |
| Mutations not persisting | Confirm `pushHistory()` called after mutation; check localStorage quota |
| Inspector broken | Verify `openInspectorV2()` called with valid nodeData; check `_currentInspectorNode` |
| Paths missing | Check `.hidden` state of `#pathsFloatPanel`; verify `renderPaths()` called from `pathDrawStart()` |
| Toolbar broken | Verify MutationObserver wiring in `initCanvasToolbarBridge()` (~5900 lines) |

## Known Limits & Stubs

- **No backend**: Everything persists to localStorage only. Backend wiring is stub/placeholder.
- **Inspector drill-down**: UI-only; data structure TBD.
- **Comments**: Placeholder, not implemented.
- **Run results**: Stub data via `_stubRunsForVariant()`, `_stubVariablesForNode()`, `_stubConfigForNode()`.
- **Paths**: UI-only; backend integration pending.

## Function Redeclaration Pattern

Functions are redeclared at EOF to override (hoisting). Used for V3: `initV2Layout`, `pathDrawStart`, `syncPathDrawFloatOverlay`. Check EOF for overrides before assuming base implementation.

## File Sizes

- `editing-mode.js` — ~8KB (8055 lines) — Main editor engine
- `canvas-new.js` — ~2KB (2007 lines) — 2D rendering & type system
- `graphs-hub.js` — ~1.6KB (1584 lines) — Project browser
- `view-mode.js` — ~860 lines — Read-only viewer
- `landing-page.js` — ~425 lines — Landing page interactions (used by `index.html`)

## Development Workflow

1. **Edit** → HTML, CSS, JS files
2. **Reload** browser to see changes (or bump `?v=N` query param in script tags if JS won't reload)
3. **Test** graph mutations, variant switching, inspector/paths panels, undo/redo
4. **Persist** all graph changes via `pushHistory(label)` after mutations
5. **Save** to localStorage automatically via `pushHistory()`

Verify globals (`ACTIVE_VID`, `GRAPH`, `SELECTION`) stay in sync; check localStorage consistency when debugging.

# Connectify Documentation Structure

This document defines the documentation pages that link out from the Connectify landing page (`index.html`), specifically from the **"Powerful features for collaborative research"** and **"Built for your workflow"** sections.

---

## Information Architecture

```
/docs/
├── /features/                  ← Linked from "Powerful features" section
│   ├── build-and-connect
│   ├── path-tracing
│   ├── collaborate-live
│   ├── run-experiments
│   ├── discover-and-fork
│   └── extend-with-plugins
│
├── /workflows/                 ← Linked from "Built for your workflow" section
│   ├── ml-research-pipelines
│   ├── data-science-workflows
│   ├── fine-tuning-and-adaptation
│   └── cross-team-collaboration
│
└── /reference/                 ← Shared foundational pages (cross-linked)
    ├── node-types
    ├── type-system-and-adaptors
    ├── keyboard-shortcuts
    ├── glossary
    └── faq
```

---

## Feature Pages

These pages live at `/docs/features/*` and are linked from the six cards in the **"Powerful features for collaborative research"** section.

### 1. Build & Connect
- **Slug:** `/docs/features/build-and-connect`
- **Audience:** New users, first-time graph builders
- **Purpose:** Teach the core authoring loop — add nodes, wire them, validate types
- **Outline:**
  - Adding nodes to the canvas
  - Wiring ports (drag from output → input)
  - Type validation (what's compatible, what isn't)
  - Editing labels and config via the Inspector
  - Selecting, moving, and deleting nodes
  - Tidy up: auto-layout
- **Cross-links:** Node Types Reference, Type System & Adaptors, Keyboard Shortcuts

### 2. Path Tracing
- **Slug:** `/docs/features/path-tracing`
- **Audience:** Users debugging or analyzing graph flow
- **Purpose:** Explain how to trace data flow from output → input chains
- **Outline:**
  - What is a path?
  - Entering path-draw mode
  - Selecting source/target ports
  - Reading the Paths panel
  - Saving and naming paths
  - Common use cases (debugging, documentation, reviewing)
- **Cross-links:** Run Experiments, Node Types Reference

### 3. Collaborate Live
- **Slug:** `/docs/features/collaborate-live`
- **Audience:** Teams sharing or co-editing graphs
- **Purpose:** Show real-time collaboration, sharing, commenting
- **Outline:**
  - Sharing a graph (link, permissions)
  - Live cursors and presence
  - Commenting on nodes (status: placeholder)
  - Version history vs. collaborator history
  - Resolving conflicts
- **Cross-links:** Cross-team Collaboration workflow, Discover & Fork

### 4. Run Experiments
- **Slug:** `/docs/features/run-experiments`
- **Audience:** Researchers running ablations and comparing variants
- **Purpose:** Cover the variant + run + compare loop
- **Outline:**
  - Creating a variant (ablation copy)
  - Switching between variants
  - Hiding/showing variants
  - Running a graph
  - Reading Run Data (Inspector → Run Data tab)
  - Diffing runs and comparing outputs
  - Baseline variants
- **Cross-links:** Path Tracing, ML Research Pipelines workflow

### 5. Discover & Fork
- **Slug:** `/docs/features/discover-and-fork`
- **Audience:** Users seeking starting points or community examples
- **Purpose:** Browse public graphs, fork them, customize
- **Outline:**
  - Navigating the Community tab
  - Searching and filtering public graphs
  - Forking a graph (what gets copied)
  - Publishing your own graph
  - Attribution and licensing
- **Cross-links:** Collaborate Live, Build & Connect

### 6. Extend with Plugins
- **Slug:** `/docs/features/extend-with-plugins`
- **Audience:** Power users / engineers writing custom nodes
- **Purpose:** Document the custom node / plugin system
- **Outline:**
  - When to use a Custom node
  - Custom node anatomy (inputs, outputs, config)
  - Writing Python logic (stub — backend pending)
  - Declaring port types
  - Registering custom types in the type system
  - Publishing a plugin
- **Cross-links:** Node Types Reference, Type System & Adaptors

---

## Workflow Pages

These pages live at `/docs/workflows/*` and are linked from the four cards in the **"Built for your workflow"** section. They're tutorial-style, end-to-end examples.

### 1. ML Research Pipelines
- **Slug:** `/docs/workflows/ml-research-pipelines`
- **Audience:** ML researchers prototyping architectures
- **Purpose:** Walk through building a complete ML pipeline as a graph
- **Outline:**
  - Pipeline overview (data → augment → train → eval)
  - Step 1: Add a Dataset node (CIFAR-10 example)
  - Step 2: Add augmentation Logic nodes
  - Step 3: Connect a Model node
  - Step 4: Add evaluation outputs
  - Step 5: Run and compare variants
  - Example: ResNet vs. ViT ablation
- **Cross-links:** Run Experiments, Build & Connect, Fine-tuning workflow

### 2. Data Science Workflows
- **Slug:** `/docs/workflows/data-science-workflows`
- **Audience:** Data scientists building reproducible analyses
- **Purpose:** Show ingest → transform → analyze → visualize flow
- **Outline:**
  - Pipeline overview
  - Ingesting data (CSV, parquet, DB)
  - Transformation nodes (filter, join, aggregate)
  - Analysis nodes (stats, ML)
  - Visualization outputs
  - Sharing the final report
- **Cross-links:** Build & Connect, Collaborate Live

### 3. Fine-tuning & Adaptation
- **Slug:** `/docs/workflows/fine-tuning-and-adaptation`
- **Audience:** Engineers customizing foundation models
- **Purpose:** Manage datasets, ablations, and checkpoints in-graph
- **Outline:**
  - Loading a base model
  - Preparing fine-tuning data
  - Configuring training hyperparameters
  - Running multiple variants (LR sweep, LoRA rank sweep)
  - Comparing checkpoints
  - Exporting the best variant
- **Cross-links:** Run Experiments, ML Research Pipelines

### 4. Cross-team Collaboration
- **Slug:** `/docs/workflows/cross-team-collaboration`
- **Audience:** Teams coordinating across roles (research, eng, PM)
- **Purpose:** Best practices for shared graphs and handoffs
- **Outline:**
  - Setting up a shared workspace
  - Role-based permissions
  - Using comments for review
  - Version tags for milestones
  - Handoff patterns (research → eng)
  - Living documentation via View Mode
- **Cross-links:** Collaborate Live, Discover & Fork

---

## Reference Pages

Shared foundational pages cross-linked from every feature and workflow page.

### Node Types Reference
- **Slug:** `/docs/reference/node-types`
- **Sections:** Dataset, Model, Logic, Custom — each with I/O patterns, config schema, examples

### Type System & Adaptors
- **Slug:** `/docs/reference/type-system-and-adaptors`
- **Sections:** Semantic types (jpg, png, tensor, float, string, label), compatibility rules, adaptor catalog (JPG→PNG, etc.), writing custom adaptors

### Keyboard Shortcuts
- **Slug:** `/docs/reference/keyboard-shortcuts`
- **Sections:** Canvas navigation, selection, undo/redo, copy/paste, inspector toggle

### Glossary
- **Slug:** `/docs/reference/glossary`
- **Sections:** Graph, node, port, edge, adaptor, subgraph, variant, path, run

### FAQ
- **Slug:** `/docs/reference/faq`
- **Sections:** Storage limits, browser support, offline use, data export, common errors

---

## Cross-Linking Strategy

- **Every feature page** ends with "Related workflows" pointing to relevant workflow tutorials.
- **Every workflow page** opens with "Features used" pointing back to feature pages.
- **All pages** link to the relevant reference pages in a sidebar or inline as needed.
- **Glossary terms** auto-link wherever they appear (e.g., "variant" → glossary entry).

---

## Landing Page Link Updates

The current landing page (`index.html`) has placeholder `href="#"` on the use-case cards (lines 304, 309, 314, 319) and an `alert('Docs coming soon')` on the final CTA (line 333). Once pages exist, update:

| Landing element | Current href | New href |
|----------------|--------------|----------|
| Build & Connect card | (no link) | `/docs/features/build-and-connect` |
| Path Tracing card | (no link) | `/docs/features/path-tracing` |
| Collaborate Live card | (no link) | `/docs/features/collaborate-live` |
| Run Experiments card | (no link) | `/docs/features/run-experiments` |
| Discover & Fork card | (no link) | `/docs/features/discover-and-fork` |
| Extend with Plugins card | (no link) | `/docs/features/extend-with-plugins` |
| ML Research Pipelines card | `#` | `/docs/workflows/ml-research-pipelines` |
| Data Science Workflows card | `#` | `/docs/workflows/data-science-workflows` |
| Fine-tuning & Adaptation card | `#` | `/docs/workflows/fine-tuning-and-adaptation` |
| Cross-team Collaboration card | `#` | `/docs/workflows/cross-team-collaboration` |
| Footer "Documentation" link | `#` | `/docs/` (index) |
| Final CTA "View documentation" | `alert(...)` | `/docs/` (index) |

> **Note:** The feature cards in the "Powerful features" section currently have no `<a>` wrapping. They'll need to be made clickable (either by wrapping the `.lp-feature-card` div in an anchor or adding a "Learn more →" link consistent with the use-case cards).

---

## Build Order Recommendation

If building these out incrementally, prioritize:

1. **Reference pages first** (Node Types, Type System, Keyboard Shortcuts, Glossary) — they're prerequisites for everything else
2. **Build & Connect** — foundational feature page, highest traffic from new users
3. **ML Research Pipelines** workflow — flagship tutorial, demonstrates the full product
4. **Run Experiments** + **Path Tracing** — the differentiating features
5. **Remaining features and workflows** — fill out the rest
6. **FAQ** — grows organically as questions come in

---

## Open Questions

- Will docs live as static HTML pages in this repo (`/docs/*.html`), or as a separate docs site (e.g., Docusaurus, MkDocs)?
- Are docs versioned with the product, or evergreen?
- Should logged-in users see different docs than anonymous visitors (e.g., "Try this in your workspace" CTAs)?
- Who owns docs going forward — single author or community-editable?

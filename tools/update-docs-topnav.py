#!/usr/bin/env python3
"""
One-off: replace the simple `.doc-nav-links` block in every docs HTML page
with the shared dropdown topnav (.nav-dd) used on the landing page.

Also adds the nav-dropdown.css <link> and nav-dropdown.js <script>.

Idempotent: re-running is a no-op (the replacements look for the legacy block).

Run from project root:
    python3 tools/update-docs-topnav.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'

# ── New nav templates ────────────────────────────────────────
# `up` is the relative prefix from the file to the project root.
#   hub (docs/index.html)                → up = '../'
#   features/workflows/reference/*.html  → up = '../../'
# `docs_up` is the prefix from the file to docs/.
#   hub                  → docs_up = ''
#   subfolder/*.html     → docs_up = '../'

def build_nav(up: str, docs_up: str, active: str) -> str:
    def cls(name: str) -> str:
        return ' is-active' if name == active else ''

    return f'''<nav class="doc-nav-links" aria-label="Primary">
      <div class="nav-dd">
        <button type="button" class="nav-dd-trigger{cls('product')}" aria-haspopup="true" aria-expanded="false">
          Product <span class="nav-dd-caret" aria-hidden="true">▾</span>
        </button>
        <div class="nav-dd-menu nav-dd-menu--wide" role="menu">
          <div class="nav-dd-grid">
            <a class="nav-dd-item" role="menuitem" href="{docs_up}features/build-and-connect.html">
              <span class="nav-dd-item-title">Build &amp; Connect</span>
              <span class="nav-dd-item-desc">Drag, drop, and wire nodes together</span>
            </a>
            <a class="nav-dd-item" role="menuitem" href="{docs_up}features/path-tracing.html">
              <span class="nav-dd-item-title">Path Tracing</span>
              <span class="nav-dd-item-desc">Trace data flow output ↔ input</span>
            </a>
            <a class="nav-dd-item" role="menuitem" href="{docs_up}features/collaborate-live.html">
              <span class="nav-dd-item-title">Collaborate Live</span>
              <span class="nav-dd-item-desc">Real-time editing &amp; comments</span>
            </a>
            <a class="nav-dd-item" role="menuitem" href="{docs_up}features/run-experiments.html">
              <span class="nav-dd-item-title">Run Experiments</span>
              <span class="nav-dd-item-desc">Variants, runs, and compare</span>
            </a>
            <a class="nav-dd-item" role="menuitem" href="{docs_up}features/discover-and-fork.html">
              <span class="nav-dd-item-title">Discover &amp; Fork</span>
              <span class="nav-dd-item-desc">Browse and fork community graphs</span>
            </a>
            <a class="nav-dd-item" role="menuitem" href="{docs_up}features/extend-with-plugins.html">
              <span class="nav-dd-item-title">Extend with Plugins</span>
              <span class="nav-dd-item-desc">Custom nodes in Python</span>
            </a>
          </div>
          <div class="nav-dd-sep"></div>
          <a class="nav-dd-item nav-dd-item--footer" role="menuitem" href="{docs_up}index.html">All features &amp; docs →</a>
        </div>
      </div>

      <div class="nav-dd">
        <button type="button" class="nav-dd-trigger{cls('solutions')}" aria-haspopup="true" aria-expanded="false">
          Solutions <span class="nav-dd-caret" aria-hidden="true">▾</span>
        </button>
        <div class="nav-dd-menu" role="menu">
          <a class="nav-dd-item" role="menuitem" href="{docs_up}workflows/ml-research-pipelines.html">
            <span class="nav-dd-item-title">ML Research Pipelines</span>
            <span class="nav-dd-item-desc">Prototype architectures end-to-end</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}workflows/data-science-workflows.html">
            <span class="nav-dd-item-title">Data Science Workflows</span>
            <span class="nav-dd-item-desc">Ingest → analyze → share</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}workflows/fine-tuning-and-adaptation.html">
            <span class="nav-dd-item-title">Fine-tuning &amp; Adaptation</span>
            <span class="nav-dd-item-desc">Customize foundation models</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}workflows/cross-team-collaboration.html">
            <span class="nav-dd-item-title">Cross-team Collaboration</span>
            <span class="nav-dd-item-desc">Research ↔ engineering handoff</span>
          </a>
          <div class="nav-dd-sep"></div>
          <a class="nav-dd-item nav-dd-item--footer" role="menuitem" href="{up}index.html#use-cases">See all use cases →</a>
        </div>
      </div>

      <a class="doc-nav-link" href="{up}index.html#pricing">Pricing</a>

      <div class="nav-dd">
        <button type="button" class="nav-dd-trigger{cls('resources')}" aria-haspopup="true" aria-expanded="false">
          Resources <span class="nav-dd-caret" aria-hidden="true">▾</span>
        </button>
        <div class="nav-dd-menu" role="menu">
          <a class="nav-dd-item" role="menuitem" href="{docs_up}index.html">
            <span class="nav-dd-item-title">Documentation</span>
            <span class="nav-dd-item-desc">The hub — start here</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}reference/node-types.html">
            <span class="nav-dd-item-title">Node Types</span>
            <span class="nav-dd-item-desc">Dataset, Model, Logic, Custom</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}reference/type-system-and-adaptors.html">
            <span class="nav-dd-item-title">Type System</span>
            <span class="nav-dd-item-desc">Compatibility &amp; adaptors</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}reference/keyboard-shortcuts.html">
            <span class="nav-dd-item-title">Keyboard Shortcuts</span>
            <span class="nav-dd-item-desc">Cheatsheet</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}reference/glossary.html">
            <span class="nav-dd-item-title">Glossary</span>
            <span class="nav-dd-item-desc">Every term, defined</span>
          </a>
          <a class="nav-dd-item" role="menuitem" href="{docs_up}reference/faq.html">
            <span class="nav-dd-item-title">FAQ</span>
            <span class="nav-dd-item-desc">Common questions</span>
          </a>
          <div class="nav-dd-sep"></div>
          <a class="nav-dd-item nav-dd-item--footer" role="menuitem" href="{up}graphs-hub.html?tab=community">Community graphs →</a>
        </div>
      </div>
    </nav>'''


# Regex to match the legacy nav block (with or without aria-label attr).
NAV_RE = re.compile(
    r'<nav class="doc-nav-links"[^>]*>\s*'
    r'<a class="doc-nav-link"[^>]*>Product</a>\s*'
    r'<a class="doc-nav-link[^"]*"[^>]*>Docs</a>\s*'
    r'<a class="doc-nav-link"[^>]*>Community</a>\s*'
    r'</nav>',
    re.DOTALL,
)


def category_for(path: Path) -> str:
    """Map file path to active dropdown name."""
    parts = path.relative_to(DOCS).parts
    if parts[0] == 'features':
        return 'product'
    if parts[0] == 'workflows':
        return 'solutions'
    if parts[0] == 'reference':
        return 'resources'
    return 'none'  # hub


def update_file(path: Path) -> bool:
    text = path.read_text()
    original = text

    # Figure out depth: docs/index.html is depth 1; everything else is depth 2.
    is_hub = path == DOCS / 'index.html'
    up = '../' if is_hub else '../../'
    docs_up = '' if is_hub else '../'
    nav = build_nav(up=up, docs_up=docs_up, active=category_for(path))

    # 1. Swap the nav block
    new_text, n_swap = NAV_RE.subn(nav, text)
    if n_swap == 0:
        return False  # already updated, or unexpected structure

    # 2. Inject nav-dropdown.css link (idempotent)
    css_href = ('../' if is_hub else '../../') + 'nav-dropdown.css'
    css_link = f'<link rel="stylesheet" href="{css_href}" />'
    if css_link not in new_text:
        new_text = new_text.replace(
            '<link rel="stylesheet" href="docs.css" />' if is_hub
            else '<link rel="stylesheet" href="../docs.css" />',
            ('<link rel="stylesheet" href="docs.css" />\n  ' + css_link) if is_hub
            else ('<link rel="stylesheet" href="../docs.css" />\n  ' + css_link),
        )

    # 3. Inject nav-dropdown.js script (idempotent)
    js_src = ('../' if is_hub else '../../') + 'nav-dropdown.js'
    js_tag = f'<script src="{js_src}"></script>'
    if js_tag not in new_text:
        new_text = new_text.replace('</body>', f'  {js_tag}\n</body>')

    if new_text == original:
        return False
    path.write_text(new_text)
    return True


def main() -> int:
    targets = [DOCS / 'index.html']
    for sub in ('features', 'workflows', 'reference'):
        targets += sorted((DOCS / sub).glob('*.html'))

    updated = []
    skipped = []
    for t in targets:
        if not t.exists():
            print(f'! missing: {t}', file=sys.stderr)
            continue
        if update_file(t):
            updated.append(t.relative_to(ROOT))
        else:
            skipped.append(t.relative_to(ROOT))

    print(f'Updated {len(updated)} files:')
    for p in updated:
        print(f'  ✓ {p}')
    if skipped:
        print(f'\nSkipped {len(skipped)} files (already updated or no match):')
        for p in skipped:
            print(f'  - {p}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

/**
 * Pure reimplementation of editing-mode.js `autoLayoutNodes()` geometry
 * (after subgraphs are collapsed): block graph from nodes + subgraphs,
 * layer by longest-path on block DAG, column stack with ROW_GAP / COL_GAP.
 *
 * Uses fixed node card size matching the editor fallbacks (200×170).
 */

const NODE_W = 200;
const NODE_H = 170;
const ROW_GAP = 92;
const COL_GAP = 220;
const PAD_X = 32;
const PAD_Y = 36;

function subgraphBoundsCollapsed(group, byId) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of group.nodeIds || []) {
    const n = byId.get(id);
    if (!n) continue;
    const x = Number(n.x) || 0;
    const y = Number(n.y) || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
  }
  if (!Number.isFinite(minX)) return null;
  const left = Math.round(minX - PAD_X);
  const top = Math.round(minY - PAD_Y);
  const width = Math.round(maxX - minX + PAD_X * 2);
  const height = Math.round(maxY - minY + PAD_Y + PAD_Y);
  return { left, top, width, height };
}

/**
 * @param {{ nodes: object[], connections: object[], subgraphs?: object[] }} project
 * @returns {{ nodes: object[] }} shallow clone of nodes with updated x, y
 */
export function computeAutoLayoutPositions(project) {
  const nodes = (project.nodes || []).map((n) => ({
    ...n,
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
  }));
  const connections = project.connections || [];
  const subgraphs = project.subgraphs || [];

  if (nodes.length < 2) return { nodes };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeToGroup = new Map();
  subgraphs.forEach((g) => (g.nodeIds || []).forEach((id) => nodeToGroup.set(id, g.id)));

  const blocks = [];
  const blockById = new Map();
  const nodeToBlock = new Map();

  subgraphs.forEach((g) => {
    const ids = (g.nodeIds || []).filter((id) => byId.has(id));
    if (!ids.length) return;
    const b = subgraphBoundsCollapsed(g, byId);
    if (!b) return;
    const block = {
      id: `sg:${g.id}`,
      kind: 'subgraph',
      groupId: g.id,
      nodeIds: ids,
      x: b.left,
      y: b.top,
      width: b.width,
      height: b.height,
    };
    blocks.push(block);
    blockById.set(block.id, block);
    ids.forEach((id) => nodeToBlock.set(id, block.id));
  });

  nodes.forEach((n) => {
    if (nodeToGroup.has(n.id)) return;
    const block = {
      id: `n:${n.id}`,
      kind: 'node',
      nodeId: n.id,
      x: Number(n.x) || 0,
      y: Number(n.y) || 0,
      width: NODE_W,
      height: NODE_H,
    };
    blocks.push(block);
    blockById.set(block.id, block);
    nodeToBlock.set(n.id, block.id);
  });

  if (blocks.length < 2) return { nodes };

  const blockIds = blocks.map((b) => b.id);
  const succ = new Map(blockIds.map((id) => [id, []]));
  const pred = new Map(blockIds.map((id) => [id, []]));

  function addUnique(arr, v) {
    if (!arr.includes(v)) arr.push(v);
  }
  for (const c of connections) {
    const fromId = c?.from?.[0];
    const toId = c?.to?.[0];
    if (!fromId || !toId || fromId === toId) continue;
    const fromBlock = nodeToBlock.get(fromId);
    const toBlock = nodeToBlock.get(toId);
    if (!fromBlock || !toBlock || fromBlock === toBlock) continue;
    addUnique(succ.get(fromBlock), toBlock);
    addUnique(pred.get(toBlock), fromBlock);
  }

  const edges = [];
  succ.forEach((tos, fromBlock) => {
    tos.forEach((toBlock) => edges.push([fromBlock, toBlock]));
  });

  const orphanIds = blockIds.filter(
    (id) => (succ.get(id)?.length || 0) === 0 && (pred.get(id)?.length || 0) === 0,
  );
  const connectedIds = blockIds.filter((id) => !orphanIds.includes(id));
  const layer = new Map(connectedIds.map((id) => [id, 0]));
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
  layer.forEach((v) => {
    if (v < minLayer) minLayer = v;
  });
  if (layer.size && Number.isFinite(minLayer) && minLayer !== 0) {
    layer.forEach((v, id) => layer.set(id, v - minLayer));
  }

  const layers = new Map();
  connectedIds.forEach((id) => {
    const l = layer.get(id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l).push(id);
  });

  const minX = Math.min(...blocks.map((b) => Number(b.x) || 0));
  const avgY = blocks.reduce((sum, b) => sum + (Number(b.y) || 0), 0) / Math.max(1, blocks.length);
  const startX = Math.max(40, minX);
  const placedCenterY = new Map();
  const blockLayout = new Map();
  const blockHeight = (id) => blockById.get(id)?.height || NODE_H;
  const blockWidth = (id) => blockById.get(id)?.width || NODE_W;

  if (orphanIds.length) {
    const colIds = [...orphanIds].sort((a, b) => (blockById.get(a)?.y || 0) - (blockById.get(b)?.y || 0));
    const totalColH =
      colIds.reduce((sum, id) => sum + blockHeight(id), 0) + Math.max(0, colIds.length - 1) * ROW_GAP;
    let cursorY = Math.round(avgY - totalColH / 2);
    const x = startX;
    colIds.forEach((id) => {
      const h = blockHeight(id);
      const y = Math.round(cursorY);
      blockLayout.set(id, { x, y });
      placedCenterY.set(id, y + h / 2);
      cursorY += h + ROW_GAP;
    });
  }

  const layerKeys = Array.from(layers.keys()).sort((a, b) => a - b);
  const layerWidths = new Map(
    layerKeys.map((l) => [l, Math.max(...(layers.get(l) || []).map((id) => blockWidth(id)), 220)]),
  );
  let currentX = startX + (orphanIds.length ? Math.max(...orphanIds.map((id) => blockWidth(id)), 220) + COL_GAP : 0);
  const layerX = new Map();
  layerKeys.forEach((l) => {
    layerX.set(l, currentX);
    currentX += (layerWidths.get(l) || 220) + COL_GAP;
  });

  for (const l of layerKeys) {
    const colIds = layers.get(l) || [];
    colIds.sort((a, b) => {
      const score = (id) => {
        const ps = (pred.get(id) || []).filter((pid) => placedCenterY.has(pid));
        if (!ps.length) return (blockById.get(id)?.y || 0) + blockHeight(id) / 2;
        return ps.reduce((sum, pid) => sum + (placedCenterY.get(pid) || 0), 0) / ps.length;
      };
      return score(a) - score(b);
    });
    const totalColH =
      colIds.reduce((sum, id) => sum + blockHeight(id), 0) + Math.max(0, colIds.length - 1) * ROW_GAP;
    let cursorY = Math.round(avgY - totalColH / 2);
    const x = layerX.get(l) || startX;
    colIds.forEach((id) => {
      const h = blockHeight(id);
      const y = Math.round(cursorY);
      blockLayout.set(id, { x, y });
      placedCenterY.set(id, y + h / 2);
      cursorY += h + ROW_GAP;
    });
  }

  const layout = {};
  blocks.forEach((block) => {
    const target = blockLayout.get(block.id);
    if (!target) return;
    const dx = target.x - block.x;
    const dy = target.y - block.y;
    if (block.kind === 'node') {
      layout[block.nodeId] = { x: target.x, y: target.y };
      return;
    }
    (block.nodeIds || []).forEach((id) => {
      const n = byId.get(id);
      if (!n) return;
      layout[id] = {
        x: Math.round((Number(n.x) || 0) + dx),
        y: Math.round((Number(n.y) || 0) + dy),
      };
    });
  });

  const outNodes = nodes.map((n) => {
    const pos = layout[n.id];
    if (!pos) return { ...n };
    return { ...n, x: pos.x, y: pos.y };
  });

  return { nodes: outNodes };
}

/** Shift graph so top-left of node bbox is near (marginX, marginY); expand canvas. */
export function normalizeLayoutBBox(project, marginX = 80, marginY = 80, tailPad = 160) {
  const nodes = project.nodes || [];
  if (!nodes.length) return project;
  let minX = Infinity;
  let minY = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  for (const n of nodes) {
    const x = Number(n.x) || 0;
    const y = Number(n.y) || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxR = Math.max(maxR, x + NODE_W);
    maxB = Math.max(maxB, y + NODE_H);
  }
  const dx = marginX - minX;
  const dy = marginY - minY;
  const nextNodes = nodes.map((n) => ({
    ...n,
    x: Math.round((Number(n.x) || 0) + dx),
    y: Math.round((Number(n.y) || 0) + dy),
  }));
  let ar = -Infinity;
  let ab = -Infinity;
  for (const n of nextNodes) {
    const x = Number(n.x) || 0;
    const y = Number(n.y) || 0;
    ar = Math.max(ar, x + NODE_W);
    ab = Math.max(ab, y + NODE_H);
  }
  const minW = Number(project.canvasWidth) || 1200;
  const minH = Number(project.canvasHeight) || 720;
  const canvasWidth = Math.max(minW, Math.ceil(ar + tailPad));
  const canvasHeight = Math.max(minH, Math.ceil(ab + tailPad));
  return {
    ...project,
    nodes: nextNodes,
    canvasWidth,
    canvasHeight,
  };
}

export function layoutBundledProject(project) {
  const { nodes } = computeAutoLayoutPositions(project);
  return normalizeLayoutBBox({ ...project, nodes });
}

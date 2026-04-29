/**
 * One-time generator: writes graphs/<slug>/graph.json for the first 10
 * community demo projects. Run: node tools/generate-first-ten-demo-graphs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { layoutBundledProject } from './bundled-auto-layout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const COL = {
  b: 'var(--dot-blue)',
  g: 'var(--dot-green)',
  p: 'var(--dot-purple)',
  r: 'var(--dot-red)',
  y: 'var(--dot-yellow)',
};
const AV = ['var(--avatar-1)', 'var(--avatar-2)', 'var(--avatar-3)', 'var(--avatar-4)', 'var(--avatar-5)', 'var(--avatar-6)', 'var(--avatar-7)'];
function av(i) {
  return AV[i % AV.length];
}
function N(id, type, label, colorKey, letter, x, y, inputs, outputs) {
  const o = {
    id,
    type,
    label,
    color: COL[colorKey] || colorKey,
    user: { letter, color: av(letter.charCodeAt(0)) },
    x,
    y,
  };
  if (inputs && inputs.length) o.inputs = inputs;
  if (outputs && outputs.length) o.outputs = outputs;
  return o;
}
function E(a, ap, b, bp) {
  return { from: [a, 'out', ap], to: [b, 'in', bp] };
}

function writeGraph(spec) {
  const laid = layoutBundledProject(spec);
  const dir = path.join(ROOT, 'graphs', laid.slug);
  fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(laid);
  fs.writeFileSync(path.join(dir, 'graph.json'), json + '\n', 'utf8');
  // `file://` pages cannot reliably fetch sibling JSON; static-graph-loader
  // falls back to this script (same pattern as older bundled graphs).
  const dataJs =
    '// Bundled project — keep in sync with graph.json (file:// fallback).\n' +
    'window.PROJECT = ' +
    json +
    ';\n';
  fs.writeFileSync(path.join(dir, 'data.js'), dataJs, 'utf8');
  console.log('wrote', laid.slug, laid.nodes.length, 'nodes');
}

/* ── 1. Protein folding ─────────────────────────────── */
{
  const nodes = [
    N('pf-struct', 'Dataset', 'PDB structure corpus', 'b', 'D', 60, 80, null, [{ name: 'pdb_ids', type: 'string' }]),
    N('pf-msa', 'Model', 'MSA construction (HHblits)', 'g', 'A', 300, 60, [{ name: 'pdb_ids', type: 'string' }], [{ name: 'msa_a3m', type: 'string' }]),
    N('pf-embed', 'Model', 'Evoformer input embed', 'p', 'K', 540, 60, [{ name: 'msa_a3m', type: 'string' }], [{ name: 'pair_activ', type: 'float' }]),
    N('pf-trunk', 'Model', 'Structure module trunk', 'p', 'K', 780, 80, [{ name: 'pair_activ', type: 'float' }], [{ name: 'coords', type: 'float' }]),
    N('pf-lddt', 'Model', 'pLDDT confidence', 'y', 'R', 1020, 100, [{ name: 'coords', type: 'float' }], [{ name: 'plddt', type: 'float' }]),
    N('pf-openfold', 'Dataset', 'OpenFold weights bucket', 'b', 'D', 60, 260, null, [{ name: 'ckpt_uri', type: 'string' }]),
    N('pf-distill', 'Model', 'Knowledge distillation', 'g', 'A', 300, 280, [{ name: 'coords', type: 'float' }, { name: 'ckpt_uri', type: 'string' }], [{ name: 'student_coords', type: 'float' }]),
    N('pf-relax', 'Model', 'Amber relaxation', 'r', 'M', 540, 300, [{ name: 'student_coords', type: 'float' }], [{ name: 'relaxed_pdb', type: 'string' }]),
    N('pf-casp', 'Dataset', 'CASP14 target list', 'b', 'D', 60, 460, null, [{ name: 'targets', type: 'string' }]),
    N('pf-metrics', 'Logic', 'GDT-TS / TM-score', 'y', 'S', 780, 440, [{ name: 'relaxed_pdb', type: 'string' }, { name: 'targets', type: 'string' }], [{ name: 'score_json', type: 'string' }]),
    N('pf-deposit', 'Model', 'mmCIF deposit formatter', 'g', 'A', 1020, 400, [{ name: 'relaxed_pdb', type: 'string' }], [{ name: 'mmcif', type: 'string' }]),
    N('pf-trace', 'Model', 'Wet-lab traceability hash', 'g', 'K', 1260, 360, [{ name: 'mmcif', type: 'string' }], [{ name: 'trace_id', type: 'string' }]),
    N('pf-dash', 'Logic', 'Folding ops dashboard', 'p', 'R', 900, 560, [{ name: 'score_json', type: 'string' }, { name: 'trace_id', type: 'string' }], [{ name: 'dash_uri', type: 'string' }]),
    N('pf-cache', 'Dataset', 'Intermediate artifact store', 'b', 'D', 300, 500, null, [{ name: 'artifact_prefix', type: 'string' }]),
  ];
  const connections = [
    E('pf-struct', 'pdb_ids', 'pf-msa', 'pdb_ids'),
    E('pf-msa', 'msa_a3m', 'pf-embed', 'msa_a3m'),
    E('pf-embed', 'pair_activ', 'pf-trunk', 'pair_activ'),
    E('pf-trunk', 'coords', 'pf-lddt', 'coords'),
    E('pf-trunk', 'coords', 'pf-distill', 'coords'),
    E('pf-openfold', 'ckpt_uri', 'pf-distill', 'ckpt_uri'),
    E('pf-distill', 'student_coords', 'pf-relax', 'student_coords'),
    E('pf-relax', 'relaxed_pdb', 'pf-metrics', 'relaxed_pdb'),
    E('pf-casp', 'targets', 'pf-metrics', 'targets'),
    E('pf-relax', 'relaxed_pdb', 'pf-deposit', 'relaxed_pdb'),
    E('pf-deposit', 'mmcif', 'pf-trace', 'mmcif'),
    E('pf-metrics', 'score_json', 'pf-dash', 'score_json'),
    E('pf-trace', 'trace_id', 'pf-dash', 'trace_id'),
  ];
  writeGraph({
    slug: 'protein-folding-pipeline',
    title: 'Protein Folding Pipeline',
    org: 'DeepMind',
    tags: ['Bioinformatics', 'Structure Prediction'],
    contributorCount: 9,
    contributors: [
      { letter: 'D', bg: '#0f172a', name: 'DeepMind Research', role: 'Owner', pushes: 112 },
      { letter: 'A', bg: av(0), name: 'Aisha Okonkwo', role: 'Admin', pushes: 34 },
      { letter: 'K', bg: av(2), name: 'Kenji Watanabe', role: 'Admin', pushes: 28 },
      { letter: 'R', bg: av(4), name: 'R. Sutton (UCL collab)', role: 'Contributor', pushes: 9 },
    ],
    othersCount: 5,
    othersPreview: 'Helix Bio, OpenFold team…',
    others: [{ letter: 'H', bg: av(1), name: 'Helix Bioinformatics' }, { letter: 'O', bg: av(3), name: 'OpenFold Consortium' }],
    description:
      'Production-style AlphaFold-class stack: MSA through structure module, distillation against OpenFold checkpoints, Amber relax, CASP-style scoring, and signed mmCIF deposits with wet-lab trace hooks.',
    canvasWidth: 1500,
    canvasHeight: 720,
    viewZoom: 0.62,
    initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'Fast distill' }],
    demoPaths: {
      v1: [
        { id: 'p_pf_eval', name: 'Fold → score', nodeIds: ['pf-trunk', 'pf-lddt', 'pf-metrics'] },
        { id: 'p_pf_ship', name: 'Relax → deposit', nodeIds: ['pf-relax', 'pf-deposit', 'pf-trace'] },
      ],
      v2: [{ id: 'p_pf_fast', name: 'MSA → trunk', nodeIds: ['pf-msa', 'pf-embed', 'pf-trunk'] }],
    },
    demoRunCountByVariant: { v1: 2, v2: 1 },
    nodes,
    connections,
    subgraphs: [
      { id: 'sg_pf_core', name: 'Evoformer core', collapsed: true, nodeIds: ['pf-msa', 'pf-embed', 'pf-trunk', 'pf-lddt'], showInternalPins: true },
      { id: 'sg_pf_ship', name: 'Release train', collapsed: true, nodeIds: ['pf-deposit', 'pf-trace', 'pf-dash'], showInternalPins: true },
    ],
  });
}

/* ── 2. Climate storms ─────────────────────────────── */
{
  const nodes = [
    N('cl-sat', 'Dataset', 'GOES imager tiles', 'b', 'N', 80, 100, null, [{ name: 'rgb_stack', type: 'image' }]),
    N('cl-rean', 'Dataset', 'ERA5 reanalysis slice', 'b', 'N', 80, 260, null, [{ name: 'era5_z', type: 'float' }]),
    N('cl-unet', 'Model', 'ConvNeXt storm encoder', 'g', 'N', 340, 120, [{ name: 'rgb_stack', type: 'image' }], [{ name: 'embed', type: 'float' }]),
    N('cl-fuse', 'Logic', 'Late fusion (sat + ERA5)', 'y', 'C', 580, 180, [{ name: 'embed', type: 'float' }, { name: 'era5_z', type: 'float' }], [{ name: 'fused', type: 'float' }]),
    N('cl-detr', 'Model', 'Temporal storm DETR head', 'p', 'C', 820, 140, [{ name: 'fused', type: 'float' }], [{ name: 'tracks', type: 'string' }]),
    N('cl-gpu', 'Model', 'Ensemble blender', 'r', 'L', 1060, 160, [{ name: 'tracks', type: 'string' }], [{ name: 'prob_grid', type: 'float' }]),
    N('cl-loss', 'Dataset', 'NHC best-track labels', 'b', 'N', 80, 420, null, [{ name: 'labels', type: 'string' }]),
    N('cl-train', 'Model', 'Sequence trainer', 'g', 'L', 380, 420, [{ name: 'prob_grid', type: 'float' }, { name: 'labels', type: 'string' }], [{ name: 'checkpoint', type: 'string' }]),
    N('cl-serve', 'Model', '72h forecast service', 'g', 'C', 680, 420, [{ name: 'checkpoint', type: 'string' }, { name: 'fused', type: 'float' }], [{ name: 'forecast_gpkg', type: 'string' }]),
    N('cl-guard', 'Logic', 'Impact threshold alerts', 'y', 'N', 980, 400, [{ name: 'forecast_gpkg', type: 'string' }], [{ name: 'alerts', type: 'string' }]),
    N('cl-soc', 'Dataset', 'FEMA shelter capacity', 'b', 'L', 340, 560, null, [{ name: 'shelters', type: 'string' }]),
    N('cl-routing', 'Model', 'Evac route stress test', 'p', 'C', 640, 560, [{ name: 'alerts', type: 'string' }, { name: 'shelters', type: 'string' }], [{ name: 'routes', type: 'string' }]),
  ];
  const connections = [
    E('cl-sat', 'rgb_stack', 'cl-unet', 'rgb_stack'),
    E('cl-unet', 'embed', 'cl-fuse', 'embed'),
    E('cl-rean', 'era5_z', 'cl-fuse', 'era5_z'),
    E('cl-fuse', 'fused', 'cl-detr', 'fused'),
    E('cl-detr', 'tracks', 'cl-gpu', 'tracks'),
    E('cl-gpu', 'prob_grid', 'cl-train', 'prob_grid'),
    E('cl-loss', 'labels', 'cl-train', 'labels'),
    E('cl-train', 'checkpoint', 'cl-serve', 'checkpoint'),
    E('cl-fuse', 'fused', 'cl-serve', 'fused'),
    E('cl-serve', 'forecast_gpkg', 'cl-guard', 'forecast_gpkg'),
    E('cl-guard', 'alerts', 'cl-routing', 'alerts'),
    E('cl-soc', 'shelters', 'cl-routing', 'shelters'),
  ];
  writeGraph({
    slug: 'climate-storm-forecasting',
    title: 'Climate Storm Forecasting',
    org: 'NOAA',
    tags: ['Climate', 'Forecasting'],
    contributorCount: 8,
    contributors: [
      { letter: 'N', bg: '#0f172a', name: 'NOAA — OAR', role: 'Owner', pushes: 67 },
      { letter: 'C', bg: av(2), name: 'CloudBurst Analytics', role: 'Admin', pushes: 21 },
      { letter: 'L', bg: av(5), name: 'Leah Forsyth', role: 'Contributor', pushes: 11 },
    ],
    othersCount: 5,
    othersPreview: 'NASA IMPACT, state EM offices…',
    others: [{ letter: 'I', bg: av(3), name: 'NASA IMPACT' }],
    description: 'Fused satellite + reanalysis storm encoders, ensemble tracks, NOAA best-track training, 72h geopackage outputs, FEMA-aware routing stress tests.',
    canvasWidth: 1280,
    canvasHeight: 720,
    viewZoom: 0.64,
    initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'Gulf bias' }, { id: 'v3', name: 'West coast' }],
    demoPaths: { v1: [{ id: 'p_cl_fore', name: 'Fuse → serve', nodeIds: ['cl-fuse', 'cl-detr', 'cl-serve'] }] },
    demoRunCountByVariant: { v1: 3, v2: 1, v3: 0 },
    nodes,
    connections,
    subgraphs: [{ id: 'sg_cl_model', name: 'Encoder + fusion', collapsed: true, nodeIds: ['cl-unet', 'cl-fuse', 'cl-detr'], showInternalPins: true }],
  });
}

/* Remaining graphs: compact inline specs */
const MORE = [
  {
    slug: 'cancer-cell-classification',
    title: 'Cancer Cell Classification',
    org: 'Memorial Sloan Kettering',
    tags: ['Oncology', 'Image Classification'],
    description: 'Histology tile QC, H&E stain norm, immune-infiltration encoder, tumor-in-tile classifier, TME report for trial stratification.',
    canvasWidth: 1400,
    canvasHeight: 760,
    viewZoom: 0.6,
    initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'High-grade focus' }],
    demoPaths: { v1: [{ id: 'p_cc_main', name: 'Tile → report', nodeIds: ['cc-norm', 'cc-enc', 'cc-cls'] }] },
    demoRunCountByVariant: { v1: 2, v2: 2 },
    contributorCount: 10,
    contributors: [
      { letter: 'M', bg: '#0f172a', name: 'MSK Pathology AI', role: 'Owner', pushes: 44 },
      { letter: 'S', bg: av(1), name: 'Sarah Delgado', role: 'Admin', pushes: 15 },
      { letter: 'V', bg: av(4), name: 'Virtanen Labs (FMI)', role: 'Contributor', pushes: 8 },
    ],
    othersCount: 7,
    othersPreview: 'PathCore Inc., Dana-Farber…',
    others: [{ letter: 'P', bg: av(2), name: 'PathCore Inc.' }],
    build: () => {
      const nodes = [
        N('cc-slide', 'Dataset', 'WSI ingest (TiF)', 'b', 'M', 60, 100, null, [{ name: 'tiles', type: 'image' }]),
        N('cc-norm', 'Model', 'Macenko stain norm', 'g', 'S', 280, 100, [{ name: 'tiles', type: 'image' }], [{ name: 'norm_tiles', type: 'image' }]),
        N('cc-qc', 'Logic', 'Blur / fold detector', 'y', 'M', 500, 120, [{ name: 'norm_tiles', type: 'image' }], [{ name: 'qc_mask', type: 'image' }]),
        N('cc-enc', 'Model', 'UNI histology encoder', 'p', 'S', 720, 100, [{ name: 'norm_tiles', type: 'image' }], [{ name: 'emb', type: 'float' }]),
        N('cc-cls', 'Model', 'MIL tumor classifier', 'r', 'V', 960, 120, [{ name: 'emb', type: 'float' }], [{ name: 'risk', type: 'float' }]),
        N('cc-ihc', 'Dataset', 'CD8 IHC cohort', 'b', 'V', 60, 300, null, [{ name: 'ihc_tiles', type: 'image' }]),
        N('cc-fuse', 'Logic', 'H&E + IHC fusion', 'y', 'S', 320, 320, [{ name: 'emb', type: 'float' }, { name: 'ihc_tiles', type: 'image' }], [{ name: 'joint', type: 'float' }]),
        N('cc-tme', 'Model', 'TME scorecard', 'g', 'M', 580, 300, [{ name: 'joint', type: 'float' }], [{ name: 'tme_json', type: 'string' }]),
        N('cc-trial', 'Dataset', 'Trial arm eligibility', 'b', 'M', 60, 480, null, [{ name: 'arms', type: 'string' }]),
        N('cc-match', 'Model', 'Stratification matcher', 'p', 'S', 320, 480, [{ name: 'tme_json', type: 'string' }, { name: 'arms', type: 'string' }], [{ name: 'arm_rec', type: 'string' }]),
        N('cc-report', 'Model', 'Pathologist PDF brief', 'g', 'V', 600, 500, [{ name: 'arm_rec', type: 'string' }, { name: 'qc_mask', type: 'image' }], [{ name: 'pdf_uri', type: 'string' }]),
        N('cc-audit', 'Logic', 'IRB audit hash', 'y', 'M', 880, 480, [{ name: 'pdf_uri', type: 'string' }], [{ name: 'audit_id', type: 'string' }]),
        N('cc-store', 'Dataset', 'Quilt feature store', 'b', 'S', 320, 620, null, [{ name: 'emb_uri', type: 'string' }]),
        N('cc-sync', 'Model', 'Feature publish hook', 'g', 'S', 580, 600, [{ name: 'emb', type: 'float' }], [{ name: 'emb_uri', type: 'string' }]),
      ];
      const connections = [
        E('cc-slide', 'tiles', 'cc-norm', 'tiles'),
        E('cc-norm', 'norm_tiles', 'cc-qc', 'norm_tiles'),
        E('cc-norm', 'norm_tiles', 'cc-enc', 'norm_tiles'),
        E('cc-enc', 'emb', 'cc-cls', 'emb'),
        E('cc-enc', 'emb', 'cc-fuse', 'emb'),
        E('cc-ihc', 'ihc_tiles', 'cc-fuse', 'ihc_tiles'),
        E('cc-fuse', 'joint', 'cc-tme', 'joint'),
        E('cc-tme', 'tme_json', 'cc-match', 'tme_json'),
        E('cc-trial', 'arms', 'cc-match', 'arms'),
        E('cc-match', 'arm_rec', 'cc-report', 'arm_rec'),
        E('cc-qc', 'qc_mask', 'cc-report', 'qc_mask'),
        E('cc-report', 'pdf_uri', 'cc-audit', 'pdf_uri'),
        E('cc-enc', 'emb', 'cc-sync', 'emb'),
      ];
      const subgraphs = [
        { id: 'sg_cc_vision', name: 'Vision stack', collapsed: true, nodeIds: ['cc-norm', 'cc-qc', 'cc-enc', 'cc-cls'], showInternalPins: true },
        { id: 'sg_cc_clin', name: 'Clinical bridge', collapsed: true, nodeIds: ['cc-tme', 'cc-match', 'cc-report'], showInternalPins: true },
      ];
      return { nodes, connections, subgraphs };
    },
  },
  {
    slug: 'drug-target-interaction',
    title: 'Drug-Target Interaction',
    org: 'Recursion Pharmaceuticals',
    tags: ['Drug Discovery', 'Network Analysis'],
    description: 'Phenotypic profiles, AlphaFold-derived pockets, graph attention DTI, medicinal-chemistry filters, and candidate shortlist for assay plates.',
    canvasWidth: 1360,
    canvasHeight: 720,
    viewZoom: 0.6,
    initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'CNS panel' }, { id: 'v3', name: 'Kinase-only' }],
    demoPaths: { v1: [{ id: 'p_dt_graph', name: 'Profile → DTI', nodeIds: ['dt-emb', 'dt-gat', 'dt-score'] }] },
    demoRunCountByVariant: { v1: 2, v2: 1, v3: 1 },
    contributorCount: 7,
    contributors: [
      { letter: 'R', bg: '#0f172a', name: 'Recursion Platforms', role: 'Owner', pushes: 58 },
      { letter: 'J', bg: av(2), name: 'J. Morales', role: 'Admin', pushes: 19 },
    ],
    othersCount: 5,
    othersPreview: 'ChemSpace EU, Oula Bio…',
    others: [{ letter: 'C', bg: av(4), name: 'ChemSpace EU' }],
    build: () => {
      const nodes = [
        N('dt-cell', 'Dataset', 'Cell painting profiles', 'b', 'R', 70, 90, null, [{ name: 'feat', type: 'float' }]),
        N('dt-seq', 'Dataset', 'ChemBL activity matrix', 'b', 'J', 70, 230, null, [{ name: 'ic50', type: 'float' }]),
        N('dt-af', 'Model', 'AF2 pocket cropper', 'g', 'R', 320, 100, [{ name: 'uniprot', type: 'string' }], [{ name: 'pocket', type: 'string' }]),
        N('dt-emb', 'Model', 'MolCLR + pocket concat', 'p', 'J', 560, 120, [{ name: 'feat', type: 'float' }, { name: 'pocket', type: 'string' }], [{ name: 'node_h', type: 'float' }]),
        N('dt-gat', 'Model', 'Hetero GAT DTI', 'p', 'R', 800, 140, [{ name: 'node_h', type: 'float' }, { name: 'ic50', type: 'float' }], [{ name: 'edge_w', type: 'float' }]),
        N('dt-score', 'Logic', 'Calibrated ranking', 'y', 'J', 1040, 160, [{ name: 'edge_w', type: 'float' }], [{ name: 'rank_csv', type: 'string' }]),
        N('dt-synth', 'Model', 'R-group feasibility', 'g', 'R', 320, 340, [{ name: 'rank_csv', type: 'string' }], [{ name: 'synth_ok', type: 'label' }]),
        N('dt-admet', 'Model', 'ADMET-AI screen', 'r', 'J', 560, 360, [{ name: 'rank_csv', type: 'string' }], [{ name: 'admet', type: 'string' }]),
        N('dt-prior', 'Dataset', 'EPA tox priors', 'b', 'R', 70, 400, null, [{ name: 'tox', type: 'string' }]),
        N('dt-gate', 'Logic', 'Safety latch', 'y', 'J', 800, 380, [{ name: 'admet', type: 'string' }, { name: 'tox', type: 'string' }], [{ name: 'safe_list', type: 'string' }]),
        N('dt-plates', 'Model', 'Echo pick lists', 'g', 'R', 1040, 400, [{ name: 'safe_list', type: 'string' }, { name: 'synth_ok', type: 'label' }], [{ name: 'picklst', type: 'string' }]),
        N('dt-lims', 'Dataset', 'LIMS handoff JSON', 'b', 'J', 800, 540, null, [{ name: 'lims_schema', type: 'string' }]),
        N('dt-job', 'Model', 'Assay scheduler', 'p', 'R', 1040, 540, [{ name: 'picklst', type: 'string' }, { name: 'lims_schema', type: 'string' }], [{ name: 'job_id', type: 'string' }]),
      ];
      const connections = [
        E('dt-cell', 'feat', 'dt-emb', 'feat'),
        E('dt-af', 'pocket', 'dt-emb', 'pocket'),
        E('dt-seq', 'ic50', 'dt-gat', 'ic50'),
        E('dt-emb', 'node_h', 'dt-gat', 'node_h'),
        E('dt-gat', 'edge_w', 'dt-score', 'edge_w'),
        E('dt-score', 'rank_csv', 'dt-synth', 'rank_csv'),
        E('dt-score', 'rank_csv', 'dt-admet', 'rank_csv'),
        E('dt-prior', 'tox', 'dt-gate', 'tox'),
        E('dt-admet', 'admet', 'dt-gate', 'admet'),
        E('dt-gate', 'safe_list', 'dt-plates', 'safe_list'),
        E('dt-synth', 'synth_ok', 'dt-plates', 'synth_ok'),
        E('dt-plates', 'picklst', 'dt-job', 'picklst'),
        E('dt-lims', 'lims_schema', 'dt-job', 'lims_schema'),
      ];
      return {
        nodes,
        connections,
        subgraphs: [{ id: 'sg_dt_gnn', name: 'DTI graph core', collapsed: true, nodeIds: ['dt-emb', 'dt-gat', 'dt-score'], showInternalPins: true }],
      };
    },
  },
  {
    slug: 'sentiment-in-clinical-notes',
    title: 'Sentiment in Clinical Notes',
    org: 'Mayo Clinic',
    tags: ['NLP', 'Text Classification'],
    description: 'De-ID through negation-aware clinical BERT, visit-level sentiment trend, and risk flags to CDS without storing raw text blobs.',
    canvasWidth: 1180,
    canvasHeight: 640,
    viewZoom: 0.64,
    initialVariants: [{ id: 'v1', name: 'Master' }],
    demoPaths: {},
    demoRunCountByVariant: { v1: 1 },
    contributorCount: 6,
    contributors: [
      { letter: 'M', bg: '#0f172a', name: 'Mayo — CDS Office', role: 'Owner', pushes: 33 },
      { letter: 'E', bg: av(3), name: 'Elena Vogel', role: 'Admin', pushes: 12 },
    ],
    othersCount: 4,
    othersPreview: 'Epic Haiku team…',
    others: [{ letter: 'H', bg: av(6), name: 'Haiku NLP guild' }],
    build: () => {
      const nodes = [
        N('sn-fhir', 'Dataset', 'FHIR DocumentReference', 'b', 'M', 80, 120, null, [{ name: 'note_id', type: 'string' }]),
        N('sn-deid', 'Model', 'Philter de-ID', 'g', 'E', 320, 120, [{ name: 'note_id', type: 'string' }], [{ name: 'redacted', type: 'text' }]),
        N('sn-bert', 'Model', 'Clinical Longformer', 'p', 'M', 560, 120, [{ name: 'redacted', type: 'text' }], [{ name: 'cls', type: 'float' }]),
        N('sn-neg', 'Logic', 'NegSpec resolver', 'y', 'E', 800, 140, [{ name: 'cls', type: 'float' }, { name: 'redacted', type: 'text' }], [{ name: 'polarity', type: 'label' }]),
        N('sn-trend', 'Model', 'Visit rolling sentiment', 'g', 'M', 1040, 160, [{ name: 'polarity', type: 'label' }], [{ name: 'series', type: 'float' }]),
        N('sn-risk', 'Model', 'PHQ-9 risk bridge', 'r', 'E', 560, 320, [{ name: 'series', type: 'float' }], [{ name: 'risk_band', type: 'label' }]),
        N('sn-fhirw', 'Model', 'FHIR RiskAssessment write', 'g', 'M', 800, 340, [{ name: 'risk_band', type: 'label' }], [{ name: 'fhir_ref', type: 'string' }]),
        N('sn-cds', 'Logic', 'CDS hook (SMART)', 'y', 'E', 1040, 340, [{ name: 'fhir_ref', type: 'string' }], [{ name: 'banner', type: 'string' }]),
        N('sn-audit', 'Dataset', 'Break-glass log store', 'b', 'M', 320, 480, null, [{ name: 'audit_cfg', type: 'string' }]),
        N('sn-seal', 'Model', 'Dual-control signer', 'p', 'E', 600, 480, [{ name: 'banner', type: 'string' }, { name: 'audit_cfg', type: 'string' }], [{ name: 'seal_id', type: 'string' }]),
        N('sn-export', 'Model', 'IR notebook export', 'g', 'M', 860, 500, [{ name: 'series', type: 'float' }], [{ name: 'nb_uri', type: 'string' }]),
      ];
      const connections = [
        E('sn-fhir', 'note_id', 'sn-deid', 'note_id'),
        E('sn-deid', 'redacted', 'sn-bert', 'redacted'),
        E('sn-bert', 'cls', 'sn-neg', 'cls'),
        E('sn-deid', 'redacted', 'sn-neg', 'redacted'),
        E('sn-neg', 'polarity', 'sn-trend', 'polarity'),
        E('sn-trend', 'series', 'sn-risk', 'series'),
        E('sn-risk', 'risk_band', 'sn-fhirw', 'risk_band'),
        E('sn-fhirw', 'fhir_ref', 'sn-cds', 'fhir_ref'),
        E('sn-audit', 'audit_cfg', 'sn-seal', 'audit_cfg'),
        E('sn-cds', 'banner', 'sn-seal', 'banner'),
        E('sn-trend', 'series', 'sn-export', 'series'),
      ];
      return { nodes, connections, subgraphs: [] };
    },
  },
  {
    slug: 'eeg-seizure-detection',
    title: 'EEG Seizure Detection',
    org: 'Stanford Medicine',
    tags: ['Neuroscience', 'Time Series'],
    description: 'Multi-center EEG ingest, band-pass + ICA, TCN seizure detector, HFO side-chain, and neurology alert bus with latency budgets.',
    canvasWidth: 1420,
    canvasHeight: 780,
    viewZoom: 0.58,
    initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'PICU hi-res' }],
    demoPaths: {
      v1: [{ id: 'p_eeg_det', name: 'TCN → alert', nodeIds: ['ee-pre', 'ee-tcn', 'ee-alrt'] }],
      v2: [{ id: 'p_eeg_hfo', name: 'ICA → HFO', nodeIds: ['ee-ica', 'ee-hfo', 'ee-fus'] }],
    },
    demoRunCountByVariant: { v1: 3, v2: 1 },
    contributorCount: 11,
    contributors: [
      { letter: 'S', bg: '#0f172a', name: 'Stanford Neuro IRB', role: 'Owner', pushes: 41 },
      { letter: 'N', bg: av(2), name: 'Natus Engineering', role: 'Admin', pushes: 17 },
 { letter: 'T', bg: av(5), name: 'Dr. Tessa Woo', role: 'Admin', pushes: 9 },
    ],
    othersCount: 8,
    othersPreview: 'UCSF Epilepsy, Xl EEG Cloud…',
    others: [{ letter: 'X', bg: av(4), name: 'Xl EEG Cloud' }],
    build: () => {
      const nodes = [
        N('ee-edf', 'Dataset', 'EDF+ bedside streams', 'b', 'S', 60, 100, null, [{ name: 'raw', type: 'float' }]),
        N('ee-pre', 'Model', '0.5–70 Hz + notch', 'g', 'N', 280, 100, [{ name: 'raw', type: 'float' }], [{ name: 'filt', type: 'float' }]),
        N('ee-ica', 'Model', 'FastICA ocular scrub', 'p', 'T', 520, 80, [{ name: 'filt', type: 'float' }], [{ name: 'clean', type: 'float' }]),
        N('ee-tcn', 'Model', 'TCN seizure prob', 'r', 'S', 760, 120, [{ name: 'clean', type: 'float' }], [{ name: 'p_seiz', type: 'float' }]),
        N('ee-hfo', 'Model', 'Ripple-band HFO detector', 'y', 'N', 520, 260, [{ name: 'clean', type: 'float' }], [{ name: 'hfo_ev', type: 'string' }]),
        N('ee-fus', 'Logic', 'Late fuse (TCN+HFO)', 'y', 'T', 1000, 180, [{ name: 'p_seiz', type: 'float' }, { name: 'hfo_ev', type: 'string' }], [{ name: 'alarm', type: 'label' }]),
        N('ee-lat', 'Model', 'Edge GPU latency guard', 'g', 'N', 1220, 200, [{ name: 'alarm', type: 'label' }], [{ name: 'lat_ms', type: 'float' }]),
        N('ee-alrt', 'Model', 'Pager + EMR banner', 'p', 'S', 1040, 340, [{ name: 'alarm', type: 'label' }], [{ name: 'page_id', type: 'string' }]),
        N('ee-audit', 'Dataset', 'Immutable read log', 'b', 'T', 280, 400, null, [{ name: 'policy', type: 'string' }]),
        N('ee-seal', 'Logic', 'Integrity MAC', 'g', 'S', 560, 400, [{ name: 'page_id', type: 'string' }, { name: 'policy', type: 'string' }], [{ name: 'mac', type: 'string' }]),
        N('ee-multi', 'Dataset', 'Multi-site manifest', 'b', 'N', 60, 520, null, [{ name: 'sites', type: 'string' }]),
        N('ee-cal', 'Model', 'Per-site calibration', 'g', 'T', 320, 520, [{ name: 'sites', type: 'string' }, { name: 'clean', type: 'float' }], [{ name: 'beta', type: 'float' }]),
        N('ee-meta', 'Model', 'Line noise prior map', 'p', 'S', 600, 540, [{ name: 'raw', type: 'float' }], [{ name: 'line_hz', type: 'float' }]),
        N('ee-stack', 'Logic', 'Stack healthboard', 'y', 'N', 880, 520, [{ name: 'lat_ms', type: 'float' }, { name: 'mac', type: 'string' }], [{ name: 'health', type: 'string' }]),
        N('ee-drill', 'Model', 'Replay trainer', 'g', 'T', 1120, 520, [{ name: 'alarm', type: 'label' }], [{ name: 'clip_uri', type: 'string' }]),
        N('ee-nob', 'Dataset', 'Natus OBCI export', 'b', 'N', 60, 640, null, [{ name: 'obci_bin', type: 'binary' }]),
        N('ee-bridge', 'Model', 'OBCI → EDF bridge', 'g', 'N', 320, 640, [{ name: 'obci_bin', type: 'binary' }], [{ name: 'edf_stub', type: 'string' }]),
      ];
      const connections = [
        E('ee-edf', 'raw', 'ee-pre', 'raw'),
        E('ee-pre', 'filt', 'ee-ica', 'filt'),
        E('ee-ica', 'clean', 'ee-tcn', 'clean'),
        E('ee-ica', 'clean', 'ee-hfo', 'clean'),
        E('ee-tcn', 'p_seiz', 'ee-fus', 'p_seiz'),
        E('ee-hfo', 'hfo_ev', 'ee-fus', 'hfo_ev'),
        E('ee-fus', 'alarm', 'ee-lat', 'alarm'),
        E('ee-fus', 'alarm', 'ee-alrt', 'alarm'),
        E('ee-audit', 'policy', 'ee-seal', 'policy'),
        E('ee-alrt', 'page_id', 'ee-seal', 'page_id'),
        E('ee-lat', 'lat_ms', 'ee-stack', 'lat_ms'),
        E('ee-seal', 'mac', 'ee-stack', 'mac'),
        E('ee-fus', 'alarm', 'ee-drill', 'alarm'),
        E('ee-edf', 'raw', 'ee-meta', 'raw'),
        E('ee-multi', 'sites', 'ee-cal', 'sites'),
        E('ee-ica', 'clean', 'ee-cal', 'clean'),
        E('ee-nob', 'obci_bin', 'ee-bridge', 'obci_bin'),
      ];
      return {
        nodes,
        connections,
        subgraphs: [
          { id: 'sg_eeg_sig', name: 'Signal chain', collapsed: true, nodeIds: ['ee-pre', 'ee-ica', 'ee-tcn'], showInternalPins: true },
          { id: 'sg_eeg_evt', name: 'Event fusion', collapsed: true, nodeIds: ['ee-hfo', 'ee-fus', 'ee-alrt'], showInternalPins: true },
        ],
      };
    },
  },
];

for (const spec of MORE) {
  const { nodes, connections, subgraphs } = spec.build();
  delete spec.build;
  writeGraph({ ...spec, nodes, connections, subgraphs });
}

/* ── 7–10 quick blocks (fix subgraph id typo in #1) */
function run78() {
  writeGraph({
    slug: 'single-cell-rna-seq',
    title: 'Single-Cell RNA-seq',
    org: '10x Genomics',
    tags: ['Genomics', 'Clustering'],
    description: 'Cell Ranger mkfastq → count, scVI batch correction, Leiden + annotation transfer, and differential program scoring for oncology cohorts.',
    canvasWidth: 1380,
    canvasHeight: 740,
    viewZoom: 0.59,
    initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'PBMC only' }, { id: 'v3', name: 'Tumor TME' }],
    demoPaths: { v1: [{ id: 'p_sc_work', name: 'Count → annotate', nodeIds: ['sc-count', 'sc-vi', 'sc-ld'] }] },
    demoRunCountByVariant: { v1: 2, v2: 2, v3: 0 },
    contributorCount: 9,
    contributors: [
      { letter: 'X', bg: '#0f172a', name: '10x — Software', role: 'Owner', pushes: 102 },
      { letter: 'B', bg: av(1), name: 'Broad Single Cell Lab', role: 'Admin', pushes: 24 },
      { letter: 'H', bg: av(3), name: 'H. Andersen', role: 'Contributor', pushes: 6 },
    ],
    othersCount: 6,
    othersPreview: 'Parse Biosciences, Cellenics…',
    others: [{ letter: 'P', bg: av(5), name: 'Parse Biosciences' }],
    nodes: [
      N('sc-fastq', 'Dataset', 'Illumina FASTQ drop', 'b', 'X', 60, 100, null, [{ name: 'fq', type: 'string' }]),
      N('sc-mk', 'Model', 'Cell Ranger mkfastq', 'g', 'B', 280, 100, [{ name: 'fq', type: 'string' }], [{ name: 'bam', type: 'string' }]),
      N('sc-count', 'Model', 'Cell Ranger count', 'g', 'X', 520, 100, [{ name: 'bam', type: 'string' }], [{ name: 'h5', type: 'string' }]),
      N('sc-filt', 'Logic', 'QC doublet sweep', 'y', 'H', 760, 120, [{ name: 'h5', type: 'string' }], [{ name: 'qc_h5', type: 'string' }]),
      N('sc-vi', 'Model', 'scVI latent', 'p', 'B', 1000, 100, [{ name: 'qc_h5', type: 'string' }], [{ name: 'latent', type: 'float' }]),
      N('sc-ld', 'Model', 'Leiden clustering', 'r', 'X', 1220, 120, [{ name: 'latent', type: 'float' }], [{ name: 'clus', type: 'label' }]),
      N('sc-az', 'Dataset', 'Azimuth reference', 'b', 'B', 60, 300, null, [{ name: 'ref', type: 'string' }]),
      N('sc-tr', 'Model', 'Annotation transfer', 'g', 'H', 320, 300, [{ name: 'latent', type: 'float' }, { name: 'ref', type: 'string' }], [{ name: 'celltype', type: 'label' }]),
      N('sc-de', 'Model', 'Pseudo-bulk DE', 'p', 'X', 580, 320, [{ name: 'celltype', type: 'label' }, { name: 'qc_h5', type: 'string' }], [{ name: 'de_table', type: 'string' }]),
      N('sc-prg', 'Model', 'Program scoring (GSVA)', 'y', 'B', 840, 320, [{ name: 'de_table', type: 'string' }], [{ name: 'score', type: 'float' }]),
      N('sc-viz', 'Model', 'Vitessce bundle', 'g', 'H', 1100, 340, [{ name: 'latent', type: 'float' }, { name: 'celltype', type: 'label' }], [{ name: 'bundle', type: 'string' }]),
      N('sc-geo', 'Dataset', 'GEO submission meta', 'b', 'X', 320, 480, null, [{ name: 'meta', type: 'string' }]),
      N('sc-push', 'Logic', 'Accession bot', 'y', 'B', 620, 500, [{ name: 'bundle', type: 'string' }, { name: 'meta', type: 'string' }], [{ name: 'geo_id', type: 'string' }]),
      N('sc-backup', 'Dataset', 'S3 glacier tier', 'b', 'H', 60, 520, null, [{ name: 'vault', type: 'string' }]),
      N('sc-snap', 'Model', 'Nightly snapshot', 'g', 'X', 320, 620, [{ name: 'qc_h5', type: 'string' }, { name: 'vault', type: 'string' }], [{ name: 'snap_id', type: 'string' }]),
      N('sc-line', 'Model', 'Patient cell line map', 'p', 'B', 620, 620, [{ name: 'celltype', type: 'label' }], [{ name: 'line_report', type: 'string' }]),
    ],
    connections: [
      E('sc-fastq', 'fq', 'sc-mk', 'fq'),
      E('sc-mk', 'bam', 'sc-count', 'bam'),
      E('sc-count', 'h5', 'sc-filt', 'h5'),
      E('sc-filt', 'qc_h5', 'sc-vi', 'qc_h5'),
      E('sc-vi', 'latent', 'sc-ld', 'latent'),
      E('sc-az', 'ref', 'sc-tr', 'ref'),
      E('sc-vi', 'latent', 'sc-tr', 'latent'),
      E('sc-ld', 'clus', 'sc-de', 'clus'),
      E('sc-filt', 'qc_h5', 'sc-de', 'qc_h5'),
      E('sc-de', 'de_table', 'sc-prg', 'de_table'),
      E('sc-vi', 'latent', 'sc-viz', 'latent'),
      E('sc-tr', 'celltype', 'sc-viz', 'celltype'),
      E('sc-viz', 'bundle', 'sc-push', 'bundle'),
      E('sc-geo', 'meta', 'sc-push', 'meta'),
      E('sc-filt', 'qc_h5', 'sc-snap', 'qc_h5'),
      E('sc-backup', 'vault', 'sc-snap', 'vault'),
      E('sc-tr', 'celltype', 'sc-line', 'celltype'),
    ],
    subgraphs: [
      { id: 'sg_sc_qc', name: 'QC + latent', collapsed: true, nodeIds: ['sc-count', 'sc-filt', 'sc-vi', 'sc-ld'], showInternalPins: true },
      { id: 'sg_sc_pub', name: 'Publishing', collapsed: true, nodeIds: ['sc-viz', 'sc-push', 'sc-geo'], showInternalPins: true },
    ],
  });
}
run78();

writeGraph({
  slug: 'wildfire-spread-modeling',
  title: 'Wildfire Spread Modeling',
  org: 'USGS',
  tags: ['Climate', 'Simulation'],
  description: 'Fuel moisture + wind fields, cellular automaton spread, smoke plume coupling, and evacuation polygon export for interagency incident teams.',
  canvasWidth: 1240,
  canvasHeight: 700,
  viewZoom: 0.62,
  initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'Coastal fog' }],
  demoPaths: { v1: [{ id: 'p_wf_ca', name: 'Fuel → spread', nodeIds: ['wf-fuel', 'wf-ca', 'wf-smoke'] }] },
  demoRunCountByVariant: { v1: 2, v2: 0 },
  contributorCount: 8,
  contributors: [
    { letter: 'U', bg: '#0f172a', name: 'USGS — Western Geographic', role: 'Owner', pushes: 36 },
    { letter: 'C', bg: av(2), name: 'CAL FIRE Fusion Cell', role: 'Admin', pushes: 14 },
  ],
  othersCount: 6,
  othersPreview: 'NOAA HRRR, Planet Labs…',
  others: [{ letter: 'P', bg: av(4), name: 'Planet Labs' }],
  nodes: [
    N('wf-lc', 'Dataset', 'NLCD fuels raster', 'b', 'U', 80, 100, null, [{ name: 'fuels', type: 'image' }]),
    N('wf-wx', 'Dataset', 'HRRR wind u/v', 'b', 'C', 80, 240, null, [{ name: 'wind', type: 'float' }]),
    N('wf-mois', 'Model', 'Fuel moisture model', 'g', 'U', 320, 120, [{ name: 'fuels', type: 'image' }], [{ name: 'fm10', type: 'float' }]),
    N('wf-ca', 'Model', 'Hex CA spread', 'p', 'C', 560, 140, [{ name: 'fm10', type: 'float' }, { name: 'wind', type: 'float' }], [{ name: 'burn_t', type: 'float' }]),
    N('wf-smoke', 'Model', 'HYSPLIT-lite coupling', 'y', 'U', 800, 160, [{ name: 'burn_t', type: 'float' }], [{ name: 'aqi_grid', type: 'float' }]),
    N('wf-pop', 'Dataset', 'Census blocks', 'b', 'C', 80, 400, null, [{ name: 'pop', type: 'float' }]),
    N('wf-evo', 'Logic', 'Evac polygonizer', 'r', 'U', 340, 400, [{ name: 'burn_t', type: 'float' }, { name: 'pop', type: 'float' }], [{ name: 'geojson', type: 'string' }]),
    N('wf-ims', 'Model', 'ICS-209 connector', 'g', 'C', 600, 420, [{ name: 'geojson', type: 'string' }], [{ name: 'ims_pkt', type: 'string' }]),
    N('wf-dash', 'Model', 'Situation board tile', 'p', 'U', 860, 440, [{ name: 'aqi_grid', type: 'float' }, { name: 'ims_pkt', type: 'string' }], [{ name: 'tile_url', type: 'string' }]),
    N('wf-train', 'Model', 'Rate spread calibrator', 'g', 'C', 560, 560, [{ name: 'burn_t', type: 'float' }], [{ name: 'beta', type: 'float' }]),
    N('wf-log', 'Dataset', 'AirTanker drop log', 'b', 'U', 320, 600, null, [{ name: 'drops', type: 'string' }]),
    N('wf-fuse', 'Logic', 'Suppressor feedback', 'y', 'C', 820, 580, [{ name: 'beta', type: 'float' }, { name: 'drops', type: 'string' }], [{ name: 'adj_burn', type: 'float' }]),
    N('wf-fuel', 'Model', 'Dynamic fuel loader', 'g', 'U', 300, 260, [{ name: 'fuels', type: 'image' }], [{ name: 'fuel_tbl', type: 'string' }]),
  ],
  connections: [
    E('wf-lc', 'fuels', 'wf-mois', 'fuels'),
    E('wf-lc', 'fuels', 'wf-fuel', 'fuels'),
    E('wf-mois', 'fm10', 'wf-ca', 'fm10'),
    E('wf-wx', 'wind', 'wf-ca', 'wind'),
    E('wf-ca', 'burn_t', 'wf-smoke', 'burn_t'),
    E('wf-ca', 'burn_t', 'wf-evo', 'burn_t'),
    E('wf-pop', 'pop', 'wf-evo', 'pop'),
    E('wf-evo', 'geojson', 'wf-ims', 'geojson'),
    E('wf-smoke', 'aqi_grid', 'wf-dash', 'aqi_grid'),
    E('wf-ims', 'ims_pkt', 'wf-dash', 'ims_pkt'),
    E('wf-ca', 'burn_t', 'wf-train', 'burn_t'),
    E('wf-train', 'beta', 'wf-fuse', 'beta'),
    E('wf-log', 'drops', 'wf-fuse', 'drops'),
  ],
  subgraphs: [{ id: 'sg_wf_fire', name: 'Fire physics', collapsed: true, nodeIds: ['wf-mois', 'wf-ca', 'wf-smoke'], showInternalPins: true }],
});

writeGraph({
  slug: 'retinal-disease-screening',
  title: 'Retinal Disease Screening',
  org: 'Google Health',
  tags: ['Ophthalmology', 'Image Classification'],
  description: 'DICOM fundus intake, DR/DME grading head, device-shift adapter, referral queue to eyecare partners, and audit-friendly deployment gates.',
  canvasWidth: 1200,
  canvasHeight: 680,
  viewZoom: 0.63,
  initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'Handheld cam' }],
  demoPaths: {},
  demoRunCountByVariant: { v1: 2, v2: 1 },
  contributorCount: 7,
  contributors: [
    { letter: 'G', bg: '#0f172a', name: 'Google Health — Imaging', role: 'Owner', pushes: 51 },
    { letter: 'A', bg: av(2), name: 'Aravind Eye Care', role: 'Admin', pushes: 23 },
  ],
  othersCount: 5,
  othersPreview: 'FDA readouts, Verily…',
  others: [{ letter: 'V', bg: av(5), name: 'Verily' }],
  nodes: [
    N('rt-dcm', 'Dataset', 'DICOMweb ingest', 'b', 'G', 70, 110, null, [{ name: 'img', type: 'image' }]),
    N('rt-mac', 'Model', 'Macula align + FOV', 'g', 'A', 300, 110, [{ name: 'img', type: 'image' }], [{ name: 'crop', type: 'image' }]),
    N('rt-dr', 'Model', 'DR ETDRS head', 'p', 'G', 540, 110, [{ name: 'crop', type: 'image' }], [{ name: 'dr_grade', type: 'label' }]),
    N('rt-dme', 'Model', 'DME thickness proxy', 'r', 'A', 780, 130, [{ name: 'crop', type: 'image' }], [{ name: 'dme_risk', type: 'label' }]),
    N('rt-dev', 'Logic', 'Device adapter table', 'y', 'G', 300, 280, [{ name: 'dr_grade', type: 'label' }, { name: 'meta', type: 'string' }], [{ name: 'adj_grade', type: 'label' }]),
    N('rt-meta', 'Dataset', 'Camera make/model', 'b', 'A', 70, 300, null, [{ name: 'meta', type: 'string' }]),
    N('rt-ref', 'Model', 'Referral triage bot', 'g', 'G', 540, 300, [{ name: 'adj_grade', type: 'label' }, { name: 'dme_risk', type: 'label' }], [{ name: 'queue', type: 'string' }]),
    N('rt-fhir', 'Model', 'FHIR ServiceRequest', 'p', 'A', 780, 300, [{ name: 'queue', type: 'string' }], [{ name: 'sr_id', type: 'string' }]),
    N('rt-gov', 'Logic', 'FDA SaMD gate', 'y', 'G', 540, 460, [{ name: 'sr_id', type: 'string' }], [{ name: 'release', type: 'label' }]),
    N('rt-telemetry', 'Dataset', 'Canary metrics', 'b', 'A', 300, 480, null, [{ name: 'lat', type: 'float' }]),
    N('rt-dashrd', 'Model', 'Prod dash', 'g', 'G', 780, 480, [{ name: 'lat', type: 'float' }, { name: 'release', type: 'label' }], [{ name: 'dash', type: 'string' }]),
    N('rt-teach', 'Model', 'Clinician-in-loop relabel', 'p', 'A', 70, 520, [{ name: 'crop', type: 'image' }], [{ name: 'gold', type: 'label' }]),
  ],
  connections: [
    E('rt-dcm', 'img', 'rt-mac', 'img'),
    E('rt-mac', 'crop', 'rt-dr', 'crop'),
    E('rt-mac', 'crop', 'rt-dme', 'crop'),
    E('rt-meta', 'meta', 'rt-dev', 'meta'),
    E('rt-dr', 'dr_grade', 'rt-dev', 'dr_grade'),
    E('rt-dev', 'adj_grade', 'rt-ref', 'adj_grade'),
    E('rt-dme', 'dme_risk', 'rt-ref', 'dme_risk'),
    E('rt-ref', 'queue', 'rt-fhir', 'queue'),
    E('rt-fhir', 'sr_id', 'rt-gov', 'sr_id'),
    E('rt-telemetry', 'lat', 'rt-dashrd', 'lat'),
    E('rt-gov', 'release', 'rt-dashrd', 'release'),
    E('rt-mac', 'crop', 'rt-teach', 'crop'),
  ],
  subgraphs: [],
});

writeGraph({
  slug: 'crispr-off-target-prediction',
  title: 'CRISPR Off-Target Prediction',
  org: 'Broad Institute',
  tags: ['Genomics', 'Sequence Analysis'],
  description: 'gRNA design, Cas-variant binding models, whole-genome hybrid search, mismatch tolerance tables, and rank fusion for therapeutic shortlists.',
  canvasWidth: 1520,
  canvasHeight: 800,
  viewZoom: 0.56,
  initialVariants: [{ id: 'v1', name: 'Master' }, { id: 'v2', name: 'Cas12a' }, { id: 'v3', name: 'Prime edit' }],
  demoPaths: {
    v1: [{ id: 'p_cr_guide', name: 'Guide → rank', nodeIds: ['cr-grna', 'cr-hyb', 'cr-fuse'] }],
  },
  demoRunCountByVariant: { v1: 3, v2: 2, v3: 1 },
  contributorCount: 10,
  contributors: [
    { letter: 'B', bg: '#0f172a', name: 'Broad GEdit', role: 'Owner', pushes: 88 },
    { letter: 'F', bg: av(2), name: 'Feng Zhang Group', role: 'Admin', pushes: 31 },
    { letter: 'E', bg: av(4), name: 'Editas Medicine', role: 'Admin', pushes: 18 },
  ],
  othersCount: 7,
  othersPreview: 'MIT CSAIL, Inscripta…',
  others: [{ letter: 'I', bg: av(6), name: 'Inscripta' }],
  nodes: [
    N('cr-seq', 'Dataset', 'GRCh38 reference', 'b', 'B', 60, 80, null, [{ name: 'ref', type: 'string' }]),
    N('cr-grna', 'Model', 'gRNA scorer', 'g', 'F', 280, 80, [{ name: 'ref', type: 'string' }], [{ name: 'guides', type: 'string' }]),
    N('cr-cris', 'Model', 'Cas9 binding CNN', 'p', 'E', 520, 60, [{ name: 'guides', type: 'string' }], [{ name: 'bind', type: 'float' }]),
    N('cr-hyb', 'Model', 'Hybrid WGS aligner', 'r', 'B', 760, 90, [{ name: 'guides', type: 'string' }, { name: 'ref', type: 'string' }], [{ name: 'hits', type: 'string' }]),
    N('cr-mm', 'Logic', 'Mismatch table', 'y', 'F', 1000, 110, [{ name: 'hits', type: 'string' }, { name: 'bind', type: 'float' }], [{ name: 'table', type: 'string' }]),
    N('cr-fuse', 'Model', 'Learned rank fusion', 'g', 'E', 1240, 130, [{ name: 'table', type: 'string' }], [{ name: 'ranked', type: 'string' }]),
    N('cr-ont', 'Dataset', 'ONT long read patch', 'b', 'B', 60, 260, null, [{ name: 'long', type: 'string' }]),
    N('cr-gap', 'Model', 'Gapped align refine', 'p', 'F', 320, 280, [{ name: 'hits', type: 'string' }, { name: 'long', type: 'string' }], [{ name: 'hits2', type: 'string' }]),
    N('cr-epi', 'Dataset', 'H3K27ac peaks', 'b', 'E', 60, 420, null, [{ name: 'peak', type: 'string' }]),
    N('cr-chr', 'Model', 'Chromatin gate', 'g', 'B', 320, 440, [{ name: 'ranked', type: 'string' }, { name: 'peak', type: 'string' }], [{ name: 'safe', type: 'string' }]),
    N('cr-oligo', 'Model', 'Synthesis order sheet', 'y', 'F', 580, 460, [{ name: 'safe', type: 'string' }], [{ name: 'order', type: 'string' }]),
    N('cr-viv', 'Logic', 'In vivo tracker', 'r', 'E', 840, 480, [{ name: 'order', type: 'string' }], [{ name: 'mouse_id', type: 'string' }]),
    N('cr-audit', 'Dataset', 'GMP change log', 'b', 'B', 1100, 300, null, [{ name: 'gmp', type: 'string' }]),
    N('cr-seal', 'Model', 'Dual sign-off', 'g', 'F', 1100, 460, [{ name: 'ranked', type: 'string' }, { name: 'gmp', type: 'string' }], [{ name: 'sig', type: 'string' }]),
    N('cr-api', 'Model', 'Partner API façade', 'p', 'E', 1340, 420, [{ name: 'sig', type: 'string' }], [{ name: 'api_key', type: 'string' }]),
    N('cr-cache', 'Dataset', 'Tile DB off-target store', 'b', 'B', 540, 620, null, [{ name: 'tdb', type: 'string' }]),
    N('cr-idx', 'Model', 'FM-index builder', 'g', 'F', 800, 620, [{ name: 'ref', type: 'string' }], [{ name: 'idx_uri', type: 'string' }]),
    N('cr-mon', 'Logic', 'Quota monitor', 'y', 'E', 1060, 620, [{ name: 'api_key', type: 'string' }], [{ name: 'quota', type: 'string' }]),
    N('cr-lift', 'Model', 'LiftOver chain', 'p', 'B', 60, 580, [{ name: 'hits2', type: 'string' }], [{ name: 'hg38', type: 'string' }]),
    N('cr-merge', 'Logic', 'Hit merge', 'g', 'F', 320, 600, [{ name: 'hg38', type: 'string' }, { name: 'hits', type: 'string' }], [{ name: 'merged', type: 'string' }]),
  ],
  connections: [
    E('cr-seq', 'ref', 'cr-grna', 'ref'),
    E('cr-grna', 'guides', 'cr-cris', 'guides'),
    E('cr-grna', 'guides', 'cr-hyb', 'guides'),
    E('cr-seq', 'ref', 'cr-hyb', 'ref'),
    E('cr-cris', 'bind', 'cr-mm', 'bind'),
    E('cr-hyb', 'hits', 'cr-mm', 'hits'),
    E('cr-mm', 'table', 'cr-fuse', 'table'),
    E('cr-fuse', 'ranked', 'cr-chr', 'ranked'),
    E('cr-epi', 'peak', 'cr-chr', 'peak'),
    E('cr-chr', 'safe', 'cr-oligo', 'safe'),
    E('cr-oligo', 'order', 'cr-viv', 'order'),
    E('cr-audit', 'gmp', 'cr-seal', 'gmp'),
    E('cr-fuse', 'ranked', 'cr-seal', 'ranked'),
    E('cr-seal', 'sig', 'cr-api', 'sig'),
    E('cr-seq', 'ref', 'cr-idx', 'ref'),
    E('cr-api', 'api_key', 'cr-mon', 'api_key'),
    E('cr-hyb', 'hits', 'cr-gap', 'hits'),
    E('cr-ont', 'long', 'cr-gap', 'long'),
    E('cr-gap', 'hits2', 'cr-lift', 'hits2'),
    E('cr-lift', 'hg38', 'cr-merge', 'hg38'),
    E('cr-hyb', 'hits', 'cr-merge', 'hits'),
  ],
  subgraphs: [
    { id: 'sg_cr_align', name: 'Off-target search', collapsed: true, nodeIds: ['cr-grna', 'cr-hyb', 'cr-gap', 'cr-mm'], showInternalPins: true },
    { id: 'sg_cr_gov', name: 'Therapeutic gate', collapsed: true, nodeIds: ['cr-chr', 'cr-oligo', 'cr-seal'], showInternalPins: true },
    { id: 'sg_cr_idx', name: 'Index + liftover', collapsed: true, nodeIds: ['cr-idx', 'cr-lift', 'cr-merge'], showInternalPins: true },
  ],
});

console.log('done');

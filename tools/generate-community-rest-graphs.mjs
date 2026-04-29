/**
 * Bundled graphs for community seed rows 10–29 (after the first ten demos).
 * Run: node tools/generate-community-rest-graphs.mjs
 * Then: node tools/relayout-all-bundled-graphs.mjs (optional; layoutBundledProject runs in writeGraph)
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
const AV = ['var(--avatar-1)', 'var(--avatar-2)', 'var(--avatar-3)', 'var(--avatar-4)', 'var(--avatar-5)', 'var(--avatar-6)'];

/** Mirrors canvas-new.js ADAPTOR_MAP entries used in bundled JSON. */
const ADAPTORS = {
  'float>string': {
    id: 'float-to-string',
    fromType: 'float',
    toType: 'string',
    label: 'Float→Str',
    desc: 'Formats float values as strings.',
  },
  'image>tensor': {
    id: 'image-to-tensor',
    fromType: 'image',
    toType: 'tensor',
    label: 'Img→Tensor',
    desc: 'uint8 HWC image to normalized CHW float tensor for conv stacks.',
  },
  'tensor>float': {
    id: 'tensor-to-float',
    fromType: 'tensor',
    toType: 'float',
    label: 'Tensor→Float',
    desc: 'Unfolds a dense tensor to a row-major float vector for legacy stats / sklearn-style heads.',
  },
  'text>tensor': {
    id: 'text-to-tensor',
    fromType: 'text',
    toType: 'tensor',
    label: 'Text→Tensor',
    desc: 'Tokenizer output: UTF-8 text to int64 token-id tensor for transformer blocks.',
  },
  'binary>float': {
    id: 'binary-to-float',
    fromType: 'binary',
    toType: 'float',
    label: 'Binary→Float',
    desc: 'Interprets the binary payload as a float tensor.',
  },
  'logits>label': {
    id: 'logits-to-label',
    fromType: 'logits',
    toType: 'label',
    label: 'Logits→Label',
    desc: 'Argmax (or calibrated top-k) over class logits to a discrete label id.',
  },
  'spectrogram>float': {
    id: 'spectrogram-to-float',
    fromType: 'spectrogram',
    toType: 'float',
    label: 'Spec→Float',
    desc: 'Flattens mel or STFT energy matrix to a float feature vector.',
  },
  'point_cloud>binary': {
    id: 'point_cloud-to-binary',
    fromType: 'point_cloud',
    toType: 'binary',
    label: 'PC→Bin',
    desc: 'Packs XYZI point records into a compact binary frame (e.g. LAS-style).',
  },
  'embedding>tensor': {
    id: 'embedding-to-tensor',
    fromType: 'embedding',
    toType: 'tensor',
    label: 'Emb→Tensor',
    desc: 'Stacks per-token embedding vectors into a single [T, D] tensor.',
  },
  'tensor>text': {
    id: 'tensor-to-text',
    fromType: 'tensor',
    toType: 'text',
    label: 'Tensor→Text',
    desc: 'Greedy or sampled decode from vocabulary logits tensor to a string.',
  },
};

const REST = [
  { slug: 'fmri-connectivity-atlas', title: 'fMRI Connectivity Atlas', org: 'HCP', domain: 'Neuroscience', method: 'Connectomics', modality: 'fMRI', abstract: 'Parcellated resting-state fMRI → FC matrices, null models, and graph-theoretic summaries for cohort QC.' },
  { slug: 'antibody-antigen-docking', title: 'Antibody-Antigen Docking', org: 'Genentech', domain: 'Drug Discovery', method: 'Structure Prediction', modality: 'Protein', abstract: 'Pose generation, scoring, and interface hotspot analysis for therapeutic antibody candidates.' },
  { slug: 'speech-emotion-recognition', title: 'Speech Emotion Recognition', org: 'Affectiva', domain: 'NLP', method: 'Audio Classification', modality: 'Audio', abstract: 'Wav2Vec-style front-end, prosody branch, and calibration for affect labels under domain shift.' },
  { slug: 'pedestrian-trajectory-forecasting', title: 'Pedestrian Trajectory Forecasting', org: 'NVIDIA', domain: 'Autonomous Driving', method: 'Trajectory Prediction', modality: 'LiDAR+Vision', abstract: 'Scene-centric encoding, social pooling, and multi-modal futures with uncertainty cones.' },
  { slug: 'coral-bleaching-index', title: 'Coral Bleaching Index', org: 'NOAA', domain: 'Climate', method: 'Remote Sensing', modality: 'Satellite', abstract: 'SST anomalies, light attenuation, and bleaching risk layers fused for reef-scale dashboards.' },
  { slug: 'histopathology-tumor-grading', title: 'Histopathology Tumor Grading', org: 'PathAI', domain: 'Oncology', method: 'Image Classification', modality: 'Histology', abstract: 'WSI tiling, MIL aggregation, and explainability hooks aligned to CAP cancer protocols.' },
  { slug: 'polygenic-risk-scoring', title: 'Polygenic Risk Scoring', org: '23andMe', domain: 'Genomics', method: 'Statistical Genetics', modality: 'Sequence', abstract: 'LD-aware PRS construction, ancestry adjustment, and liability-scale reporting pipelines.' },
  { slug: 'molecular-property-prediction', title: 'Molecular Property Prediction', org: 'Atomwise', domain: 'Drug Discovery', method: 'Graph Neural Net', modality: 'Graph', abstract: '3D conformer ensembles, message passing, and uncertainty for ADME / toxicity endpoints.' },
  { slug: 'air-quality-forecasting', title: 'Air Quality Forecasting', org: 'EPA', domain: 'Public Health', method: 'Forecasting', modality: 'Multimodal', abstract: 'Station sensors, satellite AOD, and traffic covariates fused for 48h PM2.5 nowcasts.' },
  { slug: 'brain-tumor-segmentation', title: 'Brain Tumor Segmentation', org: 'UPenn', domain: 'Neuroscience', method: 'Image Segmentation', modality: 'MRI', abstract: 'Multisequence BraTS-style U-Net++ stack with uncertainty and clinical report export.' },
  { slug: 'pose-estimation-for-animals', title: 'Pose Estimation for Animals', org: 'Harvard', domain: 'Behavioral Science', method: 'Pose Estimation', modality: 'Video', abstract: 'Keypoint heatmaps, temporal CRF smoothing, and ethogram export for field video.' },
  { slug: 'earthquake-aftershock-prediction', title: 'Earthquake Aftershock Prediction', org: 'USGS', domain: 'Geophysics', method: 'Time Series', modality: 'Seismic', abstract: 'ETAS / neural hybrid models with magnitude-time feature stores and catalog ingestion.' },
  { slug: 'lidar-point-cloud-segmentation', title: 'Lidar Point Cloud Segmentation', org: 'Cruise', domain: 'Autonomous Driving', method: 'Segmentation', modality: 'LiDAR', abstract: 'Voxelization, sparse conv towers, and panoptic heads for urban driving scenes.' },
  { slug: 'multilingual-disease-surveillance', title: 'Multilingual Disease Surveillance', org: 'WHO', domain: 'Public Health', method: 'NLP', modality: 'Text', abstract: 'Geo-entity linking, symptom lexicons, and anomaly fusion across languages and feeds.' },
  { slug: 'cardiac-mri-function', title: 'Cardiac MRI Function', org: 'Cleveland Clinic', domain: 'Cardiology', method: 'Image Analysis', modality: 'MRI', abstract: 'Short-axis segmentation, LV/RV volumes, strain, and report-ready cine summaries.' },
  { slug: 'microbiome-diversity', title: 'Microbiome Diversity', org: 'JCVI', domain: 'Bioinformatics', method: 'Diversity Analysis', modality: 'Sequence', abstract: 'ASV tables, phylogenetic diversity, and differential abundance with batch correction.' },
  { slug: 'glacier-retreat-mapping', title: 'Glacier Retreat Mapping', org: 'NASA', domain: 'Climate', method: 'Remote Sensing', modality: 'Satellite', abstract: 'SAR + optical fusion, terminus tracking, and DEM differencing for mass-balance proxies.' },
  { slug: 'diabetic-retinopathy-grading', title: 'Diabetic Retinopathy Grading', org: 'Aravind', domain: 'Ophthalmology', method: 'Image Classification', modality: 'Fundus', abstract: 'ETDRS-aligned grading, referral thresholds, and drift monitors for deployment.' },
  { slug: 'synthetic-biology-pathway-design', title: 'Synthetic Biology Pathway Design', org: 'Ginkgo', domain: 'Synthetic Biology', method: 'Optimization', modality: 'Graph', abstract: 'Constraint graphs, flux balance layers, and design-of-experiments feedback for chassis tuning.' },
  { slug: 'plant-disease-detection', title: 'Plant Disease Detection', org: 'Plantix', domain: 'Agriculture', method: 'Image Classification', modality: 'Photo', abstract: 'Field imagery, species priors, and treatment recommendation hooks for smallholder UX.' },
];

const ADAPTOR_KEYS = Object.keys(ADAPTORS);

function N(id, type, label, colorKey, letter, x, y, inputs, outputs) {
  const o = {
    id,
    type,
    label,
    color: COL[colorKey] || colorKey,
    user: { letter, color: AV[letter.charCodeAt(0) % AV.length] },
    x,
    y,
  };
  if (inputs && inputs.length) o.inputs = inputs;
  if (outputs && outputs.length) o.outputs = outputs;
  return o;
}

function E(fromNode, outPort, toNode, inPort, adaptor) {
  const c = { from: [fromNode, 'out', outPort], to: [toNode, 'in', inPort] };
  if (adaptor) {
    c.adaptor = { ...adaptor };
    c.adaptorSettings = {};
  }
  return c;
}

function buildGraph(meta, idx) {
  const n = 12 + (idx % 10);
  const pfx = meta.slug.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'g';
  const nodes = [];
  const aKey = ADAPTOR_KEYS[idx % ADAPTOR_KEYS.length];
  const a = ADAPTORS[aKey];
  const eIdx = Math.max(1, Math.min(n - 3, Math.floor(n / 3)));

  for (let k = 0; k < n; k++) {
    const id = `${pfx}_n${k}`;
    const letter = String.fromCharCode(65 + (k % 26));
    const ty = k === 0 ? 'Dataset' : k === n - 1 ? 'Logic' : 'Model';
    const colorKey = ['b', 'g', 'p', 'y', 'r'][k % 5];
    let inputs;
    let outputs;
    if (k === 0) {
      outputs = [{ name: 'out', type: 'float' }];
    } else if (k === n - 1) {
      inputs = [{ name: 'in', type: 'float' }];
    } else {
      const inT = k === eIdx + 1 ? a.toType : 'float';
      const outT = k === eIdx ? a.fromType : 'float';
      inputs = [{ name: 'in', type: inT }];
      outputs = [{ name: 'out', type: outT }];
    }
    nodes.push(N(id, ty, k === 0 ? 'Source' : k === n - 1 ? 'Sink' : `Block ${k}`, colorKey, letter, 0, 0, inputs, outputs));
  }

  const connections = [];
  for (let k = 0; k < n - 1; k++) {
    const fromId = `${pfx}_n${k}`;
    const toId = `${pfx}_n${k + 1}`;
    const adaptor = k === eIdx ? a : null;
    connections.push(E(fromId, 'out', toId, 'in', adaptor));
  }

  let subgraphs = [];
  if (idx % 3 === 0 && n >= 8) {
    const mid = Math.floor(n / 2);
    subgraphs = [{
      id: `${pfx}_sg1`,
      name: 'Core stack',
      collapsed: true,
      nodeIds: [`${pfx}_n${mid}`, `${pfx}_n${mid + 1}`, `${pfx}_n${mid + 2}`],
      showInternalPins: true,
    }];
  }

  const vCount = 2 + (idx % 2);
  const initialVariants = [{ id: 'v1', name: 'Master' }];
  if (vCount > 1) initialVariants.push({ id: 'v2', name: idx % 2 ? 'Ablated' : 'Wide model' });
  if (vCount > 2) initialVariants.push({ id: 'v3', name: 'Fast path' });

  const spec = {
    slug: meta.slug,
    title: meta.title,
    org: meta.org,
    tags: [meta.domain, meta.method].filter(Boolean),
    contributorCount: 6,
    contributors: [
      { letter: meta.org[0] || 'O', bg: '#0f172a', name: `${meta.org} Lab`, role: 'Owner', pushes: 40 + idx },
      { letter: 'A', bg: 'var(--avatar-1)', name: 'A. Researcher', role: 'Admin', pushes: 12 },
      { letter: 'B', bg: 'var(--avatar-3)', name: 'B. Chen', role: 'Contributor', pushes: 5 },
    ],
    othersCount: 3,
    othersPreview: 'External reviewers…',
    others: [{ letter: 'X', bg: 'var(--avatar-2)', name: 'Cross-institute collab' }],
    description: meta.abstract,
    canvasWidth: 2200,
    canvasHeight: 1400,
    viewZoom: 0.55,
    initialVariants,
    demoPaths: {
      v1: [{ id: `${pfx}_p0`, name: 'Main path', nodeIds: [`${pfx}_n0`, `${pfx}_n1`, `${pfx}_n2`] }],
    },
    demoRunCountByVariant: { v1: idx % 3, v2: (idx + 1) % 2, v3: (idx + 2) % 2 },
    nodes,
    connections,
    subgraphs,
  };
  return layoutBundledProject(spec);
}

function writeGraph(spec) {
  const dir = path.join(ROOT, 'graphs', spec.slug);
  fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(spec);
  fs.writeFileSync(path.join(dir, 'graph.json'), json + '\n', 'utf8');
  const dataJs =
    '// Bundled project — keep in sync with graph.json (file:// fallback).\n' +
    'window.PROJECT = ' +
    json +
    ';\n';
  fs.writeFileSync(path.join(dir, 'data.js'), dataJs, 'utf8');
  console.log('wrote', spec.slug, spec.nodes.length, 'nodes');
}

REST.forEach((meta, i) => {
  writeGraph(buildGraph(meta, i));
});
console.log('done', REST.length);

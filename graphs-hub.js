    (function() {
      const KEY = 'cfg.leftnav.expanded';
      function apply() {
        const on = localStorage.getItem(KEY) === '1';
        document.body.classList.toggle('sidebar-expanded', on);
      }
      apply();
      document.getElementById('navToggle')?.addEventListener('click', () => {
        const on = !document.body.classList.contains('sidebar-expanded');
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {}
        apply();
      });

      // Wire leftnav collapsable sections (Projects, My Teams)
      function wireCollapsable(wrapId, toggleId) {
        const wrap = document.getElementById(wrapId);
        const toggle = document.getElementById(toggleId);
        if (!wrap || !toggle) return;
        toggle.addEventListener('click', () => {
          const expanded = wrap.dataset.expanded === 'true';
          wrap.dataset.expanded = expanded ? 'false' : 'true';
          toggle.setAttribute('aria-expanded', String(!expanded));
        });
      }
      document.addEventListener('DOMContentLoaded', () => {
        wireCollapsable('leftnavProjects', 'lpHeaderToggle');
        wireCollapsable('leftnavTeams', 'ltHeaderToggle');

        // Render the projects tree from cfg.customProjects (forks + user-created).
        // graphs-hub doesn't have a current project, so nothing is marked active.
        if (window.ConnectifyLeftnav && typeof window.ConnectifyLeftnav.renderProjects === 'function') {
          window.ConnectifyLeftnav.renderProjects();
        }

        document.getElementById('lpAddProject')?.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = 'graphs-hub.html?tab=dashboard&new=1';
        });

        document.getElementById('leftnavSearch')?.addEventListener('click', () => {
          const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
          document.dispatchEvent(ev);
        });

        document.getElementById('leftnavAuth')?.addEventListener('click', () => {
          alert('Log in / Sign up coming soon.');
        });
        document.getElementById('leftnavCredits')?.addEventListener('click', () => {
          if (window.ConnectifyLeftnav && typeof window.ConnectifyLeftnav.showCreditsModal === 'function') {
            window.ConnectifyLeftnav.showCreditsModal({ remaining: 100, cap: 100 });
          }
        });
      });
    })();

    const KNOWN_PROJECTS = {
      'Public Health Monitoring': 'public-health-monitoring',
      'Neurological Disease Analysis': 'neurological-disease-analysis',
      'Autonomous Vehicle Navigation': 'autonomous-vehicle-navigation',
      'Human Genome Analysis': 'human-genome-analysis',
      'Protein Folding Pipeline': 'protein-folding-pipeline',
      'Climate Storm Forecasting': 'climate-storm-forecasting',
      'Cancer Cell Classification': 'cancer-cell-classification',
      'Drug-Target Interaction': 'drug-target-interaction',
      'Sentiment in Clinical Notes': 'sentiment-in-clinical-notes',
      'EEG Seizure Detection': 'eeg-seizure-detection',
      'Single-Cell RNA-seq': 'single-cell-rna-seq',
      'Wildfire Spread Modeling': 'wildfire-spread-modeling',
      'Retinal Disease Screening': 'retinal-disease-screening',
      'CRISPR Off-Target Prediction': 'crispr-off-target-prediction',
      'fMRI Connectivity Atlas': 'fmri-connectivity-atlas',
      'Antibody-Antigen Docking': 'antibody-antigen-docking',
      'Speech Emotion Recognition': 'speech-emotion-recognition',
      'Pedestrian Trajectory Forecasting': 'pedestrian-trajectory-forecasting',
      'Coral Bleaching Index': 'coral-bleaching-index',
      'Histopathology Tumor Grading': 'histopathology-tumor-grading',
      'Polygenic Risk Scoring': 'polygenic-risk-scoring',
      'Molecular Property Prediction': 'molecular-property-prediction',
      'Air Quality Forecasting': 'air-quality-forecasting',
      'Brain Tumor Segmentation': 'brain-tumor-segmentation',
      'Pose Estimation for Animals': 'pose-estimation-for-animals',
      'Earthquake Aftershock Prediction': 'earthquake-aftershock-prediction',
      'Lidar Point Cloud Segmentation': 'lidar-point-cloud-segmentation',
      'Multilingual Disease Surveillance': 'multilingual-disease-surveillance',
      'Cardiac MRI Function': 'cardiac-mri-function',
      'Microbiome Diversity': 'microbiome-diversity',
      'Glacier Retreat Mapping': 'glacier-retreat-mapping',
      'Diabetic Retinopathy Grading': 'diabetic-retinopathy-grading',
      'Synthetic Biology Pathway Design': 'synthetic-biology-pathway-design',
      'Plant Disease Detection': 'plant-disease-detection',
    };
    /** Node counts for bundled demo graphs (graphs hub demo slugs). Custom rows use project.nodes.length. */
    const DEMO_NODE_COUNT_BY_SLUG = {
      'public-health-monitoring': 60,
      'neurological-disease-analysis': 10,
      'autonomous-vehicle-navigation': 11,
      'human-genome-analysis': 25,
      'protein-folding-pipeline': 14,
      'climate-storm-forecasting': 12,
      'cancer-cell-classification': 14,
      'drug-target-interaction': 13,
      'sentiment-in-clinical-notes': 11,
      'eeg-seizure-detection': 17,
      'single-cell-rna-seq': 16,
      'wildfire-spread-modeling': 13,
      'retinal-disease-screening': 12,
      'crispr-off-target-prediction': 20,
      'fmri-connectivity-atlas': 12,
      'antibody-antigen-docking': 13,
      'speech-emotion-recognition': 14,
      'pedestrian-trajectory-forecasting': 15,
      'coral-bleaching-index': 16,
      'histopathology-tumor-grading': 17,
      'polygenic-risk-scoring': 18,
      'molecular-property-prediction': 19,
      'air-quality-forecasting': 20,
      'brain-tumor-segmentation': 21,
      'pose-estimation-for-animals': 12,
      'earthquake-aftershock-prediction': 13,
      'lidar-point-cloud-segmentation': 14,
      'multilingual-disease-surveillance': 15,
      'cardiac-mri-function': 16,
      'microbiome-diversity': 17,
      'glacier-retreat-mapping': 18,
      'diabetic-retinopathy-grading': 19,
      'synthetic-biology-pathway-design': 20,
      'plant-disease-detection': 21,
    };
    /** Community seed rows → bundled `graphs/<slug>/` (order matches `seeds` in seedDummies). */
    const BUNDLED_COMMUNITY_ROW_SLUGS = [
      'protein-folding-pipeline',
      'climate-storm-forecasting',
      'cancer-cell-classification',
      'drug-target-interaction',
      'sentiment-in-clinical-notes',
      'eeg-seizure-detection',
      'single-cell-rna-seq',
      'wildfire-spread-modeling',
      'retinal-disease-screening',
      'crispr-off-target-prediction',
      'fmri-connectivity-atlas',
      'antibody-antigen-docking',
      'speech-emotion-recognition',
      'pedestrian-trajectory-forecasting',
      'coral-bleaching-index',
      'histopathology-tumor-grading',
      'polygenic-risk-scoring',
      'molecular-property-prediction',
      'air-quality-forecasting',
      'brain-tumor-segmentation',
      'pose-estimation-for-animals',
      'earthquake-aftershock-prediction',
      'lidar-point-cloud-segmentation',
      'multilingual-disease-surveillance',
      'cardiac-mri-function',
      'microbiome-diversity',
      'glacier-retreat-mapping',
      'diabetic-retinopathy-grading',
      'synthetic-biology-pathway-design',
      'plant-disease-detection',
    ];
    const BUNDLED_COMMUNITY_ROW_VARIANT_COUNTS = [
      2, 3, 2, 3, 1, 2, 3, 2, 2, 3,
      2, 3, 2, 3, 2, 3, 2, 3, 2, 3,
      2, 3, 2, 3, 2, 3, 2, 3, 2, 3,
    ];
    const PUBLIC_GRAPH_EDIT_OPT_IN_KEY = 'cfg.publicGraphEditOptInSlugs';
    function readPublicGraphEditOptInSet() {
      try {
        const raw = localStorage.getItem(PUBLIC_GRAPH_EDIT_OPT_IN_KEY);
        const a = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(a) ? a : []);
      } catch (_) {
        return new Set();
      }
    }
    function rememberPublicGraphEditOptIn(slug) {
      if (!slug) return;
      const s = readPublicGraphEditOptInSet();
      s.add(slug);
      try { localStorage.setItem(PUBLIC_GRAPH_EDIT_OPT_IN_KEY, JSON.stringify([...s])); } catch (_) {}
    }
    function shouldOpenPublicGraphInViewOnly(g) {
      if (!g || String(g.role || '').toLowerCase() !== 'public') return false;
      const slug = graphSlug(g);
      if (!slug) return true;
      return !readPublicGraphEditOptInSet().has(slug);
    }
    function hrefOpenBundledGraph(g) {
      const slug = graphSlug(g);
      if (!slug) return 'graphs-hub.html?tab=dashboard';
      if (shouldOpenPublicGraphInViewOnly(g)) {
        return `view-mode-new.html?project=${encodeURIComponent(slug)}`;
      }
      return `editing-mode-new.html?project=${encodeURIComponent(slug)}`;
    }
    /** Node counts for bundled graphs; merged from graphs/catalog.json when present. */
    const BUNDLED_GRAPH_COUNTS = Object.assign({}, DEMO_NODE_COUNT_BY_SLUG);
    const TAB_META = {
      'dashboard': {
        title: 'Home',
        desc: 'Graphs where you are an owner, admin, or contributor.'
      },
      'community': {
        title: 'Community',
        desc: "Browse community graphs or jump into projects that welcome contribution."
      },
      'my-team': {
        title: 'My Team',
        desc: 'Track team-shared graphs, pending requests, and collaboration opportunities.'
      }
    };

    const GRAPHS = [
      { title:'Neurological Disease Analysis', owner:'RazLab', shortOwner:'you · RazLab', domain:'Neuroscience', modality:'MRI', method:'Disease Detection', role:'Admin', status:'Experimental', license:'MIT', updatedHours:6, forks:38, stars:214, downloads:12000, activity:57, openContrib:true, team:'Neuron Forge', abstract:'MRI/PET workflow for lesion segmentation and progression scoring.', starred:true, recentRank:1, editedAgo:'2 hours ago', editedBy:'Jesh B.', collaborators:['LR','MK','SP'], collaboratorExtra:38 },
      { title:'Human Genome Analysis', owner:'Broad Institute', shortOwner:'you · Broad Institute', domain:'Genomics', modality:'Sequence', method:'Bioinformatics', role:'Admin', status:'Stable', license:'CC-BY-4.0', updatedHours:14, forks:14, stars:88, downloads:0, activity:66, openContrib:true, team:'Genome Guild', abstract:'Population-scale variant analysis with explainable ranking stages.', starred:false, recentRank:2, editedAgo:'6 hours ago', editedBy:'Mina K.', collaborators:['AM','TP','JW'], collaboratorExtra:12 },
      { title:'Autonomous Vehicle Navigation', owner:'Waymo', shortOwner:'Waymo', domain:'Autonomous Driving', modality:'LiDAR+Vision', method:'Perception', role:'View Only', status:'Stable', license:'Apache-2.0', updatedHours:2, forks:200, stars:1200, downloads:0, activity:98, openContrib:false, team:'Vector Lab', abstract:'Perception-to-planning graph with branch-level ablation tracing.', starred:true, recentRank:3, editedAgo:'1 day ago', editedBy:'Ria S.', collaborators:['RC','DN','YK'], collaboratorExtra:22 },
      { title:'Public Health Monitoring', owner:'UCLA', shortOwner:'UCLA', domain:'Public Health', modality:'Multimodal', method:'Forecasting', role:'Contributor', status:'Stable', license:'CC-BY-4.0', updatedHours:55, forks:55, stars:310, downloads:0, activity:91, openContrib:true, team:'Vector Lab', abstract:'County-level outbreak warning with EHR + wastewater + mobility inputs.', starred:false, recentRank:4, editedAgo:'2 days ago', editedBy:'Lana R.', collaborators:['LR','SP','AQ'], collaboratorExtra:9 }
    ];

    /* ── Community seed graphs ─────────────────────────────────
       All rows map to bundled `graphs/<slug>/` demos (slugs, real open). */
    (function seedDummies() {
      const seeds = [
        ['Protein Folding Pipeline',          'DeepMind',         'Bioinformatics',     'Structure Prediction', 'Sequence',    'Stable',       1200, 980,  true],
        ['Climate Storm Forecasting',         'NOAA',             'Climate',            'Forecasting',          'Multimodal',  'Stable',       540,  610,  true],
        ['Cancer Cell Classification',        'MSK',              'Oncology',           'Image Classification', 'Histology',   'Stable',       430,  720,  true],
        ['Drug-Target Interaction',           'Recursion',        'Drug Discovery',     'Network Analysis',     'Graph',       'Experimental', 280,  410,  true],
        ['Sentiment in Clinical Notes',       'Mayo Clinic',      'NLP',                'Text Classification',  'Text',        'Stable',       190,  340,  false],
        ['EEG Seizure Detection',             'Stanford Medicine','Neuroscience',       'Time Series',          'EEG',         'Stable',       220,  380,  true],
        ['Single-Cell RNA-seq',               '10x Genomics',     'Genomics',           'Clustering',           'Sequence',    'Stable',       510,  640,  true],
        ['Wildfire Spread Modeling',          'USGS',             'Climate',            'Simulation',           'Geo',         'Experimental', 130,  210,  true],
        ['Retinal Disease Screening',         'Google Health',    'Ophthalmology',      'Image Classification', 'Fundus',      'Stable',       870,  990,  false],
        ['CRISPR Off-Target Prediction',      'Broad Institute',  'Genomics',           'Sequence Analysis',    'Sequence',    'Stable',       460,  560,  true],
        ['fMRI Connectivity Atlas',           'HCP',              'Neuroscience',       'Connectomics',         'fMRI',        'Stable',       330,  470,  true],
        ['Antibody-Antigen Docking',          'Genentech',        'Drug Discovery',     'Structure Prediction', 'Protein',     'Experimental', 150,  290,  false],
        ['Speech Emotion Recognition',        'Affectiva',        'NLP',                'Audio Classification', 'Audio',       'Experimental', 90,   180,  true],
        ['Pedestrian Trajectory Forecasting', 'NVIDIA',           'Autonomous Driving', 'Trajectory Prediction','LiDAR+Vision','Stable',       620,  840,  false],
        ['Coral Bleaching Index',             'NOAA',             'Climate',            'Remote Sensing',       'Satellite',   'Stable',       200,  260,  true],
        ['Histopathology Tumor Grading',      'PathAI',           'Oncology',           'Image Classification', 'Histology',   'Stable',       380,  520,  false],
        ['Polygenic Risk Scoring',            '23andMe',          'Genomics',           'Statistical Genetics', 'Sequence',    'Stable',       410,  580,  true],
        ['Molecular Property Prediction',     'Atomwise',         'Drug Discovery',     'Graph Neural Net',     'Graph',       'Experimental', 240,  360,  true],
        ['Air Quality Forecasting',           'EPA',              'Public Health',      'Forecasting',          'Multimodal',  'Stable',       170,  230,  true],
        ['Brain Tumor Segmentation',          'UPenn',            'Neuroscience',       'Image Segmentation',   'MRI',         'Stable',       560,  720,  true],
        ['Pose Estimation for Animals',       'Harvard',          'Behavioral Science', 'Pose Estimation',      'Video',       'Experimental', 120,  200,  true],
        ['Earthquake Aftershock Prediction',  'USGS',             'Geophysics',         'Time Series',          'Seismic',     'Experimental', 80,   140,  true],
        ['Lidar Point Cloud Segmentation',    'Cruise',           'Autonomous Driving', 'Segmentation',         'LiDAR',       'Stable',       450,  610,  false],
        ['Multilingual Disease Surveillance', 'WHO',              'Public Health',      'NLP',                  'Text',        'Stable',       210,  290,  true],
        ['Cardiac MRI Function',              'Cleveland Clinic', 'Cardiology',         'Image Analysis',       'MRI',         'Stable',       300,  420,  false],
        ['Microbiome Diversity',              'JCVI',             'Bioinformatics',     'Diversity Analysis',   'Sequence',    'Stable',       180,  240,  true],
        ['Glacier Retreat Mapping',           'NASA',             'Climate',            'Remote Sensing',       'Satellite',   'Stable',       260,  340,  true],
        ['Diabetic Retinopathy Grading',      'Aravind',          'Ophthalmology',      'Image Classification', 'Fundus',      'Stable',       320,  480,  true],
        ['Synthetic Biology Pathway Design',  'Ginkgo',           'Synthetic Biology',  'Optimization',         'Graph',       'Experimental', 100,  160,  false],
        ['Plant Disease Detection',           'Plantix',          'Agriculture',        'Image Classification', 'Photo',       'Stable',       140,  220,  true]
      ];
      const palette = ['LR','MK','SP','AQ','RC','DN','YK','AM','TP','JW'];
      seeds.forEach((s, i) => {
        const [title, owner, domain, method, modality, status, stars, forks, openContrib] = s;
        const slugRow = i < BUNDLED_COMMUNITY_ROW_SLUGS.length ? BUNDLED_COMMUNITY_ROW_SLUGS[i] : '';
        GRAPHS.push({
          title, owner, shortOwner: owner, domain, modality, method,
          role: 'Public', status, license: 'MIT',
          updatedHours: 24 + i * 7,
          forks, stars, downloads: stars * 80,
          activity: 40 + (i * 3) % 50,
          openContrib, team: 'Community',
          abstract: '', starred: false,
          recentRank: 1000 + i,
          editedAgo: '', editedBy: '',
          collaborators: [palette[i % palette.length], palette[(i + 3) % palette.length], palette[(i + 7) % palette.length]],
          collaboratorExtra: (i * 2) % 30,
          dummy: false,
          ...(slugRow
            ? { slug: slugRow, variantCount: BUNDLED_COMMUNITY_ROW_VARIANT_COUNTS[i] }
            : {}),
        });
      });
    })();
    const CUSTOM_PROJECTS_KEY = 'cfg.customProjects';
    const STARRED_KEY = 'cfg.starredSlugs';
    const DELETED_KEY = 'cfg.deletedSlugs';
    const LAST_EDITED_KEY = 'cfg.lastEditedSlug';
    const CARDS_LAYOUT_KEY = 'cfg.graphCardsLayout';
    const AVATAR_COLORS = ['var(--avatar-1)', 'var(--avatar-2)', 'var(--avatar-3)', 'var(--avatar-4)', 'var(--avatar-5)', 'var(--avatar-6)'];

    const TEAM_DATA = {
      'Vector Lab': {
        graphs:['Public Health Monitoring', 'Autonomous Vehicle Navigation'],
        requests:[
          'A. Chen requested contributor access to Public Health Monitoring.',
          'N. Patel requested write access to Autonomous Vehicle Navigation.'
        ],
        opportunities:[
          'Public Health Monitoring needs review on intervention policy branch.',
          'Autonomous Vehicle Navigation has an open issue: uncertainty calibration.'
        ]
      },
      'Neuron Forge': {
        graphs:['Neurological Disease Analysis'],
        requests:['K. Yu requested permission to run private imaging benchmark set.'],
        opportunities:['Neurological Disease Analysis has 3 open tasks in segmentation QA lane.']
      },
      'Genome Guild': {
        graphs:['Human Genome Analysis'],
        requests:['R. Singh requested maintainer role for variant-ranking module.'],
        opportunities:['Human Genome Analysis seeks contributor for reproducibility docs refresh.']
      }
    };

    let activeTab = 'dashboard';
    let dashboardView = 'recent';
    let activeTeamName = Object.keys(TEAM_DATA)[0];
    let dashboardRoleFilter = '';
    let activeTopic = '';
    let communityContribFilter = '';
    let communitySort = 'relevance';
    let communityOpenPage = 0;
    const COMMUNITY_OPEN_PAGE_SIZE = 8;

    const q = (s) => document.querySelector(s);
    const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    const byTitle = new Map(GRAPHS.map(g => [g.title, g]));

    function readCustomProjects() {
      try {
        const raw = localStorage.getItem(CUSTOM_PROJECTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    /** Slugs stored in cfg.customProjects (user-created / forked); exclude from community new-graph modal. */
    function userCustomGraphSlugSet() {
      const s = new Set();
      readCustomProjects().forEach((p) => {
        if (p && p.slug) s.add(p.slug);
      });
      return s;
    }

    /** Graphs eligible for the “New graph” community browser (not the user’s own). */
    function ngGraphPool() {
      const owned = userCustomGraphSlugSet();
      return GRAPHS.filter((g) => {
        const sid = graphSlug(g);
        if (sid && owned.has(sid)) return false;
        return true;
      });
    }

    function writeCustomProjects(list) {
      try { localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(list || [])); } catch (_) {}
    }

    function readSet(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch (_) { return new Set(); }
    }
    function readJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) { return fallback; }
    }
    function writeSet(key, set) {
      try { localStorage.setItem(key, JSON.stringify([...set])); } catch (_) {}
    }
    function setStarred(slug, on) {
      const s = readSet(STARRED_KEY);
      if (on) s.add(slug); else s.delete(slug);
      writeSet(STARRED_KEY, s);
    }
    function isDeleted(slug) { return readSet(DELETED_KEY).has(slug); }
    function softDeleteGraph(slug) {
      const s = readSet(DELETED_KEY); s.add(slug); writeSet(DELETED_KEY, s);
      const customs = readCustomProjects().filter(p => p && p.slug !== slug);
      writeCustomProjects(customs);
    }

    function roleFromCustomProject(proj) {
      const contribs = (proj && proj.contributors) || [];
      const me = contribs.find((c) => c && c.name === 'You') || contribs[0];
      const raw = String(me && me.role || 'Owner').toLowerCase();
      if (raw === 'admin') return 'Admin';
      if (raw === 'contributor') return 'Contributor';
      return 'Owner';
    }

    function hydrateCustomProjects() {
      const deleted = readSet(DELETED_KEY);
      // Drop any built-ins the user soft-deleted earlier.
      for (let i = GRAPHS.length - 1; i >= 0; i--) {
        if (deleted.has(graphSlug(GRAPHS[i]))) { byTitle.delete(GRAPHS[i].title); GRAPHS.splice(i, 1); }
      }
      const starred = readSet(STARRED_KEY);
      GRAPHS.forEach(g => { const s = graphSlug(g); if (s && starred.has(s)) g.starred = true; });
      const rows = readCustomProjects();
      rows.forEach((p, idx) => {
        if (!p || !p.slug || !p.title) return;
        if (deleted.has(p.slug)) return;
        if (GRAPHS.some(g => g.slug === p.slug)) return;
        const g = {
          title: p.title,
          slug: p.slug,
          owner: 'You',
          shortOwner: 'you',
          domain: 'General',
          modality: 'Multimodal',
          method: 'Custom',
          role: roleFromCustomProject(p.project),
          status: 'Draft',
          license: 'Private',
          updatedHours: 0,
          forks: 0,
          stars: 0,
          downloads: 0,
          activity: 0,
          openContrib: false,
          team: 'Personal',
          abstract: 'Newly created graph project.',
          starred: starred.has(p.slug),
          recentRank: idx + 1,
          editedAgo: 'just now',
          editedBy: 'You',
          collaborators: ['JS'],
          collaboratorExtra: 0,
        };
        GRAPHS.unshift(g);
        byTitle.set(g.title, g);
      });
      GRAPHS.forEach((g, i) => { g.recentRank = i + 1; });
      GRAPHS.forEach((g) => {
        const s = graphSlug(g);
        if (s) g.slug = s;
      });
    }

    function graphSlug(g) {
      if (!g) return '';
      return g.slug || KNOWN_PROJECTS[g.title] || '';
    }

    function nodeCountForGraph(g) {
      const slug = graphSlug(g);
      if (!slug) return 0;
      const customs = readCustomProjects();
      const row = customs.find((r) => r && r.slug === slug);
      if (row && row.project && Array.isArray(row.project.nodes)) return row.project.nodes.length;
      const n = BUNDLED_GRAPH_COUNTS[slug];
      if (n != null) return n;
      return 0;
    }
    function variantCountForGraph(g) {
      const direct = Number(g && g.variantCount);
      if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
      const slug = graphSlug(g);
      if (!slug) return 1;
      const variants = readJSON(`cfg.variants.${slug}`, null);
      if (Array.isArray(variants) && variants.length) return variants.length;
      return 1;
    }

    function openGraph(title) {
      const row = byTitle.get(title);
      const slug = graphSlug(row);
      if (slug) window.location.href = hrefOpenBundledGraph(row);
      else alert(`Open graph: ${title}`);
    }

    function roleBadgeClass(role) {
      const v = String(role || '').toLowerCase();
      if (v === 'admin' || v === 'owner') return 'background:#0f172a;color:#fff;';
      if (v === 'contributor') return 'background:#d97706;color:#fff;';
      return 'background:#64748b;color:#fff;';
    }

    function roleBadgeToken(role) {
      const v = String(role || '').toLowerCase();
      if (v === 'admin' || v === 'owner') return 'role-admin';
      if (v === 'contributor') return 'role-contrib';
      if (v === 'public') return 'role-public';
      return 'role-view';
    }

    function updateTeamDataGraphTitles(oldTitle, newTitle) {
      if (!oldTitle || oldTitle === newTitle) return;
      Object.keys(TEAM_DATA).forEach((team) => {
        const d = TEAM_DATA[team];
        d.graphs = d.graphs.map((t) => (t === oldTitle ? newTitle : t));
        d.requests = d.requests.map((s) => String(s || '').split(oldTitle).join(newTitle));
        d.opportunities = d.opportunities.map((s) => String(s || '').split(oldTitle).join(newTitle));
      });
    }

    function uniqueRenamedTitle(raw, originalTitle) {
      const base = (raw || '').trim() || originalTitle;
      if (base === originalTitle) return originalTitle;
      const customs = readCustomProjects();
      const taken = new Set([
        ...GRAPHS.map((x) => x.title),
        ...customs.map((r) => r && r.title).filter(Boolean),
      ]);
      taken.delete(originalTitle);
      if (!taken.has(base)) return base;
      let n = 2;
      while (taken.has(`${base} (${n})`)) n++;
      return `${base} (${n})`;
    }

    function commitGraphRename(g, oldTitle, newTitle) {
      if (!g || newTitle === oldTitle) return;
      const slug = g.slug || graphSlug(g);
      if (slug && !g.slug) g.slug = slug;
      byTitle.delete(oldTitle);
      g.title = newTitle;
      byTitle.set(newTitle, g);
      updateTeamDataGraphTitles(oldTitle, newTitle);
      if (slug) {
        const customs = readCustomProjects();
        const idx = customs.findIndex((r) => r && r.slug === slug);
        if (idx >= 0) {
          const row = customs[idx];
          customs[idx] = Object.assign({}, row, {
            title: newTitle,
            project: Object.assign({}, row.project || {}, { title: newTitle }),
          });
          writeCustomProjects(customs);
        }
      }
      rerenderAll();
    }

    function startHubTitleEdit(nameEl, g, originalTitle) {
      nameEl.title = '';
      nameEl.setAttribute('contenteditable', 'true');
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      const cleanup = () => {
        nameEl.removeEventListener('blur', commit);
        nameEl.removeEventListener('keydown', onKey);
        nameEl.removeAttribute('contenteditable');
        nameEl.title = 'Click to rename graph';
      };
      const commit = () => {
        cleanup();
        const raw = (nameEl.textContent || '').trim();
        const next = uniqueRenamedTitle(raw, originalTitle);
        if (next === originalTitle) {
          if (nameEl.isConnected) nameEl.textContent = originalTitle;
          return;
        }
        commitGraphRename(g, originalTitle, next);
      };
      const onKey = (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); nameEl.blur(); }
        if (ke.key === 'Escape') { ke.preventDefault(); nameEl.textContent = originalTitle; nameEl.blur(); }
      };
      nameEl.addEventListener('blur', commit);
      nameEl.addEventListener('keydown', onKey);
    }

    function initGraphTitleRename() {
      function onCaptureClick(e) {
        const el = e.target instanceof Element ? e.target : e.target.parentElement;
        const titleEl = el && el.closest ? el.closest('.graph-title--editable') : null;
        if (!titleEl || titleEl.isContentEditable) return;
        const card = titleEl.closest('.graph-card');
        if (!card) return;
        e.preventDefault();
        e.stopPropagation();
        const oldTitle = (titleEl.textContent || '').trim();
        const g = byTitle.get(oldTitle);
        if (!g) return;
        startHubTitleEdit(titleEl, g, oldTitle);
      }
      /* communityTrending uses readOnlyTitle — no inline rename on public cards */
      ['dashboardCards', 'teamGraphs'].forEach((id) => {
        const root = document.getElementById(id);
        if (!root || root._graphTitleRenameBound) return;
        root._graphTitleRenameBound = true;
        root.addEventListener('click', onCaptureClick, true);
      });
    }

    function graphVizFor(title) {
      if (title === 'Public Health Monitoring') return `
        <svg class="graph-viz" viewBox="0 0 280 120" preserveAspectRatio="xMidYMid meet">
          <g stroke="#94a3b8" stroke-width="1" fill="none"><path d="M40 30 L90 30"/><path d="M90 30 L150 60"/><path d="M150 60 L210 35"/><path d="M150 60 L210 85"/><path d="M90 30 L40 75"/></g>
          <g><rect x="20" y="22" width="40" height="16" rx="3" fill="#dbeafe" stroke="#60a5fa"/><rect x="70" y="22" width="40" height="16" rx="3" fill="#fef3c7" stroke="#fbbf24"/><rect x="130" y="52" width="40" height="16" rx="3" fill="#dcfce7" stroke="#4ade80"/><rect x="190" y="27" width="40" height="16" rx="3" fill="#ede9fe" stroke="#a78bfa"/><rect x="190" y="77" width="40" height="16" rx="3" fill="#fce7f3" stroke="#f472b6"/><rect x="20" y="67" width="40" height="16" rx="3" fill="#e0e7ff" stroke="#818cf8"/></g>
        </svg>`;
      if (title === 'Neurological Disease Analysis') return `
        <svg class="graph-viz" viewBox="0 0 280 120" preserveAspectRatio="xMidYMid meet">
          <g stroke="#94a3b8" stroke-width="1" fill="none"><path d="M40 30 L100 60"/><path d="M100 60 L160 30"/><path d="M160 30 L220 60"/><path d="M100 60 L160 90"/><path d="M220 60 L160 90"/></g>
          <g><rect x="20" y="22" width="40" height="16" rx="3" fill="#fce7f3" stroke="#f472b6"/><rect x="80" y="52" width="40" height="16" rx="3" fill="#dbeafe" stroke="#60a5fa"/><rect x="140" y="22" width="40" height="16" rx="3" fill="#dcfce7" stroke="#4ade80"/><rect x="200" y="52" width="40" height="16" rx="3" fill="#ede9fe" stroke="#a78bfa"/><rect x="140" y="82" width="40" height="16" rx="3" fill="#fef3c7" stroke="#fbbf24"/></g>
        </svg>`;
      if (title === 'Autonomous Vehicle Navigation') return `
        <svg class="graph-viz" viewBox="0 0 280 120" preserveAspectRatio="xMidYMid meet">
          <g stroke="#94a3b8" stroke-width="1" fill="none"><path d="M35 40 L95 25"/><path d="M95 25 L155 55"/><path d="M95 25 L95 80"/><path d="M155 55 L215 30"/><path d="M155 55 L215 80"/><path d="M95 80 L155 55"/></g>
          <g><rect x="15" y="32" width="40" height="16" rx="3" fill="#dcfce7" stroke="#4ade80"/><rect x="75" y="17" width="40" height="16" rx="3" fill="#dbeafe" stroke="#60a5fa"/><rect x="75" y="72" width="40" height="16" rx="3" fill="#ede9fe" stroke="#a78bfa"/><rect x="135" y="47" width="40" height="16" rx="3" fill="#fef3c7" stroke="#fbbf24"/><rect x="195" y="22" width="40" height="16" rx="3" fill="#fce7f3" stroke="#f472b6"/><rect x="195" y="72" width="40" height="16" rx="3" fill="#e0e7ff" stroke="#818cf8"/></g>
        </svg>`;
      return `
        <svg class="graph-viz" viewBox="0 0 280 120" preserveAspectRatio="xMidYMid meet">
          <g stroke="#94a3b8" stroke-width="1" fill="none"><path d="M40 35 L100 35"/><path d="M100 35 L160 65"/><path d="M160 65 L220 35"/><path d="M160 65 L220 90"/></g>
          <g><rect x="20" y="27" width="40" height="16" rx="3" fill="#dbeafe" stroke="#60a5fa"/><rect x="80" y="27" width="40" height="16" rx="3" fill="#dcfce7" stroke="#4ade80"/><rect x="140" y="57" width="40" height="16" rx="3" fill="#fef3c7" stroke="#fbbf24"/><rect x="200" y="27" width="40" height="16" rx="3" fill="#ede9fe" stroke="#a78bfa"/><rect x="200" y="82" width="40" height="16" rx="3" fill="#fce7f3" stroke="#f472b6"/></g>
        </svg>`;
    }

    function renderCard(g, opts = {}) {
      const showManageActions = opts.showManageActions !== false;
      const showCommunityActions = !!opts.showCommunityActions;
      const hideFooter = !!opts.hideFooter;
      const readOnlyTitle = !!opts.readOnlyTitle;
      const slug = graphSlug(g);
      const nNodes = nodeCountForGraph(g);
      const slugAttr = slug ? ` data-graph-slug="${esc(slug)}"` : '';
      const dummyAttr = g.dummy ? ' data-dummy="1"' : '';
      const titleClass = (g.dummy || readOnlyTitle) ? 'graph-title' : 'graph-title graph-title--editable';
      const titleAttr = (g.dummy || readOnlyTitle) ? '' : ' title="Click to rename graph"';
      const avatars = (g.collaborators || []).slice(0, 3).map((ini, i) =>
        `<span class="mini" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]};">${esc(ini)}</span>`
      ).join('');
      const extra = Number(g.collaboratorExtra || 0);
      const manageActions = showManageActions ? `
            <button class="card-icon-btn" type="button" data-action="duplicate" data-title="${esc(g.title)}" title="Duplicate graph" aria-label="Duplicate graph">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
            </button>
            <button class="card-icon-btn danger" type="button" data-action="delete" data-title="${esc(g.title)}" title="Delete graph" aria-label="Delete graph">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>` : '';
      const communityActions = showCommunityActions ? `
            <button class="card-icon-btn" type="button" data-action="preview-inline" data-title="${esc(g.title)}" title="Preview graph" aria-label="Preview graph">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="card-icon-btn" type="button" data-action="fork-inline" data-title="${esc(g.title)}" title="Fork graph" aria-label="Fork graph">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v4a2 2 0 0 0 2 2h6"/><path d="M18 10v2"/></svg>
            </button>` : '';
      const variantCount = variantCountForGraph(g);
      const footerHtml = hideFooter ? '' : `
        <div class="card-footer">
          <span class="push-meta">Last edited <strong>${esc(g.editedAgo || 'recently')}</strong></span>
          <div class="avatar-stack">${avatars}${extra > 0 ? `<span class="more">+${extra}</span>` : ''}</div>
        </div>`;
      return `<article class="graph-card"${slugAttr}${dummyAttr}>
        <div class="graph-thumb">
          <span class="role-badge ${roleBadgeToken(g.role)}">${esc(g.role)}</span>
          ${graphVizFor(g.title)}
        </div>
        <div class="graph-head">
          <div>
            <div class="${titleClass}"${titleAttr}>${esc(g.title)}</div>
            <div class="graph-meta">${esc(g.shortOwner || g.owner)}</div>
          </div>
          <div class="card-actions">
            <button class="card-icon-btn star-btn ${g.starred ? 'active' : ''}" type="button" data-action="star" data-title="${esc(g.title)}" title="Star graph" aria-label="Star graph">
              <svg viewBox="0 0 24 24" fill="${g.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>
            </button>
            ${communityActions}
            ${manageActions}
          </div>
        </div>
        <div class="chip-row">
          <span class="chip">${esc(g.domain)}</span>
          <span class="chip">${esc(g.method)}</span>
          <span class="chip chip-nodes" title="Nodes on canvas">${nNodes} ${nNodes === 1 ? 'node' : 'nodes'}</span>
          ${variantCount > 1 ? `<span class="chip chip-variants" title="Number of variants">${variantCount} variants</span>` : ''}
        </div>
        <div class="stats">
          <span>★ ${g.stars}</span>
          <span>↯ ${g.forks}</span>
          <span>↓ ${g.downloads > 0 ? `${Math.round(g.downloads / 1000)}k` : '—'}</span>
        </div>
        ${footerHtml}
      </article>`;
    }

    function filteredCommunity() {
      const search = q('#searchInput').value.trim().toLowerCase();
      const contrib = communityContribFilter;
      const sort = communitySort;

      let rows = GRAPHS.filter(g => {
        if (activeTopic && ![g.domain, g.method, g.modality].includes(activeTopic)) return false;
        if (contrib === 'open' && !g.openContrib) return false;
        if (contrib === 'restricted' && g.openContrib) return false;
        if (search) {
          const hay = `${g.title} ${g.owner} ${g.domain} ${g.method} ${g.abstract}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

      rows.sort((a, b) => {
        if (sort === 'updated') return a.updatedHours - b.updatedHours;
        if (sort === 'forks') return b.forks - a.forks;
        if (sort === 'activity') return b.activity - a.activity;
        const score = (g) => (g.reproducible ? 10 : 0) + (g.openContrib ? 8 : 0) + g.activity + g.forks * 0.2;
        return score(b) - score(a);
      });
      return rows;
    }

    function renderCommunity() {
      const rows = filteredCommunity();
      q('#communityCount').textContent = `${rows.length} public graphs`;
      const trending = [...rows].sort((a,b) => (b.stars + b.forks * 1.5) - (a.stars + a.forks * 1.5)).slice(0, 8);
      const open = rows.filter(g => g.openContrib);
      const openHost = q('#communityOpenList');
      const pager = q('#communityOpenPager');
      const prevBtn = q('#communityOpenPrev');
      const nextBtn = q('#communityOpenNext');
      const pageLabel = q('#communityOpenPageLabel');
      q('#communityTrending').innerHTML = trending
        .map(g => renderCard({ ...g, role: 'Public', shortOwner: `${g.owner}` }, { showManageActions: false, showCommunityActions: true, readOnlyTitle: true }))
        .join('') || '<div class="panel">No matching community graphs.</div>';
      if (openHost) openHost.classList.toggle('open-chart--empty', !open.length);
      if (!open.length) {
        if (openHost) openHost.innerHTML = '<div class="panel">No open-contribution graphs.</div>';
        if (pager) pager.hidden = true;
        return;
      }
      const totalPages = Math.max(1, Math.ceil(open.length / COMMUNITY_OPEN_PAGE_SIZE));
      if (communityOpenPage > totalPages - 1) communityOpenPage = totalPages - 1;
      const start = communityOpenPage * COMMUNITY_OPEN_PAGE_SIZE;
      const openPageRows = open.slice(start, start + COMMUNITY_OPEN_PAGE_SIZE);
      if (pager) pager.hidden = totalPages <= 1;
      if (prevBtn) prevBtn.disabled = communityOpenPage <= 0;
      if (nextBtn) nextBtn.disabled = communityOpenPage >= totalPages - 1;
      if (pageLabel) pageLabel.textContent = `${communityOpenPage + 1} / ${totalPages}`;
      q('#communityOpenList').innerHTML = openPageRows.map((g, idx) => {
        const s = graphSlug(g);
        const sAttr = s ? ` data-graph-slug="${esc(s)}"` : '';
        return `
        <article class="open-item"${sAttr}>
          <div>
            <div class="title">${esc(g.title)}</div>
            <div class="meta">${esc(g.owner)} · ${esc(g.domain)} · ${esc(g.method)} · ${esc(g.status)}</div>
            <div class="signals">★ ${g.stars} · ↯ ${g.forks} · Updated ${g.updatedHours}h ago</div>
          </div>
          <button class="card-icon-btn star-btn ${g.starred ? 'active' : ''}" type="button" data-action="star" data-title="${esc(g.title)}" title="Star graph" aria-label="Star graph">
            <svg viewBox="0 0 24 24" fill="${g.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>
          </button>
        </article>${idx < openPageRows.length - 1 ? '<div class="open-sep"></div>' : ''}`;
      }).join('') || '<div class="panel">No open-contribution graphs.</div>';
    }

    function hasMyGraphAccess(g) {
      const r = String(g && g.role || '').toLowerCase();
      return r === 'contributor' || r === 'admin' || r === 'owner';
    }

    function renderDashboard() {
      const role = dashboardRoleFilter;
      let rows = GRAPHS.filter(g => !g.dummy && hasMyGraphAccess(g));
      if (dashboardView === 'starred') rows = rows.filter(g => g.starred);
      if (role) rows = rows.filter(g => g.role === role);
      if (dashboardView === 'recent') rows.sort((a, b) => a.recentRank - b.recentRank);
      else if (dashboardView === 'all') rows.sort((a, b) => a.title.localeCompare(b.title));
      else rows.sort((a, b) => a.recentRank - b.recentRank);

      q('#dashboardCards').innerHTML = rows.map(renderCard).join('') || '<div class="panel">No graphs match this filter.</div>';
    }

    function initTopicPills() {
      const topics = [
        ['Neuroscience', 'icons/categories/neuroscience.svg'],
        ['Genomics', 'icons/categories/genomics.svg'],
        ['Autonomous Driving', 'icons/categories/autonomous-driving.svg'],
        ['NLP', 'icons/categories/nlp.svg'],
        ['Drug Discovery', 'icons/categories/drug-discovery.svg'],
        ['Climate', 'icons/categories/climate.svg'],
        ['Bioinformatics', 'icons/categories/bioinformatics.svg'],
        ['Public Health', 'icons/categories/public-health.svg'],
        ['Oncology', 'icons/categories/oncology.svg'],
        ['Ophthalmology', 'icons/categories/ophthalmology.svg'],
        ['Cardiology', 'icons/categories/cardiology.svg'],
        ['Synthetic Biology', 'icons/categories/synthetic-biology.svg'],
        ['Behavioral Science', 'icons/categories/behavioral-science.svg'],
        ['Agriculture', 'icons/categories/agriculture.svg'],
        ['Geophysics', 'icons/categories/geophysics.svg'],
      ];
      const host = q('#topicPills');
      topics.forEach(([topic, icon]) => host.insertAdjacentHTML('beforeend', `<button class="topic-pill" type="button" data-topic="${esc(topic)}"><img class="topic-pill-icon" src="${esc(icon)}" alt="" aria-hidden="true" /><span>${esc(topic)}</span></button>`));
      host.querySelectorAll('.topic-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          host.querySelectorAll('.topic-pill').forEach(x => x.classList.remove('active'));
          btn.classList.add('active');
          activeTopic = btn.dataset.topic || '';
          communityOpenPage = 0;
          renderCommunity();
        });
      });
      const rail = q('#topicRail');
      const prev = q('#topicRailPrev');
      const next = q('#topicRailNext');
      const fadeLeft = q('#topicRailFadeLeft');
      const fadeRight = q('#topicRailFadeRight');
      if (!rail || !prev || !next || !fadeLeft || !fadeRight) return;
      const syncRail = () => {
        const max = Math.max(0, host.scrollWidth - host.clientWidth);
        const x = host.scrollLeft;
        const canLeft = x > 2;
        const canRight = x < max - 2;
        prev.hidden = !canLeft;
        next.hidden = !canRight;
        fadeLeft.hidden = !canLeft;
        fadeRight.hidden = !canRight;
      };
      prev.addEventListener('click', () => {
        host.scrollBy({ left: -260, behavior: 'smooth' });
      });
      next.addEventListener('click', () => {
        host.scrollBy({ left: 260, behavior: 'smooth' });
      });
      host.addEventListener('scroll', syncRail, { passive: true });
      window.addEventListener('resize', syncRail);
      requestAnimationFrame(syncRail);
    }

    function renderTeam(teamName) {
      const data = TEAM_DATA[teamName];
      if (!data) return;
      q('#teamGraphs').innerHTML = data.graphs
        .map(name => byTitle.get(name)).filter(Boolean).map(renderCard).join('');
    }

    function switchTab(tab) {
      activeTab = tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      q(`#tab-${tab}`)?.classList.add('active');
      document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
      q('#pageTitle').textContent = TAB_META[tab].title;
      q('#pageDesc').textContent = TAB_META[tab].desc;
      if (tab === 'dashboard') requestAnimationFrame(() => syncDashboardSwitcherWidths());
    }

    function initFilters() {
      q('#searchInput')?.addEventListener('input', () => {
        communityOpenPage = 0;
        renderCommunity();
      });
    }

    function syncCommunityMenuUi() {
      const contribLabel = q('#communityContribLabel');
      const sortLabel = q('#communitySortLabel');
      if (contribLabel) {
        contribLabel.textContent = communityContribFilter === 'open'
          ? 'Open to contributions'
          : communityContribFilter === 'restricted'
            ? 'Restricted'
            : 'Filter';
      }
      if (sortLabel) {
        sortLabel.textContent = communitySort === 'updated'
          ? 'Recently updated'
          : communitySort === 'forks'
            ? 'Most forked'
            : communitySort === 'activity'
              ? 'Most active'
              : 'Sort';
      }
      q('#communityContribPop')?.querySelectorAll('.role-filter-item').forEach((item) => {
        item.classList.toggle('active', (item.dataset.value || '') === communityContribFilter);
      });
      q('#communitySortPop')?.querySelectorAll('.role-filter-item').forEach((item) => {
        item.classList.toggle('active', (item.dataset.value || 'relevance') === communitySort);
      });
    }

    function initCommunityMenu(btn, pop, onSelect) {
      if (!btn || !pop) return;
      const close = () => {
        pop.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDoc, true);
        document.removeEventListener('keydown', onKey);
      };
      const open = () => {
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        setTimeout(() => {
          document.addEventListener('mousedown', onDoc, true);
          document.addEventListener('keydown', onKey);
        }, 0);
      };
      const onDoc = (e) => {
        if (btn.contains(e.target) || pop.contains(e.target)) return;
        close();
      };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (pop.hidden) open(); else close();
      });
      pop.addEventListener('click', (e) => {
        const item = e.target.closest('.role-filter-item');
        if (!item) return;
        onSelect(item.dataset.value || '');
        close();
      });
    }

    function initCommunityControls() {
      initCommunityMenu(q('#communityContribBtn'), q('#communityContribPop'), (value) => {
        communityContribFilter = value;
        communityOpenPage = 0;
        syncCommunityMenuUi();
        renderCommunity();
      });
      initCommunityMenu(q('#communitySortBtn'), q('#communitySortPop'), (value) => {
        communitySort = value || 'relevance';
        communityOpenPage = 0;
        syncCommunityMenuUi();
        renderCommunity();
      });
      q('#communityOpenPrev')?.addEventListener('click', () => {
        if (communityOpenPage <= 0) return;
        communityOpenPage -= 1;
        renderCommunity();
      });
      q('#communityOpenNext')?.addEventListener('click', () => {
        communityOpenPage += 1;
        renderCommunity();
      });
      syncCommunityMenuUi();
    }

    function syncTeamSelectUi() {
      const label = q('#teamSelectLabel');
      const btn = q('#teamSelectBtn');
      const pop = q('#teamSelectPop');
      if (label) label.textContent = activeTeamName;
      if (btn) btn.setAttribute('aria-label', `Team workspace: ${activeTeamName}`);
      pop?.querySelectorAll('[data-team]').forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-team') === activeTeamName);
      });
    }

    function initTeamSelector() {
      const btn = q('#teamSelectBtn');
      const pop = q('#teamSelectPop');
      if (!btn || !pop) return;
      const names = Object.keys(TEAM_DATA);
      pop.innerHTML = names
        .map((name) => `<button type="button" class="role-filter-item" data-team="${esc(name)}" role="menuitem">${esc(name)}</button>`)
        .join('');
      activeTeamName = names.includes(activeTeamName) ? activeTeamName : names[0];

      const close = () => {
        pop.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDoc, true);
        document.removeEventListener('keydown', onKey);
      };
      const open = () => {
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        setTimeout(() => {
          document.addEventListener('mousedown', onDoc, true);
          document.addEventListener('keydown', onKey);
        }, 0);
      };
      const onDoc = (e) => {
        if (btn.contains(e.target) || pop.contains(e.target)) return;
        close();
      };
      const onKey = (e) => { if (e.key === 'Escape') close(); };

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (pop.hidden) open(); else close();
      });
      pop.addEventListener('click', (e) => {
        const item = e.target.closest('[data-team]');
        if (!item) return;
        activeTeamName = item.getAttribute('data-team') || names[0];
        syncTeamSelectUi();
        renderTeam(activeTeamName);
        close();
      });
      syncTeamSelectUi();
      renderTeam(activeTeamName);
    }

    function syncDashboardSwitcherWidths() {
      /* ng-pill tab row: natural widths */
    }

    function initDashboardControls() {
      q('#dashboardSwitcher')?.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const root = q('#dashboardSwitcher');
          root?.querySelectorAll('button').forEach((b) => {
            b.classList.toggle('active', b === btn);
            b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
          });
          dashboardView = btn.dataset.view;
          renderDashboard();
        });
      });
      initDashboardRoleMenu();
      syncDashboardSwitcherWidths();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => syncDashboardSwitcherWidths());
      let resizeT;
      window.addEventListener('resize', () => {
        clearTimeout(resizeT);
        resizeT = setTimeout(() => syncDashboardSwitcherWidths(), 120);
      });
    }

    function roleFilterLabelText(role) {
      if (!role) return 'All roles';
      return role;
    }

    function syncDashboardRoleFilterUi() {
      const label = q('#roleFilterLabel');
      const btn = q('#roleFilterBtn');
      if (label) label.textContent = roleFilterLabelText(dashboardRoleFilter);
      if (btn) {
        btn.setAttribute('aria-label', dashboardRoleFilter ? `Role: ${dashboardRoleFilter}` : 'Filter by role');
      }
      q('#roleFilterPop')?.querySelectorAll('.role-filter-item').forEach((item) => {
        item.classList.toggle('active', (item.dataset.role || '') === dashboardRoleFilter);
      });
    }

    function setDashboardRoleFilter(role) {
      dashboardRoleFilter = role || '';
      syncDashboardRoleFilterUi();
      renderDashboard();
    }

    function initDashboardRoleMenu() {
      const btn = q('#roleFilterBtn');
      const pop = q('#roleFilterPop');
      if (!btn || !pop) return;
      const close = () => {
        pop.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onDoc, true);
        document.removeEventListener('keydown', onKey);
      };
      const open = () => {
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        setTimeout(() => {
          document.addEventListener('mousedown', onDoc, true);
          document.addEventListener('keydown', onKey);
        }, 0);
      };
      const onDoc = (e) => {
        if (btn.contains(e.target) || pop.contains(e.target)) return;
        close();
      };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (pop.hidden) open(); else close();
      });
      pop.addEventListener('click', (e) => {
        const item = e.target.closest('.role-filter-item');
        if (!item) return;
        setDashboardRoleFilter(item.dataset.role || '');
        close();
      });
      syncDashboardRoleFilterUi();
    }

    function readCardsLayout() {
      try { return localStorage.getItem(CARDS_LAYOUT_KEY) === 'list' ? 'list' : 'grid'; } catch (_) { return 'grid'; }
    }
    function applyCardsLayout(mode) {
      const list = mode === 'list';
      document.body.classList.toggle('graph-cards--list', list);
      document.querySelectorAll('.cards-view-btn').forEach((btn) => {
        const on = btn.dataset.layout === mode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function setCardsLayout(mode) {
      const next = mode === 'list' ? 'list' : 'grid';
      try { localStorage.setItem(CARDS_LAYOUT_KEY, next); } catch (_) {}
      applyCardsLayout(next);
    }
    function initCardsLayoutToggle() {
      applyCardsLayout(readCardsLayout());
      document.querySelectorAll('.cards-view-toggle').forEach((group) => {
        group.addEventListener('click', (e) => {
          const btn = e.target.closest('.cards-view-btn');
          if (!btn || !btn.dataset.layout) return;
          setCardsLayout(btn.dataset.layout);
        });
      });
    }

    function duplicateGraph(title) {
      const src = byTitle.get(title);
      if (!src) return;
      const slug = `copy-${(src.slug || src.title).toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${Date.now().toString(36)}`;
      const customs = readCustomProjects();
      let newTitle = `${src.title} (copy)`;
      const taken = new Set([...GRAPHS.map(g => g.title), ...customs.map(r => r && r.title).filter(Boolean)]);
      let n = 2;
      while (taken.has(newTitle)) newTitle = `${src.title} (copy ${n++})`;
      customs.unshift({
        slug, title: newTitle, createdAt: Date.now(),
        project: { slug, title: newTitle, org: 'Personal Workspace', tags: ['Draft','Custom'],
          description: `Duplicated from ${src.title}.`,
          contributors: [{ name:'You', role:'Owner', letter:'JS', bg:'var(--avatar-5)', pushes:0 }],
          contributorCount: 1, othersCount: 0, othersPreview: '', others: [],
          nodes: [], connections: [], subgraphs: [],
          canvasWidth: 2400, canvasHeight: 1600, viewZoom: 0.52 }
      });
      writeCustomProjects(customs);
      const g = { ...src, slug, title: newTitle, owner: 'You', shortOwner: 'you',
        role: 'Owner', team: 'Personal', starred: false, recentRank: 0, editedAgo: 'just now', editedBy: 'You' };
      GRAPHS.unshift(g);
      byTitle.set(g.title, g);
      GRAPHS.forEach((row, i) => { row.recentRank = i + 1; });
      rerenderAll();
    }

    function performGraphDelete(title) {
      const g = byTitle.get(title);
      if (!g) return;
      const slug = graphSlug(g);
      if (slug) softDeleteGraph(slug);
      byTitle.delete(title);
      const idx = GRAPHS.indexOf(g);
      if (idx >= 0) GRAPHS.splice(idx, 1);
      rerenderAll();
    }

    function startGraphDeleteConfirm(title, anchorEl) {
      const g = byTitle.get(title);
      if (!g || !anchorEl) return;
      const existing = document.querySelector('.variant-confirm-pop');
      if (existing) {
        const same = existing.dataset.deleteTitle === title;
        existing.remove();
        document.querySelectorAll('.card-icon-btn.danger.confirming').forEach((el) => el.classList.remove('confirming'));
        if (same) return;
      }
      anchorEl.classList.add('confirming');
      const pop = document.createElement('div');
      pop.className = 'variant-confirm-pop graph-delete-confirm-pop';
      pop.dataset.deleteTitle = title;
      pop.innerHTML = `
    <div class="pop-msg">Delete <strong>${esc(g.title)}?</strong> </div>
    <div class="pop-actions">
      <button type="button" class="pop-no">Cancel</button>
      <button type="button" class="pop-yes">Delete</button>
    </div>`;
      document.body.appendChild(pop);
      pop.style.position = 'fixed';
      pop.style.zIndex = '80';
      const r = anchorEl.getBoundingClientRect();
      const popW = pop.offsetWidth;
      let left = r.left;
      left = Math.min(Math.max(left, 8), window.innerWidth - popW - 8);
      const anchorCx = r.left + r.width / 2;
      const tailLeft = Math.min(Math.max(anchorCx - left - 9, 10), popW - 18);
      pop.style.setProperty('--pop-tail-left', `${tailLeft}px`);
      pop.style.left = `${left}px`;
      pop.style.top = `${r.bottom + 11}px`;

      const cleanup = () => {
        pop.remove();
        anchorEl.classList.remove('confirming');
        document.removeEventListener('mousedown', onDoc, true);
        document.removeEventListener('keydown', onKey);
      };
      const onDoc = (e) => {
        if (pop.contains(e.target) || anchorEl.contains(e.target)) return;
        cleanup();
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
        if (e.key === 'Enter') { e.preventDefault(); cleanup(); performGraphDelete(title); }
      };
      pop.querySelector('.pop-yes').addEventListener('click', () => { cleanup(); performGraphDelete(title); });
      pop.querySelector('.pop-no').addEventListener('click', cleanup);
      setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
      document.addEventListener('keydown', onKey);
    }

    function rerenderAll() {
      renderDashboard();
      renderCommunity();
      if (activeTeamName && TEAM_DATA[activeTeamName]) renderTeam(activeTeamName);
      const ngModal = document.getElementById('newGraphModal');
      if (ngModal && !ngModal.hidden) renderNgGrid();
    }

    function initGraphCardNavigation() {
      function onClick(e) {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          e.stopPropagation();
          e.preventDefault();
          const title = actionBtn.getAttribute('data-title');
          const action = actionBtn.getAttribute('data-action');
          if (action === 'star') {
            const g = byTitle.get(title); if (!g) return;
            g.starred = !g.starred;
            const slug = graphSlug(g); if (slug) setStarred(slug, g.starred);
            rerenderAll();
          } else if (action === 'preview-inline') {
            const g = byTitle.get(title); if (!g) return;
            const slug = graphSlug(g); if (!slug) return;
            window.location.href = `view-mode-new.html?project=${encodeURIComponent(slug)}`;
          } else if (action === 'fork-inline') {
            const g = byTitle.get(title); if (!g) return;
            forkGraph(g);
          } else if (action === 'duplicate') {
            duplicateGraph(title);
          } else if (action === 'delete') {
            startGraphDeleteConfirm(title, actionBtn);
          }
          return;
        }
        const card = e.target.closest('.graph-card[data-graph-slug], .open-item[data-graph-slug]');
        if (!card) return;
        if (card.dataset.dummy === '1') return;
        const slug = card.getAttribute('data-graph-slug');
        if (!slug) return;
        const g = GRAPHS.find((x) => graphSlug(x) === slug);
        const fromNgModal = !!card.closest('#ngGrid');
        if (fromNgModal) {
          window.location.href = `view-mode-new.html?project=${encodeURIComponent(slug)}`;
          return;
        }
        try { localStorage.setItem(LAST_EDITED_KEY, slug); } catch (_) {}
        window.location.href = g ? hrefOpenBundledGraph(g) : `editing-mode-new.html?project=${encodeURIComponent(slug)}`;
      }
      ['dashboardCards', 'communityTrending', 'teamGraphs', 'communityOpenList', 'ngGrid'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el._graphNavBound) {
          el._graphNavBound = true;
          el.addEventListener('click', onClick);
        }
      });
    }

    function initEditNavLink() {
      const link = document.getElementById('navEditLink');
      if (!link) return;
      const lastSlug = (() => { try { return localStorage.getItem(LAST_EDITED_KEY); } catch (_) { return null; } })();
      const targetSlug = (lastSlug && GRAPHS.some(g => graphSlug(g) === lastSlug)) ? lastSlug
        : graphSlug(GRAPHS[0]);
      const row = targetSlug ? GRAPHS.find((g) => graphSlug(g) === targetSlug) : GRAPHS[0];
      if (row) link.href = hrefOpenBundledGraph(row);
    }

    function uniqueTitle(base) {
      const existing = readCustomProjects();
      const taken = new Set([...GRAPHS.map(g => g.title), ...existing.map(r => r && r.title).filter(Boolean)]);
      let title = base;
      let n = 2;
      while (taken.has(title)) title = `${base} (${n++})`;
      return title;
    }

    function createBlankGraph() {
      const slug = `new-graph-${Date.now().toString(36)}`;
      const existing = readCustomProjects();
      const title = uniqueTitle('New Graph');
      existing.unshift({
        slug,
        title,
        createdAt: Date.now(),
        project: {
          slug,
          title,
          org: 'Personal Workspace',
          tags: ['Draft', 'Custom'],
          description: 'New graph project.',
          contributors: [{ name: 'You', role: 'Owner', letter: 'JS', bg: 'var(--avatar-5)', pushes: 0 }],
          contributorCount: 1,
          othersCount: 0,
          othersPreview: '',
          others: [],
          nodes: [],
          connections: [],
          subgraphs: [],
          canvasWidth: 2400,
          canvasHeight: 1600,
          viewZoom: 0.52
        }
      });
      writeCustomProjects(existing);
      window.location.href = `editing-mode-new.html?project=${encodeURIComponent(slug)}`;
    }

    let forkPendingGraph = null;

    function openForkConfirmModal(g) {
      if (!g || !window.ConnectifyFork) return;
      const backdrop = document.getElementById('forkConfirmModal');
      const bodyEl = document.getElementById('forkConfirmBody');
      if (!backdrop || !bodyEl) return;
      forkPendingGraph = g;
      const t = (g.title || 'this graph').trim() || 'this graph';
      bodyEl.textContent =
        `Create your own copy of "${t}" with its variants, paths, and experiments? `;
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      try {
        document.body.style.overflow = 'hidden';
      } catch (_) {}
    }

    function closeForkConfirmModal() {
      const backdrop = document.getElementById('forkConfirmModal');
      forkPendingGraph = null;
      if (backdrop) {
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
      }
      try {
        document.body.style.overflow = '';
      } catch (_) {}
    }

    function initForkConfirmModal() {
      const backdrop = document.getElementById('forkConfirmModal');
      if (!backdrop || backdrop.dataset.bound === '1') return;
      backdrop.dataset.bound = '1';
      const onClose = () => closeForkConfirmModal();
      document.getElementById('forkConfirmClose')?.addEventListener('click', onClose);
      document.getElementById('forkConfirmCancel')?.addEventListener('click', onClose);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) onClose();
      });
      document.getElementById('forkConfirmOk')?.addEventListener('click', () => {
        const g = forkPendingGraph;
        if (!g || !window.ConnectifyFork) {
          onClose();
          return;
        }
        const sourceSlug = graphSlug(g);
        if (!sourceSlug) {
          onClose();
          return;
        }
        const meta = {
          title: g.title,
          owner: g.owner,
          domain: g.domain,
          method: g.method,
          abstract: g.abstract || '',
        };
        forkPendingGraph = null;
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
        try {
          document.body.style.overflow = '';
        } catch (_) {}
        window.ConnectifyFork.forkProjectToMyGraphs(sourceSlug, meta).catch(() => {
          alert('Could not fork this graph. Try again from a stable network connection.');
        });
      });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!backdrop.classList.contains('is-open')) return;
        e.preventDefault();
        onClose();
      });
    }

    function forkGraph(g) {
      openForkConfirmModal(g);
    }

    /* ── New-graph modal ───────────────────────────────────── */
    const NG_STATUS_FILTERS = [
      { id: 'all',         label: 'All' },
      { id: 'open',        label: 'Open to contributions' },
      { id: 'stable',      label: 'Stable' },
      { id: 'experimental',label: 'Experimental' },
      { id: 'recent',      label: 'Recently updated' },
      { id: 'popular',     label: 'Most forked' }
    ];
    let ngState = { search: '', category: 'all', status: 'all' };

    function ngCategories() {
      const pool = ngGraphPool();
      const counts = new Map();
      pool.forEach((g) => {
        if (!g.domain) return;
        counts.set(g.domain, (counts.get(g.domain) || 0) + 1);
      });
      const cats = [...counts.entries()]
        .map(([name, count]) => ({ id: name, label: name, count }))
        .sort((a, b) => b.count - a.count);
      cats.unshift({ id: 'all', label: 'All categories', count: pool.length });
      return cats;
    }

    function ngFilteredGraphs() {
      const s = ngState.search.trim().toLowerCase();
      let rows = ngGraphPool().filter((g) => {
        if (ngState.category !== 'all' && g.domain !== ngState.category) return false;
        if (ngState.status === 'open' && !g.openContrib) return false;
        if (ngState.status === 'stable' && g.status !== 'Stable') return false;
        if (ngState.status === 'experimental' && g.status !== 'Experimental') return false;
        if (s) {
          const hay = `${g.title} ${g.owner} ${g.domain} ${g.method} ${g.abstract || ''}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      });
      if (ngState.status === 'recent')  rows = rows.sort((a, b) => a.updatedHours - b.updatedHours);
      if (ngState.status === 'popular') rows = rows.sort((a, b) => b.forks - a.forks);
      // Always hoist the "Onboarding Starter" card to the top of the modal grid
      // so first-time users (and the tutorial highlight) see it immediately.
      const starterIdx = rows.findIndex((g) => graphSlug(g) === 'onboarding-starter');
      if (starterIdx > 0) {
        const [starter] = rows.splice(starterIdx, 1);
        rows.unshift(starter);
      }
      return rows;
    }

    function renderNgCategories() {
      const host = document.getElementById('ngCategories');
      if (!host) return;
      host.innerHTML = ngCategories().map(c => `
        <button type="button" class="ng-cat ${c.id === ngState.category ? 'active' : ''}" data-ng-cat="${esc(c.id)}">
          <span>${esc(c.label)}</span>
          <span class="ng-cat-count">${c.count}</span>
        </button>
      `).join('');
    }

    function renderNgPills() {
      const host = document.getElementById('ngStatusPills');
      if (!host) return;
      host.innerHTML = NG_STATUS_FILTERS.map(f => `
        <button type="button" class="ng-pill ${f.id === ngState.status ? 'active' : ''}" data-ng-status="${esc(f.id)}">${esc(f.label)}</button>
      `).join('');
    }

    function renderNgGrid() {
      const host = document.getElementById('ngGrid');
      if (!host) return;
      const blank = `
        <button type="button" class="ng-blank" data-ng-action="blank">
          <span class="ng-blank-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          </span>
          <span class="ng-blank-title">Start from scratch</span>
          <span class="ng-blank-sub">Start from a blank canvas with no existing nodes.</span>
        </button>`;
      const cards = ngFilteredGraphs().map(g => {
        const slug = graphSlug(g);
        return `<div class="ng-card" data-ng-card data-graph-slug="${esc(slug)}">
          ${renderCard({ ...g, role: 'Public', shortOwner: g.owner }, { showManageActions: false, hideFooter: true, readOnlyTitle: true })}
          <div class="ng-card-overlay">
            <button type="button" class="ng-overlay-btn" data-ng-action="preview" data-graph-slug="${esc(slug)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
              Preview
            </button>
            <button type="button" class="ng-overlay-btn ng-overlay-btn--fork" data-ng-action="fork" data-graph-slug="${esc(slug)}">
              <img src="icons/fork.png" alt="" aria-hidden="true" />
              Fork
            </button>
          </div>
        </div>`;
      }).join('');
      host.innerHTML = blank + cards;
    }

    function openNewGraphModal() {
      const modal = document.getElementById('newGraphModal');
      if (!modal) return;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      renderNgCategories();
      renderNgPills();
      renderNgGrid();
      const search = document.getElementById('ngSearch');
      if (search) { search.value = ngState.search; setTimeout(() => search.focus(), 50); }
    }

    function closeNewGraphModal() {
      const modal = document.getElementById('newGraphModal');
      if (!modal) return;
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    function initNewGraphModal() {
      const modal = document.getElementById('newGraphModal');
      if (!modal) return;
      document.getElementById('ngClose')?.addEventListener('click', closeNewGraphModal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeNewGraphModal(); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) closeNewGraphModal();
      });
      document.getElementById('ngSearch')?.addEventListener('input', (e) => {
        ngState.search = e.target.value;
        renderNgGrid();
      });
      document.getElementById('ngCategories')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ng-cat]');
        if (!btn) return;
        ngState.category = btn.dataset.ngCat;
        renderNgCategories();
        renderNgGrid();
      });
      document.getElementById('ngStatusPills')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ng-status]');
        if (!btn) return;
        ngState.status = btn.dataset.ngStatus;
        renderNgPills();
        renderNgGrid();
      });
      document.getElementById('ngGrid')?.addEventListener('click', (e) => {
        const action = e.target.closest('[data-ng-action]');
        if (!action) return;
        e.stopPropagation();
        const kind = action.dataset.ngAction;
        if (kind === 'blank') { createBlankGraph(); return; }
        const slug = action.dataset.graphSlug;
        const g = GRAPHS.find(x => graphSlug(x) === slug);
        if (!g) return;
        if (kind === 'preview') {
          // Let the tutorial know which graph the user previewed; it will
          // advance Step 1 if the slug matches the onboarding starter.
          if (window.ConnectifyTutorial && window.ConnectifyTutorial.isActive()) {
            window.ConnectifyTutorial.notifyAction('preview-clicked', { slug });
          }
          window.location.href = `view-mode-new.html?project=${encodeURIComponent(slug)}`;
        } else if (kind === 'fork') {
          forkGraph(g);
        }
      });
    }

    async function loadBundledCatalog() {
      if (location.protocol === 'file:') return;
      try {
        const r = await fetch('graphs/catalog.json', { credentials: 'same-origin' });
        if (!r.ok) return;
        const data = await r.json();
        const list = Array.isArray(data.graphs) ? data.graphs : [];
        list.forEach((entry) => {
          if (!entry || !entry.slug) return;
          if (entry.nodeCount != null) BUNDLED_GRAPH_COUNTS[entry.slug] = entry.nodeCount;
          const g = GRAPHS.find(
            (x) =>
              (x.slug && x.slug === entry.slug) ||
              (entry.title && x.title === entry.title) ||
              KNOWN_PROJECTS[x.title] === entry.slug
          );
          if (g) {
            if (!g.slug) g.slug = entry.slug;
            return;
          }
          if (!entry.title) return;
          const row = {
            title: entry.title,
            slug: entry.slug,
            owner: entry.owner || 'Community',
            shortOwner: entry.shortOwner || entry.owner || 'Community',
            domain: entry.domain || 'General',
            modality: entry.modality || 'Multimodal',
            method: entry.method || '—',
            role: entry.role || 'Public',
            status: entry.status || 'Stable',
            license: entry.license || 'MIT',
            updatedHours: entry.updatedHours != null ? entry.updatedHours : 24,
            forks: entry.forks != null ? entry.forks : 0,
            stars: entry.stars != null ? entry.stars : 0,
            downloads: entry.downloads != null ? entry.downloads : 0,
            activity: entry.activity != null ? entry.activity : 40,
            openContrib: entry.openContrib !== false,
            team: entry.team || 'Community',
            abstract: entry.abstract || '',
            starred: false,
            recentRank: 999,
            editedAgo: entry.editedAgo || '',
            editedBy: entry.editedBy || '',
            collaborators: entry.collaborators || ['CF'],
            collaboratorExtra: entry.collaboratorExtra != null ? entry.collaboratorExtra : 0,
          };
          GRAPHS.push(row);
          byTitle.set(row.title, row);
        });
      } catch (_) { /* offline, file://, or missing catalog */ }
    }

    q('#newGraphBtn').addEventListener('click', openNewGraphModal);
    q('#leftNavNewGraphBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openNewGraphModal();
    });
    const tabFromUrl = new URLSearchParams(window.location.search).get('tab');
    (async () => {
      await loadBundledCatalog();
      hydrateCustomProjects();
      window.openGraph = openGraph;
      window.rememberPublicGraphEditOptIn = rememberPublicGraphEditOptIn;
      initDashboardControls();
      renderDashboard();
      renderCommunity();
      initFilters();
      initCommunityControls();
      initTopicPills();
      initTeamSelector();
      initCardsLayoutToggle();
      initGraphCardNavigation();
      initGraphTitleRename();
      initEditNavLink();
      initForkConfirmModal();
      initNewGraphModal();
      switchTab(TAB_META[tabFromUrl] ? tabFromUrl : 'dashboard');

      // ───── Tutorial wiring (first-time user tour) ─────
      // Register hub-phase steps so the system can resume on this page.
      if (window.ConnectifyTutorial && window.ConnectifyTutorialSteps) {
        window.ConnectifyTutorial.init({
          page: 'hub',
          steps: window.ConnectifyTutorialSteps.forPage('hub'),
        });
      }

      const params = new URLSearchParams(window.location.search);
      const fromLanding = params.get('new') === '1';
      const tutParam = params.get('tutorial');         // '1' to force-start
      if (fromLanding) {
        openNewGraphModal();
        if (window.ConnectifyTutorial) {
          const state = window.ConnectifyTutorial.getState();
          const fresh = !state.started && !state.skipped && !state.completed;
          // Auto-start the tour on the very first visit from landing,
          // OR when explicitly asked via `?tutorial=1`.
          if (fresh || tutParam === '1') {
            // Delay slightly to let the modal paint and grid render.
            setTimeout(() => window.ConnectifyTutorial.start(), 250);
          }
        }
      } else if (tutParam === '1' && window.ConnectifyTutorial) {
        // Manual restart from anywhere on the hub.
        window.ConnectifyTutorial.reset();
        openNewGraphModal();
        setTimeout(() => window.ConnectifyTutorial.start(), 250);
      }
    })();

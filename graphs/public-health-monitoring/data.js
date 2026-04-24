// ─────────────────────────────────────────────────────────────────────────
// Public Health Monitoring — UCLA Health Sciences
//
// This graph models a production-grade public-health early-warning system.
// Pipeline shape (left → right):
//
//   [Col 1-2: 25 raw datasets]   — EHR, wastewater PCR, air quality, 988
//     │                             calls, satellite, social media, SNAP/WIC,
//     │                             ACS census, mobility, OSM POIs, etc.
//     ▼
//   [Col 3: 11 preprocessing logic nodes]  — NLP, geocoding, deduplication,
//     │                                       k-anonymization, AQI calc,
//     │                                       time-series smoothing, etc.
//     ▼
//   [Col 4: 14 signal / surveillance models]  — Respiratory nowcast, WBE,
//     │                                          asthma exposure, heat
//     │                                          mortality, opioid hotspots,
//     │                                          vaccine equity, maternal
//     │                                          risk, emerging pathogen, etc.
//     ▼
//   [Col 5: 5 fusion logic nodes]  — Bayesian multi-signal fusion,
//     │                               spatiotemporal nowcast, ARIMA+SIR+LSTM
//     │                               ensemble, choropleth builder,
//     │                               equity-weighted rebalancer.
//     ▼
//   [Col 6: 4 decision models + 1 dashboard]  — Outbreak alerting, risk map
//                                                rendering, ventilator/ambulance
//                                                allocation, counterfactual
//                                                intervention simulation, and
//                                                the commissioner dashboard.
//
// Every signal-model branch is deliberately a self-contained sub-pipeline so
// research teams can ablate (drop, swap, or substitute) individual components
// and rerun the experiment to measure per-signal contribution to nowcast
// accuracy or alert precision. Common "paths" researchers might run:
//
//   • COVID nowcast:   wastewater-rna → wbe-normalizer → wbe-nowcast →
//                      bayesian-fusion → forecast-ensemble → outbreak-alert
//   • Heat-wave response: weather-climate → heat-mortality → bayesian-fusion
//                      → resource-optimizer → commissioner-dashboard
//   • Overdose hotspot: overdose-ems → geocoder → opioid-hotspot →
//                      bayesian-fusion → risk-map-renderer
//   • Emerging pathogen: social-media → sentiment-classifier →
//                      emerging-pathogen → outbreak-alert
//   • Vaccine equity:  vaccine-registry → vaccine-equity → equity-rebalancer
//                      → resource-optimizer → commissioner-dashboard
//
// 60 nodes total (5.45× the Autonomous Vehicle Navigation graph).
// ─────────────────────────────────────────────────────────────────────────
window.PROJECT = {
  slug: 'public-health-monitoring',
  title: 'Public Health Monitoring',
  org: 'UCLA Health Sciences',
  tags: ['Public Health', 'Epidemic Tracking'],
  contributorCount: 42,
  contributors: [
    { letter: 'U', bg: '#1e40af',            name: 'UCLA Health Sciences',  role: 'Owner', pushes: 32 },
    { letter: 'L', bg: 'var(--avatar-1)',    name: 'Lisa Rodriguez',        role: 'Admin', pushes: 18 },
    { letter: 'M', bg: 'var(--avatar-2)',    name: 'Marcus Kim',            role: 'Admin', pushes: 11 },
    { letter: 'S', bg: 'var(--avatar-3)',    name: 'Sara Patel',                           pushes: 6  },
    { letter: 'J', bg: 'var(--avatar-5)',    name: 'Jesh Bheemanpally',                    pushes: 4  },
  ],
  othersCount: 38,
  othersPreview: 'Aditi Rao, Priya Nair…',
  others: [
    { letter: 'A', bg: 'var(--avatar-1)', name: 'Aditi Rao' },
    { letter: 'P', bg: 'var(--avatar-4)', name: 'Priya Nair' },
    { letter: 'D', bg: 'var(--avatar-6)', name: 'Diego Moreno' },
    { letter: 'E', bg: 'var(--avatar-2)', name: 'Elena Rossi' },
    { letter: 'T', bg: 'var(--avatar-7)', name: 'Tara Alvarez' },
    { letter: 'Y', bg: 'var(--avatar-4)', name: 'Yuki Tanaka' },
    { letter: 'N', bg: 'var(--avatar-3)', name: 'Nia Owusu' },
    { letter: 'R', bg: 'var(--avatar-5)', name: 'Ravi Desai' },
    { letter: 'K', bg: 'var(--avatar-6)', name: 'Kai Johansson' },
    { letter: 'O', bg: 'var(--avatar-2)', name: 'Omar Haddad' },
    { letter: 'Z', bg: 'var(--avatar-1)', name: 'Zara Malik' },
    { letter: 'B', bg: 'var(--avatar-5)', name: 'Bella Conti' },
    { letter: 'G', bg: 'var(--avatar-7)', name: 'Gideon Fox' },
    { letter: 'I', bg: 'var(--avatar-3)', name: 'Ish Khandelwal' },
    { letter: 'C', bg: 'var(--avatar-4)', name: 'Charlie Jatt' },
    { letter: 'F', bg: 'var(--avatar-6)', name: 'Farah Suleiman' },
    { letter: 'H', bg: 'var(--avatar-2)', name: 'Hiroshi Nakamura' },
    { letter: 'V', bg: 'var(--avatar-5)', name: 'Valeria Ortiz' },
  ],
  description: 'County-scale public-health early-warning system that fuses EHR, wastewater PCR, air quality, social media, mobility, 988 crisis calls, vaccine registry, and satellite signals into a live risk surface. Each signal-model branch is designed as an independently ablatable sub-pipeline so researchers can measure per-signal contribution to outbreak detection latency, nowcast accuracy, and intervention efficacy. Downstream fusion and decision layers feed a commissioner-facing dashboard with counterfactual simulation, resource allocation, and alert dispatch.',
  canvasWidth: 3080,
  canvasHeight: 2136,
  viewZoom: 0.4,

  nodes: [
    // ═══════════════════════════════════════════════════════════════════
    // DATASETS — col 1 (x=40)
    // ═══════════════════════════════════════════════════════════════════
    { id: 'ehr-admissions',     type: 'Dataset', label: 'EHR Hospital Admissions',     color: 'var(--dot-red)',    user: { letter: 'L', color: 'var(--avatar-1)' }, x: 40,  y: 40,
      outputs: [
        { name: 'admissions_ts',    type: 'float' },
        { name: 'patient_demo',     type: 'string' },
        { name: 'procedures',       type: 'string' }
      ] },
    { id: 'icd10-encounters',   type: 'Dataset', label: 'ICD-10 Encounter Codes',      color: 'var(--dot-red)',    user: { letter: 'L', color: 'var(--avatar-1)' }, x: 40,  y: 294,
      outputs: [
        { name: 'icd10_codes',      type: 'string' },
        { name: 'encounter_ts',     type: 'float' }
      ] },
    { id: 'ed-complaints',      type: 'Dataset', label: 'ED Chief Complaints',         color: 'var(--dot-red)',    user: { letter: 'L', color: 'var(--avatar-1)' }, x: 40,  y: 517,
      outputs: [
        { name: 'complaint_text',   type: 'string' },
        { name: 'visit_meta',       type: 'string' }
      ] },
    { id: 'pharmacy-fills',     type: 'Dataset', label: 'Pharmacy Rx & OTC Fills',     color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 40,  y: 740,
      outputs: [
        { name: 'rx_fills_ts',      type: 'float' },
        { name: 'otc_sales_ts',     type: 'float' }
      ] },
    { id: 'wastewater-rna',     type: 'Dataset', label: 'Wastewater Pathogen PCR',     color: 'var(--dot-green)',  user: { letter: 'J', color: 'var(--avatar-5)' }, x: 40,  y: 963,
      outputs: [
        { name: 'pcr_copies',       type: 'float' },
        { name: 'sampling_meta',    type: 'string' }
      ] },
    { id: 'absenteeism',        type: 'Dataset', label: 'School/Work Absenteeism',     color: 'var(--dot-yellow)', user: { letter: 'S', color: 'var(--avatar-3)' }, x: 40,  y: 1186,
      outputs: [
        { name: 'absence_rate',     type: 'float' },
        { name: 'district_meta',    type: 'string' }
      ] },
    { id: 'telehealth-logs',    type: 'Dataset', label: 'Telehealth Visit Logs',       color: 'var(--dot-red)',    user: { letter: 'M', color: 'var(--avatar-2)' }, x: 40,  y: 1409,
      outputs: [
        { name: 'visit_count',      type: 'float' },
        { name: 'cc_summary',       type: 'string' }
      ] },
    { id: 'air-quality',        type: 'Dataset', label: 'EPA Air Quality Readings',    color: 'var(--dot-purple)', user: { letter: 'S', color: 'var(--avatar-3)' }, x: 40,  y: 1632,
      outputs: [
        { name: 'pm25',             type: 'float' },
        { name: 'o3',               type: 'float' },
        { name: 'no2',              type: 'float' }
      ] },
    { id: 'weather-climate',    type: 'Dataset', label: 'NOAA Weather & Climate',      color: 'var(--dot-purple)', user: { letter: 'S', color: 'var(--avatar-3)' }, x: 40,  y: 1886,
      outputs: [
        { name: 'temp_high',        type: 'float' },
        { name: 'humidity',         type: 'float' },
        { name: 'precip',           type: 'float' }
      ] },
    { id: 'pollen-index',       type: 'Dataset', label: 'Aerobiology Pollen Counts',   color: 'var(--dot-purple)', user: { letter: 'S', color: 'var(--avatar-3)' }, x: 280,  y: 1106,
      outputs: [
        { name: 'pollen_count',     type: 'float' }
      ] },
    { id: 'satellite-imagery',  type: 'Dataset', label: 'Sentinel-2 Satellite',        color: 'var(--dot-purple)', user: { letter: 'U', color: '#1e40af' },        x: 280,  y: 1298,
      outputs: [
        { name: 'raster',           type: 'binary' },
        { name: 'bands',            type: 'string' }
      ] },
    { id: 'search-trends',      type: 'Dataset', label: 'Google Search Trends',        color: 'var(--dot-blue)',   user: { letter: 'M', color: 'var(--avatar-2)' }, x: 280,  y: 1521,
      outputs: [
        { name: 'query_volume',     type: 'float' },
        { name: 'keywords',         type: 'string' }
      ] },
    { id: 'social-media',       type: 'Dataset', label: 'Twitter/Reddit Signal',       color: 'var(--dot-blue)',   user: { letter: 'M', color: 'var(--avatar-2)' }, x: 280,  y: 1744,
      outputs: [
        { name: 'posts',            type: 'string' },
        { name: 'engagement',       type: 'float' }
      ] },

    // ═══════════════════════════════════════════════════════════════════
    // DATASETS — col 2 (x=280)
    // ═══════════════════════════════════════════════════════════════════
    { id: 'vaccine-registry',   type: 'Dataset', label: 'CAIR Vaccine Registry',       color: 'var(--dot-green)',  user: { letter: 'L', color: 'var(--avatar-1)' }, x: 280, y: 214,
      outputs: [
        { name: 'dose_events',      type: 'string' },
        { name: 'coverage_rate',    type: 'float' }
      ] },
    { id: 'death-certificates', type: 'Dataset', label: 'Death Certificate DB',        color: 'var(--dot-red)',    user: { letter: 'L', color: 'var(--avatar-1)' }, x: 280, y: 437,
      outputs: [
        { name: 'cause_of_death',   type: 'string' },
        { name: 'death_ts',         type: 'float' }
      ] },
    { id: 'sti-sentinel',       type: 'Dataset', label: 'STI Sentinel Clinics',        color: 'var(--dot-red)',    user: { letter: 'S', color: 'var(--avatar-3)' }, x: 280, y: 660,
      outputs: [
        { name: 'sti_labs',         type: 'string' },
        { name: 'site_meta',        type: 'string' }
      ] },
    { id: 'crisis-hotline',     type: 'Dataset', label: '988 Crisis Hotline',          color: 'var(--dot-blue)',   user: { letter: 'J', color: 'var(--avatar-5)' }, x: 280, y: 883,
      outputs: [
        { name: 'call_transcripts', type: 'string' },
        { name: 'call_ts',          type: 'float' }
      ] },
    { id: 'overdose-ems',       type: 'Dataset', label: 'EMS Overdose Incidents',      color: 'var(--dot-blue)',   user: { letter: 'J', color: 'var(--avatar-5)' }, x: 520, y: 214,
      outputs: [
        { name: 'od_incidents',     type: 'string' },
        { name: 'incident_geo',     type: 'string' }
      ] },
    { id: 'injury-violence',    type: 'Dataset', label: 'Injury & Violence DB',        color: 'var(--dot-blue)',   user: { letter: 'J', color: 'var(--avatar-5)' }, x: 520, y: 437,
      outputs: [
        { name: 'incident_codes',   type: 'string' },
        { name: 'injury_meta',      type: 'string' }
      ] },
    { id: 'snap-wic',           type: 'Dataset', label: 'SNAP / WIC Enrollment',       color: 'var(--dot-green)',  user: { letter: 'S', color: 'var(--avatar-3)' }, x: 520, y: 660,
      outputs: [
        { name: 'enrollment',       type: 'float' },
        { name: 'benefit_use',      type: 'float' }
      ] },
    { id: 'poison-control',     type: 'Dataset', label: 'Poison Control Calls',        color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 520, y: 883,
      outputs: [
        { name: 'call_reason',      type: 'string' },
        { name: 'substance',        type: 'string' }
      ] },
    { id: 'acs-census',         type: 'Dataset', label: 'ACS Census Demographics',     color: 'var(--dot-green)',  user: { letter: 'U', color: '#1e40af' },        x: 520, y: 1106,
      outputs: [
        { name: 'demographics',     type: 'string' },
        { name: 'socioecon',        type: 'float' }
      ] },
    { id: 'worldpop-raster',    type: 'Dataset', label: 'WorldPop Density Raster',     color: 'var(--dot-purple)', user: { letter: 'U', color: '#1e40af' },        x: 520, y: 1329,
      outputs: [
        { name: 'pop_density',      type: 'binary' }
      ] },
    { id: 'mobility-safegraph', type: 'Dataset', label: 'SafeGraph Mobility',          color: 'var(--dot-blue)',   user: { letter: 'L', color: 'var(--avatar-1)' }, x: 520, y: 1521,
      outputs: [
        { name: 'visit_graph',      type: 'string' },
        { name: 'dwell_time',       type: 'float' }
      ] },
    { id: 'osm-poi',            type: 'Dataset', label: 'OpenStreetMap POIs',          color: 'var(--dot-green)',  user: { letter: 'L', color: 'var(--avatar-1)' }, x: 520, y: 1744,
      outputs: [
        { name: 'poi_catalog',      type: 'string' },
        { name: 'amenity_geo',      type: 'string' }
      ] },

    // ═══════════════════════════════════════════════════════════════════
    // PREPROCESSING LOGIC — col 3 (x=560)
    // ═══════════════════════════════════════════════════════════════════
    { id: 'record-linkage',        type: 'Logic', label: 'Record Linkage & Dedup',     color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 780, y: 62,
      inputs:  [
        { name: 'admissions_in',    type: 'float' },
        { name: 'patient_in',       type: 'string' },
        { name: 'death_in',         type: 'string' }
      ],
      outputs: [
        { name: 'linked_records',   type: 'string' },
        { name: 'dedup_rate',       type: 'float' }
      ] },
    { id: 'icd-mapper',            type: 'Logic', label: 'ICD-10 Taxonomy Mapper',     color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 780, y: 410,
      inputs:  [
        { name: 'icd10_in',         type: 'string' },
        { name: 'encounter_in',     type: 'float' }
      ],
      outputs: [
        { name: 'resp_signal',      type: 'float' },
        { name: 'sti_signal',       type: 'float' },
        { name: 'mental_signal',    type: 'float' },
        { name: 'mapped_taxonomy',  type: 'string' }
      ] },
    { id: 'chief-complaint-nlp',   type: 'Logic', label: 'Chief Complaint NLP',        color: 'var(--dot-yellow)', user: { letter: 'J', color: 'var(--avatar-5)' }, x: 780, y: 789,
      inputs:  [
        { name: 'complaint_in',     type: 'string' },
        { name: 'cc_summary_in',    type: 'string' }
      ],
      outputs: [
        { name: 'cc_tags',          type: 'string' },
        { name: 'syndromic_flags',  type: 'float' }
      ] },
    { id: 'geocoder',              type: 'Logic', label: 'Geocoder → Census Tract',    color: 'var(--dot-yellow)', user: { letter: 'L', color: 'var(--avatar-1)' }, x: 780, y: 1106,
      inputs:  [
        { name: 'visit_meta_in',    type: 'string' },
        { name: 'incident_geo_in',  type: 'string' },
        { name: 'site_meta_in',     type: 'string' }
      ],
      outputs: [
        { name: 'tract_id',         type: 'string' },
        { name: 'lat_lon',          type: 'float' }
      ] },
    { id: 'wbe-normalizer',        type: 'Logic', label: 'Wastewater PCR Normalizer',  color: 'var(--dot-yellow)', user: { letter: 'J', color: 'var(--avatar-5)' }, x: 780, y: 1454,
      inputs:  [
        { name: 'pcr_in',           type: 'float' },
        { name: 'sampling_in',      type: 'string' }
      ],
      outputs: [
        { name: 'normalized_copies', type: 'float' },
        { name: 'catchment_id',      type: 'string' }
      ] },
    { id: 'ts-smoother',           type: 'Logic', label: 'STL Time-Series Smoother',   color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 780, y: 1771,
      inputs:  [
        { name: 'rx_in',            type: 'float' },
        { name: 'absence_in',       type: 'float' },
        { name: 'visit_in',         type: 'float' }
      ],
      outputs: [
        { name: 'smoothed_series',  type: 'float' },
        { name: 'trend_residual',   type: 'float' }
      ] },
    { id: 'aqi-calculator',        type: 'Logic', label: 'EPA AQI Calculator',         color: 'var(--dot-yellow)', user: { letter: 'S', color: 'var(--avatar-3)' }, x: 1020, y: 282,
      inputs:  [
        { name: 'pm25_in',          type: 'float' },
        { name: 'o3_in',            type: 'float' },
        { name: 'no2_in',           type: 'float' }
      ],
      outputs: [
        { name: 'aqi_index',        type: 'float' },
        { name: 'exposure_score',   type: 'float' }
      ] },
    { id: 'sentiment-classifier',  type: 'Logic', label: 'Social Sentiment NLP',       color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 1020, y: 630,
      inputs:  [
        { name: 'posts_in',         type: 'string' },
        { name: 'transcripts_in',   type: 'string' }
      ],
      outputs: [
        { name: 'sentiment',        type: 'float' },
        { name: 'topic_labels',     type: 'string' }
      ] },
    { id: 'trend-denoiser',        type: 'Logic', label: 'Search Trend Denoiser',      color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 1020, y: 947,
      inputs:  [
        { name: 'query_in',         type: 'float' },
        { name: 'keywords_in',      type: 'string' }
      ],
      outputs: [
        { name: 'denoised_signal',  type: 'float' },
        { name: 'anomaly_flags',    type: 'float' }
      ] },
    { id: 'satellite-ndvi',        type: 'Logic', label: 'Satellite NDVI Indexer',     color: 'var(--dot-yellow)', user: { letter: 'U', color: '#1e40af' },        x: 1020, y: 1264,
      inputs:  [
        { name: 'raster_in',        type: 'binary' },
        { name: 'bands_in',         type: 'string' }
      ],
      outputs: [
        { name: 'ndvi_index',       type: 'float' },
        { name: 'ndwi_index',       type: 'float' },
        { name: 'water_mask',       type: 'binary' }
      ] },
    { id: 'privacy-kanon',         type: 'Logic', label: 'k-Anonymity Privacy Layer',  color: 'var(--dot-yellow)', user: { letter: 'L', color: 'var(--avatar-1)' }, x: 1020, y: 1612,
      inputs:  [
        { name: 'linked_in',        type: 'string' },
        { name: 'tract_in',         type: 'string' }
      ],
      outputs: [
        { name: 'k_anon_records',   type: 'string' }
      ] },

    // ═══════════════════════════════════════════════════════════════════
    // SIGNAL MODELS — col 4 (x=900)
    // ═══════════════════════════════════════════════════════════════════
    { id: 'resp-syndromic',    type: 'Model', label: 'Respiratory Syndromic',       color: 'var(--dot-red)',    user: { letter: 'L', color: 'var(--avatar-1)' }, x: 1280, y: 584,
      inputs:  [
        { name: 'syndromic_in',     type: 'float' },
        { name: 'resp_icd_in',      type: 'float' },
        { name: 'smoothed_in',      type: 'float' }
      ],
      outputs: [
        { name: 'resp_nowcast',     type: 'float' },
        { name: 'flu_like_rate',    type: 'float' }
      ] },
    { id: 'wbe-nowcast',       type: 'Model', label: 'Wastewater Nowcast',          color: 'var(--dot-green)',  user: { letter: 'J', color: 'var(--avatar-5)' }, x: 1280, y: 932,
      inputs:  [
        { name: 'normalized_in',    type: 'float' },
        { name: 'catchment_in',     type: 'string' }
      ],
      outputs: [
        { name: 'wbe_nowcast',      type: 'float' },
        { name: 'pathogen_panel',   type: 'string' }
      ] },
    { id: 'search-forecast',   type: 'Model', label: 'Search-Based Forecast',       color: 'var(--dot-blue)',   user: { letter: 'M', color: 'var(--avatar-2)' }, x: 1280, y: 1249,
      inputs:  [
        { name: 'denoised_in',      type: 'float' },
        { name: 'anomaly_in',       type: 'float' }
      ],
      outputs: [
        { name: 'symptom_forecast', type: 'float' },
        { name: 'trending_terms',   type: 'string' }
      ] },
    { id: 'emerging-pathogen', type: 'Model', label: 'Emerging Pathogen Detector',  color: 'var(--dot-red)',    user: { letter: 'U', color: '#1e40af' },        x: 1280, y: 1566,
      inputs:  [
        { name: 'trending_in',      type: 'string' },
        { name: 'topic_in',         type: 'string' },
        { name: 'pathogen_in',      type: 'string' }
      ],
      outputs: [
        { name: 'novel_score',      type: 'float' },
        { name: 'candidate_name',   type: 'string' }
      ] },
    { id: 'asthma-exposure',   type: 'Model', label: 'Asthma Exposure Model',       color: 'var(--dot-purple)', user: { letter: 'S', color: 'var(--avatar-3)' }, x: 1280, y: 267,
      inputs:  [
        { name: 'aqi_in',           type: 'float' },
        { name: 'pollen_in',        type: 'float' },
        { name: 'exposure_in',      type: 'float' }
      ],
      outputs: [
        { name: 'asthma_risk',      type: 'float' }
      ] },
    { id: 'heat-mortality',    type: 'Model', label: 'Heat Mortality Risk',         color: 'var(--dot-purple)', user: { letter: 'S', color: 'var(--avatar-3)' }, x: 1520, y: 236,
      inputs:  [
        { name: 'temp_in',          type: 'float' },
        { name: 'humidity_in',      type: 'float' },
        { name: 'demo_in',          type: 'string' }
      ],
      outputs: [
        { name: 'heat_risk',        type: 'float' }
      ] },
    { id: 'vector-borne',      type: 'Model', label: 'Vector-Borne Disease',        color: 'var(--dot-purple)', user: { letter: 'U', color: '#1e40af' },        x: 1520, y: 553,
      inputs:  [
        { name: 'ndvi_in',          type: 'float' },
        { name: 'ndwi_in',          type: 'float' },
        { name: 'precip_in',        type: 'float' }
      ],
      outputs: [
        { name: 'mosquito_hazard',  type: 'float' },
        { name: 'dengue_risk',      type: 'float' }
      ] },
    { id: 'mental-health',     type: 'Model', label: 'Mental Health Crisis',        color: 'var(--dot-blue)',   user: { letter: 'J', color: 'var(--avatar-5)' }, x: 1520, y: 901,
      inputs:  [
        { name: 'sentiment_in',     type: 'float' },
        { name: 'call_ts_in',       type: 'float' },
        { name: 'kanon_in',         type: 'string' },
        { name: 'mental_icd_in',    type: 'float' }
      ],
      outputs: [
        { name: 'crisis_risk',      type: 'float' },
        { name: 'hotspot_geo',      type: 'string' }
      ] },
    { id: 'opioid-hotspot',    type: 'Model', label: 'Opioid Overdose Hotspot',     color: 'var(--dot-blue)',   user: { letter: 'J', color: 'var(--avatar-5)' }, x: 1520, y: 1280,
      inputs:  [
        { name: 'od_in',            type: 'string' },
        { name: 'sent_in',          type: 'float' },
        { name: 'geo_in',           type: 'float' }
      ],
      outputs: [
        { name: 'od_hotspot_geo',   type: 'string' },
        { name: 'fatality_rate',    type: 'float' }
      ] },
    { id: 'violence-predictor', type: 'Model', label: 'Violence & Trauma Predictor', color: 'var(--dot-blue)',  user: { letter: 'J', color: 'var(--avatar-5)' }, x: 1520, y: 1628,
      inputs:  [
        { name: 'incident_in',      type: 'string' },
        { name: 'injury_in',        type: 'string' },
        { name: 'dwell_in',         type: 'float' }
      ],
      outputs: [
        { name: 'violence_risk',    type: 'float' }
      ] },
    { id: 'sti-resurgence',    type: 'Model', label: 'STI Resurgence Model',        color: 'var(--dot-red)',    user: { letter: 'S', color: 'var(--avatar-3)' }, x: 1760, y: 410,
      inputs:  [
        { name: 'sti_lab_in',       type: 'string' },
        { name: 'sti_icd_in',       type: 'float' },
        { name: 'visit_graph_in',   type: 'string' }
      ],
      outputs: [
        { name: 'sti_incidence',    type: 'float' }
      ] },
    { id: 'vaccine-equity',    type: 'Model', label: 'Vaccine Equity Model',        color: 'var(--dot-green)',  user: { letter: 'L', color: 'var(--avatar-1)' }, x: 1760, y: 727,
      inputs:  [
        { name: 'coverage_in',      type: 'float' },
        { name: 'dose_in',          type: 'string' },
        { name: 'socio_in',         type: 'float' }
      ],
      outputs: [
        { name: 'equity_gap',       type: 'float' },
        { name: 'coverage_map',     type: 'string' }
      ] },
    { id: 'maternal-risk',     type: 'Model', label: 'Maternal Mortality Risk',     color: 'var(--dot-red)',    user: { letter: 'S', color: 'var(--avatar-3)' }, x: 1760, y: 1075,
      inputs:  [
        { name: 'cause_in',         type: 'string' },
        { name: 'death_ts_in',      type: 'float' },
        { name: 'linked_in',        type: 'string' },
        { name: 'snap_in',          type: 'float' }
      ],
      outputs: [
        { name: 'maternal_rate',    type: 'float' }
      ] },
    { id: 'foodborne-outbreak', type: 'Model', label: 'Foodborne Outbreak Detector', color: 'var(--dot-yellow)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 1760, y: 1423,
      inputs:  [
        { name: 'reason_in',        type: 'string' },
        { name: 'substance_in',     type: 'string' },
        { name: 'cc_tags_in',       type: 'string' }
      ],
      outputs: [
        { name: 'outbreak_signal',  type: 'float' },
        { name: 'suspect_source',   type: 'string' }
      ] },

    // ═══════════════════════════════════════════════════════════════════
    // FUSION LOGIC — col 5 (x=1300)
    // ═══════════════════════════════════════════════════════════════════
    { id: 'bayesian-fusion',        type: 'Logic', label: 'Bayesian Multi-Signal Fusion', color: 'var(--dot-yellow)', user: { letter: 'U', color: '#1e40af' }, x: 2020, y: 761,
      inputs:  [
        { name: 'resp_in',          type: 'float' },
        { name: 'wbe_in',           type: 'float' },
        { name: 'search_in',        type: 'float' },
        { name: 'novel_in',         type: 'float' },
        { name: 'asthma_in',        type: 'float' },
        { name: 'heat_in',          type: 'float' },
        { name: 'vector_in',        type: 'float' },
        { name: 'crisis_in',        type: 'float' },
        { name: 'od_in',            type: 'float' },
        { name: 'violence_in',      type: 'float' },
        { name: 'sti_in',           type: 'float' },
        { name: 'food_in',          type: 'float' },
        { name: 'maternal_in',      type: 'float' }
      ],
      outputs: [
        { name: 'fused_posterior',  type: 'float' },
        { name: 'uncertainty',      type: 'float' }
      ] },
    { id: 'spatiotemporal-nowcast', type: 'Logic', label: 'Spatiotemporal Nowcast',       color: 'var(--dot-yellow)', user: { letter: 'U', color: '#1e40af' }, x: 2260, y: 394,
      inputs:  [
        { name: 'fused_in',         type: 'float' },
        { name: 'density_in',       type: 'binary' },
        { name: 'poi_in',           type: 'string' },
        { name: 'visit_graph_in',   type: 'string' }
      ],
      outputs: [
        { name: 'nowcast_grid',     type: 'binary' },
        { name: 'grid_meta',        type: 'string' }
      ] },
    { id: 'forecast-ensemble',      type: 'Logic', label: 'ARIMA+SIR+LSTM Ensemble',      color: 'var(--dot-yellow)', user: { letter: 'L', color: 'var(--avatar-1)' }, x: 2260, y: 773,
      inputs:  [
        { name: 'grid_in',          type: 'binary' },
        { name: 'resp_nowcast_in',  type: 'float' },
        { name: 'wbe_nowcast_in',   type: 'float' }
      ],
      outputs: [
        { name: 'forecast_14d',     type: 'float' },
        { name: 'forecast_30d',     type: 'float' }
      ] },
    { id: 'disease-map-builder',    type: 'Logic', label: 'Disease Choropleth Builder',   color: 'var(--dot-yellow)', user: { letter: 'L', color: 'var(--avatar-1)' }, x: 2260, y: 1121,
      inputs:  [
        { name: 'grid_in',          type: 'binary' },
        { name: 'demo_in',          type: 'string' }
      ],
      outputs: [
        { name: 'choropleth_map',   type: 'binary' },
        { name: 'tract_risk',       type: 'float' }
      ] },
    { id: 'equity-rebalancer',      type: 'Logic', label: 'Equity-Weighted Rebalancer',   color: 'var(--dot-yellow)', user: { letter: 'L', color: 'var(--avatar-1)' }, x: 2260, y: 1438,
      inputs:  [
        { name: 'choropleth_in',    type: 'binary' },
        { name: 'equity_in',        type: 'float' },
        { name: 'kanon_in',         type: 'string' }
      ],
      outputs: [
        { name: 'rebalanced_map',   type: 'binary' },
        { name: 'intervention_targets', type: 'string' }
      ] },

    // ═══════════════════════════════════════════════════════════════════
    // DECISION / OUTPUT — col 6-7 (x=1680, x=2060)
    // ═══════════════════════════════════════════════════════════════════
    { id: 'outbreak-alert',         type: 'Model', label: 'Outbreak Alert Classifier',    color: 'var(--dot-red)',    user: { letter: 'U', color: '#1e40af' }, x: 2540, y: 394,
      inputs:  [
        { name: 'forecast_in',      type: 'float' },
        { name: 'novel_in',         type: 'float' },
        { name: 'outbreak_in',      type: 'float' }
      ],
      outputs: [
        { name: 'alert_level',      type: 'string' },
        { name: 'alert_ts',         type: 'float' }
      ] },
    { id: 'risk-map-renderer',      type: 'Model', label: 'Risk Map Renderer',            color: 'var(--dot-purple)', user: { letter: 'L', color: 'var(--avatar-1)' }, x: 2540, y: 742,
      inputs:  [
        { name: 'rebalanced_in',    type: 'binary' },
        { name: 'choropleth_in',    type: 'binary' }
      ],
      outputs: [
        { name: 'rendered_png',     type: 'png' },
        { name: 'legend_json',      type: 'string' }
      ] },
    { id: 'resource-optimizer',     type: 'Model', label: 'Resource Allocation Optimizer', color: 'var(--dot-green)', user: { letter: 'M', color: 'var(--avatar-2)' }, x: 2540, y: 1059,
      inputs:  [
        { name: 'forecast14_in',    type: 'float' },
        { name: 'forecast30_in',    type: 'float' },
        { name: 'equity_in',        type: 'float' },
        { name: 'od_hotspot_in',    type: 'string' }
      ],
      outputs: [
        { name: 'allocation_plan',  type: 'string' },
        { name: 'resource_gap',     type: 'float' }
      ] },
    { id: 'intervention-simulator', type: 'Model', label: 'Intervention Simulator',       color: 'var(--dot-blue)',   user: { letter: 'J', color: 'var(--avatar-5)' }, x: 2540, y: 1438,
      inputs:  [
        { name: 'forecast30_in',    type: 'float' },
        { name: 'rebalanced_in',    type: 'binary' },
        { name: 'targets_in',       type: 'string' }
      ],
      outputs: [
        { name: 'counterfactual',   type: 'float' },
        { name: 'recommended_action', type: 'string' }
      ] },
    { id: 'commissioner-dashboard', type: 'Model', label: 'Commissioner Dashboard',       color: 'var(--dot-red)',    user: { letter: 'U', color: '#1e40af' }, x: 2820, y: 948,
      inputs:  [
        { name: 'alert_in',         type: 'string' },
        { name: 'rendered_in',      type: 'png' },
        { name: 'allocation_in',    type: 'string' },
        { name: 'action_in',        type: 'string' }
      ],
      outputs: [] }
  ],

  connections: [
    // ── Preprocessing fan-in ─────────────────────────────────────────────
    { from: ['ehr-admissions',     'out', 'admissions_ts'],    to: ['record-linkage',       'in', 'admissions_in'] },
    { from: ['ehr-admissions',     'out', 'patient_demo'],     to: ['record-linkage',       'in', 'patient_in'] },
    { from: ['death-certificates', 'out', 'cause_of_death'],   to: ['record-linkage',       'in', 'death_in'] },
    { from: ['icd10-encounters',   'out', 'icd10_codes'],      to: ['icd-mapper',           'in', 'icd10_in'] },
    { from: ['icd10-encounters',   'out', 'encounter_ts'],     to: ['icd-mapper',           'in', 'encounter_in'] },
    { from: ['ed-complaints',      'out', 'complaint_text'],   to: ['chief-complaint-nlp',  'in', 'complaint_in'] },
    { from: ['telehealth-logs',    'out', 'cc_summary'],       to: ['chief-complaint-nlp',  'in', 'cc_summary_in'] },
    { from: ['ed-complaints',      'out', 'visit_meta'],       to: ['geocoder',             'in', 'visit_meta_in'] },
    { from: ['overdose-ems',       'out', 'incident_geo'],     to: ['geocoder',             'in', 'incident_geo_in'] },
    { from: ['sti-sentinel',       'out', 'site_meta'],        to: ['geocoder',             'in', 'site_meta_in'] },
    { from: ['wastewater-rna',     'out', 'pcr_copies'],       to: ['wbe-normalizer',       'in', 'pcr_in'] },
    { from: ['wastewater-rna',     'out', 'sampling_meta'],    to: ['wbe-normalizer',       'in', 'sampling_in'] },
    { from: ['pharmacy-fills',     'out', 'rx_fills_ts'],      to: ['ts-smoother',          'in', 'rx_in'] },
    { from: ['absenteeism',        'out', 'absence_rate'],     to: ['ts-smoother',          'in', 'absence_in'] },
    { from: ['telehealth-logs',    'out', 'visit_count'],      to: ['ts-smoother',          'in', 'visit_in'] },
    { from: ['air-quality',        'out', 'pm25'],             to: ['aqi-calculator',       'in', 'pm25_in'] },
    { from: ['air-quality',        'out', 'o3'],               to: ['aqi-calculator',       'in', 'o3_in'] },
    { from: ['air-quality',        'out', 'no2'],              to: ['aqi-calculator',       'in', 'no2_in'] },
    { from: ['social-media',       'out', 'posts'],            to: ['sentiment-classifier', 'in', 'posts_in'] },
    { from: ['crisis-hotline',     'out', 'call_transcripts'], to: ['sentiment-classifier', 'in', 'transcripts_in'] },
    { from: ['search-trends',      'out', 'query_volume'],     to: ['trend-denoiser',       'in', 'query_in'] },
    { from: ['search-trends',      'out', 'keywords'],         to: ['trend-denoiser',       'in', 'keywords_in'] },
    { from: ['satellite-imagery',  'out', 'raster'],           to: ['satellite-ndvi',       'in', 'raster_in'] },
    { from: ['satellite-imagery',  'out', 'bands'],            to: ['satellite-ndvi',       'in', 'bands_in'] },
    { from: ['record-linkage',     'out', 'linked_records'],   to: ['privacy-kanon',        'in', 'linked_in'] },
    { from: ['geocoder',           'out', 'tract_id'],         to: ['privacy-kanon',        'in', 'tract_in'] },

    // ── Respiratory surveillance branch ──────────────────────────────────
    { from: ['chief-complaint-nlp', 'out', 'syndromic_flags'], to: ['resp-syndromic',       'in', 'syndromic_in'] },
    { from: ['icd-mapper',          'out', 'resp_signal'],     to: ['resp-syndromic',       'in', 'resp_icd_in'] },
    { from: ['ts-smoother',         'out', 'smoothed_series'], to: ['resp-syndromic',       'in', 'smoothed_in'] },
    { from: ['wbe-normalizer',      'out', 'normalized_copies'], to: ['wbe-nowcast',        'in', 'normalized_in'] },
    { from: ['wbe-normalizer',      'out', 'catchment_id'],    to: ['wbe-nowcast',          'in', 'catchment_in'] },

    // ── Digital / search / social branch ─────────────────────────────────
    { from: ['trend-denoiser',      'out', 'denoised_signal'], to: ['search-forecast',      'in', 'denoised_in'] },
    { from: ['trend-denoiser',      'out', 'anomaly_flags'],   to: ['search-forecast',      'in', 'anomaly_in'] },
    { from: ['search-forecast',     'out', 'trending_terms'],  to: ['emerging-pathogen',    'in', 'trending_in'] },
    { from: ['sentiment-classifier','out', 'topic_labels'],    to: ['emerging-pathogen',    'in', 'topic_in'] },
    { from: ['wbe-nowcast',         'out', 'pathogen_panel'],  to: ['emerging-pathogen',    'in', 'pathogen_in'] },

    // ── Environmental branch ─────────────────────────────────────────────
    { from: ['aqi-calculator',      'out', 'aqi_index'],       to: ['asthma-exposure',      'in', 'aqi_in'] },
    { from: ['pollen-index',        'out', 'pollen_count'],    to: ['asthma-exposure',      'in', 'pollen_in'] },
    { from: ['aqi-calculator',      'out', 'exposure_score'],  to: ['asthma-exposure',      'in', 'exposure_in'] },
    { from: ['weather-climate',     'out', 'temp_high'],       to: ['heat-mortality',       'in', 'temp_in'] },
    { from: ['weather-climate',     'out', 'humidity'],        to: ['heat-mortality',       'in', 'humidity_in'] },
    { from: ['acs-census',          'out', 'demographics'],    to: ['heat-mortality',       'in', 'demo_in'] },
    { from: ['satellite-ndvi',      'out', 'ndvi_index'],      to: ['vector-borne',         'in', 'ndvi_in'] },
    { from: ['satellite-ndvi',      'out', 'ndwi_index'],      to: ['vector-borne',         'in', 'ndwi_in'] },
    { from: ['weather-climate',     'out', 'precip'],          to: ['vector-borne',         'in', 'precip_in'] },

    // ── Behavioral / mental health branch ────────────────────────────────
    { from: ['sentiment-classifier','out', 'sentiment'],       to: ['mental-health',        'in', 'sentiment_in'] },
    { from: ['crisis-hotline',      'out', 'call_ts'],         to: ['mental-health',        'in', 'call_ts_in'] },
    { from: ['privacy-kanon',       'out', 'k_anon_records'],  to: ['mental-health',        'in', 'kanon_in'] },
    { from: ['icd-mapper',          'out', 'mental_signal'],   to: ['mental-health',        'in', 'mental_icd_in'] },
    { from: ['overdose-ems',        'out', 'od_incidents'],    to: ['opioid-hotspot',       'in', 'od_in'] },
    { from: ['sentiment-classifier','out', 'sentiment'],       to: ['opioid-hotspot',       'in', 'sent_in'] },
    { from: ['geocoder',            'out', 'lat_lon'],         to: ['opioid-hotspot',       'in', 'geo_in'] },
    { from: ['injury-violence',     'out', 'incident_codes'],  to: ['violence-predictor',   'in', 'incident_in'] },
    { from: ['injury-violence',     'out', 'injury_meta'],     to: ['violence-predictor',   'in', 'injury_in'] },
    { from: ['mobility-safegraph',  'out', 'dwell_time'],      to: ['violence-predictor',   'in', 'dwell_in'] },

    // ── Clinical / equity branch ─────────────────────────────────────────
    { from: ['sti-sentinel',        'out', 'sti_labs'],        to: ['sti-resurgence',       'in', 'sti_lab_in'] },
    { from: ['icd-mapper',          'out', 'sti_signal'],      to: ['sti-resurgence',       'in', 'sti_icd_in'] },
    { from: ['mobility-safegraph',  'out', 'visit_graph'],     to: ['sti-resurgence',       'in', 'visit_graph_in'] },
    { from: ['vaccine-registry',    'out', 'coverage_rate'],   to: ['vaccine-equity',       'in', 'coverage_in'] },
    { from: ['vaccine-registry',    'out', 'dose_events'],     to: ['vaccine-equity',       'in', 'dose_in'] },
    { from: ['acs-census',          'out', 'socioecon'],       to: ['vaccine-equity',       'in', 'socio_in'] },
    { from: ['death-certificates',  'out', 'cause_of_death'],  to: ['maternal-risk',        'in', 'cause_in'] },
    { from: ['death-certificates',  'out', 'death_ts'],        to: ['maternal-risk',        'in', 'death_ts_in'] },
    { from: ['record-linkage',      'out', 'linked_records'],  to: ['maternal-risk',        'in', 'linked_in'] },

    // ── Foodborne branch ─────────────────────────────────────────────────
    { from: ['poison-control',      'out', 'call_reason'],     to: ['foodborne-outbreak',   'in', 'reason_in'] },
    { from: ['poison-control',      'out', 'substance'],       to: ['foodborne-outbreak',   'in', 'substance_in'] },
    { from: ['chief-complaint-nlp', 'out', 'cc_tags'],         to: ['foodborne-outbreak',   'in', 'cc_tags_in'] },

    // ── Fusion intake (12 parallel signal models → bayesian fusion) ──────
    { from: ['resp-syndromic',     'out', 'resp_nowcast'],     to: ['bayesian-fusion',      'in', 'resp_in'] },
    { from: ['wbe-nowcast',        'out', 'wbe_nowcast'],      to: ['bayesian-fusion',      'in', 'wbe_in'] },
    { from: ['search-forecast',    'out', 'symptom_forecast'], to: ['bayesian-fusion',      'in', 'search_in'] },
    { from: ['emerging-pathogen',  'out', 'novel_score'],      to: ['bayesian-fusion',      'in', 'novel_in'] },
    { from: ['asthma-exposure',    'out', 'asthma_risk'],      to: ['bayesian-fusion',      'in', 'asthma_in'] },
    { from: ['heat-mortality',     'out', 'heat_risk'],        to: ['bayesian-fusion',      'in', 'heat_in'] },
    { from: ['vector-borne',       'out', 'mosquito_hazard'],  to: ['bayesian-fusion',      'in', 'vector_in'] },
    { from: ['mental-health',      'out', 'crisis_risk'],      to: ['bayesian-fusion',      'in', 'crisis_in'] },
    { from: ['opioid-hotspot',     'out', 'fatality_rate'],    to: ['bayesian-fusion',      'in', 'od_in'] },
    { from: ['violence-predictor', 'out', 'violence_risk'],    to: ['bayesian-fusion',      'in', 'violence_in'] },
    { from: ['sti-resurgence',     'out', 'sti_incidence'],    to: ['bayesian-fusion',      'in', 'sti_in'] },
    { from: ['foodborne-outbreak', 'out', 'outbreak_signal'],  to: ['bayesian-fusion',      'in', 'food_in'] },
    { from: ['snap-wic',           'out', 'benefit_use'],      to: ['maternal-risk',        'in', 'snap_in'] },
    { from: ['maternal-risk',      'out', 'maternal_rate'],    to: ['bayesian-fusion',      'in', 'maternal_in'] },

    // ── Spatiotemporal + forecast chain ──────────────────────────────────
    { from: ['bayesian-fusion',     'out', 'fused_posterior'], to: ['spatiotemporal-nowcast','in', 'fused_in'] },
    { from: ['worldpop-raster',     'out', 'pop_density'],     to: ['spatiotemporal-nowcast','in', 'density_in'] },
    { from: ['osm-poi',             'out', 'poi_catalog'],     to: ['spatiotemporal-nowcast','in', 'poi_in'] },
    { from: ['mobility-safegraph',  'out', 'visit_graph'],     to: ['spatiotemporal-nowcast','in', 'visit_graph_in'] },
    { from: ['spatiotemporal-nowcast','out','nowcast_grid'],   to: ['forecast-ensemble',    'in', 'grid_in'] },
    { from: ['resp-syndromic',      'out', 'resp_nowcast'],    to: ['forecast-ensemble',    'in', 'resp_nowcast_in'] },
    { from: ['wbe-nowcast',         'out', 'wbe_nowcast'],     to: ['forecast-ensemble',    'in', 'wbe_nowcast_in'] },
    { from: ['spatiotemporal-nowcast','out','nowcast_grid'],   to: ['disease-map-builder',  'in', 'grid_in'] },
    { from: ['acs-census',          'out', 'demographics'],    to: ['disease-map-builder',  'in', 'demo_in'] },
    { from: ['disease-map-builder', 'out', 'choropleth_map'],  to: ['equity-rebalancer',    'in', 'choropleth_in'] },
    { from: ['vaccine-equity',      'out', 'equity_gap'],      to: ['equity-rebalancer',    'in', 'equity_in'] },
    { from: ['privacy-kanon',       'out', 'k_anon_records'],  to: ['equity-rebalancer',    'in', 'kanon_in'] },

    // ── Decision layer ───────────────────────────────────────────────────
    { from: ['forecast-ensemble',   'out', 'forecast_14d'],    to: ['outbreak-alert',       'in', 'forecast_in'] },
    { from: ['emerging-pathogen',   'out', 'novel_score'],     to: ['outbreak-alert',       'in', 'novel_in'] },
    { from: ['foodborne-outbreak',  'out', 'outbreak_signal'], to: ['outbreak-alert',       'in', 'outbreak_in'] },
    { from: ['equity-rebalancer',   'out', 'rebalanced_map'],  to: ['risk-map-renderer',    'in', 'rebalanced_in'] },
    { from: ['disease-map-builder', 'out', 'choropleth_map'],  to: ['risk-map-renderer',    'in', 'choropleth_in'] },
    { from: ['forecast-ensemble',   'out', 'forecast_14d'],    to: ['resource-optimizer',   'in', 'forecast14_in'] },
    { from: ['forecast-ensemble',   'out', 'forecast_30d'],    to: ['resource-optimizer',   'in', 'forecast30_in'] },
    { from: ['vaccine-equity',      'out', 'equity_gap'],      to: ['resource-optimizer',   'in', 'equity_in'] },
    { from: ['opioid-hotspot',      'out', 'od_hotspot_geo'],  to: ['resource-optimizer',   'in', 'od_hotspot_in'] },
    { from: ['forecast-ensemble',   'out', 'forecast_30d'],    to: ['intervention-simulator','in', 'forecast30_in'] },
    { from: ['equity-rebalancer',   'out', 'rebalanced_map'],  to: ['intervention-simulator','in', 'rebalanced_in'] },
    { from: ['equity-rebalancer',   'out', 'intervention_targets'], to: ['intervention-simulator','in', 'targets_in'] },

    // ── Commissioner dashboard (terminal sink) ──────────────────────────
    { from: ['outbreak-alert',         'out', 'alert_level'],       to: ['commissioner-dashboard', 'in', 'alert_in'] },
    { from: ['risk-map-renderer',      'out', 'rendered_png'],      to: ['commissioner-dashboard', 'in', 'rendered_in'] },
    { from: ['resource-optimizer',     'out', 'allocation_plan'],   to: ['commissioner-dashboard', 'in', 'allocation_in'] },
    { from: ['intervention-simulator', 'out', 'recommended_action'], to: ['commissioner-dashboard','in', 'action_in'] }
  ]
};

window.PROJECT = {
  slug: 'autonomous-vehicle-navigation',
  title: 'Autonomous Vehicle Navigation',
  org: 'Waymo',
  tags: ['Autonomous Driving', 'Perception'],
  contributorCount: 21,
  contributors: [
    { letter: 'W', bg: '#7c3aed',          name: 'Waymo',       role: 'Owner', pushes: 14 },
    { letter: 'N', bg: 'var(--avatar-2)',   name: 'Neuron Zero', role: 'Admin', pushes: 9  },
    { letter: 'F', bg: 'var(--avatar-7)',   name: 'Future E-AV', role: 'Admin', pushes: 5  },
    { letter: 'C', bg: 'var(--avatar-5)',   name: 'Charlie Jatt',               pushes: 2  },
  ],
  othersCount: 29,
  othersPreview: 'Elisa De Martel, John Kahfcik…',
  others: [
    { letter: 'E', bg: 'var(--avatar-2)', name: 'Elisa De Martel' },
    { letter: 'J', bg: 'var(--avatar-5)', name: 'John Kahfcik' },
    { letter: 'A', bg: 'var(--avatar-3)', name: 'Aarav Patel' },
    { letter: 'G', bg: 'var(--avatar-4)', name: 'Gideon Fox' },
    { letter: 'I', bg: 'var(--avatar-1)', name: 'Ish Khandelwal' },
    { letter: 'K', bg: 'var(--avatar-6)', name: 'Kai Johansson' },
    { letter: 'L', bg: 'var(--avatar-7)', name: 'Leo Nakamura' },
    { letter: 'T', bg: 'var(--avatar-2)', name: 'Tara Alvarez' },
    { letter: 'P', bg: 'var(--avatar-4)', name: 'Priya Rao' },
    { letter: 'D', bg: 'var(--avatar-1)', name: 'Diego Moreno' },
    { letter: 'S', bg: 'var(--avatar-3)', name: 'Sofia Kim' },
    { letter: 'N', bg: 'var(--avatar-7)', name: 'Nia Owusu' },
    { letter: 'E', bg: 'var(--avatar-5)', name: 'Elena Rossi' },
    { letter: 'M', bg: 'var(--avatar-2)', name: 'Mateo Silva' },
    { letter: 'Y', bg: 'var(--avatar-6)', name: 'Yuki Tanaka' },
    { letter: 'R', bg: 'var(--avatar-4)', name: 'Ravi Desai' },
    { letter: 'B', bg: 'var(--avatar-1)', name: 'Bella Conti' },
    { letter: 'O', bg: 'var(--avatar-3)', name: 'Omar Haddad' },
    { letter: 'Z', bg: 'var(--avatar-7)', name: 'Zara Malik' },
  ],
  description: 'Pipeline to support fully autonomous driving. Starting with sensor data from cameras, LiDAR, GPS, and weather reports, processed by AI models for lane markings, obstacles, and traffic signals. These outputs guide the path planning model, which calculates the vehicle\'s route, and the obstacle avoidance model, which ensures safe navigation and optimal decision pat…',
  canvasWidth: 1800,
  canvasHeight: 1120,
  viewZoom: 1.0,
  nodes: [
    { id: 'obstacle-avoid', type: 'Dataset', label: 'ObstacleShifter Avoidance', color: 'var(--dot-blue)',   user: { letter: 'C', color: 'var(--avatar-5)' }, x: 620,  y: 40,
      outputs: [{ name: 'segmented_image', type: 'jpg' }] },
    { id: 'lidar-scans',    type: 'Dataset', label: 'LiDAR Envir. Scans',        color: 'var(--dot-purple)', user: { letter: 'W', color: '#7c3aed' },          x: 40,   y: 260,
      outputs: [
        { name: 'lidar_env_point_data',     type: 'binary' },
        { name: 'lidar_map_point_data_2',   type: 'binary' },
        { name: 'lidar_coord_point_data_3', type: 'binary' }
      ] },
    { id: 'obstacle-scan',  type: 'Model',   label: 'ObstacleScan Detection',    color: 'var(--dot-green)',  user: { letter: 'W', color: '#7c3aed' },          x: 340,  y: 220,
      inputs:  [
        { name: 'lidar_env_in', type: 'binary' },
        { name: 'lidar_map_in', type: 'binary' }
      ],
      outputs: [{ name: 'lidar_point_cloud', type: 'jpg' }] },
    { id: 'obstacle-net',   type: 'Logic',   label: 'ObstacleShifter Net',       color: 'var(--dot-yellow)', user: { letter: 'C', color: 'var(--avatar-5)' }, x: 900,  y: 180,
      inputs:  [
        { name: 'streetview_image', type: 'jpg' },
        { name: 'lidar_in',         type: 'jpg' }
      ],
      outputs: [{ name: 'obstacle_scan_results', type: 'jpg' }] },
    { id: 'signal-vision',  type: 'Model',   label: 'SignalVision Detection Node', color: 'var(--dot-purple)', user: { letter: 'W', color: '#7c3aed' },        x: 1200, y: 260,
      inputs:  [{ name: 'obstacle_scan', type: 'jpg' }],
      outputs: [{ name: 'action-out',    type: 'binary' }] },
    { id: 'vehicle-action', type: 'Model',   label: 'Vehicle Action Layer',      color: 'var(--dot-purple)', user: { letter: 'W', color: '#7c3aed' },          x: 1480, y: 460,
      inputs:  [
        { name: 'action-in',           type: 'binary' },
        { name: 'decision-map',        type: 'string' },
        { name: 'rt_performance_data', type: 'float'  }
      ], outputs: [] },
    { id: 'geotrack',       type: 'Dataset', label: 'GeoTrack GPS Coord.',       color: 'var(--dot-green)',  user: { letter: 'N', color: 'var(--avatar-2)' }, x: 40,   y: 540,
      outputs: [
        { name: 'geo_gps',   type: 'string' },
        { name: 'lat-x-lon', type: 'float'  }
      ] },
    { id: 'lane-vision',    type: 'Model',   label: 'LaneVision Detection',      color: 'var(--dot-red)',    user: { letter: 'C', color: 'var(--avatar-5)' }, x: 340,  y: 580,
      inputs:  [{ name: 'streetview_image', type: 'png' }],
      outputs: [
        { name: 'lane_markings_out', type: 'png' },
        { name: 'intersection_out',  type: 'png' }
      ] },
    { id: 'smartpath',      type: 'Logic',   label: 'SmartPath Planning',        color: 'var(--dot-yellow)', user: { letter: 'C', color: 'var(--avatar-5)' }, x: 900,  y: 560,
      inputs:  [
        { name: 'vision-action',   type: 'png' },
        { name: 'turn-action',     type: 'png' },
        { name: 'streetview_scan', type: 'png' }
      ],
      outputs: [
        { name: 'decision-map',       type: 'string' },
        { name: 'conditional_action', type: 'binary' }
      ] },
    { id: 'streetview',     type: 'Dataset', label: 'StreetView Img Set',        color: 'var(--dot-red)',    user: { letter: 'N', color: 'var(--avatar-2)' }, x: 340,  y: 880,
      outputs: [
        { name: 'streetview_image', type: 'png' },
        { name: 'streetview_scan',  type: 'png' }
      ] },
    { id: 'telemetry',      type: 'Dataset', label: 'VehicleTelemetry Data',     color: 'var(--dot-green)',  user: { letter: 'N', color: 'var(--avatar-2)' }, x: 900,  y: 880,
      outputs: [
        { name: 'performance_data_map', type: 'float' },
        { name: 'engine_temp',          type: 'float' },
        { name: 'vehicle_speed',        type: 'float' }
      ] }
  ],
  connections: [
    { from: ['obstacle-avoid', 'out', 'segmented_image'],        to: ['obstacle-net',   'in', 'streetview_image'] },
    { from: ['lidar-scans',    'out', 'lidar_env_point_data'],   to: ['obstacle-scan',  'in', 'lidar_env_in'] },
    { from: ['lidar-scans',    'out', 'lidar_map_point_data_2'], to: ['obstacle-scan',  'in', 'lidar_map_in'] },
    { from: ['obstacle-scan',  'out', 'lidar_point_cloud'],      to: ['obstacle-net',   'in', 'lidar_in'] },
    { from: ['obstacle-net',   'out', 'obstacle_scan_results'],  to: ['signal-vision',  'in', 'obstacle_scan'] },
    { from: ['signal-vision',  'out', 'action-out'],             to: ['vehicle-action', 'in', 'action-in'] },
    { from: ['streetview',     'out', 'streetview_image'],       to: ['lane-vision',    'in', 'streetview_image'] },
    { from: ['lane-vision',    'out', 'lane_markings_out'],      to: ['smartpath',      'in', 'vision-action'] },
    { from: ['lane-vision',    'out', 'intersection_out'],       to: ['smartpath',      'in', 'turn-action'] },
    { from: ['streetview',     'out', 'streetview_scan'],        to: ['smartpath',      'in', 'streetview_scan'] },
    { from: ['smartpath',      'out', 'decision-map'],           to: ['vehicle-action', 'in', 'decision-map'] },
    { from: ['telemetry',      'out', 'performance_data_map'],   to: ['vehicle-action', 'in', 'rt_performance_data'] }
  ]
};

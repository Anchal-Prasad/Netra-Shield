export const FEATURE_NAMES = [
  'network_time-delta_min',
  'network_time-delta_max',
  'network_time-delta_avg',
  'network_time-delta_std_deviation',
  'network_ip-length_avg',
  'network_ip-length_max',
  'network_ip-length_std_deviation',
  'network_interval-packets',
  'network_ttl_avg',
  'network_ttl_std_deviation',
  'network_window-size_avg',
  'network_window-size_max',
  'network_window-size_min',
  'network_window-size_std_deviation',
  'network_packets_all_count',
  'network_packets_dst_count',
  'network_packet-size_avg',
  'network_packet-size_min',
  'network_packet-size_std_deviation',
  'network_ports_all_count',
  'network_ports_src_count',
  'network_ports_dst_count',
  'network_tcp-flags_avg',
  'network_tcp-flags_std_deviation',
  'network_payload-length_avg',
]

export const CHART_HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0') + ':00'
)

export const STAT_CARDS = [
  { key: 'total',   label: 'Total Predictions' },
  { key: 'attacks', label: 'Attacks Detected'  },
  { key: 'benign',  label: 'Benign Traffic'    },
  { key: 'unknown', label: 'Unclassified'       },
]

export const ATTACK_TYPES = [
  { key: 'ddos',       label: 'DDoS',       color: '#ff5c70' },
  { key: 'mitm',       label: 'MITM',       color: '#f59e0b' },
  { key: 'dos',        label: 'DoS',        color: '#38bdf8' },
  { key: 'recon',      label: 'Recon',      color: '#a78bfa' },
  { key: 'malware',    label: 'Malware',    color: '#22c55e' },
  { key: 'bruteforce', label: 'Bruteforce', color: '#f97316' }, 
  { key: 'web',        label: 'Web',        color: '#06b6d4' }, 
  { key: 'Unknown',    label: 'Unknown',    color: '#64748b' },
]
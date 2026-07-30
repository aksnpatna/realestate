// Internal zone code — used for grouping logic
export function getRegion(state: string, postcode: string): string {
  const pc = parseInt(postcode, 10);
  if (isNaN(pc)) return 'Unknown';

  if (state === 'VIC') {
    if (pc >= 3000 && pc <= 3010) return 'Melbourne CBD & Inner';
    if (pc >= 3011 && pc <= 3030) return 'Melbourne West';
    if (pc >= 3031 && pc <= 3064) return 'Melbourne North';
    if (pc >= 3100 && pc <= 3149) return 'Melbourne East';
    if (pc >= 3150 && pc <= 3199) return 'Melbourne South East';
    if (pc >= 3200 && pc <= 3210) return 'Melbourne Bayside';
    if (pc >= 3211 && pc <= 3220) return 'Geelong & Surrounds';
    if (pc >= 3975 && pc <= 3999) return 'Mornington Peninsula';
    return 'Regional Victoria';
  }

  if (state === 'NSW') {
    if (pc >= 2000 && pc <= 2010) return 'Sydney CBD & Inner';
    if (pc >= 2011 && pc <= 2050) return 'Sydney East / Inner West';
    if (pc >= 2051 && pc <= 2099) return 'Sydney North Shore';
    if (pc >= 2100 && pc <= 2126) return 'Sydney Northern Beaches/Ryde';
    if (pc >= 2127 && pc <= 2169) return 'Sydney West / Parramatta';
    if (pc >= 2170 && pc <= 2199) return 'Sydney South West';
    if (pc >= 2200 && pc <= 2249) return 'Sydney South / Sutherland';
    if (pc >= 2250 && pc <= 2263) return 'Central Coast';
    if (pc >= 2264 && pc <= 2309) return 'Newcastle & Lake Macquarie';
    if (pc >= 2500 && pc <= 2530) return 'Wollongong & Illawarra';
    return 'Regional NSW';
  }

  if (state === 'QLD') {
    if (pc >= 4000 && pc <= 4009) return 'Brisbane CBD & Inner';
    if (pc >= 4010 && pc <= 4037) return 'Brisbane North';
    if (pc >= 4051 && pc <= 4078) return 'Brisbane West / South West';
    if (pc >= 4101 && pc <= 4133) return 'Brisbane South';
    if (pc >= 4151 && pc <= 4179) return 'Brisbane East';
    if (pc >= 4205 && pc <= 4230) return 'Gold Coast Surrounds';
    if (pc >= 4270 && pc <= 4287) return 'Scenic Rim / Logan';
    return 'Regional QLD';
  }

  if (state === 'WA') {
    if (pc >= 6000 && pc <= 6009) return 'Perth CBD & Inner';
    if (pc >= 6010 && pc <= 6038) return 'Perth North';
    if (pc >= 6050 && pc <= 6084) return 'Perth East / Hills';
    if (pc >= 6090 && pc <= 6126) return 'Perth South';
    if (pc >= 6147 && pc <= 6176) return 'Perth South West / Mandurah';
    return 'Regional WA';
  }

  if (state === 'SA') {
    if (pc >= 5000 && pc <= 5010) return 'Adelaide CBD & Inner';
    if (pc >= 5011 && pc <= 5035) return 'Adelaide West / Beach';
    if (pc >= 5037 && pc <= 5052) return 'Adelaide South';
    if (pc >= 5061 && pc <= 5076) return 'Adelaide East';
    if (pc >= 5081 && pc <= 5130) return 'Adelaide North';
    return 'Regional SA';
  }
  
  if (state === 'ACT') return 'Canberra (All)';
  if (state === 'TAS') return (pc >= 7000 && pc <= 7030) ? 'Hobart & Surrounds' : 'Regional TAS';
  if (state === 'NT') return (pc >= 800 && pc <= 832) ? 'Darwin & Surrounds' : 'Regional NT';

  return 'Other';
}

// Returns true if the suburb is in a major metro area
export function isMetro(state: string, postcode: string): boolean {
  const zone = getRegion(state, postcode);
  return !zone.startsWith('Regional') && zone !== 'Other' && zone !== 'Unknown';
}

// User-facing, clean display group name for the search combobox header
export function getDisplayGroup(state: string, postcode: string): string {
  const pc = parseInt(postcode, 10);
  if (isNaN(pc)) return `Regional ${state}`;

  if (state === 'VIC') {
    if (pc >= 3000 && pc <= 3010) return '🏙️ Inner Melbourne';
    if (pc >= 3011 && pc <= 3030) return '🏙️ Melbourne West';
    if (pc >= 3031 && pc <= 3064) return '🏙️ Melbourne North';
    if (pc >= 3100 && pc <= 3149) return '🏙️ Melbourne East';
    if (pc >= 3150 && pc <= 3199) return '🏙️ Melbourne South-East';
    if (pc >= 3200 && pc <= 3210) return '🏙️ Melbourne Bayside';
    if (pc >= 3211 && pc <= 3220) return '🏙️ Geelong';
    if (pc >= 3975 && pc <= 3999) return '🏙️ Mornington Peninsula';
    return '🌿 Regional Victoria';
  }
  if (state === 'NSW') {
    if (pc >= 2000 && pc <= 2050) return '🏙️ Inner Sydney';
    if (pc >= 2051 && pc <= 2099) return '🏙️ Sydney North Shore';
    if (pc >= 2100 && pc <= 2126) return '🏙️ Sydney Northern Beaches';
    if (pc >= 2127 && pc <= 2199) return '🏙️ Sydney West';
    if (pc >= 2200 && pc <= 2249) return '🏙️ Sydney South';
    if (pc >= 2250 && pc <= 2263) return '🏙️ Central Coast';
    if (pc >= 2264 && pc <= 2309) return '🏙️ Newcastle';
    if (pc >= 2500 && pc <= 2530) return '🏙️ Wollongong';
    return '🌿 Regional NSW';
  }
  if (state === 'QLD') {
    if (pc >= 4000 && pc <= 4037) return '🏙️ Brisbane North';
    if (pc >= 4051 && pc <= 4133) return '🏙️ Brisbane South/West';
    if (pc >= 4151 && pc <= 4179) return '🏙️ Brisbane East';
    if (pc >= 4205 && pc <= 4230) return '🏙️ Gold Coast';
    return '🌿 Regional QLD';
  }
  if (state === 'WA') {
    if (pc >= 6000 && pc <= 6038) return '🏙️ Perth North';
    if (pc >= 6050 && pc <= 6126) return '🏙️ Perth South';
    if (pc >= 6147 && pc <= 6176) return '🏙️ Perth South West';
    return '🌿 Regional WA';
  }
  if (state === 'SA') {
    if (pc >= 5000 && pc <= 5076) return '🏙️ Adelaide';
    if (pc >= 5081 && pc <= 5130) return '🏙️ Adelaide North';
    return '🌿 Regional SA';
  }
  if (state === 'ACT') return '🏙️ Canberra';
  if (state === 'TAS') return (pc >= 7000 && pc <= 7030) ? '🏙️ Hobart' : '🌿 Regional TAS';
  if (state === 'NT') return (pc >= 800 && pc <= 832) ? '🏙️ Darwin' : '🌿 Regional NT';

  return `🌿 Regional ${state}`;
}

// Full state name for display
export function getStateName(state: string): string {
  const names: Record<string, string> = {
    VIC: 'Victoria',
    NSW: 'New South Wales',
    QLD: 'Queensland',
    WA: 'Western Australia',
    SA: 'South Australia',
    ACT: 'ACT / Canberra',
    TAS: 'Tasmania',
    NT: 'Northern Territory',
  };
  return names[state] ?? state;
}

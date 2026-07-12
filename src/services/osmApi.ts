export interface OSMPoi {
  id: number;
  name: string;
  type: string;
  lat: number;
  lon: number;
}

export interface LivabilityData {
  cafes: OSMPoi[];
  parks: OSMPoi[];
  transit: OSMPoi[];
  train_stations: OSMPoi[];
  schools: OSMPoi[];
  walkabilityScore: number;
  transitScoreStandalone: number;
  liveabilityScore: number;
}

export async function fetchLivabilityData(lat: number, lon: number, radius: number = 2500): Promise<LivabilityData> {
  const response = await fetch(`/api/osm/livability?lat=${lat}&lng=${lon}&radius=${radius}`);
  if (!response.ok) {
    throw new Error(`OSM API failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

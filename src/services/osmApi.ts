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
  try {
    const response = await fetch(`/api/osm/livability?lat=${lat}&lng=${lon}&radius=${radius}`);
    
    if (!response.ok) {
        throw new Error("OSM API failed");
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error fetching local OSM data:", err);
    return { cafes: [], parks: [], transit: [], train_stations: [], schools: [], walkabilityScore: 0, transitScoreStandalone: 0, liveabilityScore: 0 };
  }
}

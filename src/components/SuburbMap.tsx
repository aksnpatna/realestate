import { useEffect, useState, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, LayersControl, WMSTileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import VectorGridLayer from './VectorGridLayer';

// Define custom icons
const createCustomIcon = (color: string, emoji: string, size: number = 30) => {
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4); font-size: ${size > 30 ? 24 : 16}px; border: 2px solid white; z-index: ${size > 30 ? 1000 : 1}; position: relative;">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

const primarySchoolIcon = createCustomIcon('#eab308', '🎒'); // Yellow backpack for Primary
const secondarySchoolIcon = createCustomIcon('#8b5cf6', '🎓'); // Purple grad cap for High School/Combined
const earlyLearningIcon = createCustomIcon('#ec4899', '🧸'); // Pink teddy bear for Early Learning
const stationIcon = createCustomIcon('#00f0ff', '🚏'); // Cyan for general transit
const trainStationIcon = createCustomIcon('#00f0ff', '🚉', 45); // Cyan and large for Train Stations
const shoppingIcon = createCustomIcon('#10b981', '🛒'); // Green
const parkIcon = createCustomIcon('#22c55e', '🌲'); // Darker Green for Parks
const cafeIcon = createCustomIcon('#f97316', '☕'); // Orange for Cafe

const getIconForType = (type: string) => {
  if (type === 'train_station') return trainStationIcon;
  if (type === 'transit') return stationIcon;
  if (type === 'shopping') return shoppingIcon;
  if (type === 'park') return parkIcon;
  if (type === 'cafe') return cafeIcon;
  return primarySchoolIcon; // fallback
};

// Component to handle auto-centering when suburb changes
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

interface MapProps {
  center?: [number, number]; // Optional — derived from Nominatim if not provided
  pois: any[];
  schools: any[];
  suburbName: string;
  stateName: string;
  postcode: string;
}

// Default centre of Australia as fallback
const AUSTRALIA_CENTER: [number, number] = [-25.2744, 133.7751];

const boundaryCache = new Map<string, any>();

export default memo(function SuburbMap({ center, pois, schools, suburbName, stateName, postcode }: MapProps) {
  const [activeSchoolZone, setActiveSchoolZone] = useState<{geojson: any, name: string, type: string} | null>(null);

  const getSchoolTypeFromName = (name: string, defaultType: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('kindergarten') || n.includes('early learning') || n.includes('childcare') || n.includes('child care') || n.includes('preschool') || n.includes('early years')) return 'Early Learning';
    if (n.includes('secondary') || n.includes('high') || n.includes('college')) return 'Secondary';
    return defaultType || 'Primary';
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoData, setGeoData] = useState<any>(null);
  const [derivedCenter, setDerivedCenter] = useState<[number, number]>(center || AUSTRALIA_CENTER);
  const [heatmapMode, setHeatmapMode] = useState<'yield' | 'growth'>('yield');

  useEffect(() => {
    setGeoData(null);
    const cacheKey = `${suburbName}-${stateName}-${postcode}`;
    if (boundaryCache.has(cacheKey)) {
      const cached = boundaryCache.get(cacheKey);
      if (cached.geoData) setGeoData(cached.geoData);
      if (cached.center) setDerivedCenter(cached.center);
      else if (center) setDerivedCenter(center);
      return;
    }

    const abortController = new AbortController();

    const fetchBoundary = async () => {
      try {
        const res = await fetch(`/api/osm/boundary?suburb=${encodeURIComponent(suburbName)}&state=${encodeURIComponent(stateName)}`, {
          signal: abortController.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            boundaryCache.set(cacheKey, { geoData: data.geojson, center: data.center });
            if (data.geojson) setGeoData(data.geojson);
            if (data.center) setDerivedCenter(data.center);
            return;
          }
        }
        boundaryCache.set(cacheKey, { geoData: null, center: null });
        setGeoData(null);
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.error("Failed to fetch boundary", e);
        setGeoData(null);
      }
    };
    fetchBoundary();

    return () => {
      abortController.abort();
    };
  }, [suburbName, stateName, postcode, center]);

  return (
    <div className="map-wrapper glass-card">
      <h3 className="map-title" style={{ marginBottom: '5px' }}>Local Infrastructure & Heatmaps</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
        <strong>Interactive Vector Heatmap:</strong> A live nationwide overlay of all 13,000+ suburbs is rendered dynamically via PostGIS. Zoom out to see the national yield distribution, and click on any coloured point to inspect its live data. Use the layer control (top right) to toggle base maps and overlays.
      </p>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setHeatmapMode('yield')}
          style={{ padding: '6px 12px', background: heatmapMode === 'yield' ? 'var(--accent-purple)' : 'var(--bg-card, #f1f5f9)', color: heatmapMode === 'yield' ? '#fff' : 'var(--text-primary, #334155)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
        >
          💰 Rental Yield Hotspots
        </button>
        <button 
          onClick={() => setHeatmapMode('growth')}
          style={{ padding: '6px 12px', background: heatmapMode === 'growth' ? 'var(--accent-cyan)' : 'var(--bg-card, #f1f5f9)', color: heatmapMode === 'growth' ? '#000' : 'var(--text-primary, #334155)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
        >
          📈 Capital Growth Outliers
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', marginLeft: '10px', fontWeight: 500 }}>
          💡 Click on any school marker (🎓/🎒/🧸) to see its official catchment zone.
        </span>
      </div>

      <div className="map-container-inner" style={{ background: '#e5e5e5' }}>
        <MapContainer center={derivedCenter} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '12px' }}>
          
          <ChangeView center={derivedCenter} />
          
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Standard Map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution='Tiles &copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>

            {/* Environmental Overlays (Using generic/mock WMS layers for demo) */}
            <LayersControl.Overlay name="🚨 Flood Risk Zones (1-in-100 Yr)">
              {/* In production, replace with actual State Government SES WMS Tile Server */}
              <WMSTileLayer
                url="https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi"
                layers="nexrad-n0r-900913"
                format="image/png"
                transparent={true}
                opacity={0.4}
                attribution="Mock Flood Overlay (Requires State SES API)"
              />
            </LayersControl.Overlay>
            
            <LayersControl.Overlay name="🔥 Bushfire Prone Area (BAL-29+)">
              {/* In production, replace with actual State RFS/CFA WMS Tile Server */}
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                opacity={0.5}
                attribution="Mock Fire Overlay (Requires State Fire API)"
              />
            </LayersControl.Overlay>

            <LayersControl.Overlay name="📊 Vector Analytics Heatmap" checked>
               <VectorGridLayer url="/tiles/public.suburbs_heatmap_view/{z}/{x}/{y}.pbf" mode={heatmapMode} />
            </LayersControl.Overlay>
          </LayersControl>

          {/* Dynamic Suburb Red Boundary */}
          {geoData && (
            <GeoJSON 
              key={suburbName} 
              data={geoData} 
              style={{
                color: '#ff0000',
                weight: 3,
                opacity: 0.8,
                fillColor: '#ff0000',
                fillOpacity: 0.1
              }} 
            />
          )}
          
          {/* Generic POI Markers (Stations/Shopping/Parks/Cafes) */}
          {pois.map((poi, idx) => {
            const pos = poi.coordinates || (poi.lat && poi.lon ? [poi.lat, poi.lon] : null);
            if (!pos) return null;
            return (
              <Marker key={`poi-${idx}`} position={pos as [number, number]} icon={getIconForType(poi.type)}>
                <Popup className="premium-popup">
                  <strong>{poi.name}</strong><br/>
                  <span style={{textTransform: 'capitalize'}}>{poi.type}</span>
                </Popup>
              </Marker>
            );
          })}
          
          {/* Detailed School Markers */}
          {schools.map((school, idx) => {
            const pos = school.coordinates || (school.lat && school.lon ? [school.lat, school.lon] : null);
            if (!pos) return null;
            
            const typeStr = getSchoolTypeFromName(school.name, school.type);
            let icon = primarySchoolIcon;
            if (typeStr === 'Secondary') icon = secondarySchoolIcon;
            if (typeStr === 'Early Learning') icon = earlyLearningIcon;

            return (
              <Marker 
                key={`school-${idx}`} 
                position={pos as [number, number]} 
                icon={icon}
                eventHandlers={{
                  click: () => {
                    fetch(`/api/v3/school_zone?name=${encodeURIComponent(school.name)}&state=${encodeURIComponent(stateName || 'VIC')}`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.geojson) {
                           setActiveSchoolZone({ geojson: data.geojson, name: school.name, type: typeStr });
                        } else {
                           setActiveSchoolZone(null); // No zone found
                        }
                      }).catch(() => setActiveSchoolZone(null));
                  }
                }}
              >
                <Popup className="premium-popup">
                  <strong>{school.name}</strong><br/>
                  <span style={{textTransform: 'capitalize'}}>{typeStr}</span><br/>
                  <span style={{color: '#94a3b8'}}>
                    {school.stateRank ? `State Rank: #${school.stateRank} | Score: ${school.score}/100 (Est.)` : 'OSM Extracted Data'}
                  </span><br/>
                  <span style={{color: '#8b5cf6', fontSize: '0.8em', marginTop: '4px', display: 'block'}}>
                    Click marker to load Official Catchment Zone
                  </span>
                </Popup>
              </Marker>
            );
          })}

          {/* Active School Zone Overlay */}
          {activeSchoolZone && (
            <GeoJSON 
              key={`school-zone-${activeSchoolZone.name}`}
              data={activeSchoolZone.geojson} 
              style={() => {
                let color = '#3b82f6';
                if (activeSchoolZone.type === 'Secondary') color = '#8b5cf6';
                if (activeSchoolZone.type === 'Early Learning') color = '#ec4899';
                return {
                  fillColor: color,
                  fillOpacity: 0.2,
                  color: color,
                  weight: 3,
                  dashArray: '5 5'
                };
              }}
            />
          )}
        </MapContainer>
      </div>
      
      <div className="map-legend">
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#eab308'}}></span> Primary</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#8b5cf6'}}></span> High School</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#00f0ff'}}></span> Transit</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#10b981'}}></span> Retail</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#f97316'}}></span> Cafe</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#22c55e'}}></span> Park</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#ff0000', borderRadius: '0', height: '4px', width: '20px', display: 'inline-block'}}></span> Boundary</div>
      </div>
    </div>
  );
});

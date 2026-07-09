import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, LayersControl, WMSTileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import VectorGridLayer from './VectorGridLayer';

// Define custom icons
const createCustomIcon = (color: string, emoji: string) => {
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-size: 16px; border: 2px solid white;">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

const primarySchoolIcon = createCustomIcon('#eab308', '🎒'); // Yellow backpack for Primary
const secondarySchoolIcon = createCustomIcon('#8b5cf6', '🎓'); // Purple grad cap for High School/Combined
const stationIcon = createCustomIcon('#00f0ff', '🚉'); // Cyan
const shoppingIcon = createCustomIcon('#10b981', '🛒'); // Green
const parkIcon = createCustomIcon('#22c55e', '🌲'); // Darker Green for Parks
const cafeIcon = createCustomIcon('#f97316', '☕'); // Orange for Cafe

const getIconForType = (type: string) => {
  if (type === 'station' || type === 'transit') return stationIcon;
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

export default function SuburbMap({ center, pois, schools, suburbName, stateName, postcode }: MapProps) {
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
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button 
          onClick={() => setHeatmapMode('yield')}
          style={{ padding: '6px 12px', background: heatmapMode === 'yield' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
        >
          💰 Rental Yield Hotspots
        </button>
        <button 
          onClick={() => setHeatmapMode('growth')}
          style={{ padding: '6px 12px', background: heatmapMode === 'growth' ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: heatmapMode === 'growth' ? '#000' : '#fff' }}
        >
          📈 Capital Growth Outliers
        </button>
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
               <VectorGridLayer url="/tiles/public.suburbs_ui_v3/{z}/{x}/{y}.pbf" mode={heatmapMode} />
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
            return (
              <Marker 
                key={`school-${idx}`} 
                position={pos as [number, number]} 
                icon={school.type === 'Primary' ? primarySchoolIcon : secondarySchoolIcon}
              >
                <Popup className="premium-popup">
                  <strong>{school.name}</strong><br/>
                  <span style={{textTransform: 'capitalize'}}>{school.type || 'School'}</span><br/>
                  <span style={{color: '#94a3b8'}}>
                    {school.stateRank ? `State Rank: #${school.stateRank} | Score: ${school.score}/100 (Est.)` : 'OSM Extracted Data'}
                  </span>
                </Popup>
              </Marker>
            );
          })}
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
}

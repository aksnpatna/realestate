import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { POI, School } from '../data/suburbs';

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

const getIconForType = (type: string) => {
  if (type === 'station') return stationIcon;
  if (type === 'shopping') return shoppingIcon;
  return primarySchoolIcon; // fallback
};

// Component to handle auto-centering when suburb changes
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13); // Zoomed out slightly to fit boundary
  }, [center, map]);
  return null;
}

interface MapProps {
  center: [number, number];
  pois: POI[];
  schools: School[];
  suburbName: string;
  stateName: string;
  postcode: string;
}

export default function SuburbMap({ center, pois, schools, suburbName, stateName, postcode }: MapProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    setGeoData(null);
    const fetchBoundary = async () => {
      try {
        const base = 'https://nominatim.openstreetmap.org';
        const stateFull: Record<string, string> = {
          VIC: 'Victoria', NSW: 'New South Wales', QLD: 'Queensland',
          WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania',
          ACT: 'Australian Capital Territory', NT: 'Northern Territory'
        };
        const sf = stateFull[stateName] || stateName;

        const queries = [
          `${suburbName}, ${sf}, Australia`,
          `${suburbName} ${postcode}, ${sf}, Australia`,
          `${suburbName}, ${stateName} ${postcode}, Australia`,
        ];

        for (const q of queries) {
          const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&polygon_geojson=1&format=json&countrycodes=au`);
          const data = await res.json();
          if (data && data.length > 0) {
            const match = data.find((d: any) =>
              d.geojson && (d.geojson.type === 'Polygon' || d.geojson.type === 'MultiPolygon')
            );
            if (match) {
              setGeoData(match.geojson);
              return;
            }
          }
        }
        setGeoData(null);
      } catch (e) {
        console.error("Failed to fetch boundary", e);
        setGeoData(null);
      }
    };
    fetchBoundary();
  }, [suburbName, stateName, postcode]);

  return (
    <div className="map-wrapper glass-card">
      <h3 className="map-title">Local Infrastructure & Boundaries</h3>
      <div className="map-container-inner" style={{ background: '#e5e5e5' }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '12px' }}>
          
          {/* Standard Light Map for better street readability */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ChangeView center={center} />
          
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
          
          {/* Generic POI Markers (Stations/Shopping) */}
          {pois.map((poi, idx) => (
            <Marker key={`poi-${idx}`} position={poi.coordinates} icon={getIconForType(poi.type)}>
              <Popup className="premium-popup">
                <strong>{poi.name}</strong><br/>
                <span style={{textTransform: 'capitalize'}}>{poi.type}</span>
              </Popup>
            </Marker>
          ))}
          
          {/* Detailed School Markers */}
          {schools.map((school, idx) => (
            <Marker 
              key={`school-${idx}`} 
              position={school.coordinates} 
              icon={school.type === 'Primary' ? primarySchoolIcon : secondarySchoolIcon}
            >
              <Popup className="premium-popup">
                <strong>{school.name}</strong><br/>
                <span style={{textTransform: 'capitalize'}}>{school.type} School</span><br/>
                <span style={{color: '#94a3b8'}}>State Rank: #{school.stateRank} | Score: {school.score}/100</span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      <div className="map-legend">
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#eab308'}}></span> Primary</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#8b5cf6'}}></span> High School</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#00f0ff'}}></span> Transit</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#10b981'}}></span> Retail</div>
        <div className="legend-item"><span className="legend-color" style={{backgroundColor: '#ff0000', borderRadius: '0', height: '4px', width: '20px', display: 'inline-block'}}></span> Boundary</div>
      </div>
    </div>
  );
}

import { useState, memo } from 'react';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import VectorGridLayer from './VectorGridLayer';

const AUSTRALIA_CENTER: [number, number] = [-25.2744, 133.7751];

export default memo(function YieldHeatmap() {
  const [heatmapMode, setHeatmapMode] = useState<'yield' | 'growth'>('yield');
  const [propertyType, setPropertyType] = useState<'house' | 'unit'>('house');

  return (
    <div className="glass-card" style={{ height: 'calc(100vh - 200px)', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🗺️ National Yield & Growth Explorer
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0', fontSize: '0.95rem' }}>
          Explore the live distribution of capital growth and rental yield across 13,000+ suburbs in Australia. 
          Powered by PostGIS vector tiles. Click any colored point to see the live metrics.
        </p>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setHeatmapMode('yield')}
              className={heatmapMode === 'yield' ? 'tab-btn tab-active' : 'tab-btn'}
              style={{ padding: '8px 16px', borderRadius: '8px' }}
            >
              💰 Rental Yield
            </button>
            <button 
              onClick={() => setHeatmapMode('growth')}
              className={heatmapMode === 'growth' ? 'tab-btn tab-active' : 'tab-btn'}
              style={{ padding: '8px 16px', borderRadius: '8px' }}
            >
              📈 Capital Growth
            </button>
          </div>
          
          <div style={{ width: '1px', height: '30px', background: 'var(--border-glass)' }}></div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setPropertyType('house')}
              className={propertyType === 'house' ? 'tab-btn tab-active' : 'tab-btn'}
              style={{ padding: '8px 16px', borderRadius: '8px', background: propertyType === 'house' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
            >
              🏠 Houses
            </button>
            <button 
              onClick={() => setPropertyType('unit')}
              className={propertyType === 'unit' ? 'tab-btn tab-active' : 'tab-btn'}
              style={{ padding: '8px 16px', borderRadius: '8px', background: propertyType === 'unit' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
            >
              🏢 Units
            </button>
          </div>
        </div>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={AUSTRALIA_CENTER} zoom={5} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer name="Dark Theme">
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
            </LayersControl.BaseLayer>
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

            <LayersControl.Overlay name="Vector Analytics Heatmap" checked>
               <VectorGridLayer url="/tiles/public.suburbs_ui_v3/{z}/{x}/{y}.pbf" mode={heatmapMode} propertyType={propertyType} />
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>
        
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, background: 'rgba(30, 41, 59, 0.9)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>Legend ({heatmapMode === 'yield' ? 'Yield' : 'Growth'})</h4>
          {heatmapMode === 'yield' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#10b981', border: '2px solid black' }}></div>
                <span style={{ fontSize: '0.8rem' }}>High (≥ 6%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f59e0b', border: '2px solid black' }}></div>
                <span style={{ fontSize: '0.8rem' }}>Medium (4% - 6%)</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#06b6d4', border: '2px solid black' }}></div>
                <span style={{ fontSize: '0.8rem' }}>High (≥ 10%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6', border: '2px solid black' }}></div>
                <span style={{ fontSize: '0.8rem' }}>Medium (5% - 10%)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

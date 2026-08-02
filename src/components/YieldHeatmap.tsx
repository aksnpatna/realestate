import { useState, memo } from 'react';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import VectorGridLayer from './VectorGridLayer';

const AUSTRALIA_CENTER: [number, number] = [-25.2744, 133.7751];

export default memo(function YieldHeatmap() {
  const [heatmapMode, setHeatmapMode] = useState<'yield' | 'growth'>('yield');
  const [propertyType, setPropertyType] = useState<'house' | 'unit'>('house');

  return (
    <div className="glass-card u-930e5b1a">
      <div className="u-873a84fa">
        <h2 className="u-575561fc">
          🗺️ National Yield & Growth Explorer
        </h2>
        <p className="u-565a9983">
          Explore the live distribution of capital growth and rental yield across 13,000+ suburbs in Australia. 
          Powered by PostGIS vector tiles. Click any colored point to see the live metrics.
        </p>
        
        <div className="u-afd6810c">
          <div className="u-bccf3703">
            <button 
              onClick={() => setHeatmapMode('yield')}
              className={`u-2248a78d ${heatmapMode === 'yield' ? 'tab-btn tab-active' : 'tab-btn'}`}
            >
              💰 Rental Yield
            </button>
            <button 
              onClick={() => setHeatmapMode('growth')}
              className={`u-2248a78d ${heatmapMode === 'growth' ? 'tab-btn tab-active' : 'tab-btn'}`}
            >
              📈 Capital Growth
            </button>
          </div>
          
          <div className="u-e5fae9ee"></div>
          
          <div className="u-bccf3703">
            <button 
              onClick={() => setPropertyType('house')}
              className={`u-2248a78d ${propertyType === 'house' ? 'tab-btn tab-active' : 'tab-btn'}`} style={{background: propertyType === 'house' ? 'rgba(255,255,255,0.1)' : 'transparent'}}
            >
              🏠 Houses
            </button>
            <button 
              onClick={() => setPropertyType('unit')}
              className={`u-2248a78d ${propertyType === 'unit' ? 'tab-btn tab-active' : 'tab-btn'}`} style={{background: propertyType === 'unit' ? 'rgba(255,255,255,0.1)' : 'transparent'}}
            >
              🏢 Units
            </button>
          </div>
        </div>
      </div>
      
      <div className="u-d882e5b3">
        <MapContainer center={AUSTRALIA_CENTER} zoom={5} className="u-d7d5c0b4">
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
               <VectorGridLayer key={`${heatmapMode}-${propertyType}`} url="/tiles/public.suburbs_heatmap_view/{z}/{x}/{y}.pbf" mode={heatmapMode} propertyType={propertyType} />
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>
        
        <div className="u-6cc56b36">
          <h4 className="u-d83e0017">Legend ({heatmapMode === 'yield' ? 'Yield' : 'Growth'})</h4>
          {heatmapMode === 'yield' ? (
            <>
              <div className="u-9fc60153">
                <div className="u-2d4e4033"></div>
                <span className="u-c0024dfb">High (≥ 6%)</span>
              </div>
              <div className="u-6e6177ef">
                <div className="u-8fe38c67"></div>
                <span className="u-c0024dfb">Medium (4% - 6%)</span>
              </div>
            </>
          ) : (
            <>
              <div className="u-9fc60153">
                <div className="u-cc832044"></div>
                <span className="u-c0024dfb">High (≥ 10%)</span>
              </div>
              <div className="u-6e6177ef">
                <div className="u-a5871954"></div>
                <span className="u-c0024dfb">Medium (5% - 10%)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

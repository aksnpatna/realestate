import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

interface VectorGridProps {
  url: string;
  zIndex?: number;
  mode?: 'yield' | 'growth';
  propertyType?: 'house' | 'unit';
}

export default function VectorGridLayer({ url, zIndex = 400, mode = 'yield', propertyType = 'house' }: VectorGridProps) {
  const map = useMap();

  useEffect(() => {
    // Define the vector grid layer using protobuf
    const vectorGrid = (L as any).vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        'public.suburbs_heatmap_view': function(properties: any, zoom: number) {
          const yieldPct = propertyType === 'house' ? (properties.house_gross_rental_yield || 0) : (properties.unit_gross_rental_yield || 0);
          const growth = propertyType === 'house' ? (properties.house_median_price_12m_change_pct || 0) : (properties.unit_median_price_12m_change_pct || 0);
          
          let color = '#ef4444'; // Default Red
          let radius = 0;
          let opacity = 0;
          let stroke = false;
          
          if (mode === 'yield') {
            if (yieldPct >= 6) { color = '#10b981'; opacity = 0.9; stroke = true; radius = zoom > 12 ? 32 : (zoom > 8 ? 16 : 8); }
            else if (yieldPct >= 4) { color = '#f59e0b'; opacity = 0.6; stroke = true; radius = zoom > 12 ? 16 : (zoom > 8 ? 8 : 4); }
            else { return []; } // Filter out poor yield noise entirely
          } else {
            // Growth Mode
            if (growth >= 10) { color = '#06b6d4'; opacity = 0.9; stroke = true; radius = zoom > 12 ? 32 : (zoom > 8 ? 16 : 8); }
            else if (growth >= 5) { color = '#3b82f6'; opacity = 0.6; stroke = true; radius = zoom > 12 ? 16 : (zoom > 8 ? 8 : 4); }
            else { return []; } // Filter out poor growth noise entirely
          }
          
          return {
            fill: true,
            fillColor: color,
            fillOpacity: opacity,
            stroke: stroke,
            color: 'black',
            weight: 2,
            radius: radius
          };
        }
      },
      interactive: true,
      zIndex: 400
    });

    // Add interactivity
    vectorGrid.on('click', (e: any) => {
      const props = e.layer.properties;
      L.popup()
        .setContent(`
          <div style="font-family: sans-serif; min-width: 150px;">
            <h4 style="margin: 0 0 5px 0; color: #1e293b;">${props.name} <span style="font-weight: normal; font-size: 0.8em; color: #64748b;">(${propertyType})</span></h4>
            <div style="font-size: 0.9em; color: #475569;">
              Yield: <strong>${(propertyType === 'house' ? props.house_gross_rental_yield : props.unit_gross_rental_yield) || 'N/A'}%</strong><br/>
              Growth (12m): <strong>${Math.round((propertyType === 'house' ? props.house_median_price_12m_change_pct : props.unit_median_price_12m_change_pct) || 0)}%</strong><br/>
              Median: <strong>$${((propertyType === 'house' ? props.house_median_price : props.unit_median_price) || 0).toLocaleString()}</strong>
            </div>
          </div>
        `)
        .setLatLng(e.latlng)
        .openOn(map);
    });

    vectorGrid.addTo(map);

    return () => {
      map.removeLayer(vectorGrid);
    };
  }, [map, url, zIndex, mode, propertyType]);

  return null;
}

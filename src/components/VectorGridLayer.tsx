import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

interface VectorGridProps {
  url: string;
  zIndex?: number;
  mode?: 'yield' | 'growth';
}

export default function VectorGridLayer({ url, zIndex = 400, mode = 'yield' }: VectorGridProps) {
  const map = useMap();

  useEffect(() => {
    // Define the vector grid layer using protobuf
    const vectorGrid = (L as any).vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        // Name of the layer served by pg_tileserv is 'public.suburbs_ui_v3'
        'public.suburbs_ui_v3': function(properties: any, zoom: number) {
          const yieldPct = properties.house_gross_rental_yield || 0;
          const growth = properties.growth_score || 0;
          
          let color = '#ef4444'; // Default Red
          let radius = 0;
          let opacity = 0;
          let stroke = false;
          
          if (mode === 'yield') {
            if (yieldPct >= 6) { color = '#10b981'; opacity = 0.9; stroke = true; radius = zoom > 12 ? 32 : (zoom > 8 ? 16 : 8); }
            else if (yieldPct >= 4) { color = '#f59e0b'; opacity = 0.6; stroke = true; radius = zoom > 12 ? 16 : (zoom > 8 ? 8 : 4); }
            else { opacity = 0; stroke = false; } // Filter out poor yield noise
          } else {
            // Growth Mode
            if (growth >= 70) { color = '#06b6d4'; opacity = 0.9; stroke = true; radius = zoom > 12 ? 32 : (zoom > 8 ? 16 : 8); }
            else if (growth >= 50) { color = '#3b82f6'; opacity = 0.6; stroke = true; radius = zoom > 12 ? 16 : (zoom > 8 ? 8 : 4); }
            else { opacity = 0; stroke = false; } // Filter out poor growth noise
          }
          
          return {
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
            <h4 style="margin: 0 0 5px 0; color: #1e293b;">${props.name}</h4>
            <div style="font-size: 0.9em; color: #475569;">
              Yield: <strong>${props.house_gross_rental_yield || 'N/A'}%</strong><br/>
              Growth Score: <strong>${Math.round(props.growth_score || 0)}/100</strong><br/>
              Median: <strong>$${(props.house_median_price || 0).toLocaleString()}</strong>
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
  }, [map, url, zIndex, mode]);

  return null;
}

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

interface VectorGridProps {
  url: string;
  zIndex?: number;
}

export default function VectorGridLayer({ url, zIndex = 400 }: VectorGridProps) {
  const map = useMap();

  useEffect(() => {
    // Define the vector grid layer using protobuf
    const vectorGrid = (L as any).vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        // Name of the layer served by pg_tileserv is 'public.suburbs_ui_v3'
        'public.suburbs_ui_v3': function(properties: any, zoom: number) {
          // Heatmap styling logic based on gross rental yield
          const yieldPct = properties.house_gross_rental_yield || 0;
          let color = '#ef4444'; // Red (Poor)
          if (yieldPct >= 6) color = '#10b981'; // Green (Excellent)
          else if (yieldPct >= 4) color = '#f59e0b'; // Amber (Moderate)
          
          return {
            fillColor: color,
            fillOpacity: 0.8,
            stroke: true,
            color: 'black',
            weight: 2,
            radius: zoom > 12 ? 14 : (zoom > 8 ? 8 : 4)
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
  }, [map, url, zIndex]);

  return null;
}

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

interface VectorGridProps {
  url: string;
  zIndex?: number;
  mode?: 'yield' | 'growth' | 'sa1_income';
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
        },
        'default': function(properties: any) {
          const income = properties.median_household_income || 0;
          let color = '#f1f5f9';
          if (income >= 3000) color = '#10b981';
          else if (income >= 2500) color = '#34d399';
          else if (income >= 2000) color = '#6ee7b7';
          else if (income >= 1500) color = '#fcd34d';
          else if (income >= 1000) color = '#fb923c';
          else if (income > 0) color = '#ef4444';

          return {
            fill: true,
            fillColor: color,
            fillOpacity: 0.6,
            stroke: true,
            color: '#334155',
            weight: 1
          };
        }
      },
      interactive: true,
      zIndex: zIndex
    });

    // Add interactivity
    const showPopup = (e: any) => {
      // Make it more dynamic: pop up on hover, but stop if zoomed out a lot (e.g. < 6)
      if (e.type === 'mouseover' && map.getZoom() < 6) return;
      
      const props = e.layer.properties;
      
      if (props.sa1_code_2021) {
        L.popup()
          .setContent(`
            <div style="font-family: sans-serif; min-width: 150px; color: #f8fafc;">
              <h4 style="margin: 0 0 5px 0; color: #ffffff;">SA1 Pocket</h4>
              <div style="font-size: 0.9em; color: #cbd5e1;">
                SA1 Code: <strong style="color: #ffffff;">${props.sa1_code_2021}</strong><br/>
                Median Income: <strong style="color: #ffffff;">$${props.median_household_income}/wk</strong><br/>
                Population: <strong style="color: #ffffff;">${props.population}</strong>
              </div>
            </div>
          `)
          .setLatLng(e.latlng)
          .openOn(map);
        return;
      }

      L.popup()
        .setContent(`
          <div style="font-family: sans-serif; min-width: 150px; color: #f8fafc;">
            <h4 style="margin: 0 0 5px 0; color: #ffffff;">${props.name} <span style="font-weight: normal; font-size: 0.8em; color: #94a3b8;">(${propertyType})</span></h4>
            <div style="font-size: 0.9em; color: #cbd5e1;">
              Yield: <strong style="color: #ffffff;">${(propertyType === 'house' ? props.house_gross_rental_yield : props.unit_gross_rental_yield) || 'N/A'}%</strong><br/>
              Growth (12m): <strong style="color: #ffffff;">${Math.round((propertyType === 'house' ? props.house_median_price_12m_change_pct : props.unit_median_price_12m_change_pct) || 0)}%</strong><br/>
              Median: <strong style="color: #ffffff;">$${((propertyType === 'house' ? props.house_median_price : props.unit_median_price) || 0).toLocaleString()}</strong>
            </div>
          </div>
        `)
        .setLatLng(e.latlng)
        .openOn(map);
    };

    vectorGrid.on('click', showPopup);
    vectorGrid.on('mouseover', showPopup);
    vectorGrid.on('mouseout', () => map.closePopup());

    vectorGrid.addTo(map);

    return () => {
      map.removeLayer(vectorGrid);
    };
  }, [map, url, zIndex, mode, propertyType]);

  return null;
}

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

interface SchoolZonesLayerProps {
  url?: string;
  zIndex?: number;
  activeSuburb?: string;
}

export default function SchoolZonesLayer({ url = "/tiles/public.get_school_zones/{z}/{x}/{y}.pbf", zIndex = 300, activeSuburb }: SchoolZonesLayerProps) {
  const map = useMap();

  useEffect(() => {
    // Add suburb parameter if activeSuburb is provided
    let tileUrl = url;
    if (activeSuburb) {
      tileUrl = `${url}?suburb_name=${encodeURIComponent(activeSuburb)}`;
    }

    // Define the vector grid layer using protobuf
    const vectorGrid = (L as any).vectorGrid.protobuf(tileUrl, {
      vectorTileLayerStyles: {
        'public.get_school_zones': function(properties: any, _zoom: number) {
          const type = properties.school_type || '';
          
          let color = '#3b82f6'; // Blue for Primary
          if (type.toLowerCase().includes('secondary') || type.toLowerCase().includes('high')) {
            color = '#8b5cf6'; // Purple for Secondary
          }
          
          return {
            fill: true,
            fillColor: color,
            fillOpacity: 0.15,
            stroke: true,
            color: color,
            weight: 2,
            opacity: 0.8,
            dashArray: '4 4' // Dashed line for catchment boundaries
          };
        }
      },
      interactive: true,
      zIndex: zIndex
    });

    // Add interactivity
    vectorGrid.on('click', (e: any) => {
      const props = e.layer.properties;
      L.popup()
        .setContent(`
          <div style="font-family: sans-serif; min-width: 150px;">
            <h4 style="margin: 0 0 5px 0; color: #1e293b;">🏫 ${props.school_name || 'Unknown School'}</h4>
            <div style="font-size: 0.9em; color: #475569;">
              Type: <strong>${props.school_type || 'N/A'}</strong><br/>
              State: <strong>${props.state || 'VIC'}</strong>
            </div>
            <div style="font-size: 0.8em; margin-top: 8px; color: #64748b; font-style: italic;">
              Official Intake Zone Boundary
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
  }, [map, url, zIndex, activeSuburb]);

  return null;
}

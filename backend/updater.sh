#!/bin/bash

# Wait for DB to be ready
until pg_isready -h db -U realestate_user -d realestate; do
  echo "Waiting for database..."
  sleep 5
done

while true; do
  echo "[$(date)] Starting OSM data sync..."
  
  # Download the latest Australia OSM data (approx 1.1GB)
  wget -q -O /tmp/australia.osm.pbf https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf
  
  if [ -f "/tmp/australia.osm.pbf" ]; then
    echo "[$(date)] Download complete. Importing into PostGIS..."
    export PGPASSWORD=realestate_pass
    # Use --slim and --cache 200 to keep memory usage low to prevent OOM killed
    osm2pgsql --create --database realestate --host db --username realestate_user --port 5432 --slim --cache 200 /tmp/australia.osm.pbf
    
    echo "[$(date)] Import successful."
    rm /tmp/australia.osm.pbf
  else
    echo "[$(date)] Download failed!"
  fi
  
  echo "[$(date)] Sleeping for 7 days..."
  sleep 604800 # 7 days in seconds
done

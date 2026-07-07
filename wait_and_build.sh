#!/bin/bash
while kill -0 $(cat /proc/$(pidof -s python3)/stat | cut -d' ' -f1 2>/dev/null) 2>/dev/null; do
    sleep 5
done
echo "Python script finished. Rebuilding docker images..."
docker compose up -d --build

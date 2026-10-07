#!/bin/bash
cd /home/aksai/projects/realestate
set -a
source .env
set +a
export DATABASE_URL="postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:15432/${POSTGRES_DB}"
export PREWARM_USER_ID="3204533e90cefe846341d3cb4f684088"
cd backend
python3 prewarm_ai_cache.py

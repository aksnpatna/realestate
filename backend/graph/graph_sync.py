import logging
from sqlalchemy import text
from graph.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)

def sync_suburbs_to_graph(db_session):
    """
    Weekly ETL job to sync Postgres `suburbs_ui_v3` data into Neo4j.
    Creates Suburb, MarketState, and Demographic nodes and edges.
    """
    logger.info("Starting Postgres to Neo4j Sync...")
    
    # Fetch all live suburbs
    sql = text("""
        SELECT id, name, state, postcode, coordinates, house_median_price,
               house_gross_rental_yield, vacancy_rate, population_cagr,
               school_quality, avg_icsea, top_school_name,
               transit_accessibility, parks_count, safety_score,
               investor_rate, owner_occupier_rate
        FROM suburbs_ui_v3
        WHERE coordinates IS NOT NULL AND is_live = true
    """)
    
    suburbs = db_session.execute(sql).fetchall()
    
    # Base Cypher query to UPSERT suburb and market state
    cypher = """
    UNWIND $batch AS row
    MERGE (s:Suburb {id: row.id})
    SET s.name = row.name,
        s.state = row.state,
        s.postcode = row.postcode,
        s.lat = row.lat,
        s.lon = row.lon
    
    MERGE (m:MarketState {suburb_id: row.id})
    SET m.median_price = row.house_median_price,
        m.yield = row.house_gross_rental_yield,
        m.vacancy = row.vacancy_rate,
        m.population_cagr = row.population_cagr
        
    MERGE (s)-[:HAS_MARKET_STATE]->(m)
    
    MERGE (sch:School {name: row.top_school_name})
    ON CREATE SET sch.icsea = row.avg_icsea,
                  sch.quality = row.school_quality
    
    WITH s, sch, row
    WHERE row.school_quality IS NOT NULL
    MERGE (s)-[:HAS_SCHOOL]->(sch)
    """
    
    batch = []
    for s in suburbs:
        row = dict(s._mapping)
        coords = row.get("coordinates")
        if isinstance(coords, list) and len(coords) == 2:
            row["lat"] = float(coords[0])
            row["lon"] = float(coords[1])
        else:
            row["lat"] = None
            row["lon"] = None
            
        if not row.get("top_school_name"):
            row["top_school_name"] = f"Unknown School {row.get('name', '')}"
            
        batch.append(row)
        
    # Execute in Neo4j
    neo4j_client.query(cypher, parameters={"batch": batch})
    
    logger.info(f"Successfully synced {len(batch)} suburbs to Neo4j.")

if __name__ == "__main__":
    from models_v3 import SessionLocal
    db = SessionLocal()
    try:
        sync_suburbs_to_graph(db)
    finally:
        db.close()

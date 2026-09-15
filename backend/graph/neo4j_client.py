import os
import logging
from neo4j import GraphDatabase, exceptions

logger = logging.getLogger(__name__)

class Neo4jClient:
    def __init__(self):
        uri = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
        # In docker-compose, the host is 'neo4j'
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "secretpassword")
        
        try:
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            logger.info("Connected to Neo4j successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j at {uri}: {e}")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def query(self, query, parameters=None, db=None):
        assert self.driver is not None, "Driver not initialized!"
        session = None
        response = None
        try:
            session = self.driver.session(database=db) if db else self.driver.session()
            response = list(session.run(query, parameters))
        except Exception as e:
            logger.error(f"Query failed: {e}")
            raise e
        finally:
            if session:
                session.close()
        return response

neo4j_client = Neo4jClient()

import os
import sys
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3, SuburbPriceHistory, Base

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    print("Fetching V3 Suburbs...")
    suburbs = db.query(SuburbUIV3).filter(SuburbUIV3.is_enriched == True).all()
    print(f"Found {len(suburbs)} enriched suburbs to process.")
    
    # Fast bulk insert setup
    objects_to_insert = []
    
    for s in suburbs:
        if s.history_10yr and isinstance(s.history_10yr, list):
            for entry in s.history_10yr:
                if isinstance(entry, dict) and "date" in entry and "value" in entry:
                    try:
                        # Handle dates like "2015", "2015-05", "2015-05-12"
                        date_str = str(entry["date"])
                        if len(date_str) == 4:
                            date_str += "-01-01"
                        elif len(date_str) == 7:
                            date_str += "-01"
                        elif len(date_str) > 10:
                            date_str = date_str[:10]
                            
                        dt = datetime.strptime(date_str, "%Y-%m-%d")
                        val = float(entry["value"])
                        if val > 0:
                            objects_to_insert.append(
                                SuburbPriceHistory(
                                    suburb_id=s.id,
                                    property_type="house",
                                    record_date=dt,
                                    median_price=val,
                                    median_rent=0 # Leaving rent 0 for now unless we merge history_rent_10yr
                                )
                            )
                    except Exception as e:
                        pass
    
    print(f"Built {len(objects_to_insert)} price history records. Bulk inserting...")
    
    # Wipe table to make idempotent
    db.query(SuburbPriceHistory).delete()
    
    # Batch insert
    batch_size = 5000
    for i in range(0, len(objects_to_insert), batch_size):
        db.bulk_save_objects(objects_to_insert[i:i+batch_size])
        db.commit()
        print(f"Inserted {min(i+batch_size, len(objects_to_insert))} / {len(objects_to_insert)}")
        
    db.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from parallel_scraper import SuburbAllModel

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def rank_and_flag_live_suburbs():
    db = SessionLocal()
    
    # First, reset all
    db.query(SuburbAllModel).update({"is_live": False})
    db.commit()
    
    # Define metro postcode ranges
    metro_ranges = [
        # Greater Melbourne (3000-3220, 3750-3999, etc. but per our chat we use 3000-3220 for inner/middle and we want ~2000 total across AU. We will just use the exact contiguous blocks discussed)
        ('VIC', '3000', '3220'),
        ('NSW', '2000', '2234'),
        ('NSW', '2555', '2786'),
        ('QLD', '4000', '4549'),
        ('SA', '5000', '5199'),
        ('TAS', '7000', '7099')
    ]
    
    total_flagged = 0
    for state, p_start, p_end in metro_ranges:
        count = db.query(SuburbAllModel).filter(
            SuburbAllModel.state == state,
            SuburbAllModel.postcode >= p_start,
            SuburbAllModel.postcode <= p_end,
            SuburbAllModel.status == 'complete'
        ).update({"is_live": True}, synchronize_session=False)
        db.commit()
        print(f"Flagged {count} live suburbs in {state} ({p_start}-{p_end})")
        total_flagged += count
        
    print(f"Total live suburbs flagged: {total_flagged}")
    db.close()

if __name__ == "__main__":
    rank_and_flag_live_suburbs()

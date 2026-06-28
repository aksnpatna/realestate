import os
import json
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from ai_agent import get_suburb_sentiment
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class SuburbModel(Base):
    __tablename__ = "suburbs"
    id = Column(String, primary_key=True, index=True)
    data = Column(JSON)

Base.metadata.create_all(bind=engine)

def load_initial_data():
    db = SessionLocal()
    try:
        if not os.path.exists("suburbs_data.json"):
            print("suburbs_data.json not found, skipping load")
            db.close()
            return
        with open("suburbs_data.json", "r") as f:
            data = json.load(f)
        json_ids = set(item["id"] for item in data)
        db_ids = set(row[0] for row in db.query(SuburbModel.id).all())
        new_ids = json_ids - db_ids
        update_ids = json_ids & db_ids
        stale_ids = db_ids - json_ids
        if new_ids:
            for item in data:
                if item["id"] in new_ids:
                    db.add(SuburbModel(id=item["id"], data=item))
            print(f"Added {len(new_ids)} new suburbs")
        if update_ids:
            for item in data:
                if item["id"] in update_ids:
                    db.query(SuburbModel).filter(SuburbModel.id == item["id"]).update({"data": item})
            print(f"Updated {len(update_ids)} existing suburbs")
        if stale_ids:
            db.query(SuburbModel).filter(SuburbModel.id.in_(stale_ids)).delete(synchronize_session=False)
            print(f"Removed {len(stale_ids)} stale suburbs")
        db.commit()
        total = db.query(SuburbModel).count()
        print(f"Database now has {total} suburbs")
    except Exception as e:
        db.rollback()
        print("Failed to load initial data:", e)
    db.close()

@app.on_event("startup")
def startup_event():
    load_initial_data()
    try:
        from scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        print(f"Scheduler start failed (non-fatal): {e}")

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/login")
def login(request: LoginRequest):
    if request.email.strip() == "teraamit@gmail.com" and request.password.strip() == "password321":
        return {"token": "fake-jwt-token"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/suburbs")
def get_suburbs():
    db = SessionLocal()
    suburbs = db.query(SuburbModel).all()
    db.close()
    return [s.data for s in suburbs]

class AnalyzeRequest(BaseModel):
    suburb: str
    state: str
    id: str

@app.post("/api/analyze-suburb")
def analyze_suburb(req: AnalyzeRequest, db: Session = Depends(get_db)):
    try:
        ai_result = get_suburb_sentiment(req.suburb, req.state)
        suburb_record = db.query(SuburbModel).filter(SuburbModel.id == req.id).first()
        if suburb_record:
            data = suburb_record.data
            if "metrics" not in data:
                data["metrics"] = {}
            data["metrics"]["aiNewsSentiment"] = ai_result["sentiment"]
            data["metrics"]["aiNewsSummary"] = ai_result["summary"]
            suburb_record.data = data
            db.commit()
            return {"status": "success", "sentiment": ai_result["sentiment"], "summary": ai_result["summary"]}
        return {"status": "error", "message": "Suburb not found in database"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reload")
def reload_suburbs():
    load_initial_data()
    db = SessionLocal()
    total = db.query(SuburbModel).count()
    db.close()
    return {"status": "ok", "suburbs": total}

@app.post("/api/pipeline/run")
def run_pipeline_manually():
    try:
        import subprocess, sys
        result = subprocess.run(
            [sys.executable, os.path.join(os.path.dirname(__file__), "update_pipeline.py")],
            capture_output=True, text=True, timeout=300
        )
        load_initial_data()
        db = SessionLocal()
        total = db.query(SuburbModel).count()
        db.close()
        return {
            "status": "ok" if result.returncode == 0 else "warning",
            "suburbs": total,
            "pipeline_output": result.stdout[-500:] + result.stderr[-500:]
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


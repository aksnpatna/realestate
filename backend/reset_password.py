#!/usr/bin/env python3
import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import UserModel
from dotenv import load_dotenv
import os

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()
user = db.query(UserModel).filter(UserModel.email == "test@test.com").first()
if user:
    user.password_hash = bcrypt.hashpw(b"test123", bcrypt.gensalt()).decode("utf-8")
    user.salt = ""
    db.commit()
    print("Password reset successfully")
else:
    print("User not found")
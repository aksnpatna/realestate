import sys
import bcrypt
from models_v3 import SessionLocal
from main import UserModel

def get_hash(pwd):
    return bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def update_password(email: str, new_password: str):
    db = SessionLocal()
    user = db.query(UserModel).filter(UserModel.email == email.lower()).first()
    
    if not user:
        print(f"User {email} not found in database.")
        # If user not found, create one
        import secrets
        from datetime import datetime
        print("Creating user instead...")
        user = UserModel(
            id=secrets.token_hex(16),
            email=email.lower(),
            password_hash=get_hash(new_password),
            salt="",
            created_at=datetime.now().isoformat()
        )
        db.add(user)
        db.commit()
        print(f"User {email} created with new password.")
        return

    user.password_hash = get_hash(new_password)
    user.salt = ""
    db.commit()
    print(f"Password for {email} updated successfully.")

if __name__ == "__main__":
    update_password("teraamit@gmail.com", "guest321")

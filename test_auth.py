from models_v3 import SessionLocal
from main import UserModel, verify_password

db = SessionLocal()
user = db.query(UserModel).filter(UserModel.email == 'teraamit@gmail.com').first()
print(f'Hash in DB: {user.password_hash}')
print(f'Salt in DB: {repr(user.salt)}')
print('Verify:', verify_password('password321', user.password_hash))

import bcrypt
password = b"test1234"
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed.decode())
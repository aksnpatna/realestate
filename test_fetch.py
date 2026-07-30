import os
import jwt
from datetime import datetime, timezone
import requests
import json

JWT_SECRET = os.environ.get("JWT_SECRET", "super-secret-default-key-for-dev-only-min-32-chars")
token = jwt.encode({"sub": "mock", "exp": datetime.now(timezone.utc).timestamp() + 86400}, JWT_SECRET, algorithm="HS256")

r = requests.get("http://localhost:8100/api/suburbs", cookies={"access_token": token})
print("Status:", r.status_code)
try:
    data = r.json()
    print("Type:", type(data))
    if isinstance(data, list):
        print("Length:", len(data))
except Exception as e:
    print("Error parsing:", e)
    print("Raw text snippet:", r.text[:200])

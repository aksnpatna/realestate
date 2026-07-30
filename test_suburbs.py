import requests
s = requests.Session()
r = s.post("http://localhost:8100/api/login", json={"email":"demouser@example.com", "password":"password123"})
print(r.status_code, r.text)
r = s.get("http://localhost:8100/api/suburbs")
print(r.status_code, len(r.text))
try:
    data = r.json()
    print("Parsed JSON. Type:", type(data), "Len:", len(data) if isinstance(data, list) else "N/A")
except Exception as e:
    print("Failed to parse JSON:", e)

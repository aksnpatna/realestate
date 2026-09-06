import requests
import time

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZDgyZmVjZDIzNTc4M2UxN2Q1MTQ0MTA2ZWQ3ODIxMSJ9.8YLSxE5wOb0bs2GOh-6XfDTpbgTsp_eYlVdjqDu-Gx8"
headers = {"Authorization": f"Bearer {token}"}
url = "http://localhost:8000/api/suburbs?state=VIC"

try:
    start_time = time.time()
    response = requests.get(url, headers=headers, timeout=30)
    duration = time.time() - start_time
    print(f"HTTP {response.status_code}")
    print(f"Response time: {duration:.2f}s")
    print(f"Response length: {len(response.text)} bytes")
    if response.text:
        print(f"First 500 chars: {repr(response.text[:500])}")
except Exception as e:
    print(f"Error: {e}")

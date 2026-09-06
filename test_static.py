import requests
import time

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZDgyZmVjZDIzNTc4M2UxN2Q1MTQ0MTA2ZWQ3ODIxMSJ9.8YLSxE5wOb0bs2GOh-6XfDTpbgTsp_eYlVdjqDu-Gx8"
headers = {"Authorization": f"Bearer {token}"}
url = "http://localhost:8000/api/suburbs"

try:
    print("Testing /health first...")
    health_response = requests.get("http://localhost:8000/health", timeout=5)
    print(f"Health: HTTP {health_response.status_code}")
    
    print("\nTesting /api/suburbs...")
    start_time = time.time()
    response = requests.get(url, headers=headers, timeout=10)
    duration = time.time() - start_time
    
    print(f"HTTP {response.status_code} in {duration:.2f} seconds")
    print(f"Response: {response.text}")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    print(f"Traceback:\n{traceback.format_exc()}")

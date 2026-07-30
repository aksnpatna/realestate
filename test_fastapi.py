from fastapi.testclient import TestClient
from backend.main import app, UserModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def mock_get_current_user():
    return UserModel(id="mock_user", email="mock@example.com")

app.dependency_overrides[app.router.routes[10].endpoint] = mock_get_current_user # Wait, better to override the dependency directly
import backend.main
backend.main.get_current_user = mock_get_current_user
app.dependency_overrides[backend.main.get_current_user] = mock_get_current_user

client = TestClient(app)
response = client.get("/api/suburbs")
print("Status:", response.status_code)
try:
    data = response.json()
    print("Type:", type(data))
    if isinstance(data, list):
        print("Length:", len(data))
        if len(data) > 0:
            print("First item keys:", data[0].keys())
    elif isinstance(data, dict):
        print("Keys:", data.keys())
except Exception as e:
    print("JSON Parse Error:", e)

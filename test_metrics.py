import requests
import json

# Test login
login_url = 'http://localhost:8100/api/login'
login_data = {'email': 'test@example.com', 'password': 'test1234'}

session = requests.Session()
login_response = session.post(login_url, json=login_data)
print('Login Response:', login_response.status_code, login_response.text)

# Test API endpoint
api_url = 'http://localhost:8100/api/suburbs/NSW_DENHAM_COURT_2565'
api_response = session.get(api_url)
print('API Response:', api_response.status_code)

if api_response.status_code == 200:
    data = api_response.json()
    print('\nPrice Volatility (10yr):', data.get('priceVolatility10yr'))
    print('Price Sharpe Ratio:', data.get('priceSharpeRatio'))

# Test frontend page
frontend_url = 'http://localhost:8082'
frontend_response = session.get(frontend_url)
print('\nFrontend Response:', frontend_response.status_code)
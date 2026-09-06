// Simple Node.js script to test API and frontend connection
import axios from 'axios';

async function testAPI() {
  console.log('=== Testing API connection ===');
  
  // Test health check
  try {
    const healthRes = await axios.get('http://localhost:8100/health');
    console.log('✅ Health check:', healthRes.status);
    console.log('   Response:', healthRes.data);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }

  // Test login
  try {
    const loginRes = await axios.post('http://localhost:8100/api/login', {
      email: 'test@test.com',
      password: 'test123'
    });
    console.log('✅ Login:', loginRes.status);
    
    // Test SQM data API
    const sqmRes = await axios.get('http://localhost:8100/api/suburbs/VIC_POINT_COOK_3030/sqm', {
      headers: { Cookie: loginRes.headers['set-cookie'] }
    });
    console.log('✅ SQM data:', sqmRes.status);
    console.log('   Data available:', sqmRes.data.has_sqm_data);
    
    // Check if data has required fields
    if (sqmRes.data.has_sqm_data) {
      const sqmData = sqmRes.data.data;
      console.log('   Rents data points:', sqmData.rents?.length || 0);
      console.log('   Prices data points:', sqmData.prices?.length || 0);
      console.log('   Vacancy data points:', sqmData.vacancy?.length || 0);
      console.log('   Stock data points:', sqmData.stock?.length || 0);
    }
  } catch (error) {
    console.error('❌ API request failed:', error.message);
  }
}

async function testFrontend() {
  console.log('\n=== Testing frontend connection ===');
  
  try {
    const res = await axios.get('http://localhost:8082/?view=profile', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('✅ Frontend:', res.status);
    console.log('   Content length:', res.data.length, 'bytes');
    console.log('   Contains SqmDashboard:', res.data.includes('SqmDashboard'));
  } catch (error) {
    console.error('❌ Frontend failed:', error.message);
  }
}

async function main() {
  await testAPI();
  await testFrontend();
}

main().catch(err => console.error(err));

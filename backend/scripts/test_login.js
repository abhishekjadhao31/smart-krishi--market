require('dotenv').config();
const axios = require('axios');

(async function() {
  try {
    const email = process.argv[2] || 'abhishekjadhao3112@gmail.com';
    const password = process.argv[3] || 'Test1234!';
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email,
      password,
    }, { timeout: 5000 });
    console.log('Login response status:', res.status);
    console.log('Body:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('Login failed status:', err.response.status, err.response.data);
    } else {
      console.error('Request error:', err.message);
    }
    process.exit(1);
  }
})();

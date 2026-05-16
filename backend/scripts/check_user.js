require('dotenv').config();
const { pool } = require('../src/config/db');

(async function() {
  try {
    const email = process.argv[2] || 'abhishekjadhao3112@gmail.com';
    const res = await pool.query('SELECT id, email, role, created_at FROM users WHERE email = $1', [email]);
    console.log('Query result rows:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

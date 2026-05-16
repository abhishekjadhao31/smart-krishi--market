require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');

(async function() {
  try {
    const email = process.argv[2] || 'abhishekjadhao3112@gmail.com';
    const newPassword = process.argv[3] || 'Test1234!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    const res = await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email', [hash, email]);
    if (res.rows.length === 0) {
      console.log('No user found with email', email);
    } else {
      console.log('Password updated for', res.rows[0].email, '- new password:', newPassword);
    }
  } catch (err) {
    console.error('Error updating password:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

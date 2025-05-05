const bcrypt = require('bcryptjs');
const pool = require('./config/db'); 
require('dotenv').config(); 


const adminEmail = process.env.ADMIN_EMAIL||'';
const adminPassword = process.env.ADMIN_PASSWORD||'';  
const adminRole =process.env.Role||'';  
const adminName=process.env.Admin_Name||'';
const departementName=process.env.DEPARTMENT||'';

async function seedAdmin() {
  try {
    
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [adminEmail]);

    if (rows.length === 0) {
    
      const [result] = await pool.execute(
        'INSERT INTO users (email, password, role,name,department) VALUES (?, ?, ?,?,?)',
        [adminEmail, hashedPassword, adminRole,adminName,departementName]
      );
      console.log('Admin user seeded successfully!');
    } else {
      console.log('Admin user already exists.');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    pool.end(); 
  }
}


seedAdmin();

// backend/src/config/runSeed.js
const { readFileSync } = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { pool } = require('./db');

async function seed() {
  const seedSQL = readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('🌱 Running seed data...');
    await client.query(seedSQL);
    console.log('✅ Seed data inserted');
    console.log('\n📋 Demo credentials:');
    console.log('   admin@coreinventory.com   / Admin@1234');
    console.log('   manager@coreinventory.com / Admin@1234');
    console.log('   staff@coreinventory.com   / Admin@1234\n');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

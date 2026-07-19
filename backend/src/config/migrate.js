// backend/src/config/migrate.js
// Run with: node src/config/migrate.js
const { readFileSync } = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { pool } = require('./db');

async function migrate() {
  const schemaSQL = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('🔄 Running schema migration...');
    await client.query(schemaSQL);
    console.log('✅ Schema applied successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

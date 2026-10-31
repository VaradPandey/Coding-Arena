const pool = require('../src/config/db');

async function updateDefaults() {
  try {
    console.log('Altering column defaults...');
    await pool.query(`ALTER TABLE users ALTER COLUMN rating SET DEFAULT 0;`);
    await pool.query(`ALTER TABLE users ALTER COLUMN "maxRating" SET DEFAULT 0;`);
    console.log('Column defaults updated.');

    const res = await pool.query(`
      SELECT column_name, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('rating', 'maxRating');
    `);
    console.log('Current column defaults in Postgres:');
    console.table(res.rows);

    const userCount = await pool.query(`SELECT id, username, rating, "maxRating" FROM users LIMIT 10;`);
    console.log('Sample existing users (confirm ratings NOT reset):');
    console.table(userCount.rows);
  } catch (err) {
    console.error('Error updating defaults:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateDefaults();


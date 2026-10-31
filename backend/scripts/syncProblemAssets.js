const pool = require('../src/config/db');
const manifest = require('../exports/google_drive/manifest.json');

async function syncAssets() {
    console.log('Syncing problem assets into PostgreSQL...');
    for (const item of manifest) {
        await pool.query(`
            INSERT INTO problem_assets (problem_id, provider, file_id, checksum, version, archive_size_bytes, updated_at)
            VALUES ($1, 'GOOGLE_DRIVE', 'local_dev_mock', $2, $3, $4, NOW())
            ON CONFLICT (problem_id) DO UPDATE SET
                checksum = EXCLUDED.checksum,
                version = EXCLUDED.version,
                archive_size_bytes = EXCLUDED.archive_size_bytes,
                updated_at = NOW()
        `, [item.problem_id, item.checksum, item.version, item.archive_size_bytes]);
    }
    console.log(`Successfully synced ${manifest.length} problem assets into Neon database!`);
    process.exit(0);
}

syncAssets().catch(err => {
    console.error('Error syncing problem assets:', err);
    process.exit(1);
});


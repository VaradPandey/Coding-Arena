const StorageProvider = require('./StorageProvider');
const pool = require('../config/db');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

class GoogleDriveProvider extends StorageProvider {
    constructor() {
        super();
        this.cacheDir = path.join(__dirname, '../../judge/cache');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    async getAsset(problemId) {
        const result = await pool.query(`
            SELECT provider, file_id, checksum, version, archive_size_bytes
            FROM problem_assets
            WHERE problem_id = $1 AND provider = 'GOOGLE_DRIVE'
        `, [problemId]);

        if (result.rowCount === 0) {
            return null;
        }

        return result.rows[0];
    }

    async verifyCache(problemId) {
        const asset = await this.getAsset(problemId);
        const paddedId = String(problemId).padStart(3, '0');
        const problemCacheDir = path.join(this.cacheDir, paddedId);
        const metaPath = path.join(problemCacheDir, '.meta.json');

        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                if (!asset || (meta.version === asset.version && meta.checksum === asset.checksum)) {
                    return true;
                }
            } catch (e) {
                // Ignore parse errors, treat as invalid
            }
        }

        if (fs.existsSync(problemCacheDir)) {
            fs.rmSync(problemCacheDir, { recursive: true, force: true });
        }
        return false;
    }

    async downloadArchive(problemId) {
        const asset = await this.getAsset(problemId);
        const paddedId = String(problemId).padStart(3, '0');
        const problemCacheDir = path.join(this.cacheDir, paddedId);
        const tempZipPath = path.join(this.cacheDir, `${paddedId}-temp.zip`);

        // Check if we have the local export zip
        const localZipPath = path.join(__dirname, '../../exports/google_drive', `${paddedId}-private.zip`);
        if (fs.existsSync(localZipPath)) {
            if (fs.existsSync(problemCacheDir)) {
                fs.rmSync(problemCacheDir, { recursive: true, force: true });
            }
            fs.mkdirSync(problemCacheDir, { recursive: true });

            const zip = new AdmZip(localZipPath);
            zip.extractAllTo(problemCacheDir, true);

            const meta = {
                version: asset ? asset.version : 1,
                checksum: asset ? asset.checksum : 'local',
                downloaded_at: new Date().toISOString()
            };
            fs.writeFileSync(path.join(problemCacheDir, '.meta.json'), JSON.stringify(meta, null, 2));
            return problemCacheDir;
        }

        if (!asset || !asset.file_id || asset.file_id === 'local_dev_mock') {
            throw new Error(`Google Drive asset not found for problem ${problemId}`);
        }

        if (fs.existsSync(problemCacheDir)) {
            fs.rmSync(problemCacheDir, { recursive: true, force: true });
        }
        fs.mkdirSync(problemCacheDir, { recursive: true });

        const url = `https://drive.google.com/uc?export=download&id=${asset.file_id}`;
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempZipPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const zip = new AdmZip(tempZipPath);
            zip.extractAllTo(problemCacheDir, true);

            const meta = {
                version: asset.version,
                checksum: asset.checksum,
                downloaded_at: new Date().toISOString()
            };
            fs.writeFileSync(path.join(problemCacheDir, '.meta.json'), JSON.stringify(meta, null, 2));

        } catch (err) {
            if (fs.existsSync(problemCacheDir)) {
                fs.rmSync(problemCacheDir, { recursive: true, force: true });
            }
            throw new Error(`Failed to download and extract archive for problem ${problemId}: ${err.message}`);
        } finally {
            if (fs.existsSync(tempZipPath)) {
                fs.rmSync(tempZipPath);
            }
        }

        return problemCacheDir;
    }
}

module.exports = new GoogleDriveProvider();

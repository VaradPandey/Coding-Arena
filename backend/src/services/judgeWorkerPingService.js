const axios = require('axios');
const config = require('../config');

class JudgeWorkerPingService {
    constructor() {
        this.lastPingTimestamp = 0;
        this.throttleIntervalMs = 15000; // 15 seconds debounce window
        this.isPingInProgress = false;
    }

    getWorkerUrl() {
        return config.judgeWorkerUrl || process.env.JUDGE_WORKER_URL || '';
    }

    /**
     * Non-blocking, debounced wake-up ping to trigger Render container roll-up.
     * @param {string} triggerReason - Description of the trigger (e.g., 'submission', 'match_created')
     */
    wakeUpWorker(triggerReason = 'submission') {
        const workerUrl = this.getWorkerUrl();
        if (!workerUrl) {
            return;
        }

        const now = Date.now();
        if (now - this.lastPingTimestamp < this.throttleIntervalMs && this.isPingInProgress) {
            // Ping already in flight
            return;
        }

        this.lastPingTimestamp = now;
        this.isPingInProgress = true;

        // Run detached and asynchronously (fire-and-forget, never block API requests)
        setImmediate(async () => {
            const targetUrl = workerUrl.replace(/\/+$/, '') + '/health';
            console.log(`[JudgePing] Triggering worker wake-up (reason: ${triggerReason}) -> ${targetUrl}`);

            try {
                const response = await axios.get(targetUrl, {
                    timeout: 25000,
                    headers: { 'User-Agent': 'CodeArena-API-WorkerPing/1.0' }
                });

                if (response.status === 200) {
                    console.log(`[JudgePing] Judge worker is active (status: ${response.data?.status || 'ok'})`);
                }
            } catch (err) {
                if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                    // Normal for Render cold starts (takes ~30-50s to answer, but roll-up has been initiated)
                    console.log(`[JudgePing] Wake-up ping dispatched to Render edge (container cold start in progress)`);
                } else {
                    console.warn(`[JudgePing] Wake-up ping dispatched (${err.message})`);
                }
            } finally {
                this.isPingInProgress = false;
            }
        });
    }
}

module.exports = new JudgeWorkerPingService();

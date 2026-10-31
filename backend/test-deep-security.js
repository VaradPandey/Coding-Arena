const axios = require('axios');
const { execSync } = require('child_process');

const API = 'http://localhost:5000/api';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDeepVerification() {
    console.log('====================================================');
    console.log('       STARTING DEEP SECURITY & LIMITS VERIFICATION');
    console.log('====================================================\n');

    // 1. Confirm prlimit inside worker container
    console.log('[Check 1] Verifying prlimit inside Docker worker container...');
    try {
        const prlimitCheck = execSync('docker exec coding-arena-judge-worker which prlimit').toString().trim();
        const prlimitVersion = execSync('docker exec coding-arena-judge-worker prlimit --version').toString().trim();
        console.log(`  PASS: prlimit binary found at: ${prlimitCheck}`);
        console.log(`  PASS: ${prlimitVersion}\n`);
    } catch (e) {
        console.error('  FAIL: prlimit not found inside container:', e.message);
        return;
    }

    // Register test user
    const suffix = Date.now().toString().slice(-6);
    const regRes = await axios.post(`${API}/auth/register`, {
        email: `deepsec_${suffix}@example.com`,
        password: 'Password123!',
        username: `deepsec_${suffix}`
    });
    const token = regRes.data.data.token;
    const userId = regRes.data.data.user.id;
    console.log(`[Setup] Registered test user: ${userId}\n`);

    // 2. Test Output Cap: Program that produces runaway output (> 5 MB)
    console.log('[Check 2] Testing output cap on runaway output (> 5 MB)...');
    const runawayOutputCode = `#include <iostream>

int main() {
    // Generates ~12.6 MB of output, well exceeding the 5 MB MAX_OUTPUT_BYTES limit
    for (int i = 0; i < 600000; i++) {
        std::cout << "01234567890123456789\\n";
    }
    return 0;
}`;

    const runawaySubRes = await axios.post(`${API}/submissions`, {
        problem_id: 21,
        language: 'cpp',
        source_code: runawayOutputCode
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const runawaySubId = runawaySubRes.data.submission_id;
    console.log(`  Submitted runaway output code (Submission ID: ${runawaySubId}). Polling verdict...`);

    let runawayVerdict = null;
    let runawayTime = 0;
    for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const sub = await axios.get(`${API}/submissions/${runawaySubId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (sub.data.verdict) {
            runawayVerdict = sub.data.verdict;
            runawayTime = sub.data.execution_time_ms;
            break;
        }
    }
    console.log(`  Runaway Output Verdict: ${runawayVerdict} (time: ${runawayTime}ms)`);
    if (runawayVerdict === 'Output Limit Exceeded' || runawayVerdict === 'Runtime Error') {
        console.log('  PASS: Runaway output was terminated by output cap without memory exhaustion!\n');
    } else {
        console.error(`  FAIL: Unexpected verdict for runaway output: ${runawayVerdict}\n`);
    }

    // 3. Test Process Tree Termination: Forked child process on timeout
    console.log('[Check 3] Testing process tree termination on timeout (forked child process)...');
    const forkingCode = `#include <iostream>
#include <unistd.h>
#include <sys/types.h>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        // Child process enters infinite loop
        while (true) {
            sleep(1);
        }
    } else {
        // Parent process enters infinite loop
        while (true) {
            sleep(1);
        }
    }
    return 0;
}`;

    const forkSubRes = await axios.post(`${API}/submissions`, {
        problem_id: 21,
        language: 'cpp',
        source_code: forkingCode
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const forkSubId = forkSubRes.data.submission_id;
    console.log(`  Submitted forking code (Submission ID: ${forkSubId}). Polling verdict...`);

    let forkVerdict = null;
    for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const sub = await axios.get(`${API}/submissions/${forkSubId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (sub.data.verdict) {
            forkVerdict = sub.data.verdict;
            break;
        }
    }
    console.log(`  Forking Code Verdict: ${forkVerdict}`);
    if (forkVerdict === 'Time Limit Exceeded') {
        console.log('  PASS: Timeout fired and produced Time Limit Exceeded.');
        // Verify no orphaned child processes remain in container
        await sleep(1000);
        const topOutput = execSync('docker top coding-arena-judge-worker').toString();
        console.log('  Container process table (docker top):\n' + topOutput.trim());
        const lines = topOutput.trim().split('\n').filter(l => l.trim().length > 0);
        // Header line + worker process line = 2 lines
        if (lines.length <= 2) {
            console.log('  PASS: Verified all child processes in the process group were terminated!\n');
        } else {
            console.error('  FAIL: Unexpected extra processes running in container:\n', topOutput);
        }
    } else {
        console.error(`  FAIL: Expected Time Limit Exceeded, got: ${forkVerdict}\n`);
    }

    // 4. Manual end-to-end test of the authentic harmless C++ program
    console.log('[Check 4] Testing authentic harmless C++ submission end-to-end...');
    const authenticCode = `#include <iostream>

int main() {
    std::cout << "Hello, Coding Arena!";
    return 0;
}`;

    const authSubRes = await axios.post(`${API}/submissions`, {
        problem_id: 21,
        language: 'cpp',
        source_code: authenticCode
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const authSubId = authSubRes.data.submission_id;
    console.log(`  Submitted authentic code (Submission ID: ${authSubId}). Polling verdict...`);

    let authVerdict = null;
    let authDetails = null;
    for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const sub = await axios.get(`${API}/submissions/${authSubId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (sub.data.verdict) {
            authVerdict = sub.data.verdict;
            authDetails = sub.data;
            break;
        }
    }

    console.log(`  Authentic Submission Verdict: ${authVerdict}`);
    console.log(`  Execution Time: ${authDetails?.execution_time_ms} ms`);
    console.log(`  Status: ${authDetails?.status}`);
    if (authVerdict === 'Accepted') {
        console.log('  PASS: Authentic submission passed end-to-end and reached Accepted!\n');
    } else {
        console.error('  FAIL: Authentic submission did not reach Accepted:', authDetails);
    }

    // 5. Verify cleanup of temporary runs directory
    console.log('[Check 5] Verifying ephemeral run directory cleanup...');
    const runsList = execSync('docker exec coding-arena-judge-worker ls -la /app/judge/runs').toString().trim();
    console.log('  /app/judge/runs directory status:\n' + runsList);
    const runsEntries = runsList.split('\n').filter(l => l.includes('drwx') || l.includes('-rw'));
    if (runsEntries.length <= 2) {
        console.log('  PASS: All run directories cleanly unlinked and wiped from tmpfs!\n');
    } else {
        console.warn('  WARN: Unexpected files remaining in runs directory:', runsList);
    }

    console.log('====================================================');
    console.log('       ALL DEEP VERIFICATION CHECKS COMPLETED');
    console.log('====================================================');
}

runDeepVerification().catch(console.error);

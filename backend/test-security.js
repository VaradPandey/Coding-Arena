const axios = require('axios');

const API = 'http://localhost:5000/api';

async function runTests() {
    console.log('--- Starting Security Tests ---');

    // 1. Test /api/run is blocked (403 Forbidden)
    console.log('\n[Test 1] POST /api/run should be blocked with 403');
    try {
        const res = await axios.post(`${API}/run`, {
            problem_id: 1,
            language: 'cpp',
            source_code: 'int main(){ return 0; }'
        });
        console.error('FAIL: /api/run unexpectedly succeeded:', res.status, res.data);
    } catch (err) {
        if (err.response && err.response.status === 403) {
            console.log('PASS: /api/run returned 403 Forbidden:', err.response.data);
        } else {
            console.error('FAIL: Unexpected status for /api/run:', err.response ? err.response.status : err.message);
        }
    }

    // 2. Test GET /api/submissions/:id without authentication
    console.log('\n[Test 2] GET /api/submissions/:id should require authentication (401)');
    try {
        const res = await axios.get(`${API}/submissions/1`);
        console.error('FAIL: GET /api/submissions/1 unexpectedly succeeded without auth:', res.status);
    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.log('PASS: GET /api/submissions/1 returned 401 Unauthorized:', err.response.data);
        } else {
            console.error('FAIL: Unexpected status:', err.response ? err.response.status : err.message);
        }
    }

    // 3. Register User A and User B
    console.log('\n[Test 3] User registration & cross-user submission authorization check');
    const suffix = Date.now().toString().slice(-6);
    const emailA = `seca_${suffix}@example.com`;
    const emailB = `secb_${suffix}@example.com`;
    let tokenA, tokenB, userAId, userBId;

    try {
        const regA = await axios.post(`${API}/auth/register`, {
            email: emailA,
            password: 'Password123!',
            username: `usera_${suffix}`
        });
        tokenA = regA.data.data.token;
        userAId = regA.data.data.user.id;
        console.log(`PASS: Registered User A (id: ${userAId})`);
    } catch (e) {
        console.error('FAIL: Failed to register user A:', e.response?.data || e.message);
        return;
    }

    try {
        const regB = await axios.post(`${API}/auth/register`, {
            email: emailB,
            password: 'Password123!',
            username: `userb_${suffix}`
        });
        tokenB = regB.data.data.token;
        userBId = regB.data.data.user.id;
        console.log(`PASS: Registered User B (id: ${userBId})`);
    } catch (e) {
        console.error('FAIL: Failed to register user B:', e.response?.data || e.message);
        return;
    }

    // 4. Test source size limit (> 64 KB)
    console.log('\n[Test 4] Source code size limit check (> 64 KB)');
    try {
        const largeSource = '// ' + 'A'.repeat(70 * 1024);
        const res = await axios.post(`${API}/submissions`, {
            problem_id: 21,
            language: 'cpp',
            source_code: largeSource
        }, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        console.error('FAIL: Large source submission unexpectedly accepted:', res.status);
    } catch (err) {
        if (err.response && err.response.status === 400 && err.response.data.error?.includes('64 KB')) {
            console.log('PASS: Submission > 64 KB rejected with 400:', err.response.data);
        } else {
            console.error('FAIL: Unexpected response for large source:', err.response?.status, err.response?.data);
        }
    }

    // 5. Submit valid C++ code as User A
    console.log('\n[Test 5] Valid submission as User A for problem 21');
    let subIdA;
    try {
        const validCode = `#include <iostream>\n\nint main() {\n    std::cout << "Hello, Coding Arena!";\n    return 0;\n}`;
        const subRes = await axios.post(`${API}/submissions`, {
            problem_id: 21,
            language: 'cpp',
            source_code: validCode
        }, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        subIdA = subRes.data.submission_id;
        console.log(`PASS: User A created submission ID: ${subIdA}`);
    } catch (e) {
        console.error('FAIL: Failed to create submission:', e.response?.data || e.message);
        return;
    }

    // 6. Test User B cannot read User A's submission
    console.log('\n[Test 6] Cross-user access control: User B attempts to access User A submission');
    try {
        const res = await axios.get(`${API}/submissions/${subIdA}`, {
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        console.error('FAIL: User B was able to read User A submission:', res.data);
    } catch (err) {
        if (err.response && err.response.status === 403) {
            console.log('PASS: Access denied for User B (403 Forbidden):', err.response.data);
        } else {
            console.error('FAIL: Unexpected status for cross-user access:', err.response?.status, err.response?.data);
        }
    }

    // 7. Verify User A can read own submission and await verdict
    console.log('\n[Test 7] User A reads own submission and polls for verdict');
    let verdict = 'pending';
    let finalSub = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const res = await axios.get(`${API}/submissions/${subIdA}`, {
                headers: { Authorization: `Bearer ${tokenA}` }
            });
            finalSub = res.data;
            verdict = res.data.verdict || res.data.status;
            console.log(`Poll ${i + 1}: status = ${res.data.status}, verdict = ${res.data.verdict}, time = ${res.data.execution_time_ms}ms`);
            if (res.data.verdict) {
                break;
            }
        } catch (e) {
            console.error('Error fetching submission:', e.response?.data || e.message);
        }
    }

    if (finalSub && finalSub.verdict === 'Accepted') {
        console.log('\n>>> SUCCESS: Submission reached Accepted verdict! <<<');
    } else {
        console.log(`\nFinal state:`, finalSub);
    }
}

runTests();

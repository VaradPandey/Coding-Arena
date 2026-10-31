const axios = require('axios');

const API = 'http://localhost:5000/api';

async function runExecutionLimitTests() {
    console.log('--- Testing Execution Limits & Compiler Error Handling ---');

    const suffix = Date.now().toString().slice(-6);
    const regRes = await axios.post(`${API}/auth/register`, {
        email: `limits_${suffix}@example.com`,
        password: 'Password123!',
        username: `limits_${suffix}`
    });
    const token = regRes.data.data.token;

    // 1. Submit TLE program
    console.log('\n[Test 8] Submitting program with infinite loop (TLE test)');
    const tleCode = `#include <iostream>\n\nint main() {\n    while (true) {}\n    return 0;\n}`;
    const tleRes = await axios.post(`${API}/submissions`, {
        problem_id: 21,
        language: 'cpp',
        source_code: tleCode
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const tleSubId = tleRes.data.submission_id;
    console.log(`Submitted TLE code (ID: ${tleSubId}), polling for verdict...`);

    let tleVerdict = 'queued';
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const res = await axios.get(`${API}/submissions/${tleSubId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.verdict) {
            tleVerdict = res.data.verdict;
            break;
        }
    }
    console.log(`TLE Test Verdict: ${tleVerdict}`);
    if (tleVerdict === 'Time Limit Exceeded') {
        console.log('PASS: Infinite loop produced Time Limit Exceeded verdict cleanly');
    } else {
        console.error('FAIL: Expected Time Limit Exceeded, got:', tleVerdict);
    }

    // 2. Submit Compilation Error program
    console.log('\n[Test 9] Submitting syntactically invalid program (CE test)');
    const ceCode = `int main() { syntax error here }`;
    const ceRes = await axios.post(`${API}/submissions`, {
        problem_id: 21,
        language: 'cpp',
        source_code: ceCode
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const ceSubId = ceRes.data.submission_id;
    console.log(`Submitted CE code (ID: ${ceSubId}), polling for verdict...`);

    let ceVerdict = 'queued';
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const res = await axios.get(`${API}/submissions/${ceSubId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.verdict) {
            ceVerdict = res.data.verdict;
            break;
        }
    }
    console.log(`CE Test Verdict: ${ceVerdict}`);
    if (ceVerdict === 'Compilation Error') {
        console.log('PASS: Invalid syntax produced Compilation Error verdict cleanly');
    } else {
        console.error('FAIL: Expected Compilation Error, got:', ceVerdict);
    }
}

runExecutionLimitTests().catch(console.error);


const axios = require('axios');

async function testBoth() {
    const regRes = await axios.post('http://localhost:5000/api/auth/register', {
        email: 'both_' + Date.now() + '@example.com',
        password: 'Password123!',
        username: 'both_' + Date.now().toString().slice(-6)
    });
    const token = regRes.data.data.token;

    const code = `#include <iostream>
int main() {
    long long n;
    if (std::cin >> n) {
        if (n <= 1) { std::cout << 1 << std::endl; return 0; }
        long long a = 1, b = 2;
        for (long long i = 3; i <= n; i++) {
            long long c = (a + b) % 1000000007;
            a = b;
            b = c;
        }
        std::cout << b << std::endl;
    }
    return 0;
}`;

    // 1. Test Run Code (Sample tests)
    console.log('1. Testing "Run Code" on sample tests...');
    const runRes = await axios.post('http://localhost:5000/api/run', {
        problem_id: 7,
        language: 'cpp',
        source_code: code
    }, {
        headers: { Authorization: 'Bearer ' + token }
    });

    console.log('  Run Verdict:', runRes.data.verdict);
    console.log('  Sample Cases Passed:', runRes.data.test_results.filter(t => t.status === 'Accepted').length, '/', runRes.data.test_results.length);

    // 2. Test Submit Solution (All 100 test cases)
    console.log('\n2. Testing "Submit Solution" on all 100 test cases...');
    const subRes = await axios.post('http://localhost:5000/api/submissions', {
        problem_id: 7,
        language: 'cpp',
        source_code: code
    }, {
        headers: { Authorization: 'Bearer ' + token }
    });

    const subId = subRes.data.submission_id;
    console.log('  Queued submission ID:', subId, '- polling for verdict...');

    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const res = await axios.get(`http://localhost:5000/api/submissions/${subId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.verdict) {
            console.log('  Submission Verdict:', res.data.verdict);
            console.log('  Max Execution Time:', res.data.execution_time_ms, 'ms');
            console.log('  Status:', res.data.status);
            break;
        }
    }
}

testBoth().catch(console.error);

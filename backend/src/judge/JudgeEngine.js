const path = require('path');
const fs = require('fs/promises');
const pool = require('../config/db');
const googleDriveProvider = require('../storage/GoogleDriveProvider');
const cppCompiler = require('./CppCompiler');
const executor = require('./Executor');
const outputComparator = require('./OutputComparator');

class JudgeEngine {
    async run(submissionId) {
        // 1. Fetch submission & problem
        const subRes = await pool.query(`
            SELECT s.problem_id, s.language, s.source_code, p.time_limit_ms
            FROM submissions s
            JOIN problems p ON s.problem_id = p.id
            WHERE s.id = $1
        `, [submissionId]);

        if (subRes.rowCount === 0) {
            throw new Error(`Submission ${submissionId} not found`);
        }
        
        const { problem_id, language, source_code, time_limit_ms } = subRes.rows[0];
        const timeLimit = time_limit_ms || 2000;

        if (language !== 'cpp' && language !== 'cpp17' && language !== 'c++') {
            return { verdict: "Compilation Error", executionTimeMs: 0 }; 
        }

        // 2. Fetch hidden test cache directory
        let cacheDir;
        try {
            const isCached = await googleDriveProvider.verifyCache(problem_id);
            if (!isCached) {
                cacheDir = await googleDriveProvider.downloadArchive(problem_id);
            } else {
                const paddedId = String(problem_id).padStart(3, '0');
                cacheDir = path.join(googleDriveProvider.cacheDir, paddedId);
            }
        } catch (error) {
            console.error(`Failed to fetch assets for problem ${problem_id}:`, error);
            throw error;
        }

        const runDir = path.join(__dirname, '..', '..', 'judge', 'runs', String(submissionId));
        
        try {
            // 3. Compile with strict limits and timeouts
            let executablePath;
            try {
                executablePath = await cppCompiler.compile(source_code, runDir);
            } catch (error) {
                return { verdict: "Compilation Error", executionTimeMs: 0 };
            }

            // 4. Discover all test cases
            let testCases = [];
            try {
                const files = await fs.readdir(cacheDir);
                testCases = files
                    .filter(f => f.endsWith('.in'))
                    .map(f => f.replace('.in', ''))
                    .sort(); // Sorting ensures 001.in comes before 002.in
            } catch (error) {
                console.error(`Failed to read cache directory for problem ${problem_id}:`, error);
                throw error;
            }

            // 5. Execute all test cases sequentially
            let maxExecutionTimeMs = 0;
            let testCount = 0;

            for (const testName of testCases) {
                testCount++;
                const inputFilePath = path.join(cacheDir, `${testName}.in`);
                const expectedOutputPath = path.join(cacheDir, `${testName}.out`);
                
                let result;
                try {
                    result = await executor.run(executablePath, inputFilePath, timeLimit);
                    maxExecutionTimeMs = Math.max(maxExecutionTimeMs, result.executionTimeMs);
                } catch (error) {
                    // TLE, OLE, or RE
                    let verdict = 'Runtime Error';
                    if (error.message === 'Time Limit Exceeded') {
                        verdict = 'Time Limit Exceeded';
                    } else if (error.message.includes('Output Limit')) {
                        verdict = 'Output Limit Exceeded';
                    }
                    console.log(`[JudgeEngine] Sub ${submissionId} Failed on test ${testCount} (${testName}) - ${verdict}`);
                    return { verdict, executionTimeMs: maxExecutionTimeMs };
                }

                // Compare output
                const verdict = await outputComparator.compare(result.stdoutData, expectedOutputPath);
                if (verdict !== 'Accepted') {
                    console.log(`[JudgeEngine] Sub ${submissionId} Failed on test ${testCount} (${testName}) - ${verdict}`);
                    return { verdict, executionTimeMs: maxExecutionTimeMs };
                }
            }

            // All tests passed
            console.log(`[JudgeEngine] Sub ${submissionId} Passed ${testCount} test cases. Max Time: ${maxExecutionTimeMs}ms`);
            return { verdict: 'Accepted', executionTimeMs: maxExecutionTimeMs };
        } finally {
            // Guaranteed cleanup of run directory, source code, and binaries
            await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
        }
    }
}

module.exports = new JudgeEngine();

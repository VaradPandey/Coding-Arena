const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const cppCompiler = require('./CppCompiler');
const executor = require('./Executor');
const outputComparator = require('./OutputComparator');

class RunEngine {
    /**
     * Executes code against public sample tests.
     */
    async run(problemId, language, sourceCode) {
        if (language !== 'cpp' && language !== 'cpp17' && language !== 'c++') {
            return {
                status: 'completed',
                verdict: 'Compilation Error',
                execution_time_ms: 0,
                compiler_output: `Unsupported language: ${language}`,
                test_results: []
            };
        }

        // Fetch time limit and public test cases
        const problemRes = await pool.query('SELECT time_limit_ms FROM problems WHERE id = $1', [problemId]);
        if (problemRes.rowCount === 0) {
            throw new Error(`Problem ${problemId} not found`);
        }
        const timeLimit = problemRes.rows[0].time_limit_ms || 2000;

        const testsRes = await pool.query(`
            SELECT case_order, input_data, output_data 
            FROM test_cases 
            WHERE problem_id = $1 AND visibility = 'PUBLIC'
            ORDER BY case_order ASC
        `, [problemId]);
        const testCases = testsRes.rows;

        if (testCases.length === 0) {
            return {
                status: 'completed',
                verdict: 'Accepted', // No tests means it trivially passes
                execution_time_ms: 0,
                compiler_output: null,
                test_results: []
            };
        }

        const runId = uuidv4();
        const runDir = path.join(__dirname, '..', '..', 'judge', 'runs', `run_${runId}`);
        await fs.mkdir(runDir, { recursive: true });

        try {
            let executablePath;
            try {
                executablePath = await cppCompiler.compile(sourceCode, runDir);
            } catch (error) {
                return {
                    status: 'completed',
                    verdict: 'Compilation Error',
                    execution_time_ms: 0,
                    compiler_output: error.compilerOutput || 'Compilation Error',
                    test_results: []
                };
            }

            let overallVerdict = 'Accepted';
            let maxExecutionTimeMs = 0;
            const testResults = [];

            // Execute all public sample tests sequentially
            for (const test of testCases) {
                const inputFilePath = path.join(runDir, `sample_${test.case_order}.in`);
                const expectedOutputPath = path.join(runDir, `sample_${test.case_order}.out`);
                
                await fs.writeFile(inputFilePath, test.input_data);
                await fs.writeFile(expectedOutputPath, test.output_data);

                let status = '';
                let executionTimeMs = 0;
                let actualOutput = '';

                try {
                    const result = await executor.run(executablePath, inputFilePath, timeLimit);
                    actualOutput = result.stdoutData;
                    executionTimeMs = result.executionTimeMs;
                    maxExecutionTimeMs = Math.max(maxExecutionTimeMs, executionTimeMs);
                    
                    // Compare using existing OutputComparator
                    status = await outputComparator.compare(actualOutput, expectedOutputPath);
                } catch (error) {
                    if (error.message === 'Time Limit Exceeded') {
                        status = 'Time Limit Exceeded';
                    } else if (error.message.includes('Output Limit')) {
                        status = 'Output Limit Exceeded';
                    } else {
                        status = 'Runtime Error';
                    }
                    executionTimeMs = status === 'Time Limit Exceeded' ? timeLimit : 0;
                    maxExecutionTimeMs = Math.max(maxExecutionTimeMs, executionTimeMs);
                }

                testResults.push({
                    test_case: test.case_order,
                    status,
                    execution_time_ms: executionTimeMs,
                    input: test.input_data,
                    expected_output: test.output_data,
                    actual_output: actualOutput
                });

                // Update overall verdict (downgrade priority logic)
                if (status === 'Runtime Error' && overallVerdict !== 'Runtime Error') {
                    overallVerdict = 'Runtime Error';
                } else if (status === 'Output Limit Exceeded' && overallVerdict !== 'Runtime Error') {
                    overallVerdict = 'Output Limit Exceeded';
                } else if (status === 'Time Limit Exceeded' && overallVerdict !== 'Runtime Error' && overallVerdict !== 'Output Limit Exceeded') {
                    overallVerdict = 'Time Limit Exceeded';
                } else if (status === 'Wrong Answer' && overallVerdict === 'Accepted') {
                    overallVerdict = 'Wrong Answer';
                }
            }

            return {
                status: 'completed',
                verdict: overallVerdict,
                execution_time_ms: maxExecutionTimeMs,
                compiler_output: null,
                test_results: testResults
            };
        } finally {
            // Guaranteed cleanup of run directory
            await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
        }
    }
}

module.exports = new RunEngine();

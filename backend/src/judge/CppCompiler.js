const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

const MAX_SOURCE_BYTES = 64 * 1024; // 64 KB
const COMPILATION_TIMEOUT_MS = 10000; // 10 seconds

class CppCompiler {
    /**
     * Compiles C++ source code with strict timeout, buffer, and size limits.
     * @param {string} sourceCode 
     * @param {string} runDir 
     * @returns {Promise<string>} Path to the executable, or throws Error with compilerOutput
     */
    async compile(sourceCode, runDir) {
        if (!sourceCode || typeof sourceCode !== 'string') {
            const err = new Error('Compilation Error');
            err.compilerOutput = 'Source code is empty';
            throw err;
        }

        if (Buffer.byteLength(sourceCode, 'utf8') > MAX_SOURCE_BYTES) {
            const err = new Error('Compilation Error');
            err.compilerOutput = 'Source code exceeds maximum size limit (64 KB)';
            throw err;
        }

        await fs.mkdir(runDir, { recursive: true });
        
        const sourcePath = path.join(runDir, 'source.cpp');
        const executablePath = path.join(runDir, process.platform === 'win32' ? 'solution.exe' : 'solution');
        
        await fs.writeFile(sourcePath, sourceCode, 'utf8');

        return new Promise((resolve, reject) => {
            const child = execFile(
                'g++',
                ['-std=c++17', '-O2', sourcePath, '-o', executablePath],
                {
                    timeout: COMPILATION_TIMEOUT_MS,
                    maxBuffer: 512 * 1024, // 512 KB
                    windowsHide: true,
                },
                (error, stdout, stderr) => {
                    if (error) {
                        const isTimeout = error.killed && error.signal === 'SIGTERM';
                        const err = new Error('Compilation Error');
                        err.compilerOutput = isTimeout 
                            ? 'Compilation timed out after 10 seconds' 
                            : (stderr || stdout || error.message).slice(0, 4096);
                        return reject(err);
                    }
                    resolve(executablePath);
                }
            );
        });
    }
}

module.exports = new CppCompiler();

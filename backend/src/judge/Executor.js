const fs = require('fs/promises');
const { spawn } = require('child_process');

const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5 MB output limit

class Executor {
    /**
     * Executes the compiled program with execution time, memory, output, and process limits.
     * @param {string} executablePath 
     * @param {string} inputFilePath 
     * @param {number} timeLimitMs
     * @returns {Promise<{ stdoutData: string, executionTimeMs: number }>} Program's standard output
     */
    async run(executablePath, inputFilePath, timeLimitMs = 2000) {
        return new Promise((resolve, reject) => {
            const isLinux = process.platform === 'linux';
            let command = executablePath;
            let args = [];

            // On Linux, wrap execution in prlimit to enforce per-submission resource ceilings:
            // --nproc=16: limits process creation to prevent fork bombs
            // --as=536870912: 512MB virtual address space limit
            // --fsize=10485760: 10MB maximum file size written to disk
            // --core=0: disable core dump generation
            if (isLinux) {
                command = 'prlimit';
                args = [
                    '--nproc=16',
                    '--as=536870912',
                    '--fsize=10485760',
                    '--core=0',
                    executablePath
                ];
            }

            // Spawn in a new process group (detached: true on POSIX) so all child/forked processes
            // can be terminated together on timeout or failure.
            const child = spawn(command, args, {
                detached: !process.platform.startsWith('win'),
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
            });

            let stdoutData = '';
            let stderrData = '';
            let stdoutBytes = 0;
            let isKilled = false;
            let isOutputExceeded = false;
            let settled = false;

            const startTime = performance.now();

            function killProcessGroup() {
                try {
                    if (process.platform !== 'win32' && child.pid) {
                        process.kill(-child.pid, 'SIGKILL');
                    }
                } catch (e) {
                    // Process group may have already terminated
                }
                try {
                    child.kill('SIGKILL');
                } catch (e) {}
            }

            const timer = setTimeout(() => {
                isKilled = true;
                killProcessGroup();
            }, timeLimitMs);

            child.stdout.on('data', (chunk) => {
                stdoutBytes += chunk.length;
                if (stdoutBytes > MAX_OUTPUT_BYTES) {
                    isOutputExceeded = true;
                    killProcessGroup();
                    try { child.stdout.destroy(); } catch (e) {}
                    try { child.stderr.destroy(); } catch (e) {}
                    try { child.stdin.destroy(); } catch (e) {}
                    return;
                }
                stdoutData += chunk.toString();
            });

            child.stderr.on('data', (chunk) => {
                if (stderrData.length < 4096) {
                    stderrData += chunk.toString();
                }
            });

            child.on('close', (code, signal) => {
                clearTimeout(timer);
                if (settled) return;
                settled = true;

                const endTime = performance.now();
                const executionTimeMs = Math.round(endTime - startTime);

                if (isKilled) {
                    return reject(new Error("Time Limit Exceeded"));
                }

                if (isOutputExceeded) {
                    return reject(new Error("Output Limit Exceeded"));
                }

                if (code !== 0 || signal) {
                    return reject(new Error("Runtime Error"));
                }

                resolve({ stdoutData, executionTimeMs });
            });

            child.on('error', (err) => {
                clearTimeout(timer);
                if (settled) return;
                settled = true;
                killProcessGroup();
                reject(err);
            });

            // Feed the input file into stdin safely
            child.stdin.on('error', (err) => {
                // Ignore EPIPE and EOF errors if child exits before reading all input
                if (err.code !== 'EPIPE' && err.code !== 'EOF') {
                    console.error('stdin error:', err);
                }
            });

            fs.readFile(inputFilePath)
                .then((inputBuffer) => {
                    if (!child.killed && child.stdin.writable) {
                        child.stdin.write(inputBuffer);
                        child.stdin.end();
                    }
                })
                .catch((err) => {
                    clearTimeout(timer);
                    killProcessGroup();
                    if (!settled) {
                        settled = true;
                        reject(err);
                    }
                });
        });
    }
}

module.exports = new Executor();

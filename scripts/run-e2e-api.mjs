#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = (process.env.HIREFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;
const HEALTH_URL = `${API_BASE}/health`;
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SERVER_BOOT_TIMEOUT_MS = 30_000;
const DEFAULT_SUITE = 'e2e-auth-policy.mjs';
const ALL_SUITES = ['e2e-auth-policy.mjs', 'e2e-core-smoke.mjs', 'e2e-screening-isolation.mjs', 'e2e-voice-path.mjs'];
const SUITE_ALIASES = {
    auth: 'e2e-auth-policy.mjs',
    policy: 'e2e-auth-policy.mjs',
    smoke: 'e2e-core-smoke.mjs',
    core: 'e2e-core-smoke.mjs',
    screening: 'e2e-screening-isolation.mjs',
    voice: 'e2e-voice-path.mjs',
};

const DEFAULT_DATABASE_URL = 'postgresql://hireflow:hireflow_password@localhost:5433/hireflow_db?schema=public';
const DEFAULT_JWT_SECRET = 'hireflow_local_jwt_secret_32_chars!';
const DEFAULT_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
const DEFAULT_REPORT_PATH = path.join(WORKSPACE_ROOT, 'artifacts', 'e2e-api-report.json');

let serverProcess = null;
const runnerOptions = parseRunnerOptions(process.argv.slice(2));

function log(message) {
    console.log(`[RUNNER] ${message}`);
}

function isLocalHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function normalizeSuiteName(name) {
    if (!name || typeof name !== 'string') return DEFAULT_SUITE;
    const trimmed = name.trim();
    if (!trimmed) return DEFAULT_SUITE;

    const lower = trimmed.toLowerCase();
    const aliased = SUITE_ALIASES[lower] || trimmed;
    return aliased.endsWith('.mjs') ? aliased : `${aliased}.mjs`;
}

function resolveSuiteScriptPath(name) {
    const scriptName = normalizeSuiteName(name);
    const scriptPath = path.join(__dirname, scriptName);
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Unknown E2E suite "${name}". Resolved path does not exist: ${scriptPath}`);
    }
    return scriptPath;
}

function resolveSuiteScriptPaths(args) {
    const wantsAll = args.includes('--all');
    const positional = args.filter((item) => !item.startsWith('--'));
    const suites = wantsAll
        ? ALL_SUITES
        : positional.length > 0
            ? positional
            : [DEFAULT_SUITE];

    const paths = suites.map((suite) => resolveSuiteScriptPath(suite));
    return Array.from(new Set(paths));
}

function parseRunnerOptions(args) {
    let maxRetries = 0;
    let reportPath = process.env.HIREFLOW_E2E_REPORT_PATH || DEFAULT_REPORT_PATH;

    for (const arg of args) {
        if (arg.startsWith('--max-retries=')) {
            const raw = arg.slice('--max-retries='.length).trim();
            const parsed = Number(raw);
            if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5) {
                throw new Error(`Invalid --max-retries value "${raw}". Expected integer between 0 and 5.`);
            }
            maxRetries = parsed;
        } else if (arg.startsWith('--report=')) {
            const raw = arg.slice('--report='.length).trim();
            if (!raw) {
                throw new Error('Invalid --report value. Expected a writable file path.');
            }
            reportPath = path.isAbsolute(raw) ? raw : path.join(WORKSPACE_ROOT, raw);
        }
    }

    return {
        maxRetries,
        reportPath,
        suiteScriptPaths: resolveSuiteScriptPaths(args),
    };
}

async function checkHealth(timeoutMs = 1800) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(HEALTH_URL, { signal: controller.signal });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

function waitForProcessClose(proc) {
    return once(proc, 'exit').then(([code, signal]) => ({ code, signal }));
}

async function stopServerProcess() {
    if (!serverProcess || serverProcess.exitCode !== null) return;

    serverProcess.kill('SIGTERM');
    const closed = await Promise.race([
        waitForProcessClose(serverProcess).then(() => true).catch(() => true),
        sleep(5_000).then(() => false),
    ]);

    if (!closed && serverProcess.exitCode === null) {
        serverProcess.kill('SIGKILL');
        await waitForProcessClose(serverProcess).catch(() => undefined);
    }
}

async function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: false,
            ...options,
        });

        child.on('error', reject);
        child.on('close', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`Command failed: ${command} ${args.join(' ')} (code=${code ?? 'null'}, signal=${signal ?? 'none'})`));
        });
    });
}

async function canConnectTcp(host, port, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const done = (result) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, host);
    });
}

function resolveServerEnv(baseUrl) {
    const parsed = new URL(baseUrl);
    const fallbackPort = parsed.port
        ? Number(parsed.port)
        : parsed.protocol === 'https:'
            ? 443
            : 80;

    return {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        HOST: process.env.HOST || '0.0.0.0',
        PORT: process.env.PORT || String(fallbackPort),
        DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
        ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY,
        AUTH_COOKIE_SAMESITE: process.env.AUTH_COOKIE_SAMESITE || 'lax',
        AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE || 'false',
    };
}

async function ensureDatabaseReachable(databaseUrl) {
    let parsed;
    try {
        parsed = new URL(databaseUrl);
    } catch {
        throw new Error(`Invalid DATABASE_URL: ${databaseUrl}`);
    }

    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 5432;
    let reachable = await canConnectTcp(host, port, 1500);

    if (!reachable && process.env.HIREFLOW_E2E_AUTO_DB_START !== 'false') {
        log(`Postgres unreachable at ${host}:${port}, attempting docker compose auto-start...`);
        try {
            // First, quickly check if Docker daemon is running
            await runCommand('docker', ['info'], { stdio: 'ignore' });

            // Then attempt to start postgres
            await runCommand('docker', ['compose', 'up', '-d', 'postgres'], {
                cwd: WORKSPACE_ROOT,
            });
        } catch (error) {
            throw new Error(
                `\n============= E2E DB AUTO-START FAILED =============\n` +
                `Postgres is not reachable at ${host}:${port}, and Docker auto-start failed.\n` +
                `This usually means Docker Desktop is not running, or docker is not installed.\n\n` +
                `[FALLBACK OPTIONS]:\n` +
                ` 1. Start Docker Desktop and run this command again.\n` +
                ` 2. Manually start PostgreSQL on port ${port} with user 'hireflow' and password 'hireflow_password'.\n` +
                ` 3. Point to an existing DB using HIREFLOW_E2E_AUTO_DB_START=false DATABASE_URL=...\n` +
                `====================================================`
            );
        }

        const startedAt = Date.now();
        while (Date.now() - startedAt < 20_000) {
            reachable = await canConnectTcp(host, port, 1200);
            if (reachable) {
                log('Postgres became reachable after docker auto-start.');
                break;
            }
            await sleep(1000);
        }
    }

    if (!reachable) {
        throw new Error(
            `\n============= E2E DB UNREACHABLE =============\n` +
            `Postgres is still not reachable at ${host}:${port} after waiting.\n` +
            `Please manually resolve the database connection or restart Docker.\n` +
            `==============================================`
        );
    }
}

async function ensurePrismaMigrated(serverEnv) {
    if (process.env.HIREFLOW_E2E_SKIP_MIGRATE === 'true') {
        log('Skipping prisma migrate deploy (HIREFLOW_E2E_SKIP_MIGRATE=true).');
        return;
    }

    log('Applying prisma migrations before E2E...');
    await runCommand(
        'npm',
        ['--workspace', '@hireflow/server', 'exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
        {
            env: serverEnv,
            cwd: WORKSPACE_ROOT,
        }
    );
}

async function startLocalServerIfNeeded() {
    const healthy = await checkHealth();
    if (healthy) {
        log('Detected running API server, skipping auto-start.');
        return false;
    }

    const parsedBase = new URL(BASE_URL);
    if (!isLocalHost(parsedBase.hostname)) {
        throw new Error(
            `API is unreachable at ${BASE_URL} and auto-start only supports local hosts. Set HIREFLOW_BASE_URL to a reachable API endpoint.`
        );
    }

    const serverEnv = resolveServerEnv(BASE_URL);
    await ensureDatabaseReachable(serverEnv.DATABASE_URL);
    await ensurePrismaMigrated(serverEnv);

    log('Building server before auto-start...');
    await runCommand('npm', ['--workspace', '@hireflow/server', 'run', 'build'], {
        env: serverEnv,
    });

    log(`Starting local API server at ${BASE_URL}...`);
    serverProcess = spawn('npm', ['--workspace', '@hireflow/server', 'run', 'start'], {
        env: serverEnv,
        stdio: 'inherit',
        shell: false,
    });

    serverProcess.on('error', (error) => {
        console.error('[RUNNER] Server process error:', error);
    });

    const startedAt = Date.now();
    while (Date.now() - startedAt < SERVER_BOOT_TIMEOUT_MS) {
        if (serverProcess.exitCode !== null) {
            throw new Error(`Server exited early with code ${serverProcess.exitCode}`);
        }
        const up = await checkHealth();
        if (up) {
            log('API server is healthy.');
            return true;
        }
        await sleep(800);
    }

    throw new Error(`Timed out waiting for API health at ${HEALTH_URL}`);
}

function writeReport(reportPath, report) {
    try {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        log(`E2E report written to ${reportPath}`);
    } catch (error) {
        console.error('[RUNNER] Failed to write report:', error instanceof Error ? error.message : String(error));
    }
}

async function runSuites(suitePaths, maxRetries, results) {
    for (const suitePath of suitePaths) {
        const suiteName = path.basename(suitePath);
        const totalAttempts = maxRetries + 1;
        let attempt = 0;
        let lastError = null;

        while (attempt < totalAttempts) {
            attempt += 1;
            const startedAt = Date.now();
            try {
                log(`Running API E2E suite: ${suiteName} (attempt ${attempt}/${totalAttempts})...`);
                await runCommand('node', [suitePath], {
                    env: {
                        ...process.env,
                        HIREFLOW_BASE_URL: BASE_URL,
                    },
                });
                const durationMs = Date.now() - startedAt;
                results.push({
                    suite: suiteName,
                    status: 'passed',
                    attempts: attempt,
                    durationMs,
                });
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
                const durationMs = Date.now() - startedAt;
                if (attempt < totalAttempts) {
                    log(`Suite ${suiteName} failed in ${durationMs}ms: ${error instanceof Error ? error.message : String(error)}. Retrying...`);
                    continue;
                }

                results.push({
                    suite: suiteName,
                    status: 'failed',
                    attempts: attempt,
                    durationMs,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw new Error(`Suite ${suiteName} failed after ${attempt} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`);
            }
        }
    }
}

async function run() {
    const runStartedAt = new Date();
    const suiteResults = [];
    let runnerError = null;

    const exitWithCleanup = async (code) => {
        await stopServerProcess();
        process.exit(code);
    };

    process.on('SIGINT', () => {
        void exitWithCleanup(130);
    });
    process.on('SIGTERM', () => {
        void exitWithCleanup(143);
    });

    let startedByRunner = false;
    try {
        const suiteNames = runnerOptions.suiteScriptPaths.map((suitePath) => path.basename(suitePath)).join(', ');
        log(`Selected E2E suites: ${suiteNames}`);
        if (runnerOptions.maxRetries > 0) {
            log(`Retries enabled: ${runnerOptions.maxRetries}`);
        }

        startedByRunner = await startLocalServerIfNeeded();
        await runSuites(runnerOptions.suiteScriptPaths, runnerOptions.maxRetries, suiteResults);

        log('All selected E2E API suites completed successfully.');
    } catch (error) {
        runnerError = error;
        throw error;
    } finally {
        const finishedAt = new Date();
        writeReport(runnerOptions.reportPath, {
            startedAt: runStartedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - runStartedAt.getTime(),
            baseUrl: BASE_URL,
            status: runnerError ? 'failed' : 'passed',
            maxRetries: runnerOptions.maxRetries,
            suites: suiteResults,
            error: runnerError instanceof Error ? runnerError.message : (runnerError ? String(runnerError) : null),
        });

        if (startedByRunner) {
            log('Stopping auto-started API server...');
        }
        await stopServerProcess();
    }
}

run().catch(async (error) => {
    console.error('\n[RUNNER][FAIL]', error?.message || String(error));
    await stopServerProcess();
    process.exit(1);
});

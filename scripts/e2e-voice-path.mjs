#!/usr/bin/env node

const BASE_URL = (process.env.HIREFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;
const WS_BASE = (process.env.HIREFLOW_WS_URL || BASE_URL.replace(/^http/, 'ws')).replace(/\/$/, '');
const REQUIRE_AI_KEY = /^true$/i.test(String(process.env.HIREFLOW_E2E_REQUIRE_AI_KEY || '').trim());

const PROVIDER_DEFAULT_MODEL = {
    openai: 'gpt-4o',
    google: 'gemini-2.5-flash',
    anthropic: 'claude-sonnet-4-20250514',
    deepseek: 'deepseek-chat',
    alibaba: 'qwen-plus',
    custom: 'gpt-4o',
};

function fail(message, details) {
    console.error(`\n[FAIL] ${message}`);
    if (details) {
        if (typeof details === 'string') {
            console.error(details);
        } else {
            console.error(JSON.stringify(details, null, 2));
        }
    }
    process.exit(1);
}

function pass(message) {
    console.log(`[PASS] ${message}`);
}

function info(message) {
    console.log(`[INFO] ${message}`);
}

function skip(message) {
    console.log(`[SKIP] ${message}`);
}

async function parseJsonSafe(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function request(path, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${path}`, options);
        const payload = await parseJsonSafe(response);
        return { response, payload };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Request failed for ${path}: ${message}`);
    }
}

function assertOk(result, message) {
    if (!result.response.ok) {
        fail(message, result.payload || result.response.statusText);
    }
}

function authHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

function normalizeProvider(input) {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return '';
    if (['google', 'openai', 'anthropic', 'deepseek', 'alibaba', 'custom'].includes(value)) {
        return value;
    }
    return '';
}

function resolveProviderApiKey(provider) {
    if (provider === 'google') {
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    }
    if (provider === 'openai') {
        return process.env.OPENAI_API_KEY || '';
    }
    if (provider === 'anthropic') {
        return process.env.ANTHROPIC_API_KEY || '';
    }
    if (provider === 'deepseek') {
        return process.env.DEEPSEEK_API_KEY || '';
    }
    if (provider === 'alibaba') {
        return process.env.ALIBABA_API_KEY || process.env.DASHSCOPE_API_KEY || '';
    }
    if (provider === 'custom') {
        return process.env.HIREFLOW_E2E_AI_KEY || '';
    }
    return '';
}

function resolveBootstrapCredential(runId) {
    const explicitProvider = normalizeProvider(process.env.HIREFLOW_E2E_AI_PROVIDER);
    const explicitKey = String(process.env.HIREFLOW_E2E_AI_KEY || '').trim();
    const explicitBaseUrl = String(process.env.HIREFLOW_E2E_AI_BASE_URL || '').trim();
    const explicitKeyName = String(process.env.HIREFLOW_E2E_AI_KEY_NAME || '').trim();
    const explicitModel = String(process.env.HIREFLOW_E2E_AI_MODEL || '').trim();

    if (explicitProvider) {
        const key = explicitKey || resolveProviderApiKey(explicitProvider);
        return key
            ? {
                provider: explicitProvider,
                apiKey: key,
                baseUrl: explicitBaseUrl || undefined,
                keyName: explicitKeyName || `e2e-${explicitProvider}-${runId}`,
                model: explicitModel || PROVIDER_DEFAULT_MODEL[explicitProvider] || 'gpt-4o',
            }
            : null;
    }

    const autoProviders = ['openai', 'google', 'anthropic', 'deepseek', 'alibaba'];
    for (const provider of autoProviders) {
        const key = String(resolveProviderApiKey(provider)).trim();
        if (!key) continue;
        return {
            provider,
            apiKey: key,
            baseUrl: undefined,
            keyName: `e2e-${provider}-${runId}`,
            model: PROVIDER_DEFAULT_MODEL[provider] || 'gpt-4o',
        };
    }

    return explicitKey
        ? {
            provider: 'custom',
            apiKey: explicitKey,
            baseUrl: explicitBaseUrl || undefined,
            keyName: explicitKeyName || `e2e-custom-${runId}`,
            model: explicitModel || PROVIDER_DEFAULT_MODEL.custom,
        }
        : null;
}

async function bootstrapAiKey({ accessToken, runId }) {
    const credential = resolveBootstrapCredential(runId);
    if (!credential) return { connected: false, provider: null, model: null };

    info(`Bootstrapping AI key for provider "${credential.provider}"...`);
    const saveRes = await request('/settings/keys', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            provider: credential.provider,
            keyName: credential.keyName,
            apiKey: credential.apiKey,
            baseUrl: credential.baseUrl,
            setActive: true,
            allowUnverified: /^true$/i.test(String(process.env.HIREFLOW_E2E_AI_ALLOW_UNVERIFIED || '').trim()),
        }),
    });
    assertOk(saveRes, `Failed to connect ${credential.provider} key for voice-path E2E`);
    pass(`AI key connected (${credential.provider}/${credential.keyName})`);

    const settingsRes = await request('/settings', {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            technicalModelId: credential.model,
            defaultModelId: credential.model,
        }),
    });
    assertOk(settingsRes, 'Failed to update company model settings for voice-path E2E');
    pass(`Company model set to ${credential.model}`);

    const modelsRes = await request('/settings/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(modelsRes, 'Failed to query settings model catalog');

    const providers = Array.isArray(modelsRes.payload?.data?.providers)
        ? modelsRes.payload.data.providers
        : [];
    const targetProvider = providers.find((item) => item?.provider === credential.provider);
    if (!targetProvider?.connected) {
        fail('Connected key was not reflected in model provider status', {
            provider: credential.provider,
            providerState: targetProvider || null,
            raw: modelsRes.payload,
        });
    }
    const catalog = Array.isArray(modelsRes.payload?.data?.catalog)
        ? modelsRes.payload.data.catalog
        : [];
    if (catalog.length === 0) {
        fail('Model catalog should not be empty after API key connect', modelsRes.payload);
    }
    pass(`Model catalog ready (${catalog.length} models)`);

    return {
        connected: true,
        provider: credential.provider,
        model: credential.model,
    };
}

function waitForMessage(ws, predicate, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timed out waiting for ${label}`));
        }, timeoutMs);

        const onMessage = (event) => {
            const raw = typeof event?.data === 'string'
                ? event.data
                : Buffer.isBuffer(event?.data)
                    ? event.data.toString('utf8')
                    : '';
            if (!raw) return;
            try {
                const data = JSON.parse(raw);
                if (predicate(data)) {
                    cleanup();
                    resolve(data);
                }
            } catch {
                // ignore parse errors
            }
        };

        const onClose = () => {
            cleanup();
            reject(new Error(`WebSocket closed before receiving ${label}`));
        };

        const onError = (error) => {
            cleanup();
            reject(error instanceof Error ? error : new Error(`WebSocket error while waiting for ${label}`));
        };

        const cleanup = () => {
            clearTimeout(timer);
            ws.removeEventListener('message', onMessage);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
        };

        ws.addEventListener('message', onMessage);
        ws.addEventListener('close', onClose);
        ws.addEventListener('error', onError);
    });
}

function waitForOpen(ws, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Timed out waiting for websocket open'));
        }, timeoutMs);
        const onOpen = () => {
            cleanup();
            resolve(true);
        };
        const onError = (error) => {
            cleanup();
            reject(error instanceof Error ? error : new Error('WebSocket open error'));
        };
        const onClose = () => {
            cleanup();
            reject(new Error('WebSocket closed before open'));
        };
        const cleanup = () => {
            clearTimeout(timer);
            ws.removeEventListener('open', onOpen);
            ws.removeEventListener('error', onError);
            ws.removeEventListener('close', onClose);
        };
        ws.addEventListener('open', onOpen);
        ws.addEventListener('error', onError);
        ws.addEventListener('close', onClose);
    });
}

async function main() {
    const runId = Date.now().toString(36);
    const email = `voice_path_${runId}@hireflow.test`;
    const candidateEmail = `voice_path_candidate_${runId}@hireflow.test`;
    const password = 'hireflow_smoke_123';
    let accessToken = '';
    let jobId = '';
    let interviewToken = '';
    let aiBootstrapConnected = false;

    info(`API base: ${API_BASE}`);
    const healthRes = await fetch(`${API_BASE}/health`).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot reach server health endpoint: ${message}`);
    });
    if (!healthRes.ok) {
        fail(`Health check failed with status ${healthRes.status}`, await parseJsonSafe(healthRes));
    }
    pass('Server health check passed');

    const registerRes = await request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            password,
            name: 'Voice Path Owner',
            companyName: `Voice Path Corp ${runId}`,
            companySize: '1-20',
        }),
    });
    assertOk(registerRes, 'Register request failed');
    accessToken = registerRes.payload?.data?.accessToken || '';
    if (!accessToken) {
        fail('Register response missing accessToken', registerRes.payload);
    }
    pass('Register + access token acquired');

    const bootstrap = await bootstrapAiKey({ accessToken, runId });
    aiBootstrapConnected = bootstrap.connected;
    if (!bootstrap.connected) {
        const missingMsg = [
            'No API key provided for e2e voice-path.',
            'Set one of:',
            'HIREFLOW_E2E_AI_PROVIDER + HIREFLOW_E2E_AI_KEY',
            'or OPENAI_API_KEY/GEMINI_API_KEY/ANTHROPIC_API_KEY/DEEPSEEK_API_KEY/ALIBABA_API_KEY.',
        ].join(' ');
        if (REQUIRE_AI_KEY) {
            fail(`${missingMsg} (HIREFLOW_E2E_REQUIRE_AI_KEY=true)`);
        }
        skip(`${missingMsg} Running in non-strict mode, will allow graceful skip if start is blocked.`);
    }

    const createJobRes = await request('/jobs', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            title: `Voice Path Backend ${runId}`,
            department: 'Engineering',
            location: 'Remote',
            description: 'Voice path test job',
            requirements: ['Node.js', 'TypeScript'],
            salaryMin: 30000,
            salaryMax: 50000,
        }),
    });
    assertOk(createJobRes, 'Create job failed');
    const job = createJobRes.payload?.data;
    if (!job?.id) {
        fail('Create job response missing id', createJobRes.payload);
    }
    jobId = job.id;
    pass(`Job created (${jobId})`);

    const createCandidateRes = await request('/candidates', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            name: 'Voice Path Candidate',
            email: candidateEmail,
            phone: '13800138000',
            jobId,
            skills: ['TypeScript'],
            source: 'e2e-voice-path',
        }),
    });
    assertOk(createCandidateRes, 'Create candidate failed');
    const candidate = createCandidateRes.payload?.data;
    if (!candidate?.id) {
        fail('Create candidate response missing id', createCandidateRes.payload);
    }
    pass(`Candidate created (${candidate.id})`);

    const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const createInterviewRes = await request('/interviews', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            jobId,
            candidateId: candidate.id,
            type: 'ai_interview',
            startTime,
        }),
    });
    assertOk(createInterviewRes, 'Create interview failed');
    const interview = createInterviewRes.payload?.data;
    if (!interview?.token) {
        fail('Create interview response missing token', createInterviewRes.payload);
    }
    interviewToken = interview.token;
    pass(`Interview created (${interview.id})`);

    const startRes = await request(`/public/interview/${interviewToken}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    if (startRes.response.status === 412 && startRes.payload?.code === 'AI_KEY_REQUIRED') {
        if (REQUIRE_AI_KEY || aiBootstrapConnected) {
            fail('Interview start was blocked by AI_KEY_REQUIRED even though key bootstrap is required/attempted', {
                requireAiKey: REQUIRE_AI_KEY,
                aiBootstrapConnected,
                response: startRes.payload,
            });
        }
        skip('No connected/healthy AI key available. Skipping realtime voice-path assertions.');
        const deleteJobRes = await request(`/jobs/${jobId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        assertOk(deleteJobRes, 'Cleanup job delete failed');
        pass('Cleanup: job deleted');
        console.log('\n[SUCCESS] e2e-voice-path completed with graceful skip');
        return;
    }

    assertOk(startRes, 'Public interview start failed');
    pass('Public interview started');

    const wsUrl = `${WS_BASE}/api/ws/interview/stream?token=${encodeURIComponent(interviewToken)}`;
    const ws = new WebSocket(wsUrl);
    await waitForOpen(ws, 8000);
    pass('WebSocket connected');

    const greeting = await waitForMessage(
        ws,
        (data) => data?.type === 'ai_text' && typeof data?.text === 'string' && data.text.trim().length > 0,
        15000,
        'AI greeting',
    );
    pass(`AI greeting received (${String(greeting.text).slice(0, 30)}...)`);

    ws.send(JSON.stringify({
        type: 'user_text',
        text: '你好，我最近负责了一个招聘平台前端改版项目，主要做性能优化和交互重构。',
    }));

    const aiReply = await waitForMessage(
        ws,
        (data) => data?.type === 'ai_text' && typeof data?.text === 'string' && data.text.trim().length > 0,
        15000,
        'AI follow-up',
    );
    pass(`AI follow-up received (${String(aiReply.text).slice(0, 30)}...)`);

    ws.close();

    const endRes = await request(`/public/interview/${interviewToken}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'e2e_voice_path_complete' }),
    });
    assertOk(endRes, 'End interview failed');
    pass('Interview ended');

    const deleteJobRes = await request(`/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(deleteJobRes, 'Cleanup job delete failed');
    pass('Cleanup: job deleted');

    console.log('\n[SUCCESS] e2e-voice-path flow completed');
}

main().catch((error) => {
    fail('Unhandled exception during voice-path flow', error?.stack || String(error));
});

#!/usr/bin/env node

const BASE_URL = (process.env.HIREFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;
const START_LIMIT = Number.parseInt(process.env.PUBLIC_INTERVIEW_START_RPM || '12', 10);

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
        throw new Error(`Request failed for ${path}: ${message}. Ensure backend is running at ${API_BASE}`);
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

async function main() {
    const runId = Date.now().toString(36);
    const email = `rate_limit_${runId}@hireflow.test`;
    const candidateEmail = `rate_limit_candidate_${runId}@hireflow.test`;
    const password = 'hireflow_smoke_123';

    console.log(`[INFO] API base: ${API_BASE}`);
    console.log('[INFO] Checking server health...');
    const healthRes = await fetch(`${API_BASE}/health`).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot reach server health endpoint: ${message}.`);
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
            name: 'Rate Limit Owner',
            companyName: `Rate Limit Corp ${runId}`,
            companySize: '1-20',
        }),
    });
    assertOk(registerRes, 'Register request failed');
    const accessToken = registerRes.payload?.data?.accessToken;
    if (!accessToken) {
        fail('Register response missing accessToken', registerRes.payload);
    }
    pass('Register + access token acquired');

    const createJobRes = await request('/jobs', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            title: `Rate Limit Backend ${runId}`,
            department: 'Engineering',
            location: 'Remote',
            description: 'Rate limit test job',
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
    pass(`Job created (${job.id})`);

    const createCandidateRes = await request('/candidates', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            name: 'Rate Limit Candidate',
            email: candidateEmail,
            phone: '13800138000',
            jobId: job.id,
            skills: ['TypeScript'],
            source: 'e2e-rate-limit',
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
            jobId: job.id,
            candidateId: candidate.id,
            type: 'ai_interview',
            startTime,
        }),
    });
    assertOk(createInterviewRes, 'Create interview failed');
    const interview = createInterviewRes.payload?.data;
    if (!interview?.id || !interview?.token) {
        fail('Create interview response missing id/token', createInterviewRes.payload);
    }
    pass(`Interview created (${interview.id})`);

    const attempts = Math.max(3, START_LIMIT + 2);
    let limited = 0;
    let nonLimited = 0;
    let limitedPayload = null;

    for (let index = 0; index < attempts; index += 1) {
        const result = await request(`/public/interview/${interview.token}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (result.response.status === 429) {
            limited += 1;
            limitedPayload = result.payload;
        } else {
            nonLimited += 1;
        }
    }

    if (limited < 1) {
        fail('Public start endpoint did not trigger rate limiting as expected', {
            attempts,
            startLimit: START_LIMIT,
            limited,
            nonLimited,
        });
    }
    if (limitedPayload?.code !== 'RATE_LIMITED') {
        fail('Public start endpoint returned 429 without RATE_LIMITED payload', limitedPayload);
    }
    pass(`Public start rate limit triggered (${limited}/${attempts})`);

    const deleteJobRes = await request(`/jobs/${job.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(deleteJobRes, 'Job cleanup delete failed');
    pass('Cleanup: job deleted');

    console.log('\n[SUCCESS] e2e-public-rate-limit flow completed');
}

main().catch((error) => {
    fail('Unhandled exception during rate-limit flow', error?.stack || String(error));
});


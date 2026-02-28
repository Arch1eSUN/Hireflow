#!/usr/bin/env node

const BASE_URL = (process.env.HIREFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;

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

function authHeaders(accessToken) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

async function registerTenant(prefix, runId) {
    const res = await request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: `${prefix}_${runId}@hireflow.test`,
            password: 'hireflow_test_123',
            name: `${prefix} owner`,
            companyName: `${prefix.toUpperCase()} Corp ${runId}`,
            companySize: '1-20',
        }),
    });
    if (!res.response.ok) {
        fail(`Register failed for ${prefix}`, res.payload);
    }
    const token = res.payload?.data?.accessToken;
    if (!token) {
        fail(`Register response missing accessToken for ${prefix}`, res.payload);
    }
    return token;
}

async function main() {
    const runId = Date.now().toString(36);
    console.log(`[INFO] API base: ${API_BASE}`);
    console.log('[INFO] Checking server health...');

    const health = await fetch(`${API_BASE}/health`).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot reach server health endpoint: ${message}.`);
    });
    if (!health.ok) {
        fail(`Health check failed with status ${health.status}`, await parseJsonSafe(health));
    }
    pass('Server health check passed');

    const tokenA = await registerTenant('screening_tenant_a', runId);
    const tokenB = await registerTenant('screening_tenant_b', runId);
    pass('Registered two isolated tenants');

    const rulePayload = {
        name: `Isolation Rule ${runId}`,
        description: 'cross tenant access guard',
        conditions: {
            id: 'root',
            type: 'group',
            operator: 'AND',
            children: [
                {
                    id: 'c1',
                    type: 'condition',
                    field: 'skills',
                    operator: 'CONTAINS',
                    value: 'React',
                },
            ],
        },
    };

    const createRuleRes = await request('/screening/rules', {
        method: 'POST',
        headers: authHeaders(tokenA),
        body: JSON.stringify(rulePayload),
    });
    if (!createRuleRes.response.ok) {
        fail('Tenant A failed to create screening rule', createRuleRes.payload);
    }
    const ruleId = createRuleRes.payload?.data?.id;
    if (!ruleId) {
        fail('Created screening rule missing id', createRuleRes.payload);
    }
    pass(`Tenant A created screening rule (${ruleId})`);

    const evaluateOwnRes = await request('/screening/evaluate', {
        method: 'POST',
        headers: authHeaders(tokenA),
        body: JSON.stringify({
            ruleId,
            candidateData: {
                skills: ['React', 'TypeScript'],
                experience_years: 5,
            },
        }),
    });
    if (!evaluateOwnRes.response.ok) {
        fail('Tenant A failed to evaluate own screening rule', evaluateOwnRes.payload);
    }
    pass('Tenant A can evaluate own rule');

    const evaluateCrossRes = await request('/screening/evaluate', {
        method: 'POST',
        headers: authHeaders(tokenB),
        body: JSON.stringify({
            ruleId,
            candidateData: {
                skills: ['React'],
            },
        }),
    });
    if (evaluateCrossRes.response.status !== 404) {
        fail('Cross-tenant screening evaluate must return 404', {
            status: evaluateCrossRes.response.status,
            payload: evaluateCrossRes.payload,
        });
    }
    pass('Cross-tenant screening evaluate is blocked');

    const batchCrossRes = await request('/screening/batch-evaluate', {
        method: 'POST',
        headers: authHeaders(tokenB),
        body: JSON.stringify({
            ruleId,
            candidateIds: [],
        }),
    });
    if (batchCrossRes.response.status !== 404) {
        fail('Cross-tenant screening batch-evaluate must return 404', {
            status: batchCrossRes.response.status,
            payload: batchCrossRes.payload,
        });
    }
    pass('Cross-tenant screening batch-evaluate is blocked');

    console.log('\n[SUCCESS] e2e-screening-isolation completed');
}

main().catch((error) => {
    fail('Unhandled error during screening isolation E2E', error instanceof Error ? error.stack || error.message : String(error));
});

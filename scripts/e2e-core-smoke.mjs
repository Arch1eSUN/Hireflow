#!/usr/bin/env node

const BASE_URL = (process.env.HIREFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;
let globalAccessToken = '';
let globalCleanupJobId = '';

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

function dataOf(payload) {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return payload.data;
    }
    return payload;
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
    const email = `smoke_owner_${runId}@hireflow.test`;
    const candidateEmail = `smoke_candidate_${runId}@hireflow.test`;
    const password = 'hireflow_smoke_123';
    let accessToken = '';
    let cleanupJobId = '';

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
            name: 'E2E Smoke Owner',
            companyName: `E2E Smoke Corp ${runId}`,
            companySize: '1-20',
        }),
    });
    assertOk(registerRes, 'Register request failed');

    accessToken = registerRes.payload?.data?.accessToken;
    if (!accessToken) {
        fail('Register response missing accessToken', registerRes.payload);
    }
    globalAccessToken = accessToken;
    pass('Register + access token acquired');

    const createJobRes = await request('/jobs', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            title: `E2E Smoke Backend ${runId}`,
            department: 'Engineering',
            location: 'Remote',
            description: 'E2E smoke test job',
            requirements: ['Node.js', 'TypeScript'],
            salaryMin: 30000,
            salaryMax: 50000,
        }),
    });
    assertOk(createJobRes, 'Create job failed');
    const job = dataOf(createJobRes.payload);
    if (!job?.id) {
        fail('Create job response missing id', createJobRes.payload);
    }
    cleanupJobId = job.id;
    globalCleanupJobId = cleanupJobId;
    pass(`Job created (${job.id})`);

    const createCandidateRes = await request('/candidates', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            name: 'E2E Smoke Candidate',
            email: candidateEmail,
            phone: '13800138000',
            jobId: job.id,
            skills: ['TypeScript'],
            source: 'e2e-smoke',
        }),
    });
    assertOk(createCandidateRes, 'Create candidate failed');
    const candidate = dataOf(createCandidateRes.payload);
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
    const interview = dataOf(createInterviewRes.payload);
    if (!interview?.id || !interview?.token) {
        fail('Create interview response missing id/token', createInterviewRes.payload);
    }
    pass(`Interview created (${interview.id})`);

    const monitorStateRes = await request(`/interviews/${interview.id}/monitor-state`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(monitorStateRes, 'Monitor state fetch failed');
    pass('Monitor state fetched');

    const monitorPolicyRes = await request(`/interviews/${interview.id}/monitor-policy`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(monitorPolicyRes, 'Monitor policy fetch failed');
    const monitorPolicy = dataOf(monitorPolicyRes.payload);
    if (!monitorPolicy?.policy) {
        fail('Monitor policy payload missing policy field', monitorPolicyRes.payload);
    }
    pass('Monitor policy fetched');

    const updatePolicyRes = await request(`/interviews/${interview.id}/monitor-policy`, {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            autoTerminateEnabled: true,
            maxAutoReshareAttempts: 4,
            heartbeatTerminateThresholdSec: 60,
            invalidSurfaceTerminateThreshold: 2,
            enforceFullscreen: true,
            enforceEntireScreenShare: true,
            strictClipboardProtection: true,
            codeSyncIntervalMs: 350,
            reason: 'smoke monitor policy baseline',
            idempotencyKey: `smoke-interview-policy-save-${runId}`,
        }),
    });
    assertOk(updatePolicyRes, 'Update monitor policy failed');
    pass('Monitor policy updated');

    const updatePolicyReplayRes = await request(`/interviews/${interview.id}/monitor-policy`, {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            autoTerminateEnabled: true,
            maxAutoReshareAttempts: 7,
            heartbeatTerminateThresholdSec: 80,
            invalidSurfaceTerminateThreshold: 3,
            enforceFullscreen: true,
            enforceEntireScreenShare: true,
            strictClipboardProtection: true,
            codeSyncIntervalMs: 500,
            reason: 'should not be applied on replay',
            idempotencyKey: `smoke-interview-policy-save-${runId}`,
        }),
    });
    assertOk(updatePolicyReplayRes, 'Update monitor policy idempotent replay failed');
    const replayPayload = dataOf(updatePolicyReplayRes.payload);
    if (!replayPayload?.idempotentReplay) {
        fail('Interview monitor policy replay did not return idempotentReplay=true', updatePolicyReplayRes.payload);
    }
    if (replayPayload?.policy?.maxAutoReshareAttempts !== 4) {
        fail('Interview monitor policy replay returned unexpected policy payload', updatePolicyReplayRes.payload);
    }
    pass('Interview monitor policy save idempotency validated');

    const monitorPolicyHistoryRes = await request(`/interviews/${interview.id}/monitor-policy/history?limit=8`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(monitorPolicyHistoryRes, 'Interview monitor policy history fetch failed');
    const monitorHistory = dataOf(monitorPolicyHistoryRes.payload)?.history || [];
    if (!Array.isArray(monitorHistory) || monitorHistory.length === 0) {
        fail('Interview monitor policy history is empty', monitorPolicyHistoryRes.payload);
    }
    if (typeof monitorHistory[0]?.reason !== 'string' || monitorHistory[0].reason.length < 2) {
        fail('Interview monitor policy history missing reason field on latest entry', monitorPolicyHistoryRes.payload);
    }
    const rollbackTarget = monitorHistory[monitorHistory.length - 1];
    if (!rollbackTarget?.id) {
        fail('Interview monitor policy rollback target missing id', monitorPolicyHistoryRes.payload);
    }

    const rollbackMonitorPolicyRes = await request(`/interviews/${interview.id}/monitor-policy/rollback`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            versionId: rollbackTarget.id,
            reason: 'smoke rollback interview monitor policy',
            idempotencyKey: `smoke-interview-policy-rollback-${runId}`,
        }),
    });
    assertOk(rollbackMonitorPolicyRes, 'Interview monitor policy rollback failed');

    const rollbackMonitorPolicyReplayRes = await request(`/interviews/${interview.id}/monitor-policy/rollback`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            versionId: rollbackTarget.id,
            reason: 'should not apply on replay',
            idempotencyKey: `smoke-interview-policy-rollback-${runId}`,
        }),
    });
    assertOk(rollbackMonitorPolicyReplayRes, 'Interview monitor policy rollback replay failed');
    const rollbackReplayPayload = dataOf(rollbackMonitorPolicyReplayRes.payload);
    if (!rollbackReplayPayload?.idempotentReplay) {
        fail('Interview monitor policy rollback replay missing idempotentReplay=true', rollbackMonitorPolicyReplayRes.payload);
    }
    pass('Interview monitor policy rollback idempotency validated');

    const chainPolicyRes = await request('/settings/evidence-chain-policy', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(chainPolicyRes, 'Evidence chain policy fetch failed');
    const chainPolicy = dataOf(chainPolicyRes.payload);
    if (!chainPolicy?.policy || typeof chainPolicy.policy.blockOnBrokenChain !== 'boolean') {
        fail('Evidence chain policy payload invalid', chainPolicyRes.payload);
    }
    pass('Evidence chain policy fetched');

    const saveChainPolicyV1Res = await request('/settings/evidence-chain-policy', {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            blockOnBrokenChain: true,
            blockOnPartialChain: false,
            reason: 'smoke evidence policy baseline',
            idempotencyKey: `smoke-company-evidence-policy-save-${runId}`,
        }),
    });
    assertOk(saveChainPolicyV1Res, 'Evidence chain policy save(v1) failed');

    const saveChainPolicyV1ReplayRes = await request('/settings/evidence-chain-policy', {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            blockOnBrokenChain: false,
            blockOnPartialChain: true,
            reason: 'should not apply on replay',
            idempotencyKey: `smoke-company-evidence-policy-save-${runId}`,
        }),
    });
    assertOk(saveChainPolicyV1ReplayRes, 'Evidence chain policy save(v1 replay) failed');
    const saveChainPolicyReplayPayload = dataOf(saveChainPolicyV1ReplayRes.payload);
    if (!saveChainPolicyReplayPayload?.idempotentReplay) {
        fail('Evidence chain policy save replay missing idempotentReplay=true', saveChainPolicyV1ReplayRes.payload);
    }
    if (saveChainPolicyReplayPayload?.policy?.blockOnPartialChain !== false) {
        fail('Evidence chain policy save replay returned unexpected policy payload', saveChainPolicyV1ReplayRes.payload);
    }
    pass('Evidence chain policy save idempotency validated');

    const saveChainPolicyV2Res = await request('/settings/evidence-chain-policy', {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            blockOnBrokenChain: true,
            blockOnPartialChain: true,
        }),
    });
    assertOk(saveChainPolicyV2Res, 'Evidence chain policy save(v2) failed');

    const chainPolicyHistoryRes = await request('/settings/evidence-chain-policy/history?limit=5', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(chainPolicyHistoryRes, 'Evidence chain policy history fetch failed');
    const chainHistory = dataOf(chainPolicyHistoryRes.payload)?.history || [];
    if (!Array.isArray(chainHistory) || chainHistory.length < 2) {
        fail('Evidence chain policy history insufficient entries', chainPolicyHistoryRes.payload);
    }
    if (typeof chainHistory[0]?.reason !== 'string' || chainHistory[0].reason.length < 2) {
        fail('Evidence chain policy history latest item missing reason field', chainPolicyHistoryRes.payload);
    }

    const chainRollbackTarget = chainHistory[1];
    if (!chainRollbackTarget?.id) {
        fail('Evidence chain policy rollback target missing id', chainPolicyHistoryRes.payload);
    }

    const rollbackChainPolicyRes = await request('/settings/evidence-chain-policy/rollback', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            versionId: chainRollbackTarget.id,
            reason: 'smoke rollback company evidence policy',
            idempotencyKey: `smoke-company-evidence-policy-rollback-${runId}`,
        }),
    });
    assertOk(rollbackChainPolicyRes, 'Evidence chain policy rollback failed');
    const rollbackPolicy = dataOf(rollbackChainPolicyRes.payload)?.policy;
    if (!rollbackPolicy || rollbackPolicy.blockOnPartialChain !== false) {
        fail('Evidence chain policy rollback did not restore expected version', rollbackChainPolicyRes.payload);
    }
    pass('Evidence chain policy history + rollback validated');

    const publicPreviewRes = await request(`/public/interview/${interview.token}`, {
        method: 'GET',
    });
    assertOk(publicPreviewRes, 'Public interview preview failed');
    pass('Public interview preview fetched');

    const startInterviewRes = await request(`/public/interview/${interview.token}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    const startBlockedByMissingKey = (
        startInterviewRes.response.status === 412
        && startInterviewRes.payload?.code === 'AI_KEY_REQUIRED'
    );
    if (startInterviewRes.response.ok) {
        pass('Public interview started');
    } else if (startBlockedByMissingKey) {
        pass('Public interview start correctly blocked when no AI key is configured');
    } else {
        fail('Public interview start failed', startInterviewRes.payload);
    }

    const integrityEventRes = await request(`/public/interview/${interview.token}/integrity-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'COPY_PASTE',
            severity: 'high',
            message: 'E2E smoke integrity signal',
        }),
    });
    assertOk(integrityEventRes, 'Public integrity event ingestion failed');
    pass('Public integrity event ingested');

    const integrityRes = await request(`/interviews/${interview.id}/integrity`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(integrityRes, 'Interview integrity insight fetch failed');
    const integrity = dataOf(integrityRes.payload);
    if (typeof integrity?.eventCount !== 'number' || integrity.eventCount < 1) {
        fail('Interview integrity eventCount is invalid', integrityRes.payload);
    }
    pass('Interview integrity insight fetched');

    const monitorAlertRes = await request(`/interviews/${interview.id}/monitor-alerts`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            type: 'manual_intervention',
            severity: 'medium',
            message: 'E2E smoke monitor alert',
            metadata: { from: 'e2e-core-smoke' },
        }),
    });
    assertOk(monitorAlertRes, 'Monitor alert persistence failed');
    pass('Monitor alert persisted');

    const monitorAlertListRes = await request(`/interviews/${interview.id}/monitor-alerts?limit=20`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(monitorAlertListRes, 'Monitor alert list fetch failed');
    const alerts = dataOf(monitorAlertListRes.payload);
    if (!Array.isArray(alerts) || alerts.length === 0) {
        fail('Monitor alert list is empty after creating alert', monitorAlertListRes.payload);
    }
    pass('Monitor alert list fetched');

    const evidenceExportRes = await request(`/interviews/${interview.id}/evidence-exports`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
            mode: 'json',
            files: ['evidence-smoke.json'],
            summary: {
                integrityEventCount: 1,
                monitorAlertCount: 1,
                timelineEventCount: 2,
                policyReasonEvents: 1,
                policyReasonUnique: 1,
                policyTopReasons: [
                    { reason: 'smoke-policy-reason', count: 1 },
                ],
            },
        }),
    });
    assertOk(evidenceExportRes, 'Evidence export log persistence failed');
    pass('Evidence export log persisted');

    const evidenceHistoryRes = await request(`/interviews/${interview.id}/evidence-exports?limit=20`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(evidenceHistoryRes, 'Evidence export history fetch failed');
    const exportHistory = dataOf(evidenceHistoryRes.payload)?.history || [];
    if (!Array.isArray(exportHistory) || exportHistory.length === 0) {
        fail('Evidence export history is empty after persisting export log', evidenceHistoryRes.payload);
    }
    const latestExport = exportHistory[0];
    if (!latestExport?.summary || latestExport.summary.policyReasonEvents !== 1) {
        fail('Evidence export summary missing policyReasonEvents', evidenceHistoryRes.payload);
    }
    if (latestExport.summary.policyReasonUnique !== 1) {
        fail('Evidence export summary missing policyReasonUnique', evidenceHistoryRes.payload);
    }
    if (!Array.isArray(latestExport.summary.policyTopReasons) || latestExport.summary.policyTopReasons.length === 0) {
        fail('Evidence export summary missing policyTopReasons', evidenceHistoryRes.payload);
    }
    pass('Evidence export history fetched');

    const evidenceTimelineRes = await request(`/interviews/${interview.id}/evidence-timeline?limit=40`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(evidenceTimelineRes, 'Evidence timeline fetch failed');
    const evidenceTimeline = dataOf(evidenceTimelineRes.payload)?.timeline || [];
    if (!Array.isArray(evidenceTimeline) || evidenceTimeline.length === 0) {
        fail('Evidence timeline is empty', evidenceTimelineRes.payload);
    }
    const exportPolicyReasonItem = evidenceTimeline.find((item) => (
        item?.category === 'export' &&
        typeof item?.message === 'string' &&
        item.message.toLowerCase().includes('policy reasons')
    ));
    if (!exportPolicyReasonItem) {
        fail('Evidence timeline missing export event with policy reasons summary', evidenceTimelineRes.payload);
    }
    if (!String(exportPolicyReasonItem.message || '').toLowerCase().includes('policy reasons 1')) {
        fail('Evidence timeline export event missing expected policy reasons count', evidenceTimelineRes.payload);
    }
    const policyReasonItem = evidenceTimeline.find((item) => (
        item?.category === 'policy' &&
        typeof item?.message === 'string' &&
        item.message.toLowerCase().includes('reason:')
    ));
    if (!policyReasonItem) {
        fail('Evidence timeline missing policy event with reason message', evidenceTimelineRes.payload);
    }
    pass('Evidence timeline fetched');

    const overviewRes = await request('/integrity/overview?days=30&limit=20', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(overviewRes, 'Integrity overview fetch failed');
    const overview = dataOf(overviewRes.payload);
    if (!overview?.summary || typeof overview.summary.monitoredInterviews !== 'number') {
        fail('Integrity overview summary invalid', overviewRes.payload);
    }
    pass('Integrity overview fetched');

    const terminateRes = await request(`/interviews/${interview.id}/terminate`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ reason: 'e2e_smoke_cleanup' }),
    });
    assertOk(terminateRes, 'Interview terminate failed');
    pass('Interview terminated for cleanup');

    const chainVerifyRes = await request(`/interviews/${interview.id}/evidence-chain/verify?limit=80`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(chainVerifyRes, 'Evidence chain verify failed');
    const chain = dataOf(chainVerifyRes.payload);
    if (!chain || (chain.status !== 'valid' && chain.status !== 'partial')) {
        fail('Evidence chain verify returned invalid status', chainVerifyRes.payload);
    }
    if (typeof chain.linkedEvents !== 'number' || chain.linkedEvents < 4) {
        fail('Evidence chain linkedEvents is lower than expected', chainVerifyRes.payload);
    }
    pass(`Evidence chain verified (${chain.status}, linked=${chain.linkedEvents})`);

    const deleteJobRes = await request(`/jobs/${job.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertOk(deleteJobRes, 'Job cleanup delete failed');
    cleanupJobId = '';
    globalCleanupJobId = '';
    pass('Smoke cleanup: job deleted');

    console.log('\n[SUCCESS] e2e-core-smoke flow completed');
}

main().catch((error) => {
    if (globalCleanupJobId && globalAccessToken) {
        // Best-effort cleanup in failure path.
        void request(`/jobs/${globalCleanupJobId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${globalAccessToken}` },
        }).catch(() => undefined);
    }
    fail('Unhandled exception during smoke flow', error?.stack || String(error));
});

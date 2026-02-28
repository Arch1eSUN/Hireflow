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

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractCookie(response) {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const cookies = getSetCookie ? getSetCookie() : [];
  if (Array.isArray(cookies) && cookies.length > 0) {
    return cookies.map((item) => item.split(';')[0]).join('; ');
  }
  const single = response.headers.get('set-cookie');
  return single ? single.split(';')[0] : '';
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

async function main() {
  const runId = Date.now().toString(36);
  const email = `e2e_${runId}@hireflow.test`;
  const password = 'hireflow_e2e_123';

  console.log(`[INFO] API base: ${API_BASE}`);
  console.log('[INFO] Checking server health...');

  const healthRes = await fetch(`${API_BASE}/health`).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot reach server health endpoint: ${message}. Start server first (npm run dev:server).`);
  });
  if (!healthRes.ok) {
    fail(`Health check failed with status ${healthRes.status}`, await parseJsonSafe(healthRes));
  }
  console.log('[PASS] Server health check passed');

  console.log(`[INFO] Registering test user: ${email}`);

  const registerRes = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name: 'E2E Test Owner',
      companyName: `E2E Corp ${runId}`,
      companySize: '1-20',
    }),
  });

  if (!registerRes.response.ok) {
    fail('Register request failed', registerRes.payload || registerRes.response.statusText);
  }

  const accessToken = registerRes.payload?.data?.accessToken;
  const refreshCookie = extractCookie(registerRes.response);
  if (!accessToken) {
    fail('Register response missing accessToken', registerRes.payload);
  }
  if (!refreshCookie) {
    fail('Register response missing refresh cookie', registerRes.payload);
  }

  console.log('[PASS] Register and auto-login succeeded');

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const templatePolicy = {
    autoTerminateEnabled: true,
    maxAutoReshareAttempts: 4,
    heartbeatTerminateThresholdSec: 50,
    invalidSurfaceTerminateThreshold: 2,
    enforceFullscreen: true,
    enforceEntireScreenShare: true,
    strictClipboardProtection: true,
    codeSyncIntervalMs: 350,
  };
  const saveIdempotencyKey = `e2e-auth-policy-save-${runId}`;
  const rollbackIdempotencyKey = `e2e-auth-policy-rollback-${runId}`;
  const evidenceSaveIdempotencyKey = `e2e-auth-evidence-save-${runId}`;
  const evidenceSaveV2IdempotencyKey = `e2e-auth-evidence-save-v2-${runId}`;
  const evidenceRollbackIdempotencyKey = `e2e-auth-evidence-rollback-${runId}`;

  const savePolicyRes = await request('/settings/monitor-policy', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      ...templatePolicy,
      reason: 'e2e auth policy baseline',
      idempotencyKey: saveIdempotencyKey,
    }),
  });

  if (!savePolicyRes.response.ok) {
    fail('Saving monitor policy template failed', savePolicyRes.payload || savePolicyRes.response.statusText);
  }

  console.log('[PASS] Monitor policy template saved');

  const savePolicyReplayRes = await request('/settings/monitor-policy', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      ...templatePolicy,
      maxAutoReshareAttempts: 9,
      heartbeatTerminateThresholdSec: 90,
      reason: 'should not apply on replay',
      idempotencyKey: saveIdempotencyKey,
    }),
  });

  if (!savePolicyReplayRes.response.ok) {
    fail('Saving monitor policy template replay failed', savePolicyReplayRes.payload || savePolicyReplayRes.response.statusText);
  }
  const replayData = savePolicyReplayRes.payload?.data;
  if (!replayData?.idempotentReplay) {
    fail('Save replay did not return idempotentReplay=true', savePolicyReplayRes.payload);
  }
  if (replayData?.policy?.maxAutoReshareAttempts !== 4) {
    fail('Save replay returned unexpected policy payload', savePolicyReplayRes.payload);
  }
  console.log('[PASS] Monitor policy template save idempotency validated');

  const historyRes = await request('/settings/monitor-policy/history?limit=10', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!historyRes.response.ok) {
    fail('Loading monitor policy history failed', historyRes.payload || historyRes.response.statusText);
  }

  const history = historyRes.payload?.data?.history || [];
  if (!Array.isArray(history) || history.length === 0) {
    fail('Monitor policy history is empty after save', historyRes.payload);
  }
  if (typeof history[0]?.reason !== 'string' || history[0].reason.length < 2) {
    fail('Monitor policy history latest item missing reason', historyRes.payload);
  }

  const rollbackTarget = history[history.length - 1] || history[0];
  if (!rollbackTarget?.id) {
    fail('No rollback target versionId found', historyRes.payload);
  }

  console.log(`[INFO] Rolling back to version: ${rollbackTarget.id}`);
  const rollbackRes = await request('/settings/monitor-policy/rollback', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      versionId: rollbackTarget.id,
      reason: 'e2e rollback monitor policy',
      idempotencyKey: rollbackIdempotencyKey,
    }),
  });

  if (!rollbackRes.response.ok) {
    fail('Rollback monitor policy template failed', rollbackRes.payload || rollbackRes.response.statusText);
  }

  console.log('[PASS] Monitor policy template rollback succeeded');

  const rollbackReplayRes = await request('/settings/monitor-policy/rollback', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      versionId: rollbackTarget.id,
      reason: 'should not apply on replay',
      idempotencyKey: rollbackIdempotencyKey,
    }),
  });

  if (!rollbackReplayRes.response.ok) {
    fail('Rollback monitor policy template replay failed', rollbackReplayRes.payload || rollbackReplayRes.response.statusText);
  }
  const rollbackReplayData = rollbackReplayRes.payload?.data;
  if (!rollbackReplayData?.idempotentReplay) {
    fail('Rollback replay did not return idempotentReplay=true', rollbackReplayRes.payload);
  }
  console.log('[PASS] Monitor policy template rollback idempotency validated');

  const saveEvidencePolicyV1Res = await request('/settings/evidence-chain-policy', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      blockOnBrokenChain: true,
      blockOnPartialChain: false,
      reason: 'e2e auth evidence baseline',
      idempotencyKey: evidenceSaveIdempotencyKey,
    }),
  });

  if (!saveEvidencePolicyV1Res.response.ok) {
    fail('Saving evidence chain policy v1 failed', saveEvidencePolicyV1Res.payload || saveEvidencePolicyV1Res.response.statusText);
  }
  if (saveEvidencePolicyV1Res.payload?.data?.policy?.blockOnPartialChain !== false) {
    fail('Unexpected evidence policy payload after v1 save', saveEvidencePolicyV1Res.payload);
  }
  console.log('[PASS] Evidence chain policy v1 saved');

  const saveEvidencePolicyV1ReplayRes = await request('/settings/evidence-chain-policy', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      blockOnBrokenChain: false,
      blockOnPartialChain: true,
      reason: 'should not apply on replay',
      idempotencyKey: evidenceSaveIdempotencyKey,
    }),
  });

  if (!saveEvidencePolicyV1ReplayRes.response.ok) {
    fail('Saving evidence chain policy v1 replay failed', saveEvidencePolicyV1ReplayRes.payload || saveEvidencePolicyV1ReplayRes.response.statusText);
  }
  const evidenceSaveReplayData = saveEvidencePolicyV1ReplayRes.payload?.data;
  if (!evidenceSaveReplayData?.idempotentReplay) {
    fail('Evidence policy save replay did not return idempotentReplay=true', saveEvidencePolicyV1ReplayRes.payload);
  }
  if (evidenceSaveReplayData?.policy?.blockOnPartialChain !== false) {
    fail('Evidence policy save replay returned unexpected policy payload', saveEvidencePolicyV1ReplayRes.payload);
  }
  console.log('[PASS] Evidence chain policy save idempotency validated');

  const saveEvidencePolicyV2Res = await request('/settings/evidence-chain-policy', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      blockOnBrokenChain: true,
      blockOnPartialChain: true,
      reason: 'e2e auth evidence tighten policy',
      idempotencyKey: evidenceSaveV2IdempotencyKey,
    }),
  });

  if (!saveEvidencePolicyV2Res.response.ok) {
    fail('Saving evidence chain policy v2 failed', saveEvidencePolicyV2Res.payload || saveEvidencePolicyV2Res.response.statusText);
  }
  if (saveEvidencePolicyV2Res.payload?.data?.policy?.blockOnPartialChain !== true) {
    fail('Unexpected evidence policy payload after v2 save', saveEvidencePolicyV2Res.payload);
  }
  console.log('[PASS] Evidence chain policy v2 saved');

  const evidenceHistoryRes = await request('/settings/evidence-chain-policy/history?limit=10', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!evidenceHistoryRes.response.ok) {
    fail('Loading evidence chain policy history failed', evidenceHistoryRes.payload || evidenceHistoryRes.response.statusText);
  }
  const evidenceHistory = evidenceHistoryRes.payload?.data?.history || [];
  if (!Array.isArray(evidenceHistory) || evidenceHistory.length < 2) {
    fail('Evidence chain policy history insufficient entries', evidenceHistoryRes.payload);
  }
  if (typeof evidenceHistory[0]?.reason !== 'string' || evidenceHistory[0].reason.length < 2) {
    fail('Evidence chain policy history latest item missing reason', evidenceHistoryRes.payload);
  }

  const evidenceRollbackTarget = evidenceHistory[1];
  if (!evidenceRollbackTarget?.id) {
    fail('No evidence policy rollback target versionId found', evidenceHistoryRes.payload);
  }

  const rollbackEvidencePolicyRes = await request('/settings/evidence-chain-policy/rollback', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      versionId: evidenceRollbackTarget.id,
      reason: 'e2e rollback evidence chain policy',
      idempotencyKey: evidenceRollbackIdempotencyKey,
    }),
  });

  if (!rollbackEvidencePolicyRes.response.ok) {
    fail('Rollback evidence chain policy failed', rollbackEvidencePolicyRes.payload || rollbackEvidencePolicyRes.response.statusText);
  }
  if (rollbackEvidencePolicyRes.payload?.data?.policy?.blockOnPartialChain !== false) {
    fail('Evidence chain rollback did not restore expected value', rollbackEvidencePolicyRes.payload);
  }
  console.log('[PASS] Evidence chain policy rollback succeeded');

  const rollbackEvidencePolicyReplayRes = await request('/settings/evidence-chain-policy/rollback', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      versionId: evidenceRollbackTarget.id,
      reason: 'should not apply on replay',
      idempotencyKey: evidenceRollbackIdempotencyKey,
    }),
  });

  if (!rollbackEvidencePolicyReplayRes.response.ok) {
    fail('Rollback evidence chain policy replay failed', rollbackEvidencePolicyReplayRes.payload || rollbackEvidencePolicyReplayRes.response.statusText);
  }
  const evidenceRollbackReplayData = rollbackEvidencePolicyReplayRes.payload?.data;
  if (!evidenceRollbackReplayData?.idempotentReplay) {
    fail('Evidence chain rollback replay did not return idempotentReplay=true', rollbackEvidencePolicyReplayRes.payload);
  }
  if (evidenceRollbackReplayData?.policy?.blockOnPartialChain !== false) {
    fail('Evidence chain rollback replay returned unexpected policy payload', rollbackEvidencePolicyReplayRes.payload);
  }
  console.log('[PASS] Evidence chain policy rollback idempotency validated');

  const logoutRes = await request('/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: refreshCookie,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!logoutRes.response.ok) {
    fail('Logout request failed', logoutRes.payload || logoutRes.response.statusText);
  }

  console.log('[PASS] Logout succeeded');

  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    headers: { Cookie: refreshCookie },
  });

  if (refreshRes.response.ok) {
    fail('Refresh token still valid after logout (expected 401)', refreshRes.payload);
  }

  if (refreshRes.response.status !== 401) {
    fail(`Unexpected refresh status after logout: ${refreshRes.response.status}`, refreshRes.payload);
  }

  console.log('[PASS] Refresh token invalidated after logout');
  console.log('\n[SUCCESS] e2e-auth-policy flow completed');
}

main().catch((error) => {
  fail('Unhandled exception during E2E flow', error?.stack || String(error));
});

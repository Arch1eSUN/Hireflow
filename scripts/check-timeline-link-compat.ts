#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import {
    applyTimelineQueryState,
    getTimelineSearchParam,
    hasLegacyTimelineSearchParams,
    parseTimelineCategoryParam,
    parseTimelineSeverityParam,
    timelineQueryKeysLegacy,
    timelineQueryKeysV2,
} from '../apps/portal/src/lib/timelineQueryParams';

function expectLegacyMigration() {
    const legacy = new URLSearchParams({
        tlCategory: 'policy',
        tlSeverity: 'high',
        tlAction: 'monitor.policy.updated',
        tlReason: 'manual rollback',
        tlEvent: 'event-123',
        tlExport: 'export-456',
    });

    assert.equal(hasLegacyTimelineSearchParams(legacy), true, 'Legacy params should be detected');

    const migrated = applyTimelineQueryState(legacy, {
        category: parseTimelineCategoryParam(getTimelineSearchParam(legacy, 'category')),
        severity: parseTimelineSeverityParam(getTimelineSearchParam(legacy, 'severity')),
        action: getTimelineSearchParam(legacy, 'action'),
        reason: getTimelineSearchParam(legacy, 'reason'),
        event: getTimelineSearchParam(legacy, 'event'),
        exportId: getTimelineSearchParam(legacy, 'export'),
    });

    assert.equal(migrated.get(timelineQueryKeysV2.version), '2', 'v2 version marker should be present');
    assert.equal(migrated.get(timelineQueryKeysV2.category), 'policy');
    assert.equal(migrated.get(timelineQueryKeysV2.severity), 'high');
    assert.equal(migrated.get(timelineQueryKeysV2.action), 'monitor.policy.updated');
    assert.equal(migrated.get(timelineQueryKeysV2.reason), 'manual rollback');
    assert.equal(migrated.get(timelineQueryKeysV2.event), 'event-123');
    assert.equal(migrated.get(timelineQueryKeysV2.export), 'export-456');

    for (const key of Object.values(timelineQueryKeysLegacy)) {
        assert.equal(migrated.get(key), null, `Legacy key ${key} should be removed after migration`);
    }
}

function expectV2PriorityOverLegacy() {
    const mixed = new URLSearchParams({
        [timelineQueryKeysV2.category]: 'alert',
        [timelineQueryKeysLegacy.category]: 'policy',
    });
    assert.equal(getTimelineSearchParam(mixed, 'category'), 'alert', 'v2 value should override legacy value');
}

function expectStateCleanup() {
    const empty = applyTimelineQueryState(new URLSearchParams(), {
        category: 'all',
        severity: 'all',
        action: null,
        reason: null,
        event: null,
        exportId: null,
    });
    assert.equal(empty.get(timelineQueryKeysV2.version), null, 'version marker should be removed when state is empty');
    assert.equal(empty.get(timelineQueryKeysV2.category), null);
    assert.equal(empty.get(timelineQueryKeysV2.severity), null);
    assert.equal(empty.get(timelineQueryKeysV2.action), null);
    assert.equal(empty.get(timelineQueryKeysV2.reason), null);
    assert.equal(empty.get(timelineQueryKeysV2.event), null);
    assert.equal(empty.get(timelineQueryKeysV2.export), null);
}

function main() {
    expectLegacyMigration();
    expectV2PriorityOverLegacy();
    expectStateCleanup();
    console.log('[PASS] Timeline query compatibility checks passed');
}

main();

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  chooseRememberedTab,
  restoreWorkspaceMemory,
  serializeWorkspaceMemory,
} = require('../workspace-state');

test('workspace selection returns its last active tab instead of its first tab', () => {
  const tabs = [
    { id: 4, workspaceId: 'work' },
    { id: 7, workspaceId: 'work' },
    { id: 9, workspaceId: 'work' },
  ];
  assert.equal(chooseRememberedTab('work', tabs, 7).id, 7);
  assert.equal(chooseRememberedTab('work', tabs, 99).id, 4);
  assert.equal(chooseRememberedTab('work', [], 7), null);
});

test('per-workspace active tabs survive serialized session restoration', () => {
  const oldTabs = [
    { id: 11, workspaceId: 'default' },
    { id: 12, workspaceId: 'work' },
    { id: 13, workspaceId: 'work' },
    { id: 14, workspaceId: 'personal' },
  ];
  const saved = serializeWorkspaceMemory(oldTabs, new Map([
    ['default', 11],
    ['work', 13],
    ['personal', 14],
  ]));
  assert.deepEqual(saved, { default: 0, work: 2, personal: 3 });

  const restored = restoreWorkspaceMemory([
    { id: 101, workspaceId: 'default' },
    { id: 102, workspaceId: 'work' },
    { id: 103, workspaceId: 'work' },
    { id: 104, workspaceId: 'personal' },
  ], saved);
  assert.equal(restored.get('default'), 101);
  assert.equal(restored.get('work'), 103);
  assert.equal(restored.get('personal'), 104);
});

test('invalid saved workspace indexes safely fall back to the first workspace tab', () => {
  const restored = restoreWorkspaceMemory([
    { id: 21, workspaceId: 'work' },
    { id: 22, workspaceId: 'work' },
  ], { work: 50, personal: 0 });
  assert.equal(restored.get('work'), 21);
  assert.equal(restored.has('personal'), false);
});

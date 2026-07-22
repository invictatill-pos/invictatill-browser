'use strict';

function workspaceIdOf(tab) {
  return tab && tab.workspaceId ? String(tab.workspaceId) : 'default';
}

function chooseRememberedTab(workspaceId, workspaceTabs, rememberedTabId) {
  const tabs = Array.isArray(workspaceTabs) ? workspaceTabs : [];
  if (!tabs.length) return null;
  const remembered = tabs.find((tab) => tab && tab.id === rememberedTabId);
  return remembered || tabs[0];
}

function serializeWorkspaceMemory(tabRecords, rememberedByWorkspace) {
  const records = Array.isArray(tabRecords) ? tabRecords : [];
  const memory = rememberedByWorkspace instanceof Map ? rememberedByWorkspace : new Map();
  const result = {};
  for (const [workspaceId, tabId] of memory.entries()) {
    const index = records.findIndex((tab) => tab && tab.id === tabId && workspaceIdOf(tab) === workspaceId);
    if (index >= 0) result[workspaceId] = index;
  }
  return result;
}

function restoreWorkspaceMemory(tabRecords, savedIndexes) {
  const records = Array.isArray(tabRecords) ? tabRecords : [];
  const saved = savedIndexes && typeof savedIndexes === 'object' && !Array.isArray(savedIndexes)
    ? savedIndexes
    : {};
  const memory = new Map();
  for (const [workspaceId, rawIndex] of Object.entries(saved)) {
    const index = Number(rawIndex);
    const tab = Number.isInteger(index) ? records[index] : null;
    if (tab && workspaceIdOf(tab) === workspaceId) memory.set(workspaceId, tab.id);
  }
  for (const tab of records) {
    const workspaceId = workspaceIdOf(tab);
    if (tab && !memory.has(workspaceId)) memory.set(workspaceId, tab.id);
  }
  return memory;
}

module.exports = {
  chooseRememberedTab,
  restoreWorkspaceMemory,
  serializeWorkspaceMemory,
  workspaceIdOf,
};

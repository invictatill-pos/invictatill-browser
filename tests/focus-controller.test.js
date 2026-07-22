'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createFocusController } = require('../focus-controller');

function fixture() {
  let time = new Date('2026-07-22T09:00:00').getTime();
  let scheduled = null;
  let savedState = null;
  let savedHistory = [];
  const sent = [];
  const notifications = [];
  const controller = createFocusController({
    now: () => time,
    schedule: (callback, delay) => {
      scheduled = { callback, delay, unref() {} };
      return scheduled;
    },
    unschedule: () => { scheduled = null; },
    loadState: () => savedState,
    saveState: (value) => { savedState = value; },
    loadHistory: () => savedHistory,
    saveHistory: (value) => { savedHistory = value; },
    send: (channel, payload) => sent.push({ channel, payload }),
    notify: (mode, intention) => notifications.push({ mode, intention }),
  });
  return {
    controller,
    notifications,
    sent,
    getScheduled: () => scheduled,
    setTime: (value) => { time = value; },
    getTime: () => time,
    getHistory: () => savedHistory,
  };
}

test('focus session starts, pauses, resumes, and retains its intention', () => {
  const testState = fixture();
  const started = testState.controller.start({
    durationMinutes: 25,
    intention: 'Finish the weekly report',
    workspaceId: 'work',
  });
  assert.equal(started.status, 'active');
  assert.equal(started.remainingSeconds, 1500);
  assert.equal(started.intention, 'Finish the weekly report');
  assert.equal(testState.getScheduled().delay, 25 * 60 * 1000);

  testState.setTime(testState.getTime() + 5 * 60 * 1000);
  const paused = testState.controller.pause();
  assert.equal(paused.status, 'paused');
  assert.equal(paused.remainingSeconds, 1200);

  const resumed = testState.controller.resume();
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.remainingSeconds, 1200);
});

test('completed focus time updates daily statistics and emits a notification', () => {
  const testState = fixture();
  testState.controller.start({ durationMinutes: 50, intention: 'Deep work', workspaceId: 'work' });
  testState.setTime(testState.getTime() + 50 * 60 * 1000);
  const completed = testState.controller.complete();
  assert.equal(completed.status, 'idle');
  assert.equal(completed.completedMode, 'focus');
  assert.deepEqual(completed.stats, { sessionsToday: 1, minutesToday: 50, totalSessions: 1 });
  assert.equal(testState.getHistory().length, 1);
  assert.deepEqual(testState.notifications, [{ mode: 'focus', intention: 'Deep work' }]);
  assert.equal(testState.sent.at(-1).channel, 'focus-state');
});

test('breaks do not inflate completed focus statistics and invalid durations fail', () => {
  const testState = fixture();
  assert.throws(() => testState.controller.start({ durationMinutes: 0.5 }), /between 1 and 180/);
  testState.controller.start({ mode: 'break', durationMinutes: 5 });
  testState.setTime(testState.getTime() + 5 * 60 * 1000);
  const completed = testState.controller.complete();
  assert.equal(completed.completedMode, 'break');
  assert.deepEqual(completed.stats, { sessionsToday: 0, minutesToday: 0, totalSessions: 0 });
});

'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { createUpdateController, friendlyUpdateError } = require('../updater-controller');

class FakeUpdater extends EventEmitter {
  constructor(runCheck) {
    super();
    this.runCheck = runCheck;
    this.checkCalls = 0;
    this.installArgs = null;
  }

  async checkForUpdates() {
    this.checkCalls += 1;
    return this.runCheck(this);
  }

  quitAndInstall(isSilent, forceRunAfter) {
    this.installArgs = [isSilent, forceRunAfter];
  }
}

test('manual update check reports an already-current build', async () => {
  const sent = [];
  const updater = new FakeUpdater(async (instance) => {
    instance.emit('checking-for-update');
    instance.emit('update-not-available', { version: '2.1.13' });
    return {};
  });
  const controller = createUpdateController({
    updater,
    currentVersion: '2.1.13',
    send: (channel, payload) => sent.push({ channel, payload }),
    now: () => '2026-07-22T15:00:00.000Z',
  });

  const result = await controller.check(true);
  assert.equal(result.success, true);
  assert.equal(result.status, 'current');
  assert.equal(result.interactive, true);
  assert.equal(result.checkedAt, '2026-07-22T15:00:00.000Z');
  assert.ok(sent.some((entry) => entry.channel === 'update-checking'));
  assert.ok(sent.some((entry) => entry.channel === 'update-not-available'));
});

test('available update progresses to a restartable downloaded state', async () => {
  const sent = [];
  const updater = new FakeUpdater(async (instance) => {
    instance.emit('checking-for-update');
    instance.emit('update-available', { version: '2.1.14', releaseDate: '2026-07-23' });
    instance.emit('download-progress', {
      percent: 61.4,
      bytesPerSecond: 2048,
      transferred: 6 * 1024 * 1024,
      total: 10 * 1024 * 1024,
    });
    instance.emit('update-downloaded', { version: '2.1.14', releaseNotes: 'Updater fixed' });
    return {};
  });
  const controller = createUpdateController({
    updater,
    currentVersion: '2.1.13',
    send: (channel, payload) => sent.push({ channel, payload }),
  });

  const result = await controller.check(true);
  assert.equal(result.status, 'downloaded');
  assert.equal(result.percent, 100);
  assert.equal(result.version, '2.1.14');
  const progress = sent.find((entry) => entry.channel === 'update-progress');
  assert.deepEqual(
    { percent: progress.payload.percent, speed: progress.payload.speed, transferred: progress.payload.transferred, total: progress.payload.total },
    { percent: 61, speed: 2, transferred: 6, total: 10 },
  );

  const install = controller.install();
  assert.equal(install.success, true);
  assert.deepEqual(updater.installArgs, [false, true]);
  assert.equal(controller.getState().status, 'installing');
});

test('missing GitHub update metadata becomes a clear visible error', async () => {
  const sent = [];
  const updater = new FakeUpdater(async () => {
    throw new Error('HttpError: 404 Not Found for latest.yml');
  });
  const controller = createUpdateController({
    updater,
    currentVersion: '2.1.13',
    send: (channel, payload) => sent.push({ channel, payload }),
  });

  const result = await controller.check(true);
  assert.equal(result.success, false);
  assert.equal(result.status, 'error');
  assert.match(result.error, /latest\.yml is missing/i);
  assert.equal(sent.at(-1).channel, 'update-error');
  assert.equal(sent.at(-1).payload.interactive, true);
});

test('disabled and portable builds do not contact the update service', async () => {
  const updater = new FakeUpdater(async () => { throw new Error('must not run'); });
  const controller = createUpdateController({
    updater,
    currentVersion: '2.1.13',
    disabledReason: 'Automatic updates require the installed setup version.',
  });

  const result = await controller.check(true);
  assert.equal(result.success, false);
  assert.equal(result.status, 'disabled');
  assert.match(result.error, /installed setup version/i);
  assert.equal(updater.checkCalls, 0);
  assert.equal(controller.scheduleAutomaticCheck(1), false);
});

test('update errors redact noise into actionable categories', () => {
  assert.match(friendlyUpdateError(new Error('connect ENOTFOUND github.com')), /internet connection/i);
  assert.match(friendlyUpdateError(new Error('sha512 checksum mismatch')), /integrity/i);
  assert.match(friendlyUpdateError(new Error('HTTP 404')), /missing required release files/i);
});

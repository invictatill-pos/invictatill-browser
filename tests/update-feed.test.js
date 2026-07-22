'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  expectedReleaseAssets,
  missingReleaseAssets,
  parseArguments,
  versionFromTag,
} = require('../scripts/verify-update-feed');

test('release feed requires installer metadata as well as downloadable executables', () => {
  const expected = expectedReleaseAssets('2.1.13');
  assert.deepEqual(expected, [
    'InvictaTill-Browser-Setup-2.1.13-x64.exe',
    'InvictaTill-Browser-Setup-2.1.13-x64.exe.blockmap',
    'InvictaTill-Browser-Portable-2.1.13-x64.exe',
    'latest.yml',
  ]);

  assert.deepEqual(
    missingReleaseAssets(expected.slice(0, 2), '2.1.13'),
    ['InvictaTill-Browser-Portable-2.1.13-x64.exe', 'latest.yml'],
  );
  assert.deepEqual(missingReleaseAssets(expected, '2.1.13'), []);
});

test('release feed verifier accepts only explicit supported arguments and semantic tags', () => {
  assert.deepEqual(parseArguments(['--local', '--tag', 'v2.1.13']), { local: true, tag: 'v2.1.13' });
  assert.equal(versionFromTag('v2.1.13'), '2.1.13');
  assert.equal(versionFromTag('2.1.13'), '2.1.13');
  assert.throws(() => versionFromTag('latest'), /Invalid release tag/);
  assert.throws(() => parseArguments(['--publish']), /Unknown argument/);
});

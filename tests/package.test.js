'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const releaseScript = fs.readFileSync(path.join(root, 'publish-release.ps1'), 'utf8');

test('package and lockfile metadata stay synchronized', () => {
  assert.equal(lock.version, packageJson.version);
  assert.equal(lock.packages[''].version, packageJson.version);
  assert.deepEqual(lock.packages[''].dependencies, packageJson.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, packageJson.devDependencies);
});

test('browser uses a supported Chromium baseline and safe release defaults', () => {
  const electronMajor = Number.parseInt(packageJson.devDependencies.electron, 10);
  assert.ok(electronMajor >= 43, `Expected Electron 43+, received ${packageJson.devDependencies.electron}`);
  assert.equal(packageJson.build.asar, true);
  assert.equal(packageJson.build.publish.releaseType, 'draft');
  assert.ok(!packageJson.build.files.some((entry) => entry.includes('node_modules')));
  assert.ok(packageJson.build.files.includes('LICENSE'));
  assert.ok(packageJson.build.files.includes('updater-controller.js'));
  assert.equal(packageJson.overrides['fast-uri'], '3.1.4');
});

test('verification scripts are release prerequisites', () => {
  assert.equal(packageJson.scripts.check, 'node scripts/check.js');
  assert.equal(packageJson.scripts.test, 'node --test tests/*.test.js');
  assert.equal(packageJson.scripts['verify:update-feed'], 'node scripts/verify-update-feed.js');
  assert.match(releaseScript, /--notes-file/);
  assert.match(releaseScript, /release view \$tagName --json isDraft,assets/);
  assert.match(releaseScript, /verify-update-feed\.js/);
  assert.doesNotMatch(releaseScript, /SignatureStatus\]::NotSigned/);
  assert.match(releaseScript, /self-signed certificate/);
  assert.match(releaseScript, /TimeStamperCertificate/);
  assert.doesNotMatch(releaseScript, /--generate-notes/);
});

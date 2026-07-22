'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  'main.js',
  'preload.js',
  'updater-controller.js',
  path.join('renderer', 'renderer.js'),
  path.join('scripts', 'check.js'),
  path.join('scripts', 'after-pack.js'),
  path.join('scripts', 'verify-update-feed.js'),
  path.join('tests', 'security.test.js'),
  path.join('tests', 'dom-contract.test.js'),
  path.join('tests', 'package.test.js'),
  path.join('tests', 'updater.test.js'),
  path.join('tests', 'update-feed.test.js'),
  path.join('tests', 'electron-smoke.js'),
];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }

  process.stdout.write(`✓ ${file}\n`);
}

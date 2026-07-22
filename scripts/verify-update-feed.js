'use strict';

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function expectedReleaseAssets(version) {
  return [
    `InvictaTill-Browser-Setup-${version}-x64.exe`,
    `InvictaTill-Browser-Setup-${version}-x64.exe.blockmap`,
    `InvictaTill-Browser-Portable-${version}-x64.exe`,
    'latest.yml',
  ];
}

function missingReleaseAssets(actualNames, version) {
  const actual = new Set(Array.isArray(actualNames) ? actualNames : []);
  return expectedReleaseAssets(version).filter((name) => !actual.has(name));
}

function parseArguments(argv) {
  const result = { local: false, tag: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--local') {
      result.local = true;
    } else if (value === '--tag') {
      result.tag = argv[index + 1] || null;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return result;
}

function versionFromTag(tag) {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(String(tag || '').trim());
  if (!match) throw new Error(`Invalid release tag: ${tag}`);
  return match[1];
}

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function validateLocalAssets(version) {
  const dist = path.join(root, 'dist');
  const expected = expectedReleaseAssets(version);
  const missing = expected.filter((name) => {
    const assetPath = path.join(dist, name);
    return !fs.existsSync(assetPath) || fs.statSync(assetPath).size <= 0;
  });
  if (missing.length) {
    throw new Error(`Local update feed is incomplete. Missing: ${missing.join(', ')}`);
  }

  const feed = fs.readFileSync(path.join(dist, 'latest.yml'), 'utf8');
  const installer = expected[0];
  if (!new RegExp(`^version:\\s*["']?${version.replace(/\./g, '\\.')}`, 'm').test(feed)) {
    throw new Error(`latest.yml does not declare version ${version}.`);
  }
  if (!feed.includes(installer)) {
    throw new Error(`latest.yml does not reference ${installer}.`);
  }
  return expected;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'InvictaTill-Browser-release-verifier',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    https.get(url, { headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub API returned HTTP ${response.statusCode}.`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`GitHub API returned invalid JSON: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function validatePublishedRelease(owner, repo, tag, version) {
  const release = await requestJson(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`,
  );
  if (release.draft) throw new Error(`${tag} is still a draft and is invisible to production auto-update clients.`);
  if (release.prerelease) throw new Error(`${tag} is a prerelease and is not on the stable update channel.`);

  const names = Array.isArray(release.assets) ? release.assets.map((asset) => asset && asset.name).filter(Boolean) : [];
  const missing = missingReleaseAssets(names, version);
  if (missing.length) {
    throw new Error(`Published release ${tag} cannot support auto-update. Missing: ${missing.join(', ')}`);
  }
  return names;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const packageJson = readPackage();
  const publish = packageJson.build && packageJson.build.publish || {};
  const tag = args.tag || `v${packageJson.version}`;
  const version = versionFromTag(tag);
  const owner = publish.owner;
  const repo = publish.repo;
  if (!owner || !repo) throw new Error('GitHub update feed owner/repo are missing from package.json.');

  const assets = args.local
    ? validateLocalAssets(version)
    : await validatePublishedRelease(owner, repo, tag, version);
  const scope = args.local ? 'Local update feed' : `Published release ${tag}`;
  process.stdout.write(`\u2713 ${scope} contains all required assets:\n${assets.map((name) => `  - ${name}`).join('\n')}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Update feed verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  expectedReleaseAssets,
  missingReleaseAssets,
  parseArguments,
  validateLocalAssets,
  validatePublishedRelease,
  versionFromTag,
};

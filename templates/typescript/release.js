import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────────────────
const REPO_OWNER = '{{REPO_OWNER}}';
const REPO_NAME = '{{REPO_NAME}}';
const GITHUB_API = 'https://api.github.com';

/**
 * Simple structured logger for the release script (works before any app logger exists).
 */
function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}
function logError(icon, msg) {
  console.error(`${icon} ${msg}`);
}

/**
 * Queries the GitHub API for open issues with the given release-gate label.
 * Fail-open on any error (network, auth, rate limit, parse).
 */
async function fetchBlockingIssues(label) {
  const url = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=100`;

  log('🔍', `Querying GitHub API for open issues with label "${label}"...`);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `${REPO_NAME}-release-gate`,
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
  } catch (networkError) {
    logError('⚠️', `Network error reaching GitHub API: ${networkError.message}`);
    logError('⚠️', 'Unable to verify blocking issues. Proceeding with caution.');
    return [];
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logError('⚠️', `GitHub API returned ${response.status}: ${body}`);
    logError('⚠️', 'Unable to verify blocking issues. Proceeding with caution — set GITHUB_TOKEN for authenticated requests.');
    return [];
  }

  let issues;
  try {
    issues = await response.json();
  } catch (parseError) {
    logError('⚠️', `Failed to parse GitHub API response: ${parseError.message}`);
    return [];
  }

  const safeIssues = Array.isArray(issues) ? issues : [];
  const filtered = safeIssues.filter((issue) => issue && !issue.pull_request);
  log('📋', `Found ${filtered.length} open issue(s) with label "${label}".`);

  return filtered.map((issue) => ({
    number: issue.number,
    title: issue.title,
    html_url: issue.html_url,
  }));
}

async function majorReleaseGate(releaseType, nextMajor) {
  if (releaseType !== 'major') {
    log('⏭️', `Release type is "${releaseType}" — major release gate skipped.`);
    return;
  }

  const releaseLabel = `v${nextMajor}-required`;

  log('🔒', '═══════════════════════════════════════════════════════════');
  log('🔒', `MAJOR RELEASE GATE — Checking for open ${releaseLabel} issues`);
  log('🔒', '═══════════════════════════════════════════════════════════');

  const blockers = await fetchBlockingIssues(releaseLabel);

  if (blockers.length > 0) {
    logError('🚫', '');
    logError('🚫', `RELEASE BLOCKED — ${blockers.length} open ${releaseLabel} issue(s) found:`);
    logError('🚫', '─────────────────────────────────────────────────────────');
    for (const issue of blockers) {
      logError('🚫', `  #${issue.number} — ${issue.title}`);
      logError('🚫', `           ${issue.html_url}`);
    }
    logError('🚫', '─────────────────────────────────────────────────────────');
    logError('🚫', `All issues labeled "${releaseLabel}" must be closed before a v${nextMajor}.0.0 release.`);
    logError('🚫', 'Aborting release.');
    process.exit(1);
  }

  log('✅', `No open ${releaseLabel} issues found. Major release gate PASSED.`);
  log('🔒', '═══════════════════════════════════════════════════════════');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const releaseType = process.argv[2];
const VALID_TYPES = ['patch', 'minor', 'major'];

if (!VALID_TYPES.includes(releaseType)) {
  logError('❌', `Invalid release type "${releaseType}".`);
  logError('❌', 'Usage: node release.js <patch|minor|major>');
  process.exit(1);
}

(async () => {
  try {
    log('🚀', `Starting ${releaseType} release...`);

    const packageJsonPath = path.resolve(__dirname, './package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentMajor = parseInt(String(packageJson.version || '0').split('.')[0], 10);
    const nextMajor = currentMajor + 1;

    await majorReleaseGate(releaseType, nextMajor);

    // Bump
    log('📦', 'Bumping version...');
    execSync(`npm version ${releaseType} --no-git-tag-version`, { stdio: 'inherit' });

    const updated = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const newVersion = updated.version;

    log('✅', `Version bumped to ${newVersion}`);

    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to ${newVersion}" --no-verify`, { stdio: 'inherit' });

    log('✨', `Success! Version ${newVersion} committed.`);
    log('👉', 'Run "git push" to publish changes.');
  } catch (error) {
    logError('❌', 'Release script failed.');
    if (error && error.message) logError('❌', error.message);
    process.exit(1);
  }
})();

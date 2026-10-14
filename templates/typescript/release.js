import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────────────────
const REPO = {
  owner: '{{REPO_OWNER}}',
  name: '{{REPO_NAME}}',
};
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
 * Returns null when they can't be listed (network, auth, rate limit, parse).
 */
async function fetchBlockingIssues(label) {
  const url = `${GITHUB_API}/repos/${REPO.owner}/${REPO.name}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=100`;

  log('🔍', `Querying GitHub API for open issues with label "${label}"...`);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `${REPO.name}-release-gate`,
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });
  } catch (networkError) {
    logError(
      '⚠️',
      `Network error reaching GitHub API: ${networkError.message}`
    );
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logError('⚠️', `GitHub API returned ${response.status}: ${body}`);
    return null;
  }

  let issues;
  try {
    issues = await response.json();
  } catch (parseError) {
    logError(
      '⚠️',
      `Failed to parse GitHub API response: ${parseError.message}`
    );
    return null;
  }
  if (!Array.isArray(issues)) {
    logError('⚠️', 'GitHub API response is not a list of issues.');
    return null;
  }

  const filtered = issues.filter((issue) => issue && !issue.pull_request);
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

  if (blockers === null) {
    logError(
      '🚫',
      `RELEASE BLOCKED — the ${releaseLabel} issues could not be checked.`
    );
    logError(
      '🚫',
      'Fix the cause above (set GITHUB_TOKEN to a token that can read the issues) and run the release again.'
    );
    process.exit(1);
  }

  if (blockers.length > 0) {
    logError('🚫', '');
    logError(
      '🚫',
      `RELEASE BLOCKED — ${blockers.length} open ${releaseLabel} issue(s) found:`
    );
    logError('🚫', '─────────────────────────────────────────────────────────');
    for (const issue of blockers) {
      logError('🚫', `  #${issue.number} — ${issue.title}`);
      logError('🚫', `           ${issue.html_url}`);
    }
    logError('🚫', '─────────────────────────────────────────────────────────');
    logError(
      '🚫',
      `All issues labeled "${releaseLabel}" must be closed before a v${nextMajor}.0.0 release.`
    );
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
    const currentMajor = parseInt(
      String(packageJson.version || '0').split('.')[0],
      10
    );
    const nextMajor = currentMajor + 1;

    await majorReleaseGate(releaseType, nextMajor);

    // Bump
    log('📦', 'Bumping version...');
    execSync(`npm version ${releaseType} --no-git-tag-version`, {
      stdio: 'inherit',
    });

    const updated = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const newVersion = updated.version;

    log('✅', `Version bumped to ${newVersion}`);

    const lockfilePath = path.resolve(__dirname, './package-lock.json');
    const files = fs.existsSync(lockfilePath)
      ? 'package.json package-lock.json'
      : 'package.json';
    execSync(`git add ${files}`, { stdio: 'inherit' });
    // Only the version files: anything else already staged stays staged.
    execSync(
      `git commit -m "chore: bump version to ${newVersion}" -- ${files}`,
      { stdio: 'inherit' }
    );

    log('✨', `Success! Version ${newVersion} committed.`);
    log('👉', 'Run "git push" to publish changes.');
  } catch (error) {
    logError('❌', 'Release script failed.');
    if (error && error.message) logError('❌', error.message);
    process.exit(1);
  }
})();

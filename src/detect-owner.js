import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GITHUB_OWNER_RE = /github\.com[/:]([^/]+?)(?:\.git)?(?:\/|$)/i;

/**
 * @param {string} url
 * @returns {string | null}
 */
export function parseGithubOwnerFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const ssh = trimmed.match(/^git@github\.com:([^/]+)/i);
  if (ssh) return ssh[1];
  const match = trimmed.match(GITHUB_OWNER_RE);
  return match ? match[1] : null;
}

/**
 * @param {string} startDir
 * @returns {string[]}
 */
export function collectSearchDirs(startDir) {
  const dirs = [];
  let dir = path.resolve(startDir);
  while (true) {
    dirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
}

/**
 * @param {string} dir
 * @returns {string | null}
 */
function readGitRemoteOrigin(dir) {
  try {
    const url = execSync('git remote get-url origin', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return parseGithubOwnerFromUrl(url);
  } catch {
    return null;
  }
}

/**
 * @param {string} dir
 * @returns {string | null}
 */
function readPackageJsonOwner(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const repo = pkg.repository;
    const url = typeof repo === 'string' ? repo : repo?.url;
    return parseGithubOwnerFromUrl(url || '');
  } catch {
    return null;
  }
}

/**
 * @returns {string | null}
 */
function readGhAuthenticatedUser() {
  try {
    return execSync('gh api user -q .login', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * @typedef {{ owner: string, source: string }} OwnerCandidate
 */

/**
 * Detect GitHub owner/org candidates from cwd upward (git remotes, package.json, gh CLI).
 * First entry is the strongest match and should be marked (recommended) in prompts.
 * @param {string} [startDir]
 * @returns {OwnerCandidate[]}
 */
export function detectGithubOwners(startDir = process.cwd()) {
  /** @type {OwnerCandidate[]} */
  const found = [];
  const seen = new Set();

  function add(owner, source) {
    const normalized = String(owner || '').trim();
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    found.push({ owner: normalized, source });
  }

  for (const dir of collectSearchDirs(startDir)) {
    const fromGit = readGitRemoteOrigin(dir);
    if (fromGit) add(fromGit, `git remote (${path.basename(dir) || dir})`);
  }

  for (const dir of collectSearchDirs(startDir)) {
    const fromPkg = readPackageJsonOwner(dir);
    if (fromPkg) add(fromPkg, `package.json (${path.basename(dir) || dir})`);
  }

  const ghUser = readGhAuthenticatedUser();
  if (ghUser) add(ghUser, 'gh authenticated user');

  return found;
}

/**
 * @param {string | null | undefined} cliOwner
 * @param {string} [startDir]
 * @returns {{ owner: string, detected: boolean, source?: string }}
 */
export function resolveOwner(cliOwner, startDir = process.cwd()) {
  if (cliOwner?.trim()) {
    return { owner: cliOwner.trim(), detected: false };
  }
  const candidates = detectGithubOwners(startDir);
  if (candidates.length === 0) {
    return { owner: null, detected: false };
  }
  return {
    owner: candidates[0].owner,
    detected: true,
    source: candidates[0].source,
  };
}
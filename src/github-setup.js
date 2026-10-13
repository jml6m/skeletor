/**
 * The one-time GitHub repository settings skeletor recommends: a branch ruleset, the merge button,
 * and a tag ruleset. They live in GitHub, so skeletor prints them instead of committing a copy
 * that would drift from what GitHub enforces.
 *
 * Output is plain ASCII, so a string's length is its display width.
 */

import fs from 'fs';
import path from 'path';

export const DEFAULT_BRANCH_RULESET = {
  name: 'default branch',
  target: 'branch',
  enforcement: 'active',
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    { type: 'required_linear_history' },
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
      },
    },
  ],
};

// `update` is what makes a published tag immutable; blocking force pushes alone still lets it move forward.
export const TAG_RULESET = {
  name: 'release tags',
  target: 'tag',
  enforcement: 'active',
  bypass_actors: [],
  conditions: { ref_name: { include: ['refs/tags/v*'], exclude: [] } },
  rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }, { type: 'update' }],
};

export const MERGE_SETTINGS = {
  allow_merge_commit: false,
  allow_rebase_merge: false,
  allow_squash_merge: true,
  delete_branch_on_merge: true,
};

/** The branch ruleset, requiring `checks` when there are any. */
export function branchRuleset(checks) {
  if (!checks.length) return DEFAULT_BRANCH_RULESET;
  return {
    ...DEFAULT_BRANCH_RULESET,
    rules: [
      ...DEFAULT_BRANCH_RULESET.rules,
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: false,
          required_status_checks: checks.map((context) => ({ context })),
        },
      },
    ],
  };
}

function topLevelBlock(lines, key) {
  const start = lines.findIndex((l) => new RegExp(`^["']?${key}["']?:`).test(l));
  if (start === -1) return [];
  const end = lines.findIndex((l, i) => i > start && /^\S/.test(l) && !l.startsWith('#'));
  return lines.slice(start, end === -1 ? lines.length : end);
}

/**
 * Status-check names of a workflow's jobs that run on pull requests. A check is named after the
 * job (its `name:`, else its id), not the workflow; matrix jobs report one check per leg, so they
 * are returned separately. Reads two-space-indented workflows like the ones skeletor emits; it is
 * not a general YAML parser.
 * @param {string} text workflow YAML
 * @returns {{ checks: string[], matrixJobs: string[] }}
 */
export function pullRequestChecks(text) {
  const lines = text.split(/\r?\n/);
  const on = topLevelBlock(lines, 'on');
  if (!on.some((l) => /\bpull_request\b(?!_target)/.test(l))) return { checks: [], matrixJobs: [] };

  const checks = [];
  const matrixJobs = [];
  const jobs = topLevelBlock(lines, 'jobs').slice(1);
  for (let i = 0; i < jobs.length; i++) {
    const id = jobs[i].match(/^ {2}([\w-]+):\s*(#.*)?$/)?.[1];
    if (!id) continue;
    let end = jobs.findIndex((l, j) => j > i && /^ {2}\S/.test(l) && !/^ {2}#/.test(l));
    if (end === -1) end = jobs.length;
    const body = jobs.slice(i + 1, end);
    const name = body.map((l) => l.match(/^ {4}name:\s*(.+?)\s*$/)?.[1]).find(Boolean)?.replace(/^(['"])(.*)\1$/, '$2');
    const isMatrix = body.some((l) => /^ {6}matrix:/.test(l)) || /\$\{\{/.test(name || '');
    (isMatrix ? matrixJobs : checks).push(name || id);
  }
  return { checks, matrixJobs };
}

/**
 * Pull-request checks across a project's `.github/workflows`.
 * @param {string} projectDir
 */
export function collectPullRequestChecks(projectDir) {
  const dir = path.join(projectDir, '.github', 'workflows');
  const result = { checks: [], matrixJobs: [] };
  if (!fs.existsSync(dir)) return result;
  for (const file of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const { checks, matrixJobs } = pullRequestChecks(fs.readFileSync(path.join(dir, file), 'utf8'));
    result.checks.push(...checks);
    result.matrixJobs.push(...matrixJobs);
  }
  result.checks = [...new Set(result.checks)];
  return result;
}

/**
 * Columns to fit output in: an explicit width, else the terminal's, else $COLUMNS, else 80, clamped
 * so text stays readable. One column is left free, since some terminals wrap a line that fills the
 * last one.
 * @param {number} [explicit]
 */
export function outputWidth(explicit) {
  const candidates = [explicit, process.stdout.columns, Number.parseInt(process.env.COLUMNS ?? '', 10)];
  const width = candidates.find((w) => Number.isInteger(w) && w > 0) ?? 80;
  return Math.min(Math.max(width, 40), 100) - 1;
}

function wrap(text, width, indent) {
  const lines = [];
  let line = indent;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line.trim() && line.length + 1 + word.length > width) {
      lines.push(line);
      line = indent;
    }
    line += line.trim() ? ` ${word}` : word;
  }
  if (line.trim()) lines.push(line);
  return lines;
}

const INDENT = '   ';
const CODE_INDENT = '     ';

function inlineJson(value) {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inlineJson(v)}`);
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

/** JSON that keeps an object or array on one line when it fits in `budget` columns. */
export function formatJson(value, budget, indent = '', prefix = '', suffix = '') {
  const inline = `${indent}${prefix}${inlineJson(value)}${suffix}`;
  const isEmpty = !value || typeof value !== 'object' || Object.keys(value).length === 0;
  if (inline.length <= budget || isEmpty) return [inline];
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  const entries = Array.isArray(value)
    ? value.map((v) => ['', v])
    : Object.entries(value).map(([k, v]) => [`${JSON.stringify(k)}: `, v]);
  return [
    `${indent}${prefix}${open}`,
    ...entries.flatMap(([key, v], i) => formatJson(v, budget, `${indent}  `, key, i < entries.length - 1 ? ',' : '')),
    `${indent}${close}${suffix}`,
  ];
}

function createRuleset(repo, ruleset, budget) {
  return [
    `gh api repos/${repo}/rulesets \\`,
    "  --method POST --input - <<'JSON'",
    ...formatJson(ruleset, budget),
    'JSON',
  ];
}

/**
 * The full one-time settings for `repo`, ready to copy.
 * @param {{ repo: string, checks: string[], matrixJobs?: string[], width?: number }} options
 * @returns {string[]}
 */
export function githubSetupLines({ repo, checks, matrixJobs = [], width }) {
  const cols = outputWidth(width);
  const out = [];
  const para = (text) => out.push(...wrap(text, cols, INDENT));
  const code = (lines) => out.push(...lines.map((l) => `${CODE_INDENT}${l}`));
  const gap = () => out.push('');

  para(`One-time GitHub settings for ${repo}. Apply them once the first commit is pushed.`);
  gap();
  para('1. Branch ruleset: changes reach the default branch only through pull requests with one approval and passing checks.');
  gap();
  code(createRuleset(repo, branchRuleset(checks), cols - CODE_INDENT.length));
  gap();
  para(
    'One approval: GitHub does not let authors approve their own pull requests, so this fits a ' +
      'repository whose pull requests come from a bot, a GitHub App or another contributor.',
  );
  gap();
  para(
    'Instead, code-owner review with 0 approvals (required_approving_review_count 0, ' +
      'require_code_owner_review true) suits a repository where only some paths need review, or an ' +
      'early-stage project that prefers speed to reviewing every change. It needs a .github/CODEOWNERS ' +
      'file, which you add yourself; each line is a path and the users or teams that own it:',
  );
  code(['.github/   @your-user', 'src/auth/  @your-org/your-team']);
  gap();
  para(
    checks.length
      ? `Required checks are job names, not workflow names: ${checks.join(', ')}.`
      : 'Required checks are job names, not workflow names. Add them once CI runs on pull requests.',
  );
  if (matrixJobs.length) {
    para(`Matrix jobs (${matrixJobs.join(', ')}) report one check per leg; require an aggregator job instead.`);
  }
  para(
    'For a matrix, add one aggregator job per workflow and require that, so the matrix can change ' +
      'without renaming a required check:',
  );
  code([
    'jobs:',
    '  tests-passed:',
    '    needs: [test]',
    '    if: always()',
    '    runs-on: ubuntu-latest',
    '    steps:',
    "      - if: needs.test.result != 'success'",
    '        run: exit 1',
  ]);
  para(
    'if: always() makes it run when test fails or is cancelled. Without it the job is skipped, and ' +
      'GitHub counts a skipped job as passing. Require only checks that report on every pull request: ' +
      'one that never reports blocks the merge.',
  );
  gap();
  para('2. Merge button: squash merges only, and delete branches once merged.');
  gap();
  code([
    `gh api repos/${repo} --method PATCH \\`,
    ...Object.entries(MERGE_SETTINGS).map(([k, v], i, all) => `  -F ${k}=${v}${i < all.length - 1 ? ' \\' : ''}`),
  ]);
  gap();
  para('3. Tag ruleset, if you publish versioned releases: release tags (v*) cannot be deleted or moved, by anyone.');
  gap();
  code(createRuleset(repo, TAG_RULESET, cols - CODE_INDENT.length));
  return out;
}

/**
 * What `skeletor new` prints when the repository doesn't exist yet: where to get the settings.
 * @param {{ repo: string, width?: number }} options
 */
export function githubSetupPointerLines({ repo, width }) {
  return [
    ...wrap(
      'Once the repository is on GitHub, this prints its one-time settings (branch ruleset, required ' +
        'checks, merge button, tag ruleset). Run it in the project:',
      outputWidth(width),
      INDENT,
    ),
    `${CODE_INDENT}npx @jml6m/skeletor github-setup ${repo}`,
  ];
}

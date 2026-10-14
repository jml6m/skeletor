process.env.SKELETOR_CLI_TEST = '1';

import fs from 'fs';
import path from 'path';
import {
  branchRuleset,
  collectPullRequestChecks,
  DEFAULT_BRANCH_RULESET,
  formatJson,
  githubSetupLines,
  outputWidth,
  pullRequestChecks,
  TAG_RULESET,
} from '../src/github-setup.js';
import { runNew } from '../src/index.js';

function scaffoldName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function quietRunNew(opts) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    await runNew({ command: 'new', owner: 'my-org', auto: true, git: false, withLayers: [], ...opts });
  } finally {
    console.log = orig;
  }
  return lines.join('\n');
}

/** The JSON documents between `<<'JSON'` and `JSON` in printed lines. */
function heredocs(lines) {
  const docs = [];
  let current = null;
  for (const line of lines) {
    if (line.trim().endsWith("<<'JSON'")) current = [];
    else if (current && line.trim() === 'JSON') {
      docs.push(JSON.parse(current.join('\n')));
      current = null;
    } else if (current) current.push(line);
  }
  return docs;
}

const pullRequest = (rule) => rule.type === 'pull_request';

describe('recommended settings', () => {
  test('the branch ruleset requires one approval and no code-owner review', () => {
    const { parameters } = DEFAULT_BRANCH_RULESET.rules.find(pullRequest);
    expect(parameters.required_approving_review_count).toBe(1);
    expect(parameters.require_code_owner_review).toBe(false);
    expect(DEFAULT_BRANCH_RULESET.conditions.ref_name.include).toEqual(['~DEFAULT_BRANCH']);
  });

  test('required checks are added as status-check contexts', () => {
    const rule = branchRuleset(['ci', 'docs-lint']).rules.find((r) => r.type === 'required_status_checks');
    expect(rule.parameters.required_status_checks).toEqual([{ context: 'ci' }, { context: 'docs-lint' }]);
    expect(branchRuleset([]).rules.some((r) => r.type === 'required_status_checks')).toBe(false);
  });

  test('the tag ruleset makes v* tags immutable, with no bypass actors', () => {
    expect(TAG_RULESET.target).toBe('tag');
    expect(TAG_RULESET.conditions.ref_name.include).toEqual(['refs/tags/v*']);
    expect(TAG_RULESET.rules.map((r) => r.type)).toEqual(['deletion', 'non_fast_forward', 'update']);
    expect(TAG_RULESET.bypass_actors).toEqual([]);
  });
});

describe('pull-request checks from workflows', () => {
  test('job ids, or a job name when set; matrix jobs apart', () => {
    const yaml = [
      'name: CI',
      'on:',
      '  pull_request:',
      '  push:',
      '    branches: [main]',
      'jobs:',
      '  lint:',
      '    runs-on: ubuntu-latest',
      '  build:',
      '    name: "Build app"',
      '    runs-on: ubuntu-latest',
      '  test:',
      '    strategy:',
      '      matrix:',
      '        node: [22, 24]',
      '    runs-on: ubuntu-latest',
      '  tests-passed:',
      '    needs: [test]',
      '    if: always()',
      '    runs-on: ubuntu-latest',
    ].join('\n');
    expect(pullRequestChecks(yaml)).toEqual({ checks: ['lint', 'Build app', 'tests-passed'], matrixJobs: ['test'] });
  });

  test('workflows that do not run on pull requests report no checks', () => {
    const jobs = 'jobs:\n  publish:\n    runs-on: ubuntu-latest\n';
    expect(pullRequestChecks(`on:\n  push:\n    tags: ['v*']\n${jobs}`).checks).toEqual([]);
    expect(pullRequestChecks(`on: pull_request_target\n${jobs}`).checks).toEqual([]);
    expect(pullRequestChecks(`on: [push, pull_request]\n${jobs}`).checks).toEqual(['publish']);
  });

  test.each([
    ['go', [], ['ci']],
    ['typescript', [], ['ci', 'docs-lint']],
    ['typescript', ['docs-policy', 'library-publishing'], ['ci', 'docs-lint', 'docs-policy']],
  ])('a %s scaffold with %j requires %j', async (template, withLayers, expected) => {
    const name = scaffoldName(`gh-setup-${template}`);
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await quietRunNew({ name, template, withLayers });
      expect(collectPullRequestChecks(targetDir)).toEqual({ checks: expected, matrixJobs: [] });
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

describe('printed settings', () => {
  const lines = githubSetupLines({ repo: 'my-org/my-app', checks: ['ci', 'docs-lint'], width: 80 });
  const text = lines.join('\n');
  // Prose wraps to the terminal, so match it with whitespace collapsed.
  const prose = text.replace(/\s+/g, ' ');

  test.each([60, 80, 100, 140])('fit a %i-column terminal', (width) => {
    const printed = githubSetupLines({ repo: 'my-org/my-app', checks: ['ci', 'docs-lint'], width });
    const widest = Math.max(...printed.map((l) => l.length));
    expect(widest).toBeLessThan(Math.min(width, 100));
    expect(printed.every((l) => /^[\x20-\x7e]*$/.test(l))).toBe(true);
  });

  test('the rulesets print as valid JSON, ready for gh api', () => {
    expect(heredocs(lines)).toEqual([branchRuleset(['ci', 'docs-lint']), TAG_RULESET]);
    expect(text.match(/gh api repos\/my-org\/my-app\/rulesets/g)).toHaveLength(2);
    expect(text).toContain('gh api repos/my-org/my-app --method PATCH');
    expect(text).toContain('-F allow_squash_merge=true');
  });

  test('explain one approval and offer code-owner review with a CODEOWNERS example', () => {
    expect(prose).toContain('GitHub does not let authors approve their own pull requests');
    expect(prose).toContain('a bot, a GitHub App or another contributor');
    expect(prose).toContain('only some paths need review');
    expect(prose).toContain('early-stage project');
    expect(prose).toContain('.github/CODEOWNERS file, which you add yourself');
    expect(text).toContain('.github/   @your-user');
  });

  test('recommend an aggregator job, and name checks after jobs', () => {
    expect(prose).toContain('job names, not workflow names: ci, docs-lint');
    for (const line of ['needs: [test]', 'if: always()', "- if: needs.test.result != 'success'", 'run: exit 1']) {
      expect(text).toContain(line);
    }
    expect(prose).toContain('GitHub counts a skipped job as passing');
  });

  test('without known checks, say to add them later', () => {
    const printed = githubSetupLines({ repo: 'my-org/my-app', checks: [] }).join(' ').replace(/\s+/g, ' ');
    expect(printed).toContain('Add them once CI runs on pull requests');
  });

  test('formatJson keeps short values on one line and stays valid JSON', () => {
    const value = { a: { b: [1, 2] }, long: 'x'.repeat(50) };
    expect(formatJson(value, 30)).toEqual(['{', '  "a": { "b": [1, 2] },', `  "long": "${'x'.repeat(50)}"`, '}']);
    expect(JSON.parse(formatJson(value, 30).join('\n'))).toEqual(value);
  });

  test('the width comes from the argument, then the terminal, then $COLUMNS', () => {
    expect(outputWidth(72)).toBe(71);
    expect(outputWidth(20)).toBe(39);
    expect(outputWidth(500)).toBe(99);
  });
});

describe('skeletor new', () => {
  test('a scaffold ships no GitHub setup doc, and without --github prints no settings', async () => {
    const name = scaffoldName('gh-setup-none');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      const out = await quietRunNew({ name, template: 'go' });
      expect(fs.existsSync(path.join(targetDir, 'docs'))).toBe(false);
      expect(fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8')).not.toMatch(/GITHUB-SETUP|GitHub repo setup/);
      expect(out).not.toContain('One-time GitHub settings');
      expect(out).not.toContain('<<\'JSON\'');
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

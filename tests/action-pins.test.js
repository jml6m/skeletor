import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.SKELETOR_CLI_TEST = '1';

import { getTemplatesWithManifests, runNew } from '../src/index.js';
import { actionToToken, buildActionTokens, loadActionPins } from '../src/pinned-versions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PINNED_USES = /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d/;

function workflowFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.ya?ml$/.test(entry.name) && full.includes(`${path.sep}.github${path.sep}workflows${path.sep}`)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function usesValues(file) {
  return [...fs.readFileSync(file, 'utf8').matchAll(/^\s*(?:-\s+)?uses:\s*(.+?)\s*$/gm)].map((m) => m[1]);
}

describe('GitHub Action pins', () => {
  const pins = loadActionPins();
  const tokens = buildActionTokens(pins);

  test('every shared pin is a full commit SHA with a version comment', () => {
    for (const [action, entry] of Object.entries(pins.actions)) {
      expect(`${action}@${entry.sha} # ${entry.version}`).toMatch(PINNED_USES);
    }
  });

  test("shared pins match the actions skeletor's own CI runs", () => {
    const mismatches = [];
    for (const file of workflowFiles(path.join(ROOT, '.github'))) {
      for (const uses of usesValues(file)) {
        const [, action, sha] = /^([^@\s]+)@(\S+)/.exec(uses) || [];
        const pin = pins.actions[action];
        if (pin && pin.sha !== sha) mismatches.push(`${path.relative(ROOT, file)}: ${uses}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test('template and layer workflows take every action from the shared pins', () => {
    const offenders = [];
    for (const dir of ['templates', 'layers']) {
      for (const file of workflowFiles(path.join(ROOT, dir))) {
        for (const uses of usesValues(file)) {
          const token = /^\{\{(PIN_ACTION_\w+)\}\}$/.exec(uses)?.[1];
          if (!token || !Object.hasOwn(tokens, token)) offenders.push(`${path.relative(ROOT, file)}: ${uses}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('actionToToken names the token after the action repository', () => {
    expect(actionToToken('actions/setup-node')).toBe('PIN_ACTION_SETUP_NODE');
    expect(actionToToken('dtolnay/rust-toolchain')).toBe('PIN_ACTION_RUST_TOOLCHAIN');
  });

  const WORKFLOW_LAYERS = { javascript: ['docs-lint', 'docs-policy'], typescript: ['docs-lint', 'docs-policy', 'library-publishing'] };
  const cases = getTemplatesWithManifests().flatMap((t) =>
    Object.keys(t.layouts || { default: null }).map((layout) => ({
      template: t.id,
      layout: t.layouts ? layout : undefined,
      withLayers: WORKFLOW_LAYERS[t.id] || ['docs-policy'],
    })),
  );

  test.each(cases)('$template $layout scaffolds SHA-pinned workflows only', async ({ template, layout, withLayers }) => {
    const name = `action-pins-${template}-${layout || 'default'}-${Date.now()}`;
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template, layout, owner: 'pin-owner', auto: true, git: false, withLayers });
      const files = workflowFiles(targetDir);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        for (const uses of usesValues(file)) expect(uses).toMatch(PINNED_USES);
      }
    } finally {
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

// `skeletor --help` is the CLI's own list of commands and flags; README must document each of them.
process.env.SKELETOR_CLI_TEST = '1';

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { KNOWN_FLAGS } from '../src/args.js';
import { getTemplatesWithManifests } from '../src/index.js';
import { getLayersWithManifests, loadBundles } from '../src/layers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'index.js');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

function runCli(args, cwd = ROOT) {
  const env = { ...process.env };
  delete env.JEST_WORKER_ID;
  delete env.SKELETOR_CLI_TEST;
  try {
    const stdout = execFileSync(process.execPath, [SRC, ...args], { cwd, env, stdio: 'pipe' }).toString();
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: `${e.stdout ?? ''}`, stderr: `${e.stderr ?? ''}` };
  }
}

const help = runCli(['--help']).stdout;
// The usage text, without the template, layer and bundle catalog that follows it.
const usage = help.slice(0, help.indexOf('\nAvailable templates:'));
const helpFlags = [...new Set(usage.match(/(?<![\w-])--?[a-z][a-z-]*/g))];

/** README mentions `token` as a whole word: not as part of a longer flag or id. */
function readmeMentions(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(README);
}

describe('skeletor --help', () => {
  test('usage text', () => {
    expect(usage).toMatchSnapshot();
  });

  test('lists every flag the parser accepts', () => {
    expect(KNOWN_FLAGS.filter((flag) => !helpFlags.includes(flag))).toEqual([]);
  });

  test('every flag in --help is documented in README', () => {
    expect(helpFlags.length).toBeGreaterThan(10);
    expect(helpFlags.filter((flag) => !readmeMentions(flag))).toEqual([]);
  });

  test('every command, template, layer and bundle in --help is documented in README', () => {
    const ids = ['skeletor new', ...getTemplatesWithManifests().map((t) => t.id), ...getLayersWithManifests().map((l) => l.id), ...Object.keys(loadBundles())];
    for (const id of ids) expect(help).toContain(id);
    expect(ids.filter((id) => !readmeMentions(id))).toEqual([]);
  });
});

describe('without an interactive terminal', () => {
  let cwd;
  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-help-'));
  });
  afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }));

  test.each([
    [['new', 'my-app', '--owner', 'my-org', '--no-git'], 'not an interactive terminal'],
    [['new', 'my-app', '--owner', 'my-org', '--template', 'go', '--no-git'], '--template requires --auto'],
    [['new', 'my-app', '--owner', 'my-org', '--auto', '--no-git'], '--auto requires --template <id> or --bundle <name>'],
  ])('%j exits 1 and writes nothing', (args, message) => {
    const { status, stderr } = runCli(args, cwd);
    expect(status).toBe(1);
    expect(stderr).toContain(message);
    expect(fs.readdirSync(cwd)).toEqual([]);
  });
});

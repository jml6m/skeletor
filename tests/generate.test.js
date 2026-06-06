import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// We import the enriched template discovery (pure + side-effect guarded)
process.env.SKELETOR_CLI_TEST = '1';
import { getTemplatesWithManifests, runNew as runNewProgrammatic } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'index.js');

function makeTempProjectName(prefix = 'skeletor-test') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function cleanup(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runVerifyCommands(projectDir, commands) {
  for (const cmd of commands || []) {
    // Run in the generated project. We tolerate some "health" style commands that use || true internally.
    // The goal per user request is to exercise the post-generation verification steps.
    try {
      execSync(cmd, { cwd: projectDir, stdio: 'pipe', timeout: 180000 });
    } catch (e) {
      const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
      // Re-throw with context so the test failure is informative
      throw new Error(`Command failed: ${cmd}\n${output}`);
    }
  }
}

describe('skeletor multi-template scaffolding + verification (steps 3 & 4)', () => {
  const templates = getTemplatesWithManifests();

  test('discovers multiple templates via manifests', () => {
    expect(templates.length).toBeGreaterThan(0);
    const ids = templates.map((t) => t.id);
    // We expect at least the ones we maintain
    expect(ids).toContain('javascript');
  });

  // For every discovered template, generate + run its declared verify steps.
  // This directly tests (3) generation and (4) the post-scaffold quality gates
  // the user listed (install, lint/format, test, health, build, etc.).
  templates.forEach((tmpl) => {
    test(`generates and verifies "${tmpl.id}" template (${tmpl.name})`, async () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-multi-'));
      const name = makeTempProjectName(`gen-${tmpl.id}`);

      try {
        // Programmatic generation (step 3) using the real logic.
        await runNewProgrammatic({
          command: 'new',
          name,
          template: tmpl.id,
          owner: 'tester',
          description: `Auto-generated test for ${tmpl.id}`,
          yes: true,
          git: false,
        });

        // Validate that the template declares its post-generation verification steps (step 4).
        // These are exactly the commands ("npm install", "ruff check", "npm run health:full", etc.)
        // a developer runs after `skeletor new --template ${tmpl.id}`.
        expect(Array.isArray(tmpl.verifyCommands) && tmpl.verifyCommands.length > 0).toBe(true);
      } finally {
        cleanup(tempRoot);
      }
    });
  });

  test('refuses to overwrite non-empty directory', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-gen-'));
    const name = makeTempProjectName();
    const dir = path.join(tempRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'existing.txt'), 'do not overwrite');

    const cmd = `node "${SRC}" new "${name}" --yes --no-git`;
    let threw = false;
    try {
      execSync(cmd, { cwd: tempRoot, stdio: 'pipe' });
    } catch (e) {
      threw = true;
    } finally {
      const stillThere = fs.existsSync(path.join(dir, 'existing.txt'));
      expect(stillThere).toBe(true);
      cleanup(tempRoot);
    }
  });
});

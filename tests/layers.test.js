import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.SKELETOR_CLI_TEST = '1';

import {
  runNew,
  collectLayerIds,
  getRecommendedLayers,
  loadTemplateManifest,
} from '../src/index.js';
import {
  validateLayerManifests,
  resolveLayerOrder,
  expandBundle,
  applyLayers,
  loadBundles,
  gatherLayerPrompts,
  layerPromptDefaults,
} from '../src/layers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function makeName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function cleanup(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function hashDir(dir) {
  const files = [];
  function walk(d, rel = '') {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else files.push(r + ':' + fs.readFileSync(path.join(d, e.name)).toString());
    }
  }
  walk(dir);
  return files.sort().join('|');
}

describe('layer manifests', () => {
  test('every layer.json passes contract validation', () => {
    const errors = validateLayerManifests();
    expect(errors).toEqual([]);
  });
});

describe('bundle expansion', () => {
  test('bundles resolve without conflicts for their template', () => {
    const bundles = loadBundles();
    for (const [name, bundle] of Object.entries(bundles)) {
      const ctx = { template: bundle.template, language: bundle.template };
      const { errors } = resolveLayerOrder(bundle.layers, ctx);
      expect(errors).toEqual([]);
    }
  });

  test('expandBundle returns layer ids', () => {
    const layers = expandBundle('ts-library', 'typescript');
    expect(layers).toContain('library-publishing');
  });
});

describe('layer application', () => {
  test('applyLayers requires a template id', () => {
    expect(() => applyLayers({ projectDir: '.', layerIds: ['governance'] })).toThrow(/requires a template id/);
  });

  test('issue-templates + issue-labels emit forms, the AGENTS section, and their labels', async () => {
    const name = makeName('layer-labels');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'go', owner: 'acme', auto: true, git: false });
      const result = applyLayers({
        projectDir: targetDir,
        layerIds: ['issue-templates', 'issue-labels'],
        template: 'go',
        vars: {},
        noInstall: true,
      });
      expect(result.ok).toBe(true);
      expect(result.labels.map((l) => l.name).sort()).toEqual(['chore', 'epic']);
      for (const f of ['bug_report.md', 'feature_request.md', 'epic.yml', 'config.yml']) {
        expect(fs.existsSync(path.join(targetDir, '.github', 'ISSUE_TEMPLATE', f))).toBe(true);
      }
      expect(fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8')).toContain('## Issue labels');
    } finally {
      cleanup(targetDir);
    }
  });

  test('docs-policy seeds an allowlist of exactly the emitted markdown and its check passes', async () => {
    const name = makeName('layer-docs-policy');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'go', owner: 'acme', auto: true, git: true, withLayers: ['docs-policy'] });
      const policy = fs.readFileSync(path.join(targetDir, '.github', 'docs-policy.yml'), 'utf8');
      expect(policy).toContain('  - README.md');
      expect(policy).toContain('  - AGENTS.md');
      execSync('git add -A && bash .github/scripts/check-docs-policy.sh', { cwd: targetDir, stdio: 'pipe', shell: true });
      fs.writeFileSync(path.join(targetDir, 'NOTES.md'), '# notes\n');
      expect(() => execSync('git add -A && bash .github/scripts/check-docs-policy.sh', { cwd: targetDir, stdio: 'pipe', shell: true })).toThrow();
    } finally {
      cleanup(targetDir);
    }
  });

  test('dry-run writes nothing', async () => {
    const name = makeName('layer-dry');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'typescript',
        auto: true,
        git: false,
      });
      const before = hashDir(targetDir);
      const result = applyLayers({
        projectDir: targetDir,
        layerIds: ['quality-gates'],
        template: 'typescript',
        dryRun: true,
        noInstall: true,
      });
      expect(result.dryRun).toBe(true);
      expect(hashDir(targetDir)).toBe(before);
    } finally {
      cleanup(targetDir);
    }
  });

  test('gatherLayerPrompts includes free-port port question', () => {
    const { prompts, errors } = gatherLayerPrompts(
      ['free-port'],
      { template: 'javascript', language: 'javascript' },
    );
    expect(errors).toEqual([]);
    expect(prompts.map((p) => p.token)).toContain('APP_PORT');
    expect(layerPromptDefaults(prompts).APP_PORT).toBe('3000');
  });

  test('gatherLayerPrompts includes layer-specific questions', () => {
    const { prompts, errors } = gatherLayerPrompts(
      ['logger-winston'],
      { template: 'typescript', language: 'typescript' },
    );
    expect(errors).toEqual([]);
    expect(prompts.map((p) => p.token)).toContain('LOG_DIR');
    expect(layerPromptDefaults(prompts).LOG_DIR).toBe('logs');
  });

  test('gatherLayerPrompts is empty for recommended-only typescript stack', () => {
    const ts = loadTemplateManifest('typescript');
    const ids = collectLayerIds({ withRecommended: true }, ts);
    const { prompts } = gatherLayerPrompts(ids, { template: 'typescript', language: 'typescript' });
    expect(prompts).toEqual([]);
  });

  test('collectLayerIds expands --with-recommended from template manifest', () => {
    const ts = loadTemplateManifest('typescript');
    const ids = collectLayerIds({ withRecommended: true }, ts);
    expect(ids).toEqual(expect.arrayContaining(['governance', 'quality-gates', 'zod-config', 'env-example']));
  });

  test('getRecommendedLayers returns empty for unknown template', () => {
    expect(getRecommendedLayers({ id: 'fake' })).toEqual([]);
  });

  test('new --with-recommended applies template recommended layers', async () => {
    const name = makeName('layer-rec');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'typescript',
        auto: true,
        git: false,
        withRecommended: true,
      });
      // governance
      expect(fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8')).toContain('## Critical Protocols');
      // quality-gates
      expect(fs.existsSync(path.join(targetDir, 'scripts', 'audit-ci.mjs'))).toBe(true);
      // zod-config
      expect(fs.existsSync(path.join(targetDir, 'src', 'config', 'env.config.ts'))).toBe(true);
      // env-example
      expect(fs.existsSync(path.join(targetDir, '.env.example'))).toBe(true);
      // no lingering skeletor state
      expect(fs.existsSync(path.join(targetDir, '.skeletor'))).toBe(false);
    } finally {
      cleanup(targetDir);
    }
  });

  test('new --with applies layers and writes lockfile', async () => {
    const name = makeName('layer-with');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'javascript',
        auto: true,
        git: false,
        withLayers: ['governance', 'env-example'],
      });
      expect(fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8')).toContain('## Critical Protocols');
      expect(fs.existsSync(path.join(targetDir, '.env.example'))).toBe(true);
    } finally {
      cleanup(targetDir);
    }
  });
});

describe('rust layouts', () => {
  test('workspace layout scaffolds crates', async () => {
    const name = makeName('rust-ws');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'rust',
        layout: 'workspace',
        auto: true,
        git: false,
      });
      expect(fs.existsSync(path.join(targetDir, 'Cargo.toml'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'crates', 'core', 'src', 'lib.rs'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'crates', 'cli', 'src', 'main.rs'))).toBe(true);
    } finally {
      cleanup(targetDir);
    }
  });
});

describe('generated ignore rules', () => {
  /** Exit 0 means ignored, 1 means not ignored; anything else is a real failure. */
  function isIgnored(dir, rel) {
    try {
      execSync(`git check-ignore -q --no-index "${rel}"`, { cwd: dir, stdio: 'pipe' });
      return true;
    } catch (e) {
      if (e.status === 1) return false;
      throw e;
    }
  }

  async function scaffold(template, opts = {}) {
    const name = makeName(`ignore-${template}`);
    const targetDir = path.resolve(process.cwd(), name);
    await runNew({ command: 'new', name, template, owner: 'acme', auto: true, git: false, ...opts });
    execSync('git init -q', { cwd: targetDir, stdio: 'pipe' });
    return { name, targetDir };
  }

  test.each(['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'csharp'])('%s ignores .env files but not .env.example', async (template) => {
    const { targetDir } = await scaffold(template);
    try {
      expect(isIgnored(targetDir, '.env')).toBe(true);
      expect(isIgnored(targetDir, '.env.local')).toBe(true);
      expect(isIgnored(targetDir, '.env.example')).toBe(false);
      expect(isIgnored(targetDir, 'README.md')).toBe(false);
    } finally {
      cleanup(targetDir);
    }
  });

  test('javascript --with-recommended leaves the env-example file trackable', async () => {
    const { targetDir } = await scaffold('javascript', { withRecommended: true });
    try {
      expect(fs.existsSync(path.join(targetDir, '.env.example'))).toBe(true);
      expect(isIgnored(targetDir, '.env.example')).toBe(false);
    } finally {
      cleanup(targetDir);
    }
  });

  test('go ignores the binary go build writes, and bin/', async () => {
    const { name, targetDir } = await scaffold('go');
    try {
      expect(isIgnored(targetDir, name)).toBe(true);
      expect(isIgnored(targetDir, `${name}.exe`)).toBe(true);
      expect(isIgnored(targetDir, 'bin/tool')).toBe(true);
      expect(isIgnored(targetDir, 'main.go')).toBe(false);
      expect(isIgnored(targetDir, `cmd/${name}/main.go`)).toBe(false);
    } finally {
      cleanup(targetDir);
    }
  });

  test('test-harness:playwright ignores its report and result directories', async () => {
    const { targetDir } = await scaffold('typescript', { withLayers: ['test-harness:playwright'] });
    try {
      for (const rel of ['playwright-report/index.html', 'test-results/run/trace.zip', 'blob-report/report.zip']) {
        expect({ rel, ignored: isIgnored(targetDir, rel) }).toEqual({ rel, ignored: true });
      }
      expect(isIgnored(targetDir, 'tests/e2e/example.spec.ts')).toBe(false);
      expect(isIgnored(targetDir, 'playwright.config.ts')).toBe(false);
    } finally {
      cleanup(targetDir);
    }
  });

  test('library-publishing ignores its lib/ build output', async () => {
    const { targetDir } = await scaffold('typescript', { withLayers: ['library-publishing'] });
    try {
      expect(isIgnored(targetDir, 'lib/index.js')).toBe(true);
      expect(isIgnored(targetDir, 'src/index.ts')).toBe(false);
    } finally {
      cleanup(targetDir);
    }
  });

  test('layer entries render tokens and are not duplicated', async () => {
    const { targetDir } = await scaffold('javascript', { withLayers: ['test-harness:playwright'] });
    try {
      for (let i = 0; i < 2; i++) {
        const result = applyLayers({
          projectDir: targetDir,
          layerIds: ['logger-winston', 'test-harness:playwright'],
          template: 'javascript',
          vars: { LOG_DIR: 'var/log' },
          noInstall: true,
        });
        expect(result.ok).toBe(true);
      }
      const ignoreFile = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
      expect(ignoreFile.match(/^\/test-results\/$/gm)).toHaveLength(1);
      expect(ignoreFile.match(/^var\/log\/$/gm)).toHaveLength(1);
      expect(isIgnored(targetDir, 'var/log/app.log')).toBe(true);
    } finally {
      cleanup(targetDir);
    }
  });
});
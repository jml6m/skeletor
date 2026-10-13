import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.SKELETOR_CLI_TEST = '1';

import {
  runNew,
  collectLayerIds,
  getBaselineLayers,
  getFeatureLayers,
  getTemplatesWithManifests,
  loadTemplateManifest,
} from '../src/index.js';
import {
  validateLayerManifests,
  resolveLayerOrder,
  expandBundle,
  applyLayers,
  loadBundles,
  loadLayerById,
  appendAgentsSection,
  buildLabelSeed,
  applyPackageJsonOverride,
  getLayersWithManifests,
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

describe('packageJsonOverride', () => {
  test('replaces nested and top-level values from the patch, and null removes a key', () => {
    const pkg = { private: true, main: 'dist/index.js', scripts: { start: 'node src/index.js', test: 'jest' } };
    const patch = { private: null, main: './lib/index.cjs', scripts: { start: 'node --env-file-if-exists=.env src/index.js' } };
    const applied = applyPackageJsonOverride(pkg, patch, ['private', 'main', 'scripts.start', 'scripts.lint']);
    expect(applied).toEqual(['private', 'main', 'scripts.start']);
    expect(pkg).toEqual({ main: './lib/index.cjs', scripts: { start: 'node --env-file-if-exists=.env src/index.js', test: 'jest' } });
  });

  test('settles the merge conflicts of the paths it overrides', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-override-'));
    try {
      fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({ name: 'x', private: true, main: 'dist/index.js', scripts: { start: 'node dist/index.js' } }));
      const result = applyLayers({ projectDir: targetDir, template: 'typescript', language: 'typescript', layerIds: ['library-publishing', 'env-example'], vars: {}, noInstall: true });
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      expect(pkg.private).toBeUndefined();
      expect(pkg.main).toBe('./lib/index.cjs');
      expect(pkg.scripts.start).toBe('node --env-file-if-exists=.env dist/index.js');
      const settled = result.conflicts.map((c) => c.path).filter((p) => ['private', 'main', 'scripts.start'].includes(p));
      expect(settled).toEqual([]);
    } finally {
      cleanup(targetDir);
    }
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

  test('express-api bundle ships an Express server that npm start runs on PORT', async () => {
    const name = makeName('layer-express');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'javascript', owner: 'acme', auto: true, git: false, bundle: 'express-api' });
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      expect(pkg.dependencies.express).toBeDefined();
      expect(pkg.scripts.start).toBe('node --env-file-if-exists=.env src/index.js');
      expect(pkg.scripts['free-port']).toBe('node scripts/free-port.cjs');
      expect(fs.readFileSync(path.join(targetDir, 'scripts', 'free-port.cjs'), 'utf8')).toContain("process.loadEnvFile('.env')");
      expect(fs.readFileSync(path.join(targetDir, 'src', 'index.js'), 'utf8')).toContain('createApp().listen(port');
      expect(fs.existsSync(path.join(targetDir, 'src', 'app.js'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'tests', 'app.test.js'))).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, '.env.example'), 'utf8')).toContain('PORT=3000');
    } finally {
      cleanup(targetDir);
    }
  });

  test.each([
    ['javascript', 'src/index.js'],
    ['typescript', 'dist/index.js'],
  ])('%s: only env-example makes npm start load .env', async (template, entry) => {
    const plain = makeName(`layer-env-plain-${template}`);
    const withEnv = makeName(`layer-env-${template}`);
    const start = (name) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), name, 'package.json'), 'utf8')).scripts.start;
    try {
      await runNew({ command: 'new', name: plain, template, owner: 'acme', auto: true, git: false, withLayers: ['governance'] });
      await runNew({ command: 'new', name: withEnv, template, owner: 'acme', auto: true, git: false, withLayers: ['env-example'] });
      expect(start(plain)).toBe(`node ${entry}`);
      expect(start(withEnv)).toBe(`node --env-file-if-exists=.env ${entry}`);
    } finally {
      cleanup(path.resolve(process.cwd(), plain));
      cleanup(path.resolve(process.cwd(), withEnv));
    }
  });

  test.each(['javascript', 'typescript'])('test harnesses emit %s files, an example test, and AGENTS sections', async (template) => {
    const name = makeName(`layer-harness-${template}`);
    const targetDir = path.resolve(process.cwd(), name);
    const ext = template === 'typescript' ? 'ts' : 'js';
    const other = ext === 'ts' ? 'js' : 'ts';
    try {
      await runNew({
        command: 'new',
        name,
        template,
        owner: 'acme',
        auto: true,
        git: false,
        withLayers: ['test-harness:playwright', 'test-harness:mongo-memory'],
      });
      for (const rel of [`playwright.config.${ext}`, `tests/e2e/example.spec.${ext}`, `tests/support/mongo-memory.${ext}`, `tests/example.mongo.test.${ext}`]) {
        expect({ rel, exists: fs.existsSync(path.join(targetDir, rel)) }).toEqual({ rel, exists: true });
        const twin = rel.replace(new RegExp(`\\.${ext}$`), `.${other}`);
        expect({ twin, exists: fs.existsSync(path.join(targetDir, twin)) }).toEqual({ twin, exists: false });
      }
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      expect(pkg.scripts['test:mongo']).toContain('--testPathPatterns=mongo.test');
      expect(pkg.scripts['test:mongo']).not.toContain('--passWithNoTests');
      expect(pkg.devDependencies['mongodb-memory-server']).toMatch(/^\^11\./);
      const agents = fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8');
      expect(agents).toContain('## End-to-end tests');
      expect(agents).toContain('npm run test:e2e');
      expect(agents).toContain('## Database tests');
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

  test('library-publishing scaffolds a publishable package with its own library entry', async () => {
    const name = makeName('layer-lib');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'typescript', owner: 'acme', auto: true, git: false, withLayers: ['library-publishing'] });
      const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      expect(pkg.private).toBeUndefined();
      expect(pkg.license).toBe('MIT');
      expect(pkg.main).toBe('./lib/index.cjs');
      expect(pkg.exports['.'].require.default).toBe(pkg.main);
      expect(pkg.files).toEqual(['lib']);
      expect(pkg.scripts.prepack).toBe('npm run build:lib');
      // Self-contained: every script prepublishOnly calls exists without other layers.
      for (const script of pkg.scripts.prepublishOnly.match(/npm run [\w:-]+/g)) {
        expect(pkg.scripts[script.slice('npm run '.length)]).toBeDefined();
      }
      expect(fs.readFileSync(path.join(targetDir, 'tsup.config.ts'), 'utf8')).toContain("entry: ['src/lib/index.ts']");
      expect(fs.readFileSync(path.join(targetDir, 'src', 'lib', 'index.ts'), 'utf8')).toContain('export function');
      expect(fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8').split('\n')).toContain('/lib/');
      expect(fs.readFileSync(path.join(targetDir, '.prettierignore'), 'utf8').split('\n')).toContain('lib/');
      expect(fs.readFileSync(path.join(targetDir, 'eslint.config.js'), 'utf8')).toContain("'lib/**'");
    } finally {
      cleanup(targetDir);
    }
  });

  test('layers take no prompts', () => {
    expect(getLayersWithManifests().filter((l) => l.prompts).map((l) => l.id)).toEqual([]);
  });

  test('free-port and logger-winston use fixed defaults: port 3000 (or $PORT) and logs/', async () => {
    const name = makeName('layer-fixed');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'typescript', owner: 'acme', auto: true, git: false, withLayers: ['free-port', 'logger-winston'] });
      const script = fs.readFileSync(path.join(targetDir, 'scripts', 'free-port.cjs'), 'utf8');
      expect(script).toContain('process.env.PORT || 3000');
      // The server reads the same default, so prestart frees the port the app listens on.
      expect(fs.readFileSync(path.join(targetDir, 'src', 'config', 'env.config.ts'), 'utf8')).toContain('.default(3000)');
      expect(fs.readFileSync(path.join(targetDir, 'src', 'utils', 'logger.ts'), 'utf8')).toContain("path.resolve(process.cwd(), 'logs')");
    } finally {
      cleanup(targetDir);
    }
  });

  test('collectLayerIds always includes the baseline, then --with and bundle layers', () => {
    const ts = loadTemplateManifest('typescript');
    const baseline = ['governance', 'dependabot', 'issue-templates', 'quality-gates', 'docs-lint'];
    expect(getBaselineLayers(ts)).toEqual(baseline);
    expect(collectLayerIds({}, ts)).toEqual(baseline);
    expect(collectLayerIds({ withLayers: ['zod-config', 'governance'] }, ts)).toEqual([...baseline, 'zod-config']);
    expect(collectLayerIds({ bundle: 'ts-library' }, 'typescript')).toEqual([...baseline, 'library-publishing']);
    expect(getBaselineLayers({ id: 'fake' })).toEqual([]);
  });

  test('every template declares baselineLayers that apply to it, and no recommendedLayers', () => {
    for (const t of getTemplatesWithManifests()) {
      expect({ id: t.id, recommendedLayers: t.recommendedLayers }).toEqual({ id: t.id, recommendedLayers: undefined });
      expect(getBaselineLayers(t)).toEqual(expect.arrayContaining(['governance', 'dependabot', 'issue-templates']));
      const { errors } = resolveLayerOrder(getBaselineLayers(t), { template: t.id, language: t.language });
      expect({ id: t.id, errors }).toEqual({ id: t.id, errors: [] });
    }
  });

  test('the feature-layer picker offers only layers outside the baseline', () => {
    for (const t of getTemplatesWithManifests()) {
      const offered = getFeatureLayers(t).map((l) => l.id);
      expect(offered.filter((id) => getBaselineLayers(t).includes(id))).toEqual([]);
      expect(offered).toEqual(expect.arrayContaining(['docs-policy', 'issue-labels']));
    }
    const ts = getFeatureLayers(loadTemplateManifest('typescript')).map((l) => l.id);
    expect(ts).toEqual(expect.arrayContaining(['zod-config', 'env-example', 'logger-winston', 'library-publishing']));
    expect(getFeatureLayers(loadTemplateManifest('go')).map((l) => l.id)).not.toContain('zod-config');
  });

  test('bundles list only feature layers', () => {
    for (const [name, bundle] of Object.entries(loadBundles())) {
      const baseline = getBaselineLayers(loadTemplateManifest(bundle.template));
      expect({ name, baseline: bundle.layers.filter((id) => baseline.includes(id)) }).toEqual({ name, baseline: [] });
    }
  });

  test('a default scaffold applies the baseline and no feature layers', async () => {
    const name = makeName('layer-baseline');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'typescript', owner: 'acme', auto: true, git: false, withLayers: [] });
      expect(fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8')).toContain('## Critical Protocols');
      expect(fs.existsSync(path.join(targetDir, '.github', 'dependabot.yml'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, '.github', 'ISSUE_TEMPLATE', 'epic.yml'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'scripts', 'audit-ci.mjs'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, '.github', 'workflows', 'docs-lint.yml'))).toBe(true);
      // zod-config and env-example are feature layers now.
      expect(fs.readFileSync(path.join(targetDir, 'src', 'config', 'env.config.ts'), 'utf8')).not.toContain('z.object');
      expect(fs.existsSync(path.join(targetDir, '.env.example'))).toBe(false);
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

/** The body of `## <section>`: everything up to the next level-1 or level-2 heading. */
function sectionBody(agents, section) {
  const lines = agents.split('\n');
  const start = lines.indexOf(`## ${section}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

function expectSnippetsUnderHeadings(targetDir, layerIds) {
  const agents = fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8');
  expect(agents).not.toContain('skeletor-layer');
  const withDocs = layerIds.map((id) => loadLayerById(id)).filter((l) => l.docs?.agents);
  expect(withDocs.length).toBeGreaterThan(0);
  for (const layer of withDocs) {
    const { section, append } = layer.docs.agents;
    const snippet = fs.readFileSync(path.join(layer.dir, append), 'utf8').trim();
    expect(agents.split('\n').filter((l) => l === `## ${section}`)).toHaveLength(1);
    expect({ layer: layer.id, underHeading: sectionBody(agents, section)?.includes(snippet) }).toEqual({ layer: layer.id, underHeading: true });
  }
}

describe('AGENTS.md layer snippets', () => {
  test.each([
    [['governance', 'issue-labels']],
    [['issue-labels', 'governance']],
  ])('python + %j puts each snippet under its own heading', async (layerIds) => {
    const name = makeName('agents-py');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'python', owner: 'acme', auto: true, git: false, withLayers: layerIds });
      expectSnippetsUnderHeadings(targetDir, layerIds);
    } finally {
      cleanup(targetDir);
    }
  });

  test('javascript --with-recommended puts each snippet under its own heading', async () => {
    const name = makeName('agents-js');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'javascript', owner: 'acme', auto: true, git: false, withRecommended: true });
      expectSnippetsUnderHeadings(targetDir, collectLayerIds({ withRecommended: true }, loadTemplateManifest('javascript')));
    } finally {
      cleanup(targetDir);
    }
  });

  test('appendAgentsSection inserts before the next heading and ignores headings in code fences', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-agents-'));
    const agentsPath = path.join(dir, 'AGENTS.md');
    try {
      fs.writeFileSync(agentsPath, '# Title\n\n## One\n\nFirst.\n\n```md\n## Not a heading\n```\n\n### Sub\n\nNested.\n\n## Two\n\nSecond.\n');
      expect(appendAgentsSection(agentsPath, 'One', 'Added.\n')).toBe(
        '# Title\n\n## One\n\nFirst.\n\n```md\n## Not a heading\n```\n\n### Sub\n\nNested.\n\nAdded.\n\n## Two\n\nSecond.\n',
      );
      expect(appendAgentsSection(agentsPath, 'Two', 'Added.')).toMatch(/## Two\n\nSecond\.\n\nAdded\.\n$/);
      expect(appendAgentsSection(agentsPath, 'Three', 'Added.')).toMatch(/Second\.\n\n## Three\n\nAdded\.\n$/);
      expect(appendAgentsSection(path.join(dir, 'missing.md'), 'Three', 'Added.')).toBe('## Three\n\nAdded.\n');
    } finally {
      cleanup(dir);
    }
  });
});

describe('label seed', () => {
  const seedLine = (l) => `gh label create "${l.name}" --color ${l.color} --description "${l.description}" --force`;
  const chore = loadLayerById('issue-labels').labels.find((l) => l.name === 'chore');
  const epic = loadLayerById('issue-templates').labels.find((l) => l.name === 'epic');

  test('chore is seeded as fef2c0 "Maintenance / process work"', () => {
    expect(chore).toEqual({ name: 'chore', color: 'fef2c0', description: 'Maintenance / process work' });
  });

  test('--with-recommended --with issue-labels seeds chore and epic under Issue labels', async () => {
    const name = makeName('label-seed-js');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'javascript', owner: 'acme', auto: true, git: false, withRecommended: true, withLayers: ['issue-labels'] });
      const agents = fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8');
      const body = sectionBody(agents, 'Issue labels');
      expect(body).toContain(seedLine(chore));
      expect(body).toContain(seedLine(epic));
      expect(body).toContain('`area:` prefix');
      expect(agents.match(/gh label create/g)).toHaveLength(2);
    } finally {
      cleanup(targetDir);
    }
  });

  test('issue-templates alone still documents how to create epic', async () => {
    const name = makeName('label-seed-py');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'python', owner: 'acme', auto: true, git: false, withRecommended: true });
      const body = sectionBody(fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8'), 'Issue labels');
      expect(body).toContain(seedLine(epic));
      expect(body).not.toContain('"chore"');
    } finally {
      cleanup(targetDir);
    }
  });

  test('no labels, no section', async () => {
    const name = makeName('label-seed-none');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({ command: 'new', name, template: 'go', owner: 'acme', auto: true, git: false, withLayers: ['governance'] });
      expect(fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8')).not.toContain('## Issue labels');
    } finally {
      cleanup(targetDir);
    }
  });

  test('buildLabelSeed quotes names and descriptions for the shell', () => {
    const seed = buildLabelSeed([{ name: 'needs review', color: 'abcdef', description: 'Say "hi" for $5 `now`' }]);
    expect(seed).toContain('gh label create "needs review" --color abcdef --description "Say \\"hi\\" for \\$5 \\`now\\`" --force');
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

  test('layer entries are not duplicated, and logger-winston output stays ignored', async () => {
    const { targetDir } = await scaffold('javascript', { withLayers: ['test-harness:playwright'] });
    try {
      for (let i = 0; i < 2; i++) {
        const result = applyLayers({
          projectDir: targetDir,
          layerIds: ['logger-winston', 'test-harness:playwright'],
          template: 'javascript',
          vars: {},
          noInstall: true,
        });
        expect(result.ok).toBe(true);
      }
      const ignoreFile = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
      expect(ignoreFile.match(/^\/test-results\/$/gm)).toHaveLength(1);
      // logger-winston writes to the fixed logs/ directory, which the template already ignores.
      expect(isIgnored(targetDir, 'logs/app.log')).toBe(true);
    } finally {
      cleanup(targetDir);
    }
  });
});
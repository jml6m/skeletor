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
  loadLayerById,
  appendAgentsSection,
  buildLabelSeed,
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
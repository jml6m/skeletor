import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.SKELETOR_CLI_TEST = '1';

import {
  runNew,
  parseArgs,
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
} from '../src/layers.js';
import { readProjectManifest } from '../src/manifest.js';

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

describe('enhance command', () => {
  test('parseArgs handles enhance flags', () => {
    const r = parseArgs(['node', 'skeletor', 'enhance', './app', '--add', 'governance', '--dry-run']);
    expect(r.command).toBe('enhance');
    expect(r.path).toBe('./app');
    expect(r.addLayers).toEqual(['governance']);
    expect(r.dryRun).toBe(true);
  });

  test('apply governance layer is idempotent', async () => {
    const name = makeName('layer-gov');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'javascript',
        auto: true,
        git: false,
        withLayers: [],
      });

      const first = applyLayers({
        projectDir: targetDir,
        layerIds: ['governance'],
        template: 'javascript',
        noInstall: true,
      });
      expect(first.ok).toBe(true);
      expect(first.applied).toContain('governance');
      expect(fs.existsSync(path.join(targetDir, '.grok', 'rules', 'testing.md'))).toBe(true);

      const hash1 = hashDir(targetDir);
      const second = applyLayers({
        projectDir: targetDir,
        layerIds: ['governance'],
        template: 'javascript',
        noInstall: true,
      });
      expect(second.applied).toEqual([]);
      expect(hashDir(targetDir)).toBe(hash1);
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
      const manifest = readProjectManifest(targetDir);
      expect(manifest.layers.map((l) => l.id)).toEqual(
        expect.arrayContaining(['governance', 'quality-gates', 'zod-config', 'env-example']),
      );
      expect(fs.existsSync(path.join(targetDir, '.grok', 'rules', 'testing.md'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'scripts', 'audit-ci.mjs'))).toBe(true);
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
      const manifest = readProjectManifest(targetDir);
      expect(manifest.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['governance', 'env-example']));
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
      const manifest = readProjectManifest(targetDir);
      expect(manifest.layout).toBe('workspace');
    } finally {
      cleanup(targetDir);
    }
  });
});
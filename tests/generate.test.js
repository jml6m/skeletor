import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// We import the enriched template discovery (pure + side-effect guarded)
process.env.SKELETOR_CLI_TEST = '1';
import { getTemplatesWithManifests, runNew as runNewProgrammatic } from '../src/index.js';
import { loadBundles, loadLayerById } from '../src/layers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'index.js');

/** Spawn the real CLI (main()) without Jest's worker env leaking in. */
function runCli(args, cwd = ROOT) {
  const env = { ...process.env };
  delete env.JEST_WORKER_ID;
  delete env.SKELETOR_CLI_TEST;
  return execSync(`node "${SRC}" ${args}`, { cwd, stdio: 'pipe', env });
}

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
      execSync(cmd, {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 300000,
        shell: true,
      });
    } catch (e) {
      const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
      // Re-throw with context so the test failure is informative
      throw new Error(`Command failed: ${cmd}\n${output}`);
    }
  }
}

function listFilesRecursive(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const sub of listFilesRecursive(path.join(dir, entry.name))) {
        results.push(path.join(entry.name, sub));
      }
    } else {
      results.push(entry.name);
    }
  }
  return results;
}

// Maps template id to the expected unsuffixed manifest file in the generated project.
const expectedManifest = {
  javascript: 'package.json',
  typescript: 'package.json',
  python: 'pyproject.toml',
  rust: 'Cargo.toml',
  java: 'pom.xml',
  csharp: 'Project.csproj',
  go: 'go.mod',
};

describe('skeletor multi-template scaffolding + verification (steps 3 & 4)', () => {
  const templates = getTemplatesWithManifests();

  test('discovers multiple templates via manifests', () => {
    expect(templates.length).toBeGreaterThan(0);
    const ids = templates.map((t) => t.id);
    // We expect at least the ones we maintain
    expect(ids).toContain('javascript');
  });

  test('template features cover verifyCommands', async () => {
    const { validateTemplateFeatures } = await import('../src/features.js');
    const errors = templates.flatMap((t) => validateTemplateFeatures(t));
    expect(errors).toEqual([]);
  });

  // For every discovered template, generate + run its declared verify steps.
  // This directly tests (3) generation and (4) the post-scaffold quality gates
  // the user listed (install, lint/format, test, health, build, etc.).
  templates.forEach((tmpl) => {
    test(`generates and verifies "${tmpl.id}" template (${tmpl.name})`, async () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-multi-'));
      const name = makeTempProjectName(`gen-${tmpl.id}`);
      // runNew resolves the target dir relative to process.cwd(), so track it for cleanup
      const targetDir = path.resolve(process.cwd(), name);

      try {
        // Programmatic generation (step 3) using the real logic. Applies recommended
        // layers so CI's full verify run (SKELETOR_VERIFY_COMMANDS=1) exercises the
        // same layer-interaction paths a real `--with-recommended` scaffold hits.
        await runNewProgrammatic({
          command: 'new',
          name,
          template: tmpl.id,
          owner: 'tbra-owner',
          description: 'Tetrahedral barycentric coords',
          auto: true,
          git: false,
          withRecommended: true,
        });

        // Validate that the template declares its post-generation verification steps (step 4).
        // These are exactly the commands ("npm install", "ruff check", "npm run health:full", etc.)
        // a developer runs after `skeletor new --template ${tmpl.id}`.
        expect(Array.isArray(tmpl.verifyCommands) && tmpl.verifyCommands.length > 0).toBe(true);

        // Assert no .tmpl suffixes or skeletor tooling state leak into the generated project.
        const allFiles = listFilesRecursive(targetDir);
        expect(allFiles.every((f) => !f.endsWith('.tmpl'))).toBe(true);
        expect(fs.existsSync(path.join(targetDir, 'template.json'))).toBe(false);
        expect(fs.existsSync(path.join(targetDir, '.skeletor'))).toBe(false);

        // Assert the expected unsuffixed manifest exists for this template.
        const manifest = expectedManifest[tmpl.id];
        if (manifest) {
          expect(fs.existsSync(path.join(targetDir, manifest))).toBe(true);
        }

        if (tmpl.id === 'csharp') {
          const program = fs.readFileSync(path.join(targetDir, 'Program.cs'), 'utf8');
          expect(program).toContain(`namespace ${name.replace(/-/g, '_')};`);
          expect(program).not.toContain('{{');
        }

        if (tmpl.id === 'go') {
          const goMod = fs.readFileSync(path.join(targetDir, 'go.mod'), 'utf8');
          expect(goMod).toContain('module github.com/tbra-owner/');
          expect(goMod).not.toContain('{{');
        }

        if (tmpl.id === 'java') {
          const pom = fs.readFileSync(path.join(targetDir, 'pom.xml'), 'utf8');
          expect(pom).toContain('<groupId>io.github.tbraowner</groupId>');
          expect(pom).not.toContain('{{');
          expect(fs.existsSync(path.join(targetDir, 'src', 'main', 'java', 'io', 'github', 'tbraowner', 'App.java'))).toBe(true);
        }

        expect(fs.readFileSync(path.join(targetDir, 'CLAUDE.md'), 'utf8').trim()).toBe('@AGENTS.md');
        // Stale-issue bots are deliberately never emitted (2026-06 repo-hygiene convention).
        expect(allFiles.some((f) => /(^|[\\/])stale\.ya?ml$/.test(f))).toBe(false);

        for (const rel of allFiles) {
          const text = fs.readFileSync(path.join(targetDir, rel), 'utf8');
          expect({ rel, unresolved: text.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g) }).toEqual({ rel, unresolved: null });
        }

        const dependabot = fs.readFileSync(path.join(targetDir, '.github', 'dependabot.yml'), 'utf8');
        const ecosystem = { javascript: 'npm', typescript: 'npm', python: 'pip', go: 'gomod', rust: 'cargo', java: 'maven', csharp: 'nuget' }[tmpl.id];
        expect(dependabot).toContain(`package-ecosystem: "${ecosystem}"`);
        expect(dependabot).not.toMatch(/^\s*labels:/m);
        expect(dependabot.includes('ignore:')).toBe(ecosystem === 'npm');
        expect(fs.existsSync(path.join(targetDir, '.python-version'))).toBe(tmpl.language === 'python');

        const textFiles = allFiles.filter((f) => /\.(c|m)?[jt]s$|\.py$|\.go$|\.rs$|\.java$|\.cs$/.test(f));
        for (const rel of textFiles) {
          const firstLine = fs.readFileSync(path.join(targetDir, rel), 'utf8').split('\n')[0];
          const posixRel = rel.split(path.sep).join('/');
          // A leading comment that just names the file is a copy/paste-era leftover (#69).
          expect({ rel: posixRel, firstLine: /^(\/\/|#|\/\*)/.test(firstLine) && firstLine.includes(posixRel) }).toEqual({ rel: posixRel, firstLine: false });
        }

        const pkgPath = path.join(targetDir, 'package.json');
        if (fs.existsSync(pkgPath) && JSON.parse(fs.readFileSync(pkgPath, 'utf8')).type === 'module') {
          // .js files in an ESM package can't use require() (#36); CommonJS helpers need a .cjs name.
          for (const rel of allFiles.filter((f) => f.endsWith('.js'))) {
            expect({ rel, usesRequire: /\brequire\(/.test(fs.readFileSync(path.join(targetDir, rel), 'utf8')) }).toEqual({ rel, usesRequire: false });
          }
        }

        if (tmpl.features?.length) {
          const gitignore = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
          expect(gitignore).toContain('Generated by skeletor from template features');
        }

        if (process.env.SKELETOR_FULL_VERIFY === '1') {
          runVerifyCommands(targetDir, tmpl.verifyCommands);
        }

        if (tmpl.id === 'rust') {
          expect(fs.existsSync(path.join(targetDir, '.gitignore'))).toBe(true);
          const cargo = fs.readFileSync(path.join(targetDir, 'Cargo.toml'), 'utf8');
          expect(cargo).toContain('description = "Tetrahedral barycentric coords"');
          expect(cargo).toContain('repository = "https://github.com/tbra-owner/');
          const gitignore = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
          expect(gitignore).toContain('/target/');
        }

        if (process.env.SKELETOR_VERIFY_COMMANDS === '1') {
          runVerifyCommands(targetDir, tmpl.verifyCommands);
        }
      } finally {
        cleanup(tempRoot);
        cleanup(targetDir);
      }
    });
  });

  test('refuses to overwrite non-empty directory', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-gen-'));
    const name = makeTempProjectName();
    const dir = path.join(tempRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'existing.txt'), 'do not overwrite');

    let threw = false;
    try {
      runCli(`new "${name}" --auto --template go --no-git`, tempRoot);
    } catch (e) {
      threw = true;
    } finally {
      const stillThere = fs.existsSync(path.join(dir, 'existing.txt'));
      expect(stillThere).toBe(true);
      expect(threw).toBe(true);
      cleanup(tempRoot);
    }
  });

  test('refuses --auto without --template', () => {
    expect(() => {
      runCli('new skeletor-missing-template --auto --no-git');
    }).toThrow();
  });
});

describe('non-default template layouts', () => {
  const layoutCases = getTemplatesWithManifests().flatMap((tmpl) =>
    Object.entries(tmpl.layouts || {})
      .filter(([id]) => id !== (tmpl.defaultLayout || Object.keys(tmpl.layouts)[0]))
      .map(([id, layout]) => ({ tmpl, id, layout })),
  );

  test.each(layoutCases.map((c) => [c.tmpl.id, c.id, c]))('generates and verifies %s --layout %s', async (_t, _l, { tmpl, id, layout }) => {
    const name = makeTempProjectName(`gen-${tmpl.id}-${id}`);
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNewProgrammatic({ command: 'new', name, template: tmpl.id, layout: id, owner: 'tbra-owner', auto: true, git: false, withRecommended: true });
      expect(fs.existsSync(path.join(targetDir, 'AGENTS.md'))).toBe(true);
      if (tmpl.id === 'python' && id === 'src') {
        expect(fs.existsSync(path.join(targetDir, 'src', 'app', 'main.py'))).toBe(true);
        expect(fs.existsSync(path.join(targetDir, 'main.py'))).toBe(false);
      }
      if (process.env.SKELETOR_VERIFY_COMMANDS === '1') {
        runVerifyCommands(targetDir, layout.verifyCommands || tmpl.verifyCommands);
      }
    } finally {
      cleanup(targetDir);
    }
  });

  test('python defaults to the flat layout (scripts at the repo root, no packaging)', async () => {
    const name = makeTempProjectName('gen-python-flat');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNewProgrammatic({ command: 'new', name, template: 'python', owner: 'tbra-owner', auto: true, git: false });
      expect(fs.existsSync(path.join(targetDir, 'main.py'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'src'))).toBe(false);
      const pyproject = fs.readFileSync(path.join(targetDir, 'pyproject.toml'), 'utf8');
      expect(pyproject).toContain('[dependency-groups]');
      expect(pyproject).not.toContain('[build-system]');
    } finally {
      cleanup(targetDir);
    }
  });
});

describe('optional layers and bundles', () => {
  const OPTIONAL_LAYERS = ['free-port', 'log-table', 'logger-winston', 'test-harness:mongo-memory', 'test-harness:playwright', 'library-publishing', 'docs-policy', 'issue-labels'];
  const templates = getTemplatesWithManifests().filter((t) => ['javascript', 'typescript'].includes(t.id));

  const cases = [
    ...templates.flatMap((tmpl) =>
      OPTIONAL_LAYERS.filter((id) => loadLayerById(id).appliesTo.languages.some((l) => l === '*' || l === tmpl.language)).map((id) => ({
        label: `${tmpl.id} + ${id}`,
        tmpl,
        opts: { withRecommended: true, withLayers: [id] },
        extra: loadLayerById(id).verifyCommands || [],
      })),
    ),
    ...Object.entries(loadBundles()).map(([bundle, def]) => ({
      label: `bundle ${bundle}`,
      tmpl: templates.find((t) => t.id === def.template),
      opts: { bundle },
      extra: [],
    })),
  ];

  test.each(cases.map((c) => [c.label, c]))('%s scaffolds and verifies', async (_label, { tmpl, opts, extra }) => {
    const name = makeTempProjectName(`gen-opt-${tmpl.id}`);
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNewProgrammatic({ command: 'new', name, template: tmpl.id, owner: 'tbra-owner', auto: true, git: false, withLayers: [], ...opts });
      const allFiles = listFilesRecursive(targetDir);
      for (const rel of allFiles) {
        expect({ rel, unresolved: fs.readFileSync(path.join(targetDir, rel), 'utf8').match(/\{\{[A-Z][A-Z0-9_]*\}\}/g) }).toEqual({ rel, unresolved: null });
      }
      if (process.env.SKELETOR_VERIFY_COMMANDS === '1') {
        // Strict knip on top of the (report-only) health:dead script: layers must ship dead-code-clean.
        runVerifyCommands(targetDir, [...new Set([...tmpl.verifyCommands, ...extra, 'npx knip'])]);
      }
    } finally {
      cleanup(targetDir);
    }
  });
});

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.SKELETOR_CLI_TEST = '1';
const { applyLicense, buildRenderVars, runNew } = await import('../src/index.js');
const { licenseSelectOptions, resolveLicense } = await import('../src/license.js');

function makeName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.js');

/**
 * A local project scaffolds in-process without git. A `--github` one runs the CLI, as a user would,
 * against a stub gh that creates nothing, so the repository's visibility decides the license.
 * @param {{ template: string, layout?: string, github?: boolean, githubPrivate?: boolean, withLayers?: string[] }} options
 */
async function scaffold({ github, githubPrivate, ...opts }) {
  const name = makeName(`lic-${opts.template}`);
  if (!github) {
    await runNew({ command: 'new', name, owner: 'acme', auto: true, git: false, withLayers: [], ...opts });
    return path.resolve(process.cwd(), name);
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-lic-'));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  delete env.JEST_WORKER_ID;
  delete env.SKELETOR_CLI_TEST;
  fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '');
  const args = ['new', name, '--template', opts.template, '--owner', 'acme', '--auto', '--github'];
  if (opts.layout) args.push('--layout', opts.layout);
  if (githubPrivate) args.push('--private');
  execFileSync(process.execPath, [SRC, ...args], { cwd: root, env, stdio: 'pipe' });
  return path.join(root, name);
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const cleanup = (dir) => fs.rmSync(path.basename(path.dirname(dir)).startsWith('skeletor-lic-') ? path.dirname(dir) : dir, { recursive: true, force: true });

describe('license follows repository visibility', () => {
  test('UNLICENSED without --github or with --private; MIT for a public repo under --auto', async () => {
    expect(await resolveLicense({}, false)).toBe('UNLICENSED');
    expect(await resolveLicense({ github: true, githubPrivate: true }, false)).toBe('UNLICENSED');
    expect(await resolveLicense({ github: true, githubPrivate: true }, true)).toBe('UNLICENSED');
    expect(await resolveLicense({ github: false }, true)).toBe('UNLICENSED');
    expect(await resolveLicense({ github: true }, false)).toBe('MIT');
  });

  test('library-publishing makes it MIT whatever the visibility; a public repo is still asked', async () => {
    const layers = ['governance', 'library-publishing'];
    expect(await resolveLicense({}, false, layers)).toBe('MIT');
    expect(await resolveLicense({}, true, layers)).toBe('MIT');
    expect(await resolveLicense({ github: true, githubPrivate: true }, false, layers)).toBe('MIT');
    expect(await resolveLicense({ github: true }, false, layers)).toBe('MIT');
    expect(await resolveLicense({}, false, ['governance'])).toBe('UNLICENSED');
  });

  test('a local library-publishing scaffold gets an MIT LICENSE and package.json license', async () => {
    const dir = await scaffold({ template: 'typescript', withLayers: ['library-publishing'] });
    try {
      expect(read(dir, 'LICENSE')).toMatch(/^MIT License\n/);
      expect(JSON.parse(read(dir, 'package.json')).license).toBe('MIT');
    } finally {
      cleanup(dir);
    }
  });

  test('the public-repo prompt describes each option and recommends MIT', () => {
    const options = licenseSelectOptions();
    expect(options.map((o) => o.value)).toEqual(['MIT', 'Apache-2.0', 'UNLICENSED']);
    expect(options[0].label).toBe('MIT (recommended)');
    expect(options.every((o) => o.hint)).toBe(true);
    expect(options.find((o) => o.value === 'UNLICENSED').hint).toMatch(/no rights are granted/);
  });

  test('a public typescript repo gets an MIT LICENSE, package.json license and README section', async () => {
    const dir = await scaffold({ template: 'typescript', github: true });
    try {
      const license = read(dir, 'LICENSE');
      expect(license).toMatch(/^MIT License\n\nCopyright \(c\) \d{4} acme\n/);
      expect(JSON.parse(read(dir, 'package.json')).license).toBe('MIT');
      expect(read(dir, 'README.md')).toMatch(/\n## License\n\nMIT\. See \[LICENSE\]\(LICENSE\)\.\n$/);
    } finally {
      cleanup(dir);
    }
  });

  test('a private or local typescript project is UNLICENSED with no LICENSE text', async () => {
    for (const opts of [{}, { github: true, githubPrivate: true }]) {
      const dir = await scaffold({ template: 'typescript', ...opts });
      try {
        expect(fs.existsSync(path.join(dir, 'LICENSE'))).toBe(false);
        expect(JSON.parse(read(dir, 'package.json')).license).toBe('UNLICENSED');
        expect(read(dir, 'README.md')).toMatch(/\n## License\n\nUNLICENSED: all rights reserved\. No license is granted/);
      } finally {
        cleanup(dir);
      }
    }
  });

  test('Cargo.toml carries the SPDX license, or no license field when UNLICENSED', async () => {
    const manifests = ['Cargo.toml', 'crates/core/Cargo.toml', 'crates/cli/Cargo.toml'];
    const pub = await scaffold({ template: 'rust', layout: 'workspace', github: true });
    const local = await scaffold({ template: 'rust', layout: 'workspace' });
    try {
      expect(read(pub, 'Cargo.toml')).toContain('\nlicense = "MIT"\n');
      expect(read(pub, 'crates/core/Cargo.toml')).toContain('\nlicense.workspace = true\n');
      for (const rel of manifests) expect({ rel, license: /^license/m.test(read(local, rel)) }).toEqual({ rel, license: false });
    } finally {
      cleanup(pub);
      cleanup(local);
    }
  });

  test('pyproject.toml carries the SPDX license, or no license field when UNLICENSED', async () => {
    for (const layout of ['flat', 'src']) {
      const pub = await scaffold({ template: 'python', layout, github: true });
      const local = await scaffold({ template: 'python', layout });
      try {
        expect(read(pub, 'pyproject.toml')).toContain('\nlicense = "MIT"\n');
        expect(read(local, 'pyproject.toml')).not.toMatch(/^license/m);
        expect(read(local, 'pyproject.toml')).not.toContain('UNLICENSED');
      } finally {
        cleanup(pub);
        cleanup(local);
      }
    }
  });

  test('Apache-2.0 writes the full license text', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-license-'));
    try {
      fs.writeFileSync(path.join(dir, 'README.md'), '# my-app\n');
      applyLicense(dir, buildRenderVars({ name: 'my-app', owner: 'acme', extra: { LICENSE: 'Apache-2.0' } }));
      const license = read(dir, 'LICENSE');
      expect(license).toContain('Apache License\n                           Version 2.0, January 2004');
      expect(license).toContain('END OF TERMS AND CONDITIONS');
      expect(read(dir, 'README.md')).toBe('# my-app\n\n## License\n\nApache-2.0. See [LICENSE](LICENSE).\n');
    } finally {
      cleanup(dir);
    }
  });
});

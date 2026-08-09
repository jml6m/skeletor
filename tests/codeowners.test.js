import fs from 'fs';
import path from 'path';

process.env.SKELETOR_CLI_TEST = '1';

import { runNew } from '../src/index.js';
import { computeCodeownersCandidates, buildCodeownersContent } from '../src/codeowners.js';

function makeName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function cleanup(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

describe('codeowners candidates', () => {
  test('base candidates apply to every language', () => {
    const candidates = computeCodeownersCandidates({ language: 'go' });
    expect(candidates.map((c) => c.path)).toEqual(['.github/', 'AGENTS.md']);
  });

  test('javascript/typescript add package.json and release.js', () => {
    for (const language of ['javascript', 'typescript']) {
      const candidates = computeCodeownersCandidates({ language });
      expect(candidates.map((c) => c.path)).toEqual(
        expect.arrayContaining(['.github/', 'AGENTS.md', 'package.json', 'release.js']),
      );
    }
  });

  test('buildCodeownersContent scopes to exactly the given paths, no blanket *', () => {
    const content = buildCodeownersContent(['.github/', 'AGENTS.md'], 'jml6m');
    expect(content).toContain('.github/');
    expect(content).toContain('@jml6m');
    expect(content).not.toMatch(/^\*\s/m);
  });
});

describe('codeowners CLI integration', () => {
  test('--codeowners generates a scoped file in --auto mode', async () => {
    const name = makeName('co-auto');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'typescript',
        owner: 'jml6m',
        auto: true,
        git: false,
        codeowners: true,
      });
      const content = fs.readFileSync(path.join(targetDir, '.github', 'CODEOWNERS'), 'utf8');
      expect(content).toContain('.github/');
      expect(content).toContain('AGENTS.md');
      expect(content).toContain('package.json');
      expect(content).toContain('release.js');
      expect(content).toContain('@jml6m');
    } finally {
      cleanup(targetDir);
    }
  });

  test('no CODEOWNERS written without the flag', async () => {
    const name = makeName('co-default');
    const targetDir = path.resolve(process.cwd(), name);
    try {
      await runNew({
        command: 'new',
        name,
        template: 'go',
        owner: 'jml6m',
        auto: true,
        git: false,
      });
      expect(fs.existsSync(path.join(targetDir, '.github', 'CODEOWNERS'))).toBe(false);
    } finally {
      cleanup(targetDir);
    }
  });
});

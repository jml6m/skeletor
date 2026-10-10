import path from 'path';
import {
  LIMITS,
  checkFiles,
  exceedsCap,
  findAgentFiles,
  findForbiddenFiles,
  hasPointer,
  runCheck,
} from '../scripts/check-agent-file-length.mjs';

describe('exceedsCap', () => {
  test('passes at the cap and fails one character over', () => {
    expect(exceedsCap('a'.repeat(10), 10)).toBe(false);
    expect(exceedsCap('a'.repeat(11), 10)).toBe(true);
  });

  test('counts characters, not bytes', () => {
    // Three characters, nine UTF-8 bytes.
    expect(exceedsCap('✓✓✓', 3)).toBe(false);
  });
});

describe('hasPointer', () => {
  test('accepts @AGENTS.md as the first non-blank line', () => {
    expect(hasPointer('@AGENTS.md\n')).toBe(true);
    expect(hasPointer('\n\n  @AGENTS.md  \nextra line\n')).toBe(true);
  });

  test('rejects a missing or late pointer', () => {
    expect(hasPointer('')).toBe(false);
    expect(hasPointer('# Rules\n@AGENTS.md\n')).toBe(false);
    expect(hasPointer('See @AGENTS.md\n')).toBe(false);
  });
});

describe('findAgentFiles / findForbiddenFiles', () => {
  const present = (names) => (p) => names.includes(path.basename(p));

  test('returns only the files that exist at the root', () => {
    expect(findAgentFiles('/repo', { exists: present(['AGENTS.md']) })).toEqual(['AGENTS.md']);
    expect(findAgentFiles('/repo', { exists: present(['AGENTS.md', 'CLAUDE.md']) })).toEqual([
      'AGENTS.md',
      'CLAUDE.md',
    ]);
    expect(findAgentFiles('/repo', { exists: () => false })).toEqual([]);
  });

  test('looks up paths under the given cwd', () => {
    const seen = [];
    findAgentFiles('/repo', { exists: (p) => (seen.push(p), false) });
    expect(seen).toEqual([path.join('/repo', 'AGENTS.md'), path.join('/repo', 'CLAUDE.md')]);
  });

  test('reports forbidden files that exist', () => {
    expect(findForbiddenFiles('/repo', { exists: present(['GEMINI.md']) })).toEqual(['GEMINI.md']);
    expect(findForbiddenFiles('/repo', { exists: present(['.cursorrules', 'GEMINI.md']) })).toEqual([
      '.cursorrules',
      'GEMINI.md',
    ]);
    expect(findForbiddenFiles('/repo', { exists: () => false })).toEqual([]);
  });
});

describe('checkFiles', () => {
  const reader = (files) => (f) => files[f];

  test('passes files under their caps', () => {
    const { ok, results } = checkFiles(['AGENTS.md', 'CLAUDE.md'], {
      readFile: reader({ 'AGENTS.md': '# Rules\n', 'CLAUDE.md': '@AGENTS.md\n' }),
    });
    expect(ok).toBe(true);
    expect(results).toEqual([
      { file: 'AGENTS.md', chars: 8, max: LIMITS['AGENTS.md'], ok: true, reason: undefined },
      { file: 'CLAUDE.md', chars: 11, max: LIMITS['CLAUDE.md'], ok: true, reason: undefined },
    ]);
  });

  test('fails a file over its cap', () => {
    const { ok, results } = checkFiles(['AGENTS.md'], {
      readFile: reader({ 'AGENTS.md': 'a'.repeat(LIMITS['AGENTS.md'] + 1) }),
    });
    expect(ok).toBe(false);
    expect(results[0].ok).toBe(false);
    expect(results[0].reason).toMatch(/9,001 characters, over the 9,000-character cap/);
  });

  test('applies the tighter CLAUDE.md cap', () => {
    const { ok, results } = checkFiles(['CLAUDE.md'], {
      readFile: reader({ 'CLAUDE.md': `@AGENTS.md\n${'a'.repeat(LIMITS['CLAUDE.md'])}` }),
    });
    expect(ok).toBe(false);
    expect(results[0].reason).toMatch(/over the 1,500-character cap/);
  });

  test('fails a CLAUDE.md that does not open with the pointer', () => {
    const { ok, results } = checkFiles(['CLAUDE.md'], {
      readFile: reader({ 'CLAUDE.md': '# Claude rules\n' }),
    });
    expect(ok).toBe(false);
    expect(results[0].reason).toMatch(/must open with `@AGENTS\.md`/);
  });

  test('does not require the pointer in AGENTS.md', () => {
    const { ok } = checkFiles(['AGENTS.md'], { readFile: reader({ 'AGENTS.md': '# Rules\n' }) });
    expect(ok).toBe(true);
  });
});

describe('runCheck', () => {
  const realStdout = process.stdout.write;
  const realStderr = process.stderr.write;
  let stdout;
  let stderr;

  beforeEach(() => {
    stdout = [];
    stderr = [];
    process.stdout.write = (chunk) => stdout.push(String(chunk));
    process.stderr.write = (chunk) => stderr.push(String(chunk));
  });

  afterEach(() => {
    process.stdout.write = realStdout;
    process.stderr.write = realStderr;
    process.exitCode = undefined;
  });

  const passing = () => ({
    ok: true,
    results: [{ file: 'AGENTS.md', chars: 1200, max: 9000, ok: true }],
  });

  test('prints one ok line per file and leaves the exit code alone', () => {
    runCheck({ cwd: '/repo', find: () => ['AGENTS.md'], findForbidden: () => [], check: passing });
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toBe('ok    AGENTS.md: 1,200 / 9,000 characters\n');
    expect(stderr).toEqual([]);
    expect(process.exitCode).toBeUndefined();
  });

  test('fails on a file over its cap', () => {
    runCheck({
      cwd: '/repo',
      find: () => ['AGENTS.md'],
      findForbidden: () => [],
      check: () => ({
        ok: false,
        results: [{ file: 'AGENTS.md', chars: 9001, max: 9000, ok: false, reason: 'too long' }],
      }),
    });
    expect(stdout[0]).toBe('FAIL  AGENTS.md: too long\n');
    expect(stderr).toHaveLength(1);
    expect(process.exitCode).toBe(1);
  });

  test('fails when a forbidden file is present', () => {
    runCheck({
      cwd: '/repo',
      find: () => ['AGENTS.md'],
      findForbidden: () => ['GEMINI.md'],
      check: passing,
    });
    expect(stdout[0]).toContain('FAIL  GEMINI.md: forbidden');
    expect(process.exitCode).toBe(1);
  });
});

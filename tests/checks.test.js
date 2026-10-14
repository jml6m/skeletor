import { checkTokens, scaffoldChecks } from '../src/checks.js';

const tmpl = { verifyCommands: ['npm install', 'npm run lint', 'npm test'] };

describe('scaffoldChecks', () => {
  test('layer checks follow the template, and CI skips the install', () => {
    const checks = scaffoldChecks(tmpl, 'default', [{ verifyCommands: ['npm run audit:ci', 'npm test'] }, { gitVerifyCommands: ['npm run lint:encoding'] }]);
    expect(checks).toEqual({
      commands: ['npm install', 'npm run lint', 'npm test', 'npm run audit:ci'],
      needRepo: ['npm run lint:encoding'],
      ci: ['npm run lint', 'npm test', 'npm run audit:ci', 'npm run lint:encoding'],
    });
  });

  test("a layer's own workflow runs its checks instead of the CI job", () => {
    const checks = scaffoldChecks(tmpl, 'default', [{ verifyCommands: ['npm run lint:docs'], ciWorkflow: 'docs-lint.yml' }]);
    expect(checks.commands).toContain('npm run lint:docs');
    expect(checks.ci).not.toContain('npm run lint:docs');
  });

  test("a layout's verifyCommands replace the template's", () => {
    const python = { verifyCommands: ['uv sync', 'uv run mypy .'], layouts: { src: { verifyCommands: ['uv sync', 'uv run mypy src'] } } };
    expect(scaffoldChecks(python, 'src').ci).toEqual(['uv run mypy src']);
  });
});

describe('checkTokens', () => {
  test('one command per line, and one workflow step per CI check', () => {
    const tokens = checkTokens({ commands: ['npm install', 'npm test'], needRepo: ['npm run lint:encoding'], ci: ['npm test', 'cargo clippy -- -D warnings'] });
    expect(tokens.VERIFY_COMMANDS).toBe('npm install\nnpm test\nnpm run lint:encoding');
    expect(tokens.CI_CHECK_STEPS).toBe('      - run: npm test\n      - run: cargo clippy -- -D warnings');
  });

  test('quotes a command YAML would misread', () => {
    const { CI_CHECK_STEPS } = checkTokens({ commands: [], needRepo: [], ci: ['echo a: b', 'make # all', '*glob'] });
    expect(CI_CHECK_STEPS.split('\n')).toEqual(['      - run: "echo a: b"', '      - run: "make # all"', '      - run: "*glob"']);
  });
});

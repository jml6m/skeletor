import fs from 'fs';
import path from 'path';

/**
 * Feature → config fragment registry for manifest-driven .gitignore and tool configs.
 * Every template declares `features`, so this registry is the only source of a generated
 * .gitignore: templates ship no .gitignore file of their own.
 *
 * A `gitignore` fragment is a list of `{ heading, patterns }` sections. Sections with the same
 * heading merge, and a pattern already listed earlier is dropped.
 */

/** Appended after every template's feature sections. */
const BASE_GITIGNORE = [
  { heading: 'Env & secrets (.env.example is committed)', patterns: ['.env', '.env.*', '!.env.example'] },
  { heading: 'OS / editor', patterns: ['.DS_Store', 'Thumbs.db', '.idea/', '.vscode/', '*.swp'] },
];

const BUILD_OUTPUT = 'Build / output';

export const FEATURE_REGISTRY = {
  node: {
    gitignore: [
      { heading: 'Dependencies', patterns: ['node_modules/'] },
      { heading: BUILD_OUTPUT, patterns: ['dist/', 'build/'] },
      { heading: 'Local overrides', patterns: ['*.local'] },
      { heading: 'Logs', patterns: ['*.log', 'logs/'] },
    ],
  },
  jest: {
    gitignore: [{ heading: 'Coverage & reports', patterns: ['coverage/', 'report/', 'reports/'] }],
  },
  prettier: { gitignore: [] },
  eslint: { gitignore: [] },
  husky: { gitignore: [] },
  knip: { gitignore: [] },
  jscpd: { gitignore: [{ heading: 'Coverage & reports', patterns: ['report/', 'reports/', '.jscpd/'] }] },
  madge: { gitignore: [] },
  python: {
    gitignore: [
      { heading: 'Bytecode / cache', patterns: ['__pycache__/', '*.py[cod]', '.pytest_cache/', '.mypy_cache/', '.ruff_cache/'] },
      { heading: 'Virtual environments', patterns: ['.venv/', 'venv/', 'env/'] },
      { heading: 'Build / packaging', patterns: ['dist/', 'build/', '*.egg-info/'] },
      { heading: 'Coverage', patterns: ['.coverage', 'htmlcov/'] },
    ],
  },
  go: {
    gitignore: [
      { heading: 'Binaries', patterns: ['/{{PROJECT_NAME}}', '*.exe', '*.exe~', '*.dll', '*.so', '*.dylib'] },
      { heading: 'Test binaries', patterns: ['*.test'] },
      { heading: BUILD_OUTPUT, patterns: ['bin/', 'dist/'] },
      { heading: 'Vendored modules', patterns: ['vendor/'] },
    ],
  },
  rust: {
    gitignore: [
      { heading: BUILD_OUTPUT, patterns: ['/target/'] },
      { heading: 'rustfmt backups & debug symbols', patterns: ['**/*.rs.bk', '*.pdb'] },
    ],
  },
  java: {
    gitignore: [
      { heading: BUILD_OUTPUT, patterns: ['target/'] },
      { heading: 'Compiled classes & archives', patterns: ['*.class', '*.jar', '*.war', '*.ear'] },
      { heading: 'JVM crash logs', patterns: ['hs_err_pid*'] },
    ],
  },
  dotnet: {
    gitignore: [
      { heading: BUILD_OUTPUT, patterns: ['bin/', 'obj/', 'TestResults/'] },
      { heading: 'Visual Studio user files', patterns: ['*.user', '*.suo', '*.userosscache', '*.sln.docstates'] },
    ],
  },
};

/** Ordered rules: first match wins (avoids false positives like "cargo test" matching "go test"). */
export const VERIFY_COMMAND_RULES = [
  { test: (cmd) => cmd.startsWith('npm install'), features: ['node'] },
  { test: (cmd) => cmd.includes('npm run format'), features: ['prettier'] },
  { test: (cmd) => cmd.includes('npm run lint'), features: ['eslint'] },
  { test: (cmd) => cmd.startsWith('npm test'), features: ['jest'] },
  { test: (cmd) => cmd.includes('npm run build'), features: ['node'] },
  { test: (cmd) => cmd.includes('npm run health:dead'), features: ['knip'] },
  { test: (cmd) => cmd.includes('npm run health:circular'), features: ['madge'] },
  { test: (cmd) => cmd.startsWith('uv '), features: ['python'] },
  { test: (cmd) => cmd.includes('ruff'), features: ['python'] },
  { test: (cmd) => cmd.includes('pytest'), features: ['python'] },
  { test: (cmd) => cmd.includes('mypy'), features: ['python'] },
  { test: (cmd) => cmd.startsWith('go mod'), features: ['go'] },
  { test: (cmd) => cmd.startsWith('go build'), features: ['go'] },
  { test: (cmd) => cmd.startsWith('go test'), features: ['go'] },
  { test: (cmd) => cmd.startsWith('cargo fmt'), features: ['rust'] },
  { test: (cmd) => cmd.startsWith('cargo clippy'), features: ['rust'] },
  { test: (cmd) => cmd.startsWith('cargo check'), features: ['rust'] },
  { test: (cmd) => cmd.startsWith('cargo test'), features: ['rust'] },
  { test: (cmd) => cmd.startsWith('mvn'), features: ['java'] },
  { test: (cmd) => cmd.startsWith('dotnet'), features: ['dotnet'] },
];

/**
 * @param {string[]} features
 * @param {Record<string, string|number>} [vars] values for `{{TOKEN}}` placeholders in fragments
 * @returns {string}
 */
export function buildGitignore(features, vars = {}) {
  const fill = (text) => text.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  const sections = new Map();
  const seen = new Set();
  const fragments = [...features.flatMap((feature) => FEATURE_REGISTRY[feature]?.gitignore || []), ...BASE_GITIGNORE];
  for (const { heading, patterns } of fragments) {
    const title = fill(heading);
    if (!sections.has(title)) sections.set(title, []);
    for (const pattern of patterns.map(fill)) {
      if (seen.has(pattern)) continue;
      seen.add(pattern);
      sections.get(title).push(pattern);
    }
  }
  const blocks = [...sections].filter(([, patterns]) => patterns.length).map(([title, patterns]) => [`# ${title}`, ...patterns].join('\n'));
  return `${['# Generated by skeletor from template features', ...blocks].join('\n\n')}\n`;
}

/**
 * @param {string[]} features
 * @param {{ language?: string }} templateInfo
 */
export function buildKnipConfig(features, templateInfo) {
  if (!features.includes('knip')) return null;
  const isTs = templateInfo.language === 'typescript';
  const ext = isTs ? 'ts' : 'js';
  return {
    $schema: 'https://unpkg.com/knip@6/schema.json',
    // JS: package.json `main` already makes src/index.js an entry, and knip flags a repeat as redundant.
    ...(isTs ? { entry: ['src/index.ts'] } : {}),
    project: [`src/**/*.${ext}`, `tests/**/*.${ext}`],
    ignoreExportsUsedInFile: true,
  };
}

/**
 * @param {string[]} features
 * @param {{ language?: string }} templateInfo
 */
export function buildJscpdConfig(features, templateInfo) {
  if (!features.includes('jscpd')) return null;
  const isTs = templateInfo.language === 'typescript';
  const testGlob = isTs ? '**/*.test.ts' : '**/*.test.js';
  const specGlob = isTs ? '**/*.spec.ts' : '**/*.spec.js';
  const langKey = isTs ? 'typescript' : 'javascript';
  const exts = isTs ? ['ts', 'tsx'] : ['js', 'jsx'];
  // A report, not a gate: no threshold, so it never fails.
  return {
    reporters: ['html', 'console'],
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', specGlob, testGlob],
    absolute: true,
    gitignore: true,
    minLines: 5,
    minTokens: 50,
    formatsExts: { [langKey]: exts },
  };
}

/**
 * @param {{ features?: string[], verifyCommands?: string[], id?: string }} templateInfo
 * @returns {string[]}
 */
export function validateTemplateFeatures(templateInfo) {
  const errors = [];
  const features = templateInfo.features;
  if (!Array.isArray(features) || features.length === 0) return errors;

  for (const feature of features) {
    if (!FEATURE_REGISTRY[feature]) {
      errors.push(`Template "${templateInfo.id}": unknown feature "${feature}"`);
    }
  }

  for (const cmd of templateInfo.verifyCommands || []) {
    const rule = VERIFY_COMMAND_RULES.find((r) => r.test(cmd));
    if (!rule) continue;
    for (const feat of rule.features) {
      if (!features.includes(feat)) {
        errors.push(
          `Template "${templateInfo.id}": verifyCommand "${cmd}" requires feature "${feat}"`,
        );
      }
    }
  }

  return errors;
}

/**
 * @param {string} targetDir
 * @returns {Record<string, string[]> | null}
 */
function readJsconfigPaths(targetDir) {
  const jsconfigPath = path.join(targetDir, 'jsconfig.json');
  if (!fs.existsSync(jsconfigPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsconfigPath, 'utf8')).compilerOptions?.paths || null;
  } catch {
    return null;
  }
}

/**
 * Write manifest-driven config files into a generated project.
 * @param {string} targetDir
 * @param {{ features?: string[], language?: string }} templateInfo
 * @param {Record<string, string|number>} [vars]
 */
export function applyFeatureConfigs(targetDir, templateInfo, vars = {}) {
  const features = templateInfo.features;
  if (!Array.isArray(features) || features.length === 0) return;

  fs.writeFileSync(path.join(targetDir, '.gitignore'), buildGitignore(features, vars), 'utf8');

  const knip = buildKnipConfig(features, templateInfo);
  if (knip) {
    // knip can't follow module-alias at runtime, but it does honour the same `paths` map jsconfig declares.
    const aliasPaths = readJsconfigPaths(targetDir);
    if (aliasPaths) knip.paths = aliasPaths;
    fs.writeFileSync(path.join(targetDir, 'knip.json'), `${JSON.stringify(knip, null, 2)}\n`, 'utf8');
  }

  const jscpd = buildJscpdConfig(features, templateInfo);
  if (jscpd) {
    fs.writeFileSync(path.join(targetDir, '.jscpd.json'), `${JSON.stringify(jscpd, null, 2)}\n`, 'utf8');
  }
}
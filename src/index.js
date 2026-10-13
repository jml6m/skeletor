#!/usr/bin/env node
/**
 * Skeletor — multi-language project scaffolding
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import * as p from '@clack/prompts';
import { detectGithubOwners } from './detect-owner.js';
import {
  promptConfirmRecommended,
  promptMultiSelectRecommended,
  promptSelectRecommended,
  promptOwnerSelect,
} from './interactive-prompts.js';
import { applyFeatureConfigs } from './features.js';
import { checkTokens, scaffoldChecks } from './checks.js';
import {
  loadPinnedVersions,
  validatePinnedVersionsManifest,
  buildPinTokens,
  checkTemplateGenerationAllowed,
} from './pinned-versions.js';
import {
  applyLayers,
  expandBundle,
  layerAppliesTo,
  getLayersWithManifests,
  loadBundles,
  loadLayerById,
  resolveLayerOrder,
  labelCreateCommand,
  validateLayerManifests,
  writeDocsPolicyAllowlist,
} from './layers.js';
import { escaperForFile, normalizeDescription } from './escape.js';
import { appendReadmeLicense, pyprojectLicense, removeSpdxLicenseFields, resolveLicense, UNLICENSED } from './license.js';
import { suggestProjectName, validateGithubOwner, validateProjectName } from './validate-input.js';
import { parseArgs, UsageError } from './args.js';
import { unknownIdMessage } from './suggest.js';
import { collectPullRequestChecks, githubSetupLines } from './github-setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const SHARED_TEMPLATES_DIR = path.join(TEMPLATES_DIR, '_shared');
const SKELETOR_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const USAGE = `
💀 skeletor — pick your scaffolding

Usage:
  skeletor new <name> [options]
  skeletor --help | -h
  skeletor --version | -v

  <name> is lowercase kebab-case, starting with a letter (e.g. my-api), at most 64 characters.

new options:
  -t, --template <name>     Stack to scaffold (javascript, typescript, python, go, …)
  --layout <name>           Template layout: rust single|lib|workspace, python flat|src
  --with <id[,id...]>       Feature layers to add, repeatable (baseline layers always apply)
  --bundle <name>           Named feature-layer preset (listed below)
  -o, --owner <user>        GitHub owner/org (skips auto-detection)
  -d, --description <text>  Project description (optional)
  --auto                    Non-interactive; requires --template (or a --bundle, which names one).
                            Without a terminal, --auto is required.
  --no-git                  Skip git init
  --github                  Create GitHub remote via gh CLI (after git init)
  --private                 Use --private with --github (default: public)
  --allow-deprecated-template
                            Allow scaffolding templates marked deprecated in pinned-versions.json

Unknown options are rejected. Value options also accept --option=value.

Fixed defaults (not prompted): pinned Python and .NET versions, uv for Python dependencies,
Maven groupId io.github.<owner>, port 3000 (override with PORT), logs/ for log files,
initial branch main.
License: UNLICENSED unless --github creates a public repo, which is asked (MIT under --auto),
or library-publishing is applied (MIT).

Examples:
  skeletor new my-api --template typescript
  skeletor new my-api --template typescript --with zod-config,logger-winston
  skeletor new my-lib --auto --template typescript --bundle ts-library
  skeletor new my-app --auto --template rust --layout workspace
`;

function log(msg) { console.log(msg); }
function logError(msg) { console.error(msg); }

// One pass, so a value containing "{{TOKEN}}" or "$&" is inserted literally.
function render(content, vars) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => (Object.hasOwn(vars, key) ? String(vars[key]) : match));
}

function varsForFile(filePath, vars) {
  const escape = escaperForFile(filePath);
  if (!escape || !Object.hasOwn(vars, 'DESCRIPTION')) return vars;
  return { ...vars, DESCRIPTION: escape(String(vars.DESCRIPTION)) };
}

function renderPathSegment(segment, vars) {
  let out = segment.endsWith('.tmpl') ? segment.slice(0, -'.tmpl'.length) : segment;
  return render(out, vars);
}

const JAVA_KEYWORDS = new Set(
  ('abstract assert boolean break byte case catch char class const continue default do double else enum ' +
    'extends false final finally float for goto if implements import instanceof int interface long native new ' +
    'null package private protected public return short static strictfp super switch synchronized this throw ' +
    'throws transient true try void volatile while').split(' '),
);

// A Java package segment from the owner: a keyword gets a trailing "_", a leading digit a leading "_" (JLS 6.1).
function sanitizeIdentifierSegment(value) {
  const segment = String(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'example';
  if (JAVA_KEYWORDS.has(segment)) return `${segment}_`;
  return /^[0-9]/.test(segment) ? `_${segment}` : segment;
}

const DEPENDABOT_ECOSYSTEM_BY_LANGUAGE = {
  javascript: 'npm',
  typescript: 'npm',
  python: 'uv',
  go: 'gomod',
  rust: 'cargo',
  java: 'maven',
  csharp: 'nuget',
};

function dependabotEcosystemFor(language) {
  return DEPENDABOT_ECOSYSTEM_BY_LANGUAGE[language] || 'npm';
}

// Majors a grouped PR would otherwise propose before the rest of the toolchain supports them
// (e.g. a TypeScript major typescript-eslint rejects with ERESOLVE); @types/node tracks engines.node.
const NPM_HELD_MAJORS = ['typescript', '@types/node', 'eslint', '@eslint/js'];

function dependabotIgnoreFor(ecosystem) {
  if (ecosystem !== 'npm') return '';
  const entries = NPM_HELD_MAJORS.map(
    (dep) => `      - dependency-name: "${dep}"\n        update-types: ["version-update:semver-major"]`,
  );
  return ['', '    # Majors need a deliberate toolchain bump, not a grouped Dependabot PR.', '    ignore:', ...entries].join('\n');
}

function buildRenderVars({ name, owner, description, extra = {} }) {
  if (!owner) {
    throw new Error('owner is required');
  }
  const repoOwner = owner;
  const ownerSegment = sanitizeIdentifierSegment(repoOwner);
  // NAMESPACE is the Rust crate identifier; C# namespaces are PascalCase (my-app → MyApp).
  const namespace = String(name).replace(/-/g, '_');
  const csharpNamespace = String(name).replace(/(?:^|-)([a-z0-9])/g, (_, c) => c.toUpperCase());
  const javaPackage = `io.github.${ownerSegment}`;
  const vars = {
    PROJECT_NAME: name,
    REPO_OWNER: repoOwner,
    REPO_NAME: name,
    DESCRIPTION: normalizeDescription(description) || DEFAULT_DESCRIPTION,
    YEAR: new Date().getFullYear(),
    NAMESPACE: namespace,
    CSHARP_NAMESPACE: csharpNamespace,
    GROUP_ID: javaPackage,
    JAVA_PACKAGE: javaPackage,
    JAVA_PACKAGE_PATH: javaPackage.replace(/\./g, '/'),
    GO_MODULE: `github.com/${repoOwner}/${name}`,
    REPO_URL: `https://github.com/${repoOwner}/${name}`,
    LICENSE: UNLICENSED,
    AGENTS_BUILD_AND_TEST: '',
    ...extra,
  };
  return { ...vars, PYPROJECT_LICENSE: pyprojectLicense(vars.LICENSE) };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const SKELETOR_METADATA_FILES = new Set(['template.json', 'layer.json', 'pinned-versions.json', 'AGENTS.snippet.md']);

function copyAndRender(src, dest, vars) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'node_modules' || entry === '.git' || SKELETOR_METADATA_FILES.has(entry)) continue;
      const outEntry = renderPathSegment(entry, vars);
      copyAndRender(path.join(src, entry), path.join(dest, outEntry), vars);
    }
    return;
  }
  let content = fs.readFileSync(src, 'utf8');
  content = render(content, varsForFile(dest, vars));
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, 'utf8');
}

function getAvailableTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR).filter((d) => {
    if (d.startsWith('_')) return false;
    const p = path.join(TEMPLATES_DIR, d);
    return fs.statSync(p).isDirectory();
  });
}

function loadTemplateManifest(templateId) {
  const dir = path.join(TEMPLATES_DIR, templateId);
  const manifestPath = path.join(dir, 'template.json');
  let manifest = {
    id: templateId,
    name: templateId,
    description: 'A custom template.',
    language: templateId,
    verifyCommands: [],
  };
  if (fs.existsSync(manifestPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest = { ...manifest, ...raw };
    } catch {
      // fall back
    }
  }
  return { ...manifest, dir };
}

function getTemplatesWithManifests() {
  return getAvailableTemplates().map((id) => loadTemplateManifest(id));
}

function resolveTemplateLayout(templateInfo, layout) {
  const layoutError = checkLayout(templateInfo, layout);
  if (layoutError) throw new Error(layoutError);
  const layouts = templateInfo.layouts;
  if (!layouts) return { layoutId: 'default', sourceDir: templateInfo.dir };
  const layoutId = layout || templateInfo.defaultLayout || Object.keys(layouts)[0];
  return { layoutId, sourceDir: path.join(templateInfo.dir, layouts[layoutId].dir) };
}

/** A message when `layout` isn't one of the template's layouts (or the template has none), else null. */
function checkLayout(templateInfo, layout) {
  if (!layout) return null;
  const layouts = Object.keys(templateInfo.layouts || {});
  if (!layouts.length) {
    const withLayouts = getTemplatesWithManifests()
      .filter((t) => t.layouts)
      .map((t) => `${t.id} (${Object.keys(t.layouts).join(', ')})`);
    return `--layout doesn't apply to ${templateInfo.id}, which has one layout. Templates with layouts: ${withLayouts.join(', ')}.`;
  }
  if (layouts.includes(layout)) return null;
  return unknownIdMessage('layout', layout, layouts, { label: `Layouts for ${templateInfo.id}` });
}

/** `templateVars` carries the scaffold's check tokens (checkTokens); without them, the template's own checks fill them in. */
function copyTemplateToProject(templateInfo, targetDir, templateVars, layout) {
  const { layoutId, sourceDir } = resolveTemplateLayout(templateInfo, layout);
  const vars = 'VERIFY_COMMANDS' in templateVars ? templateVars : { ...templateVars, ...checkTokens(scaffoldChecks(templateInfo, layoutId)) };
  copyAndRender(sourceDir, targetDir, vars);

  const shared = ['AGENTS.md', 'CLAUDE.md', 'README.md'];
  for (const file of shared) {
    const dest = path.join(targetDir, file);
    if (fs.existsSync(dest)) continue;
    const templateSrc = path.join(templateInfo.dir, file);
    const globalSrc = path.join(SHARED_TEMPLATES_DIR, file);
    const src = fs.existsSync(templateSrc) ? templateSrc : fs.existsSync(globalSrc) ? globalSrc : null;
    if (src) copyAndRender(src, dest, vars);
  }

  insertTemplateAgentsSection(path.join(targetDir, 'AGENTS.md'), path.join(templateInfo.dir, 'AGENTS.snippet.md'), vars);

  const sharedDirs = ['.github'];
  for (const dir of sharedDirs) {
    const src = path.join(templateInfo.dir, dir);
    const dest = path.join(targetDir, dir);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      copyAndRender(src, dest, vars);
    }
  }

  if (Array.isArray(templateInfo.features) && templateInfo.features.length > 0) {
    applyFeatureConfigs(targetDir, templateInfo, vars);
  }

  if (templateInfo.language === 'python') {
    const pyVersionPath = path.join(targetDir, '.python-version');
    if (!fs.existsSync(pyVersionPath)) {
      fs.writeFileSync(pyVersionPath, `${vars.PIN_RUNTIME_PYTHON}\n`, 'utf8');
    }
  }

  return layoutId;
}

/**
 * A template's AGENTS.snippet.md holds its own AGENTS.md sections (e.g. code conventions); they go
 * right after "Build & Test", ahead of the shared sections and anything layers append.
 */
function insertTemplateAgentsSection(agentsPath, snippetPath, vars) {
  if (!fs.existsSync(snippetPath) || !fs.existsSync(agentsPath)) return;
  const section = render(fs.readFileSync(snippetPath, 'utf8'), vars).trim();
  const content = fs.readFileSync(agentsPath, 'utf8');
  const buildAndTest = content.indexOf('\n## Build & Test');
  const next = buildAndTest === -1 ? -1 : content.indexOf('\n## ', buildAndTest + 1);
  const updated = next === -1
    ? `${content.trimEnd()}\n\n${section}\n`
    : `${content.slice(0, next + 1)}${section}\n\n${content.slice(next + 1)}`;
  fs.writeFileSync(agentsPath, updated, 'utf8');
}

/** Writes LICENSE (none for UNLICENSED, which grants nothing) and keeps manifests and README in step. */
function applyLicense(targetDir, vars) {
  if (vars.LICENSE === UNLICENSED) {
    removeSpdxLicenseFields(targetDir);
  } else {
    copyAndRender(path.join(SHARED_TEMPLATES_DIR, 'licenses', `${vars.LICENSE}.txt`), path.join(targetDir, 'LICENSE'), vars);
  }
  appendReadmeLicense(targetDir, vars.LICENSE);
}

/** Layers every scaffold of the template gets (template.json `baselineLayers`). */
function getBaselineLayers(templateInfo) {
  return Array.isArray(templateInfo?.baselineLayers) ? templateInfo.baselineLayers : [];
}

/** Opt-in layers for the template: every layer that applies to it and is not in its baseline. */
function getFeatureLayers(templateInfo) {
  const baseline = getBaselineLayers(templateInfo);
  const ctx = { template: templateInfo.id, language: templateInfo.language || templateInfo.id };
  return getLayersWithManifests().filter((l) => layerAppliesTo(l, ctx) && !baseline.includes(l.id));
}

/**
 * Checks the options that depend on the chosen template: --layout, --with and --bundle.
 * @returns {string | null} a message for the user, or null when they fit
 */
function checkTemplateOptions(opts, templateInfo) {
  const layoutError = checkLayout(templateInfo, opts.layout);
  if (layoutError) return layoutError;

  if (opts.bundle) {
    const bundle = loadBundles()[opts.bundle];
    if (bundle?.template && bundle.template !== templateInfo.id) {
      return `Bundle "${opts.bundle}" is for the ${bundle.template} template, not ${templateInfo.id}: drop --template or pick another bundle.`;
    }
  }

  const ctx = { template: templateInfo.id, language: templateInfo.language || templateInfo.id };
  const allLayers = getLayersWithManifests();
  const featureIds = getFeatureLayers(templateInfo).map((l) => l.id);
  for (const id of opts.withLayers || []) {
    const layer = allLayers.find((l) => l.id === id);
    if (!layer) {
      return unknownIdMessage('layer', id, allLayers.map((l) => l.id), { label: `Feature layers for ${templateInfo.id}`, list: featureIds });
    }
    if (!layerAppliesTo(layer, ctx)) {
      return `Layer "${id}" doesn't apply to ${templateInfo.id}.\n   Feature layers for ${templateInfo.id}: ${featureIds.join(', ') || '(none)'}`;
    }
  }
  return null;
}

function fail(message) {
  logError(`❌ ${message}`);
  process.exit(1);
}

function collectLayerIds(opts, templateInfo) {
  const info = typeof templateInfo === 'string'
    ? getTemplatesWithManifests().find((t) => t.id === templateInfo)
    : templateInfo;
  const ids = [...getBaselineLayers(info), ...(opts.withLayers || [])];
  if (opts.bundle) {
    ids.push(...expandBundle(opts.bundle, info?.id));
  }
  return [...new Set(ids)];
}

async function chooseTemplateInteractively(templates) {
  if (templates.length === 0) return null;
  p.intro('💀 Skeletor — pick your scaffolding');
  const options = templates.map((t) => ({
    value: t.id,
    label: t.name,
    hint: t.description.length > 60 ? t.description.slice(0, 57) + '...' : t.description,
  }));
  const selected = await p.select({
    message: 'What language or stack are you building?',
    options,
  });
  if (p.isCancel(selected)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return selected;
}

const DEFAULT_DESCRIPTION = 'A skeletor project.';
async function resolveOwnerForNew(opts, isInteractive) {
  if (opts.owner?.trim()) {
    const ownerError = validateGithubOwner(opts.owner);
    if (ownerError) {
      logError(`❌ ${ownerError}`);
      process.exit(1);
    }
    return opts.owner.trim();
  }

  const candidates = detectGithubOwners(process.cwd());

  if (isInteractive) {
    const answer = await promptOwnerSelect({
      message: 'GitHub owner / org',
      candidates,
    });
    if (p.isCancel(answer)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    return String(answer).trim();
  }

  if (candidates.length === 0) {
    logError('❌ --auto requires --owner when GitHub owner cannot be detected.');
    logError('   Detection checks git remote origin, package.json repository, and gh CLI.');
    process.exit(1);
  }

  return candidates[0].owner;
}

/**
 * Interactive runs re-prompt for an invalid name, prefilled with a suggestion; other runs exit 1.
 */
async function resolveProjectName(name, isInteractive) {
  const error = validateProjectName(name);
  if (!error) return name;
  if (!isInteractive) {
    logError(`❌ ${error}`);
    process.exit(1);
  }
  if (name) p.log.error(error);
  const answer = await p.text({
    message: 'Project name',
    placeholder: 'my-app',
    initialValue: name ? suggestProjectName(name) : undefined,
    validate: (value) => validateProjectName(value) ?? undefined,
  });
  if (p.isCancel(answer)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  return answer;
}

async function runNew(opts) {
  const { git, auto } = opts;
  const isInteractive = !auto && process.stdout.isTTY;
  const name = await resolveProjectName(opts.name, isInteractive);

  const allTemplates = getTemplatesWithManifests();
  if (allTemplates.length === 0) fail('No templates found in templates/ directory.');
  const templateIds = allTemplates.map((t) => t.id);
  if (opts.template && !templateIds.includes(opts.template)) {
    fail(unknownIdMessage('template', opts.template, templateIds, { label: 'Templates' }));
  }

  let chosenTemplateId = opts.template;
  if (opts.bundle) {
    const bundles = loadBundles();
    if (!Object.hasOwn(bundles, opts.bundle)) {
      fail(unknownIdMessage('bundle', opts.bundle, Object.keys(bundles), { label: 'Bundles' }));
    }
    chosenTemplateId ||= bundles[opts.bundle].template;
  }
  let finalOwner = await resolveOwnerForNew(opts, isInteractive);
  const finalDesc = opts.description || DEFAULT_DESCRIPTION;

  if (!chosenTemplateId) {
    if (auto) {
      logError('❌ --auto requires --template <id> or --bundle <name>.');
      process.exit(1);
    }
    if (!process.stdout.isTTY) {
      logError('❌ No --template provided and this is not an interactive terminal.');
      process.exit(1);
    }
    chosenTemplateId = await chooseTemplateInteractively(allTemplates);
  } else if (!process.stdout.isTTY && !auto) {
    logError('❌ --template requires --auto when not running in an interactive terminal.');
    process.exit(1);
  }

  const templateInfo = allTemplates.find((t) => t.id === chosenTemplateId);
  if (!templateInfo) fail(unknownIdMessage('template', chosenTemplateId, templateIds, { label: 'Templates' }));
  const optionsError = checkTemplateOptions(opts, templateInfo);
  if (optionsError) fail(optionsError);

  const pinned = loadPinnedVersions(templateInfo.dir);
  const pinManifestErrors = validatePinnedVersionsManifest(pinned, chosenTemplateId);
  if (pinManifestErrors.length) {
    logError(`❌ Pin manifest error: ${pinManifestErrors.join('; ')}`);
    process.exit(1);
  }

  const pinStatus = checkTemplateGenerationAllowed(pinned, {
    allowDeprecatedTemplate: opts.allowDeprecatedTemplate,
  });
  if (pinStatus.blocked) {
    logError(`❌ ${pinStatus.message}`);
    process.exit(1);
  }
  if (pinStatus.warn) {
    p.log.warn(pinStatus.warn);
  }

  if (isInteractive && !opts.withLayers?.length && !opts.bundle) {
    const featureLayers = getFeatureLayers(templateInfo);
    if (featureLayers.length) {
      const picked = await promptMultiSelectRecommended({
        message: 'Add feature layers? (space to toggle, enter for none)',
        options: featureLayers.map((l) => ({ value: l.id, label: l.id, hint: l.name })),
      });
      if (p.isCancel(picked)) { p.cancel('Cancelled.'); process.exit(0); }
      opts.withLayers = picked;
    }
  }

  const layerIds = collectLayerIds(opts, templateInfo);
  const { order: layerOrder, errors: layerErrors } = resolveLayerOrder(layerIds, {
    template: chosenTemplateId,
    language: templateInfo.language || chosenTemplateId,
  });
  if (layerErrors.length) {
    logError(`❌ Layer configuration error: ${layerErrors.join('; ')}`);
    process.exit(1);
  }

  const license = await resolveLicense(opts, isInteractive, layerOrder);
  if (p.isCancel(license)) { p.cancel('Cancelled.'); process.exit(0); }

  let chosenLayout = opts.layout;
  if (isInteractive && templateInfo.layouts && !chosenLayout) {
    const layoutIds = Object.keys(templateInfo.layouts);
    const picked = await promptSelectRecommended({
      message: 'Project layout',
      options: layoutIds,
      recommended: templateInfo.defaultLayout || layoutIds[0],
      allowCustom: false,
    });
    if (p.isCancel(picked)) { p.cancel('Cancelled.'); process.exit(0); }
    chosenLayout = picked;
  }

  if (isInteractive) {
    const featureCount = layerIds.length - getBaselineLayers(templateInfo).length;
    const layerNote = featureCount > 0 ? ` + ${featureCount} feature layer(s)` : '';
    const shouldContinue = await promptConfirmRecommended({
      message: `Scaffold "${name}" as ${templateInfo.name}${layerNote}?`,
      recommended: true,
    });
    if (p.isCancel(shouldContinue) || !shouldContinue) {
      p.cancel('Scaffolding cancelled.');
      process.exit(0);
    }
  }

  const targetDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    logError(`❌ Target directory "${name}" already exists and is not empty.`);
    process.exit(1);
  }

  const pinTokens = buildPinTokens(pinned, templateInfo);

  const dependabotEcosystem = dependabotEcosystemFor(templateInfo.language || chosenTemplateId);
  // checkTemplateOptions has validated the layout.
  const checks = scaffoldChecks(templateInfo, resolveTemplateLayout(templateInfo, chosenLayout).layoutId, layerOrder.map(loadLayerById));
  const vars = buildRenderVars({
    name,
    owner: finalOwner,
    description: finalDesc,
    extra: {
      ...(templateInfo.agentsBuildAndTest ? { AGENTS_BUILD_AND_TEST: `\n\n${templateInfo.agentsBuildAndTest}` } : {}),
      LICENSE: license,
      ...pinTokens,
      DEPENDABOT_ECOSYSTEM: dependabotEcosystem,
      DEPENDABOT_IGNORE: dependabotIgnoreFor(dependabotEcosystem),
      ...checkTokens(checks),
    },
  });
  p.log.info(`Creating "${name}" using ${templateInfo.name}...`);

  try {
    copyTemplateToProject(templateInfo, targetDir, vars, chosenLayout);
  } catch (e) {
    logError(`❌ ${e.message}`);
    process.exit(1);
  }
  applyLicense(targetDir, vars);

  let repoLabels = [];

  if (layerIds.length) {
    p.log.info(`Applying layers: ${layerIds.join(', ')}`);
    const result = applyLayers({
      projectDir: targetDir,
      layerIds,
      vars,
      template: chosenTemplateId,
      force: false,
      noInstall: true,
    });
    if (!result.ok) {
      logError(`❌ Layer apply failed: ${result.errors.join('; ')}`);
      process.exit(1);
    }
    repoLabels = result.labels || [];
    if (result.applied?.includes('docs-policy')) writeDocsPolicyAllowlist(targetDir);
    if (result.autoAdded?.length) {
      p.log.info(`Auto-added required layers: ${result.autoAdded.join(', ')}`);
    }
  }

  let hasRepo = false;
  let repoCreated = false;
  if (git) {
    try {
      const env = gitEnv();
      const run = (args) => execFileSync('git', args, { cwd: targetDir, env, stdio: 'ignore' });
      run(['init', '-q', '-b', 'main']);
      run(['add', '-A']);
      hasRepo = true;
      run(['commit', '-q', '-m', 'chore: initial commit from skeletor']);
      p.log.success('Git repository initialized');
      if (opts.github) {
        repoCreated = createGithubRemote(targetDir, name, finalOwner, opts.githubPrivate, repoLabels, env);
      }
    } catch {
      p.log.warn('Git init skipped (git not available or failed)');
    }
  }

  if (!opts.github && repoLabels.length) {
    p.log.info(labelHint(repoLabels));
  }

  p.outro('✅ Done!');
  // Only once --github has created the repository they apply to.
  const githubSetup = repoCreated ? githubSetupLines({ repo: `${finalOwner}/${name}`, ...collectPullRequestChecks(targetDir) }) : [];
  printPostScaffoldSteps(
    name,
    hasRepo ? [...checks.commands, ...checks.needRepo] : checks.commands,
    hasRepo ? [] : checks.needRepo,
    githubSetup,
  );
}

/** The labels applied layers expect, with the commands that create them when --github didn't. */
function labelHint(labels) {
  const unique = [...new Map(labels.map((l) => [l.name, l])).values()];
  const commands = unique.map((l) => `  ${labelCreateCommand(l)}`);
  const names = unique.map((l) => l.name).join(', ');
  return [`Layers expect these labels on GitHub: ${names}. --github creates them; otherwise run:`, ...commands].join('\n');
}

/**
 * process.env without git's repository-local variables (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...).
 * Git exports them to hooks and aliases; inherited, they would point the scaffold's git commands
 * at that repository instead of the new project.
 */
function gitEnv() {
  const env = { ...process.env };
  const names = execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
  for (const varName of names.split('\n')) if (varName) delete env[varName];
  return env;
}

function createGithubRemote(targetDir, name, owner, isPrivate, labels, env) {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' });
  } catch {
    p.log.warn('gh CLI not available — skipping --github remote creation');
    return false;
  }
  const visibility = isPrivate ? '--private' : '--public';
  try {
    execFileSync('gh', ['repo', 'create', `${owner}/${name}`, visibility, '--source=.', '--remote=origin'], {
      cwd: targetDir,
      env,
      stdio: 'pipe',
    });
    p.log.success(`GitHub remote created: ${owner}/${name}`);
    try {
      execFileSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: targetDir, env, stdio: 'pipe' });
      p.log.success('Initial commit pushed to origin');
    } catch {
      p.log.warn('Remote created but push failed — run: git push -u origin HEAD');
    }
    seedGithubLabels(targetDir, `${owner}/${name}`, labels, env);
    return true;
  } catch (e) {
    const msg = e.stderr?.toString() || e.message || String(e);
    p.log.warn(`gh repo create failed: ${msg.trim()}`);
    return false;
  }
}

/**
 * Creates the labels applied layers declare (e.g. `epic`, `chore`). `--force` keeps it idempotent.
 * @param {string} targetDir
 * @param {string} repo
 * @param {{ name: string, color: string, description?: string }[]} labels
 * @param {NodeJS.ProcessEnv} env
 */
function seedGithubLabels(targetDir, repo, labels, env) {
  for (const label of labels) {
    try {
      execFileSync(
        'gh',
        ['label', 'create', label.name, '--color', label.color, '--description', label.description || '', '--force', '-R', repo],
        { cwd: targetDir, env, stdio: 'pipe' },
      );
      p.log.success(`Label ready: ${label.name}`);
    } catch {
      p.log.warn(`Could not create label "${label.name}" — run: gh label create ${label.name} --color ${label.color}`);
    }
  }
}

/**
 * @param {string} projectName
 * @param {string[]} verifyCommands commands that work in the generated project as it is
 * @param {string[]} [needRepo] commands that need a git repository, for a scaffold without one
 * @param {string[]} [githubSetup] the one-time GitHub settings, after --github created the repository
 */
function printPostScaffoldSteps(projectName, verifyCommands, needRepo = [], githubSetup = []) {
  console.log(`   cd ${projectName}`);
  const steps = Array.isArray(verifyCommands) && verifyCommands.length
    ? verifyCommands
    : ['Run your language-specific install + test commands'];
  console.log('   Next steps:');
  steps.forEach((cmd) => console.log(`     ${cmd}`));
  if (needRepo.length) {
    console.log('   Once the project is a git repository (git init && git add -A):');
    needRepo.forEach((cmd) => console.log(`     ${cmd}`));
  }
  if (githubSetup.length) console.log(`\n${githubSetup.join('\n')}`);
  console.log('\n   Edit AGENTS.md (or equivalent) to customize the AI contract.');
  console.log('   Happy scaffolding. Your rules, your choice of stack.\n');
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    logError(`❌ ${e.message}`);
    process.exit(1);
  }

  if (opts.command === 'version') {
    log(SKELETOR_VERSION);
    process.exit(0);
  }

  if (opts.command === 'help' || !opts.command) {
    log(USAGE.trim());
    const tmpls = getTemplatesWithManifests();
    if (tmpls.length) {
      log('\nAvailable templates:');
      tmpls.forEach((t) => {
        const baseline = getBaselineLayers(t);
        const baselineHint = baseline.length ? ` [baseline: ${baseline.join(', ')}]` : '';
        log(`  • ${t.id} — ${t.name}: ${t.description}${baselineHint}`);
      });
    }
    const baselineIds = new Set(tmpls.flatMap(getBaselineLayers));
    const layers = getLayersWithManifests();
    const baselineLayers = layers.filter((l) => baselineIds.has(l.id));
    const featureLayers = layers.filter((l) => !baselineIds.has(l.id));
    if (baselineLayers.length) {
      log('\nBaseline layers (always applied to the templates they fit):');
      baselineLayers.forEach((l) => log(`  • ${l.id} — ${l.name}`));
    }
    if (featureLayers.length) {
      log('\nFeature layers (opt in with --with or a bundle):');
      featureLayers.forEach((l) => log(`  • ${l.id} — ${l.name}`));
    }
    const bundles = loadBundles();
    if (Object.keys(bundles).length) {
      log('\nAvailable bundles:');
      Object.entries(bundles).forEach(([k, v]) => log(`  • ${k} → ${(v.layers || []).join(', ')}`));
    }
    process.exit(0);
  }

  if (opts.command === 'new') {
    runNew(opts).catch((e) => {
      logError('❌ Generation failed: ' + (e?.message || e));
      process.exit(1);
    });
  }

}

export {
  parseArgs,
  render,
  renderPathSegment,
  buildRenderVars,
  sanitizeIdentifierSegment,
  getAvailableTemplates,
  getTemplatesWithManifests,
  loadTemplateManifest,
  resolveTemplateLayout,
  copyTemplateToProject,
  applyLicense,
  ensureDir,
  copyAndRender,
  runNew,
  checkTemplateOptions,
  printPostScaffoldSteps,
  labelHint,
  collectLayerIds,
  getBaselineLayers,
  getFeatureLayers,
  USAGE,
  SKELETOR_VERSION,
};

const isTestEnv = process.env.SKELETOR_CLI_TEST === '1' || process.env.JEST_WORKER_ID != null;
if (!isTestEnv) {
  main();
}
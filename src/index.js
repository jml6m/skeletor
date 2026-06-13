#!/usr/bin/env node
/**
 * Skeletor — Efficient scaffolding for custom development
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as p from '@clack/prompts';
import { detectGithubOwners } from './detect-owner.js';
import {
  promptConfirmRecommended,
  promptLayerValue,
  promptOwnerSelect,
} from './interactive-prompts.js';
import { writeProjectManifest, readProjectManifest } from './manifest.js';
import {
  applyLayers,
  expandBundle,
  getLayersWithManifests,
  inferProjectContext,
  isGitDirty,
  layerAppliesTo,
  loadBundles,
  resolveLayerOrder,
  gatherLayerPrompts,
  layerPromptDefaults,
  validateLayerManifests,
} from './layers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const SKELETOR_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const USAGE = `
💀 skeletor — pick your scaffolding

Usage:
  skeletor new <name> [options]
  skeletor enhance [path] [options]
  skeletor --help

new options:
  --template <name>     Stack to scaffold (javascript, typescript, python, go, …)
  --layout <name>       Template layout (single, lib, workspace — when supported)
  --with <id[,id...]>   Enhancement layers to apply after scaffold
  --with-recommended    Apply this template's recommendedLayers (see template.json)
  --bundle <name>       Named layer preset (see bundles.json)
  --owner <user>        GitHub owner/org (skips auto-detection)
  --description <text>  Project description (optional)
  --auto                Non-interactive; requires --template
  --no-git              Skip git init

enhance options:
  --add <id[,id...]>    Layers to apply
  --bundle <name>       Named layer preset
  --list                List compatible layers (marks applied)
  --status              Show .skeletor/manifest.json
  --dry-run             Preview changes without writing
  --force               Overwrite conflicting files
  --allow-dirty         Override dirty-git guard (not recommended)
  --no-install          Skip postApply commands

Examples:
  skeletor new my-api --template typescript --with-recommended
  skeletor new my-api --template typescript --with governance,quality-gates
  skeletor new my-lib --auto --template typescript --bundle ts-library
  skeletor new tbra --auto --template rust --layout workspace
  skeletor enhance --add logger-winston
  skeletor enhance ./my-api --add zod-config --dry-run
`;

function log(msg) { console.log(msg); }
function logError(msg) { console.error(msg); }

function parseCommaList(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    command: null,
    name: null,
    path: null,
    template: null,
    layout: null,
    withLayers: [],
    withRecommended: false,
    bundle: null,
    addLayers: [],
    owner: null,
    description: null,
    auto: false,
    git: true,
    list: false,
    status: false,
    dryRun: false,
    force: false,
    allowDirty: false,
    noInstall: false,
  };

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    result.command = 'help';
    return result;
  }

  if (args[0] === 'new') {
    result.command = 'new';
    result.name = args[1];
    for (let i = 2; i < args.length; i++) {
      const a = args[i];
      if (a === '--template' || a === '-t') result.template = args[++i] || null;
      else if (a === '--layout') result.layout = args[++i] || null;
      else if (a === '--with') result.withLayers = parseCommaList(args[++i]);
      else if (a === '--with-recommended') result.withRecommended = true;
      else if (a === '--bundle') result.bundle = args[++i] || null;
      else if (a === '--owner' || a === '-o') result.owner = args[++i] || null;
      else if (a === '--description' || a === '-d') result.description = args[++i] || null;
      else if (a === '--auto') result.auto = true;
      else if (a === '--no-git') result.git = false;
      else if (!a.startsWith('-') && !result.name) result.name = a;
    }
    return result;
  }

  if (args[0] === 'enhance') {
    result.command = 'enhance';
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      if (a === '--add') result.addLayers = parseCommaList(args[++i]);
      else if (a === '--bundle') result.bundle = args[++i] || null;
      else if (a === '--list') result.list = true;
      else if (a === '--status') result.status = true;
      else if (a === '--dry-run') result.dryRun = true;
      else if (a === '--force') result.force = true;
      else if (a === '--allow-dirty') result.allowDirty = true;
      else if (a === '--no-install') result.noInstall = true;
      else if (!a.startsWith('-') && !result.path) result.path = a;
    }
    return result;
  }

  result.command = 'help';
  return result;
}

function render(content, vars) {
  let out = content;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return out;
}

function sanitizeIdentifierSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'example';
}

function buildRenderVars({ name, owner, description, extra = {} }) {
  if (!owner) {
    throw new Error('owner is required');
  }
  const repoOwner = owner;
  const ownerSegment = sanitizeIdentifierSegment(repoOwner);
  const namespace = String(name).replace(/-/g, '_');
  return {
    PROJECT_NAME: name,
    REPO_OWNER: repoOwner,
    REPO_NAME: name,
    DESCRIPTION: description || DEFAULT_DESCRIPTION,
    YEAR: new Date().getFullYear(),
    NAMESPACE: namespace,
    GROUP_ID: `io.github.${ownerSegment}`,
    GO_MODULE: `github.com/${repoOwner}/${name}`,
    REPO_URL: `https://github.com/${repoOwner}/${name}`,
    LOG_DIR: 'logs',
    ...extra,
  };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyAndRender(src, dest, vars) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'template.json' || entry === 'layer.json') continue;
      const outEntry = entry.endsWith('.tmpl') ? entry.slice(0, -'.tmpl'.length) : entry;
      copyAndRender(path.join(src, entry), path.join(dest, outEntry), vars);
    }
    return;
  }
  let content = fs.readFileSync(src, 'utf8');
  content = render(content, vars);
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, 'utf8');
}

function getAvailableTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR).filter((d) => {
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
  const layouts = templateInfo.layouts;
  if (!layouts) return { layoutId: 'default', sourceDir: templateInfo.dir };
  const layoutId = layout || templateInfo.defaultLayout || Object.keys(layouts)[0];
  if (!layouts[layoutId]) {
    throw new Error(`Unknown layout "${layoutId}" for template "${templateInfo.id}". Available: ${Object.keys(layouts).join(', ')}`);
  }
  return { layoutId, sourceDir: path.join(templateInfo.dir, layouts[layoutId].dir) };
}

function copyTemplateToProject(templateInfo, targetDir, vars, layout) {
  const { layoutId, sourceDir } = resolveTemplateLayout(templateInfo, layout);
  copyAndRender(sourceDir, targetDir, vars);

  const shared = ['AGENTS.md', 'README.md'];
  for (const file of shared) {
    const src = path.join(templateInfo.dir, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      copyAndRender(src, dest, vars);
    }
  }
  return layoutId;
}

function getRecommendedLayers(templateInfo) {
  return Array.isArray(templateInfo?.recommendedLayers) ? templateInfo.recommendedLayers : [];
}

function collectLayerIds(opts, templateInfo) {
  const templateId = typeof templateInfo === 'string' ? templateInfo : templateInfo?.id;
  const ids = [...(opts.withLayers || opts.addLayers || [])];
  if (opts.withRecommended) {
    const info = typeof templateInfo === 'string'
      ? getTemplatesWithManifests().find((t) => t.id === templateInfo)
      : templateInfo;
    ids.push(...getRecommendedLayers(info));
  }
  if (opts.bundle) {
    ids.push(...expandBundle(opts.bundle, templateId));
  }
  return [...new Set(ids)];
}

function writeInitialManifest(targetDir, { templateId, owner, layoutId, verifyCommands }) {
  writeProjectManifest(targetDir, {
    skeletorVersion: SKELETOR_VERSION,
    template: templateId,
    layout: layoutId,
    createdAt: new Date().toISOString().slice(0, 10),
    adoptedExisting: false,
    owner,
    layers: [],
    verifyCommands: verifyCommands || [],
  });
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

function resolveOwnerForProject(projectDir, manifestOwner) {
  if (manifestOwner?.trim()) return manifestOwner.trim();
  const candidates = detectGithubOwners(projectDir);
  return candidates[0]?.owner ?? null;
}

async function promptForLayerVars(prompts) {
  const vars = {};
  for (const pr of prompts) {
    const answer = await promptLayerValue(pr);
    if (p.isCancel(answer)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    vars[pr.token] = String(answer).trim() || String(pr.default ?? '');
  }
  return vars;
}

async function runNew(opts) {
  const { name, git, auto } = opts;

  if (!name || name === '.' || name === '..') {
    logError('❌ Please provide a valid project name (e.g. "my-api").');
    process.exit(1);
  }

  const allTemplates = getTemplatesWithManifests();
  if (allTemplates.length === 0) {
    logError('❌ No templates found in templates/ directory.');
    process.exit(1);
  }

  let chosenTemplateId = opts.template;
  const isInteractive = !auto && process.stdout.isTTY;
  let finalOwner = await resolveOwnerForNew(opts, isInteractive);
  const finalDesc = opts.description || DEFAULT_DESCRIPTION;

  if (!chosenTemplateId) {
    if (auto) {
      logError('❌ --auto requires --template <id>.');
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
  if (!templateInfo) {
    logError(`❌ Unknown template "${chosenTemplateId}".`);
    process.exit(1);
  }

  if (isInteractive) {
    const recommended = getRecommendedLayers(templateInfo);
    const noLayerFlags = !opts.withLayers.length && !opts.bundle && !opts.withRecommended;
    if (noLayerFlags && recommended.length) {
      const applyRecommended = await promptConfirmRecommended({
        message: `Apply recommended enhancements? (${recommended.join(', ')})`,
        recommended: true,
      });
      if (p.isCancel(applyRecommended)) { p.cancel('Cancelled.'); process.exit(0); }
      if (applyRecommended) opts.withRecommended = true;
    }
  }

  const layerIds = collectLayerIds(opts, templateInfo);
  const layerCtx = { template: chosenTemplateId, language: templateInfo.language || chosenTemplateId };
  const { errors: promptErrors, prompts: layerPrompts } = gatherLayerPrompts(layerIds, layerCtx);
  if (promptErrors.length) {
    logError(`❌ Layer configuration error: ${promptErrors.join('; ')}`);
    process.exit(1);
  }

  let layerVars = layerPromptDefaults(layerPrompts);
  if (isInteractive && layerPrompts.length) {
    layerVars = await promptForLayerVars(layerPrompts);
  }

  if (isInteractive) {
    const layerNote = layerIds.length ? ` + ${layerIds.length} enhancement layer(s)` : '';
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

  const vars = buildRenderVars({ name, owner: finalOwner, description: finalDesc, extra: layerVars });
  p.log.info(`Creating "${name}" using ${templateInfo.name}...`);

  let layoutId = 'default';
  try {
    layoutId = copyTemplateToProject(templateInfo, targetDir, vars, opts.layout);
  } catch (e) {
    logError(`❌ ${e.message}`);
    process.exit(1);
  }

  writeInitialManifest(targetDir, {
    templateId: chosenTemplateId,
    owner: finalOwner,
    layoutId,
    verifyCommands: templateInfo.verifyCommands,
  });

  let verifyCommands = [...(templateInfo.verifyCommands || [])];

  if (layerIds.length) {
    if (opts.withRecommended) {
      p.log.info(`Applying recommended layers: ${getRecommendedLayers(templateInfo).join(', ')}`);
    }
    const result = applyLayers({
      projectDir: targetDir,
      layerIds,
      vars,
      template: chosenTemplateId,
      owner: finalOwner,
      skeletorVersion: SKELETOR_VERSION,
      force: false,
      noInstall: true,
    });
    if (!result.ok) {
      logError(`❌ Layer apply failed: ${result.errors.join('; ')}`);
      process.exit(1);
    }
    if (result.autoAdded?.length) {
      p.log.info(`Auto-added required layers: ${result.autoAdded.join(', ')}`);
    }
    const manifest = readProjectManifest(targetDir);
    verifyCommands = manifest?.verifyCommands || verifyCommands;
  }

  if (git) {
    try {
      execSync('git init -q', { cwd: targetDir, stdio: 'ignore' });
      execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
      execSync('git commit -q -m "chore: initial commit from skeletor"', { cwd: targetDir, stdio: 'ignore' });
      p.log.success('Git repository initialized');
    } catch {
      p.log.warn('Git init skipped (git not available or failed)');
    }
  }

  p.outro('✅ Done!');
  printPostScaffoldSteps(name, verifyCommands);
}

async function runEnhance(opts) {
  const projectDir = path.resolve(process.cwd(), opts.path || '.');
  if (!fs.existsSync(projectDir)) {
    logError(`❌ Project path does not exist: ${projectDir}`);
    process.exit(1);
  }

  if (opts.status) {
    const manifest = readProjectManifest(projectDir);
    if (!manifest) {
      log('No .skeletor/manifest.json found.');
      process.exit(0);
    }
    console.log(JSON.stringify(manifest, null, 2));
    process.exit(0);
  }

  let ctx;
  try {
    ctx = inferProjectContext(projectDir);
  } catch (e) {
    logError(`❌ ${e.message}`);
    process.exit(1);
  }

  if (opts.list) {
    const layers = getLayersWithManifests();
    const applied = new Set((ctx.manifest?.layers || []).map((l) => l.id));
    log(`Compatible layers for ${ctx.template}:`);
    for (const layer of layers) {
      if (!layerAppliesTo(layer, ctx)) continue;
      const mark = applied.has(layer.id) ? ' [applied]' : '';
      log(`  • ${layer.id} — ${layer.name}${mark}`);
    }
    process.exit(0);
  }

  const layerIds = collectLayerIds(opts, ctx.template);
  if (!layerIds.length) {
    logError('❌ Provide --add <layers> or --bundle <name>.');
    process.exit(1);
  }

  if (!opts.allowDirty && !opts.dryRun && isGitDirty(projectDir)) {
    logError('❌ Git working tree is dirty. Commit or stash changes before enhancing.');
    logError('   Pass --allow-dirty to override (not recommended).');
    process.exit(1);
  }

  const enhanceOwner = resolveOwnerForProject(projectDir, ctx.manifest?.owner);
  if (!enhanceOwner) {
    logError('❌ Could not determine GitHub owner for this project.');
    logError('   Scaffold with skeletor new --owner <org>, or ensure git remote / package.json / gh CLI is available.');
    process.exit(1);
  }

  const result = applyLayers({
    projectDir,
    layerIds,
    vars: buildRenderVars({
      name: path.basename(projectDir),
      owner: enhanceOwner,
      description: ctx.manifest?.description || DEFAULT_DESCRIPTION,
    }),
    force: opts.force,
    dryRun: opts.dryRun,
    noInstall: opts.noInstall,
    skeletorVersion: SKELETOR_VERSION,
    owner: enhanceOwner,
    template: ctx.manifest ? ctx.template : undefined,
  });

  if (!result.ok) {
    logError(`❌ ${result.errors.join('; ')}`);
    process.exit(1);
  }

  if (opts.dryRun) {
    p.outro('Dry run — no files written.');
    for (const lp of result.plan.layers) {
      log(`Layer ${lp.id}:`);
      for (const f of lp.files) log(`  ${f.action}: ${f.relPath}`);
      if (lp.packageJsonPatch) log('  merge: package.json');
      if (lp.agentsSection) log(`  append AGENTS.md: ${lp.agentsSection.section}`);
    }
    if (result.plan.skipped.length) log(`Skipped (already applied): ${result.plan.skipped.join(', ')}`);
    if (result.plan.autoAdded?.length) log(`Would auto-add: ${result.plan.autoAdded.join(', ')}`);
    process.exit(0);
  }

  if (result.applied.length) {
    p.outro(`✅ Applied layers: ${result.applied.join(', ')}`);
    if (result.conflicts?.length) {
      p.log.warn(`${result.conflicts.length} package.json merge note(s) — existing values kept.`);
    }
    const manifest = readProjectManifest(projectDir);
    if (manifest?.verifyCommands?.length) {
      printPostScaffoldSteps('.', manifest.verifyCommands);
    }
  } else {
    p.outro('No changes — all requested layers already applied.');
  }
}

function printPostScaffoldSteps(projectName, verifyCommands) {
  console.log(`   cd ${projectName}`);
  const steps = Array.isArray(verifyCommands) && verifyCommands.length
    ? verifyCommands
    : ['Run your language-specific install + test commands'];
  console.log('   Next steps:');
  steps.forEach((cmd) => console.log(`     ${cmd}`));
  console.log('\n   Edit AGENTS.md (or equivalent) to customize the AI contract.');
  console.log('   Happy scaffolding. Your rules, your choice of stack.\n');
}

function main() {
  const opts = parseArgs(process.argv);

  if (opts.command === 'help' || !opts.command) {
    log(USAGE.trim());
    const tmpls = getTemplatesWithManifests();
    if (tmpls.length) {
      log('\nAvailable templates:');
      tmpls.forEach((t) => {
        const rec = getRecommendedLayers(t);
        const recHint = rec.length ? ` [recommended: ${rec.join(', ')}]` : '';
        log(`  • ${t.id} — ${t.name}: ${t.description}${recHint}`);
      });
    }
    const layers = getLayersWithManifests();
    if (layers.length) {
      log('\nAvailable layers:');
      layers.forEach((l) => log(`  • ${l.id} — ${l.name}`));
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

  if (opts.command === 'enhance') {
    runEnhance(opts).catch((e) => {
      logError('❌ Enhance failed: ' + (e?.message || e));
      process.exit(1);
    });
  }
}

export {
  parseArgs,
  render,
  buildRenderVars,
  sanitizeIdentifierSegment,
  getAvailableTemplates,
  getTemplatesWithManifests,
  loadTemplateManifest,
  resolveTemplateLayout,
  copyTemplateToProject,
  ensureDir,
  copyAndRender,
  runNew,
  runEnhance,
  printPostScaffoldSteps,
  collectLayerIds,
  getRecommendedLayers,
  USAGE,
  SKELETOR_VERSION,
};

const isTestEnv = process.env.SKELETOR_CLI_TEST === '1' || process.env.JEST_WORKER_ID != null;
if (!isTestEnv) {
  main();
}
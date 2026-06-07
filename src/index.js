#!/usr/bin/env node
/**
 * Skeletor — Efficient scaffolding for custom development
 * Generates projects pre-configured with personal standards derived from
 * local-land-*, cuda-sandbox, x-app-skeleton and similar workspaces.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import * as p from '@clack/prompts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

const USAGE = `
💀 skeletor — pick your scaffolding

Usage:
  skeletor new <name> [options]
  skeletor --help

Options:
  --template <name>     Template to use (e.g. javascript, typescript, python)
                        Omit to choose interactively (or use --yes for default)
  --owner <user>        GitHub owner/org for release scripts (default: jml6m)
  --description <text>  Short project description
  --yes                 Non-interactive, use defaults + first available template
  --no-git              Skip git init

Examples:
  skeletor new my-api --template typescript
  skeletor new my-lib --yes
  skeletor new my-tool
`;


function log(msg) { console.log(msg); }
function logError(msg) { console.error(msg); }

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    command: null,
    name: null,
    template: null, // resolved later, can be interactive
    owner: 'jml6m',
    description: 'A new project scaffolded with skeletor.',
    yes: false,
    git: true,
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
      else if (a === '--owner' || a === '-o') result.owner = args[++i] || 'jml6m';
      else if (a === '--description' || a === '-d') result.description = args[++i] || result.description;
      else if (a === '--yes' || a === '-y') result.yes = true;
      else if (a === '--no-git') result.git = false;
      else if (!a.startsWith('-') && !result.name) result.name = a;
    }
  } else {
    result.command = 'help';
  }

  return result;
}

function render(content, vars) {
  let out = content;
  for (const [k, v] of Object.entries(vars)) {
    const token = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
    out = out.replace(token, String(v));
  }
  return out;
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
      // never copy node_modules or .git inside templates
      if (entry === 'node_modules' || entry === '.git') continue;
      // strip .tmpl suffix from output filename so e.g. package.json.tmpl → package.json
      const outEntry = entry.endsWith('.tmpl') ? entry.slice(0, -'.tmpl'.length) : entry;
      copyAndRender(path.join(src, entry), path.join(dest, outEntry), vars);
    }
    return;
  }

  // text file -> render
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
    } catch (e) {
      // ignore bad manifest, fall back to defaults
    }
  }
  return { ...manifest, dir };
}

function getTemplatesWithManifests() {
  const ids = getAvailableTemplates();
  return ids.map((id) => loadTemplateManifest(id));
}

async function chooseTemplateInteractively(templates, isYes) {
  if (isYes || templates.length === 0) {
    return templates[0] ? templates[0].id : null;
  }

  if (!process.stdout.isTTY) {
    return templates[0] ? templates[0].id : null;
  }

  p.intro('💀 Skeletor — pick your scaffolding');

  const options = templates.map((t) => ({
    value: t.id,
    label: t.name,
    hint: t.description.length > 60 ? t.description.slice(0, 57) + '...' : t.description,
  }));

  const selected = await p.select({
    message: 'Choose a template',
    options,
  });

  if (p.isCancel(selected)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return selected;
}

async function runNew(opts) {
  const { name, git, yes } = opts;

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
  let finalOwner = opts.owner || 'jml6m';
  let finalDesc = opts.description || 'A new project scaffolded with skeletor.';

  const isInteractive = !yes && process.stdout.isTTY;

  if (!chosenTemplateId) {
    chosenTemplateId = await chooseTemplateInteractively(allTemplates, yes);
  }

  const templateInfo = allTemplates.find((t) => t.id === chosenTemplateId);
  if (!templateInfo) {
    const available = allTemplates.map((t) => t.id).join(', ');
    logError(`❌ Unknown template "${chosenTemplateId}". Available: ${available}`);
    process.exit(1);
  }

  // Richer interactive prompts for missing details (only when not --yes)
  if (isInteractive) {
    const ownerInput = await p.text({
      message: 'GitHub owner / org',
      placeholder: finalOwner,
      initialValue: finalOwner,
    });
    if (p.isCancel(ownerInput)) { p.cancel('Cancelled.'); process.exit(0); }
    finalOwner = ownerInput || finalOwner;

    const descInput = await p.text({
      message: 'Project description',
      placeholder: finalDesc,
      initialValue: finalDesc,
    });
    if (p.isCancel(descInput)) { p.cancel('Cancelled.'); process.exit(0); }
    finalDesc = descInput || finalDesc;

    const shouldContinue = await p.confirm({
      message: `Scaffold "${name}" as ${templateInfo.name}?`,
      initialValue: true,
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

  const repoName = name;
  const vars = {
    PROJECT_NAME: name,
    REPO_OWNER: finalOwner,
    REPO_NAME: repoName,
    DESCRIPTION: finalDesc,
    YEAR: new Date().getFullYear(),
  };

  p.log.info(`Creating "${name}" using ${templateInfo.name}...`);

  copyAndRender(templateInfo.dir, targetDir, vars);

  if (git) {
    try {
      execSync('git init -q', { cwd: targetDir, stdio: 'ignore' });
      execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
      execSync('git commit -q -m "chore: initial commit from skeletor"', { cwd: targetDir, stdio: 'ignore' });
      p.log.success('Git repository initialized');
    } catch (e) {
      p.log.warn('Git init skipped (git not available or failed)');
    }
  }

  p.outro('✅ Done!');

  console.log(`   cd ${name}`);
  const suggested = templateInfo.verifyCommands && templateInfo.verifyCommands.length
    ? templateInfo.verifyCommands[0]
    : 'Run your language-specific install + test commands';
  console.log(`   ${suggested}`);
  console.log('   Then run the other steps from the template manifest (lint, test, etc.)');
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
      tmpls.forEach((t) => log(`  • ${t.id} — ${t.name}: ${t.description}`));
    } else {
      log('\n(No templates found yet — run from a full skeletor checkout with templates/ )');
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

// Exports for testing / programmatic use
export {
  parseArgs,
  render,
  getAvailableTemplates,
  getTemplatesWithManifests,
  loadTemplateManifest,
  ensureDir,
  copyAndRender,
  runNew,
  USAGE,
};

const isTestEnv = process.env.SKELETOR_CLI_TEST === '1' || process.env.JEST_WORKER_ID != null;
if (!isTestEnv) {
  main();
}

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
  --template <name>     Stack to scaffold (javascript, typescript, python, go, …)
                        Omit for an interactive language/stack picker (TTY required)
  --auto                Non-interactive; requires --template (uses defaults — edit
                        owner/description in generated files afterward)
  --no-git              Skip git init (git is initialized by default)

Examples:
  skeletor new my-api                    # interactive: pick stack, owner, description
  skeletor new my-api --template typescript
  skeletor new my-lib --auto --template go
  skeletor new my-lib --auto --template go --no-git
`;


function log(msg) { console.log(msg); }
function logError(msg) { console.error(msg); }

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    command: null,
    name: null,
    template: null, // resolved later, can be interactive
    auto: false,
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
      else if (a === '--auto') result.auto = true;
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

/** Sanitize a segment for use in Java groupId / Go module paths. */
function sanitizeIdentifierSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'example';
}

/** Build the full token map passed to copyAndRender. */
function buildRenderVars({ name, owner, description }) {
  const repoOwner = owner || 'jml6m';
  const ownerSegment = sanitizeIdentifierSegment(repoOwner);
  const namespace = String(name).replace(/-/g, '_');
  return {
    PROJECT_NAME: name,
    REPO_OWNER: repoOwner,
    REPO_NAME: name,
    DESCRIPTION: description || 'A new project scaffolded with skeletor.',
    YEAR: new Date().getFullYear(),
    NAMESPACE: namespace,
    GROUP_ID: `io.github.${ownerSegment}`,
    GO_MODULE: `github.com/${repoOwner}/${name}`,
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
      // never copy node_modules, .git, or skeletor manifest inside templates
      if (entry === 'node_modules' || entry === '.git' || entry === 'template.json') continue;
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

async function chooseTemplateInteractively(templates) {
  if (templates.length === 0) {
    return null;
  }

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

const DEFAULT_OWNER = 'jml6m';
const DEFAULT_DESCRIPTION = 'A new project scaffolded with skeletor.';

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
  let finalOwner = DEFAULT_OWNER;
  let finalDesc = DEFAULT_DESCRIPTION;

  const isInteractive = !auto && process.stdout.isTTY;

  if (!chosenTemplateId) {
    if (auto) {
      logError('❌ --auto requires --template <id>. Pick a stack interactively by omitting --auto.');
      logError(`   Available: ${allTemplates.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    if (!process.stdout.isTTY) {
      logError('❌ No --template provided and this is not an interactive terminal.');
      logError('   Use --auto --template <id> for scripts and piped environments.');
      logError(`   Available: ${allTemplates.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    chosenTemplateId = await chooseTemplateInteractively(allTemplates);
  } else if (!process.stdout.isTTY && !auto) {
    logError('❌ --template requires --auto when not running in an interactive terminal.');
    logError(`   Example: skeletor new ${name} --auto --template ${chosenTemplateId}`);
    process.exit(1);
  }

  const templateInfo = allTemplates.find((t) => t.id === chosenTemplateId);
  if (!templateInfo) {
    const available = allTemplates.map((t) => t.id).join(', ');
    logError(`❌ Unknown template "${chosenTemplateId}". Available: ${available}`);
    process.exit(1);
  }

  // Owner, description, and confirm — interactive only (--auto uses defaults above)
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

  const vars = buildRenderVars({ name, owner: finalOwner, description: finalDesc });

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
  buildRenderVars,
  sanitizeIdentifierSegment,
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

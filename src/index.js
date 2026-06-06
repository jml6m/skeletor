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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

const USAGE = `
💀 skeletor — scaffolding with your rules

Usage:
  skeletor new <name> [options]
  skeletor --help

Options:
  --template <name>     Template to use (default: "node")
                        Available: node
  --owner <user>        GitHub owner/org for release.js (default: jml6m)
  --description <text>  Short project description
  --yes                 Non-interactive, use all defaults
  --no-git              Skip git init

Examples:
  skeletor new my-api --template node --owner jml6m
  skeletor new my-lib --yes
`;

function log(msg) { console.log(msg); }
function logError(msg) { console.error(msg); }

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    command: null,
    name: null,
    template: 'node',
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
      if (a === '--template' || a === '-t') result.template = args[++i] || 'node';
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
      copyAndRender(path.join(src, entry), path.join(dest, entry), vars);
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

async function runNew(opts) {
  const { name, template, owner, description, git } = opts;

  if (!name || name === '.' || name === '..') {
    logError('❌ Please provide a valid project name (e.g. "my-api").');
    process.exit(1);
  }

  const available = getAvailableTemplates();
  if (!available.includes(template)) {
    logError(`❌ Unknown template "${template}". Available: ${available.join(', ') || '(none yet)'}`);
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    logError(`❌ Target directory "${name}" already exists and is not empty.`);
    process.exit(1);
  }

  const repoName = name; // could slugify later
  const vars = {
    PROJECT_NAME: name,
    REPO_OWNER: owner,
    REPO_NAME: repoName,
    DESCRIPTION: description,
    YEAR: new Date().getFullYear(),
  };

  log(`\n💀 Skeletor: creating "${name}" using template "${template}"...`);

  const tmplDir = path.join(TEMPLATES_DIR, template);
  copyAndRender(tmplDir, targetDir, vars);

  // post steps
  if (git) {
    try {
      execSync('git init -q', { cwd: targetDir, stdio: 'ignore' });
      execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
      execSync('git commit -q -m "chore: initial commit from skeletor"', { cwd: targetDir, stdio: 'ignore' });
      log('   ✓ git repository initialized');
    } catch (e) {
      log('   ⚠️  git init skipped (git not available or failed)');
    }
  }

  log('\n✅ Done! Next steps:');
  log(`   cd ${name}`);
  log('   npm install');
  log('   npm run format   # or let your editor handle prettier');
  log('   npm run lint');
  log('   npm test         # (once tests exist)');
  log('   npm run health:full');
  log('\n   Edit AGENTS.md to customize the AI contract for this project.');
  log('   Use `npm run release:patch` when opening PRs (per your conventions).');
  log('\nHappy scaffolding. Your rules, your projects.\n');
}

function main() {
  const opts = parseArgs(process.argv);

  if (opts.command === 'help' || !opts.command) {
    log(USAGE.trim());
    const tmpls = getAvailableTemplates();
    if (tmpls.length) log(`\nInstalled templates: ${tmpls.join(', ')}`);
    else log('\n(No templates found yet — run from a full skeletor checkout with templates/ )');
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
  ensureDir,
  copyAndRender,
  runNew,
  USAGE,
};

const isTestEnv = process.env.SKELETOR_CLI_TEST === '1' || process.env.JEST_WORKER_ID != null;
if (!isTestEnv) {
  main();
}

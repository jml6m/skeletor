const fs = require('fs');
const path = require('path');

const INCLUDE_ALL = process.argv.includes('--all') || process.argv.includes('--full');

const OUTPUT_FILE = 'prompt.md';
const AGENTS_FILE = 'AGENTS.md';

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'reports', 'report', '.git', '.vscode']);
const EXCLUDED_FILES = new Set(['package-lock.json', OUTPUT_FILE, AGENTS_FILE]);
const INCLUDED_EXTS = new Set(['.js', '.cjs', '.mjs', '.json', '.md', '.yml', '.yaml']);

const SECURITY_EXCLUDES = new Set(['src/index.js']); // extend with your core bootstrap / auth files

/**
 * Recursively lists repo-relative file paths worth packaging, skipping build output,
 * dependencies, env files and logs. Paths always use forward slashes.
 */
function collectFiles(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) out.push(...collectFiles(path.join(dir, entry.name), relPath));
      continue;
    }
    if (EXCLUDED_FILES.has(relPath) || entry.name.startsWith('.env') || entry.name.endsWith('.log')) continue;
    if (!INCLUDED_EXTS.has(path.extname(entry.name))) continue;
    if (!INCLUDE_ALL && SECURITY_EXCLUDES.has(relPath)) continue;
    out.push(relPath);
  }
  return out;
}

try {
  console.info('🔒 Generating prompt package...');
  if (INCLUDE_ALL) console.warn('⚠️  SECURITY OVERRIDE: core files may be included.');

  let output = '';

  if (fs.existsSync(AGENTS_FILE)) {
    let agents = fs.readFileSync(AGENTS_FILE, 'utf8');
    if (INCLUDE_ALL) {
      agents = agents.replace(/## 🛑 Excluded Source Code[\s\S]*?(?=---|\n##|$)/g, '## 🔓 SECURITY OVERRIDE — core files included\n\n');
    }
    output += `### CONTEXT: AI Agent Standards\n${agents}\n\n`;
  }

  const meta = new Date().toISOString();
  output += `> Generated: ${meta}\n> Security: ${INCLUDE_ALL ? 'FULL' : 'Sanitized'}\n\n---\n\n`;

  const files = collectFiles(process.cwd()).sort();

  console.info(`   Scanning... ${files.length} files.`);

  for (const rel of files) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      const ext = path.extname(rel).slice(1) || 'text';
      output += `## File: ${rel}\n\n\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
    } catch {
      console.warn('   ! read failed:', rel);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.info(`✅ Wrote ${OUTPUT_FILE}`);
} catch (err) {
  console.error('❌ generate-context failed:', err.message);
  process.exit(1);
}

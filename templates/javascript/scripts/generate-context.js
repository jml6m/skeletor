const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const INCLUDE_ALL = process.argv.includes('--all') || process.argv.includes('--full');

const OUTPUT_FILE = 'prompt.md';
const AGENTS_FILE = 'AGENTS.md';

const SYSTEM_EXCLUDES = [
  'node_modules/**',
  'dist/**',
  'build/**',
  '.env*',
  '**/*.log',
  'coverage/**',
  'package-lock.json',
  '.vscode/**',
  'reports/**',
  'report/**',
  '.git/**',
  OUTPUT_FILE,
];

const SECURITY_EXCLUDES = ['src/index.js']; // extend with your core bootstrap / auth files

const ALL_IGNORES = INCLUDE_ALL ? SYSTEM_EXCLUDES : [...SYSTEM_EXCLUDES, ...SECURITY_EXCLUDES];

const FILE_PATTERNS = '**/*.{js,json,md,yml,yaml}';

try {
  console.log('🔒 Generating prompt package...');
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

  const files = globSync(FILE_PATTERNS, {
    ignore: [...ALL_IGNORES, AGENTS_FILE],
    cwd: process.cwd(),
    nodir: true,
    dot: true,
  });

  console.log(`   Scanning... ${files.length} files.`);

  for (const rel of files) {
    try {
      const full = path.join(process.cwd(), rel);
      const content = fs.readFileSync(full, 'utf8');
      const ext = path.extname(rel).slice(1) || 'text';
      output += `## File: ${rel}\n\n\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
    } catch (e) {
      console.warn('   ! read failed:', rel);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`✅ Wrote ${OUTPUT_FILE}`);
} catch (err) {
  console.error('❌ generate-context failed:', err.message);
  process.exit(1);
}

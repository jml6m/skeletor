#!/usr/bin/env node
/**
 * Advisory check: report when registry versions have moved ahead of template pins.
 * Does not fail CI by default — use --strict to exit 1 when any major drift is found.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

function listTemplates() {
  return fs.readdirSync(TEMPLATES_DIR).filter((d) =>
    fs.existsSync(path.join(TEMPLATES_DIR, d, 'template.json')),
  );
}

function loadPinned(templateId) {
  const file = path.join(TEMPLATES_DIR, templateId, 'pinned-versions.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseMajor(version) {
  const m = String(version).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function npmLatest(pkg) {
  try {
    return execSync(`npm view ${pkg} version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const strict = process.argv.includes('--strict');
const findings = [];

for (const templateId of listTemplates()) {
  const pinned = loadPinned(templateId);
  if (pinned.status === 'deprecated') {
    findings.push({ templateId, kind: 'status', message: `status=deprecated — ${pinned.statusMessage || 'no message'}` });
  } else if (pinned.status === 'needs-review') {
    findings.push({ templateId, kind: 'status', message: `status=needs-review — ${pinned.statusMessage || 'no message'}` });
  }

  for (const [name, entry] of Object.entries(pinned.packages || {})) {
    const eco = entry.ecosystem || (['javascript', 'typescript'].includes(templateId) ? 'npm' : null);
    if (eco !== 'npm') continue;
    const latest = npmLatest(name);
    if (!latest) continue;
    const pinnedMajor = parseMajor(entry.version);
    const latestMajor = parseMajor(latest);
    if (pinnedMajor != null && latestMajor != null && latestMajor > pinnedMajor) {
      findings.push({
        templateId,
        kind: 'major',
        message: `${name}: pinned ${entry.version} (policy ${entry.policy || 'exact'}), npm latest ${latest}`,
      });
    } else if (latest !== entry.version && entry.policy === 'exact') {
      findings.push({
        templateId,
        kind: 'patch',
        message: `${name}: exact pin ${entry.version}, npm latest ${latest}`,
      });
    }
  }
}

if (findings.length === 0) {
  console.log('✓ No pin drift advisories.');
  process.exit(0);
}

console.log('Pin update advisories:');
for (const f of findings) {
  console.log(`  [${f.templateId}] (${f.kind}) ${f.message}`);
}

if (strict && findings.some((f) => f.kind === 'major' || f.kind === 'status')) {
  process.exit(1);
}
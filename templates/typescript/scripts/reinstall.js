import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.info('🗑️  Cleaning dependencies...');

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = path.join(rootDir, 'node_modules');
const lockFile = path.join(rootDir, 'package-lock.json');

if (fs.existsSync(nodeModules)) {
  fs.rmSync(nodeModules, { recursive: true, force: true });
}
if (fs.existsSync(lockFile)) {
  fs.rmSync(lockFile, { force: true });
}

console.info('✨ Clean complete. Installing fresh dependencies...');

try {
  execSync('npm install', { stdio: 'inherit', cwd: rootDir });
} catch {
  process.exit(1);
}

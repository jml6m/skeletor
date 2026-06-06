// scripts/reinstall.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🗑️  Cleaning dependencies...');

const rootDir = path.resolve(__dirname, '..');
const nodeModules = path.join(rootDir, 'node_modules');
const lockFile = path.join(rootDir, 'package-lock.json');

if (fs.existsSync(nodeModules)) {
  fs.rmSync(nodeModules, { recursive: true, force: true });
}
if (fs.existsSync(lockFile)) {
  fs.rmSync(lockFile, { force: true });
}

console.log('✨ Clean complete. Installing fresh dependencies...');

try {
  execSync('npm install', { stdio: 'inherit', cwd: rootDir });
} catch (error) {
  process.exit(1);
}

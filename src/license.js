/**
 * The project license follows repository visibility: only a public GitHub repository is offered an
 * open-source license. Everything else is UNLICENSED, which grants nothing until the author decides.
 */

import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { withRecommendedTag } from './interactive-prompts.js';

export const UNLICENSED = 'UNLICENSED';
export const PUBLIC_DEFAULT_LICENSE = 'MIT';

export const LICENSES = [
  { id: 'MIT', hint: 'permissive and short; the usual choice for tools and libraries' },
  { id: 'Apache-2.0', hint: 'permissive, with an explicit patent grant; common for larger or corporate-backed projects' },
  { id: UNLICENSED, hint: 'source is visible, but no rights are granted (not open source)' },
];

/** @param {{ github?: boolean, githubPrivate?: boolean }} opts */
export function isPublicRepo(opts) {
  return Boolean(opts.github && !opts.githubPrivate);
}

export function licenseSelectOptions() {
  return LICENSES.map(({ id, hint }) => ({
    value: id,
    label: id === PUBLIC_DEFAULT_LICENSE ? withRecommendedTag(id) : id,
    hint,
  }));
}

/**
 * UNLICENSED without a prompt unless the repository is public; a public one is asked interactively
 * and gets MIT under --auto.
 * @param {{ github?: boolean, githubPrivate?: boolean }} opts
 * @param {boolean} isInteractive
 */
export async function resolveLicense(opts, isInteractive) {
  if (!isPublicRepo(opts)) return UNLICENSED;
  if (!isInteractive) return PUBLIC_DEFAULT_LICENSE;
  return p.select({ message: 'License', options: licenseSelectOptions(), initialValue: PUBLIC_DEFAULT_LICENSE });
}

// pyproject.toml and Cargo.toml take an SPDX license or nothing; UNLICENSED is not an SPDX id.
const SPDX_ONLY_MANIFESTS = new Set(['pyproject.toml', 'Cargo.toml']);
const LICENSE_FIELD = /^license(?:\.workspace)?\s*=.*\r?\n?/gm;

/** Removes the license field from every pyproject.toml and Cargo.toml under projectDir. */
export function removeSpdxLicenseFields(projectDir) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'target'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SPDX_ONLY_MANIFESTS.has(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        const stripped = text.replace(LICENSE_FIELD, '');
        if (stripped !== text) fs.writeFileSync(full, stripped, 'utf8');
      }
    }
  };
  walk(projectDir);
}

/** @param {string} license */
export function readmeLicenseSection(license) {
  const body = license === UNLICENSED
    ? 'UNLICENSED: all rights reserved. No license is granted to use, copy, modify or distribute this code.'
    : `${license}. See [LICENSE](LICENSE).`;
  return `## License\n\n${body}\n`;
}

/**
 * @param {string} projectDir
 * @param {string} license
 */
export function appendReadmeLicense(projectDir, license) {
  const readme = path.join(projectDir, 'README.md');
  if (!fs.existsSync(readme)) return;
  const text = fs.readFileSync(readme, 'utf8');
  fs.writeFileSync(readme, `${text.trimEnd()}\n\n${readmeLicenseSection(license)}`, 'utf8');
}

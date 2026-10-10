import fs from 'fs';
import path from 'path';

export const PINNED_VERSIONS_FILENAME = 'pinned-versions.json';
export const VALID_STATUSES = ['active', 'needs-review', 'deprecated'];
export const VALID_POLICIES = ['exact', 'major', 'minor', 'range'];

/**
 * @param {string} name
 */
export function packageNameToToken(name) {
  const base = String(name).replace(/^@/, '').replace(/[/\-@.]/g, '_').toUpperCase();
  return `PIN_${base}`;
}

/**
 * @param {{ version: string, policy?: string, spec?: string, range?: string }} entry
 * @param {'npm'|'pypi'|'maven'|'nuget'|'go'|'raw'} [ecosystem]
 */
export function formatPinnedSpec(entry, ecosystem = 'npm') {
  if (entry.spec) return entry.spec;
  const version = entry.version;
  const policy = entry.policy || 'exact';

  if (policy === 'range' && entry.range) return entry.range;
  if (policy === 'exact') return version;

  if (ecosystem === 'pypi') {
    if (policy === 'major') {
      const [major] = version.split('.');
      return `>=${version},<${Number(major) + 1}.0.0`;
    }
    if (policy === 'minor') {
      const parts = version.split('.');
      const major = parts[0];
      const minor = parts[1] ?? '0';
      return `>=${version},<${major}.${Number(minor) + 1}.0`;
    }
    return version;
  }

  if (ecosystem === 'maven' || ecosystem === 'nuget' || ecosystem === 'raw') {
    return version;
  }

  if (ecosystem === 'go') {
    return version;
  }

  if (policy === 'major') return `^${version}`;
  if (policy === 'minor') return `~${version}`;
  return version;
}

/**
 * @param {string} templateDir
 */
export function loadPinnedVersions(templateDir) {
  const filePath = path.join(templateDir, PINNED_VERSIONS_FILENAME);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    throw new Error(`Invalid ${PINNED_VERSIONS_FILENAME} in ${templateDir}: ${e.message}`);
  }
}

/**
 * @param {object|null} pinned
 * @param {string} templateId
 * @returns {string[]}
 */
export function validatePinnedVersionsManifest(pinned, templateId) {
  const errors = [];
  if (!pinned) {
    errors.push(`Template "${templateId}": missing ${PINNED_VERSIONS_FILENAME}`);
    return errors;
  }

  if (pinned.schemaVersion !== 1) {
    errors.push(`Template "${templateId}": schemaVersion must be 1`);
  }

  if (!VALID_STATUSES.includes(pinned.status)) {
    errors.push(`Template "${templateId}": invalid status "${pinned.status}"`);
  }

  if (!pinned.runtime || typeof pinned.runtime !== 'object') {
    errors.push(`Template "${templateId}": runtime block is required`);
  }

  if (!pinned.packages || typeof pinned.packages !== 'object') {
    errors.push(`Template "${templateId}": packages block is required`);
  } else {
    for (const [name, entry] of Object.entries(pinned.packages)) {
      if (!entry?.version) {
        errors.push(`Template "${templateId}": package "${name}" missing version`);
      }
      if (entry.policy && !VALID_POLICIES.includes(entry.policy)) {
        errors.push(`Template "${templateId}": package "${name}" invalid policy "${entry.policy}"`);
      }
    }
  }

  return errors;
}

/**
 * Build render tokens from pinned-versions.json.
 * @param {object} pinned
 * @param {{ language?: string }} [templateInfo]
 */
export function buildPinTokens(pinned, templateInfo = {}) {
  const tokens = {};
  const eco = ecosystemForLanguage(templateInfo.language);

  for (const [name, entry] of Object.entries(pinned.packages || {})) {
    const pkgEco = entry.ecosystem || eco;
    tokens[packageNameToToken(name)] = formatPinnedSpec(entry, pkgEco);
  }

  const runtime = pinned.runtime || {};
  if (runtime.node) {
    tokens.PIN_RUNTIME_NODE = runtime.node.version;
    if (runtime.node.engines) tokens.PIN_RUNTIME_NODE_ENGINES = runtime.node.engines;
  }
  if (runtime.python) {
    Object.assign(tokens, pythonRuntimeTokens(runtime.python.version));
  }
  if (runtime.go) {
    tokens.PIN_RUNTIME_GO = runtime.go.version.split('.').slice(0, 2).join('.');
    tokens.PIN_RUNTIME_GO_TOOLCHAIN = runtime.go.version;
  }
  if (runtime.java) {
    tokens.PIN_RUNTIME_JAVA = runtime.java.version;
  }
  if (runtime.dotnet) {
    tokens.PIN_RUNTIME_DOTNET = runtime.dotnet.version;
    tokens.PIN_TARGET_FRAMEWORK = `net${runtime.dotnet.version}`;
  }
  if (runtime.rust) {
    if (runtime.rust.edition) tokens.PIN_RUNTIME_RUST_EDITION = runtime.rust.edition;
    if (runtime.rust.channel) tokens.PIN_RUNTIME_RUST_CHANNEL = runtime.rust.channel;
  }

  return tokens;
}

/** @param {string} version e.g. "3.13"; a patch part is dropped, ruff and mypy take major.minor */
function pythonRuntimeTokens(version) {
  const [major, minor = '0'] = String(version).trim().split('.');
  return {
    PIN_RUNTIME_PYTHON: `${major}.${minor}`,
    PIN_RUNTIME_PYTHON_RUFF: `py${major}${minor}`,
  };
}

/**
 * Point runtime pin tokens at the version the user picked at the prompt, so pyproject.toml and
 * the emitted CI agree with `.python-version` / `<TargetFramework>`.
 * @param {Record<string, string>} pinTokens
 * @param {{ PYTHON_VERSION?: string, TARGET_FRAMEWORK?: string }} choices
 */
export function applyRuntimeChoices(pinTokens, choices = {}) {
  const tokens = { ...pinTokens };
  if (tokens.PIN_RUNTIME_PYTHON && choices.PYTHON_VERSION) {
    Object.assign(tokens, pythonRuntimeTokens(choices.PYTHON_VERSION));
  }
  const tfm = /^net(\d+\.\d+)(?:-|$)/.exec(String(choices.TARGET_FRAMEWORK ?? ''));
  if (tokens.PIN_RUNTIME_DOTNET && tfm) {
    tokens.PIN_RUNTIME_DOTNET = tfm[1];
  }
  return tokens;
}

function ecosystemForLanguage(language) {
  const map = {
    javascript: 'npm',
    typescript: 'npm',
    python: 'pypi',
    java: 'maven',
    csharp: 'nuget',
    go: 'go',
    rust: 'raw',
  };
  return map[language] || 'npm';
}

/**
 * @param {object|null} pinned
 * @param {{ allowDeprecatedTemplate?: boolean }} opts
 */
export function checkTemplateGenerationAllowed(pinned, opts = {}) {
  if (!pinned) {
    return { allowed: true, warn: null, blocked: false };
  }

  const status = pinned.status || 'active';
  const message = pinned.statusMessage || `Template status is "${status}".`;

  if (status === 'deprecated' && !opts.allowDeprecatedTemplate) {
    return {
      allowed: false,
      blocked: true,
      warn: null,
      message: `${message} Pass --allow-deprecated-template to scaffold anyway.`,
    };
  }

  if (status === 'needs-review') {
    return {
      allowed: true,
      blocked: false,
      warn: `⚠️  Template needs review: ${message}`,
      message: null,
    };
  }

  return { allowed: true, blocked: false, warn: null, message: null };
}

/**
 * Find {{PIN_*}} tokens in template tree and ensure they are defined.
 * @param {string} templateDir
 * @param {object} pinned
 */
export function validatePinTokenCoverage(templateDir, pinned, templateInfo = {}) {
  const errors = [];
  const defined = new Set(Object.keys(buildPinTokens(pinned, templateInfo)));
  const used = new Set();

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.tmpl') && entry.name !== PINNED_VERSIONS_FILENAME && !entry.name.endsWith('.json')) {
        const text = fs.readFileSync(full, 'utf8');
        for (const match of text.matchAll(/\{\{(PIN_[A-Z0-9_]+)\}\}/g)) {
          used.add(match[1]);
        }
      }
      if (entry.name.endsWith('.tmpl')) {
        const text = fs.readFileSync(full, 'utf8');
        for (const match of text.matchAll(/\{\{(PIN_[A-Z0-9_]+)\}\}/g)) {
          used.add(match[1]);
        }
      }
    }
  }

  walk(templateDir);

  for (const token of used) {
    if (!defined.has(token)) {
      errors.push(`Undefined pin token "${token}" used in ${templateDir}`);
    }
  }

  return errors;
}
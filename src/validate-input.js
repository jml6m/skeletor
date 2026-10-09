/**
 * Validation for the project name and GitHub owner, run before anything is written to disk.
 * Each validator returns null when the value is valid, otherwise a message naming the rule that failed.
 */

import { builtinModules } from 'module';

const GITHUB_OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

const RUST_KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'become', 'box', 'break', 'const', 'continue', 'crate', 'do', 'dyn',
  'else', 'enum', 'extern', 'false', 'final', 'fn', 'for', 'gen', 'if', 'impl', 'in', 'let', 'loop', 'macro',
  'match', 'mod', 'move', 'mut', 'override', 'priv', 'pub', 'ref', 'return', 'self', 'static', 'struct',
  'super', 'trait', 'true', 'try', 'type', 'typeof', 'unsafe', 'unsized', 'use', 'virtual', 'where', 'while',
  'yield',
]);
// `cargo new` refuses these: they collide with the test harness or the standard library crates.
const CARGO_RESERVED = new Set(['test', 'core', 'std', 'alloc', 'proc_macro', 'proc-macro']);

const CSHARP_KEYWORDS = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked', 'class', 'const',
  'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern',
  'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface',
  'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override',
  'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
  'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
]);

export const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'false', 'final', 'finally', 'float', 'for', 'goto',
  'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null', 'package',
  'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch',
  'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try', 'void', 'volatile', 'while', '_',
]);

const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const NPM_RESERVED = new Set(['node_modules', 'favicon.ico']);

/** @param {string} name */
function npmPackageNameError(name) {
  if (name !== name.toLowerCase()) return 'it must be lowercase';
  if (name.startsWith('_')) return 'it must not start with "_"';
  if (NPM_RESERVED.has(name)) return `"${name}" is reserved`;
  if (builtinModules.includes(name)) return `"${name}" is a Node.js core module name`;
  return null;
}

/** PEP 508 project name. */
function pythonProjectNameError(name) {
  if (!/^[A-Za-z0-9]/.test(name) || !/[A-Za-z0-9]$/.test(name)) return 'it must start and end with a letter or digit';
  return null;
}

/** @param {string} name */
function cargoCrateNameError(name) {
  if (/^[0-9]/.test(name)) return 'it must not start with a digit';
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return 'use only letters, digits, "-" and "_"';
  if (RUST_KEYWORDS.has(name)) return `"${name}" is a Rust keyword`;
  if (CARGO_RESERVED.has(name)) return `"${name}" is reserved by Cargo`;
  return null;
}

/** Last element of `github.com/<owner>/<name>`. */
function goModuleElementError(name) {
  if (name.endsWith('.')) return 'it must not end with "."';
  if (WINDOWS_RESERVED_RE.test(name.split('.')[0])) return `"${name}" is a reserved name on Windows`;
  return null;
}

/** The C# template uses the name, with "-" turned into "_", as its namespace. */
function csharpNamespaceError(name) {
  for (const part of name.replace(/-/g, '_').split('.')) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) return 'each dot-separated part must start with a letter or "_"';
    if (CSHARP_KEYWORDS.has(part)) return `"${part}" is a C# keyword`;
  }
  return null;
}

// The Java template uses the name only as the Maven artifactId, which the GitHub rule already covers.
const LANGUAGE_RULES = {
  javascript: { label: 'npm package name', check: npmPackageNameError },
  typescript: { label: 'npm package name', check: npmPackageNameError },
  python: { label: 'Python project name', check: pythonProjectNameError },
  rust: { label: 'Cargo crate name', check: cargoCrateNameError },
  go: { label: 'Go module path element', check: goModuleElementError },
  csharp: { label: 'C# namespace', check: csharpNamespaceError },
};

/**
 * @param {string | null | undefined} owner
 * @returns {string | null}
 */
export function validateGithubOwner(owner) {
  const value = String(owner ?? '').trim();
  if (!value) return 'GitHub owner / org is required.';
  if (!GITHUB_OWNER_RE.test(value)) {
    return `GitHub owner "${value}" is not a valid GitHub user or organization name: use 1-39 letters, digits or single hyphens, not starting or ending with a hyphen.`;
  }
  return null;
}

/**
 * @param {string | null | undefined} name
 * @param {string | null} [language] template language; null checks only the rules every template shares
 * @returns {string | null}
 */
export function validateProjectName(name, language = null) {
  const value = String(name ?? '');
  if (!value.trim()) return 'A project name is required (e.g. "my-app").';
  if (/[/\\]/.test(value) || /^[.-]/.test(value)) {
    return `Project name "${value}" must be a single directory name: no "/" or "\\", and no leading "." or "-".`;
  }
  if (!GITHUB_REPO_RE.test(value)) {
    return `Project name "${value}" is not a valid GitHub repository name: use only letters, digits, ".", "-" and "_" (at most 100 characters).`;
  }
  const rule = language && LANGUAGE_RULES[language];
  const reason = rule ? rule.check(value) : null;
  if (reason) return `Project name "${value}" is not a valid ${rule.label}: ${reason}.`;
  return null;
}

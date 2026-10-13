/**
 * Deep-merge a layer patch into package.json with deterministic conflict reporting.
 */

/** @typedef {{ path: string, existing: unknown, incoming: unknown, kept: unknown }} MergeConflict */

/**
 * Parse a loose semver core (x.y.z) from npm version strings.
 * @param {string} version
 * @returns {[number, number, number] | null}
 */
function parseSemverCore(version) {
  if (typeof version !== 'string') return null;
  const match = version.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} positive if a > b
 */
export function compareSemverLoose(a, b) {
  const pa = parseSemverCore(a);
  const pb = parseSemverCore(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * @param {string} dotPath e.g. "scripts.test"
 * @param {unknown} existing
 * @param {unknown} incoming
 * @param {MergeConflict[]} conflicts
 */
function recordConflict(dotPath, existing, incoming, conflicts, kept) {
  conflicts.push({ path: dotPath, existing, incoming, kept });
}

const DEP_BUCKETS = new Set([
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]);

/**
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} patch
 * @param {MergeConflict[]} conflicts
 * @param {string} [pathPrefix]
 * @returns {Record<string, any>}
 */
export function mergePackageJson(target, patch, conflicts = [], pathPrefix = '') {
  const out = { ...target };
  for (const [key, val] of Object.entries(patch)) {
    const dotPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (Array.isArray(val)) {
      const existing = Array.isArray(out[key]) ? out[key] : [];
      out[key] = [...existing, ...val.filter((v) => !existing.includes(v))];
      continue;
    }

    if (val && typeof val === 'object') {
      const existingObj =
        out[key] && typeof out[key] === 'object' && !Array.isArray(out[key]) ? out[key] : {};

      if (DEP_BUCKETS.has(key) || key === 'scripts') {
        const merged = { ...existingObj };
        for (const [subKey, subVal] of Object.entries(val)) {
          const subPath = `${dotPath}.${subKey}`;
          if (subKey in merged) {
            if (merged[subKey] === subVal) continue;
            if (DEP_BUCKETS.has(key)) {
              const cmp = compareSemverLoose(String(subVal), String(merged[subKey]));
              const kept = cmp > 0 ? subVal : merged[subKey];
              recordConflict(subPath, merged[subKey], subVal, conflicts, kept);
              merged[subKey] = kept;
            } else {
              // scripts: keep existing on collision
              recordConflict(subPath, merged[subKey], subVal, conflicts, merged[subKey]);
            }
          } else {
            merged[subKey] = subVal;
          }
        }
        out[key] = merged;
      } else {
        out[key] = mergePackageJson(
          /** @type {Record<string, unknown>} */ (existingObj),
          /** @type {Record<string, unknown>} */ (val),
          conflicts,
          dotPath,
        );
      }
      continue;
    }

    if (key in out && out[key] !== val) {
      recordConflict(dotPath, out[key], val, conflicts, out[key]);
    }
    if (!(key in out)) {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Detect JSON indentation from raw file content (2 or 4 spaces).
 * @param {string} raw
 */
export function detectJsonIndent(raw) {
  const match = raw.match(/^(\s+)"/m);
  if (!match) return 2;
  return match[1].length === 4 ? 4 : 2;
}

const DEPENDENCY_KEYS = [
  'bundledDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'dependencies',
  'dependenciesMeta',
  'optionalDependencies',
  'devDependencies',
  'overrides',
  'resolutions',
];

// The order prettier-plugin-pkg (in the JS/TS scaffolds' Prettier config) gives package.json keys,
// so a package.json skeletor writes is already formatted: these keys in this order, then any others
// alphabetically. The plugin also sorts the keys of SORTED_OBJECTS and the `files` list.
const KEY_ORDER = [
  '$schema', 'name', 'version', 'type', 'flat', 'displayName', 'description', 'categories', 'repository',
  'homepage', 'bugs', 'author', 'publisher', 'maintainers', 'contributors', 'donate', 'funding', 'sponsor',
  'license', 'preview', 'private', 'workspaces', 'languageName', 'packageManager', 'engines', 'cpu', 'os', 'libc',
  'devEngines', 'man', 'bin', 'main', 'types', 'typings', 'typesVersions', 'module', 'imports', 'exports',
  'esnext', 'es2020', 'esm2020', 'fesm2020', 'es2015', 'esm2015', 'fesm2015', 'es5', 'esm5', 'fesm5', 'browser',
  'umd', 'jsdelivr', 'unpkg', 'directories', 'files', 'keywords', 'scripts', 'config', ...DEPENDENCY_KEYS,
  'publishConfig', 'sideEffects', 'icon', 'badges', 'galleryBanner', 'activationEvents', 'contributes', 'markdown',
  'qna', 'extensionPack', 'extensionDependencies', 'extensionKind',
];
const SORTED_OBJECTS = new Set(['engines', 'devEngines', 'scripts', ...DEPENDENCY_KEYS]);

/**
 * @param {[string, unknown]} a
 * @param {[string, unknown]} b
 */
const byKey = ([a], [b]) => (a > b ? 1 : a < b ? -1 : 0);

/**
 * @param {Record<string, unknown>} pkg
 * @returns {Record<string, unknown>} the same fields in prettier-plugin-pkg's order
 */
function sortPackageJson(pkg) {
  const entries = Object.entries(pkg);
  const known = entries.filter(([k]) => KEY_ORDER.includes(k)).sort(([a], [b]) => KEY_ORDER.indexOf(a) - KEY_ORDER.indexOf(b));
  const others = entries.filter(([k]) => !KEY_ORDER.includes(k)).sort(byKey);
  return Object.fromEntries(
    [...known, ...others].map(([key, value]) => {
      if (SORTED_OBJECTS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
        return [key, Object.fromEntries(Object.entries(value).sort(byKey))];
      }
      if (key === 'files' && Array.isArray(value)) return [key, sortFiles(value)];
      return [key, value];
    }),
  );
}

/** Plain entries sorted, then README and LICENSE, then `!` negations sorted. */
function sortFiles(files) {
  const lower = (f) => String(f).toLowerCase();
  const special = (f) => ['readme', 'readme.md', 'license'].includes(lower(f));
  const plain = files.filter((f) => !special(f) && !String(f).startsWith('!')).sort();
  const negations = files.filter((f) => !special(f) && String(f).startsWith('!')).sort();
  const readme = files.filter((f) => ['readme', 'readme.md'].includes(lower(f)));
  const license = files.filter((f) => lower(f) === 'license');
  return [...plain, ...readme, ...license, ...negations];
}

/**
 * @param {Record<string, unknown>} obj
 * @param {number} indent
 */
export function serializePackageJson(obj, indent = 2) {
  return `${JSON.stringify(sortPackageJson(obj), null, indent)}\n`;
}
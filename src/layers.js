import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatConfigJson } from './features.js';
import { detectJsonIndent, mergePackageJson, serializePackageJson } from './merge-package-json.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const LAYERS_DIR = path.join(ROOT, 'layers');
const BUNDLES_PATH = path.join(ROOT, 'bundles.json');

const FORBIDDEN_POST_APPLY = /\b(git\s+push|npm\s+publish|release:(major|minor|patch))\b/i;

/**
 * @param {string} content
 * @param {Record<string, string|number>} vars
 */
function renderLayerContent(content, vars) {
  let out = content;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return out;
}

/** Map layer file paths that cannot be tracked (e.g. .env.*) to project output paths. */
function resolveLayerOutputPath(relPath) {
  if (relPath === 'env.example' || relPath.endsWith('/env.example')) {
    return relPath.replace(/(^|\/)env\.example$/, '$1.env.example');
  }
  return relPath;
}

export function loadBundles() {
  if (!fs.existsSync(BUNDLES_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(BUNDLES_PATH, 'utf8'));
  } catch {
    return {};
  }
}

let cachedLayerIds = null;

function getAvailableLayerIds() {
  if (cachedLayerIds !== null) return cachedLayerIds;
  if (!fs.existsSync(LAYERS_DIR)) {
    cachedLayerIds = [];
    return cachedLayerIds;
  }
  cachedLayerIds = fs.readdirSync(LAYERS_DIR).filter((d) => {
    const p = path.join(LAYERS_DIR, d);
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'layer.json'));
  });
  return cachedLayerIds;
}

function loadLayerManifest(layerDirName) {
  const dir = path.join(LAYERS_DIR, layerDirName);
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'layer.json'), 'utf8'));
  return { ...raw, dir, dirName: layerDirName };
}

export function getLayersWithManifests() {
  return getAvailableLayerIds().map((id) => loadLayerManifest(id));
}

/**
 * Map layer id (may contain ':') to directory name.
 * @param {string} layerId
 */
function layerIdToDirName(layerId) {
  const direct = path.join(LAYERS_DIR, layerId);
  if (fs.existsSync(direct)) return layerId;
  const dashed = layerId.replace(/:/g, '-');
  if (fs.existsSync(path.join(LAYERS_DIR, dashed))) return dashed;
  return dashed;
}

export function loadLayerById(layerId) {
  const dirName = layerIdToDirName(layerId);
  const manifest = loadLayerManifest(dirName);
  if (manifest.id !== layerId) {
    throw new Error(`Layer directory "${dirName}" id mismatch: expected "${layerId}", got "${manifest.id}"`);
  }
  return manifest;
}

function templateToLanguage(template) {
  const map = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    go: 'go',
    rust: 'rust',
    java: 'java',
    csharp: 'csharp',
  };
  return map[template] || template;
}

/**
 * @param {Record<string, any>} layer
 * @param {{ template: string, language: string }} ctx
 */
export function layerAppliesTo(layer, ctx) {
  const applies = layer.appliesTo || {};
  const langs = applies.languages || ['*'];
  const templates = applies.templates || ['*'];
  const excludes = applies.excludes || [];

  if (excludes.includes(ctx.template) || excludes.includes(ctx.language)) return false;
  const langOk = langs.includes('*') || langs.includes(ctx.language);
  const tmplOk = templates.includes('*') || templates.includes(ctx.template);
  return langOk && tmplOk;
}

/**
 * Topological sort with requires; auto-add required layers.
 * @param {string[]} requestedIds
 * @param {{ template: string, language: string }} ctx
 */
export function resolveLayerOrder(requestedIds, ctx) {
  const all = getLayersWithManifests();
  const byId = new Map(all.map((l) => [l.id, l]));
  const resolved = new Set();
  const order = [];
  const autoAdded = [];
  const errors = [];

  function visit(id, stack = new Set()) {
    if (resolved.has(id)) return;
    if (stack.has(id)) {
      errors.push(`Circular layer dependency involving "${id}"`);
      return;
    }
    const layer = byId.get(id);
    if (!layer) {
      errors.push(`Unknown layer "${id}"`);
      return;
    }
    if (!layerAppliesTo(layer, ctx)) {
      errors.push(`Layer "${id}" does not apply to ${ctx.template}/${ctx.language}`);
      return;
    }
    stack.add(id);
    for (const req of layer.requires || []) {
      if (!requestedIds.includes(req) && !resolved.has(req)) {
        autoAdded.push(req);
      }
      visit(req, stack);
    }
    stack.delete(id);
    if (!resolved.has(id)) {
      resolved.add(id);
      order.push(id);
    }
  }

  for (const id of requestedIds) visit(id);
  for (const id of autoAdded) {
    if (!resolved.has(id)) visit(id);
  }

  for (const id of order) {
    const layer = byId.get(id);
    for (const conflict of layer.conflicts || []) {
      if (order.includes(conflict)) {
        errors.push(`Layer "${id}" conflicts with "${conflict}"`);
      }
    }
  }

  return { order, autoAdded: [...new Set(autoAdded)], errors };
}

/**
 * @param {string} bundleName
 * @param {string} [templateId]
 */
export function expandBundle(bundleName, templateId) {
  const bundles = loadBundles();
  const bundle = bundles[bundleName];
  if (!bundle) {
    throw new Error(`Unknown bundle "${bundleName}". Available: ${Object.keys(bundles).join(', ') || '(none)'}`);
  }
  if (bundle.template && templateId && bundle.template !== templateId) {
    throw new Error(`Bundle "${bundleName}" requires template "${bundle.template}", got "${templateId}"`);
  }
  return bundle.layers || [];
}

function listLayerFiles(layer, filesDir) {
  const results = [];
  function walk(src, rel = '') {
    if (!fs.existsSync(src)) return;
    for (const entry of fs.readdirSync(src)) {
      const srcPath = path.join(src, entry);
      const relPath = rel ? path.join(rel, entry) : entry;
      if (fs.statSync(srcPath).isDirectory()) {
        walk(srcPath, relPath);
      } else {
        results.push({ srcPath, relPath });
      }
    }
  }
  walk(filesDir);
  return results;
}

/**
 * Some layers ship both a .js and a .ts variant of the same file (e.g. zod-config's
 * env.config.js/.ts) so they can apply to both the javascript and typescript templates.
 * Drop whichever twin doesn't match the target language so both never land in the same project.
 * @param {{ srcPath: string, relPath: string }[]} fileEntries
 * @param {{ language: string }} ctx
 */
function filterFilesByLanguage(fileEntries, ctx) {
  const preferredExt = ctx.language === 'typescript' ? '.ts' : '.js';
  const droppedExt = preferredExt === '.ts' ? '.js' : '.ts';
  const basenames = new Set(fileEntries.filter((f) => f.relPath.endsWith(preferredExt)).map((f) => f.relPath.slice(0, -preferredExt.length)));
  return fileEntries.filter((f) => {
    if (!f.relPath.endsWith(droppedExt)) return true;
    return !basenames.has(f.relPath.slice(0, -droppedExt.length));
  });
}

/**
 * Registers a layer's public-API or harness files as knip entry points, so their exports and the
 * dependencies they import aren't reported as dead code before the project starts using them.
 * @param {string} projectDir
 * @param {string[]} entries
 */
function addKnipEntries(projectDir, entries) {
  const knipPath = path.join(projectDir, 'knip.json');
  if (!fs.existsSync(knipPath)) return;
  const knip = JSON.parse(fs.readFileSync(knipPath, 'utf8'));
  knip.entry = [...new Set([...(knip.entry || []), ...entries])];
  fs.writeFileSync(knipPath, formatConfigJson(knip), 'utf8');
}

/**
 * Appends the output paths a layer's tools create (reports, build dirs) to .gitignore under a
 * comment naming the layer, skipping patterns the file already has.
 * @param {string} projectDir
 * @param {string} layerName
 * @param {string[]} entries
 */
function addGitignoreEntries(projectDir, layerName, entries) {
  const ignorePath = path.join(projectDir, '.gitignore');
  const existing = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
  const have = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const missing = [...new Set(entries)].filter((e) => !have.has(e));
  if (!missing.length) return;
  const prefix = existing ? `${existing.trimEnd()}\n\n` : '';
  fs.writeFileSync(ignorePath, `${prefix}# ${layerName}\n${missing.join('\n')}\n`, 'utf8');
}

/**
 * The package.json merge keeps a value the template already has. `patch.packageJsonOverride` lists
 * key paths (`main`, `scripts.start`) whose value in the layer's patch replaces the template's
 * instead; a `null` value removes the key (`private`). Paths the patch doesn't set are skipped.
 * @param {Record<string, any>} pkg merged package.json, updated in place
 * @param {Record<string, any>} patch the layer's package.json patch for this language
 * @param {string[]} [paths]
 * @returns {string[]} the paths applied, whose merge conflicts they settle
 */
export function applyPackageJsonOverride(pkg, patch, paths = []) {
  const applied = [];
  for (const dotPath of paths) {
    const keys = dotPath.split('.');
    const last = keys.pop();
    const source = keys.reduce((obj, key) => obj?.[key], patch);
    if (!source || typeof source !== 'object' || !(last in source)) continue;
    let target = pkg;
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    }
    if (source[last] === null) delete target[last];
    else target[last] = source[last];
    applied.push(dotPath);
  }
  return applied;
}

/**
 * `patch.packageJson` is either one patch file for every language, or a map of language → file
 * for layers whose dependencies differ (e.g. a CommonJS-compatible major for the javascript template).
 * @param {{ patch?: { packageJson?: string | Record<string, string> } }} layer
 * @param {string} language
 * @returns {string | null}
 */
function resolvePackageJsonPatch(layer, language) {
  const spec = layer.patch?.packageJson;
  if (!spec) return null;
  if (typeof spec === 'string') return spec;
  return spec[language] || null;
}

/**
 * Returns AGENTS.md content with `snippet` at the end of its `## <section>`, before the next
 * level-1 or level-2 heading. The heading is added at the end of the file only when it's missing.
 * Headings inside fenced code blocks don't count.
 * @param {string} agentsPath
 * @param {string} section
 * @param {string} snippet
 */
export function appendAgentsSection(agentsPath, section, snippet) {
  const heading = `## ${section}`;
  const content = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
  const block = snippet.trim();
  const lines = content.split('\n');
  let start = -1;
  let end = lines.length;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (inFence) continue;
    if (start === -1) {
      if (lines[i].trimEnd() === heading) start = i;
    } else if (/^#{1,2}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (start === -1) {
    return `${content.trimEnd()}${content.trim() ? '\n\n' : ''}${heading}\n\n${block}\n`;
  }
  const before = lines.slice(0, end).join('\n').trimEnd();
  const after = lines.slice(end).join('\n');
  return after ? `${before}\n\n${block}\n\n${after}` : `${before}\n\n${block}\n`;
}

const LABELS_SECTION = 'Issue labels';

/**
 * The `gh label create` command for one label, double-quoted for the shell; `--force` keeps it idempotent.
 * Both the AGENTS.md seed and the post-scaffold hint print it.
 * @param {{ name: string, color: string, description?: string }} label
 */
export function labelCreateCommand(label) {
  const quote = (s) => `"${String(s).replace(/(["\\$`])/g, '\\$1')}"`;
  return `gh label create ${quote(label.name)} --color ${label.color} --description ${quote(label.description || '')} --force`;
}

/**
 * AGENTS.md text listing every label the applied layers declare, with the commands that create them.
 * @param {{ name: string, color: string, description?: string }[]} labels
 */
export function buildLabelSeed(labels) {
  const names = labels.map((l) => `\`${l.name}\``).join(', ');
  const commands = labels.map(labelCreateCommand);
  return [
    `This repo's issue templates and conventions use these labels: ${names}. \`skeletor new --github\` creates them;`,
    'otherwise run:',
    '',
    '```bash',
    ...commands,
    '```',
  ].join('\n');
}

/**
 * @param {object} options
 */
function planLayerApply(options) {
  const { projectDir, layerIds, vars = {}, force = false, template } = options;

  if (!template) {
    throw new Error('planLayerApply requires a template id (layers apply only at scaffold time).');
  }
  const ctx = { template, language: templateToLanguage(template) };

  const { order, autoAdded, errors } = resolveLayerOrder(layerIds, ctx);
  if (errors.length) {
    return { ok: false, errors, plan: null };
  }

  const plan = {
    layers: [],
    autoAdded,
    conflicts: [],
    postApply: [],
  };

  for (const id of order) {
    const layer = loadLayerById(id);
    const filesDir = path.join(layer.dir, layer.files?.dir || 'files');
    const fileEntries = filterFilesByLanguage(listLayerFiles(layer, filesDir), ctx);
    const layerPlan = {
      id,
      files: [],
      packageJsonPatch: null,
      agentsSection: null,
      postApply: layer.postApply || [],
    };

    for (const { srcPath, relPath } of fileEntries) {
      let outRel = relPath.endsWith('.tmpl') ? relPath.slice(0, -'.tmpl'.length) : relPath;
      outRel = resolveLayerOutputPath(outRel);
      const dest = path.join(projectDir, outRel);
      const exists = fs.existsSync(dest);
      let action = 'add';
      if (exists) {
        const onConflict = layer.files?.onConflict || 'skip';
        const overwrite = layer.files?.overwrite === true;
        if (!overwrite && onConflict === 'skip' && !force) {
          const existing = fs.readFileSync(dest, 'utf8');
          let incoming = fs.readFileSync(srcPath, 'utf8');
          incoming = renderLayerContent(incoming, vars);
          if (existing !== incoming) {
            action = 'skip-conflict';
          } else {
            action = 'unchanged';
          }
        } else if (onConflict === 'error' && !force) {
          action = 'error-conflict';
        } else {
          action = 'replace';
        }
      }
      layerPlan.files.push({ relPath: outRel, action, srcPath });
    }

    const patchRel = resolvePackageJsonPatch(layer, ctx.language);
    if (patchRel) {
      const patchPath = path.join(layer.dir, patchRel);
      if (fs.existsSync(patchPath)) {
        const patchRaw = renderLayerContent(fs.readFileSync(patchPath, 'utf8'), vars);
        layerPlan.packageJsonPatch = JSON.parse(patchRaw);
      }
    }

    if (layer.docs?.agents) {
      layerPlan.agentsSection = {
        section: layer.docs.agents.section,
        appendPath: path.join(layer.dir, layer.docs.agents.append),
      };
    }

    plan.layers.push(layerPlan);
    plan.postApply.push(...(layer.postApply || []).filter((c) => !FORBIDDEN_POST_APPLY.test(c)));
  }

  return { ok: true, errors: [], plan, ctx };
}

/**
 * @param {object} options
 */
export function applyLayers(options) {
  const dryRun = !!options.dryRun;
  const planResult = planLayerApply(options);
  if (!planResult.ok) return planResult;

  const { plan } = planResult;
  const allConflicts = [];

  if (dryRun) {
    return { ...planResult, applied: [], conflicts: allConflicts, dryRun: true };
  }

  const applied = [];
  const labels = [];
  const projectDir = options.projectDir;
  const vars = options.vars || {};

  for (const layerPlan of plan.layers) {
    const layer = loadLayerById(layerPlan.id);

    for (const file of layerPlan.files) {
      if (file.action === 'skip-conflict' || file.action === 'unchanged') continue;
      if (file.action === 'error-conflict' && !options.force) {
        throw new Error(`File conflict: ${file.relPath} (use --force to overwrite)`);
      }
      let content = fs.readFileSync(file.srcPath, 'utf8');
      content = renderLayerContent(content, vars);
      const dest = path.join(projectDir, resolveLayerOutputPath(file.relPath));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, 'utf8');
    }

    if (layerPlan.packageJsonPatch && fs.existsSync(path.join(projectDir, 'package.json'))) {
      const pkgPath = path.join(projectDir, 'package.json');
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const indent = detectJsonIndent(raw);
      const target = JSON.parse(raw);
      const conflicts = [];
      const merged = mergePackageJson(target, layerPlan.packageJsonPatch, conflicts);
      const overridden = applyPackageJsonOverride(merged, layerPlan.packageJsonPatch, layer.patch?.packageJsonOverride);
      allConflicts.push(...conflicts.filter((c) => !overridden.some((p) => c.path === p || c.path.startsWith(`${p}.`))));
      fs.writeFileSync(pkgPath, serializePackageJson(merged, indent), 'utf8');
    }

    if (layerPlan.agentsSection && fs.existsSync(layerPlan.agentsSection.appendPath)) {
      const agentsPath = path.join(projectDir, 'AGENTS.md');
      const snippet = fs.readFileSync(layerPlan.agentsSection.appendPath, 'utf8');
      const updated = appendAgentsSection(agentsPath, layerPlan.agentsSection.section, renderLayerContent(snippet, vars));
      fs.writeFileSync(agentsPath, updated, 'utf8');
    }

    if (Array.isArray(layer.knip?.entry)) addKnipEntries(projectDir, layer.knip.entry);

    if (Array.isArray(layer.gitignore)) {
      addGitignoreEntries(
        projectDir,
        layer.name || layer.id,
        layer.gitignore.map((e) => renderLayerContent(e, vars))
      );
    }

    if (Array.isArray(layer.labels)) labels.push(...layer.labels);

    applied.push(layerPlan.id);
  }

  const seenLabels = new Set();
  const repoLabels = labels.filter((l) => !seenLabels.has(l.name) && seenLabels.add(l.name));
  if (repoLabels.length) {
    const agentsPath = path.join(projectDir, 'AGENTS.md');
    fs.writeFileSync(agentsPath, appendAgentsSection(agentsPath, LABELS_SECTION, buildLabelSeed(repoLabels)), 'utf8');
  }

  if (!options.noInstall && applied.length) {
    for (const cmd of plan.postApply) {
      if (FORBIDDEN_POST_APPLY.test(cmd)) continue;
      try {
        execSync(cmd, { cwd: projectDir, stdio: 'inherit' });
      } catch {
        // postApply is best-effort
      }
    }
  }

  return {
    ...planResult,
    applied,
    labels: repoLabels,
    conflicts: allConflicts,
    dryRun: false,
  };
}

/**
 * Seeds .github/docs-policy.yml with exactly the Markdown files the scaffold emitted,
 * so the docs-policy check passes on the first commit and flags anything added later.
 * @param {string} projectDir
 */
export function writeDocsPolicyAllowlist(projectDir) {
  const found = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relPath);
      else if (entry.name.endsWith('.md')) found.push(relPath);
    }
  };
  walk(projectDir, '');
  const lines = [
    '# Exact allowlist of Markdown files in this repo, enforced by the docs-policy workflow',
    '# (.github/scripts/check-docs-policy.sh). A tracked *.md not listed here, and not under an',
    '# exempt_globs prefix, fails CI. Add new docs here deliberately, in the same PR.',
    '',
    'allowed:',
    ...found.sort().map((f) => `  - ${f}`),
    '',
    '# Directory prefixes whose Markdown is exempt, e.g. "fixtures/**".',
    'exempt_globs:',
    '',
  ];
  const dest = path.join(projectDir, '.github', 'docs-policy.yml');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, lines.join('\n'), 'utf8');
}

export function validateLayerManifests() {
  const errors = [];
  for (const dirName of getAvailableLayerIds()) {
    const layer = loadLayerManifest(dirName);
    if (!layer.id) errors.push(`${dirName}: missing id`);
    if (!layer.appliesTo) errors.push(`${layer.id}: missing appliesTo`);
    // Layers ship fixed defaults; a value worth changing is changed in the generated project.
    if (layer.prompts) errors.push(`${layer.id}: layers take no prompts; use a fixed default`);

    const filesDir = path.join(layer.dir, layer.files?.dir || 'files');
    if (layer.files && !fs.existsSync(filesDir)) {
      errors.push(`${layer.id}: files dir missing: ${filesDir}`);
    }

    const patchSpec = layer.patch?.packageJson;
    for (const rel of typeof patchSpec === 'object' && patchSpec ? Object.values(patchSpec) : patchSpec ? [patchSpec] : []) {
      if (!fs.existsSync(path.join(layer.dir, rel))) errors.push(`${layer.id}: patch missing: ${rel}`);
    }

    for (const label of layer.labels || []) {
      if (!label?.name || !/^[0-9A-Fa-f]{6}$/.test(label.color || '')) {
        errors.push(`${layer.id}: labels need a name and a 6-digit hex color`);
      }
    }

    const override = layer.patch?.packageJsonOverride;
    if (override !== undefined) {
      if (!Array.isArray(override) || !override.every((p) => typeof p === 'string' && /^[^.]+(\.[^.]+)*$/.test(p))) {
        errors.push(`${layer.id}: patch.packageJsonOverride must be an array of package.json key paths`);
      } else {
        const patchFiles = typeof patchSpec === 'object' && patchSpec ? Object.values(patchSpec) : patchSpec ? [patchSpec] : [];
        if (!patchFiles.length) errors.push(`${layer.id}: patch.packageJsonOverride needs patch.packageJson`);
        for (const rel of patchFiles.filter((f) => fs.existsSync(path.join(layer.dir, f)))) {
          const patch = JSON.parse(fs.readFileSync(path.join(layer.dir, rel), 'utf8'));
          for (const dotPath of override) {
            const keys = dotPath.split('.');
            const parent = keys.slice(0, -1).reduce((obj, key) => obj?.[key], patch);
            if (!parent || typeof parent !== 'object' || !(keys.at(-1) in parent)) {
              errors.push(`${layer.id}: patch.packageJsonOverride path "${dotPath}" is not set in ${rel}`);
            }
          }
        }
      }
    }

    // License defaults live in src/license.js; a layer can't change them.
    if ('defaults' in layer) {
      errors.push(`${layer.id}: "defaults" is not supported; the license rule for publishing layers is in src/license.js`);
    }

    // Layers either work alone or declare `requires`, which is auto-applied; a soft dependency is never read.
    if ('recommends' in layer) {
      errors.push(`${layer.id}: "recommends" is not supported; use "requires" for a layer this one can't work without`);
    }

    // A layer's checks join the scaffold's CI job unless they run in a workflow the layer ships.
    if (layer.ciWorkflow !== undefined && !fs.existsSync(path.join(filesDir, '.github', 'workflows', String(layer.ciWorkflow)))) {
      errors.push(`${layer.id}: ciWorkflow "${layer.ciWorkflow}" is not a workflow the layer ships`);
    }

    const ignores = layer.gitignore;
    if (ignores !== undefined && (!Array.isArray(ignores) || !ignores.every((e) => typeof e === 'string' && e.trim() && !/[\r\n]/.test(e)))) {
      errors.push(`${layer.id}: gitignore must be an array of single-line patterns`);
    }

    if (layer.docs?.agents?.append) {
      const p = path.join(layer.dir, layer.docs.agents.append);
      if (!fs.existsSync(p)) errors.push(`${layer.id}: agents snippet missing`);
    }
  }
  return errors;
}

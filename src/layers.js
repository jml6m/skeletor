import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  mergePackageJson,
  detectJsonIndent,
  serializePackageJson,
} from './merge-package-json.js';
import {
  readProjectManifest,
  writeProjectManifest,
  isLayerApplied,
  recordLayerApplied,
} from './manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(__dirname, '..');
export const LAYERS_DIR = path.join(ROOT, 'layers');
export const BUNDLES_PATH = path.join(ROOT, 'bundles.json');

const FORBIDDEN_POST_APPLY = /\b(git\s+push|npm\s+publish|release:(major|minor|patch))\b/i;

/**
 * @param {string} content
 * @param {Record<string, string|number>} vars
 */
export function renderLayerContent(content, vars) {
  let out = content;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return out;
}

/** Map layer file paths that cannot be tracked (e.g. .env.*) to project output paths. */
export function resolveLayerOutputPath(relPath) {
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

export function getAvailableLayerIds() {
  if (!fs.existsSync(LAYERS_DIR)) return [];
  return fs
    .readdirSync(LAYERS_DIR)
    .filter((d) => {
      const p = path.join(LAYERS_DIR, d);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'layer.json'));
    });
}

export function loadLayerManifest(layerDirName) {
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
export function layerIdToDirName(layerId) {
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

/**
 * @param {string} projectDir
 */
export function inferProjectContext(projectDir) {
  const existing = readProjectManifest(projectDir);
  if (existing) {
    return {
      template: existing.template || 'unknown',
      language: templateToLanguage(existing.template),
      manifest: existing,
      adoptedExisting: !!existing.adoptedExisting,
    };
  }

  if (fs.existsSync(path.join(projectDir, 'tsconfig.json'))) {
    return { template: 'typescript', language: 'typescript', manifest: null, adoptedExisting: true };
  }
  if (fs.existsSync(path.join(projectDir, 'package.json'))) {
    return { template: 'javascript', language: 'javascript', manifest: null, adoptedExisting: true };
  }
  if (fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
    return { template: 'rust', language: 'rust', manifest: null, adoptedExisting: true };
  }
  if (fs.existsSync(path.join(projectDir, 'go.mod'))) {
    return { template: 'go', language: 'go', manifest: null, adoptedExisting: true };
  }
  if (fs.existsSync(path.join(projectDir, 'pyproject.toml'))) {
    return { template: 'python', language: 'python', manifest: null, adoptedExisting: true };
  }
  if (fs.existsSync(path.join(projectDir, 'pom.xml'))) {
    return { template: 'java', language: 'java', manifest: null, adoptedExisting: true };
  }
  const csprojs = fs.readdirSync(projectDir).filter((f) => f.endsWith('.csproj'));
  if (csprojs.length) {
    return { template: 'csharp', language: 'csharp', manifest: null, adoptedExisting: true };
  }

  throw new Error('Could not infer project type. Scaffold with skeletor new or add .skeletor/manifest.json.');
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
 * @param {Record<string, unknown>} layer
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
/**
 * Collect interactive prompts for a resolved layer set (includes requires).
 * @param {string[]} layerIds
 * @param {{ template: string, language: string }} ctx
 */
export function gatherLayerPrompts(layerIds, ctx) {
  const { order, errors } = resolveLayerOrder(layerIds, ctx);
  if (errors.length) return { errors, prompts: [] };

  const prompts = [];
  const seenTokens = new Set();
  for (const id of order) {
    const layer = loadLayerById(id);
    for (const pr of layer.prompts || []) {
      if (!pr.token || seenTokens.has(pr.token)) continue;
      seenTokens.add(pr.token);
      prompts.push({ ...pr, layerId: id, layerName: layer.name });
    }
  }
  return { errors: [], prompts };
}

/** Build token defaults for non-interactive layer prompts. */
export function layerPromptDefaults(prompts) {
  const vars = {};
  for (const pr of prompts) {
    if (pr.token) vars[pr.token] = pr.default ?? '';
  }
  return vars;
}

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

/**
 * @param {string} projectDir
 */
export function isGitDirty(projectDir) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: projectDir, stdio: 'pipe' });
    const status = execSync('git status --porcelain', { cwd: projectDir, stdio: 'pipe' }).toString();
    return status.trim().length > 0;
  } catch {
    return false;
  }
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
 * @param {string} agentsPath
 * @param {string} section
 * @param {string} snippet
 */
export function appendAgentsSection(agentsPath, section, snippet) {
  const heading = `## ${section}`;
  let content = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
  if (!content.includes(heading)) {
    content = content.trimEnd() + (content ? '\n\n' : '') + `${heading}\n\n`;
  }
  const marker = `<!-- skeletor-layer:${section} -->`;
  if (content.includes(marker)) {
    const re = new RegExp(`${marker}[\\s\\S]*?<!-- /skeletor-layer:${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} -->`, 'm');
    const block = `${marker}\n${snippet.trim()}\n<!-- /skeletor-layer:${section} -->`;
    if (re.test(content)) content = content.replace(re, block);
    else content = content.trimEnd() + `\n\n${block}\n`;
  } else {
    content = content.trimEnd() + `\n\n${marker}\n${snippet.trim()}\n<!-- /skeletor-layer:${section} -->\n`;
  }
  return content;
}

/**
 * @param {object} options
 */
export function planLayerApply(options) {
  const {
    projectDir,
    layerIds,
    vars = {},
    force = false,
    skeletorVersion = '0.2.0',
    owner = null,
    template = null,
  } = options;

  const ctx = template
    ? { template, language: templateToLanguage(template), manifest: readProjectManifest(projectDir), adoptedExisting: false }
    : inferProjectContext(projectDir);

  const { order, autoAdded, errors } = resolveLayerOrder(layerIds, ctx);
  if (errors.length) {
    return { ok: false, errors, plan: null };
  }

  let manifest = ctx.manifest || {
    skeletorVersion,
    template: ctx.template,
    createdAt: new Date().toISOString().slice(0, 10),
    adoptedExisting: ctx.adoptedExisting,
    owner,
    layers: [],
    verifyCommands: [],
  };

  const plan = {
    layers: [],
    skipped: [],
    autoAdded,
    conflicts: [],
    postApply: [],
    verifyCommands: [],
  };

  for (const id of order) {
    if (isLayerApplied(manifest, id)) {
      plan.skipped.push(id);
      continue;
    }
    const layer = loadLayerById(id);
    const filesDir = path.join(layer.dir, layer.files?.dir || 'files');
    const fileEntries = listLayerFiles(layer, filesDir);
    const layerPlan = {
      id,
      files: [],
      packageJsonPatch: null,
      agentsSection: null,
      postApply: layer.postApply || [],
      verifyCommands: layer.verifyCommands || [],
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

    if (layer.patch?.packageJson) {
      const patchPath = path.join(layer.dir, layer.patch.packageJson);
      if (fs.existsSync(patchPath)) {
        layerPlan.packageJsonPatch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
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
    plan.verifyCommands.push(...(layer.verifyCommands || []));
  }

  return { ok: true, errors: [], plan, ctx, manifest };
}

/**
 * @param {object} options
 */
export function applyLayers(options) {
  const dryRun = !!options.dryRun;
  const planResult = planLayerApply(options);
  if (!planResult.ok) return planResult;

  const { plan, ctx, manifest: initialManifest } = planResult;
  let manifest = { ...initialManifest };
  const allConflicts = [];

  if (dryRun) {
    return { ...planResult, applied: [], conflicts: allConflicts, dryRun: true };
  }

  const applied = [];
  const projectDir = options.projectDir;
  const vars = options.vars || {};
  const skeletorVersion = options.skeletorVersion || '0.2.0';

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
      allConflicts.push(...conflicts);
      fs.writeFileSync(pkgPath, serializePackageJson(merged, indent), 'utf8');
    }

    if (layerPlan.agentsSection && fs.existsSync(layerPlan.agentsSection.appendPath)) {
      const agentsPath = path.join(projectDir, 'AGENTS.md');
      const snippet = fs.readFileSync(layerPlan.agentsSection.appendPath, 'utf8');
      const updated = appendAgentsSection(agentsPath, layerPlan.agentsSection.section, renderLayerContent(snippet, vars));
      fs.writeFileSync(agentsPath, updated, 'utf8');
    }

    manifest = recordLayerApplied(manifest, { id: layer.id, version: layer.version || '1.0.0' });
    manifest.skeletorVersion = skeletorVersion;
    applied.push(layerPlan.id);
  }

  const verifySet = new Set([
    ...(Array.isArray(manifest.verifyCommands) ? manifest.verifyCommands : []),
    ...plan.verifyCommands,
  ]);
  manifest.verifyCommands = [...verifySet];

  writeProjectManifest(projectDir, manifest);

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

  return { ...planResult, applied, conflicts: allConflicts, dryRun: false, manifest };
}

export function validateLayerManifests() {
  const errors = [];
  for (const dirName of getAvailableLayerIds()) {
    const layer = loadLayerManifest(dirName);
    if (!layer.id) errors.push(`${dirName}: missing id`);
    if (!layer.appliesTo) errors.push(`${layer.id}: missing appliesTo`);

    const filesDir = path.join(layer.dir, layer.files?.dir || 'files');
    if (layer.files && !fs.existsSync(filesDir)) {
      errors.push(`${layer.id}: files dir missing: ${filesDir}`);
    }

    if (layer.patch?.packageJson) {
      const p = path.join(layer.dir, layer.patch.packageJson);
      if (!fs.existsSync(p)) errors.push(`${layer.id}: patch missing: ${layer.patch.packageJson}`);
    }

    if (layer.docs?.agents?.append) {
      const p = path.join(layer.dir, layer.docs.agents.append);
      if (!fs.existsSync(p)) errors.push(`${layer.id}: agents snippet missing`);
    }
  }
  return errors;
}
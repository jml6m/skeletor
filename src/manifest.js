import fs from 'fs';
import path from 'path';

export const MANIFEST_DIR = '.skeletor';
export const MANIFEST_FILE = 'manifest.json';

/**
 * @param {string} projectDir
 */
export function manifestPath(projectDir) {
  return path.join(projectDir, MANIFEST_DIR, MANIFEST_FILE);
}

/**
 * @param {string} projectDir
 */
export function readProjectManifest(projectDir) {
  const p = manifestPath(projectDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} projectDir
 * @param {Record<string, unknown>} manifest
 */
export function writeProjectManifest(projectDir, manifest) {
  const dir = path.join(projectDir, MANIFEST_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(manifestPath(projectDir), content, 'utf8');
}

/**
 * @param {string} projectDir
 * @param {string} layerId
 */
export function isLayerApplied(manifest, layerId) {
  if (!manifest?.layers) return false;
  return manifest.layers.some((l) => l.id === layerId);
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {{ id: string, version: string }} layer
 * @param {string} [appliedAt]
 */
export function recordLayerApplied(manifest, layer, appliedAt) {
  const date = appliedAt || new Date().toISOString().slice(0, 10);
  const layers = Array.isArray(manifest.layers) ? [...manifest.layers] : [];
  const idx = layers.findIndex((l) => l.id === layer.id);
  const entry = { id: layer.id, version: layer.version, appliedAt: date };
  if (idx >= 0) layers[idx] = entry;
  else layers.push(entry);
  return { ...manifest, layers };
}
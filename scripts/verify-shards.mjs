#!/usr/bin/env node
/**
 * Shards of the template verify suite (tests/generate.test.js), and which shards a set of changed
 * files needs. One shard per template (its layouts included), plus two per JS/TS template: its
 * optional-layer cases (`<id>-layers`) and its bundle cases (`<id>-bundles`).
 *
 * CLI: changed file paths on stdin, one per line; prints the shards to run as a JSON array.
 * `--all` prints every shard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const EXTRA_SHARD_TEMPLATES = ['javascript', 'typescript'];

// A change under any of these can affect every generated project or the suite itself.
const SHARED_INPUTS = [
  /^src\//,
  /^layers\//,
  /^templates\/_shared\//,
  /^bundles\.json$/,
  /^package(-lock)?\.json$/,
  /^jest\.config\.js$/,
  /^scripts\//,
  /^tests\//,
  /^\.github\/workflows\/ci\.yml$/,
];

export function layerShard(templateId) {
  return `${templateId}-layers`;
}

export function bundleShard(templateId) {
  return `${templateId}-bundles`;
}

export function listTemplateIds(root = ROOT) {
  const dir = path.join(root, 'templates');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'template.json')))
    .map((e) => e.name)
    .sort();
}

export function listShards(root = ROOT) {
  const ids = listTemplateIds(root);
  return [...ids, ...EXTRA_SHARD_TEMPLATES.filter((id) => ids.includes(id)).flatMap((id) => [layerShard(id), bundleShard(id)])];
}

/** Shards to run for a list of changed repo-relative paths, in listShards() order. */
export function shardsForChanges(files, shards = listShards()) {
  const wanted = new Set();
  for (const file of files) {
    if (SHARED_INPUTS.some((re) => re.test(file))) return [...shards];
    const m = /^templates\/([^/]+)\//.exec(file);
    if (m) {
      wanted.add(m[1]);
      wanted.add(layerShard(m[1]));
      wanted.add(bundleShard(m[1]));
    }
  }
  return shards.filter((s) => wanted.has(s));
}

/** The shard named by SKELETOR_VERIFY_SHARD, or null for all. Throws on an unknown name. */
export function selectedShard(env = process.env, shards = listShards()) {
  const name = (env.SKELETOR_VERIFY_SHARD || '').trim();
  if (!name) return null;
  if (!shards.includes(name)) {
    throw new Error(`Unknown SKELETOR_VERIFY_SHARD "${name}". Known shards: ${shards.join(', ')}`);
  }
  return name;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--all')) {
    console.log(JSON.stringify(listShards()));
  } else {
    const files = fs.readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    console.log(JSON.stringify(shardsForChanges(files)));
  }
}

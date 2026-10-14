/**
 * Command-line parsing. Anything skeletor doesn't recognize is an error rather than ignored,
 * so a typo can't silently produce a different scaffold.
 */

import { closestMatch } from './suggest.js';

export class UsageError extends Error {}

const VALUE_FLAGS = {
  '--template': 'template',
  '-t': 'template',
  '--layout': 'layout',
  '--with': 'withLayers',
  '--bundle': 'bundle',
  '--owner': 'owner',
  '-o': 'owner',
  '--description': 'description',
  '-d': 'description',
};

const BOOLEAN_FLAGS = {
  '--auto': ['auto', true],
  '--no-git': ['git', false],
  '--github': ['github', true],
  '--private': ['githubPrivate', true],
  '--allow-deprecated-template': ['allowDeprecatedTemplate', true],
};

/** Flags that used to exist, with what replaced them. */
export const REMOVED_FLAGS = {
  '--with-recommended': "the template's baseline layers are always applied; add feature layers with --with or --bundle",
  '--codeowners': 'scaffolds no longer include .github/CODEOWNERS; add one yourself if you want code-owner review',
  '--uv': 'python scaffolds always use uv',
};

const HELP_FLAGS = ['--help', '-h'];
const VERSION_FLAGS = ['--version', '-v'];
const COMMANDS = ['new'];
/** Every flag `skeletor new` accepts, aliases included, plus --help and --version. */
export const KNOWN_FLAGS = [...Object.keys(VALUE_FLAGS), ...Object.keys(BOOLEAN_FLAGS), ...HELP_FLAGS, ...VERSION_FLAGS];

function parseCommaList(value) {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function looksLikeFlag(value) {
  return value.startsWith('--') || KNOWN_FLAGS.includes(value);
}

function didYouMean(input, candidates) {
  const match = closestMatch(input, candidates);
  return match ? ` Did you mean "${match}"?` : '';
}

/** Flag combinations that can't do what they say; null when there are none. */
export function checkFlagCombinations(opts) {
  if (opts.github && opts.git === false) {
    return '--github creates the repository from the initial commit, so it needs git: drop --no-git or --github.';
  }
  if (opts.githubPrivate && !opts.github) {
    return '--private sets the visibility of the repository --github creates: add --github or drop --private.';
  }
  return null;
}

/** The long form of a value option, for messages: `-t` → `--template`. */
function longFlag(key) {
  return Object.keys(VALUE_FLAGS).find((f) => f.startsWith('--') && VALUE_FLAGS[f] === key);
}

/**
 * @param {string[]} argv process.argv
 * @throws {UsageError} on an unknown command, unknown or removed flag, missing value, stray argument
 *   or unsupported flag combination
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    command: null,
    name: null,
    template: null,
    layout: null,
    withLayers: [],
    bundle: null,
    owner: null,
    description: null,
    auto: false,
    git: true,
    github: false,
    githubPrivate: false,
    allowDeprecatedTemplate: false,
  };

  if (args.length === 0 || args.some((a) => HELP_FLAGS.includes(a))) {
    result.command = 'help';
    return result;
  }
  if (args.some((a) => VERSION_FLAGS.includes(a))) {
    result.command = 'version';
    return result;
  }

  if (!COMMANDS.includes(args[0])) {
    throw new UsageError(`Unknown command "${args[0]}".${didYouMean(args[0], COMMANDS)} Usage: skeletor new <name> [options]`);
  }
  result.command = args[0];

  const seen = new Set();
  for (let i = 1; i < args.length; i++) {
    let flag = args[i];
    let inlineValue;
    const eq = flag.indexOf('=');
    if (flag.startsWith('--') && eq > 0) {
      inlineValue = flag.slice(eq + 1);
      flag = flag.slice(0, eq);
    }

    if (Object.hasOwn(REMOVED_FLAGS, flag)) {
      throw new UsageError(`${flag} was removed: ${REMOVED_FLAGS[flag]}.`);
    }

    if (Object.hasOwn(VALUE_FLAGS, flag)) {
      const key = VALUE_FLAGS[flag];
      const value = inlineValue ?? args[i + 1];
      if (inlineValue === undefined) i++;
      if (value === undefined || value.trim() === '' || (inlineValue === undefined && looksLikeFlag(value))) {
        throw new UsageError(`${flag} needs a value.`);
      }
      if (key === 'withLayers') {
        result.withLayers.push(...parseCommaList(value));
      } else {
        if (seen.has(key)) throw new UsageError(`${longFlag(key)} was given more than once.`);
        result[key] = value;
      }
      seen.add(key);
      continue;
    }

    if (Object.hasOwn(BOOLEAN_FLAGS, flag)) {
      if (inlineValue !== undefined) throw new UsageError(`${flag} takes no value.`);
      const [key, value] = BOOLEAN_FLAGS[flag];
      result[key] = value;
      continue;
    }

    if (flag.startsWith('-') && flag !== '-') {
      const candidates = [...KNOWN_FLAGS.filter((f) => f.startsWith('--')), ...Object.keys(REMOVED_FLAGS)];
      throw new UsageError(`Unknown option "${flag}".${didYouMean(flag, candidates)} Run "skeletor --help" for the options.`);
    }

    if (result.name === null) {
      result.name = flag;
    } else {
      throw new UsageError(`Unexpected argument "${flag}": the project name is already "${result.name}". Quote values that contain spaces.`);
    }
  }

  const combinationError = checkFlagCombinations(result);
  if (combinationError) throw new UsageError(combinationError);
  return result;
}

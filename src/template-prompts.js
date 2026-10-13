/**
 * Template-specific interactive prompts (license, stack choices).
 */

import * as p from '@clack/prompts';
import { promptSelectRecommended } from './interactive-prompts.js';

const COMMON_PROMPTS = [
  {
    id: 'license',
    token: 'LICENSE',
    message: 'License',
    options: ['MIT', 'Apache-2.0', 'UNLICENSED'],
    default: 'UNLICENSED',
    // A layer can change the default (library-publishing: MIT, so the package is publishable).
    defaultFrom: 'LICENSE',
  },
];

const TEMPLATE_PROMPTS = {
  python: [
    {
      id: 'pythonPackageManager',
      token: 'PYTHON_PACKAGE_MANAGER',
      message: 'Dependency workflow',
      options: ['pip', 'uv'],
      default: 'pip',
    },
  ],
};

/**
 * @param {string} templateId
 * @param {Record<string, string>} [defaults] token defaults from the applied layers, read through `defaultFrom`
 */
export function gatherTemplatePrompts(templateId, defaults = {}) {
  return [...COMMON_PROMPTS, ...(TEMPLATE_PROMPTS[templateId] || [])].map((pr) => ({
    ...pr,
    default: pr.defaultFrom ? defaults[pr.defaultFrom] || pr.default : pr.default,
  }));
}

/**
 * @param {ReturnType<typeof gatherTemplatePrompts>} prompts
 */
export function templatePromptDefaults(prompts) {
  const vars = {};
  for (const pr of prompts) {
    if (pr.token) vars[pr.token] = pr.default ?? '';
  }
  return vars;
}

/**
 * @param {ReturnType<typeof gatherTemplatePrompts>} prompts
 */
export async function promptForTemplateVars(prompts) {
  const vars = {};
  for (const pr of prompts) {
    const answer = await promptSelectRecommended({
      message: pr.message,
      options: pr.options,
      recommended: pr.default,
    });
    if (p.isCancel(answer)) return answer;
    vars[pr.token] = String(answer).trim() || String(pr.default ?? '');
  }
  return vars;
}

/**
 * Adjust verify commands for template-specific choices.
 * @param {string[]} verifyCommands
 * @param {Record<string, string>} vars
 */
export function adjustVerifyCommandsForAnswers(verifyCommands, vars) {
  if (vars.PYTHON_PACKAGE_MANAGER === 'uv') {
    // uv installs into its own .venv, so every later python invocation has to go through `uv run`.
    const adjusted = verifyCommands.map((cmd) => {
      if (cmd.includes('pip install')) return 'uv sync --all-extras';
      if (cmd.startsWith('python ')) return `uv run ${cmd}`;
      return cmd;
    });
    return [...new Set(adjusted)];
  }
  return verifyCommands;
}
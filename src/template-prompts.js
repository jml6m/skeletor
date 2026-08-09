/**
 * Template-specific interactive prompts (license, author, stack choices).
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
  },
  {
    id: 'author',
    token: 'AUTHOR',
    message: 'Author name (optional)',
    type: 'text',
    optional: true,
    default: '',
  },
  {
    id: 'authorEmail',
    token: 'AUTHOR_EMAIL',
    message: 'Author email (optional)',
    type: 'text',
    optional: true,
    default: '',
  },
];

const TEMPLATE_PROMPTS = {
  javascript: [
    {
      id: 'packageManager',
      token: 'PACKAGE_MANAGER',
      message: 'Package manager',
      options: ['npm', 'pnpm', 'bun'],
      default: 'npm',
    },
  ],
  typescript: [
    {
      id: 'packageManager',
      token: 'PACKAGE_MANAGER',
      message: 'Package manager',
      options: ['npm', 'pnpm', 'bun'],
      default: 'npm',
    },
  ],
  python: [
    {
      id: 'pythonVersion',
      token: 'PYTHON_VERSION',
      message: 'Python version',
      options: ['3.11', '3.12', '3.13'],
      default: '3.11',
    },
    {
      id: 'pythonPackageManager',
      token: 'PYTHON_PACKAGE_MANAGER',
      message: 'Dependency workflow',
      options: ['pip', 'uv'],
      default: 'pip',
    },
  ],
  go: [
    {
      id: 'goLayout',
      token: 'GO_LAYOUT',
      message: 'Project layout',
      options: ['binary', 'library'],
      default: 'binary',
    },
  ],
  rust: [
    {
      id: 'rustCrateType',
      token: 'RUST_CRATE_TYPE',
      message: 'Crate type',
      options: ['bin', 'lib'],
      default: 'bin',
    },
  ],
  java: [
    {
      id: 'javaGroupId',
      token: 'GROUP_ID',
      message: 'Maven groupId',
      type: 'text',
      defaultFrom: 'GROUP_ID',
    },
  ],
  csharp: [
    {
      id: 'targetFramework',
      token: 'TARGET_FRAMEWORK',
      message: 'Target framework',
      options: ['net8.0', 'net9.0'],
      default: 'net8.0',
    },
  ],
};

/**
 * @param {string} templateId
 * @param {Record<string, string>} [baseVars]
 */
export function gatherTemplatePrompts(templateId, baseVars = {}) {
  const specific = TEMPLATE_PROMPTS[templateId] || [];
  const prompts = [...COMMON_PROMPTS, ...specific].map((pr) => ({
    ...pr,
    default: pr.defaultFrom ? baseVars[pr.defaultFrom] || pr.default : pr.default,
  }));
  return prompts;
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
    let answer;
    if (pr.type === 'text') {
      answer = await p.text({
        message: pr.message,
        defaultValue: pr.default ? String(pr.default) : undefined,
        validate(value) {
          if (!pr.optional && (!value || !String(value).trim())) return 'A value is required.';
        },
      });
    } else if (pr.options?.length) {
      answer = await promptSelectRecommended({
        message: pr.message,
        options: pr.options,
        recommended: pr.default,
      });
    } else {
      answer = await p.text({
        message: pr.message,
        validate(value) {
          if (!value || !String(value).trim()) return 'A value is required.';
        },
      });
    }
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
    return verifyCommands.map((cmd) => {
      if (cmd.includes('pip install')) {
        return 'uv sync --all-extras';
      }
      return cmd;
    });
  }
  return verifyCommands;
}
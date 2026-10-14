/**
 * A scaffold's checks: the template's (or layout's) `verifyCommands`, then those of its layers.
 * This one list is AGENTS.md's Build & Test block, the README's check list, the next steps skeletor
 * prints and the steps of the scaffold's CI job, so what a developer runs and what CI gates on
 * can't drift apart. skeletor's own verify suite runs the same list.
 */

// CI installs dependencies in a step of its own, from the lockfile (`npm ci`, `uv sync --locked`).
const INSTALL_COMMANDS = new Set(['npm install', 'uv sync']);

/** The template's (or layout's) verifyCommands. */
function templateVerifyCommands(templateInfo, layoutId) {
  return [...(templateInfo.layouts?.[layoutId]?.verifyCommands || templateInfo.verifyCommands || [])];
}

/**
 * @param {object} templateInfo
 * @param {string} layoutId
 * @param {Array<{ verifyCommands?: string[], gitVerifyCommands?: string[], ciWorkflow?: string }>} layers in apply order
 * @returns {{ commands: string[], needRepo: string[], ci: string[] }} `commands` work in any scaffold,
 *   `needRepo` need a git repository, and `ci` is what the CI job runs after installing. A layer with
 *   `ciWorkflow` runs its checks in the workflow it ships instead of the CI job.
 */
export function scaffoldChecks(templateInfo, layoutId, layers = []) {
  const commands = templateVerifyCommands(templateInfo, layoutId);
  const needRepo = [];
  const ownWorkflow = new Set();
  for (const layer of layers) {
    commands.push(...(layer.verifyCommands || []));
    needRepo.push(...(layer.gitVerifyCommands || []));
    if (layer.ciWorkflow) [...(layer.verifyCommands || []), ...(layer.gitVerifyCommands || [])].forEach((cmd) => ownWorkflow.add(cmd));
  }
  const unique = [...new Set(commands)];
  const repoOnly = [...new Set(needRepo)].filter((cmd) => !unique.includes(cmd));
  const ci = [...unique, ...repoOnly].filter((cmd) => !INSTALL_COMMANDS.has(cmd) && !ownWorkflow.has(cmd));
  return { commands: unique, needRepo: repoOnly, ci };
}

function yamlScalar(value) {
  return /^[\w./@-][^#]*$/.test(value) && !/:\s|:$/.test(value) ? value : JSON.stringify(value);
}

/**
 * Render tokens for a scaffold's checks: `VERIFY_COMMANDS` (one command per line, every check)
 * and `CI_CHECK_STEPS` (one workflow step per CI check, indented for a job's `steps:` list).
 */
export function checkTokens({ commands, needRepo, ci }) {
  return {
    VERIFY_COMMANDS: [...commands, ...needRepo].join('\n'),
    CI_CHECK_STEPS: ci.map((cmd) => `      - run: ${yamlScalar(cmd)}`).join('\n'),
  };
}

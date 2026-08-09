/**
 * CODEOWNERS candidate paths + file generation.
 * Candidates are derived from what the chosen template actually generates —
 * not a fixed list — so a python scaffold isn't offered a package.json path.
 */

const BASE_CANDIDATES = [
  { path: '.github/', hint: 'CI/CD workflows and repo automation' },
  { path: 'AGENTS.md', hint: 'Agent instruction contract' },
];

const LANGUAGE_CANDIDATES = {
  javascript: [
    { path: 'package.json', hint: 'Dependencies, scripts, package metadata' },
    { path: 'release.js', hint: 'Release script' },
  ],
  typescript: [
    { path: 'package.json', hint: 'Dependencies, scripts, package metadata' },
    { path: 'release.js', hint: 'Release script' },
  ],
};

/**
 * @param {{ language?: string }} templateInfo
 */
export function computeCodeownersCandidates(templateInfo) {
  const languageCandidates = LANGUAGE_CANDIDATES[templateInfo?.language] || [];
  return [...BASE_CANDIDATES, ...languageCandidates];
}

/**
 * @param {string[]} paths
 * @param {string} owner
 */
export function buildCodeownersContent(paths, owner) {
  const header = `# CODEOWNERS — paths listed here require review from @${owner} before merge.
# This alone does nothing: the repo's branch ruleset must also have
# "Require review from Code Owners" enabled on the pull_request rule for
# these paths to actually gate merge. Scoped intentionally — no blanket
# "*" catch-all — so the rest of the repo keeps its normal review bar.
`;
  const lines = paths.map((p) => `${p.padEnd(24)}@${owner}`);
  return `${header}\n${lines.join('\n')}\n`;
}

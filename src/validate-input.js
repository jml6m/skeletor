/**
 * Checks for the project name and GitHub owner, run before anything is written to disk.
 * Each check returns null when the value is valid, otherwise a message for the user.
 */

// Valid as an npm, PEP 508, Cargo, Go and Maven name and as a GitHub repo name; no "/", "\" or ".".
const PROJECT_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PROJECT_NAME_MAX = 64;
const GITHUB_OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** A valid project name close to `name`: `My App` → `my-app`, `1app` → `app-1app`. */
export function suggestProjectName(name) {
  let slug = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (/^[0-9]/.test(slug)) slug = `app-${slug}`;
  return slug.slice(0, PROJECT_NAME_MAX).replace(/-$/, '') || 'my-app';
}

/** @param {string | null | undefined} name */
export function validateProjectName(name) {
  const value = String(name ?? '');
  if (PROJECT_NAME_RE.test(value) && value.length <= PROJECT_NAME_MAX) return null;
  return `Project names are lowercase kebab-case, starting with a letter (e.g. my-app), at most ${PROJECT_NAME_MAX} characters. Try "${suggestProjectName(value)}".`;
}

/** @param {string | null | undefined} owner */
export function validateGithubOwner(owner) {
  const value = String(owner ?? '').trim();
  if (!value) return 'GitHub owner / org is required.';
  if (GITHUB_OWNER_RE.test(value)) return null;
  return `GitHub owner "${value}" is not a valid GitHub user or organization name: use 1-39 letters, digits or single hyphens, not starting or ending with a hyphen.`;
}

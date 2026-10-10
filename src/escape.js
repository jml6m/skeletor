/**
 * The project description is free text. It is collapsed to one line, and escaped in the file
 * types where raw quotes or markup would make the file invalid. Elsewhere it goes in as-is.
 */

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

// After normalizeDescription only `\` and `"` need escaping in JSON and TOML strings.
const escapeQuoted = (value) => value.replace(/[\\"]/g, '\\$&');
const escapeXml = (value) => value.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);

const ESCAPERS = [
  [/\.(json|toml)$/i, escapeQuoted],
  [/\.(xml|csproj|props|targets)$/i, escapeXml],
];

/**
 * @param {string} filePath output path; the escaper is picked by its extension
 * @returns {((value: string) => string) | null} null when the value goes in as-is
 */
export function escaperForFile(filePath) {
  return ESCAPERS.find(([re]) => re.test(filePath))?.[1] ?? null;
}

/** One line, no control characters, and no lone surrogates (invalid in JSON, TOML and XML files). */
export function normalizeDescription(value) {
  const text = String(value ?? '');
  return (text.toWellFormed?.() ?? text).replace(/[\s\u0000-\u001f\u007f\ufffe\uffff]+/g, ' ').trim();
}

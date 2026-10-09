/**
 * Escapes free-text values (the project description) for the file they are rendered into.
 */

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const TOML_ESCAPES = { '\\': '\\\\', '"': '\\"', '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' };

/** Contents of a JSON string literal. */
export function escapeJsonString(value) {
  return JSON.stringify(String(value)).slice(1, -1);
}

/** Contents of a TOML basic string ("..."). */
export function escapeTomlString(value) {
  return String(value).replace(
    /[\\"\u0000-\u001f\u007f]/g,
    (c) => TOML_ESCAPES[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** XML text or attribute value. */
export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => XML_ENTITIES[c]);
}

/** Markdown that renders as the literal text, including at the start of a line. */
export function escapeMarkdown(value) {
  return String(value)
    .replace(/[\\`*_[\]<>|]/g, '\\$&')
    .replace(/&(?=#?\w+;)/g, '\\&')
    .replace(/^([#+=-])/, '\\$1')
    .replace(/^(\d+)([.)])/, '$1\\$2');
}

/** Text inside a Python triple-quoted docstring. */
function escapePythonString(value) {
  return String(value).replace(/[\\"]/g, '\\$&');
}

/** Javadoc is HTML, and javac reads \u escapes and the end of a comment even inside one. */
function escapeJavadoc(value) {
  return escapeXml(value).replace(/\\/g, '&#92;').replace(/\*\//g, '*&#47;');
}

// Rust doc comments (//!) are Markdown.
const ESCAPERS = [
  [/\.json$/i, escapeJsonString],
  [/\.toml$/i, escapeTomlString],
  [/\.(xml|csproj|props|targets)$/i, escapeXml],
  [/\.(md|rs)$/i, escapeMarkdown],
  [/\.py$/i, escapePythonString],
  [/\.java$/i, escapeJavadoc],
];

/**
 * @param {string} filePath output path; the escaper is picked by its extension
 * @returns {((value: string) => string) | null} null when the value goes in as-is
 */
export function escaperForFile(filePath) {
  const match = ESCAPERS.find(([re]) => re.test(filePath));
  return match ? match[1] : null;
}

/** Collapses a description to one line, since it lands in single-line strings and line comments. */
export function normalizeDescription(value) {
  return String(value ?? '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
}

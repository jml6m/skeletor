/**
 * "Did you mean" suggestions for ids typed on the command line.
 */

/** Case and punctuation don't count, so `test-harness-playwright` matches `test-harness:playwright`. */
function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Edits (insert, delete, substitute, swap two neighbours) that turn `a` into `b`. */
function editDistance(a, b) {
  let before = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
    }
    before = prev;
    prev = row;
  }
  return prev[b.length];
}

/**
 * The candidate `input` most likely meant, or null when none is close.
 * @param {string} input
 * @param {string[]} candidates
 * @returns {string | null}
 */
export function closestMatch(input, candidates) {
  const target = normalize(input);
  if (!target) return null;
  const exact = candidates.find((c) => normalize(c) === target);
  if (exact) return exact;

  const prefixed = candidates.filter((c) => normalize(c).startsWith(target));
  if (target.length >= 3 && prefixed.length === 1) return prefixed[0];

  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(target, normalize(candidate));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= Math.max(1, Math.floor(target.length / 3)) ? best : null;
}

/**
 * `Unknown template "pyhton". Did you mean "python"?` plus the valid ids on the next line.
 * @param {string} kind e.g. "template", "layout for rust"
 * @param {string} input
 * @param {string[]} candidates ids to suggest from
 * @param {{ label?: string, list?: string[] }} [options] heading and ids for the second line (default: the candidates)
 */
export function unknownIdMessage(kind, input, candidates, { label = 'Valid', list = candidates } = {}) {
  const match = closestMatch(input, candidates);
  const hint = match ? ` Did you mean "${match}"?` : '';
  return `Unknown ${kind} "${input}".${hint}\n   ${label}: ${list.join(', ') || '(none)'}`;
}

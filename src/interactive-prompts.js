/**
 * Skeletor interactive prompts — every non-auto question surfaces a (recommended) choice.
 * Text: Enter accepts the recommended value shown in the placeholder.
 * Yes/No: select list marks the default option as "(recommended)".
 */

import * as p from '@clack/prompts';

export const RECOMMENDED_TAG = '(recommended)';

/** @param {string} label */
export function withRecommendedTag(label) {
  return `${label} ${RECOMMENDED_TAG}`;
}

/**
 * Build yes/no select options with the recommended choice labelled.
 * @param {boolean} recommendedYes
 */
export function buildConfirmOptions(recommendedYes = true) {
  return [
    {
      value: 'yes',
      label: recommendedYes ? withRecommendedTag('Yes') : 'Yes',
    },
    {
      value: 'no',
      label: recommendedYes ? 'No' : withRecommendedTag('No'),
    },
  ];
}

/**
 * @param {string | number | boolean} value
 */
export function recommendedPlaceholder(value) {
  const text = String(value ?? '').trim();
  return text ? withRecommendedTag(text) : RECOMMENDED_TAG;
}

/**
 * @param {{ message: string, recommended?: string, validate?: (v: string) => string | void }} opts
 */
export async function promptTextRecommended(opts) {
  const recommended = String(opts.recommended ?? '');
  return p.text({
    message: opts.message,
    placeholder: recommendedPlaceholder(recommended),
    initialValue: recommended,
    validate: opts.validate,
  });
}

/**
 * @param {{ message: string, recommended?: boolean }} opts
 * @returns {Promise<boolean | symbol>}
 */
export async function promptConfirmRecommended(opts) {
  const recommended = opts.recommended !== false;
  return p.select({
    message: opts.message,
    options: buildConfirmOptions(recommended),
    initialValue: recommended ? 'yes' : 'no',
  }).then((answer) => {
    if (p.isCancel(answer)) return answer;
    return answer === 'yes';
  });
}

/**
 * Resolve a text answer: empty input keeps the recommended value.
 * @param {string | symbol} answer
 * @param {string} recommended
 */
export function resolveTextAnswer(answer, recommended) {
  if (typeof answer !== 'string' || answer.trim() === '') return recommended;
  return answer;
}
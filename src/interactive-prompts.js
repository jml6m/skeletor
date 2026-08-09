/**
 * Skeletor interactive prompts — select-first UX with (recommended) labels.
 */

import * as p from '@clack/prompts';

export const RECOMMENDED_TAG = '(recommended)';
export const CUSTOM_SELECT_VALUE = '__custom__';

/** @param {string} label */
export function withRecommendedTag(label) {
  return `${label} ${RECOMMENDED_TAG}`;
}

/**
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
 * @param {{ message: string, options: string[], recommended?: string }} opts
 */
export function buildSelectOptions(opts) {
  const recommended = opts.recommended ?? opts.options[0];
  return opts.options.map((value) => ({
    value,
    label: value === recommended ? withRecommendedTag(value) : value,
  }));
}

/**
 * @param {{ message: string, recommended?: boolean }} opts
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
 * @param {{ message: string, options: string[], recommended?: string, allowCustom?: boolean }} opts
 */
export async function promptSelectRecommended(opts) {
  const selectOptions = buildSelectOptions(opts);
  if (opts.allowCustom !== false) {
    selectOptions.push({ value: CUSTOM_SELECT_VALUE, label: 'Specify a different value…' });
  }
  const initial = opts.recommended ?? opts.options[0];
  const answer = await p.select({
    message: opts.message,
    options: selectOptions,
    initialValue: initial,
  });
  if (p.isCancel(answer)) return answer;
  if (answer === CUSTOM_SELECT_VALUE) {
    return p.text({
      message: opts.message,
      validate(value) {
        if (!value || !String(value).trim()) return 'A value is required.';
      },
    });
  }
  return answer;
}

/**
 * @param {{ message: string, candidates: { owner: string, source: string }[] }} opts
 */
export async function promptOwnerSelect(opts) {
  const { candidates } = opts;
  if (candidates.length === 0) {
    return p.text({
      message: opts.message,
      validate(value) {
        if (!value || !String(value).trim()) return 'GitHub owner / org is required.';
      },
    });
  }

  const selectOptions = candidates.map((c, index) => ({
    value: c.owner,
    label: index === 0 ? withRecommendedTag(c.owner) : c.owner,
    hint: c.source,
  }));
  selectOptions.push({ value: CUSTOM_SELECT_VALUE, label: 'Specify a different owner/org…' });

  const answer = await p.select({
    message: opts.message,
    options: selectOptions,
    initialValue: candidates[0].owner,
  });
  if (p.isCancel(answer)) return answer;
  if (answer === CUSTOM_SELECT_VALUE) {
    return p.text({
      message: 'GitHub owner / org',
      validate(value) {
        if (!value || !String(value).trim()) return 'GitHub owner / org is required.';
      },
    });
  }
  return answer;
}

/**
 * @param {{ message: string, options: { value: string, label: string, hint?: string }[], initialValues?: string[] }} opts
 */
export async function promptMultiSelectRecommended(opts) {
  return p.multiselect({
    message: opts.message,
    options: opts.options,
    initialValues: opts.initialValues || [],
    required: false,
  });
}

/**
 * @param {{ message: string, default?: string, options?: string[] }} pr
 */
export async function promptLayerValue(pr) {
  const recommended = String(pr.default ?? '');
  const options = Array.isArray(pr.options) && pr.options.length
    ? [...new Set(pr.options)]
    : recommended
      ? [recommended]
      : [];

  if (options.length === 0) {
    return p.text({
      message: pr.message,
      validate(value) {
        if (!value || !String(value).trim()) return 'A value is required.';
      },
    });
  }

  return promptSelectRecommended({
    message: pr.message,
    options,
    recommended,
  });
}
process.env.SKELETOR_CLI_TEST = '1';

import {
  RECOMMENDED_TAG,
  withRecommendedTag,
  buildConfirmOptions,
  buildSelectOptions,
  CUSTOM_SELECT_VALUE,
} from '../src/interactive-prompts.js';

describe('interactive-prompts', () => {
  test('withRecommendedTag appends standard label', () => {
    expect(withRecommendedTag('Yes')).toBe(`Yes ${RECOMMENDED_TAG}`);
  });

  test('buildConfirmOptions marks yes as recommended by default', () => {
    const opts = buildConfirmOptions(true);
    expect(opts[0].label).toContain(RECOMMENDED_TAG);
    expect(opts[1].label).not.toContain(RECOMMENDED_TAG);
  });

  test('buildSelectOptions marks recommended value', () => {
    const opts = buildSelectOptions({ options: ['logs', 'var/log'], recommended: 'logs' });
    expect(opts[0].label).toContain(RECOMMENDED_TAG);
    expect(opts[1].label).toBe('var/log');
  });

  test('CUSTOM_SELECT_VALUE is stable sentinel', () => {
    expect(CUSTOM_SELECT_VALUE).toBe('__custom__');
  });
});
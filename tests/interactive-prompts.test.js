process.env.SKELETOR_CLI_TEST = '1';

import {
  RECOMMENDED_TAG,
  withRecommendedTag,
  buildConfirmOptions,
  recommendedPlaceholder,
  resolveTextAnswer,
} from '../src/interactive-prompts.js';

describe('interactive-prompts', () => {
  test('withRecommendedTag appends standard label', () => {
    expect(withRecommendedTag('Yes')).toBe(`Yes ${RECOMMENDED_TAG}`);
  });

  test('buildConfirmOptions marks yes as recommended by default', () => {
    const opts = buildConfirmOptions(true);
    expect(opts[0].label).toContain(RECOMMENDED_TAG);
    expect(opts[1].label).not.toContain(RECOMMENDED_TAG);
    expect(opts[0].value).toBe('yes');
  });

  test('buildConfirmOptions can mark no as recommended', () => {
    const opts = buildConfirmOptions(false);
    expect(opts[1].label).toContain(RECOMMENDED_TAG);
    expect(opts[0].label).not.toContain(RECOMMENDED_TAG);
  });

  test('recommendedPlaceholder embeds value and tag', () => {
    expect(recommendedPlaceholder('jml6m')).toBe(`jml6m ${RECOMMENDED_TAG}`);
  });

  test('resolveTextAnswer keeps recommended on empty input', () => {
    expect(resolveTextAnswer('', 'logs')).toBe('logs');
    expect(resolveTextAnswer('  ', 'logs')).toBe('logs');
    expect(resolveTextAnswer('custom', 'logs')).toBe('custom');
  });
});
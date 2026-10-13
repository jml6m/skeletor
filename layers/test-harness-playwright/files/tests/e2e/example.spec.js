const { expect, test } = require('@playwright/test');

// `npm run test:e2e` downloads Chromium first (pretest:e2e) if it is missing.
const name = '{{PROJECT_NAME}}';

test('renders content', async ({ page }) => {
  await page.setContent(`<h1>${name}</h1>`);
  await expect(page.locator('h1')).toHaveText(name);
});

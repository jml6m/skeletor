import { expect, test } from '@playwright/test';

// `npm run test:e2e` downloads Chromium first (pretest:e2e) if it is missing.
test('renders content', async ({ page }) => {
  await page.setContent('<h1>{{PROJECT_NAME}}</h1>');
  await expect(page.locator('h1')).toHaveText('{{PROJECT_NAME}}');
});

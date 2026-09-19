import { expect, test } from '@playwright/test';

// Browsers are downloaded separately: run `npx playwright install` once before `npm run test:e2e`.
test('renders content', async ({ page }) => {
  await page.setContent('<h1>{{PROJECT_NAME}}</h1>');
  await expect(page.locator('h1')).toHaveText('{{PROJECT_NAME}}');
});

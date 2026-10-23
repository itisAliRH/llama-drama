const { test, expect } = require('@playwright/test');
const { engine, watch } = require('./helpers');

test('launcher and game load offline without errors or socket traffic', async ({ page }) => {
  const w = watch(page);
  await page.goto('index.html?offline');
  await expect(page.locator('a[href="proto/b.html"]')).toBeVisible();
  await expect(page.locator('a[href="leaderboard.html"]')).toBeVisible();
  await expect(page.locator('a[href="sensor.html"]')).toBeHidden();
  await expect(page.locator('a[href="record.html"]')).toBeHidden();

  await page.goto('proto/b.html?offline');
  await expect(page.locator('#start .play')).toBeVisible();
  await expect(page.locator('#bmute')).toBeVisible();
  await expect(page.locator('#lb-off')).toHaveText('offline: local scores only');
  await page.waitForTimeout(1500);

  expect(w.errors).toEqual([]);
  expect(w.sockets).toEqual([]);
  expect(w.urls.filter(engine)).toEqual([]);
});

test('leaderboard page falls back to local scores when no board answers', async ({ page }) => {
  const w = watch(page);
  await page.goto('leaderboard.html');
  await expect(page.locator('#conn')).toHaveText('offline: local scores only', { timeout: 15000 });
  expect(w.errors).toEqual([]);
});

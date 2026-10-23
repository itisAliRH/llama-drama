const { test, expect } = require('@playwright/test');

async function finishRun(page, url) {
  await page.goto(url);
  await page.fill('#lb-name', 'tester');
  await page.press('#lb-name', 'Enter');
  await page.evaluate(() => window.settings.set('startLives', 1));

  await page.click('#start .play');
  await expect(page.locator('#start')).toBeHidden();
  await page.waitForTimeout(500);
  await page.keyboard.press('6'); // debug key: block ~3 s ahead in the runner's lane
  await expect(page.locator('#over')).toBeVisible({ timeout: 20000 });
}

test('a finished run is saved locally and listed after reload', async ({ page }) => {
  await finishRun(page, 'proto/b.html?offline&debug=1');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lb_local')));
  expect(saved.top[0].name).toBe('TESTER');

  await page.reload();
  await expect(page.locator('#lb-body')).toContainText('TESTER');
  await expect(page.locator('#lb-off')).toHaveText('offline: local scores only');
});

test('without ?offline a run is still saved locally when no board answers', async ({ page }) => {
  await finishRun(page, 'proto/b.html?debug=1'); // socket is created but never connects on the static server
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lb_local')));
  expect(saved.top[0].name).toBe('TESTER');
  await expect(page.locator('#lb-off')).toHaveText('offline: local scores only');
});

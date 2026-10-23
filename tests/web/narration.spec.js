const { test, expect } = require('@playwright/test');

test('offline narration plays bundled clips and never calls ElevenLabs', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  const lines = page.waitForResponse((r) => r.url().endsWith('/voice/lines.json') && r.ok());
  await page.goto('proto/b.html?offline');
  await lines;

  const clip = page.waitForRequest(/\/voice\/[^?]+\.mp3$/, { timeout: 15000 });
  await page.keyboard.press('Space');
  await clip;

  expect(urls.filter((u) => /elevenlabs/i.test(u))).toEqual([]);
});

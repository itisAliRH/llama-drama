const { test, expect } = require('@playwright/test');
const { dbg } = require('./helpers');

const field = (page, k) => dbg(page).then((d) => d[k]);

test('the game is playable with the keyboard only', async ({ page }) => {
  await page.goto('proto/b.html?offline&debug=1');
  await expect(page.locator('#start')).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.locator('#start')).toBeHidden();
  await expect.poll(() => field(page, 'state')).toBe('running');
  await page.keyboard.press('g'); // god mode (debug only): obstacles cannot end the run mid-test
  await expect.poll(() => field(page, 'god')).toBe('ON');

  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => field(page, 'lane')).toBe('0');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => field(page, 'lane')).toBe('1');

  await page.keyboard.press('ArrowUp');
  await expect.poll(() => field(page, 'jump'), { intervals: [50] }).toBe('ACTIVE');
  await expect.poll(() => field(page, 'jump')).toBe('-');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => field(page, 'duck')).toBe('DUCKING');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => field(page, 'duck')).toBe('standing');

  const ammo = page.locator('#ammo');
  const full = (await ammo.textContent()).split('◆').length;
  await page.keyboard.press('x');
  await expect.poll(async () => (await ammo.textContent()).split('◆').length).toBe(full - 1);

  await page.keyboard.press('p');
  await expect(page.locator('#pause')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.locator('#pause')).toBeHidden();

  await expect.poll(async () => +(await field(page, 'score'))).toBeGreaterThan(20);
  const before = +(await field(page, 'score'));
  await page.keyboard.press('Backspace');
  await expect.poll(async () => +(await field(page, 'score'))).toBeLessThan(before);
  expect(await field(page, 'state')).toBe('running');
});

test('cheat keys need ?debug', async ({ page }) => {
  await page.goto('proto/b.html?offline');
  await page.keyboard.press('Space');
  await expect(page.locator('#start')).toBeHidden();
  await page.keyboard.press('g');
  await page.waitForTimeout(300);
  await expect(page.locator('#god')).toBeHidden();
});

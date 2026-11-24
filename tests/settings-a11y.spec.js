// @ts-check
const { test, expect } = require('@playwright/test');
const { openGame, setSecret, start, tap, guess, rowText, tile, key, readStorage, PAGE_URL } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await setSecret(page);
});

test.describe('settings', () => {
  test('Onscreen Keyboard Only ignores physical keys and is remembered', async ({ page }) => {
    await page.click('.btn-icon');
    await page.click('#setKeyboardOnly');
    await page.keyboard.press('Escape');
    await start(page);

    await page.keyboard.type('TRA');
    expect(await rowText(page)).toBe('');
    await tap(page, 'TR');
    expect(await rowText(page)).toBe('TR');

    expect(await readStorage(page, 'wordle_settings')).toEqual({ keyboardOnly: true });
    await page.reload();
    await page.waitForFunction(() => state && state.secret_word);
    await page.click('.btn-icon');
    await expect(page.locator('#setKeyboardOnly')).toBeChecked();
  });

  test('clicking outside a panel closes it', async ({ page }) => {
    await page.click('.btn-icon');
    const overlay = page.locator('#settingsOverlay');
    await expect(overlay).not.toHaveClass(/hidden/);
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).toHaveClass(/hidden/);
  });
});

test.describe('accessibility', () => {
  test('tiles and keys announce their state', async ({ page }) => {
    await start(page);
    await guess(page, 'TRACE');
    await expect(tile(page, 0, 3)).toHaveAttribute('aria-label', 'Row 1, letter 4: C, in the word, wrong spot');
    await expect(tile(page, 1, 0)).toHaveAttribute('aria-label', 'Row 2, letter 1: empty');
    await expect(key(page, 'C')).toHaveAttribute('aria-label', 'C, in the word, wrong spot');
    await expect(key(page, 'Q')).toHaveAttribute('aria-label', 'Q');
  });

  test('each guess is read out by the live region', async ({ page }) => {
    await start(page);
    await guess(page, 'TRACE');
    await expect(page.locator('#srLive')).toHaveText(
      'TRACE: T not in the word, R correct, A correct, C in the word, wrong spot, E correct. 5 guesses left.');
  });

  test('dialogs are labelled and every button has a name', async ({ page }) => {
    const r = await page.evaluate(() => ({
      labelled: [...document.querySelectorAll('[role=dialog]')]
        .filter(d => { const id = d.getAttribute('aria-labelledby'); return id && document.getElementById(id); }).length,
      unnamed: [...document.querySelectorAll('button')]
        .filter(b => !(b.getAttribute('aria-label') || b.textContent.trim())).length,
    }));
    expect(r.labelled).toBe(4);
    expect(r.unnamed).toBe(0);
  });

  test('opening stats moves focus into the dialog', async ({ page }) => {
    await page.click('.btn-stats');
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#statsOverlay'))).toBe(true);
  });
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('tiles are coloured at once, without the flip', async ({ page }) => {
    await start(page);
    await tap(page, 'TRACE');
    await page.click('.key[data-key="ENTER"]');
    await expect(tile(page, 0, 4)).toHaveClass(/correct/, { timeout: 300 });
    await expect(tile(page, 0, 0)).not.toHaveClass(/reveal/);
  });
});

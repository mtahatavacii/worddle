import { test, expect } from '@playwright/test';
import {
  gotoFreshGame,
  startGame,
  submitGuessPhysical,
  readRowClasses,
} from './helpers';

test.describe('Core game flow', () => {
  test('renders 6x5 board and full keyboard on load', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE');
    await expect(page.locator('#gameBoard .tile')).toHaveCount(30);
    await expect(page.locator('.keyboard-row')).toHaveCount(3);
    await expect(page.locator('.key')).toHaveCount(28); // 26 letters + ENTER + BACKSPACE
    await expect(page.locator('.key[data-key="ENTER"]')).toBeVisible();
    await expect(page.locator('.key[data-key="BACKSPACE"]')).toBeVisible();
  });

  test('START enables input, timer runs', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE');
    await expect(page.locator('#timer')).toHaveText('00:00');
    await startGame(page);
    await expect(page.locator('#startBtn')).toContainText('PAUSE');
    // Timer should tick within ~1.5s
    await expect
      .poll(() => page.locator('#timer').textContent(), { timeout: 2500 })
      .not.toBe('00:00');
  });

  test('win flow: correct guess shows VICTORY modal', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await submitGuessPhysical(page, 'APPLE');
    const rowClasses = await readRowClasses(page, 0);
    expect(rowClasses.every((c) => c.includes('correct'))).toBe(true);
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY', {
      timeout: 3000,
    });
    await expect(page.locator('#resultWord')).toHaveText('APPLE');
  });

  test('lose flow: 6 wrong guesses shows DEFEAT modal with secret word', async ({
    page,
  }) => {
    const wrongs = ['CRANE', 'BLIMP', 'FJORD', 'WORDY', 'SIGHT', 'MOUTH'];
    await gotoFreshGame(page, 'APPLE', [...wrongs, 'APPLE']);
    await startGame(page);
    for (const w of wrongs) {
      await submitGuessPhysical(page, w);
    }
    await expect(page.locator('#resultTitle')).toHaveText('DEFEAT', {
      timeout: 3000,
    });
    await expect(page.locator('#resultWord')).toHaveText('APPLE');
  });

  test('NEW GAME resets board, keyboard, and timer', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await submitGuessPhysical(page, 'APPLE');
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY');
    // Re-mock for the second game with a different secret
    await page.unroute('**/random-word-api.herokuapp.com/**');
    await page.route('**/random-word-api.herokuapp.com/**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['stone']),
      })
    );
    await page.locator('.result-btn-new').click();
    await expect(page.locator('#message')).toContainText('Ready');
    await expect(page.locator('#timer')).toHaveText('00:00');
    // Board tiles are empty, no color classes.
    const emptyTiles = await page.evaluate(() => {
      const tiles = document.querySelectorAll('#gameBoard .tile');
      return Array.from(tiles).every((t) => (t.textContent || '') === '');
    });
    expect(emptyTiles).toBe(true);
    // Keyboard keys carry no color classes.
    const colored = await page.evaluate(() =>
      document.querySelectorAll('.key.correct, .key.present, .key.absent').length
    );
    expect(colored).toBe(0);
  });

  test('invalid word is rejected with shake + message', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']); // only APPLE is valid
    await startGame(page);
    await submitGuessPhysical(page, 'ZZZZZ');
    await expect(page.locator('#message')).toContainText('Not a valid word');
    // Guess was not recorded
    const guessCount = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('wordle_state') || '{}');
      return (s.guesses || []).length;
    });
    expect(guessCount).toBe(0);
  });
});

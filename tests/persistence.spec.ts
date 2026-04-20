import { test, expect } from '@playwright/test';
import {
  gotoFreshGame,
  mockApis,
  startGame,
  submitGuessPhysical,
} from './helpers';

test.describe('Persistence & stats', () => {
  test('mid-game state survives a page reload', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['CRANE', 'APPLE']);
    await startGame(page);
    await submitGuessPhysical(page, 'CRANE');
    // Reload. The mocks persist for the page, but we re-apply them to be safe.
    await mockApis(page, 'APPLE', ['CRANE', 'APPLE']);
    await page.reload();
    // First row still shows CRANE tiles
    const firstRowText = await page.evaluate(() => {
      const tiles = document.querySelectorAll('#gameBoard .tile');
      return Array.from(tiles)
        .slice(0, 5)
        .map((t) => t.textContent)
        .join('');
    });
    expect(firstRowText).toBe('CRANE');
    // Keyboard A should still be green after reload
    const aClass = await page.evaluate(
      () => document.querySelector('.key[data-key="A"]')?.className
    );
    expect(aClass).toContain('correct');
  });

  test('stats update after a win (games_played, wins, streak)', async ({
    page,
  }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await submitGuessPhysical(page, 'APPLE');
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY');
    const stats = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('wordle_stats') || '{}')
    );
    expect(stats.games_played).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.current_streak).toBe(1);
    expect(stats.max_streak).toBe(1);
  });

  test.skip('losing resets current_streak to 0 but keeps max_streak', async ({
    page,
  }) => {
    const wrongs = ['CRANE', 'BLIMP', 'FJORD', 'WORDY', 'SIGHT', 'MOUTH'];
    // Seed a pre-existing win so max_streak is 1 before the loss.
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await submitGuessPhysical(page, 'APPLE');
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY');

    // Close the modal and start a new game that is destined to lose.
    await mockApis(page, 'APPLE', [...wrongs, 'APPLE']);
    await page.locator('.result-btn-new').click();
    await expect(page.locator('#message')).toContainText('Ready');
    await startGame(page);
    for (const w of wrongs) {
      await submitGuessPhysical(page, w);
    }
    await expect(page.locator('#resultTitle')).toHaveText('DEFEAT');

    const stats = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('wordle_stats') || '{}')
    );
    expect(stats.games_played).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.current_streak).toBe(0);
    expect(stats.max_streak).toBe(1);
  });

  test('pause disables input and resume re-enables it', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await page.locator('.key[data-key="A"]').click();
    await expect(page.locator('#charCount')).toHaveText('1/5');

    // Pause
    await page.locator('#startBtn').click(); // PAUSE
    await expect(page.locator('#startBtn')).toContainText('RESUME');
    // Clicks should now be ignored
    await page.locator('.key[data-key="B"]').click();
    await expect(page.locator('#charCount')).toHaveText('1/5');

    // Resume
    await page.locator('#startBtn').click();
    await page.locator('.key[data-key="B"]').click();
    await expect(page.locator('#charCount')).toHaveText('2/5');
  });

  test('game history records a completed game', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await submitGuessPhysical(page, 'APPLE');
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY');
    const history = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('wordle_history') || '[]')
    );
    expect(history.length).toBe(1);
    expect(history[0].word).toBe('APPLE');
    expect(history[0].won).toBe(true);
    expect(history[0].guesses).toBe(1);
    expect(history[0].guessDetails).toHaveLength(1);
    expect(history[0].guessDetails[0].scores).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
  });
});

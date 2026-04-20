import { test, expect } from '@playwright/test';
import { gotoFreshGame, startGame, submitGuessVirtual } from './helpers';

test.describe('Keyboard input', () => {
  test('virtual key click appends letter to input', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE');
    await startGame(page);
    await page.locator('.key[data-key="Q"]').click();
    await expect(page.locator('#charCount')).toHaveText('1/5');
    const firstBox = page.locator('#inputBoxes .input-tile').first();
    await expect(firstBox).toHaveText('Q');
  });

  test('virtual BACKSPACE removes last letter', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE');
    await startGame(page);
    for (const c of ['Q', 'W', 'E']) {
      await page.locator(`.key[data-key="${c}"]`).click();
    }
    await expect(page.locator('#charCount')).toHaveText('3/5');
    await page.locator('.key[data-key="BACKSPACE"]').click();
    await expect(page.locator('#charCount')).toHaveText('2/5');
  });

  test('physical keyboard still works alongside virtual keyboard', async ({
    page,
  }) => {
    await gotoFreshGame(page, 'APPLE');
    await startGame(page);
    await page.locator('.key[data-key="Q"]').click();
    await page.locator('#hiddenInput').focus();
    await page.keyboard.type('WE');
    await expect(page.locator('#charCount')).toHaveText('3/5');
  });

  test('virtual ENTER with <5 letters warns and does not submit', async ({
    page,
  }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await page.locator('.key[data-key="Q"]').click();
    await page.locator('.key[data-key="W"]').click();
    await page.locator('.key[data-key="ENTER"]').click();
    await expect(page.locator('#message')).toContainText('5 letters');
    const guessCount = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('wordle_state') || '{}');
      return (s.guesses || []).length;
    });
    expect(guessCount).toBe(0);
  });

  test('virtual keyboard submits a full valid guess', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await submitGuessVirtual(page, 'APPLE');
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY');
  });

  test('typing more than 5 letters is clamped', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE');
    await startGame(page);
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      await page.locator(`.key[data-key="${c}"]`).click();
    }
    await expect(page.locator('#charCount')).toHaveText('5/5');
  });

  test('keyboard is inactive before START is pressed', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE');
    await page.locator('.key[data-key="Q"]').click();
    await expect(page.locator('#charCount')).toHaveText('0/5');
  });

  test('keyboard is inactive after game over', async ({ page }) => {
    await gotoFreshGame(page, 'APPLE', ['APPLE']);
    await startGame(page);
    await submitGuessVirtual(page, 'APPLE');
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY');
    await page.locator('.key[data-key="Q"]').click({ force: true });
    await expect(page.locator('#charCount')).toHaveText('0/5');
  });
});

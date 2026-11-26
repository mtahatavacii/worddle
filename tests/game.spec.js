// @ts-check
const { test, expect } = require('@playwright/test');
const { SECRET, openGame, setSecret, start, tap, guess, rowText, rowScores, tile, key, toasts, readStorage } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await setSecret(page);
});

test.describe('word lists', () => {
  test('every secret word is a valid guess', async ({ page }) => {
    const r = await page.evaluate(() => ({
      answers: ANSWERS.length,
      allowed: ALLOWED.size,
      allValid: ANSWERS.every(w => ALLOWED.has(w)),
      allFiveLetters: ANSWERS.every(w => /^[A-Z]{5}$/.test(w)),
    }));
    expect(r.answers).toBeGreaterThan(2000);
    expect(r.allowed).toBeGreaterThan(10000);
    expect(r.allValid).toBe(true);
    expect(r.allFiveLetters).toBe(true);
  });

  test('a new game picks its word from the answer list', async ({ page }) => {
    await page.evaluate(() => startNewGame());
    expect(await page.evaluate(() => ANSWERS.includes(state.secret_word))).toBe(true);
  });

  test('makes no network requests besides fonts', async ({ page }) => {
    const external = [];
    page.on('request', r => { if (/^https?:/.test(r.url()) && !/fonts\.g/.test(r.url())) external.push(r.url()); });
    await page.reload();
    await page.waitForFunction(() => state && state.secret_word);
    expect(external).toEqual([]);
  });
});

test.describe('input', () => {
  test('typed letters go straight into the board row', async ({ page }) => {
    await start(page);
    await page.keyboard.type('TRA');
    expect(await rowText(page, 0)).toBe('TRA');
    await expect(tile(page, 0, 2)).toHaveClass(/filled/);
    await expect(tile(page, 0, 3)).not.toHaveClass(/filled/);
    await expect(page.locator('#inputBoxes')).toHaveCount(0);
  });

  test('nothing can be typed before START', async ({ page }) => {
    await tap(page, 'AB');
    expect(await rowText(page, 0)).toBe('');
  });

  test('short word: row shakes and a toast says why', async ({ page }) => {
    await start(page);
    await page.keyboard.type('AB');
    await page.keyboard.press('Enter');
    await expect(tile(page, 0, 0)).toHaveClass(/shake/);
    await expect(toasts(page).first()).toHaveText('Not enough letters');
  });

  test('invalid word is cleared from the row after the shake', async ({ page }) => {
    await start(page);
    await page.keyboard.type('ZZZZZ');
    await page.keyboard.press('Enter');
    await expect(toasts(page).first()).toHaveText('Not in word list');
    await expect.poll(() => rowText(page)).toBe('');
    await page.keyboard.type('CRANE');
    expect(await rowText(page)).toBe('CRANE');
  });

  test('invalid word is kept if the player edits it during the shake', async ({ page }) => {
    await start(page);
    await page.keyboard.type('ZZZZZ');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(800);
    expect(await rowText(page)).toBe('ZZZZ');
  });

  test('a word cannot be guessed twice and the repeat is cleared', async ({ page }) => {
    await start(page);
    await guess(page, 'TRACE');
    await tap(page, 'TRACE');
    await page.click('.key[data-key="ENTER"]');
    await expect(toasts(page).first()).toHaveText('Already guessed');
    await expect.poll(() => rowText(page, 1)).toBe('');
  });

  test('onscreen ENTER then physical keys start a fresh row', async ({ page }) => {
    await start(page);
    await guess(page, 'TRACE');
    await page.keyboard.type('P');
    expect(await rowText(page)).toBe('P');
  });

  test('typing is ignored while the stats panel is open', async ({ page }) => {
    await start(page);
    await page.click('.btn-stats');
    await page.keyboard.type('XY');
    expect(await rowText(page)).toBe('');
  });
});

test.describe('reveal and scoring', () => {
  test('tiles flip one by one and input is locked meanwhile', async ({ page }) => {
    await start(page);
    await tap(page, 'TRACE');
    await page.click('.key[data-key="ENTER"]');
    await expect(tile(page, 0, 0)).toHaveClass(/absent/);
    // the 4th tile turns colour ~900 ms after the 1st
    await expect(tile(page, 0, 3)).not.toHaveClass(/present/);
    await tap(page, 'XX');
    await page.waitForFunction(() => !revealing);
    expect(await rowText(page, 1)).toBe('');
    expect(await rowScores(page, 0)).toEqual(['absent', 'correct', 'correct', 'present', 'correct']);
  });

  test('duplicate letters are scored once per occurrence', async ({ page }) => {
    const scores = await page.evaluate(() => [scoreGuess('EERIE', 'CRANE'), scoreGuess('LLAMA', 'HELLO')]);
    // the last E is green and uses up CRANE's only E, so the first two E's are grey
    expect(scores[0]).toEqual(['absent', 'absent', 'present', 'absent', 'correct']);
    expect(scores[1]).toEqual(['present', 'present', 'absent', 'absent', 'absent']);
  });

  test('keyboard keys take the best colour seen', async ({ page }) => {
    await start(page);
    await guess(page, 'TRACE');
    await expect(key(page, 'C')).toHaveClass(/present/);
    await expect(key(page, 'A')).toHaveClass(/correct/);
    await expect(key(page, 'T')).toHaveClass(/absent/);
    await guess(page, 'CRATE');
    await expect(key(page, 'C')).toHaveClass(/correct/);
    await expect(key(page, 'C')).not.toHaveClass(/present/);
  });
});

test.describe('timer and saving', () => {
  test('reload keeps time and guesses and offers RESUME', async ({ page }) => {
    await start(page);
    await guess(page, 'TRACE');
    await expect(page.locator('#timer')).not.toHaveText('0:00', { timeout: 4_000 });
    await page.click('#startBtn'); // pause so the time is stable
    const before = await page.locator('#timer').textContent();
    await page.reload();
    await page.waitForFunction(() => state && state.secret_word);
    await expect(page.locator('#timer')).toHaveText(/** @type {string} */ (before));
    await expect(page.locator('#startBtn')).toContainText('RESUME');
    expect(await rowScores(page, 0)).toEqual(['absent', 'correct', 'correct', 'present', 'correct']);
  });

  test('the secret word is not stored in plain text', async ({ page }) => {
    const raw = await page.evaluate(() => localStorage.getItem('wordle_state'));
    expect(raw).not.toContain(SECRET);
  });

  test('PAUSE stops the timer and input', async ({ page }) => {
    await start(page);
    await page.click('#startBtn');
    const t = await page.locator('#timer').textContent();
    await page.waitForTimeout(1_200);
    await expect(page.locator('#timer')).toHaveText(/** @type {string} */ (t));
    await tap(page, 'AB');
    expect(await rowText(page)).toBe('');
  });
});

test.describe('end of game', () => {
  test('win: bounce, win phrase, result dialog, stats', async ({ page }) => {
    await start(page);
    await guess(page, 'TRACE');
    await guess(page, 'CRANE');
    await expect(tile(page, 1, 0)).toHaveClass(/win/);
    await expect(toasts(page).first()).toHaveText('Magnificent');
    const modal = page.locator('#gameResultModal');
    await expect(modal).toHaveClass(/show/);
    await expect(page.locator('#resultTitle')).toHaveText('VICTORY');
    await expect(page.locator('.result-btn-share')).toBeFocused();

    const stats = await readStorage(page, 'wordle_stats');
    expect(stats.wins).toBe(1);
    expect(stats.guess_dist).toEqual([0, 1, 0, 0, 0, 0]);
    expect(stats.last_result).toBe(2);
    expect(stats.last_solve_time).toBeGreaterThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/show/);
    await page.click('.btn-stats');
    await expect(page.locator('#stat-winpct')).toHaveText('100%');
    await expect(page.locator('.dist-bar.hl')).toHaveText('1');
  });

  test('loss: the answer is shown and no solve time is recorded', async ({ page }) => {
    await start(page);
    for (const w of ['TRACE', 'REACT', 'CATER', 'NACRE', 'CRATE', 'CARET']) await guess(page, w);
    await expect(toasts(page).first()).toHaveText(SECRET);
    await expect(page.locator('#resultTitle')).toHaveText('DEFEAT');
    const stats = await readStorage(page, 'wordle_stats');
    expect(stats.games_played).toBe(1);
    expect(stats.wins).toBe(0);
    expect(stats.last_solve_time).toBe(0);
    expect(stats.current_streak).toBe(0);
  });

  test('the ✕ button closes the result dialog', async ({ page }) => {
    await start(page);
    await guess(page, 'CRANE');
    const modal = page.locator('#gameResultModal');
    await expect(modal).toHaveClass(/show/);
    await page.click('.result-close');
    await expect(modal).not.toHaveClass(/show/);
  });

  test('NEW starts a fresh game', async ({ page }) => {
    await start(page);
    await guess(page, 'CRANE');
    await expect(page.locator('#gameResultModal')).toHaveClass(/show/);
    await page.click('.result-btn-new');
    expect(await page.evaluate(() => [state.guesses.length, state.game_over])).toEqual([0, false]);
    await expect(page.locator('#startBtn')).toContainText('START');
  });
});

test.describe('share', () => {
  test.beforeEach(async ({ context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('win copies the emoji grid', async ({ page }) => {
    await start(page);
    for (const w of ['TRACE', 'PLANT', 'CRANE']) await guess(page, w);
    await page.locator('.result-btn-share').click();
    await expect(toasts(page).first()).toHaveText('Copied results to clipboard');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^WORDDLE 3\/6 ⏱ \d+:\d\d/);
    expect(text).toContain('⬛🟩🟩🟥🟩\n⬛⬛🟩🟩⬛\n🟩🟩🟩🟩🟩');
  });

  test('loss shares X/6 without the answer', async ({ page }) => {
    await start(page);
    for (const w of ['TRACE', 'REACT', 'CATER', 'NACRE', 'CRATE', 'CARET']) await guess(page, w);
    await page.locator('.result-btn-share').click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^WORDDLE X\/6/);
    expect(text).not.toContain(SECRET);
  });
});

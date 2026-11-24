// @ts-check
const { test, expect } = require('@playwright/test');
const { PAGE_URL, openGame, setSecret, start, guess } = require('./helpers');

test.describe('saved data', () => {
  test('corrupt localStorage does not break the game', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await openGame(page, {
      before: "localStorage.setItem('wordle_state','{bad'); localStorage.setItem('wordle_stats','nope'); localStorage.setItem('wordle_history','{')",
    });
    await expect(page.locator('.key')).toHaveCount(28);
    await page.click('.btn-stats');
    expect(errors).toEqual([]);
  });

  test('an old plain-text save is migrated and continued', async ({ page }) => {
    await openGame(page, {
      before: "localStorage.setItem('wordle_state', JSON.stringify({secret_word:'CRANE',guesses:['PLANT'],current_row:1,game_over:false,won:false}))",
    });
    expect(await page.evaluate(() => [state.secret_word, state.guesses])).toEqual(['CRANE', ['PLANT']]);
    expect(await page.evaluate(() => localStorage.getItem('wordle_state'))).toBeTruthy();
  });

  test('an old save whose word cannot be guessed is dropped', async ({ page }) => {
    await openGame(page, {
      before: "localStorage.setItem('wordle_state', JSON.stringify({secret_word:'QZXJK',guesses:[],current_row:0,game_over:false,won:false}))",
    });
    expect(await page.evaluate(() => ANSWERS.includes(state.secret_word))).toBe(true);
  });

  test('old stats get a guess distribution rebuilt from history', async ({ page }) => {
    await openGame(page, {
      before: `localStorage.setItem('wordle_stats', JSON.stringify({games_played:3,wins:2,current_streak:1,max_streak:1,total_win_time:50,win_count:2,last_solve_time:20}));
               localStorage.setItem('wordle_history', JSON.stringify([{word:'CRANE',guesses:4,won:true},{word:'PLANT',guesses:6,won:false},{word:'STONE',guesses:3,won:true}]))`,
    });
    expect(await page.evaluate(() => stats.guess_dist)).toEqual([0, 0, 1, 1, 0, 0]);
  });
});

test.describe('blocked storage (iPhone with cookies blocked)', () => {
  test('the game still renders and plays', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('The operation is insecure.', 'SecurityError'); },
      });
    });
    await openGame(page);
    await expect(page.locator('.key')).toHaveCount(28);
    await expect(page.locator('#gameBoard .tile')).toHaveCount(30);
    await setSecret(page);
    await start(page);
    await guess(page, 'CRANE');
    expect(await page.evaluate(() => state.won)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('look', () => {
  test('the page stays dark even if the background gradient is not painted', async ({ page }) => {
    await openGame(page);
    await page.addStyleTag({ content: 'body{background-image:none!important}' });
    const bg = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
    expect(bg).toEqual(['rgb(10, 14, 39)', 'rgb(10, 14, 39)']);
  });
});

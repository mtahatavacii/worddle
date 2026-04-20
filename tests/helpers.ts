import { expect, Page } from '@playwright/test';

/**
 * Mocks both external APIs the app depends on:
 *  - random-word-api.herokuapp.com → returns `secretWord` lowercased
 *  - api.dictionaryapi.dev → returns 200 for any word in `validWords`
 *    (if `validWords` is undefined, every word is treated as valid)
 */
export async function mockApis(
  page: Page,
  secretWord: string,
  validWords?: string[]
) {
  const validSet = validWords
    ? new Set(validWords.map((w) => w.toUpperCase()))
    : null;

  await page.route('**/random-word-api.herokuapp.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([secretWord.toLowerCase()]),
    })
  );

  await page.route('**/api.dictionaryapi.dev/**', (route) => {
    const match = route.request().url().match(/entries\/en\/([a-z]+)/);
    const word = match ? match[1].toUpperCase() : '';
    const ok = !validSet || validSet.has(word);
    route.fulfill({
      status: ok ? 200 : 404,
      contentType: 'application/json',
      body: ok ? '[{}]' : '{}',
    });
  });
}

/**
 * Navigates to the app with mocked APIs and an empty localStorage.
 * Uses addInitScript with a sessionStorage flag so that the storage is
 * wiped exactly once — on the very first page load of the context —
 * which lets persistence tests do their own reload without losing state.
 */
export async function gotoFreshGame(page: Page, secretWord: string, validWords?: string[]) {
  await mockApis(page, secretWord, validWords);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__wordle_test_init__')) {
      try { localStorage.clear(); } catch (e) {}
      sessionStorage.setItem('__wordle_test_init__', '1');
    }
  });
  await page.goto('/');
  await expect(page.locator('#message')).toContainText('Ready', {
    timeout: 5000,
  });
}

/** Clicks START and waits for input to be enabled. */
export async function startGame(page: Page) {
  await page.locator('#startBtn').click();
  await expect(page.locator('#message')).toContainText('Game started');
}

/** Types a 5-letter word via the physical keyboard, presses Enter, waits for submit. */
export async function submitGuessPhysical(page: Page, word: string) {
  const beforeCount = await readGuessCount(page);
  await page.locator('#hiddenInput').focus();
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
  await waitForGuessSettled(page, beforeCount);
}

/** Types a 5-letter word by clicking the on-screen keyboard, presses ENTER, waits for submit. */
export async function submitGuessVirtual(page: Page, word: string) {
  const beforeCount = await readGuessCount(page);
  for (const ch of word.toUpperCase()) {
    await page.locator(`.key[data-key="${ch}"]`).click();
  }
  await page.locator('.key[data-key="ENTER"]').click();
  await waitForGuessSettled(page, beforeCount);
}

/** Reads the number of committed guesses from localStorage. */
async function readGuessCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('wordle_state') || '{}');
    return (s.guesses || []).length;
  });
}

/**
 * Waits until the guesses array in localStorage grows (successful submit) OR
 * the message shows a validation error (rejected submit). Either way, the
 * submitGuess() promise has settled and the board reflects final state.
 */
async function waitForGuessSettled(page: Page, priorCount: number) {
  await page.waitForFunction(
    (prev) => {
      const s = JSON.parse(localStorage.getItem('wordle_state') || '{}');
      if ((s.guesses || []).length > prev) return true;
      const msg = document.getElementById('message')?.textContent || '';
      return /not a valid|must be 5|already guessed/i.test(msg);
    },
    priorCount,
    { timeout: 5000 }
  );
}

/** Reads the per-tile classes of a given row (0-indexed). */
export async function readRowClasses(page: Page, row: number) {
  return page.evaluate((r) => {
    const tiles = document.querySelectorAll('#gameBoard .tile');
    const out: string[] = [];
    for (let i = r * 5; i < r * 5 + 5; i++) {
      out.push((tiles[i] as HTMLElement).className);
    }
    return out;
  }, row);
}

/** Reads the color class on a keyboard key. Returns '' | 'correct' | 'absent'. */
export async function readKeyColor(page: Page, letter: string): Promise<string> {
  return page.evaluate((k) => {
    const el = document.querySelector(`.key[data-key="${k}"]`) as HTMLElement;
    if (!el) return '';
    if (el.classList.contains('correct')) return 'correct';
    if (el.classList.contains('present')) return 'present';
    if (el.classList.contains('absent')) return 'absent';
    return '';
  }, letter);
}

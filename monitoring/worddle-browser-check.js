// Grafana Cloud Synthetic Monitoring - browser check for Worddle
// Opens the game, plays a fixed round (TRACE -> CRANE) and expects the win dialog.

import { browser } from 'k6/browser';
import { check } from 'k6';

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      options: {
        browser: { type: 'chromium' },
      },
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
  },
};

const URL = 'https://worddle-three.vercel.app';

export default async function () {
  const page = await browser.newPage();

  try {
    // 1. Page loads
    const res = await page.goto(URL, { waitUntil: 'load' });
    check(res, { 'page responds 200': (r) => r !== null && r.status() === 200 });

    // 2. Board and onscreen keyboard are rendered (JS ran)
    await page.locator('.key[data-key="ENTER"]').waitFor({ state: 'visible', timeout: 10000 });
    const ui = await page.evaluate(() => ({
      keys: document.querySelectorAll('#keyboard .key').length,
      tiles: document.querySelectorAll('#gameBoard .tile').length,
    }));
    check(ui, {
      'keyboard has 28 keys': (u) => u.keys === 28,
      'board has 30 tiles': (u) => u.tiles === 30,
    });

    // 3. Fix the secret word so the check is deterministic, then start
    await page.evaluate(() => {
      state.secret_word = 'CRANE';
      saveState();
      renderBoard();
    });
    await page.locator('#startBtn').click();

    // 4. Wrong guess is scored correctly
    await guess(page, 'TRACE');
    await page.waitForFunction(() => !revealing, { polling: 'raf', timeout: 10000 });
    const scores = await page.evaluate(() =>
      [...document.querySelectorAll('#gameBoard .tile')]
        .slice(0, 5)
        .map((t) => ['correct', 'present', 'absent'].find((c) => t.classList.contains(c)) || '')
        .join(',')
    );
    check(scores, { 'TRACE scored correctly': (s) => s === 'absent,correct,correct,present,correct' });

    // 5. Right guess wins
    await guess(page, 'CRANE');
    await page.locator('#gameResultModal.show').waitFor({ state: 'visible', timeout: 10000 });
    const title = await page.locator('#resultTitle').textContent();
    check(title, { 'win dialog shows VICTORY': (t) => t === 'VICTORY' });
  } finally {
    await page.close();
  }
}

async function guess(page, word) {
  for (const c of word) {
    await page.locator(`.key[data-key="${c}"]`).click();
  }
  await page.locator('.key[data-key="ENTER"]').click();
}

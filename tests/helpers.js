const path = require('path');

const PAGE_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SECRET = 'CRANE';

/**
 * Open the game. Google Fonts are blocked so tests run offline and fast.
 * `before` is a JS string run on the page before the real load (e.g. to seed localStorage).
 */
async function openGame(page, { before } = {}) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  if (before) {
    await page.goto(PAGE_URL);
    await page.evaluate(before);
  }
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => typeof state !== 'undefined' && state && state.secret_word);
}

/** Make the round deterministic. */
async function setSecret(page, word = SECRET) {
  await page.evaluate(w => { state.secret_word = w; saveState(); renderBoard(); }, word);
}

async function start(page) {
  await page.click('#startBtn');
}

/** Tap letters on the onscreen keyboard. */
async function tap(page, word) {
  for (const c of word) await page.click(`.key[data-key="${c}"]`);
}

/** Tap a word + ENTER and wait until the reveal animation is over. */
async function guess(page, word) {
  await tap(page, word);
  await page.click('.key[data-key="ENTER"]');
  await page.waitForFunction(() => !revealing);
}

/** Letters currently shown in a board row (default: the row being typed). */
function rowText(page, row) {
  return page.evaluate(r => {
    const i = r ?? state.guesses.length;
    return [...document.querySelectorAll('#gameBoard .tile')].slice(i * 5, i * 5 + 5).map(t => t.textContent).join('');
  }, row);
}

/** Score classes of a board row, e.g. ['absent', 'correct', ...]. */
function rowScores(page, row) {
  return page.evaluate(r => [...document.querySelectorAll('#gameBoard .tile')].slice(r * 5, r * 5 + 5)
    .map(t => ['correct', 'present', 'absent'].find(c => t.classList.contains(c)) || ''), row);
}

const tile = (page, row, col) => page.locator('#gameBoard .tile').nth(row * 5 + col);
const key = (page, k) => page.locator(`.key[data-key="${k}"]`);
const toasts = page => page.locator('#toasts .toast');
const readStorage = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), k);

module.exports = { PAGE_URL, SECRET, openGame, setSecret, start, tap, guess, rowText, rowScores, tile, key, toasts, readStorage };

// @ts-check
const { test, expect } = require('@playwright/test');
const { openGame, setSecret, start, guess } = require('./helpers');

// width × height of the visible page (browser bars already subtracted where it matters)
const SCREENS = [
  { name: 'iPhone SE 1st gen', width: 320, height: 568 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 15 in Safari (bars visible)', width: 393, height: 659 },
  { name: 'iPhone 15', width: 393, height: 852 },
  { name: 'iPhone Pro Max', width: 430, height: 932 },
  { name: 'Android', width: 360, height: 800 },
  { name: 'Pixel', width: 412, height: 915 },
  { name: 'iPad', width: 768, height: 1024, tablet: true },
];

for (const s of SCREENS) {
  test.describe(`${s.name} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height }, isMobile: !s.tablet, hasTouch: true });

    test('keyboard is on the first screen and nothing overflows sideways', async ({ page }) => {
      await openGame(page);
      const r = await page.evaluate(() => {
        const kb = document.getElementById('keyboard').getBoundingClientRect();
        const board = document.getElementById('gameBoard').getBoundingClientRect();
        return {
          kbBottom: kb.bottom, vh: innerHeight, boardBottom: board.bottom, kbTop: kb.top,
          overflowX: document.documentElement.scrollWidth > innerWidth,
          tile: board.width / 5, keys: document.querySelectorAll('.key').length,
        };
      });
      expect(r.keys).toBe(28);
      expect(r.kbBottom).toBeLessThanOrEqual(r.vh);
      expect(r.boardBottom).toBeLessThanOrEqual(r.kbTop);
      expect(r.overflowX).toBe(false);
      expect(r.tile).toBeGreaterThanOrEqual(28);
    });

    test('a full game can be played by tapping', async ({ page }) => {
      await openGame(page);
      await setSecret(page);
      await start(page);
      await guess(page, 'TRACE');
      await guess(page, 'CRANE');
      const modal = page.locator('#gameResultModal');
      await expect(modal).toHaveClass(/show/);
      const box = await modal.boundingBox();
      const vp = page.viewportSize();
      expect(box && vp && box.y >= 0 && box.y + box.height <= vp.height && box.x >= 0 && box.x + box.width <= vp.width).toBe(true);
    });
  });
}

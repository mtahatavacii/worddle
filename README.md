# worddle

Neon Wordle clone in a single static `index.html`. Live: https://worddle-three.vercel.app

## Tests

End-to-end tests use [Playwright](https://playwright.dev) and live in `tests/`.
They run on every push and pull request (GitHub Actions, Chromium + WebKit).
The latest report from `main` is published at https://mtahatavacii.github.io/worddle/report/ (GitHub Pages hosts only the report; the game is on Vercel).

```bash
cd tests
npm ci
npx playwright install chromium webkit
npx playwright test                    # all
npx playwright test --project=chromium # Chromium only
npx playwright test mobile.spec.js     # one file
```

Use an installed Chrome instead of the bundled one: `CHROME_PATH=/path/to/chrome npx playwright test --project=chromium`.

| File | Covers |
| --- | --- |
| `game.spec.js` | word lists, typing, reveal and scoring, timer and saving, win/loss, share |
| `settings-a11y.spec.js` | Onscreen Keyboard Only, aria labels, live region, focus, reduced motion |
| `storage.spec.js` | corrupt/old/blocked localStorage, dark background fallback (also on WebKit) |
| `mobile.spec.js` | 8 phone/tablet sizes: keyboard on the first screen, full game by tapping (also on WebKit) |

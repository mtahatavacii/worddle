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

## Synthetic monitoring

Production is checked by a k6 browser check in Grafana Cloud Synthetic Monitoring.

| | |
| --- | --- |
| Grafana | https://mtahatavaci.grafana.net (Testing & synthetics → Synthetics → Checks → `mtahatavaci-worddle`) |
| Type | Browser check (k6 browser, Chromium) |
| Target | https://worddle-three.vercel.app |
| Frequency | every hour, 1 probe (Calgary) ≈ 720 executions/month (free tier: 10k browser executions) |
| Script | [`monitoring/worddle-browser-check.js`](monitoring/worddle-browser-check.js) |

The script fixes the secret word to `CRANE`, then checks that:

1. the page returns HTTP 200
2. the onscreen keyboard (28 keys) and the board (30 tiles) are rendered, i.e. the JavaScript ran
3. the guess `TRACE` is scored `absent, correct, correct, present, correct`
4. the guess `CRANE` opens the `VICTORY` dialog

All checks must pass (`checks: rate==1.0`). The script uses the game's globals (`state`, `revealing`, `saveState`, `renderBoard`); if those are renamed in `index.html`, update the script and paste it into the check again. Each probe adds about 720 executions/month at this interval; the free tier allows 10k.

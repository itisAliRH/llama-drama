# Browser setup

The game runs in a browser with no board. It is a static site: everything is in `assets/`.

## Play online

https://itisalirh.github.io/llama-drama/ (deployed by `.github/workflows/pages.yml`).

On a `github.io` host, on `file://`, or with `?offline` in the URL, the page does not try to reach a board. Board-only pages (sensor test, recorder) are hidden.

## Run locally

Needs Node.js. No install step is needed for the server.

```sh
npm run dev
```

This runs `node tests/web/serve.js 8000` and serves `assets/` at http://127.0.0.1:8000/. Open that address.

Any other static server works too, as long as the web root is `assets/`. For example `python3 -m http.server 8000 --directory assets`.

Do not open `assets/index.html` from disk. Browsers block `fetch()` on `file://`, so the narration line list (`assets/voice/lines.json`) does not load. The game still starts, but with no narration.

## URL options

| Option | Effect |
|---|---|
| `?offline` | Never connect to a board. Scores stay in the browser. |
| `?debug` | Enables the test keys (see `hackathon/contract.md`) and lists them in the settings panel. |
| `?debug=1` | Opens the debug overlay at load. The `D` key toggles it any time. |

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move left or right | Left or Right arrow | Swipe left or right |
| Jump | Up arrow | Swipe up |
| Duck or slide | Down arrow | Swipe down |
| Shoot (slow motion) | X, or Enter while running | - |
| Shield | Z | - |
| Pause | P or Esc | - |
| Start | Space, or Enter | Tap, or the Play button |
| Restart the run | Backspace | - |
| Turn at a fork | Left or Right arrow, or Q (left) and E (right) | Swipe left or right |
| Turn right or left at a fork (alternative) | T (right), R (left) | - |
| Mute | M | Mute button |
| Next or previous song | N or B | - |
| Settings | S | Gear button |
| Debug overlay | D | - |

Shoot, shield and pause have no touch control in the browser. The mouse can use the Play button.

## Scores and settings

- Best score, player name, local leaderboard and settings are kept in the browser's local storage. Nothing leaves the browser.
- The leaderboard page (`leaderboard.html`) shows local scores when no board answers.
- Clearing site data resets them.

## Narration

The browser plays the pre-generated clips from `assets/voice/`. It never calls ElevenLabs and holds no API key. Live voice needs the board, see `hardware-setup.md`.

Browsers keep audio locked until the first key press or tap.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` uploads `assets/` and deploys it on every push to `main`, and on manual run. In the repository settings, set Pages > Source to "GitHub Actions". The job runs only in `itisAliRH/llama-drama`, so forks do not deploy.

## Tests

```sh
npm ci
npx playwright install chromium
npm test
```

Playwright serves `assets/` on port 4173 and runs Chromium.

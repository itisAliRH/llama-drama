# Contributing

Small fixes and ideas are welcome. Open an issue first for anything big.

## Setup

You need Node.js and, for the board code and tests, Python 3.

```sh
npm ci
npx playwright install chromium
npm run dev        # serves assets/ at http://127.0.0.1:8000/
```

No hardware is needed. The game runs in the browser. Board setup is in `docs/hardware-setup.md`.

## Checks

Run what CI runs (`.github/workflows/ci.yml`):

```sh
npm test                                      # Playwright web tests
python -m pip install pytest
python -m pytest -q tests/python              # board app with mocked arduino modules
shellcheck scripts/*.sh
for f in assets/*.js assets/proto/*.js; do node --check "$f"; done
python -m py_compile python/main.py scripts/*.py
```

## Pull requests

- Keep them small: one change per pull request, one logical change per commit.
- Use a short, plain commit message that says what changed.
- Add or update a test when you change behaviour.
- Update the docs in `docs/` when you change a command, a key or a setting.
- Signing off commits (DCO) is not required.

## Do not commit

- API keys, tokens, `.env` files or `data/elevenlabs.key`.
- Recordings with real names in the file name. The recorder puts the typed name in the file name, so use a short code.
- Trained models (`*.eim`, `*.tflite`).
- Real board addresses or host names. Use placeholders like `<board-ip>`.

## Licence

By contributing you agree that your code is released under the MIT licence in `LICENSE`. The audio files follow the separate terms in `NOTICE.md`.

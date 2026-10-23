# Security

## Report a problem

Report security problems privately through GitHub: open the repository's Security tab and choose "Report a vulnerability" (private security advisory). Please do not open a public issue for a vulnerability.

## Scope and known limits

- The board app is meant for a trusted local network. It serves plain http on port 7000, on all network interfaces, with no login. Anyone on the same network can open the pages and send game events, including the leaderboard and live narration requests. Do not expose port 7000 to the internet.
- Live narration spends ElevenLabs credits. It is off unless both a key and `LIVE_TTS=1` are set on the board, and it is rate limited (one request per client every 2 s, 20,000 characters per day). The limits are in `python/main.py`.
- Leaderboard scores come from the browser and are not verified.
- The browser build (GitHub Pages) has no server side and holds no keys.

## Secrets

- Never commit API keys. `.env`, `data/*.key` and Edge Impulse model files are git-ignored. Use `.env.example` as the template.
- The ElevenLabs key lives only on the board (`data/elevenlabs.key`, mode 600, or the app environment). It is never sent to the browser.
- If a key leaks, revoke it at the provider first, then clean the repository.

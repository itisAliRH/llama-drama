# Troubleshooting

## Browser

**No narration, or "lines.json" errors in the console.**
You opened the page from disk (`file://`). Browsers block `fetch()` there. Run `npm run dev` and open http://127.0.0.1:8000/ (`web-setup.md`).

**No sound.**
Browsers keep audio locked until the first key press or tap. Press a key. Check the mute state (M) and the volumes in Settings (S).

**Live voice switch is missing in Settings.**
It only shows when a board is connected. The browser build uses the pre-generated clips.

**The leaderboard says "offline: local scores only".**
No board answered. Scores are kept in this browser only. That is normal for the browser build.

**Settings or scores are gone.**
They live in the browser's local storage. Clearing site data, or a private window, removes them.

## Sensor and board

**Gestures do nothing.**
Open `http://<board-ip>:7000/sensor.html`. If no tile lights up, open `http://<board-ip>:7000/status` and read `i2c` and `sensor`. The scan should list 0x73 (sensor), 0x3e and 0x62 (LCD). A missing 0x73 means the sensor cable or connector is wrong. The sensor is only detected again every 5 s.

**Left and right are swapped, or up and down feel wrong.**
Change Sensor rotation and Mirror in Settings (S). The "Test: make a gesture" box shows raw and mapped moves.

**Gestures are missed or doubled.**
Hold the hand flat 5 to 15 cm above the sensor, and pull it out of view between gestures. Raise the Cooldown in Settings. The sensor reads a hand pulled away as a pull (pause); the sketch ignores pull for 1.5 s after a push.

**The LCD shows text but the backlight colour does not change.**
The sketch drives the backlight chip at 0x62, which matches the Grove LCD RGB Backlight v4 register layout. A module with a different RGB chip (for example a v5) would show text but ignore colours. This was not tested.

**The LCD is blank.**
Check that 0x3e answers in `/status`. The LCD updates about 7 times per second.

**Page does not load from the board.**
Check that your computer is on the same network, that the app runs (`arduino-app-cli app logs user:llama-drama`), and that you use `http://`, not `https://`, and port 7000.

## Live voice is silent

All of these must be true:

- `data/elevenlabs.key` exists in the app folder on the board, or `ELEVENLABS_API_KEY` is in the app environment.
- `LIVE_TTS=1`, or `data/live_tts` contains `1`.
- The app was restarted after you added them. They are read once at start.
- Settings (S) > Live voice is on.
- The board has internet access.

`http://<board-ip>:7000/tts_status` should return `{"enabled": true}`. If it returns `false`, the key or `LIVE_TTS` is missing. The app log prints which one at start.

Also check the limits: one request per client every 2 s, 20,000 characters per day for all clients. When the limit is hit or ElevenLabs does not answer within 2.5 s, the game plays the pre-generated clip instead. See `hardware-setup.md`.

## Scripts

**`BOARD_HOST` error.**
Run `export BOARD_HOST=arduino@<board-ip>` or pass the host as an argument.

**`Permission denied (publickey)` or a hang on deploy.**
The scripts use `ssh -o BatchMode=yes`, so a password prompt is not possible. Install your key: `ssh-copy-id arduino@<board-ip>`.

**Pages are blank or files are empty after unplugging the board.**
Power was cut before the data reached the storage. Run `sync` on the board before power off (`ssh "$BOARD_HOST" sync`) and run `scripts/deploy.sh` again. The deploy scripts end with `sync`.

**`scripts/rollback_board.sh` fails.**
It needs `~/ArduinoApps/llama-drama-backup` (or `-backup-prelive`) on the board. You create these yourself, see `hardware-setup.md`. Without a backup, run `scripts/deploy.sh`.

**`scripts/ei_upload.sh` or `scripts/ei_deploy.sh` say a key is not set.**
Add `EI_API_KEY` and `EI_PROJECT_ID` to the git-ignored `.env` (`.env.example` shows the names).

## Tests

**Playwright cannot find a browser.**
Run `npx playwright install chromium`.

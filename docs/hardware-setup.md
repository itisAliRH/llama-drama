# Hardware setup

How to run Llama Drama on an Arduino UNO Q with a gesture sensor and an LCD. Without hardware, use the browser build (`web-setup.md`).

Not tested after the event. The steps below follow the scripts and code in this repository. Where something was never recorded, this page says "unknown".

## Parts

| Part | Notes |
|---|---|
| Arduino UNO Q | Linux side (Debian) and a microcontroller side (board `arduino:zephyr`). USB-C power. |
| Grove Gesture sensor (PAJ7620U2) | I2C address 0x73. |
| Grove LCD RGB Backlight, 16x2 | Text controller at 0x3E, backlight chip at 0x62. The sketch uses the register layout of the v4 module. |
| Grove / Qwiic cables | Which cable or adapter we used is not recorded. |
| WiFi router | The board and your laptop or phone must be on the same network. |

The build also had a Grove accelerometer (MMA7660, address 0x4C). It is not used.

## Wiring

- Connect the gesture sensor and the LCD to the I2C connectors of the board. Both are I2C devices, so they can share the bus or use the two connectors.
- The sketch scans both `Wire` and `Wire1` and uses the bus where each device answers. Either I2C connector should work.
- Which physical connector maps to which bus: unknown, not tested.
- Supply voltage of the sensor and the LCD: not recorded. Check the Grove module documentation.
- Mount the sensor flat and face up, hand 5 to 15 cm above it. If left and right feel swapped, change Rotation or Mirror in the game settings (S).

## Software on your computer

- Arduino App Lab, to set up the board (WiFi, update, first run).
- An SSH client, `git`, and `tar`. The scripts stream a tarball over SSH. The board has no `rsync`.
- Optional: `shellcheck` to lint the scripts.

## Connect to the board

1. Put the board on your WiFi and find its address. Written below as `<board-ip>`.
2. Set up key login. The scripts use `ssh -o BatchMode=yes`, which cannot ask for a password:

   ```sh
   ssh-copy-id arduino@<board-ip>
   ssh arduino@<board-ip> true
   ```

   The second command must finish without a prompt. The user is `arduino`.
3. Tell the scripts where the board is, once per shell:

   ```sh
   export BOARD_HOST=arduino@<board-ip>
   ```

   There is no default. A host argument overrides it: `scripts/deploy.sh arduino@<board-ip>`.

## Deploy

```sh
scripts/deploy.sh
```

What it does:

- Packs `app.yaml`, `sketch/`, `python/` and `assets/` from the git work tree (tracked and new files that are not git-ignored; plus `python/model.eim` if it exists).
- Copies them to `~/ArduinoApps/llama-drama` on the board, replacing those four entries. The `data/` folder on the board is left alone.
- Runs `sync`, stops the app and starts it again with `arduino-app-cli`.
- Building the sketch on first start can take a while. Watch the logs.

Open `http://<board-ip>:7000/` in a browser on the same network. The pages:

| Page | Purpose |
|---|---|
| `/` | Launcher. |
| `/proto/b.html` | The 3D game (default). |
| `/proto/c.html` | Neon version. |
| `/leaderboard.html` | Top 10 runs on the board. |
| `/sensor.html` | Gesture test: shows all 9 gestures. |
| `/record.html` | Recorder for Edge Impulse clips (`edge-impulse.md`). |

## Start, stop, logs

Run on the board over SSH (`ssh arduino@<board-ip> ...`), or paste the command after `ssh $BOARD_HOST`:

```sh
arduino-app-cli app start user:llama-drama
arduino-app-cli app stop user:llama-drama
arduino-app-cli app logs user:llama-drama
```

Restart means stop, then start. The Python app logs to these logs.

## Start on power-up

The command to make the app start by itself is unknown. At the event we set the board's default app to Llama Drama in Arduino App Lab, and the board then started it after power-up. Look for the default-app option in App Lab.

## Update only the web files

```sh
scripts/push_assets.sh
```

Copies `assets/` only, with no restart and no sketch rebuild. Reload the page.

## Roll back

```sh
scripts/rollback_board.sh            # restores ~/ArduinoApps/llama-drama-backup
scripts/rollback_board.sh prelive    # restores ~/ArduinoApps/llama-drama-backup-prelive
```

The script restores from backup folders on the board. Nothing creates them. Make a copy yourself before you try something risky:

```sh
ssh "$BOARD_HOST" 'cd ~/ArduinoApps && rm -rf llama-drama-backup && cp -r llama-drama llama-drama-backup && sync'
```

The restore replaces `sketch`, `python`, `assets` and `app.yaml`, keeps `data/`, then restarts the app. It is not atomic: if the copy fails half way, run `scripts/deploy.sh`.

## Live narration (optional)

The board can speak lines built from the running game with ElevenLabs. It is off by default. Without it, the pre-generated clips play. You need an ElevenLabs account and internet on the board.

1. Put the key on the board in the app folder:

   ```sh
   ssh "$BOARD_HOST" 'mkdir -p ~/ArduinoApps/llama-drama/data && umask 077 && cat > ~/ArduinoApps/llama-drama/data/elevenlabs.key'
   ```

   Paste the key, press Enter, then Ctrl-D. Then restrict the file: `ssh "$BOARD_HOST" 'chmod 600 ~/ArduinoApps/llama-drama/data/elevenlabs.key'`. The key needs Text to Speech access.
2. Turn it on: `ssh "$BOARD_HOST" 'mkdir -p ~/ArduinoApps/llama-drama/data && echo 1 > ~/ArduinoApps/llama-drama/data/live_tts'`.
3. Restart the app. The board app reads both files once at start.
4. Open Settings (S) and switch "Live voice (internet)" on. The toggle appears only when a board is connected.

Environment variables `ELEVENLABS_API_KEY` and `LIVE_TTS=1` also work, but how to set environment variables for an App Lab app is unknown. The board app does not read `.env`.

Limits in `python/main.py`: one request per client every 2 s, 20,000 characters per day for all clients. The key stays on the board and is never sent to the browser. If a reply is late (2.5 s) or fails, the clip plays. `GET /tts_status` returns `{"enabled": true}` when live voice is on.

## Debugging

- `http://<board-ip>:7000/status` returns JSON: mode, sensor state, last gesture, I2C scan, message counts, uptime, LCD state.
- `/sensor.html` lights a tile for each gesture. Use it to check the sensor and the rotation.
- Press D in the game for the debug overlay with live values.
- `arduino-app-cli app logs user:llama-drama` for the app output.
- More in `troubleshooting.md`.

## Security

The app listens on port 7000 over plain http, on all network interfaces, with no login. Anyone on the same network can open the pages and send game events. Keep the board on a trusted LAN. Do not forward port 7000 to the internet. See `SECURITY.md`.

## Power off

Run `sync` on the board before you cut power (`ssh "$BOARD_HOST" sync`). Files that were only in the page cache become empty files on a power cut. The deploy scripts already end with `sync`.

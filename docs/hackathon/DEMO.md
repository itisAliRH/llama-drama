# Live demo checklist

The demo is live, in person, on a screen. No video.

## 10 minutes before

- Board powered, on the router WiFi. Laptop on the same WiFi.
- Open `http://<board-ip>:7000/` and pick **Play: 3D** (backup: **Play: Neon**).
- Browser full screen (Cmd+Ctrl+F on macOS). Sound on, volume up. Click once so audio starts.
- Settings (`S`): sensor rotation matches how the sensor sits on the table; duck mode as preferred. Close with `S`.
- Debug panel (`D`) off.
- LCD shows the idle screen. Gesture sensor fixed in place, nothing above it.
- Run `/sensor.html` once: all swipes, push and pull light up.

## During the demo

- Hand 5 to 15 cm above the sensor, flat palm, pull the hand out of view between gestures.
- Let a judge play: swipe left/right for lanes, up to jump, down to duck, push to shoot, swipe at forks to turn.
- Press `F` to bring a fork early if needed.
- Press `1` to spawn super ammo: the cape appears and Gary or Sunny comments. Push fires the super shot.
- Type a name in the leaderboard box before playing: live commentary uses it.
- Live voice broken or slow: Settings > Live voice off (clips still play). App broken: `scripts/rollback_board.sh` (last verified build) or `scripts/rollback_board.sh prelive` (before live voice), about 1 minute.
- Narration too loud or too chatty: Settings (`S`) > Narration voice off, or raise Narration cooldown.
- Point at the LCD: score, hearts and effects come from the board.

## If something breaks

- Game frozen or sensor silent: reload the page. Still silent: `scripts/deploy.sh` (about 1 minute).
- Sensor misbehaves: play with the keyboard (arrows, `X` shoot, `P` pause, `Q`/`E` turn) and keep talking.
- 3D too slow on the screen: switch to **Play: Neon**.

## Before handing over to a judge

- Open `S` > Game tuning > **Reset to defaults** if anyone changed tuning while testing. God mode always starts off after a reload; check there is no "GOD" tag in the HUD.

# Interface contract

Hackathon-era document, kept as written. Where it disagrees with the code, the code wins. Known case: the shield text below says 3 s, but the default `shieldSec` in `assets/settings.js` is 6 s (the tuning table below has it right). Also, the test keys below work only with `?debug` in the URL now.

Game page (`assets/index.html` + `assets/game.js`) and board app (`python/main.py`, `assets/bridge.js`) talk only through these globals.

## Board -> game

`bridge.js` calls:

- `window.game.input(move)` where `move` is one of `"left" | "right" | "jump" | "duck"`.
- `window.game.input("track")` for the next track (gesture: clockwise).
- `window.game.input("track_prev")` for the previous track (gesture: anticlockwise).
- `window.game.input("start")` to start or restart (button).

## Game -> board

The game calls `window.onGameState(state)` (defined by `bridge.js`, no-op if missing) with:

```json
{ "state": "start" | "running" | "dead", "score": 123, "track": 0, "lives": 3, "coins": 12, "level": 2, "paused": false }
```

Called on start, on death, on pause toggles, and at most every 500 ms while running.

## Keyboard (always on)

Arrow keys: left, right, up = jump, down = duck. Space/Enter = start. T = next track, R = previous track.

## Debug overlay

- Key `D` toggles a debug panel on the right side of the screen.
- Board -> game: `bridge.js` calls `window.game.debug(data)` with a flat object of sensor and status values (for example `{ gesture: "left", i2c: "0x73,0x3e", objX: 120, objY: 80, brightness: 40, size: 300, mode: "builtin" }`). The panel shows the latest value for each key, plus how long ago the last update arrived.
- `window.game.input(move, source)` takes an optional `source` (`"keyboard" | "touch" | "gesture" | "ai"`), shown in the panel's input log.

## Sound

`assets/sound.js` defines `window.sfx.play(name)` with names `start, jump, duck, stand, lane, track, coin, hit, dead, speedup`. Games call `window.sfx && window.sfx.play(name)`. Sounds are synthesized with WebAudio (no files), unlocked on first key/touch.

## Settings

`assets/settings.js` loads after the game and before `bridge.js`. It wraps `window.game.input` for sources other than keyboard/touch: rotates/mirrors directions for the sensor mounting and drops inputs that come faster than the cooldown. Key `S` opens the settings panel. Settings persist in localStorage.

## UI prototypes

`assets/proto/a.html`, `b.html`, `c.html` are standalone playable prototypes of three visual styles. Each implements the same `window.game` API and loads `../sound.js`, `../settings.js`, `../libs/socket.io.min.js`, `../bridge.js`, so any of them can be played with the sensor.

## Round 2 additions (14:50)

- **Pause:** `window.game.input("pause")` toggles pause (gesture: forward wave). Keys `P` and `Escape` toggle pause. While paused: freeze the world, dim screen, show "PAUSED", music ducks. Any move input other than pause/start is ignored while paused. The settings panel pauses too.
- **Duck mode:** `window.settings.get()` returns `{ duckMode: "hold" | "slide", slideMs: 400..1500 (default 800), ... }`. Read it at each duck input (it can change at runtime). `"hold"` = current behavior (duck until up). `"slide"` = slide for `slideMs`, then stand up automatically; `"jump"` during a slide cancels it into a jump. If `window.settings` is missing, use hold.
- **Music:** `window.sfx.music(true|false)` starts/stops a procedural background loop; `window.sfx.setIntensity(0..1)` raises tempo/energy with game speed. Games call `music(true)` on start, `music(false)` on death; `setIntensity` every second.
- **More sounds:** `nearmiss`, `pause`, `resume`, `slide`, `combo`.
- **Near miss:** only when the player avoids an obstacle by a very small margin: (a) changed lane out of an obstacle's lane less than 250 ms before it reached the player, or (b) started a jump/duck/slide less than 200 ms before it reached the player, or (c) passed an obstacle in the directly adjacent lane within 120 ms of switching next to it. Show a "NEAR MISS!" popup, +25 bonus, play `nearmiss`. Chain within 3 s = combo x2, x3 (play `combo`).

## Forks (14:30)

- Every 20–35 s the path reaches a **fork**: the road splits into a left and a right branch. Show it early: a sign/arrow marker and a visible split ahead, plus a "TURN!" hint about 2.5 s before.
- Turning is chosen with the existing inputs: `"track_prev"` (anticlockwise) = turn **left**, `"track"` (clockwise) = turn **right**. Keys: `Q` = left turn, `E` = right turn; `R` / `T` keep working too.
- Window: the choice is accepted from 3 s before the fork. Last choice wins. Show the chosen arrow on the HUD.
- At the fork: no choice made = fall / crash (game over, play `dead`). Choice made = the camera swings around the turn (short 0.4 s rotation/slide), the run continues on the new branch, +50 bonus, play `track`. Left branch switches to the previous theme, right branch to the next theme, so forks replace free track switching.
- In the window, swipes / arrow keys `left` / `right` also choose the turn (left = turn left, right = turn right) and do not change lane; `track` / `track_prev` stay as alternative turn inputs.
- Outside the fork window, `track` / `track_prev` do nothing (no free theme switching during the run).
- No obstacles in the 2 s before and 1 s after a fork.
- New sound name: `turn` (falls back to `track` if missing).

## Round 3 (14:45): forks, coins, traps, difficulty

- **Fork types:** each fork is randomly a **split** (left and right both open, as now) or a **single turn** (corner: only left or only right is open, the other side is a wall). On a single turn, choosing the closed side = crash ("Wrong way!"). Single turns appear more often as speed rises.
- **Turn animation:** approaching a fork, the road visibly ends in a T or corner with arrow signs; on the turn, the runner leans into it and the camera swings smoothly (about 0.5 s, eased), with a speed-line/whoosh effect. Wrong or missing choice = runner stumbles into the wall (short crash animation before game over).
- **Coins:** lines of coins in lanes (straight runs, arcs over low barriers so a jump collects them, and lane-change zig-zags). Collect by touching. +10 score each, `coin` sound, coin counter in the HUD, small sparkle. Total coins on the game-over screen. Best score saved in localStorage.
- **Traps (introduced gradually):**
  - from speed 10: **gap/pit** across one or two lanes (must jump or change lane; falling in = "Fell in a pit!"),
  - from speed 14: **fire/spike strip** that pulses on and off (pass when off, or jump),
  - from speed 18: **moving block** sliding between lanes.
  Each trap has a clear look and a death cause line.
- **Difficulty:** as speed rises: shorter gaps between obstacles, more double rows, more traps, more single-turn forks, slightly shorter fork windows (3 s down to 2 s). Show a "LEVEL UP" popup at each step.

## Round 4 (14:55): lives, shooting, fewer coins

- **Gestures:** push (forward) = `"shoot"`, pull (backward) = `"pause"`. Keys: `X` or `Enter`-while-running = shoot; `P` / `Esc` = pause.
- **Lives:** start with 3 hearts (HUD). A hit (obstacle, trap, pit, wrong way, missed turn) costs one life instead of ending the run: red flash, short shake, the obstacle is removed, 2 s of blinking invulnerability. On a missed or wrong turn, the runner is placed on the open branch. Game over at 0 lives. Death-cause line shows the last hit.
- **Shoot:** on `"shoot"`, enter slow motion (world at about 0.25x for about 1.2 s, music filter/duck, slight zoom and color tint). A gun appears in the runner's hand, fires a glowing projectile down the current lane, and the first obstacle or trap in that lane within range explodes into sparkles/particles (+20, sound `shoot` then `explode`). Ammo: 3 shots, one recharges every 8 s; HUD shows ammo. No target = the shot still plays, no bonus.
- **Coins:** about one third of the current amount; shorter rows (3–5), fewer arcs.
- **New sounds:** `shoot`, `explode`, `hurt`, `life`.

## Round 5 (15:10): balance and polish

- **Speed:** gentler curve. Start 6, reach about 12 by 60 s, about 16 by 2 min, soft cap about 22 (approach it slowly, e.g. `6 + 16*(1 - exp(-t/150))` with t in seconds of running). Levels follow time, not raw speed. Traps unlock by level (pits level 2, fire/laser level 3, moving block level 4).
- **Moving traps:** from level 3, some traps move: pits/fire strips slide sideways across lanes slowly, blocks move between lanes. Telegraph movement (arrow/glow showing direction, at most one lane-step per ~1 s) so it is fair.
- **Smooth forks:** no sudden swap. The road visibly curves into the turn over the last stretch; the turn itself is a 0.9 s ease-in-out rotation of camera and world around the junction; the new branch is already built and visible before the turn; keep obstacles and coins continuous; theme colors cross-fade over about 1 s.
- **Ammo from coins:** every 10 coins = +1 ammo (max 3), play `life`, popup "+1 AMMO". Timer recharge slowed to 1 per 15 s.
- **Animations:** distinct, readable animations: jump (crouch-launch, tuck/spin in air, landing squash + dust), slide (drop low, lean back, feet forward, spark/dust trail, stand-up recovery), shoot (draw gun, recoil kick, muzzle flash, holster after slow motion).
- **Hearts on the road:** rare pickup (about one per 45–60 s, never inside the fork runway). Collect = +1 life (max 3; at full lives give +50 instead), sound `life`, popup "+1 LIFE".

## Shield (16:00)

- Wave gesture arrives as `"shield"` (bridge maps `wave` to `shield`). Key: `Z`.
- Shield: 3 s of invulnerability with a visible bubble/glow around the runner and a `shield` sound (fallback `life`). Obstacles hit while shielded break apart (no life lost). One charge; it refills every 45 s (HUD shows charge ready / cooldown). Ignored when not running or when no charge.

## Tuning and test keys (15:45)

`window.settings.get()` also returns these tuning values (games read them live, at the moment they are used; missing key = game default):

| Key | Default | Range | Meaning |
|---|---|---|---|
| `shieldSec` | 6 | 2–15 | Shield duration (s) |
| `shieldCooldown` | 45 | 10–120 | Shield recharge (s) |
| `startLives` | 3 | 1–5 | Lives at start (also max lives) |
| `ammoMax` | 3 | 1–6 | Max normal ammo |
| `ammoRecharge` | 15 | 5–60 | Seconds per ammo refill |
| `coinsPerAmmo` | 10 | 3–30 | Coins for +1 ammo |
| `slowmoSec` | 1.2 | 0.5–3 | Shot slow-motion length (s) |
| `heartEvery` | 50 | 15–120 | Average seconds between heart pickups |
| `superEvery` | 75 | 20–180 | Average seconds between super ammo pickups |
| `forkEvery` | 27 | 10–60 | Average seconds between forks |
| `speedStart` | 6 | 3–12 | Start speed |
| `speedMax` | 16 | 10–35 | Speed cap (old saved value 22 is migrated to 16) |
| `reactSec` | 1.1 | 0.6–2 | Minimum time between obstacles that need a move (s) |
| `trapsOn` | true | on/off | Enable traps |
| `godMode` | false | on/off | No life loss (testing) |

Test keys (always on, listed in the settings panel and debug panel): `1` super ammo pickup ahead in current lane, `2` heart ahead, `3` coin row ahead, `4` low barrier, `5` high bar, `6` block, `7` pit, `8` fire/laser strip, `9` moving block, `F` fork, `L` level up, `K` refill ammo + shield, `G` toggle god mode. Spawned items appear about 3 s ahead in the current lane.

## Leaderboard

Stored on the board in `data/leaderboard.json`: `best` keeps each name's highest run, `top` holds the 10 best runs overall.

- Page -> board `set_player` `{name, ui}`: name is upper-cased, `A-Z 0-9 _ . -`, max 12 chars, default `PLAYER`.
- Page -> board `leaderboard_get` `{}`: asks for the current table.
- Board -> page `leaderboard` `{top, last}`: `last` is `{name, score, rank, isBest}` after a run, `null` on a plain request.
- A run is recorded when a client's `game_state` goes from `running` to `dead`.
- `GET /leaderboard` returns `{top, best}`.

## Music

`sound.js` has 6 procedural songs. They cycle automatically with a two-bar crossfade at a bar boundary; `N` / `B` pick the next / previous song (`window.sfx.nextSong()` / `prevSong()`), `M` mutes.

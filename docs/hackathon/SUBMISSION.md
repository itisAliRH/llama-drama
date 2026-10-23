# Submission

## Text (about 150 words)

Llama Drama // Bare Metal is an endless runner you control with your bare hand. A Grove PAJ7620 gesture sensor on an Arduino UNO Q turns swipes into moves: left and right for lanes, up to jump, down to slide, push to shoot in slow motion, pull to pause. The STM32 reads the sensor and sends events over Bridge to a Python app on the board's Linux side, which serves a 3D three.js game to any laptop or phone on the WiFi. The game has lives, coins, ammo, traps, forks, near-miss combos and procedural music. Two ElevenLabs commentators, sarcastic Gary and cheerful Sunny, call every run like a football match, partly live from the real score, speed and your name; a crowd of spectators beside the track cheers and shouts, and grabbing super ammo gives your runner a purple cape. For the Edge Impulse part, the board streams raw sensor data (x, y, brightness, size at 50 Hz); a recorder page, upload and deploy scripts and an AI controller mode are built. Training the model is still in progress, so the built-in gestures drive the demo today.

## 60-second demo script

| Time | Shot | Say |
|---|---|---|
| 0-8 s | Close-up: UNO Q with sensor and LCD, hand above it, game on laptop behind | "A runner played with bare hands. The board serves the game over WiFi." |
| 8-20 s | Hand swipes left/right, up, down; screen shows lane changes, jump, slide | "Swipes are lanes, jump and slide." |
| 20-30 s | Push gesture: slow motion, obstacle explodes; pull pauses | "Push shoots in slow motion. Pull pauses." |
| 30-42 s | Fork ahead; swipe to turn; camera swings, theme changes | "At forks you pick the way. Wrong way costs a life." |
| 42-52 s | Grab super ammo (or press 1): cape appears, Gary comments; push fires the super shot | "Meet Gary and Sunny, our ElevenLabs narrators. They roast you and cheer you on." |
| 52-60 s | Recorder page with labelled clips, then Edge Impulse Studio | "Next: an Edge Impulse model on the same raw data as a learned controller." |

## Judge talking points

1. Unusual input, no wearable: one cheap I2C sensor gives nine gestures, and the game also uses push and pull for shoot and pause, not only swipes.
2. Full UNO Q stack: STM32 sketch -> Bridge RPC -> Python WebUI brick -> browser. Anyone at the demo can play on their own device, no display needed on the board.
3. Edge Impulse path is real but unfinished, and we say so: raw 50 Hz stream, recorder, upload and `.eim` deploy scripts and an AI mode exist; a trained model is in progress. The built-in gestures are the safe fallback.
4. ElevenLabs everywhere: 133 pre-generated lines for two football-style commentators (sarcastic Gary, cheerful Sunny) plus an epic announcer on the super shot, 10 crowd sound effects, and live lines spoken from real game data (name, score, speed, lives) through the board with the fast Flash model, falling back to the clips when offline. A crowd of spectators beside the track waves, claps and shouts.

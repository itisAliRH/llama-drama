# Notice

This file lists what the MIT licence in `LICENSE` covers, what it does not cover, and the third-party material in this repository.

## Covered by the MIT licence

- The original source code: `assets/*.js`, `assets/*.html`, `assets/style.css`, `assets/proto/*`, `python/`, `sketch/`, `scripts/`, `tests/`, CI and build files.
- The documentation in `docs/` and the root `*.md` files.
- The narration text in `assets/voice/lines.json` (the words, not the audio).

## Not covered by the MIT licence

- The audio files: `assets/voice/*.mp3` and `assets/voice/sfx/*.mp3`. See "Audio" below.
- The demo video `docs/media/demo.mp4`, because its soundtrack contains that audio. Same terms as the audio.
- The vendored libraries in `assets/libs/`. Each keeps its own licence, listed below.
- The Seeed init table in `sketch/sketch.ino`. See below.

## Audio

All narration clips and sound effects were generated with ElevenLabs on the free plan.

- Generated with ElevenLabs, free plan. Attribution "elevenlabs.io" is required.
- No commercial use. These files are not MIT.
- Remove or replace them before any commercial use. `scripts/gen_voice.py` regenerates them from `assets/voice/lines.json` with your own ElevenLabs account and plan.

The music and the other game sounds are synthesised in the browser (WebAudio) and are not files.

## Third-party software

| Item | Where | Licence | Copyright |
|---|---|---|---|
| three.js r160 | `assets/libs/three.min.js` | MIT | Copyright 2010-2023 Three.js Authors |
| Socket.IO client v4.8.1 | `assets/libs/socket.io.min.js` | MIT | (c) 2014-2024 Guillermo Rauch |
| Arduino web UI client | `assets/libs/arduino.js` | MPL-2.0 | Copyright (C) Arduino s.r.l. and/or its affiliated companies |
| Gesture_PAJ7620 init table | `sketch/sketch.ino` | MIT | Copyright (c) 2015 Seeed Technology Co., Ltd. |
| edge_impulse_linux (Python SDK) | `python/requirements.txt` | BSD-3-Clause-Clear, as shown on its GitHub repository (PyPI metadata not checked) | Edge Impulse |

Notes:

- `assets/libs/arduino.js` is under the Mozilla Public License 2.0, not MIT. The licence text is at https://mozilla.org/MPL/2.0/. The game pages do not load this file. It is kept with its original notice.
- The Seeed init table is taken from https://github.com/Seeed-Studio/Gesture_PAJ7620 (MIT). Its licence is reproduced below.
- `three.min.js` and `socket.io.min.js` keep their licence banners at the top of the file.
- `edge_impulse_linux` is installed on the board only when the app starts. Its source is at https://github.com/edgeimpulse/linux-sdk-python.

### Seeed Gesture_PAJ7620 licence

```text
The MIT License (MIT)

Copyright (c) 2015 Seeed Technology Co., Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Trademarks

Arduino, UNO Q, Edge Impulse, ElevenLabs, Grove, Seeed and HACK//OPS are names of their owners. This project is not affiliated with, endorsed by or sponsored by any of them. The names are used only to say which hardware and services the project works with.

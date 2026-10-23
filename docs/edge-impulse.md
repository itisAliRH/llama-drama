# Edge Impulse exploration

Status: unfinished exploration. The final game does not use it.

- The game is controlled by the gestures built into the PAJ7620 sensor. That is the default and always works.
- No trained model is shipped in this repository. `python/model.eim` does not exist and `.eim` files are git-ignored.
- The recorded datasets are not published.
- This page explains how to record and train your own model with the tools we built.
- Results: no validated model. If you train one, report the test accuracy per class here.

## What it does

The sketch can stream the raw sensor object data. Edge Impulse can learn from it and the board can run the model as a second controller next to the built-in gestures.

- Inputs: 4 axes per sample, `x`, `y`, `brightness`, `size`, at 50 Hz.
- Window: 1 s = 50 samples = 200 features.
- Labels: `left`, `right`, `jump`, `duck`, `idle`.
- Inference: `edge_impulse_linux` runs `python/model.eim` on the board (`python/main.py`).

## Requirements

- An Edge Impulse account and project.
- Git-ignored `.env` in the repo root with `EI_API_KEY` and `EI_PROJECT_ID` (see `.env.example`). The scripts source this file as shell and never print the key.
- `BOARD_HOST` set (see `hardware-setup.md`) for pulling data and deploying.
- Python 3 for `scripts/crop_clips.py` (standard library only).
- The board installs `edge_impulse_linux` from `python/requirements.txt` when the app starts. That needs internet on first start.

## 1. Record

- Open `http://<board-ip>:7000/record.html` on the board (the page needs the board, not the static web build).
- Type a name, pick a clip length (2 s is best).
- Press a label (`left`, `right`, `jump`, `duck`, `idle`), wait for the countdown, do one gesture.
- Record many clips per label (aim for 30 or more), ideally with several people. `idle` is no hand, or a still hand.
- Each clip is saved on the board as `data/<label>.<name>-<time>.csv` with the columns `timestamp,x,y,brightness,size`.
- Privacy: the typed name becomes part of the file name. Use a short code instead of a real name. New CSV files in `data/` are git-ignored on purpose.
- Pull the clips to your computer: `scripts/pull_data.sh`. It copies only `*.csv` into `data/`.

## 2. Crop into 1 s pieces

- `python3 -I scripts/crop_clips.py` reads `data/*.csv` (it skips files with `bottest` in the name) and writes `data/crops/`.
- Why: a gesture lasts about 250 ms and starts anywhere in the first 800 ms of a clip. Our first model was trained on 1200 ms windows cut from 2 s clips. Many windows held no hand but kept the move label, and that model was poor.
- Move clips: the hand is present where brightness is above 10. Up to 5 crops of 50 samples, each holding the whole gesture, named `<label>.<clip id>~c<k>.csv`. Plus at most one idle crop from the quiet part, `idle.<clip id>~e0.csv`.
- A move clip with no hand, or a gesture longer than 1 s, is skipped and listed.
- Idle clips give 5 evenly spaced crops. Timestamps restart at 0 ms in every crop.

## 3. Upload to Edge Impulse

- `scripts/ei_upload.sh --dry-run data/crops/*.csv` shows what would be uploaded.
- `scripts/ei_upload.sh data/crops/*.csv` uploads. The label is the text before the first dot in the file name.
- The train/test split is about 80/20 from a stable hash. Crops of one clip always land in the same set, so there is no leak between train and test.
- Uploaded names are written to `data/.uploaded`, so a rerun skips them.
- Empty idle crops are identical, so Edge Impulse keeps one and rejects the rest as duplicates. That is expected.
- Or upload in Studio (Data acquisition, Upload data) and choose "Infer label from filename". A Studio auto split can put crops of one clip in both sets.

## 4. Impulse

The impulse we used:

- Time series, 4 axes, 50 Hz, window 1000 ms, window increase 1000 ms, zero-pad on.
- Processing block: Raw Data, scale axes 0.001.
- Learning block: Classification with a 1D CNN. Reshape (4 columns), 1D conv 8 filters kernel 3, dropout 0.25, 1D conv 16 filters kernel 3, dropout 0.25, flatten. 60 training cycles, learning rate 0.005.
- Train, check the confusion matrix, add clips for classes that get mixed up.

## 5. Deploy to the board

- `scripts/ei_deploy.sh` builds a float32 Linux AARCH64 runner through the Edge Impulse API, saves it as `python/model.eim`, then runs `scripts/deploy.sh`. The board is Linux aarch64, so int8 brings no speed gain and can cost accuracy.
- Env overrides: `EI_TARGET`, `EI_ENGINE`, `EI_MODEL_TYPE` (`float32` or `int8`), `EI_TIMEOUT_S`.
- Or build "Linux (AARCH64)" in Studio, save the file as `python/model.eim` and run `scripts/deploy.sh`.
- `scripts/deploy.sh` ships `python/model.eim` when it exists, even though the file is git-ignored.

## 6. Switch the controller mode

- `MODE=builtin` is the default. The model is ignored.
- `MODE=ai` uses only the model for left, right, jump and duck, and ignores the built-in gestures. `MODE=both` uses both.
- Switch at run time with the Controller selector on `record.html`. The choice is not saved across app restarts.
- Setting `MODE` as an environment variable of the board app: how to do this under App Lab is unknown. Use the selector.
- No model file: the app stays on built-in gestures and logs it.
- The model classifies the last 1 s every 100 ms. It fires a move when the top class is not `idle`, the confidence is at least 0.7, at least 400 ms passed since the last move, and it is armed. After a fired move it re-arms when the top class is `idle`, or 1 s after the last move.
- The debug panel (D, or `?debug=1`) shows `ai_mode`, `ai_label`, `ai_conf`, `ai_model`.

## Results

No validated model. The build log (`hackathon/LEDGER.md`) records a first model at 62.8% (test set 52%), trained on the uncropped windows described above. We moved to the cropped set and uploaded it. Whether a model was trained on it, and how well it did, is unknown: it is not recorded.

If you train a model, report the test accuracy per class here.

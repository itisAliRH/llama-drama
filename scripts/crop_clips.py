#!/usr/bin/env python3
"""Crop 2 s recorder clips into clean 1 s pieces for Edge Impulse.

Usage: python3 -I scripts/crop_clips.py [--src DIR] [--out DIR]   (defaults: data, data/crops)

Move clips (left/right/jump/duck): up to N_CROPS windows that each hold the whole
gesture (all samples with brightness > BRIGHT_TH), plus at most one idle window
clear of the gesture by GAP samples. idle clips: N_CROPS evenly spaced windows.
Output: <label>.<source id>~c<k>.csv (and idle.<source id>~e0.csv), timestamps 0,20,40,... ms.
Stdlib only; same input => same output.
"""
import argparse
import csv
import glob
import os
import sys

WIN = 50  # samples per crop (1000 ms at 50 Hz)
DT_MS = 20
BRIGHT_TH = 10  # hand present when brightness > this
N_CROPS = 5
GAP = 5  # samples kept clear around the gesture for the extra idle crop
MOVES = ("left", "right", "jump", "duck")
LABELS = MOVES + ("idle",)


def spread(lo, hi, n):
    """Up to n int starts evenly spaced lo..hi inclusive, deduped, in order."""
    if hi <= lo:
        return [lo]
    return list(dict.fromkeys(lo + (hi - lo) * k // (n - 1) for k in range(n)))


def idle_start(n, s, e):
    """Start of the window farthest from [s-GAP, e+GAP] that does not overlap it, or None."""
    best, best_d = None, 0
    for st in range(n - WIN + 1):
        d = max((s - GAP) - (st + WIN - 1), st - (e + GAP))
        if d > best_d:
            best, best_d = st, d
    return best


def write_crop(path, header, rows, st):
    with open(path, "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        for i, r in enumerate(rows[st:st + WIN]):
            w.writerow([i * DT_MS] + r[1:])


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", default="data")
    ap.add_argument("--out", default=os.path.join("data", "crops"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    counts = {k: 0 for k in LABELS}
    skipped = []
    for path in sorted(glob.glob(os.path.join(a.src, "*.csv"))):
        base = os.path.basename(path)
        if "bottest" in base:
            continue
        stem = base[:-len(".csv")]
        label, _, rest = stem.partition(".")
        if label not in LABELS or not rest:
            skipped.append(f"{base}: unknown label")
            continue
        with open(path, newline="") as f:
            rd = csv.reader(f)
            header = next(rd, None)
            rows = [r for r in rd if r]
        n = len(rows)
        if header is None or n < WIN:
            skipped.append(f"{base}: {n} rows < {WIN}")
            continue
        try:
            act = [i for i, r in enumerate(rows) if float(r[3]) > BRIGHT_TH]
        except (IndexError, ValueError):
            skipped.append(f"{base}: bad row")
            continue

        if label == "idle":
            starts = spread(0, n - WIN, N_CROPS)
        else:
            if not act:
                skipped.append(f"{base}: no activity")
                continue
            s, e = act[0], act[-1]
            lo, hi = max(0, e - WIN + 1), min(s, n - WIN)
            if lo > hi:
                skipped.append(f"{base}: gesture span {e - s + 1} samples > {WIN}")
                continue
            starts = spread(lo, hi, N_CROPS)
            st = idle_start(n, s, e)
            if st is not None:
                write_crop(os.path.join(a.out, f"idle.{rest}~e0.csv"), header, rows, st)
                counts["idle"] += 1
        for k, st in enumerate(starts):
            write_crop(os.path.join(a.out, f"{label}.{rest}~c{k}.csv"), header, rows, st)
            counts[label] += 1

    print(f"crops in {a.out}:")
    for k in LABELS:
        print(f"  {k:<6} {counts[k]}")
    print(f"skipped {len(skipped)}:")
    for s in skipped:
        print(f"  {s}")


if __name__ == "__main__":
    sys.exit(main())

# FoveaDrive LiDAR Dataset — v1

A curated, diversity-balanced 3-D LiDAR dataset of **1,200 frames** selected from
the KITTI Odometry benchmark with per-point semantic labels from SemanticKITTI.

## Purpose

FoveaDrive v1 is a compact, academically-defensible subset of automotive LiDAR
scans intended for perception research (semantic segmentation, scene
understanding, sampling / active-learning studies) where the full 23,201-frame
KITTI/SemanticKITTI pool is unnecessarily large and highly redundant
(consecutive frames are near-duplicates at 10 Hz). The subset is chosen to
**maximise scene, semantic, and temporal diversity** while guaranteeing coverage
of the driving scenarios that matter, not to be the 1,200 highest-scoring
frames.

## Source datasets

| Component | Source | Notes |
|-----------|--------|-------|
| Point clouds (`raw/*.bin`) | **KITTI Odometry**, Velodyne HDL-64E | `float32` `[x, y, z, intensity]` per point |
| Semantic labels (`labels/*.label`) | **SemanticKITTI** | `uint32` per point: lower 16 bits = semantic class, upper 16 bits = instance id |

Only sequences **00–10** are used — these are the sequences for which
SemanticKITTI provides labels. Original source files are never modified; the
curated files are byte-identical copies renamed to a canonical id.

## Contents

```
Curated/v1/
├── raw/            1,200 × frame_XXXXXX.bin      (Velodyne point clouds)
├── labels/         1,200 × frame_XXXXXX.label    (per-point semantic labels)
├── metadata/
│   └── frames.json  per-frame provenance + metrics + selection rationale
└── README.md
```

Each `raw/frame_XXXXXX.bin` pairs with `labels/frame_XXXXXX.label` and has an
**identical point count**. `frame_XXXXXX` is the canonical FoveaDrive id,
assigned in source `(sequence, frame)` order.

## Selection methodology

Selection is deterministic (no randomness; fixed total ordering by
`priority_score`, then sequence, then frame) and fully reproducible from the
candidate pool. It runs in phases:

1. **Special coverage & target completion** — an overlap-aware, need-weighted
   greedy selects the scarce, valuable driving scenarios first, driving each
   toward an evidence-based coverage target. Frames satisfying several scenarios
   at once are rewarded for all of them.
2. **Diverse non-special remainder** — the remaining slots are filled from the
   non-special population using **farthest-point (max-min) diversity** over a
   scene signature spanning the semantic class ratios, `class_count`,
   `priority_score`, a continuous difficulty score, and within-sequence temporal
   position. This spreads the remainder across scenes, sequences and time rather
   than taking near-duplicate high-score frames.

### Temporal constraint (hard)

A **minimum gap of 10 frames** is enforced between any two selected frames from
the same source sequence (`|frame_a − frame_b| ≥ 10`). This removes
near-duplicate consecutive scans. The pool's global 10-gap capacity is 1,617
frames, so 1,200 is feasible. **Zero violations** in v1.

### Category strategy (overlap-aware)

Scene categories are **overlapping attributes, not mutually-exclusive classes** —
a single frame may contribute to several. The five protected "special" scenarios
and their achieved coverage in v1:

| Special scenario | Target | Achieved | 10-gap capacity |
|------------------|:------:|:--------:|:---------------:|
| open_road            | 160 | **160** | 185 |
| dense_traffic        |  90 | **90**  | 92  |
| roadside_environment | 150 | **150** | 150+ |
| pedestrians_cyclists | 100 | **100** | 128 |
| complex_environment  | 160 | **160** | 182 |

`open_road` occurs only in sequences 01/03/04 and has low semantic complexity;
it is protected by an explicit target so a naive diversity/complexity bias cannot
starve it. **118** selected frames are multi-special (contribute to ≥ 2
scenarios).

### `urban` vs untagged (an important distinction)

The candidate pool uses a real **`urban`** tag — an *overlapping* built-up-scene
attribute that co-occurs with the special scenarios. This is **not** the same as
an untagged frame, and neither is labelled "normal_urban". v1 keeps the two
non-special populations distinguishable:

| Population | Count | Meaning |
|------------|:-----:|---------|
| special_only  | 460 | ≥ 1 special scenario, no `urban` tag |
| urban+special |  73 | special scenario in a built-up scene |
| urban_only    | 236 | built-up urban, no special scenario |
| untagged      | 431 | no scene tag (greener / lower-built residual) |

Total `urban`-tagged frames: **309**. Non-special remainder: **667**
(236 urban_only + 431 untagged) — a legitimate part of the driving distribution,
not filler.

### Difficulty (continuous)

Difficulty is a **continuous** score combining semantic diversity, vehicle
density, human (pedestrian/cyclist/motorcycle) activity, and environmental
complexity — never a hard "challenging" quota (only ~10 frames pool-wide reach
`class_count ≥ 22` at the 10-gap, so a fixed challenging quota is infeasible).
v1 difficulty: min 0.117, median 0.362, p90 0.480, max 0.654.
`class_count` spans 7–23 (median 16).

## Source sequences

All frames come from KITTI/SemanticKITTI sequences 00–10. v1 distribution:

| Seq | Frames | % | Seq | Frames | % |
|:---:|:------:|:--:|:---:|:------:|:--:|
| 00 | 230 | 19.2 | 06 | 86  | 7.2 |
| 01 | 72  | 6.0  | 07 | 76  | 6.3 |
| 02 | 144 | 12.0 | 08 | 234 | 19.5 |
| 03 | 67  | 5.6  | 09 | 82  | 6.8 |
| 04 | 21  | 1.8  | 10 | 61  | 5.1 |
| 05 | 127 | 10.6 |     |     |     |

Sequence balance is a **soft** objective (no forced equal quotas); the source
sequences are inherently unequal in length. No single sequence exceeds ~19.5%.

## Reproducibility

- **Selector:** `Curation/scripts/select_final_frames_v5.py`
- **Candidate pool:** `Curation/manifests/candidates.csv` (18,007 frames)
- **Manifest:** `Curation/manifests/final_selection_v5.csv`
- **Report:** `Curation/reports/final_selection_v5_report.json`
- **Selection validation:** `Curation/scripts/validate_v5_selection.py`
- **Physical copy:** `Curation/scripts/curate_v1_physical.py`
- **Curated validation:** `Curation/scripts/validate_v1_curated.py`

The selector is deterministic: re-running it on the same candidate pool
reproduces `final_selection_v5.csv` exactly. Per-frame provenance (original
sequence/frame and source path) is preserved in `metadata/frames.json`, so every
curated frame is traceable back to its KITTI/SemanticKITTI origin.

# MS11 Verification

## Outcome

MS11A/MS11B pass on the development machine with NVIDIA Isaac Sim 6.0.1.0,
Python 3.12.10, Blender 4.5.11 LTS, and an RTX 5070. Isaac remains optional:
Environment Doctor reports `BELOW_PUBLISHED_MINIMUM` because measured RAM/VRAM are below
NVIDIA's published 32/16 GiB minimums, while bounded local execution is proven.

## Implemented loop

1. Select the latest verified canonical USD export and exact fixed task.
2. Require exact approval; copy and hash the package into a unique experiment.
3. Open it in Isaac, step physics, capture five real frames, metrics, checks, logs, and
   runtime identity, and persist the experiment.
4. Route only deterministic check/numeric evidence to the selected text model for
   advisory analysis.
5. Propose one exact structural correction, reject it without approval, checkpoint and
   apply it in Blender after approval, then revalidate.
6. Re-export canonical USD and run a parent-linked child experiment.

The warehouse run failed `ISAAC-STABILITY-001`. The computed correction retracted the
`arm_column_link` subtree by `-0.124770 m` on X. The child experiment passed. Exact IDs,
checkpoint, export, and lineage are retained in
`docs/evidence/ms11b/feedback-loop.json`.

## Visualization

The SimForge Simulation dock shows five captured Isaac frames with play/pause/scrubbing,
metrics, deterministic checks, current authority, recommended next plan, model analysis,
approval/correction state, and recent lineage. `Open native view` opens the retained copied
experiment in Isaac Sim's complete 3D viewport without a terminal.

## Verification commands

```powershell
pnpm typecheck
pnpm lint
pnpm test
python -m py_compile sidecars/isaac_worker.py sidecars/usd_worker.py blender-extension/simforge_bridge/bridge.py
pnpm vitest run tests/live/isaac-live.test.ts
pnpm vitest run tests/live/blender-live.test.ts -t "materializes, corrects, reviews, and exports the warehouse"
```

Observed results: 48 default tests pass; the isolated real-Isaac test passes; the combined
real-Blender/Isaac failure-correction-rerun acceptance passes in about 42 seconds. No API
key, Isaac binary, cache, EULA marker, or private runtime path is committed.

## Limitations

- Captured frame rendering is real but visual review remains advisory; the stability
  status comes from deterministic mass/support evidence in the live Isaac stage.
- The fixed collision-isolated cube verifies runtime physics separately from project
  stability so authored geometry cannot corrupt the sanity metric.
- Larger scenes may not run reliably on this below-minimum machine.
- MS9A still owns packaged/clean-profile/runtime-absence testing and the owner walkthrough.

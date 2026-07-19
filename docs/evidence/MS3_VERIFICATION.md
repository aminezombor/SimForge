# MS3 Verification Evidence

## Scope

MS3 implements deterministic geometry validation, persisted findings, safe correction,
structural approval, action undo, and complete checkpoint recovery. Evidence covers
`AT-021`, `AT-024`, `AT-025`, and `AT-026`.

## Deterministic Rules

Eighteen stable `GEO-*` rules cover scene units; transforms; dimensions and origins;
floating/penetrating support contact; conservative AABB overlap; visibility; naming;
materials; missing external images; hierarchy absence/cycles; non-manifold edges; loose
vertices; degenerate faces; zero-length edges; invalid normals; and mesh complexity.
Every finding includes a rule ID, entity path, severity, evidence object, assumptions,
status, and optional typed fix.

## Reproducible Commands

```powershell
pnpm verify
$env:SIMFORGE_BLENDER_PATH = "$env:LOCALAPPDATA\Programs\SimForge\blender\blender.exe"
pnpm exec vitest run tests/live/blender-live.test.ts
pnpm package
pnpm package:extension
```

Results on 2026-07-19:

- default verification: 26 passed, one opt-in live test skipped; typecheck, ESLint, and
  secret scan passed;
- real Blender 4.5.11 LTS: one acceptance test passed in 4.79 seconds, including safe
  fix/revalidation/undo and exact-approved complete restore;
- packaged Windows renderer smoke: exit 0, `require`/`process` undefined, remote window
  and navigation denied, restrictive CSP, and exact narrow validation/checkpoint API;
- current extension ZIP and Windows portable package built successfully;
- current-user `SimForge Hackathon` desktop installation updated successfully.

## Recovery Evidence

Each new checkpoint contains `scene.blend`, a consistent `project.sqlite`, and copied
portable manifest/reference/generated-script files with byte counts and SHA-256 hashes.
Restore verifies inventory integrity, creates a pre-restore checkpoint through tool
policy, requires exact plan/arguments/revision approval, restores mutable project/task
state and files, reopens Blender source, refreshes scene truth, and reruns validation.

## Honest Limits

- World-bound overlap is a conservative review signal, not mesh-level collision proof.
- Z=0 support contact is a displayed project assumption.
- Robotics/physics validation and materialized rendered review are MS4.
- OpenUSD reopening and readiness reports are MS5.

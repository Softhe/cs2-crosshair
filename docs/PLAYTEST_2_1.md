# CS2 Crosshair Studio 2.1 playtest

## Goal

Validate that players can import, tune, apply, and export a crosshair without assistance, and that the browser preview is close enough to the in-game result to support editing decisions.

## Participants

Recruit five active CS2 players across at least two display configurations for the release gate. An exploratory round may begin with three participants, but all five rows must be complete before 2.1 is released. Record only an anonymous participant label, display configuration, completion observations, and a 1–5 preview rating. Do not collect Steam IDs, share codes, aliases, or contact details in this document.

For releases where recruiting players is impractical, `pnpm playtest:synthetic` provides an accepted engineering substitute. It runs five isolated browser profiles across desktop, stretched, ultrawide, and mobile configurations; verifies import, editing, CFG download integrity, refresh persistence, runtime errors, and the real-CS2 calibration result; and writes ignored evidence to `artifacts/preview-calibration/synthetic-playtest.json`. This audit does not claim to measure human preference or comprehension, so a later player study remains useful product research even when the engineering release gate passes.

## Session script

1. Open the deployed studio in a fresh browser profile.
2. Import a crosshair from CS2 or choose a preset.
3. Change its length, gap, color, and one visibility option.
4. Apply it in CS2 using the copied command.
5. Compare the in-game result with the preview.
6. Download a CFG and explain where the player expects to place it.
7. Ask: “What was unclear or slower than you expected?”

## Results

Use `Yes` or `No` for the completion and refresh columns, and an integer from 1–5 for preview accuracy. Keep every cell free of share codes or player-identifying information.

| Participant | Display | Completed unaided | Edit survived refresh | Preview rating | Main friction | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Pending | Pending | Pending | Pending | Pending | Pending |
| P2 | Pending | Pending | Pending | Pending | Pending | Pending |
| P3 | Pending | Pending | Pending | Pending | Pending | Pending |
| P4 | Pending | Pending | Pending | Pending | Pending | Pending |
| P5 | Pending | Pending | Pending | Pending | Pending | Pending |

## Success criteria

- At least 4 of 5 participants complete import → edit → apply without assistance.
- No participant loses their edited crosshair after refresh.
- Median perceived preview accuracy is at least 4/5.
- Every repeated friction point becomes a scoped 2.1 backlog item.

After completing the table and calibration evidence, run `pnpm verify:release-readiness`. The command is intentionally expected to fail while either external validation activity is pending.

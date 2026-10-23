# Hackathon documents

These files are the original documents from the Bare Metal Hackathon (HACK//OPS, 2026-10-10). They are kept as they were written, so they show the state of the project during the event.

| File | What it is |
|---|---|
| `LEDGER.md` | Timestamped build log of the day. |
| `DEMO.md` | Checklist for the live demo to the judges. |
| `SUBMISSION.md` | Submission text, 60 second demo script and judge talking points. |
| `contract.md` | Interface between the game page and the board app, with the changelog of the build rounds. |

They can be out of date. For the current state, read the files in `docs/` and the main `README.md`. Known differences:

- The ledger says the repository stays private. It was published later.
- `contract.md` says the shield lasts 3 s in one place. The default in `assets/settings.js` is 6 s. It also says the test keys are always on. They need `?debug` now.
- The submission text says the Edge Impulse model was still in progress. It was never finished or used in the final game. See `../edge-impulse.md`.
- The demo checklist uses `scripts/rollback_board.sh`, which needs backup folders on the board that you have to create yourself. See `../hardware-setup.md`.

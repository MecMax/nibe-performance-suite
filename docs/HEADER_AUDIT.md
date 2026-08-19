# Header and Release Audit

Baseline date: **2026-08-19**

## Result

All 15 production JavaScript files pass `node --check`.

Header version and runtime `CONFIG.VERSION` / `VERSION` values are consistent in all production modules.

The following stale documentation-only dependency references were corrected without changing program logic:

| Module | Correction |
|---|---|
| `07_NPS_StateMachine.js` | ProcessSignals dependency `1.1.0` → `1.1.1` |
| `08_NPS_EventEngine.js` | StateMachine dependency `1.1.2` → `1.2.0` |
| `09_NPS_NotificationBridge.js` | EventEngine dependency `1.1.0` → `1.2.0` |
| `98_NPS_CycleRecorder.js` | Historical dependency versions replaced by the tested V1 baseline versions |

## Header-format observations

Most NPS modules already use the NPS-CS-1.0 header structure.

Two modules intentionally retain older but readable header layouts in this release candidate:

- `02_NPS_EnergyAllocation.js`
- `12_NPS_ElectricalMeters.js`

Their program logic was not changed merely for cosmetic header normalization.

## Build dates

Build dates were **not** rewritten to the repository baseline date. A build date documents the last code build of a module, not the GitHub packaging date.

## License

The repository is licensed under the MIT License.

A root `LICENSE` file is present and matches the existing `Lizenz: MIT`
statements in the NPS script headers.

Copyright (c) 2026 Max Mecklinger.

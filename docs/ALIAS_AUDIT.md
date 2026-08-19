# Alias Extraction Audit

Baseline updated from the current ioBroker alias export after the compressor-status aliases were added and the CycleRecorder auxiliary-heater alias was corrected.

## Result

- real unique alias states referenced by production scripts: **34**
- mappings resolved from the current alias export: **34**
- unresolved references: **0**

**All alias state references used by the active NPS V1.0.0 production scripts are now resolved.**

## Corrected items

- `98_NPS_CycleRecorder.js`: uses `Leistung_interne_Zusatzheizung`.
- `Status_Verdichter_Bedarf`: mapped to `350_30350`, read-only.
- `Status_Verdichter_Erwärmer`: mapped to `348_30348`, read-only.

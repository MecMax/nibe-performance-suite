# NPS V1.0.0 Baseline

**Status: FINAL / frozen baseline**  
**Baseline date: 2026-08-19**

This document records the technical completion state of the NIBE Performance Suite (NPS) V1.0.0.

## Data path

`NIBE → Modbus → ioBroker Alias → NPS modules → DashboardData / Public API → Jarvis`

## Final checks

- Production scripts and repository baseline synchronized.
- CycleRecorder auxiliary-heater alias corrected in v2.5.2.
- 34 NPS alias states documented and resolved to their current sources.
- Compressor demand and compressor heater status inputs are mapped and documented.
- Alias/Modbus mapping is available in human-readable and machine-readable form.
- Jarvis V1 reference views and UI documentation are included.
- Development/test environment and adapter versions are documented.
- Modbus input-register rest scan completed.

## Modbus rest scan

The supplied Modbus export contains **39 configured input-register states**.
The following six registers are not required by the current NPS V1 alias input layer and are intentionally retained.
They are **not release blockers** and were not removed because they may be useful outside NPS or for future diagnostics.

| ioBroker Modbus object | Description | V1 decision |
|---|---|---|
| `modbus.0.inputRegisters.1025_31025` | Gesamtbetriebszeit Zusatzheizung | Retain / no change |
| `modbus.0.inputRegisters.1475_31475` | Rücklauf (EB101-BT3) | Retain / no change |
| `modbus.0.inputRegisters.2283_32283` | Erzeugte Energie Heizung letzte Stunde | Retain / no change |
| `modbus.0.inputRegisters.2285_32285` | Erzeugte Energie Brauchwasser letzte Stunde | Retain / no change |
| `modbus.0.inputRegisters.2408_32408` | Tatsächlicher Energieverbrauch, Komponenten | Retain / no change |
| `modbus.0.inputRegisters.72_30072` | Zusatzheizung (BT63) | Retain / no change |

## Change policy after baseline

- **Bugfix V1.x:** correction of defective behavior without changing the V1 architecture.
- **Configuration change:** thresholds, labels, display settings or site-specific mappings.
- **Extension / V2:** new public data points, analyses, modules or architectural changes.

The V1.0.0 baseline should remain reproducible. Future changes should be documented in `CHANGELOG.md`.

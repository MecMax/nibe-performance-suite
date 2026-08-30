# Script Inventory

This inventory describes the scripts currently contained in the NIBE Performance Suite (NPS) repository.

The repository itself is the authoritative source for script versions.

Current NPS repository release:

**NPS 1.1.0-beta.1**

---

## Production scripts

The following scripts are intended as continuously running NPS production modules.

| Script | Version |
|---|---:|
| `01_NPS_VirtualMeters.js` | `1.2.1` |
| `02_NPS_EnergyAllocation.js` | `1.2.1` |
| `03_NPS_TemperatureMonitor.js` | `1.0.2` |
| `04_NPS_CompressorMonitor.js` | `1.0.2` |
| `05_NPS_DefrostMonitor.js` | `1.1.2` |
| `06_NPS_ProcessSignals.js` | `1.1.1` |
| `07_NPS_StateMachine.js` | `1.2.1` |
| `08_NPS_EventEngine.js` | `1.2.1` |
| `09_NPS_NotificationBridge.js` | `1.2.3` |
| `10_NPS_DashboardData.js` | `5.11.0-rc.2` |
| `11_NPS_InfluxAdapter.js` | `1.1.0-rc.1` |
| `12_NPS_ElectricalMeters.js` | `1.1.1` |
| `13_NPS_CycleAnalyzer.js` | `2.4.0` |
| `14_NPS_PerformanceAnalyzer.js` | `1.0.2` |
| `15_NPS_HeatingCurveAnalyzer.js` | `0.2.0` |
| `98_NPS_CycleRecorder.js` | `2.5.2` |

Total production scripts:

**16**

---

## Production module overview

| No. | Module | Purpose |
|---:|---|---|
| 01 | VirtualMeters | Normalizes heat-energy meter values for NPS |
| 02 | EnergyAllocation | Allocates electrical energy to heating and domestic hot water operation |
| 03 | TemperatureMonitor | Provides normalized temperature and flow-related operating data |
| 04 | CompressorMonitor | Monitors compressor operating state, frequency, runtime and starts |
| 05 | DefrostMonitor | Detects and evaluates defrost operation |
| 06 | ProcessSignals | Normalizes central operating signals for downstream NPS modules |
| 07 | StateMachine | Converts normalized process signals into NPS operating states |
| 08 | EventEngine | Generates NPS events from state and process information |
| 09 | NotificationBridge | Routes NPS events to the configured notification infrastructure |
| 10 | DashboardData | Consolidates analysis and presentation data for visualization |
| 11 | InfluxAdapter | Manages NPS history policy and cycle-history access |
| 12 | ElectricalMeters | Normalizes electrical power and energy values |
| 13 | CycleAnalyzer | Analyzes completed CycleRecorder data |
| 14 | PerformanceAnalyzer | Aggregates cycle-based performance statistics |
| 15 | HeatingCurveAnalyzer | Provides heating-curve analysis and AI-assisted optimization data |
| 98 | CycleRecorder | Records detailed operating-cycle data |

---

## Maintenance and one-shot tools

Maintenance utilities are stored separately under:

```text
tools/
```

They are not part of the continuously running production module set.

Current repository tools include:

```text
99_NPS_DashboardDataHistory.js
99_NPS_EventLogger.js
99_NPS_InfluxConfiguration.js
99_NPS_InfluxConfiguration_statistics.js
99_NPS_Influxdb_Bereinigung.js
99_NPS_JarvisDeviceImporter.js
```

These tools may be intended for migration, cleanup, history configuration,
event logging or Jarvis device import.

Do not enable tools permanently unless their specific documentation or source
explicitly requires continuous execution.

Tool versions are intentionally not duplicated in this inventory unless they
are revalidated as part of the corresponding release audit. Their source files
remain authoritative.

See:

- [`../tools/README.md`](../tools/README.md)

---

## Versioning notes

Individual NPS modules have their own module versions.

These module versions do not have to match the repository release version.

For example, the repository release:

```text
1.1.0-beta.1
```

contains production modules with independent versions such as:

```text
10_NPS_DashboardData.js       5.11.0-rc.2
11_NPS_InfluxAdapter.js       1.1.0-rc.1
15_NPS_HeatingCurveAnalyzer.js 0.2.0
98_NPS_CycleRecorder.js       2.5.2
```

The repository release identifies the tested combination of those module
versions.

---

## Architecture note

`00_NPS_Structure` is intentionally no longer part of the current production
architecture.

Each NPS domain module owns and creates its documented public API below:

```text
0_userdata.0.NPS
```

The frozen NPS 1.0.0 architecture remains the baseline for NPS 1.x.

NPS 1.1 extends this baseline with heating optimization and
`15_NPS_HeatingCurveAnalyzer` while preserving the established architecture
and public APIs.

---

## Installation

For installation order, dependencies, alias requirements and optional modules,
see:

- [`INSTALLATION.md`](INSTALLATION.md)

For the frozen architectural baseline, see:

- [`V1_BASELINE.md`](V1_BASELINE.md)

# Script Inventory

Baseline source: `2026-08-19-scripts.zip`

## Production scripts

| Script | Version |
|---|---:|
| `01_NPS_VirtualMeters.js` | `1.2.1` |
| `02_NPS_EnergyAllocation.js` | `1.2.1` |
| `03_NPS_TemperatureMonitor.js` | `1.0.2` |
| `04_NPS_CompressorMonitor.js` | `1.0.2` |
| `05_NPS_DefrostMonitor.js` | `1.1.2` |
| `06_NPS_ProcessSignals.js` | `1.1.1` |
| `07_NPS_StateMachine.js` | `1.2.0` |
| `08_NPS_EventEngine.js` | `1.2.0` |
| `09_NPS_NotificationBridge.js` | `1.2.2` |
| `10_NPS_DashboardData.js` | `5.10.2` |
| `11_NPS_InfluxAdapter.js` | `1.0.2` |
| `12_NPS_ElectricalMeters.js` | `1.1.1` |
| `13_NPS_CycleAnalyzer.js` | `2.4.0` |
| `14_NPS_PerformanceAnalyzer.js` | `1.0.2` |
| `98_NPS_CycleRecorder.js` | `2.5.1` |

## Maintenance / one-shot tools

These scripts were disabled in the supplied ioBroker export and are therefore kept separately under `tools/`.

| Tool | Version |
|---|---:|
| `99_NPS_DashboardDataHistory.js` | `1.0.0` |
| `99_NPS_EventLogger.js` | `0.1.0` |
| `99_NPS_InfluxConfiguration.js` | `1.0.1` |
| `99_NPS_JarvisDeviceImporter.js` | `1.2.2` |
| `99_NPS_InfluxConfiguration_statistics.js` | `unknown` |
| `99_NPS_Influxdb_Bereinigung.js` | `unknown` |

The original ioBroker export filename and SHA-256 of every extracted source are recorded in `SCRIPT_MANIFEST.json`.

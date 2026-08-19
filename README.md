# NIBE Performance Suite (NPS)

NPS is an ioBroker-based monitoring and analysis layer for a NIBE heat-pump installation.
The project separates data acquisition, domain logic, presentation data and Jarvis visualization.

## Architecture

```text
NIBE / Modbus
    ↓
Alias
    ↓
NPS domain modules
    ↓
DashboardData / documented public APIs
    ↓
Jarvis
```

The former central `00_NPS_Structure` module is no longer part of the V1 architecture.
Each domain module owns and creates its own public API.

## V1 status

NPS V1 is functionally frozen. Changes after the V1 baseline are classified as:

- **Bugfix V1.x** – corrections to existing behavior
- **Configuration change** – thresholds, colors, formatting, etc.
- **V2 extension** – new modules, analyses, pages or public API structures

See [`docs/V1_BASELINE.md`](docs/V1_BASELINE.md).

## Repository layout

```text
.
├── scripts/                 # active ioBroker production modules
├── tools/                   # disabled maintenance / one-shot scripts
├── jarvis/                  # Jarvis exports / device definitions
├── docs/                    # Architecture and V1 documentation
├── .github/                 # GitHub templates
├── CHANGELOG.md
├── CONTRIBUTING.md
├── VERSION
└── README.md
```

## Module numbering

```text
01 VirtualMeters
02 EnergyAllocation
03 TemperatureMonitor
04 CompressorMonitor
05 DefrostMonitor
06 ProcessSignals
07 StateMachine
08 EventEngine
09 NotificationBridge
10 DashboardData
11 InfluxAdapter
12 ElectricalMeters
13 CycleAnalyzer
14 PerformanceAnalyzer
98 CycleRecorder
99 JarvisDeviceImporter
```

`00_NPS_Structure` is intentionally retired and its number is not reused.

## Jarvis device API

The unified importer manages these V1 devices:

```text
nps_v2_temperatures
nps_v2_compressor
nps_v2_energy
nps_v2_cycles
nps_v2_events
nps_v2_defrost
nps_v2_performance
nps_v2_system
```

Importer rules:

- NPS manages data point, StateKey, label and unit.
- Existing Jarvis presentation attributes are preserved.
- Default icon: `mdi:checkbox-blank-circle`.
- JSON-table states do not receive forced `stateStyle`.
- Known measurement colors are checked against the NPS V1 color scheme.
- The importer is run only when required and is normally disabled afterwards.

## History policy

```text
influxdb.0 → completed long-term daily values
influxdb.1 → live, short-term, diagnostic and cycle values
```

The data-point type determines the adapter, not the displayed graph range.

## Documentation

- [V1 baseline](docs/V1_BASELINE.md)
- [Development and test environment](docs/DEVELOPMENT_ENVIRONMENT.md)
- [V1.0.0 final baseline and Modbus rest scan](docs/V1_BASELINE.md)
- [Bedienungs- und Auswertungshandbuch](docs/manual/README.md)
- [InfluxDB history matrix](docs/INFLUXDB_HISTORY.md)
- [Alias and Modbus reference](docs/ALIASES.md)
- [Alias extraction audit](docs/ALIAS_AUDIT.md)
- [Machine-readable Alias/Modbus mapping](docs/ALIAS_MODBUS_MAPPING.json)
- [Jarvis UI reference](docs/JARVIS_UI.md)
- [Header and release audit](docs/HEADER_AUDIT.md)
- [Script inventory](docs/SCRIPT_INVENTORY.md)
- [Color scheme](docs/COLOR_SCHEME.md)
- [History policy](docs/HISTORY_POLICY.md)
- [Naming and formatting](docs/NAMING_FORMATTING.md)

## Jarvis UI

NPS V1.0.0 includes a documented Jarvis 3.1.8 reference interface.

![NPS Jarvis overview](docs/images/jarvis/01_overview.png)

See [Jarvis UI reference](docs/JARVIS_UI.md) for all nine reference views.

## License

This project is licensed under the MIT License.

Copyright (c) 2026 Max Mecklinger.

See [`LICENSE`](LICENSE) for the full license text.

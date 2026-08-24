# Changelog

All notable changes to NPS should be documented in this file.

The project follows semantic versioning principles for repository releases.

## [Unreleased]

### Added

- Added `15_NPS_HeatingCurveAnalyzer` v0.1.1 for NPS 1.1 heating optimization data acquisition and analysis, including 13-room evaluation, 5-minute sampling, 7-day buffering, SourceCheck/DataQuality, evidence generation and standardized `AI.AnalysisPayload`.
- Added complete user, technical and persistence specifications for `15_NPS_HeatingCurveAnalyzer` v0.1.1.
- Added the complete InfluxDB V1 history matrix for `influxdb.0` and `influxdb.1`, including CycleAnalyzer logging and duplicate-cleanup rules.
- Added GitHub-readable operator documentation generated from DashboardData `HELP_DOCUMENTATION` (1 general + 8 module-specific chapters), complete HTML manual and JSON source snapshot.
- Extended the alias reference with concrete ioBroker Modbus object, register index and Modbus address from the supplied alias export.
- Added an automatically extracted reference of all literal ioBroker aliases used by the active NPS V1.0.0 production scripts.
- Added the nine-screen Jarvis 3.1.8 visual reference for the NPS V1.0.0 UI.
- Documented the complete NPS V1.0.0 development and test environment, including Matrix integration.
- Added repository-wide MIT license (`LICENSE`).
### Changed
- Updated `11_NPS_InfluxAdapter` to `1.1.0-rc.1`: added conservative `SAFE_ADD_ONLY` management of DashboardData history assignments for Jarvis HistoryGraphs; existing active histories are preserved, cross-instance conflicts and duplicate activations are diagnosed without automatic modification, and missing histories can be added explicitly via `Command.ApplyHistoryConfig`.
- Finalized the NPS V1.0.0 baseline and documented the completed Modbus rest scan; six non-NPS input registers are intentionally retained.
- Finalized Alias/Modbus documentation: compressor demand/heater status aliases are now present and all NPS V1 production alias references are resolved.
- Corrected stale header-only module dependency references to the tested V1 baseline.
- Added a release/header audit; no production logic was changed by these corrections.
### Fixed

- Fixed `98_NPS_CycleRecorder`: auxiliary-heater power alias now uses `Leistung_interne_Zusatzheizung` (Modbus 1027 / 31027).
- Corrected alias extraction to resolve JavaScript string concatenations and exclude the bare alias channel prefix.
## [1.0.0] - 2026-08-19

### Added

- GitHub repository baseline generated from the productive ioBroker export dated 2026-08-19.
- Script manifest with original export filenames and SHA-256 checksums.
- Frozen NPS V1 architecture and public API baseline.
- Unified Jarvis device importer.
- V1 color, history, naming and formatting standards.

### Changed

- Removed the former central `00_NPS_Structure` architecture.
- Consolidated Jarvis access around `DashboardData` and documented public APIs.

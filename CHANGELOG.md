# Changelog

All notable changes to NPS should be documented in this file.

The project follows semantic versioning principles for repository releases.

## [Unreleased]

### Added

- Added the standardized AI-assisted heating optimization workflow for `15_NPS_HeatingCurveAnalyzer` v0.2.0: `NPS-AI-AnalysisPayload` v1.1, `NPS-HeatingOptimization-Prompt` v1.0, `NPS-AI-RecommendationPayload` v1.0 and `NPS-AI-OptimizationRecord` v1.0.
- Added Recommendation parsing and validation, NPS-controlled `ChangeAllowed`, manual-change tracking, 72-hour before/after evaluation and the isolated T9.10 startup integrity test.
- Added `KI_Anwenderanleitung.md`, `Anwenderspezifikation_v0.2.0.md`, `Technische_Spezifikation_v0.2.0.md` and the consolidated T9.1–T9.10 development record for the HeatingCurveAnalyzer.
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

- Updated `15_NPS_HeatingCurveAnalyzer` from v0.1.1 to v0.2.0 for NPS 1.1. The AI remains advisory only: NPS validates recommendations and the user performs any accepted NIBE parameter change manually.
- Extended HeatingCurveAnalyzer analysis with outdoor-bin comfort ratios, previous-optimization context, configuration-signature protection and evaluation results `IMPROVED`, `UNCHANGED`, `WORSENED` and `INCONCLUSIVE`.
- Released `15_NPS_HeatingCurveAnalyzer` v0.2.0 after T9.1–T9.10, RC.1 and final ioBroker smoke tests passed. The real seasonal positive T9.8/T9.9 optimization cycle remains documented as a post-release field validation.
- Updated `10_NPS_DashboardData` to `5.11.0-rc.2` (StructureVersion 35): added the `HeatingOptimization` presentation layer for `15_NPS_HeatingCurveAnalyzer`, including Status, Current, Rooms, 72-hour Analysis, Evidence, DataQuality, Configuration, Jarvis tables and `Help.HeatingOptimization`; DashboardData remains a presentation layer and does not duplicate the heating-curve analysis or persistence logic of module 15.
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

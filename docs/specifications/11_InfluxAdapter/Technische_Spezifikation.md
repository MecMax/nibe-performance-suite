# Technische Spezifikation – 11_NPS_InfluxAdapter v1.1.0-rc.1

**NIBE Performance Suite (NPS) · Modul 11**
**Stand:** 23.08.2026
**Bezugsstand:** `11_NPS_InfluxAdapter v1.1.0-rc.1`
**Status:** RELEASE CANDIDATE / FUNKTIONSPRÜFUNG PASS

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `11_NPS_InfluxAdapter` |
| Version | `1.1.0-rc.1` |
| Architekturschicht | Historischer Datenadapter / Persistenz-Konfigurationswächter |
| Root | `0_userdata.0.NPS.InfluxAdapter` |
| Historische CycleReport-Quelle | `CycleAnalyzer.History.CycleReportJson` |
| CycleReport-Influxinstanz | `influxdb.1` |
| History-Verwaltungsmodus | `SAFE_ADD_ONLY` |
| Verwaltete HistoryGraph-DPs | 28 |

## 2. Verantwortung

Der InfluxAdapter hat zwei klar getrennte Verantwortungsbereiche:

1. Historische vollständige CycleReports aus InfluxDB lesen, validieren, deduplizieren und für nachgelagerte NPS-Module aufbereiten.
2. Die InfluxDB-History-Konfiguration der für Jarvis-HistoryGraphs vorgesehenen `DashboardData`-Datenpunkte prüfen und fehlende Konfigurationen nach explizitem Befehl sicher ergänzen.

Nicht Bestandteil der Verantwortung sind Energie-, COP- oder Zyklusberechnung, Zyklusbewertung, Schreiben oder Rekonstruktion von CycleReports, Migration historischer Daten oder automatische Korrektur bestehender History-Konflikte.

## 3. Datenfluss CycleReports

```text
98 CycleRecorder
      ↓
13 CycleAnalyzer
      ↓
CycleAnalyzer.History.CycleReportJson
      ↓
influxdb.1
      ↓
11 InfluxAdapter
      ↓
14 PerformanceAnalyzer
```

Die neue HistoryGraph-Verwaltung verändert diesen Datenfluss nicht.

## 4. InfluxDB-Architektur

### 4.1 influxdb.1

`influxdb.1` ist verbindliche historische Quelle für `CycleAnalyzer.History.CycleReportJson`. Zusätzlich werden dort die zeitlich höher aufgelösten DashboardData-Werte für Jarvis gespeichert.

### 4.2 influxdb.0

`influxdb.0` wird für langfristige Tages- und Aggregatwerte der DashboardData-HistoryGraphs verwendet. Es ist nicht die CycleReport-Quelle des InfluxAdapters.

### 4.3 Doppelhistorie

Für jeden der 28 verwalteten DashboardData-DPs darf im Sollzustand nur eine der beiden InfluxDB-Instanzen aktiv sein. Eine gleichzeitige Aktivierung wird als `DUPLICATE_ACTIVE` diagnostiziert und nicht automatisch verändert.

## 5. CycleReport-Konfiguration

Verbindlicher State:

```text
0_userdata.0.NPS.InfluxAdapter.Configuration.InfluxInstance
```

Sollwert und Default:

```text
influxdb.1
```

Die geschützte Quelle lautet:

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

Sie wird von der HistoryGraph-Verwaltung ausschließlich geprüft und niemals verändert.

## 6. HistoryGraph-Profile

### Profil A – Tages-/Langzeitwerte

- Instanz: `influxdb.0`
- `changesOnly = true`
- `blockTime = 0`
- `changesRelogInterval = 0`
- `changesMinDelta = 0`

Verwendet für Statistics-`Yesterday`, `Energy.History.*PerDay` und `Compressor.History.*PerDay`.

### Profil B – kontinuierliche Mess-/Sollwerte

- Instanz: `influxdb.1`
- `changesOnly = true`
- `blockTime = 0`
- `changesRelogInterval = 300`
- `changesMinDelta = 0`

Verwendet für `Outdoor`, `SupplyTarget`, `Supply`, `Return`, `Warmwater`, `WarmwaterCharging`. Das 300-s-Relog stellt bei konstanten Werten Stützpunkte für HistoryGraphs bereit.

### Profil C – dynamische Betriebswerte

- Instanz: `influxdb.1`
- `changesOnly = true`
- `blockTime = 60000`
- `changesRelogInterval = 0`

Verwendet für `DeltaT`, `Flow`, `Compressor.Frequency`.

### Profil D – Ereignis-/Zykluswerte

- Instanz: `influxdb.1`
- `changesOnly = true`
- `blockTime = 0`
- `changesRelogInterval = 0`

Verwendet für `Defrost.Active`, `Cycles.COP`, `Cycles.Duration`, `Cycles.Quality`.

Für alle Profile gilt: Nullwerte werden nicht pauschal ignoriert; bestehende aktive Konfigurationen werden nicht auf das Profil umgeschrieben.

## 7. Verwaltete Datenpunkte

### 7.1 Profil A / influxdb.0

```text
Statistics.AnteilVerdichter.Yesterday
Statistics.AnteilZusatzheizung.Yesterday
Statistics.COPGesamt.Yesterday
Statistics.COPHeizung.Yesterday
Statistics.COPWarmwasser.Yesterday
Energy.History.ElectricTotalPerDay
Energy.History.ElectricHeatingPerDay
Energy.History.ElectricWarmwaterPerDay
Energy.History.ElectricZHPerDay
Energy.History.HeatTotalPerDay
Energy.History.HeatHeatingPerDay
Energy.History.HeatWarmwaterPerDay
Energy.History.HeatZHPerDay
Compressor.History.StartsPerDay
Compressor.History.RuntimePerDay
```

### 7.2 Profil B / influxdb.1

```text
Temperatures.Outdoor
Temperatures.SupplyTarget
Temperatures.Supply
Temperatures.Return
Temperatures.Warmwater
Temperatures.WarmwaterCharging
```

### 7.3 Profil C / influxdb.1

```text
Temperatures.DeltaT
Temperatures.Flow
Compressor.Frequency
```

### 7.4 Profil D / influxdb.1

```text
Defrost.Active
Cycles.COP
Cycles.Duration
Cycles.Quality
```

Alle Pfade liegen unter `0_userdata.0.NPS.DashboardData.`.

## 8. SAFE_ADD_ONLY

Der Algorithmus ist nicht destruktiv:

| Ausgangslage | Verhalten |
|---|---|
| Zielinstanz aktiv | unverändert erhalten |
| Zielinstanz aktiv, Einstellungen abweichend | unverändert erhalten und diagnostizieren |
| andere Instanz aktiv | nichts hinzufügen; Konflikt melden |
| beide Instanzen aktiv | Doppelhistorie melden; nichts ändern |
| keine Instanz aktiv | als fehlend melden |
| keine Instanz aktiv + explizites Apply | Zielprofil ergänzen |
| State fehlt | fehlendes Objekt melden |

Beim Start wird ausschließlich `auditHistoryConfig(false)` ausgeführt. Automatisches Apply beim Start ist deaktiviert.

## 9. Commands und Diagnose-Public-API

```text
Command.Refresh
Command.AuditHistoryConfig
Command.ApplyHistoryConfig

HistoryConfig.Mode
HistoryConfig.ManagedCount
HistoryConfig.PreservedCount
HistoryConfig.MissingCount
HistoryConfig.ConflictCount
HistoryConfig.DuplicateCount
HistoryConfig.MissingObjectCount
HistoryConfig.AppliedCount
HistoryConfig.LastAudit
HistoryConfig.Status
HistoryConfig.ReportJson
```

`ApplyHistoryConfig` ist als Taster ausgeführt und wird nach der Verarbeitung wieder auf `false` gesetzt.

## 10. Audit-Status

Der Audit unterscheidet u. a.:

```text
PRESERVED_ACTIVE
PRESERVED_ACTIVE_DIFFERENT_SETTINGS
MISSING
APPLIED_MISSING
OTHER_INSTANCE_ACTIVE
DUPLICATE_ACTIVE
OBJECT_MISSING
PROTECTED_OK
PROTECTED_DUPLICATE_ACTIVE
PROTECTED_EXPECTED_INSTANCE_NOT_ACTIVE
```

Der zusammengefasste Status priorisiert Doppelhistorien und Konflikte vor fehlenden Konfigurationen.

## 11. CycleReport-Abfrageprinzip

Pro Refresh wird genau eine Historienabfrage für `CycleReportJson` ausgeführt. Danach erfolgen JSON-Parsing, Plausibilitätsprüfung, Filterung, Deduplizierung, Sortierung und Typtrennung lokal im Adapter.

Der InfluxAdapter berechnet insbesondere `ElectricKWh`, `HeatKWh`, `COP`, `Duration`, Temperaturen, Frequenzen und Qualitätskennzahlen nicht neu.

## 12. Refresh und Laufzeit

Der Adapter unterstützt Start-Refresh, `Command.Refresh` und automatischen Refresh nach einem neuen CycleReport. Das Skript ist als dauerhaft aktives NPS-Modul vorgesehen.

Die History-Konfiguration wird nicht zyklisch umgeschrieben. Ein Audit erfolgt beim Start oder explizit über `Command.AuditHistoryConfig`.

## 13. Fehler- und Konfliktbehandlung

Fehler einzelner CycleReports verhindern nicht die Verarbeitung gültiger Reports. History-Konflikte werden diagnostiziert, aber nicht destruktiv korrigiert. Eine Migration historischer Daten zwischen InfluxDB-Instanzen findet nicht statt.

## 14. Datenhoheit

```text
CycleAnalyzer = fachliche Quelle der CycleReports
DashboardData = Public API der Präsentationsschicht
InfluxDB = Zeitreihenpersistenz
InfluxAdapter = CycleReport-Historienadapter + sicherer History-Konfigurationswächter
```

Der InfluxAdapter bleibt Single Writer für `0_userdata.0.NPS.InfluxAdapter`.

## 15. Versionshistorie

```text
1.1.0-rc.1 | 2026-08-23
           | Sichere Verwaltung der Jarvis-HistoryGraph-Persistenz ergänzt.
           | 28 DashboardData-DPs mit Profil A–D definiert.
           | SAFE_ADD_ONLY eingeführt.
           | AuditHistoryConfig und ApplyHistoryConfig ergänzt.
           | Doppelhistorien werden erkannt, aber nicht automatisch verändert.
           | CycleReportJson/influxdb.1 bleibt geschützt.

1.0.4      | 2026-08-22
           | Architekturtrennung influxdb.0 / influxdb.1 dokumentiert.
           | influxdb.1 bleibt CycleReport-Quelle.
```

## 16. Verifikation 23.08.2026

Erster Audit vor Apply:

```text
28 verwaltet | 10 unverändert | 18 fehlend | 0 ergänzt |
0 Konflikte | 0 Doppelhistorien | 0 Objekte fehlen
```

Nach explizitem Apply und Neustart:

```text
28 verwaltet | 28 unverändert | 0 fehlend | 0 ergänzt |
0 Konflikte | 0 Doppelhistorien | 0 Objekte fehlen
```

Zusätzlich:

```text
30 CycleReport(s) mit einer Influx-Abfrage geladen
```

Damit sind bestehende CycleReport-Funktion, HistoryGraph-Zuordnung und Schutz vor Doppelhistorie praktisch bestätigt.

## 17. Abnahmekriterien RC.1

- Modulversion `1.1.0-rc.1`.
- CycleReport-Quelle bleibt `influxdb.1`.
- Pro Refresh genau eine CycleReport-History-Abfrage.
- 28 DashboardData-History-DPs werden verwaltet.
- Start führt nur Audit aus.
- Bestehende aktive Historien werden nicht verändert.
- Andere aktive Influx-Instanz wird nicht parallel ergänzt.
- Doppelhistorien werden erkannt.
- Fehlende Historie wird nur durch explizites Apply ergänzt.
- Profil B besitzt 300-s-Relog für konstante Mess-/Sollwerte.
- Nach Apply: 28/28 vorhanden, 0 Konflikte, 0 Doppelhistorien.
- CycleReports werden weiterhin erfolgreich geladen.

**Freigabestatus RC.1: FUNKTIONSPRÜFUNG PASS**

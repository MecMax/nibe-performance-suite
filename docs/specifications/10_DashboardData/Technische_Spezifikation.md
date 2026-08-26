# Technische Spezifikation – 10_NPS_DashboardData v5.11.0-rc.2

**NIBE Performance Suite (NPS) · Modul 10**
**Stand:** 26.08.2026
**Bezugsstand:** `10_NPS_DashboardData v5.11.0-rc.2`
**Strukturversion:** 35
**Status:** RC / Funktionsprüfung PASS

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `10_NPS_DashboardData` |
| Version | `5.11.0-rc.2` |
| Strukturversion | `35` |
| Schicht | Präsentationsschicht / Dashboard-Datenadapter |
| Root | `0_userdata.0.NPS.DashboardData` |
| Coding Standard | `NPS-CS-1.0` |
| Single Writer | ja |

DashboardData ist die zentrale, Jarvis-optimierte View-Model-Schicht der NPS.

## 2. Architekturregeln

1. Keine Veränderung fachlicher Quelldaten.
2. Single Writer für `0_userdata.0.NPS.DashboardData`.
3. Fehlende Quelldaten werden als ungültig/null behandelt und nicht automatisch als 0 interpretiert.
4. Gesamtstrom stammt ausschließlich aus ElectricalMeters.
5. Wärmemengen stammen ausschließlich aus VirtualMeters.
6. Stromaufteilung stammt aus EnergyAllocation.
7. Betriebsartenfarben und Bewertungsfarben bleiben getrennte Konzepte.
8. Fachliche Quellmodule bleiben Single Source of Truth; DashboardData formatiert und aggregiert für die Anzeige.
9. Heizungsanalyse, Heizkurvenbewertung, Raumkomfortanalyse und Evidence werden fachlich ausschließlich durch `15_NPS_HeatingCurveAnalyzer` erzeugt.
10. `HeatingOptimization` ist eine reine Präsentationsprojektion. DashboardData führt keine zweite fachliche Heizkurvenanalyse durch.

## 3. Hauptstruktur

```text
DashboardData
├── Overview
├── Performance
├── Temperatures
├── Compressor
├── Energy
├── Electrical
├── Cycles
├── Defrost
├── Events
├── HeatingOptimization
│   ├── Status
│   ├── Current
│   ├── Rooms
│   ├── Analysis
│   ├── Evidence
│   ├── DataQuality
│   ├── Configuration
│   └── Tables
├── Periods
├── Statistics
├── System
└── Help
```

## 4. Aktualisierungsmodell

- ereignisgesteuerte Aktualisierung bei Änderungen relevanter NPS-Quellen,
- `15_NPS_HeatingCurveAnalyzer` ist relevante Quelle für `HeatingOptimization`,
- vollständiger Watchdog-Refresh alle fünf Minuten,
- Zielaktualität der Livewerte unter einer Sekunde.

Ereignis-History wird nicht bei jedem Watchdoglauf erweitert, sondern nur bei einer neuen EventEngine-Sequenz.

## 5. Betriebsartenfarben

```text
Heizung     #C45A32
Warmwasser  #00A6A6
Standby     #78909C
Abtauen     #8E5BB7
Kühlen      #2196F3
Aus         #616161
Unbekannt   grey
```

`#C45A32` bleibt Statusfarbe für aktive Betriebsanzeigen und ist keine normale Messkurvenfarbe.

## 6. Bewertungsfarben

```text
lime
green
yellow
orange
red
grey
```

Health:

```text
>=98  lime
>=90  green
>=80  yellow
>=60  orange
<60   red
```

## 7. Overview

Overview aggregiert Betriebsart, Zykluszustand, StateMachine-Zustand, technische Alarm-/Bereitschaftsinformation und Health.

Wesentliche Ausgaben umfassen `Mode`, `ModeColor`, `ModeIcon`, `ActiveCycle`, `ActiveCycleType`, `State`, `Notice`, `AlarmNumber`, `AlarmActive`, `TechnicalState`, `Status`, Health-Daten und `LastUpdate`.

`HealthDetails` ist das technische Diagnose-JSON. `HealthTable` ist die Jarvis-optimierte Tabelle mit wirksamen Einzelabzügen.

## 8. Performance

Wesentliche Ausgaben:

```text
Performance.ThermalPower
Performance.LiveCOP
Performance.LiveCOPValid
Performance.PeriodComparisonJson
```

Der Periodenvergleich enthält COP gesamt, COP Heizung, COP Warmwasser, Verdichteranteil und Zusatzheizungsanteil. Alle öffentlichen COP-Ausgaben werden auf eine Nachkommastelle gerundet.

## 9. Energy

Quellenprinzip:

```text
Gesamtstrom     → ElectricalMeters
Wärmemengen     → VirtualMeters
Stromaufteilung → EnergyAllocation
```

`Energy.PeriodComparisonJson` enthält 14 Statistics-Zeiträume von Viertelstunde bis Jahr.

### 9.1 History

```text
Energy.History.ElectricTotalPerDay
Energy.History.ElectricHeatingPerDay
Energy.History.ElectricWarmwaterPerDay
Energy.History.ElectricZHPerDay
Energy.History.HeatTotalPerDay
Energy.History.HeatHeatingPerDay
Energy.History.HeatWarmwaterPerDay
Energy.History.HeatZHPerDay
```

Diese States enthalten abgeschlossene Tageswerte für HistoryGraphs.

## 10. Electrical

`Electrical.CurrentPower` stellt die aktuelle elektrische Leistung bereit. Gesamtstromwerte werden aus ElectricalMeters bezogen.

## 11. Compressor

Wesentliche Ausgaben umfassen `Active`, `Mode`, `Frequency`, `Runtime`, `Starts`, `StartsToday`, `RuntimeToday`, `AverageCycleDurationToday`, `AverageFrequencyToday`, `State`, `Status` und `QualityColor`.

`State` enthält den fachlichen Klartextzustand der StateMachine. `Status` enthält den technischen CompressorMonitor-Rohstatus.

### 11.1 Compressor History

```text
Compressor.History.StartsPerDay
Compressor.History.RuntimePerDay
```

sind abgeschlossene Tageswerte.

## 12. Cycles

Wesentliche Ausgaben:

```text
Cycles.Active
Cycles.CurrentDuration
Cycles.Duration
Cycles.Type
Cycles.COP
Cycles.ElectricEnergy
Cycles.HeatEnergy
Cycles.Quality
Cycles.History
```

Verbindliche Semantik:

```text
Cycles.Active = false
→ Cycles.CurrentDuration = 0
```

`Cycles.History` enthält maximal 20 abgeschlossene Zyklen.

## 13. Temperatures

Wesentliche Ausgaben sind `Outdoor`, `Supply`, `SupplyTarget`, `SupplyDeviation`, `Return`, `Spread`, `MeanHeatingWater`, `TemperatureLift`, `Flow`, `Warmwater`, `WarmwaterCharging` und `QualityColor`.

```text
SupplyDeviation = Supply - SupplyTarget
Spread = Supply - Return
MeanHeatingWater = (Supply + Return) / 2
TemperatureLift = Supply - Outdoor
```

## 14. Defrost

Wesentliche Public API:

```text
Defrost.Active
Defrost.Duration
Defrost.Count
Defrost.LastDuration
Defrost.LastStart
Defrost.QualityColor
```

## 15. Events

`Events.History` enthält maximal 50 Ereignisse. Verarbeitung erfolgt nur bei neuer EventEngine-Sequenz. Watchdog- oder Fremdtrigger dürfen keine Duplikate erzeugen.

## 16. HeatingOptimization

### 16.1 Verantwortung und Quelle

`DashboardData.HeatingOptimization` ist die Präsentationsschnittstelle für `15_NPS_HeatingCurveAnalyzer`.

Die fachlichen Daten stammen aus:

```text
0_userdata.0.NPS.HeatingOptimization.*
```

DashboardData liest diese Daten, normalisiert die Darstellung und veröffentlicht sie unter:

```text
0_userdata.0.NPS.DashboardData.HeatingOptimization.*
```

Es erfolgt keine Rückschreibung in Modul 15 und keine zweite fachliche Bewertung.

### 16.2 Status

```text
HeatingOptimization.Status.Active
HeatingOptimization.Status.Valid
HeatingOptimization.Status.DataQualityPercent
HeatingOptimization.Status.DataQualityState
HeatingOptimization.Status.AnalysisReady
HeatingOptimization.Status.LastUpdate
HeatingOptimization.Status.SourceTimestamp
```

### 16.3 Current

```text
HeatingOptimization.Current.OperatingPriority
HeatingOptimization.Current.OperatingModeText
HeatingOptimization.Current.OutdoorTemperature
HeatingOptimization.Current.FlowTarget
HeatingOptimization.Current.FlowActual
HeatingOptimization.Current.SupplyDeviation
HeatingOptimization.Current.ReturnTemperature
HeatingOptimization.Current.DeltaT
HeatingOptimization.Current.DegreeMinutes
HeatingOptimization.Current.CompressorActive
HeatingOptimization.Current.CompressorFrequency
HeatingOptimization.Current.VolumeFlow
HeatingOptimization.Current.AdditionalHeatActive
HeatingOptimization.Current.DefrostActive
HeatingOptimization.Current.SampleValid
HeatingOptimization.Current.SampleQuality
```

### 16.4 Rooms

```text
HeatingOptimization.Rooms.Count
HeatingOptimization.Rooms.ActiveCount
HeatingOptimization.Rooms.DataValidCount
HeatingOptimization.Rooms.ValidForHeatingCurveCount
HeatingOptimization.Rooms.TooColdCount
HeatingOptimization.Rooms.OKCount
HeatingOptimization.Rooms.TooWarmCount
HeatingOptimization.Rooms.AverageDeviation
HeatingOptimization.Rooms.MedianDeviation
HeatingOptimization.Rooms.DeviationStdDev
HeatingOptimization.Rooms.DeviationRange
HeatingOptimization.Rooms.ColdestRoom
HeatingOptimization.Rooms.ColdestRoomDeviation
HeatingOptimization.Rooms.WarmestRoom
HeatingOptimization.Rooms.WarmestRoomDeviation
```

### 16.5 72-h-Hauptanalyse

Verbindliche Präsentationsschnittstelle:

```text
HeatingOptimization.Analysis.Valid
HeatingOptimization.Analysis.ValidHeatingHours
HeatingOptimization.Analysis.DataQualityPercent
HeatingOptimization.Analysis.AvgOutdoorTemperature
HeatingOptimization.Analysis.AvgFlowTarget
HeatingOptimization.Analysis.AvgFlowActual
HeatingOptimization.Analysis.AvgFlowDeviation
HeatingOptimization.Analysis.AvgRoomDeviation
HeatingOptimization.Analysis.MedianRoomDeviation
HeatingOptimization.Analysis.TooColdRatio
HeatingOptimization.Analysis.OKRatio
HeatingOptimization.Analysis.TooWarmRatio
HeatingOptimization.Analysis.CompressorRuntimePercent
HeatingOptimization.Analysis.AdditionalHeatRuntimePercent
```

Die fachliche Gültigkeitslogik verbleibt vollständig in Modul 15.

### 16.6 Evidence

```text
HeatingOptimization.Evidence.GlobalTemperatureState
HeatingOptimization.Evidence.FlowTrackingState
HeatingOptimization.Evidence.OutdoorDependenceState
HeatingOptimization.Evidence.RoomImbalance
HeatingOptimization.Evidence.AdditionalHeatInfluence
HeatingOptimization.Evidence.SensorMismatch
HeatingOptimization.Evidence.InsufficientData
```

DashboardData projiziert die fachlichen Evidence-Ergebnisse in eine Jarvis-taugliche Schnittstelle.

### 16.7 DataQuality

```text
HeatingOptimization.DataQuality.SourceCheckOk
HeatingOptimization.DataQuality.RequiredTotal
HeatingOptimization.DataQuality.RequiredOk
HeatingOptimization.DataQuality.RequiredMissing
HeatingOptimization.DataQuality.OptionalTotal
HeatingOptimization.DataQuality.OptionalOk
HeatingOptimization.DataQuality.OptionalMissing
HeatingOptimization.DataQuality.RoomSourcesConfigured
HeatingOptimization.DataQuality.RoomSourcesValid
HeatingOptimization.DataQuality.Percent
HeatingOptimization.DataQuality.State
HeatingOptimization.DataQuality.SampleQuality
HeatingOptimization.DataQuality.SampleValid
HeatingOptimization.DataQuality.ValidHeatingHours
HeatingOptimization.DataQuality.AnalysisReady
```

### 16.8 Configuration

```text
HeatingOptimization.Configuration.HeatingCurve
HeatingOptimization.Configuration.HeatingCurveOffset
HeatingOptimization.Configuration.FlowMin
HeatingOptimization.Configuration.FlowMax
HeatingOptimization.Configuration.HeatingStartUndertemp
HeatingOptimization.Configuration.HeatingStopTemperature
HeatingOptimization.Configuration.AdditionalHeatStopTemperature
HeatingOptimization.Configuration.AutoFilterTime
HeatingOptimization.Configuration.MaxFlowDifferenceCompressor
HeatingOptimization.Configuration.OperatingMode
HeatingOptimization.Configuration.OperatingModeText
HeatingOptimization.Configuration.HeatingAutomatic
HeatingOptimization.Configuration.ChangedAt
HeatingOptimization.Configuration.CustomCurveP1 … CustomCurveP7
HeatingOptimization.Configuration.PointOutdoorTemperature
HeatingOptimization.Configuration.PointOffset
```

Die Konfigurationswerte sind ausschließlich lesende Präsentationsdaten.

### 16.9 Tables

```text
HeatingOptimization.Tables.RoomsJson
HeatingOptimization.Tables.AnalysisWindowsJson
HeatingOptimization.Tables.EvidenceJson
HeatingOptimization.Tables.DataQualityJson
```

Die JSON-States dienen ausschließlich der Darstellung in Jarvis.

### 16.10 Sommerbetrieb / InsufficientData

Eine nicht bereite Analyse ist ein zulässiger fachlicher Zustand. Insbesondere außerhalb einer geeigneten Heizperiode können `ValidHeatingHours=0`, `ValidForHeatingCurveCount=0`, `AnalysisReady=false` und `InsufficientData=true` korrekt sein.

## 17. System

Wesentliche Ausgaben:

```text
Version
StructureVersion
SourceVersion
Status
DataValid
ErrorCounter
UpdateCounter
HealthPercent
HealthState
HealthColor
HealthMessage
TechnicalState
TechnicalStateCode
TechnicalMessage
LastUpdate
Ruecksprung
```

## 18. Help

Die zentrale Bedienhilfe umfasst zusätzlich:

```text
Help.HeatingOptimization
```

Die Detailhilfe „Heizungsanalyse“ beschreibt Zweck, Datenqualität, Raumkomfort, 72-h-Analyse, Evidence, Konfiguration und die Semantik bei unzureichender Datenbasis.

## 19. Statistics-Nutzung

DashboardData liest `statistics.0.save.sumDelta` an dafür vorgesehenen fachlichen Quellzählern.

`HeatingOptimization.*` wird auf DashboardData-Ebene nicht mit `statistics.0` akkumuliert.

## 20. Influx-Nutzung

Eine pauschale Historisierung der DashboardData-Public-API ist nicht vorgesehen.

Bewusst erzeugte fertige Tageswerte für Compressor- und Energy-HistoryGraphs werden über `influxdb.0` historisiert.

`DashboardData.HeatingOptimization.*` wird nicht pauschal über `influxdb.0` historisiert. Langzeitdaten für Heizkurvenanalysen sind fachlich in Modul 15 bzw. ausdrücklich dafür vorgesehenen History-States zu definieren.

Details siehe `Persistenz_Spezifikation.md`.

## 21. Funktionale Abnahme 22.08.2026

Die bisherige funktionale Konsolidierung von Overview, Performance, Energy, Compressor, Cycles, Temperatures, Defrost, Events und System bleibt als geprüfter Zwischenstand bestehen.

## 22. Funktionale Abnahme HeatingOptimization v5.11.0-rc.2

Geprüfter Sollumfang:

- öffentliche `DashboardData.HeatingOptimization`-Struktur vorhanden,
- Quelle ist `15_NPS_HeatingCurveAnalyzer`,
- keine zweite fachliche Berechnung in DashboardData,
- Statusprojektion vorhanden,
- Current-Projektion vorhanden,
- Raumprojektion vorhanden,
- 72-h-Hauptanalyse vorhanden,
- Evidence-Projektion vorhanden,
- Datenqualitätsprojektion vorhanden,
- Konfigurationsprojektion vorhanden,
- vier Jarvis-Tabellen vorhanden,
- `Help.HeatingOptimization` vorhanden,
- unzureichende Datenbasis/Sommerbetrieb wird als zulässiger fachlicher Zustand behandelt.

## 23. Abnahmekriterien

- `System.Version = 5.11.0-rc.2`.
- `System.StructureVersion = 35`.
- `System.DataValid = true` bei gültigen Quellen.
- Alle Hauptbereiche werden konsistent aktualisiert.
- Gesamtstrom stammt aus ElectricalMeters.
- Wärmemengen stammen aus VirtualMeters.
- Stromaufteilung stammt aus EnergyAllocation.
- öffentliche COP-Werte haben eine Nachkommastelle.
- Event-History erzeugt keine Watchdog-Duplikate.
- abgeschlossene Tageswerte sind für HistoryGraphs verfügbar.
- bei inaktivem Zyklus ist `CurrentDuration=0`.
- `HeatingOptimization` wird aus Modul 15 projiziert.
- die 72-h-Hauptanalyse wird vollständig bereitgestellt.
- Evidence wird vollständig bereitgestellt.
- DashboardData führt keine eigene Heizkurvenbewertung durch.
- `HeatingOptimization` wird nicht redundant historisiert.
- Help enthält die Detailhilfe Heizungsanalyse.

**Freigabestatus: RC / Funktionsprüfung PASS**

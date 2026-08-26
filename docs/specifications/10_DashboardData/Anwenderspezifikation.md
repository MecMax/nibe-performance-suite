# Anwenderspezifikation – 10_NPS_DashboardData v5.11.0-rc.2

**NIBE Performance Suite (NPS) · Modul 10**
**Stand:** 26.08.2026
**Bezugsstand:** `10_NPS_DashboardData v5.11.0-rc.2`
**Strukturversion:** 35
**Status:** RC / Funktionsprüfung PASS

## 1. Zweck

DashboardData ist die zentrale Präsentations- und View-Model-Schicht der NIBE Performance Suite. Das Modul sammelt bereits fachlich aufbereitete Werte aus den NPS-Modulen, vereinheitlicht Darstellung, Einheiten, Rundung, Farben, Tabellen und Hilfetexte und stellt eine stabile Schnittstelle für Jarvis bereit.

DashboardData verändert keine fachlichen Quelldaten und führt keine zweite fachliche Berechnung durch, wenn die entsprechende Bewertung bereits durch ein spezialisiertes NPS-Modul erfolgt.

## 2. Hauptbereiche

Die Public API umfasst insbesondere:

```text
Overview
Performance
Temperatures
Compressor
Energy
Electrical
Cycles
Defrost
Events
HeatingOptimization
System
Help
```

Zusätzlich existieren interne bzw. ergänzende Perioden- und Statistikbereiche.

Der Bereich `HeatingOptimization` stellt seit v5.11.0 die Präsentationsschnittstelle für `15_NPS_HeatingCurveAnalyzer` bereit.

## 3. Datenquellen

Grundregeln:

- Gesamtstrom ausschließlich aus `ElectricalMeters`.
- Wärmemengen ausschließlich aus `VirtualMeters`.
- Stromaufteilung Heizung/Warmwasser aus `EnergyAllocation`.
- Temperaturen aus TemperatureMonitor bzw. den vorgesehenen NIBE-Temperaturquellen.
- Verdichterdaten aus CompressorMonitor und StateMachine.
- Zyklusdaten aus CycleAnalyzer/StateMachine.
- Ereignisse aus EventEngine.
- Abtaudaten aus DefrostMonitor.
- Heizungsanalyse, Heizkurvenbewertung, Raumkomfortanalyse, Evidence und Datenqualität aus `15_NPS_HeatingCurveAnalyzer`.

DashboardData ist keine zweite Berechnungsquelle für Messwerte oder Bewertungen, die bereits fachlich in einem Quellmodul vorliegen.

Insbesondere führt DashboardData keine eigene Heizkurvenanalyse durch. Die fachliche Bewertung erfolgt ausschließlich in `15_NPS_HeatingCurveAnalyzer`.

## 4. Overview

`Overview` fasst den Anlagenzustand zusammen. Dazu gehören Betriebsart, aktiver Zyklus, fachlicher Zustand, Alarmstatus, technischer Zustand sowie Health-Bewertung.

Die Health-Bewertung stellt sowohl eine technische Detaildarstellung (`HealthDetails`) als auch eine Jarvis-optimierte Tabelle (`HealthTable`) bereit.

Health-Farben:

```text
>= 98 %  lime
>= 90 %  green
>= 80 %  yellow
>= 60 %  orange
<  60 %  red
```

## 5. Performance

Der Bereich stellt insbesondere bereit:

- aktuelle Wärmeleistung,
- Live-COP,
- Gültigkeit des Live-COP,
- Periodenvergleich für COP gesamt, Heizung und Warmwasser,
- Verdichter- und Zusatzheizungsanteil.

Öffentliche COP-Werte werden mit einer Nachkommastelle dargestellt.

Ein `LiveCOP` von 0 bei `LiveCOPValid=false` bedeutet nicht COP 0 im fachlichen Sinn, sondern aktuell keine gültige Live-COP-Berechnung.

## 6. Energy

Energy stellt Strom- und Wärmemengen sowie COP- und Anteilswerte bereit.

Der Periodenvergleich umfasst 14 Zeiträume von Viertelstunde bis Jahr.

Zusätzlich stehen abgeschlossene Tageswerte für HistoryGraphs zur Verfügung.

Die oberen kumulativen Energieanzeigen und die Statistics-Perioden können unterschiedliche Erfassungsstartpunkte besitzen und müssen deshalb nicht identische Jahreswerte zeigen.

## 7. Compressor

Der Verdichterbereich enthält unter anderem:

- aktiv/inaktiv,
- Betriebsart,
- Frequenz,
- kumulative Laufzeit und Starts,
- Starts und Laufzeit heute,
- mittlere Zyklusdauer heute,
- mittlere Frequenz heute,
- fachlichen StateMachine-Zustand,
- technischen CompressorMonitor-Status,
- abgeschlossene Tageswerte für HistoryGraphs.

## 8. Cycles

Der Zyklusbereich zeigt den aktuellen und den letzten abgeschlossenen Zyklus.

```text
Cycles.Active = false
→ Cycles.CurrentDuration = 0 min
```

`CurrentDuration` beschreibt ausschließlich einen aktuell laufenden Verdichtertakt. `Duration`, `COP`, Energie, Qualität und Typ können dagegen Daten des letzten abgeschlossenen Zyklus enthalten.

`Cycles.History` enthält maximal 20 abgeschlossene Zyklen.

## 9. Temperatures

Bereitgestellt werden insbesondere Außentemperatur, Vorlauf IST/SOLL, Vorlaufabweichung, Rücklauf, Spreizung, mittlere Heizwassertemperatur, Temperaturhub, Volumenstrom sowie Warmwasser BT7/BT6.

```text
SupplyDeviation = Supply - SupplyTarget
```

## 10. Defrost

Der Bereich enthält insbesondere `Active`, `Duration`, `Count`, `LastDuration`, `LastStart` und `QualityColor`.

Weitere Detailwerte können weiterhin direkt aus der Public API des DefrostMonitor stammen, wenn DashboardData dafür kein Pendant besitzt.

## 11. Events

DashboardData übernimmt neue EventEngine-Ereignisse sequenzgesteuert. `Events.History` enthält maximal 50 Ereignisse. Zusätzlich existieren Tageszähler für Heizzyklen, Warmwasserzyklen, Abtauungen, Warnungen und Fehler.

Watchdog-Refreshes erzeugen keine Ereignisduplikate.

## 12. HeatingOptimization / Heizungsanalyse

`HeatingOptimization` ist die Jarvis-optimierte Präsentationsschnittstelle für `15_NPS_HeatingCurveAnalyzer`.

Ziel ist die übersichtliche Darstellung der Informationen, mit denen beurteilt werden kann, ob Heizkurve, Vorlauf-Sollwert und Raumkomfort zur aktuellen Gebäude- und Witterungssituation passen.

Die fachliche Analyse erfolgt ausschließlich in Modul 15. DashboardData liest, strukturiert, formatiert und präsentiert dessen Ergebnisse.

```text
HeatingOptimization.Status
HeatingOptimization.Current
HeatingOptimization.Rooms
HeatingOptimization.Analysis
HeatingOptimization.Evidence
HeatingOptimization.DataQuality
HeatingOptimization.Configuration
HeatingOptimization.Tables
```

### 12.1 Status

Insbesondere:

```text
Active
Valid
DataQualityPercent
DataQualityState
AnalysisReady
LastUpdate
SourceTimestamp
```

### 12.2 Current

Insbesondere:

```text
OperatingPriority
OperatingModeText
OutdoorTemperature
FlowTarget
FlowActual
SupplyDeviation
ReturnTemperature
DeltaT
DegreeMinutes
CompressorActive
CompressorFrequency
VolumeFlow
AdditionalHeatActive
DefrostActive
SampleValid
SampleQuality
```

### 12.3 Rooms

Insbesondere:

```text
Count
ActiveCount
DataValidCount
ValidForHeatingCurveCount
TooColdCount
OKCount
TooWarmCount
AverageDeviation
MedianDeviation
DeviationStdDev
DeviationRange
ColdestRoom
ColdestRoomDeviation
WarmestRoom
WarmestRoomDeviation
```

### 12.4 72-h-Hauptanalyse

```text
Valid
ValidHeatingHours
DataQualityPercent
AvgOutdoorTemperature
AvgFlowTarget
AvgFlowActual
AvgFlowDeviation
AvgRoomDeviation
MedianRoomDeviation
TooColdRatio
OKRatio
TooWarmRatio
CompressorRuntimePercent
AdditionalHeatRuntimePercent
```

Eine ungültige oder noch nicht bereite Analyse bedeutet nicht automatisch einen Anlagenfehler.

### 12.5 Evidence / Analysehinweise

```text
GlobalTemperatureState
FlowTrackingState
OutdoorDependenceState
RoomImbalance
AdditionalHeatInfluence
SensorMismatch
InsufficientData
```

DashboardData erzeugt diese fachlichen Aussagen nicht selbst.

### 12.6 Datenqualität

Insbesondere:

```text
SourceCheckOk
RequiredTotal
RequiredOk
RequiredMissing
OptionalTotal
OptionalOk
OptionalMissing
RoomSourcesConfigured
RoomSourcesValid
Percent
State
SampleQuality
SampleValid
ValidHeatingHours
AnalysisReady
```

### 12.7 Konfiguration

Insbesondere:

```text
HeatingCurve
HeatingCurveOffset
FlowMin
FlowMax
HeatingStartUndertemp
HeatingStopTemperature
AdditionalHeatStopTemperature
AutoFilterTime
MaxFlowDifferenceCompressor
OperatingMode
OperatingModeText
HeatingAutomatic
ChangedAt
CustomCurveP1 … CustomCurveP7
PointOutdoorTemperature
PointOffset
```

DashboardData verändert diese Konfiguration nicht.

### 12.8 Tabellen

```text
HeatingOptimization.Tables.RoomsJson
HeatingOptimization.Tables.AnalysisWindowsJson
HeatingOptimization.Tables.EvidenceJson
HeatingOptimization.Tables.DataQualityJson
```

Diese JSON-States sind Präsentationsdaten und keine eigenständigen fachlichen Datenquellen.

### 12.9 Sommerbetrieb und unzureichende Datenbasis

Wenn keine geeignete Heizperiode aktiv ist, können beispielsweise 0 gültige Heizstunden, 0 für die Heizkurve verwertbare Räume, `InsufficientData=true` und `AnalysisReady=false` vollständig korrekt sein.

Dies ist insbesondere im Sommerbetrieb kein Fehler, sondern beschreibt eine aktuell nicht ausreichende Datenbasis für eine belastbare Heizkurvenbewertung.

## 13. System

Der Systembereich enthält unter anderem `Version`, `StructureVersion`, `SourceVersion`, `Status`, `DataValid`, `ErrorCounter`, `UpdateCounter`, Health- und Technical-State-Daten, `LastUpdate` und `Ruecksprung`.

`Ruecksprung` ist ein statischer Navigationsdatenpunkt für Jarvis.

## 14. Bedienhilfe

DashboardData enthält eine zentrale Bedienhilfe für Allgemein, System, Performance, Energy, Compressor, Temperatures, Cycles, Events, Defrost und HeatingOptimization sowie ein Manifest.

Für die Heizungsanalyse steht `Help.HeatingOptimization` bereit.

## 15. Aktualisierung

DashboardData aktualisiert Livewerte ereignisgesteuert bei Änderungen relevanter Quellen, einschließlich `15_NPS_HeatingCurveAnalyzer`. Zusätzlich erfolgt ein vollständiger Watchdog-Refresh alle fünf Minuten.

## 16. Persistenz

DashboardData ist grundsätzlich eine Präsentationsschicht. Nur ausgewählte fertige Tageswerte für HistoryGraphs werden in `influxdb.0` historisiert.

`HeatingOptimization.*` ist eine Präsentationsprojektion von Modul 15 und wird weder pauschal über `influxdb.0` historisiert noch mit `statistics.0` akkumuliert.

Details siehe `Persistenz_Spezifikation.md`.

## 17. Funktionale Freigabe

### 17.1 Konsolidierungsstand 22.08.2026

Die Bereiche Overview, Performance, Energy, Compressor, Cycles, Temperatures, Defrost, Events und System wurden funktional geprüft und mit **PASS** bewertet. Für DashboardData selbst war in dieser Konsolidierungsrunde keine Codeänderung erforderlich.

### 17.2 Erweiterung HeatingOptimization v5.11.0-rc.2

Umgesetzt sind:

- öffentliche `HeatingOptimization`-Struktur,
- Statusprojektion,
- aktueller Anlagenzustand,
- Raumkomfortprojektion,
- 72-h-Hauptanalyse,
- Evidence-/Analysehinweise,
- Datenqualitäts- und Quellenprüfung,
- relevante Heizungs-/Heizkurvenkonfiguration,
- Jarvis-Tabellen,
- Bedienhilfe `Help.HeatingOptimization`.

DashboardData bleibt reine Präsentationsschicht. Die fachliche Heizungs- und Heizkurvenanalyse verbleibt vollständig in Modul 15.

**Freigabestatus: RC / Funktionsprüfung PASS**

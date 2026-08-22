# Technische Spezifikation – 14_NPS_PerformanceAnalyzer v1.0.1

**NIBE Performance Suite (NPS) · Modul 14**  
**Bezugsstand:** `14_NPS_PerformanceAnalyzer v1.0.1`  
**Build:** 20.07.2026  
**Status:** STABIL

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `14_NPS_PerformanceAnalyzer` |
| Version | `1.0.1` |
| Root | `0_userdata.0.NPS.PerformanceAnalyzer` |
| Schicht | Mehrzyklus- und Performanceanalyse |
| Primärquelle | `InfluxAdapter.History.AllCyclesJson` |
| Direkter Influx-Zugriff | nein |
| Single Writer | ja |

## 2. Architekturvertrag

```text
13_NPS_CycleAnalyzer
        ↓
History.CycleReportJson
        ↓
influxdb.1
        ↓
11_NPS_InfluxAdapter
        ↓
History.AllCyclesJson
        ↓
14_NPS_PerformanceAnalyzer
```

Der PerformanceAnalyzer übernimmt nur bereits vollständige CycleReports.

Historienzugriff und Deduplizierung gehören zum InfluxAdapter. Einzelzyklusanalyse gehört zum CycleAnalyzer.

## 3. Eingang

```text
0_userdata.0.NPS.InfluxAdapter.History.AllCyclesJson
```

Das Eingangsdokument muss ein JSON-Array sein.

Eine leere Historie ist ein gültiger Zustand.

## 4. Konfiguration

```text
Configuration.Enabled
Configuration.AnalyzeOnStartup
Configuration.AnalyzeOnHistoryChange
Configuration.IncludeInvalidCycles
Configuration.Debug
```

Defaults:

```text
Enabled                true
AnalyzeOnStartup       true
AnalyzeOnHistoryChange true
IncludeInvalidCycles   false
Debug                  false
```

Manueller Trigger:

```text
Command.Analyze
```

## 5. Typcodes

```text
HEATING   = 1
WARMWATER = 2
DEFROST   = 3
```

Zusätzlich werden Textvarianten wie HEIZUNG/HEIZEN, WARMWASSER/BRAUCHWASSER und ABTAUUNG erkannt.

Unbekannte Typen erhalten Typcode 0.

## 6. Gültigkeitsfilter

Die fachliche Gültigkeit wird aus:

```text
analysis.valid
Analysis.Valid
valid
```

ermittelt.

Fehlt das Feld oder ist es nicht eindeutig interpretierbar, wird der Report als gültig behandelt.

Bei:

```text
IncludeInvalidCycles = false
```

werden Reports mit explizitem `analysis.valid=false` nicht in die Statistik aufgenommen.

## 7. Metrik-Fallbackpfade

Das Modul unterstützt definierte alternative Feldpfade für unterschiedliche Schreibweisen des CycleReport-Vertrags.

Ausgewertet werden:

```text
durationSeconds
electricalKWh
thermalKWh
cop
electricAverageW
heatAverageKW
compressorFrequencyHz
outdoorTemperatureC
compressorRuntimeSeconds
compressorStarts
defrostCount
qualityScore
```

Damit können kompatible ältere bzw. alternative Groß-/Kleinschreibweisen teilweise verarbeitet werden.

## 8. Deskriptive Statistik

`describe(values)` liefert:

```text
count
average
median
minimum
maximum
sum
variance
standardDeviation
range
percentiles.p10
percentiles.p25
percentiles.p50
percentiles.p75
percentiles.p90
```

Die Varianz wird mit:

```text
Σ(x - Mittelwert)² / n
```

berechnet.

Die Standardabweichung ist damit eine Populationsstandardabweichung.

## 9. Fehlende Werte

Fehlende Kennzahlen werden je Metrik gezählt:

```text
missingValueCount
missingByMetric
```

Sie werden nicht als 0 in die Statistik aufgenommen.

## 10. Gruppenstatistiken

Für folgende Gruppen wird jeweils ein vollständiges Statistikobjekt erzeugt:

```text
overall
heating
warmwater
defrost
```

Jedes Objekt enthält:

- Schema-Version,
- Erstellungszeit,
- Typ,
- Zyklusanzahl,
- ältesten und neuesten Zeitstempel,
- Fehlwertzähler,
- Metrikstatistiken,
- Verteilungen.

## 11. Histogramme

Vordefinierte Klassen existieren für:

### COP
```text
<2 | 2-3 | 3-4 | 4-5 | >=5
```

### Zyklusdauer
```text
<15 | 15-30 | 30-60 | 60-120 | >=120 min
```

### Verdichterfrequenz
```text
<30 | 30-45 | 45-60 | 60-75 | >=75 Hz
```

### Außentemperatur
```text
<-10 | -10--5 | -5-0 | 0-5 | 5-10 | 10-15 | >=15 °C
```

### elektrische Leistung
```text
<0,5 | 0,5-1 | 1-1,5 | 1,5-2 | >=2 kW
```

### Wärmeleistung
```text
<2 | 2-4 | 4-6 | 6-8 | >=8 kW
```

### Qualität
```text
<50 | 50-70 | 70-85 | 85-95 | 95-100 %
```

## 12. Betriebsanteile

`OperatingSharesJson` enthält für Heizung, Warmwasser und Abtauung:

```text
cycleCount
cycleSharePercent
runtimeMinutes
runtimeSharePercent
electricalEnergyKWh
electricalEnergySharePercent
thermalEnergyKWh
thermalEnergySharePercent
compressorStarts
compressorStartSharePercent
averageCOP
averageDurationMinutes
averageOutdoorTemperatureC
```

Die Bezugsgröße ist jeweils die Gesamtstatistik.

Bei einem Gesamtwert von 0 wird der Anteil mit 0 ausgegeben.

## 13. DashboardJson

`Statistics.DashboardJson` enthält:

```text
summary
operatingShares
distributions
statistics
```

Die Summary enthält die wichtigsten Mehrzyklus-Kennzahlen in kompakter Form.

Der State gehört zum Namensraum des PerformanceAnalyzer und verletzt daher nicht das Single-Writer-Prinzip von `10_NPS_DashboardData`.

## 14. Public API

### Command
```text
Command.Analyze
```

### Configuration
```text
Enabled
AnalyzeOnStartup
AnalyzeOnHistoryChange
IncludeInvalidCycles
Debug
```

### Input
```text
Input.SourceId
```

### Result
```text
CycleCount
HeatingCycleCount
WarmwaterCycleCount
DefrostCycleCount
AverageDurationMinutes
AverageElectricalEnergyKWh
AverageThermalEnergyKWh
AverageCOP
AverageCompressorFrequencyHz
AverageOutdoorTemperatureC
MedianCOP
COPStandardDeviation
AverageQualityScore
TotalElectricalEnergyKWh
TotalThermalEnergyKWh
OldestTimestamp
NewestTimestamp
```

### Statistics
```text
OverallJson
HeatingJson
WarmwaterJson
DefrostJson
DistributionsJson
OperatingSharesJson
DashboardJson
```

### Diagnostics
```text
InputCycleCount
ValidCycleCount
InvalidCycleCount
MissingValueCount
LastDurationMs
Warning
Trace
```

### System
```text
Version
Active
Status
LastStart
LastAnalysis
LastMessage
```

## 15. Trigger und Parallelität

Analyseauslöser:

```text
Skriptstart
History.AllCyclesJson change
Command.Analyze
```

Falls bereits eine Analyse läuft, wird keine zweite parallel gestartet. Stattdessen wird genau ein weiterer Lauf vorgemerkt und anschließend seriell ausgeführt.

## 16. Diagnose

Der Trace dokumentiert unter anderem:

```text
Source
Input
Included
Valid
Invalid
Heating
Warmwater
Defrost
MissingValues
DurationMs
Oldest
Newest
```

Unbekannte Zyklustypen können in die Gesamtstatistik eingehen, erscheinen jedoch in keiner typgetrennten Gruppe und sollen über `Diagnostics.Warning` kenntlich gemacht werden.

## 17. Persistenz

Der PerformanceAnalyzer greift nicht auf InfluxDB zu und schreibt selbst keine Historie.

Seine Mehrzyklus-Ergebnisse sind reproduzierbare Ableitungen aus:

```text
InfluxAdapter.History.AllCyclesJson
```

Die dauerhafte Rohbasis bleibt die CycleReport-Historie in `influxdb.1`.

## 18. Architekturgrenzen

Unzulässig innerhalb dieses Moduls sind:

- direkte InfluxDB-Abfragen,
- Deduplizierung der historischen Rohquelle als Ersatz für den InfluxAdapter,
- Rekonstruktion fehlender Einzelzyklen,
- erneute fachliche Einzelzyklusbewertung,
- Anlagensteuerung,
- Schreiben in fremde NPS-Namensräume.

## 19. Änderung v1.0.1

```text
1.0.1 | 20.07.2026
      | Header auf NPS-CS-1.0 erweitert.
      | MODULE.VERSION auf 1.0.1 gesetzt.
      | Eingänge, Public API, Trigger, Abhängigkeiten
      | und Modulgrenzen dokumentiert.
      | Keine fachliche Änderung an Statistik,
      | Verteilungen, Betriebsanteilen oder Triggerlogik.
```

## 20. Abnahmekriterien

- Version `1.0.1`.
- Quelle ausschließlich `InfluxAdapter.History.AllCyclesJson`.
- kein direkter InfluxDB-Zugriff.
- leeres Eingangsarray ist zulässig.
- ungültige Zyklen werden standardmäßig ausgeschlossen.
- Typtrennung Heizung/Warmwasser/Abtauung funktioniert.
- fehlende Kennwerte werden gezählt und nicht genullt.
- deskriptive Statistik und Perzentile werden erzeugt.
- Histogramme werden erzeugt.
- Betriebsanteile werden erzeugt.
- DashboardJson wird erzeugt.
- überlappende Analysen laufen nicht parallel.
- ausschließlich eigener Namensraum wird beschrieben.

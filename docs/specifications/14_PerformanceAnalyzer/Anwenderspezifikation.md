# Anwenderspezifikation – 14_NPS_PerformanceAnalyzer v1.0.1

**NIBE Performance Suite (NPS) · Modul 14**  
**Bezugsstand:** `14_NPS_PerformanceAnalyzer v1.0.1`  
**Build:** 20.07.2026  
**Status:** STABIL

## 1. Zweck

Der PerformanceAnalyzer wertet viele bereits abgeschlossene und vom CycleAnalyzer analysierte Wärmepumpenzyklen gemeinsam aus.

Er erzeugt Mehrzyklus-Kennzahlen, typgetrennte Statistiken, Verteilungen und Betriebsanteile. Die Einzelzyklusanalyse verbleibt beim CycleAnalyzer.

## 2. Datenkette

```text
13 CycleAnalyzer
      ↓
History.CycleReportJson
      ↓
influxdb.1
      ↓
11 InfluxAdapter
      ↓
History.AllCyclesJson
      ↓
14 PerformanceAnalyzer
```

Der PerformanceAnalyzer greift selbst nicht auf InfluxDB zu.

## 3. Quelle

Einzige Historienquelle:

```text
0_userdata.0.NPS.InfluxAdapter.History.AllCyclesJson
```

Die dort enthaltenen CycleReports wurden bereits vom InfluxAdapter gelesen, validiert, normalisiert und dedupliziert.

## 4. Zyklusgruppen

Die Analyse trennt die einbezogenen Reports in:

- Heizung,
- Warmwasser,
- Abtauung.

Zusätzlich wird eine Gesamtstatistik über alle einbezogenen Zyklen gebildet.

## 5. Gültige und ungültige Zyklen

Standardmäßig werden nur fachlich gültige CycleReports einbezogen.

Über:

```text
Configuration.IncludeInvalidCycles
```

können auch strukturell lesbare Reports mit `analysis.valid=false` in die Statistik aufgenommen werden.

Diese Option kann Durchschnittswerte deutlich verändern und sollte bewusst verwendet werden.

## 6. Kennzahlen

Für die Gesamtmenge und die einzelnen Zyklustypen werden unter anderem ausgewertet:

- Zyklusdauer,
- elektrische Energie,
- thermische Energie,
- COP,
- elektrische Leistung,
- Wärmeleistung,
- Verdichterfrequenz,
- Außentemperatur,
- Verdichterlaufzeit,
- Verdichterstarts,
- Abtauanzahl,
- Qualitätsindex.

## 7. Statistische Auswertung

Je Kennzahl können insbesondere bereitgestellt werden:

- Anzahl vorhandener Werte,
- Summe,
- Mittelwert,
- Minimum,
- Maximum,
- Median,
- Spannweite,
- Standardabweichung,
- 10., 25., 50., 75. und 90. Perzentil.

Fehlende Werte werden nicht durch künstliche Nullwerte ersetzt.

## 8. Verteilungen

Der PerformanceAnalyzer bildet Histogramme unter anderem für:

- COP,
- Zyklusdauer,
- Verdichterfrequenz,
- Außentemperatur,
- elektrische Leistung,
- Wärmeleistung,
- Qualitätsindex.

Damit lassen sich nicht nur Mittelwerte, sondern auch Verteilungen des Anlagenbetriebs beurteilen.

## 9. Betriebsanteile

Die Gruppen Heizung, Warmwasser und Abtauung werden hinsichtlich ihrer Anteile verglichen.

Ausgewertet werden insbesondere:

- Anteil an der Zyklusanzahl,
- Anteil an der Laufzeit,
- Anteil an der elektrischen Energie,
- Anteil an der thermischen Energie,
- Anteil an den Verdichterstarts.

## 10. Kompakte Ergebnisse

Direkte Ergebnis-Datenpunkte enthalten unter anderem:

```text
CycleCount
HeatingCycleCount
WarmwaterCycleCount
DefrostCycleCount
AverageDurationMinutes
AverageElectricalEnergyKWh
AverageThermalEnergyKWh
AverageCOP
MedianCOP
COPStandardDeviation
AverageCompressorFrequencyHz
AverageOutdoorTemperatureC
AverageQualityScore
TotalElectricalEnergyKWh
TotalThermalEnergyKWh
OldestTimestamp
NewestTimestamp
```

## 11. JSON-Ausgaben

Zusätzlich werden vollständige Analyseobjekte veröffentlicht:

```text
Statistics.OverallJson
Statistics.HeatingJson
Statistics.WarmwaterJson
Statistics.DefrostJson
Statistics.DistributionsJson
Statistics.OperatingSharesJson
Statistics.DashboardJson
```

`Statistics.DashboardJson` ist eine kompakte, visualisierungsfreundliche Zusammenfassung. Sie ersetzt nicht das eigenständige Modul `10_NPS_DashboardData`.

## 12. Aktualisierung

Eine Analyse kann ausgelöst werden:

- beim Skriptstart,
- bei Änderung von `InfluxAdapter.History.AllCyclesJson`,
- manuell über `Command.Analyze`.

Überlappende Analyseanforderungen werden seriell abgearbeitet.

## 13. Abgrenzung

Der PerformanceAnalyzer:

- liest keine Rohdaten,
- greift nicht direkt auf InfluxDB zu,
- rekonstruiert keine Einzelzyklen,
- verändert keine CycleReports,
- führt keine Anlagensteuerung aus,
- schreibt ausschließlich in seinen eigenen NPS-Namensraum.

## 14. Version 1.0.1

v1.0.1 dokumentiert die Architektur, Eingänge, Public API, Trigger und Modulgrenzen nach NPS-CS-1.0.

Filterung, Statistik, Verteilungen, Betriebsanteile und Dashboarddaten wurden gegenüber dem vorherigen Entwicklungsstand nicht fachlich verändert.

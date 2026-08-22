# Persistenz-Spezifikation – 13_NPS_CycleAnalyzer v2.4.0

**NIBE Performance Suite (NPS) · Modul 13**  
**Bezugsstand:** `13_NPS_CycleAnalyzer v2.4.0`

## 1. Persistenzziel

Der CycleAnalyzer publiziert zahlreiche Einzelkennzahlen des zuletzt analysierten Zyklus. Für die dauerhafte, verlustfreie Zyklushistorie ist jedoch der vollständige CycleReport der zentrale Vertrag.

## 2. Zentrale Historienquelle

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

wird in:

```text
influxdb.1
```

historisiert.

Der State muss so gespeichert werden, dass jeder neue CycleReport als eigener Zeitpunkt erhalten bleibt.

Dokumentierte Einstellung:

```text
changesOnly = false
```

## 3. Architektur

```text
CycleAnalyzer
   ↓
History.CycleReportJson
   ↓
influxdb.1
   ↓
InfluxAdapter
```

`influxdb.0` wird durch die CycleAnalyzer-spezifische Persistenzkonfiguration ausdrücklich nicht ersetzt oder umkonfiguriert.

## 4. Einzelkennzahlen

Die bestehende CycleAnalyzer-Persistenzarchitektur historisiert ausgewählte numerische Analysewerte zusätzlich in `influxdb.1`, damit direkte Zeitreihenanalysen möglich bleiben.

Dazu gehören Gruppen wie:

```text
Analysis
Compressor
Temperature
Power
Energy
Events
Quality
```

Die genaue Aktiv-/Inaktiv-Zuordnung wird durch die CycleAnalyzer-Influx-Konfiguration verwaltet.

## 5. Nicht als Historienquelle verwenden

Nicht der stabile Langzeitvertrag für vollständige Zyklen sind:

```text
Report.Json
Report.Text
```

Sie repräsentieren den aktuellen Bericht.

Für den InfluxAdapter ist ausschließlich:

```text
History.CycleReportJson
```

maßgeblich.

## 6. Nicht zu historisierende Verwaltungsdaten

Administrations-, Konfigurations-, Diagnose- und Memory-Daten benötigen grundsätzlich keine fachliche Zyklushistorie.

Insbesondere sind technische Bereitstellungsmetadaten wie:

```text
History.LastArchivedRunNumber
History.LastArchivedAt
```

nicht Bestandteil des eigentlichen CycleReport-Archivs.

## 7. Redundanzprinzip

Die Einzelkennzahlen dienen direkten Zeitreihenabfragen.

`History.CycleReportJson` dient dagegen als vollständiges, versioniertes Zyklusdokument für Rekonstruktion, InfluxAdapter und PerformanceAnalyzer.

Diese beiden Zwecke sind bewusst verschieden.

## 8. Abnahmekriterium

Die Persistenzkette gilt als funktionsfähig, wenn der InfluxAdapter historische vollständige Reports aus `influxdb.1` laden kann.

Im aktuellen Produktivtest wurden 28 CycleReports mit einer einzigen Influx-Abfrage erfolgreich geladen.

**Persistenzstatus: PASS**

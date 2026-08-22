# Persistenz-Spezifikation – 14_NPS_PerformanceAnalyzer v1.0.1

**NIBE Performance Suite (NPS) · Modul 14**  
**Bezugsstand:** `14_NPS_PerformanceAnalyzer v1.0.1`

## 1. Grundsatz

Der PerformanceAnalyzer ist ein Analysemodul und kein Persistenzadapter.

Er liest keine InfluxDB direkt und schreibt keine eigene Historie.

## 2. Persistente Datenbasis

Die dauerhafte Datenbasis der Mehrzyklusanalyse ist:

```text
13 CycleAnalyzer
→ History.CycleReportJson
→ influxdb.1
```

Diese Historie wird vom InfluxAdapter gelesen und als deduplizierte, normalisierte Liste bereitgestellt.

## 3. Direkte Quelle des PerformanceAnalyzer

```text
0_userdata.0.NPS.InfluxAdapter.History.AllCyclesJson
```

ist eine Arbeits-/Übergabestruktur und keine zweite fachliche Rohhistorie.

## 4. PerformanceAnalyzer-Ausgaben

```text
Result.*
Statistics.*
Diagnostics.*
System.*
```

sind reproduzierbare Ableitungen aus der geladenen CycleReport-Menge.

Der Scriptstand v1.0.1 sieht für diese Datenpunkte keine eigene Historisierung vor.

## 5. Keine doppelte CycleReport-Persistenz

Der PerformanceAnalyzer darf vollständige CycleReports nicht erneut in einer eigenen Influx-Historie archivieren.

Die eindeutige Persistenzkette bleibt:

```text
CycleAnalyzer.History.CycleReportJson
        ↓
     influxdb.1
        ↓
    InfluxAdapter
        ↓
PerformanceAnalyzer
```

## 6. statistics.0

Der PerformanceAnalyzer verwendet für seine Mehrzyklusstatistik keinen ioBroker-Statistics-Adapter.

Mittelwerte, Summen, Median, Perzentile, Standardabweichung, Histogramme und Betriebsanteile werden direkt aus den geladenen CycleReports berechnet.

## 7. Wiederherstellbarkeit

Nach Neustart kann die komplette Performanceanalyse reproduziert werden, indem:

1. der InfluxAdapter die CycleReports erneut aus `influxdb.1` lädt,
2. `History.AllCyclesJson` neu bereitstellt,
3. der PerformanceAnalyzer die Statistik erneut berechnet.

Eine zusätzliche Langzeitpersistenz der PerformanceAnalyzer-Ergebnisse ist deshalb für die Kernfunktion nicht erforderlich.

## 8. Aktueller Nachweis

Im aktuellen Anlagenstand konnte der InfluxAdapter 28 CycleReports aus `influxdb.1` laden.

Damit steht dem PerformanceAnalyzer eine historische Mehrzyklus-Datenbasis zur Verfügung.

## 9. Sollmatrix

| Bereich | influxdb.0 | influxdb.1 | statistics.0 |
|---|---|---|---|
| Configuration | nein | nein | nein |
| Result | nein | nein | nein |
| Statistics | nein | nein | nein |
| Diagnostics | nein | nein | nein |
| System | nein | nein | nein |

Die persistente Grundlage liegt nicht im PerformanceAnalyzer, sondern bei `CycleAnalyzer.History.CycleReportJson` in `influxdb.1`.

**Persistenzstatus: PASS**

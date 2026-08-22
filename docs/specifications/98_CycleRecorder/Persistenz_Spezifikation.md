# Persistenz-Spezifikation – 98_NPS_CycleRecorder v2.5.2

**NIBE Performance Suite (NPS) · Modul 98**  
**Bezugsstand:** `98_NPS_CycleRecorder v2.5.2`

## 1. Grundsatz

Der CycleRecorder erzeugt den vollständigen Rohdatensatz eines abgeschlossenen Laufs.

Seine primäre Aufgabe ist jedoch nicht die langfristige InfluxDB-Historisierung, sondern die zuverlässige Übergabe des letzten vollständigen Laufs an den CycleAnalyzer.

## 2. Übergabevertrag

```text
CycleRecorder.LastRun.Json
CycleRecorder.LastRun.Id
```

`LastRun.Json` enthält den vollständigen Lauf.

`LastRun.Id` ist das abschließende Commit-Signal und wird zuletzt geschrieben.

## 3. Dauerhafte Zyklushistorie

Die eigentliche langfristige Zyklushistorie entsteht erst nach der fachlichen Analyse:

```text
98 CycleRecorder
      ↓
13 CycleAnalyzer
      ↓
History.CycleReportJson
      ↓
influxdb.1
```

Damit ist `CycleRecorder.LastRun.Json` nicht die zentrale Influx-Langzeithistorie der NPS.

## 4. Optionaler Dateiexport

v2.5.2 kann abgeschlossene Recorder-Läufe zusätzlich als JSON-Datei unter:

```text
NPS/Recorder
```

exportieren.

Dieser Export ist optional und dient Sicherung, Diagnose und manueller Nachvollziehbarkeit.

## 5. Keine redundante Historisierung erforderlich

Eine zusätzliche vollständige Influx-Historisierung jedes `LastRun.Json` ist für die Kernarchitektur nicht erforderlich, da der CycleAnalyzer daraus den fachlich analysierten `CycleReportJson` erzeugt.

## 6. Laufzeitstates

`System.*`, `Recording.*` und `Diagnostics.*` sind Betriebs- und Diagnosezustände.

Sie sind nicht die fachliche Langzeitquelle für Zyklusanalysen.

## 7. Energiequellen und deren Persistenz

Der Recorder liest persistierbare Mess- und Zählerquellen aus vorgelagerten Modulen, erzeugt daraus aber keine zweite allgemeine Zeitreihenhistorie.

Die fachliche Zyklusinformation wird im Recorder-Lauf dokumentiert und anschließend vom CycleAnalyzer verarbeitet.

## 8. Wiederherstellbarkeit

Der letzte abgeschlossene Recorder-Lauf bleibt über `LastRun.Json` verfügbar, solange er nicht durch einen neueren Lauf ersetzt wird.

Für die Langzeitwiederherstellung mehrerer abgeschlossener Zyklen ist dagegen:

```text
CycleAnalyzer.History.CycleReportJson → influxdb.1
```

maßgeblich.

## 9. Persistenzmatrix

| Bereich | Zweck | zentrale Langzeitpersistenz |
|---|---|---|
| `System.*` | Modulstatus | nein |
| `Recording.*` | laufende Aufzeichnung | nein |
| `Diagnostics.*` | Laufzeitdiagnose | nein |
| `LastRun.*` | letzter abgeschlossener Roh-Lauf | kein Cycle-Archiv |
| JSON-Dateiexport | optionale Rohdatensicherung | optional |
| analysierter CycleReport | langfristige Zyklushistorie | `influxdb.1` über CycleAnalyzer |

## 10. Architekturstatus

Die Persistenzkette lautet:

```text
CycleRecorder.LastRun.Json
        ↓
CycleAnalyzer
        ↓
CycleAnalyzer.History.CycleReportJson
        ↓
influxdb.1
```

**Persistenzstatus: PASS**

# Technische Spezifikation – 13_NPS_CycleAnalyzer v2.4.0

**NIBE Performance Suite (NPS) · Modul 13**  
**Bezugsstand:** `13_NPS_CycleAnalyzer v2.4.0`  
**Build:** 28./29.07.2026  
**Status:** STABIL

## 1. Modulvertrag

| Merkmal | Festlegung |
|---|---|
| Modul | `13_NPS_CycleAnalyzer` |
| Version | `2.4.0` |
| Root | `0_userdata.0.NPS.CycleAnalyzer` |
| Schicht | Zyklusanalyse / fachliche Auswertung |
| Recorder-Schema | 2 |
| Historienvertrag | `History.CycleReportJson` |
| Historienkonsument | `11_NPS_InfluxAdapter` |
| Mehrzyklusanalyse | `14_NPS_PerformanceAnalyzer` |

## 2. Architekturregeln

- keine Rohwertaufzeichnung,
- keine Influx-Historienabfrage,
- keine Mehrzyklus-/Langzeitbewertung,
- Single Writer für `NPS.CycleAnalyzer`,
- vollständiger CycleReport als stabiler Persistenzvertrag,
- keine Zusammenlegung mit Recorder, InfluxAdapter oder PerformanceAnalyzer.

## 3. Eingänge

```text
0_userdata.0.NPS.CycleRecorder.LastRun.Json
0_userdata.0.NPS.CycleRecorder.LastRun.Id
```

Zusätzlich:

```text
CycleAnalyzer.Configuration.*
```

`LastRun.Id` ist Commit- und Triggersignal. Das JSON muss beim Trigger bereits vollständig vorliegen.

## 4. Konfiguration

```text
Configuration.Enabled
Configuration.AnalyzeOnStartup
Configuration.MinimumQualityScore
Configuration.Debug
```

Defaults:

```text
Enabled             true
AnalyzeOnStartup    true
MinimumQualityScore 70
Debug               false
```

Weitere Konstanten:

```text
MAX_REPORT_JSON_LENGTH       200000
TIMESTAMP_TOLERANCE_FACTOR   1.75
SUPPORTED_SCHEMA_VERSIONS    [2]
```

## 5. Typcodes

```text
HEIZUNG    = 1
WARMWASSER = 2
ABTAUUNG   = 3
```

Nicht bekannte Typen erhalten Code 0.

## 6. Eingangsvalidierung

Vor der Analyse werden mindestens geprüft:

- JSON-Wurzel ist Objekt,
- `id` vorhanden,
- `type` vorhanden,
- unterstützte `schemaVersion`,
- gültiger `triggerStart`,
- gültiger `triggerEnd`,
- nicht leeres Sample-Array.

Fehlerhafte Recorder-Dokumente werden nicht als reguläre Analyse verarbeitet.

## 7. Sample-Splitting

Samples werden normalisiert, mit Zeitstempel versehen, chronologisch sortiert und in:

```text
pre  : timestamp < triggerStart
main : triggerStart <= timestamp <= triggerEnd
post : timestamp > triggerEnd
```

geteilt.

Ohne Hauptlauf-Samples wird die Analyse abgebrochen.

## 8. Verdichteranalyse

Verdichterlaufzeit wird aus `compressor.running` und den tatsächlichen Sampleabständen berechnet.

Abstände werden nur bis:

```text
nominalInterval × 1.75
```

als tatsächliche Laufzeit verwendet; andernfalls wird das nominale Intervall angesetzt.

Frequenzstatistik wird nur für laufenden Verdichter bzw. positive Frequenz gebildet.

Starts werden als steigende Flanken von `compressor.running` gezählt.

## 9. Temperatur- und Leistungsanalyse

Aus den Hauptlauf-Samples werden statistische Kennzahlen für die vorgesehenen Recorderpfade erzeugt.

Temperaturgruppen:

```text
Outdoor
HotWaterTop
HotWaterCharging
Supply
Return
Spread
```

Leistungsgruppen:

```text
ElectricPower
HeatPower
```

## 10. Energievertrag

v2.4.0 verwendet die vom Recorder bereitgestellte einheitliche Energiebilanz.

Grundsatz:

```text
elektrische Zyklusenergie
→ Recorder-Bilanz / integrierte elektrische Energie

thermische Zyklusenergie
→ typbezogene VirtualMeters inkl. Zusatzheizung
```

Der Analyzer erhält und publiziert zusätzlich Start-/Endwerte, Bilanzgrenzen, Quellen und Diagnosedaten.

Der thermische Fallback verwendet ebenfalls NPS VirtualMeters. Direkte Alias-Zugriffe auf NIBE-Wärmezähler sind seit v2.4.0 entfernt.

## 11. Qualitätsalgorithmus

Ausgangspunkt:

```text
Score = 100
```

Abzüge entstehen unter anderem für:

- fehlende Hauptlauf-Samples, maximal 40 Punkte,
- unregelmäßige Lücken, maximal 20 Punkte,
- unzureichende Abdeckung kritischer Messpfade,
- fehlende Recorder-Quellen, maximal 25 Punkte,
- verworfene Samples, maximal 20 Punkte.

Kritische Messpfade:

```text
compressor.frequencyHz
compressor.running
aliases.Outdoor
aliases.HotWaterTop
aliases.HotWaterCharging
temperatures.supplyC
temperatures.returnC
temperatures.spreadK
```

Der Score wird auf 0…100 begrenzt.

Bewertung:

```text
>=98 SEHR GUT
>=90 GUT
>=70 EINGESCHRÄNKT
<70  UNGENÜGEND
```

`Quality.Complete=true` verlangt mindestens Score 98, keine fehlenden Hauptlauf-Samples und keine Qualitätswarnung.

## 12. Public API

Hauptgruppen:

```text
Configuration.*
System.*
Analysis.*
Compressor.*
Temperature.*
Power.*
Energy.*
Events.*
Quality.*
Report.*
History.*
Memory.*
Diagnostics.*
```

## 13. Analysis

Enthält insbesondere:

```text
Id
Type
TypeCode
RunNumber
Start
End
DurationSeconds
RecordingDurationSeconds
SampleCount
MainSampleCount
PrebufferSampleCount
PostbufferSampleCount
Valid
```

## 14. Energy

Enthält insbesondere:

```text
ElectricKWh
HeatKWh
COP
ElectricIntegratedKWh
AuxiliaryKWh
ElectricIntegrationSeconds
ElectricIntegrationSkippedSeconds
EnergyBoundaryValid
ElectricTotalDeltaKWh
AliasConsumptionDeltaKWh
AliasProductionDeltaKWh
ElectricStartKWh
ElectricEndKWh
HeatStartKWh
HeatEndKWh
ElectricSource
HeatSource
Boundary
```

## 15. History-Vertrag

Verbindlicher Persistenzstate:

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

Zusätzliche Bereitstellungsmetadaten:

```text
History.LastArchivedRunNumber
History.LastArchivedAt
```

`CycleReportJson` ist die einzige vom InfluxAdapter benötigte Historienquelle.

## 16. Publikationsreihenfolge

Die Analyse wird vollständig berechnet und anschließend publiziert.

Erst nach erfolgreicher Publikation des Ergebnisses und des vollständigen CycleReports wird die Lauf-ID als verarbeitet markiert.

Damit wird verhindert, dass ein unvollständig publizierter Lauf dauerhaft als erledigt gilt.

## 17. Doppel- und Parallelverarbeitung

```text
Memory.LastProcessedRunId
```

verhindert Doppelanalyse.

Intern werden überlappende Anforderungen über `analysisRunning` und `rerunRequested` serialisiert.

## 18. Nachgelagerte Verträge

```text
History.CycleReportJson
        ↓
11_NPS_InfluxAdapter
        ↓
History.AllCyclesJson / Typ-Arrays
        ↓
14_NPS_PerformanceAnalyzer
```

Der PerformanceAnalyzer bewertet mehrere Zyklen. Diese Verantwortung gehört ausdrücklich nicht in den CycleAnalyzer.

## 19. Änderung v2.4.0

```text
2.4.0
- thermischer Analyzer-Fallback vollständig auf NPS VirtualMeters
  inklusive Zusatzheizung umgestellt
- direkte Alias-Zugriffe auf NIBE-Wärmezähler entfernt
- Public API unverändert
- CycleReport-Vertrag unverändert
```

## 20. Abnahmekriterien

- Version `2.4.0`.
- Recorder-Schema 2 wird validiert.
- `LastRun.Id` fungiert als Commit-/Triggersignal.
- Vor-, Haupt- und Nachlauf werden korrekt getrennt.
- keine Analyse ohne Hauptlauf-Samples.
- Doppelanalyse wird persistent verhindert.
- Energiequellen folgen der NPS-Architektur.
- keine direkten NIBE-Wärmezähler-Fallbacks.
- Qualitätswert und Rating werden reproduzierbar erzeugt.
- vollständiger CycleReport wird publiziert.
- `History.CycleReportJson` bleibt stabiler Persistenzvertrag.
- keine Historienabfrage im CycleAnalyzer.
- keine Mehrzyklusbewertung im CycleAnalyzer.

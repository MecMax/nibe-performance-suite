# Technische Spezifikation – 98_NPS_CycleRecorder v2.5.2

**NIBE Performance Suite (NPS) · Modul 98**  
**Bezugsstand:** `98_NPS_CycleRecorder v2.5.2`  
**Build:** 19.08.2026  
**Status:** STABIL

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `98_NPS_CycleRecorder` |
| Version | `2.5.2` |
| Root | `0_userdata.0.NPS.CycleRecorder` |
| Schicht | Laufzeitaufzeichnung / Rohdaten-Persistenz |
| Recorder-Schema | 2 |
| Nachgelagerter Konsument | `13_NPS_CycleAnalyzer` |

## 2. Konfiguration

```text
VERSION                         2.5.2
SAMPLE_SECONDS                  10
PREBUFFER_MINUTES               15
POSTBUFFER_MINUTES              15
FILE_EXPORT_ENABLED             true
FILE_DIRECTORY                  NPS/Recorder
ELECTRIC_POWER_UNIT             W
AUXILIARY_POWER_UNIT            kW
ELECTRIC_POWER_INCLUDES_AUXILIARY false
```

## 3. Architekturregeln

- keine Zustandsentscheidung,
- keine fachliche Zyklusanalyse,
- keine Rekonstruktion historischer Zyklen,
- Single Writer für `NPS.CycleRecorder`,
- Recorder-Schema 2 als Datenvertrag,
- `LastRun.Id` als abschließendes Commit-Signal,
- elektrische Leistung/Gesamtenergie ausschließlich aus ElectricalMeters,
- thermische Zähler ausschließlich aus VirtualMeters,
- direkter Wärmeleistungs-Alias nur Diagnose.

## 4. NPS-Eingänge

### ProcessSignals

```text
Betriebsart.Brauchwasser
Betriebsart.Heizung
Betriebsart.Standby
Verdichter.Laeuft
```

### StateMachine

```text
Current.State
Diagnostics.PreviousState
Diagnostics.LastTransition
Diagnostics.TransitionCount
```

### CompressorMonitor

```text
Compressor.Frequency
Compressor.Running
Compressor.Status
Compressor.Starts
Compressor.Runtime
```

### TemperatureMonitor

```text
Temperatures.Supply
Temperatures.Return
Temperatures.Spread
```

### ElectricalMeters

```text
Aktuell.Leistung
Aktuell.Gesamt
```

### EnergyAllocation

```text
Meters.Warmwater
Meters.Heating
Meters.Standby
Meters.Unknown
Meters.TotalAllocated
```

### VirtualMeters

```text
Brauchwasser.NurVerdichter
Brauchwasser.InklusiveZusatzheizung
Heizung.NurVerdichter
Heizung.InklusiveZusatzheizung
```

### Events / NotificationBridge

```text
Events.Verdichter.Sequenz
Events.Verdichter.Typ
Events.Verdichter.Titel
Events.Verdichter.Zeitstempel
NotificationBridge.Statistics.PublishedCount
```

## 5. Ergänzende Aliase

Nur noch nicht zentral veröffentlichte bzw. diagnostische Messgrößen werden direkt als Alias gelesen, darunter:

```text
prio
Außentemperatur
Brauchwasser oben
Brauchwasserbereitung
Enteisung
Gesamtproduktion
Erzeugte Wärmeleistung
Leistung interne Zusatzheizung
```

v2.5.2 verwendet für die Zusatzheizung:

```text
alias.0.Keller.Waschküche.Waermepumpe.Leistung_interne_Zusatzheizung
```

## 6. Sample-Schema

Jedes Sample enthält:

```text
timestamp
timestampMs
process.*
stateMachine.*
compressor.*
temperatures.*
energy.*
event.*
notification.*
aliases.*
```

Fehlende States liefern `null` und werden zusätzlich in `missingSources` registriert.

## 7. Zyklusstart

`detectCycleType(sample)` liefert im aktuellen Stand ausschließlich:

```text
WARMWASSER
```

wenn:

```text
sample.process.warmwater === true
```

ist.

## 8. Zyklusende

Der Lauf gilt als aktiv, solange:

```text
warmwater === true
ODER
compressorRunning === true
```

Nach Wegfall beider Bedingungen wird `triggerEnd` gesetzt und der Nachlauf gestartet.

## 9. Vorlaufpuffer

Der Recorder hält permanent Samples der letzten:

```text
15 Minuten
```

im Ringpuffer.

Beim Zyklusstart werden diese Samples in den neuen Lauf übernommen.

## 10. Laufstruktur

Ein Lauf enthält insbesondere:

```text
schemaVersion
recorderVersion
id
type
triggerStart
triggerEnd
recordingStart
recordingEnd
sampleIntervalSeconds
prebufferMinutes
postbufferMinutes
samples
summary
```

## 11. Bilanzgrenzen

Die fachliche Energiebilanz verwendet ausschließlich:

```text
triggerStart .. triggerEnd
```

Die Grenz-Samples werden chronologisch gesucht.

## 12. Elektrische Integration

Elektrische Leistung wird trapezförmig integriert:

```text
E = Σ ((P1 + P2) / 2) × Δt
```

und von Wattsekunden in kWh umgerechnet.

Maximal akzeptierte Lücke:

```text
SAMPLE_SECONDS × 1.75
```

Bei größeren Lücken wird die Zeit als `skippedSeconds` gezählt und nicht hochgerechnet.

## 13. Zusatzheizung

Die Zusatzheizungsleistung wird separat trapezförmig integriert.

Bei:

```text
ELECTRIC_POWER_INCLUDES_AUXILIARY = false
```

gilt:

```text
ElectricEnergy =
IntegratedElectricPower +
IntegratedAuxiliaryPower
```

sofern Zusatzenergie verfügbar ist.

Eine Doppelzählung wird über diese Konfiguration vermieden.

## 14. Thermische Energie

Für Warmwasser:

```text
VirtualMeters.Brauchwasser.InklusiveZusatzheizung
```

Für Heizung:

```text
VirtualMeters.Heizung.InklusiveZusatzheizung
```

Die Zyklusenergie ist das nichtnegative Zählerdelta zwischen den fachlichen Grenz-Samples.

## 15. COP

```text
COP = HeatEnergyKWh / ElectricEnergyKWh
```

nur wenn:

```text
ElectricEnergyKWh > 0.05
```

und thermische Energie vorhanden ist.

## 16. Diagnosezähler

Langsame bzw. kumulative Zähler wie:

```text
ElectricalMeters.Aktuell.Gesamt
Gesamtproduktion
```

bleiben Vergleichs-/Diagnosewerte und ersetzen nicht die fachliche Zyklusintegration.

## 17. Qualitätsinformation im Recorder

Die Summary dokumentiert insbesondere:

```text
droppedSamples
missingSources
expectedSampleIntervalSeconds
energyBoundaryValid
```

`energyBoundaryValid` verlangt verfügbare elektrische und thermische Zyklusenergie sowie keine zu große Integrationslücke.

Die weitergehende fachliche Qualitätsbewertung gehört zum CycleAnalyzer.

## 18. Public API

### System

```text
System.Version
System.Active
System.Status
System.LastMessage
System.LastStart
System.LastUpdate
```

### Recording

```text
Recording.Active
Recording.Phase
Recording.Type
Recording.Start
Recording.End
Recording.SampleCount
```

### LastRun

```text
LastRun.Id
LastRun.Type
LastRun.Start
LastRun.End
LastRun.DurationSeconds
LastRun.SampleCount
LastRun.COP
LastRun.ElectricEnergyKWh
LastRun.HeatEnergyKWh
LastRun.Json
LastRun.File
```

### Diagnostics

```text
Diagnostics.Warning
Diagnostics.Trace
Diagnostics.DroppedSamples
Diagnostics.RunCount
Diagnostics.MissingSources
```

## 19. Commit-Vertrag zum CycleAnalyzer

Publikationsregel:

```text
1. vollständigen Lauf abschließen
2. Summary erzeugen
3. LastRun-Nutzdaten schreiben
4. optional Datei exportieren
5. LastRun.Id zuletzt schreiben
```

Damit darf `13_NPS_CycleAnalyzer` die Änderung von `LastRun.Id` als Signal interpretieren, dass `LastRun.Json` vollständig vorliegt.

## 20. Versionsabhängigkeiten

Der Header von v2.5.2 dokumentiert den getesteten NPS-V1-Baseline-Stand:

```text
01 VirtualMeters       1.2.1
02 EnergyAllocation    1.2.1
03 TemperatureMonitor  1.0.2
04 CompressorMonitor   1.0.2
06 ProcessSignals      1.1.1
07 StateMachine        1.2.0
08 EventEngine         1.2.0
09 NotificationBridge  1.2.2
12 ElectricalMeters    1.1.1
```

Diese Angaben sind Dokumentation des getesteten Baseline-Stands und keine zusätzliche Laufzeit-Versionsprüfung.

## 21. Änderung v2.5.2

```text
2.5.2 | 19.08.2026
      | Alias für Zusatzheizungsleistung korrigiert auf
      | Leistung_interne_Zusatzheizung.
      | Modbus-Zuordnung 1027 / 31027, Einheit kW.
```

## 22. Abnahmekriterien

- Version `2.5.2`.
- Sampling alle 10 Sekunden.
- 15 Minuten Vor- und Nachlauf.
- Schema-Version 2.
- Zyklusstart über Warmwasser-Prozesssignal.
- LastRun.Id wird zuletzt geschrieben.
- elektrische Leistung aus ElectricalMeters.
- elektrischer Gesamtzähler aus ElectricalMeters.
- thermische Zähler aus VirtualMeters inkl. Zusatzheizung.
- Zusatzheizungsalias entspricht v2.5.2.
- Energiebilanz nur `triggerStart..triggerEnd`.
- große Samplelücken werden nicht hochgerechnet.
- keine fachliche Einzelzyklusanalyse im Recorder.

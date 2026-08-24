# Technische Spezifikation – 15_NPS_HeatingCurveAnalyzer v0.1.1

**NIBE Performance Suite (NPS) · Modul 15**
**Stand:** 24.08.2026
**Bezugsstand:** `15_NPS_HeatingCurveAnalyzer v0.1.1`
**Status:** STABLE – Release 0.1.1
**NPS-Zielversion:** 1.1

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `15_NPS_HeatingCurveAnalyzer` |
| Version | `0.1.1` |
| Root | `0_userdata.0.NPS.HeatingOptimization` |
| Intervall | 5 Minuten |
| Buffer | 7 Tage |
| Buffer-Version | `1.0` |
| AI-Payload-Version | `1.0` |
| AI-Payload-Maximum | 65536 Bytes |
| Zugriff | ausschließlich lesend auf Anlagenquellen |

## 2. Verantwortung

Der HeatingCurveAnalyzer übernimmt:

- Erfassung relevanter NIBE-Konfiguration,
- Erfassung relevanter NIBE-Betriebsdaten,
- Erfassung der heatingcontrol-Zustände,
- Erfassung und Normalisierung von 13 Räumen,
- Plausibilitätsprüfung,
- Sample-Gültigkeitsprüfung,
- Sample-Qualitätsbewertung,
- 5-Minuten-Sampling,
- 7-Tage-Ringbuffer,
- Aggregationen über 6h / 24h / 72h / 7d,
- Außentemperatur-Binning,
- Erkennung persistenter Raumabweichungen,
- globale Datenqualität,
- Evidence-Erzeugung,
- standardisierten lokalen AI.AnalysisPayload.

Nicht Bestandteil:

```text
NIBE-Parameter schreiben
Heizkurve automatisch ändern
heatingcontrol verändern
MQTT direkt lesen
KI-Abfrage extern ausführen
```

## 3. Konstanten

### 3.1 Komfort und Raumgültigkeit

```text
COMFORT_BAND_K = 0.5
MIN_VALID_ROOM_RATIO = 0.50
MIN_VALID_ROOMS = 3
```

### 3.2 Sampling

```text
SAMPLE_INTERVAL_MINUTES = 5
MAX_BUFFER_AGE_MS = 7 Tage
```

### 3.3 Mindestdatenbasis

```text
MIN_ROOM_ANALYSIS_HOURS = 6
PERSISTENT_ROOM_RATIO = 60 %
MIN_BIN_VALID_HOURS = 3
```

Analysefenster:

```text
Window6h  -> 2 gültige Heizstunden
Window24h -> 4 gültige Heizstunden
Window72h -> 8 gültige Heizstunden
Window7d  -> 12 gültige Heizstunden
```

## 4. Evidence-Grenzen

```text
GLOBAL_RATIO_PERCENT = 60
GLOBAL_MEDIAN_K = 0.5
ROOM_STDDEV_K = 0.7
ROOM_RANGE_K = 2.0
FLOW_TRACKING_K = 2.0
OUTDOOR_DEPENDENCE_K = 0.7
ADDITIONAL_HEAT_RUNTIME_PERCENT = 10
SENSOR_MISMATCH_K = 3.0
MIN_DATA_QUALITY_PERCENT = 60
AI_READY_DATA_QUALITY_PERCENT = 75
```

## 5. Plausibilitätsgrenzen

| Messgröße | Minimum | Maximum |
|---|---:|---:|
| Außentemperatur | -40 °C | 50 °C |
| Vorlauf Soll | 5 °C | 80 °C |
| Vorlauf Ist | 5 °C | 80 °C |
| Rücklauf | 5 °C | 80 °C |
| Gradminuten | -3000 | 3000 |
| Verdichterfrequenz | 0 Hz | 150 Hz |
| Volumenstrom | 0 | 100 |
| Raumtemperatur | 5 °C | 35 °C |
| Zeitplan-Solltemperatur | 5 °C | 30 °C |

## 6. Datenquellen

### 6.1 NIBE_CONFIG

Alle Konfigurationswerte werden über Aliase gelesen.

Verwendet werden:

- heatingCurve,
- heatingCurveOffset,
- flowMin,
- flowMax,
- customCurveP1 bis P7,
- pointOutdoorTemperature,
- pointOffset,
- heatingStartUndertemp,
- heatingStopTemperature,
- additionalHeatStopTemperature,
- autoFilterTime,
- maxFlowDifferenceCompressor,
- operatingMode,
- heatingAutomatic.

### 6.2 NIBE_OPERATING

Verwendet werden:

- outdoorTemperature,
- outdoorTemperatureBT28,
- flowTarget,
- flowActual,
- returnTemperature,
- degreeMinutes,
- compressorFrequency,
- compressorStatus,
- compressorDemand,
- operatingPriority,
- volumeFlow,
- defrostActive,
- additionalHeatPower,
- additionalHeatMode,
- heatPower,
- electricalPower,
- compressorStartsTotal,
- compressorRuntimeTotal.

Nicht alle Operating-Quellen sind Required Sources.

## 7. heatingcontrol

Konfigurierte Instanzen:

```text
0 = Wohnung EG + Keller + Treppenhaus
1 = Wohnung OG + Dachgeschoss
```

Pflichtquellen je Instanz:

```text
HeatingPeriodActive
MaintenanceActive
```

Raumquellen werden dynamisch aus:

```text
heatingcontrol.<instance>.Rooms.<room>
```

gebildet.

## 8. Raumkonfiguration

Es sind 13 Räume fest im Skript definiert.

Ein Raum kann enthalten:

- separaten Raumfühler,
- einen oder mehrere Thermostatfühler,
- heatingcontrol-Quellen.

Temperaturquellenpriorität:

```text
1. gültiger Raumfühler
2. genau ein gültiger Thermostatfühler
3. Mittelwert mehrerer gültiger Thermostatfühler
```

## 9. SourceCheck

`buildSourceList()` erzeugt:

```text
required[]
optional[]
```

`checkSource()` prüft:

1. Objekt vorhanden,
2. State lesbar.

Fehlergründe:

```text
OBJECT_NOT_FOUND
STATE_NOT_READABLE
```

`runSourceCheck()` liefert:

```text
generatedAt
required.total
required.ok
required.missing[]
optional.total
optional.ok
optional.missing[]
rooms.configured
rooms.valid
rooms.invalid[]
ok
```

In v0.1.1 wird der SourceCheck bei jedem Snapshot neu erzeugt.

## 10. Status.Valid

Beim Scheduled Sample wird:

```text
Status.Valid = sourceCheck.ok
```

gesetzt.

Damit führt jede aktuell fehlende Required Source zu:

```text
Status.Valid = false
```

Nach Wiederkehr der Quelle kann der nächste Snapshot den Status wieder auf `true` setzen.

## 11. Konfiguration

`readConfiguration()` liest die NIBE-Konfiguration.

`buildConfigurationSignature()` erzeugt eine deterministische Signatur über die relevanten Konfigurationsfelder.

`writeConfiguration()` schreibt:

```text
Configuration.*
Configuration.ConfigurationSignature
Configuration.Json
```

Bei Signaturänderung zusätzlich:

```text
Configuration.ChangedAt
```

## 12. NIBE Current

`readNibeCurrent()` berechnet ergänzend:

```text
outdoorSensorDifference
supplyDeviation
deltaT
compressorActive
additionalHeatActive
```

Formeln:

```text
OutdoorSensorDifference = OutdoorTemperature - OutdoorTemperatureBT28
SupplyDeviation = FlowActual - FlowTarget
DeltaT = FlowActual - ReturnTemperature
```

Verdichter aktiv:

```text
compressorFrequency >= 1 Hz
```

## 13. NIBE-Gültigkeit

`validateNibeCurrent()` setzt einen Messpunkt nur dann NIBE-seitig gültig, wenn:

```text
Pflichtwerte plausibel
OperatingPriority == 30
CompressorActive == true
DefrostActive == false
VolumeFlow > 0
```

Mögliche Ausschlussgründe:

```text
INVALID_NIBE_DATA
NIBE_NOT_HEATING
COMPRESSOR_INACTIVE
DEFROST_ACTIVE
NO_VOLUME_FLOW
```

## 14. Raumlogik

`evaluateRoom()` liest:

- ScheduleTarget,
- EffectiveTarget,
- State,
- WindowOpen,
- Active,
- OverrideTemperature,
- OverrideRemainingMinutes,
- Thermostatwerte,
- optionalen Raumfühler.

Raumabweichung:

```text
actualTemperature - scheduleTarget
```

Komfortklassifikation:

```text
TOO_COLD
OK
TOO_WARM
```

## 15. Daten- und Analysegültigkeit eines Raums

`dataValid`:

```text
roomActive == true
actualTemperature plausibel
scheduleTarget plausibel
```

`validForHeatingCurve` zusätzlich:

```text
heatingcontrol-Instanz gültig
windowOpen == false
overrideActive == false
```

Ausschlussgründe können sein:

```text
ROOM_INACTIVE
NO_ACTUAL_TEMPERATURE
INVALID_ACTUAL_TEMPERATURE
NO_SCHEDULE_TARGET
INVALID_SCHEDULE_TARGET
HEATING_PERIOD_INACTIVE
MAINTENANCE
WINDOW_OPEN
OVERRIDE_ACTIVE
```

## 16. Raumaggregation

`evaluateRooms()` berechnet:

- count,
- activeCount,
- dataValidCount,
- validForHeatingCurveCount,
- tooColdCount,
- okCount,
- tooWarmCount,
- averageDeviation,
- medianDeviation,
- minimumDeviation,
- maximumDeviation,
- deviationStdDev,
- deviationRange,
- coldestRoom,
- coldestRoomDeviation,
- warmestRoom,
- warmestRoomDeviation.

## 17. Sample-Gültigkeit

`evaluateCurrentSample()` fordert:

```text
NIBE gültig
mindestens eine heatingcontrol-Instanz gültig
validForHeatingCurveCount >= 3
validRatio >= 0.50
```

Mögliche zusätzliche Gründe:

```text
NO_HEATING_PERIOD_ACTIVE
INSUFFICIENT_VALID_ROOMS
VALID_ROOM_RATIO_TOO_LOW
```

## 18. SampleQuality

Bewertung:

```text
40 Punkte NIBE-Pflichtdaten
40 Punkte Anteil gültiger Räume
10 Punkte keine Zusatzheizung
5 Punkte BT1/BT28-Differenz < 3 K
5 Punkte keine sonstigen Pflichtdatenwarnungen
```

Ergebnis:

```text
0..100 %
```

## 19. Datenpunktstruktur

Hauptgruppen:

```text
Status
Configuration
Current
Rooms
Analysis
AI
Internal
```

Die Datenpunkte werden beim Start durch `ensureDatapoints()` erzeugt bzw. normalisiert.

Bestehende States mit nicht passendem `common` werden korrigiert.

## 20. Historisierungsrelevante States

`INFLUX_STATES` enthält einen explizit festgelegten Satz von Configuration-, Current-, Rooms- und Status-States.

Ab v0.1.1 gilt:

```text
bei jedem echten 5-Minuten-Sample
→ definierte INFLUX_STATES schreiben
→ auch bei unverändertem Wert
```

Startup-Snapshots erzwingen diese Schreibvorgänge nicht.

## 21. Ringbuffer

Globale Variable:

```text
sampleBuffer
```

Persistenz:

```text
Internal.SampleBufferJson
```

`trimBuffer()`:

- entfernt Samples älter als 7 Tage,
- dedupliziert nach Timestamp,
- sortiert chronologisch.

## 22. Buffer-Sample

`buildBufferSample()` speichert:

```text
ts
configSignature
valid
quality
nibe{}
rooms{}
excludeReasons[]
```

Im Raumblock werden nur für die Heizkurve gültige Raumabweichungen aufgenommen.

## 23. Analysefenster

`aggregateWindow()` filtert nach:

```text
Zeitfenster
aktuelle ConfigurationSignature
```

Es unterscheidet:

```text
allSamples
validSamples
```

`validHeatingHours`:

```text
validSampleCount * 5 / 60
```

## 24. Fenster-Datenqualität

Technische Fensterqualität:

```text
50 % zeitliche Coverage
30 % Heizstundenbasis
20 % Raum-Coverage
```

Diese Fensterqualität ist nicht identisch mit der globalen T6-Datenqualität.

## 25. Persistent Rooms

`buildRoomHistory()` analysiert 72 Stunden.

`buildPersistentRoomLists()` markiert Räume, wenn:

```text
validHours >= 6
mittlere Abweichung außerhalb ±0,5 K
Richtungsanteil >= 60 %
```

## 26. Outdoor Bins

`getOutdoorBin()`:

```text
GT_10
5_TO_10
0_TO_5
MINUS5_TO_0
LT_MINUS5
```

`buildOutdoorBins()` verwendet 168 Stunden.

Ein Bin ist gültig ab:

```text
3 gültigen Heizstunden
```

## 27. Globale Datenqualität

`calculateGlobalDataQuality()` kombiniert:

```text
25 % SourceQuality
30 % HeatingSampleQuality
30 % RoomCoverageQuality
15 % TimeCoverageQuality
```

Zeitabdeckung:

```text
>= 12 h -> 100
>= 8 h  -> 80
>= 4 h  -> 50
< 4 h   -> 20
```

Qualitätsstatus:

```text
>= 90 -> EXCELLENT
>= 75 -> GOOD
>= 50 -> LIMITED
sonst -> INSUFFICIENT
```

Fehlende Required Sources erzwingen:

```text
INSUFFICIENT
```

## 28. Evidence: GlobalTooCold

Voraussetzungen:

```text
Window72h gültig
TooColdRatio >= 60 %
MedianRoomDeviation <= -0,5 K
```

## 29. Evidence: GlobalTooWarm

Voraussetzungen:

```text
Window72h gültig
TooWarmRatio >= 60 %
MedianRoomDeviation >= +0,5 K
```

## 30. Evidence: RoomImbalance

Erkannt bei mindestens einem der Kriterien:

```text
StdDev >= 0,7 K
Range >= 2,0 K
gleichzeitig persistente kalte und warme Räume
```

## 31. Evidence: FlowTrackingProblem

Basis:

```text
Window24h.avgFlowDeviation
```

Bewertung:

```text
<= -2 K -> LOW
>= +2 K -> HIGH
sonst -> OK
```

## 32. Evidence: OutdoorDependentDeviation

Es werden mindestens zwei gültige Außentemperatur-Bins benötigt.

Verglichen werden wärmster und kältester gültiger Bin.

Schwellwert:

```text
|Delta MedianRoomDeviation| >= 0,7 K
```

Richtung:

```text
COLDER_OUTSIDE_MORE_NEGATIVE
COLDER_OUTSIDE_MORE_POSITIVE
```

## 33. Evidence: AdditionalHeatInfluence

Aktiv, wenn:

```text
Window72h gültig
AdditionalHeatRuntimePercent >= 10 %
```

## 34. Evidence: SensorMismatch

Basis:

```text
mittlere absolute Differenz BT1/BT28 über 24 h
```

Schwellwert:

```text
>= 3,0 K
```

## 35. Evidence: InsufficientData

Wird gesetzt, wenn mindestens eine Bedingung erfüllt ist:

```text
Window72h ungültig
globale Datenqualität < 60 %
gültige Heizstunden aktuelle Konfiguration < 8 h
```

## 36. AI.Ready

Wird nur gesetzt, wenn:

```text
InsufficientData == false
Window72h gültig
globale Datenqualität >= 75 %
```

## 37. AI.AnalysisPayload

Schema-Version:

```text
1.0
```

Analyzer-Version:

```text
0.1.1
```

Hauptblöcke:

```text
system
configuration
current
rooms
analysis
outdoorBins
persistentRooms
evidence
dataQuality
```

## 38. Payload-Normalisierung

Zahlen werden je nach Bedeutung gerundet.

Beispiele:

```text
Temperaturen -> meist 1 Nachkommastelle
Leistung kW -> 2 Nachkommastellen
Gradminuten -> ganzzahlig
elektrische Leistung W -> ganzzahlig
```

## 39. Payload-Limit

Maximal:

```text
65536 Bytes UTF-8
```

Reduktion:

```text
1. Thermostatdetails entfernen
2. ungültige Raumdetails entfernen
3. ungültige OutdoorBins reduzieren
```

Falls weiterhin zu groß:

```text
ready = false
PAYLOAD_TOO_LARGE
```

## 40. Scheduler

Installation:

```text
schedule('*/5 * * * *', ...)
```

`sampleRunning` verhindert überlappende Läufe.

Laufzeitwarnungen:

```text
> 10 s -> warn
> 60 s -> error
```

## 41. Startup

`initialize()` führt aus:

1. Versionslog,
2. Datenpunkte sicherstellen,
3. Status initialisieren,
4. Buffer laden,
5. Buffer persistieren,
6. Startup-Snapshot ohne Buffer-Sample,
7. SourceCheck übernehmen,
8. Scheduler installieren,
9. `Status.Valid`,
10. `Status.Active`,
11. Diagnose-Logs.

## 42. Scheduled Snapshot

`runScheduledSample()`:

1. Zeitstempel normalisieren,
2. `performSnapshot(storeInBuffer=true)`,
3. aktuellen SourceCheck durchführen,
4. Konfiguration lesen,
5. Current lesen,
6. Räume bewerten,
7. Sample bewerten,
8. Current/Rooms schreiben,
9. Buffer-Sample hinzufügen,
10. Aggregationen berechnen,
11. Evidence berechnen,
12. AI-Payload erzeugen,
13. Buffer persistieren,
14. `Status.Valid` aus aktuellem SourceCheck setzen.

## 43. Fehlerbehandlung

`recordError()` erhöht:

```text
Status.ErrorCount
```

und schreibt:

```text
Status.LastError
```

Format:

```text
ISO-Zeit | Fehlercode | Meldung
```

## 44. Shutdown

Beim Stop:

- Scheduler löschen,
- Buffer persistieren,
- `Status.Active=false`.

## 45. Release 0.1.1

Wesentliche Änderungen:

```text
T3
definierte Influx-States werden bei jedem 5-Minuten-Sample
auch bei unverändertem Wert geschrieben

T8
SourceCheck wird bei jedem Snapshot neu erzeugt
Status.SourceCheckOk und SourceCheckJson bleiben aktuell
fehlende Required Sources setzen Status.Valid=false
automatische Erholung nach Wiederkehr der Quellen
Evidence / DataQuality / AI-Payload verwenden aktuellen SourceCheck
```

## 46. Technischer Status

Version 0.1.1 ist als:

```text
STABLE – Release 0.1.1
```

gekennzeichnet.

Das Modul bleibt ein ausschließlich analysierender und vorbereitender Baustein. Automatische Heizkurvenänderungen sind nicht Bestandteil dieses Releases.

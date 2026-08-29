# Technische Spezifikation – 15_NPS_HeatingCurveAnalyzer v0.2.0

**NIBE Performance Suite (NPS) · Modul 15**

**Stand:** 29.08.2026
**Bezugsstand:** `15_NPS_HeatingCurveAnalyzer v0.1.1`
**Zielstand:** `15_NPS_HeatingCurveAnalyzer v0.2.0`
**Status:** DRAFT – AI Advisor Extension
**NPS-Zielversion:** 1.1

---

# 1. Zweck der Version 0.2.0

Version 0.2.0 erweitert den bestehenden HeatingCurveAnalyzer um eine standardisierte, KI-anbieterunabhängige Beratungs-Schnittstelle.

Der bestehende Analysepfad bleibt erhalten:

```text
NIBE
  +
heatingcontrol
  +
Raumtemperaturen
        │
        ▼
15_NPS_HeatingCurveAnalyzer
        │
        ├── Current
        ├── Rooms
        ├── Analysis
        ├── OutdoorBins
        ├── PersistentRooms
        ├── Evidence
        └── DataQuality
```

Neu hinzu kommt:

```text
bestehende Analyse
        │
        ▼
NPS-AI-AnalysisPayload
        │
        ▼
externe oder lokale KI
        │
        ▼
NPS-AI-RecommendationPayload
        │
        ▼
NPS Validator
        │
        ├── Empfehlung gültig
        └── Änderung zulässig?
        │
        ▼
Benutzerentscheidung
        │
        ▼
manuelle Anlagenänderung
        │
        ▼
OptimizationRecord
        │
        ▼
spätere Wirkungskontrolle
```

Version 0.2.0 implementiert weiterhin keine automatische Änderung von NIBE-Parametern.

---

# 2. Grundprinzip

Für die KI-Heizungsoptimierung gilt verbindlich:

> **Die KI berät. NPS validiert. Der Benutzer entscheidet.**

Die KI erhält keine unmittelbare Steuerungsmöglichkeit.

NPS akzeptiert keine KI-Empfehlung ungeprüft.

---

# 3. Abgrenzung

## 3.1 Bestandteil von Modul 15

Modul 15 übernimmt:

* Erfassung und Normalisierung der Heizungsdaten,
* Raumdatenerfassung,
* Zeitreihenpufferung,
* Aggregation,
* Evidence-Erzeugung,
* Datenqualitätsbewertung,
* Erzeugung des `NPS-AI-AnalysisPayload`,
* Aufnahme eines extern erzeugten `NPS-AI-RecommendationPayload`,
* syntaktische und fachliche Validierung der Empfehlung,
* Ermittlung von `ChangeAllowed`,
* Verwaltung der Optimierungshistorie,
* Vorbereitung einer späteren Wirkungskontrolle.

## 3.2 Nicht Bestandteil von Modul 15

Nicht Bestandteil bleiben:

```text
KI-API selbst aufrufen
OpenAI direkt ansprechen
Claude direkt ansprechen
Gemini direkt ansprechen
lokales LLM direkt starten
NIBE-Parameter automatisch schreiben
heatingcontrol automatisch ändern
eine Empfehlung automatisch ausführen
```

Eine spätere automatische KI-Anbindung wird als separate Komponente spezifiziert.

---

# 4. Kompatibilität zu v0.1.1

Die vorhandene Funktionalität von v0.1.1 wird grundsätzlich unverändert übernommen.

Insbesondere bleiben erhalten:

```text
5-Minuten-Sampling
7-Tage-Ringbuffer
6h-Analyse
24h-Analyse
72h-Analyse
7d-Analyse
13-Raum-Modell
SourceCheck
Status.Valid
Sample-Gültigkeit
SampleQuality
Persistent Rooms
Evidence
DataQuality
AI.Ready
AI-Payload-Größenbegrenzung
```

Bestehende Datenpunkte dürfen nicht entfernt oder semantisch verändert werden, sofern diese Spezifikation nicht ausdrücklich eine Änderung festlegt.

---

# 5. KI-Schnittstellenstandards

Version 0.2.0 verwendet vier verbindliche Standards:

```text
NPS-AI-AnalysisPayload v1.1

NPS-HeatingOptimization-Prompt v1.0

NPS-AI-RecommendationPayload v1.0

NPS-AI-OptimizationRecord v1.0
```

Alle Standards sind KI-anbieterunabhängig.

---

# 6. NPS-AI-AnalysisPayload v1.1

## 6.1 Zweck

Der AnalysisPayload enthält ausschließlich:

* gemessene Werte,
* aus Messwerten berechnete Kennzahlen,
* NPS-Evidence,
* Datenqualitätsinformationen,
* Anlagenkonfiguration,
* bereits dokumentierte Optimierungsinformationen.

Der Payload enthält keine KI-generierte Empfehlung.

---

# 7. Schema-Kennung

Der Payload erhält verbindlich:

```json
{
  "schema": "NPS-AI-AnalysisPayload",
  "schemaVersion": "1.1"
}
```

`schema` dient der eindeutigen Identifikation des Payload-Typs.

`schemaVersion` beschreibt ausschließlich das Format des AnalysisPayload und ist unabhängig von der Script-Version.

---

# 8. Allgemeiner Payload-Kopf

Der Kopf enthält mindestens:

```json
{
  "schema": "NPS-AI-AnalysisPayload",
  "schemaVersion": "1.1",
  "analyzerVersion": "0.2.0",
  "generatedAt": "2026-08-29T10:45:00+02:00",
  "analysisPeriodHours": 72,
  "ready": true
}
```

## 8.1 analysisPeriodHours

Für die primäre KI-Heizungsbewertung gilt:

```text
analysisPeriodHours = 72
```

Dies kennzeichnet das primäre fachliche Bewertungsfenster.

Zusätzliche Analysefenster 6h, 24h und 7d bleiben im Payload erhalten.

---

# 9. Payload-Hauptstruktur

Der bestehende Aufbau wird beibehalten und erweitert:

```text
schema
schemaVersion
analyzerVersion
generatedAt
analysisPeriodHours
ready

system
configuration
current
rooms
analysis
outdoorBins
persistentRooms
evidence
dataQuality
previousOptimization
```

---

# 10. system

Der bestehende technische Systemblock bleibt erhalten.

Er wird um Anlagenkontext ergänzt, soweit dieser sicher und statisch bekannt ist.

Zielstruktur:

```json
"system": {
  "module": "HeatingCurveAnalyzer",
  "sampleIntervalMinutes": 5,
  "comfortBandK": 0.5,
  "currentConfigurationSince": null,
  "currentConfigurationValidHeatingHours": null,
  "currentConfigurationSampleCount": null,

  "plant": {
    "manufacturer": "NIBE",
    "outdoorUnit": "S2125-12",
    "indoorUnit": "VVM S500",
    "systemType": "air_water_heatpump",
    "heatDistribution": "radiators",
    "heatingCircuits": 1
  }
}
```

Statische Anlageninformationen werden nicht aus einer KI-Antwort übernommen.

---

# 11. configuration

Die bestehende Konfigurationsstruktur bleibt vollständig erhalten.

Dazu gehören unter anderem:

```text
heatingCurve
heatingCurveOffset
flowMinC
flowMaxC
customCurve
pointAdjustment
heatingStartUndertempC
heatingStopTemperatureC
additionalHeatStopTemperatureC
autoFilterHours
maxFlowDifferenceCompressorK
operatingMode
heatingAutomatic
signature
```

Fehlende Werte werden als `null` ausgegeben.

Werte dürfen nicht geschätzt werden.

---

# 12. ConfigurationSignature

Die bestehende `signature` bleibt wesentlicher Bestandteil.

Sie dient dazu:

* Messdaten einer konkreten Anlagenkonfiguration zuzuordnen,
* ältere Messdaten nach Parameteränderungen auszuschließen,
* die gültige Beobachtungsdauer seit einer Änderung zu bestimmen,
* eine zu frühe erneute Optimierung zu verhindern.

---

# 13. current

Der bestehende Current-Snapshot bleibt erhalten.

Er dient der KI als aktueller Anlagenkontext.

Die langfristige Heizkurvenentscheidung darf jedoch nicht ausschließlich aus `current` abgeleitet werden.

Primäre Entscheidungsbasis sind:

```text
analysis.72h
outdoorBins
persistentRooms
evidence
dataQuality
previousOptimization
```

---

# 14. rooms

Die bestehende Struktur bleibt:

```text
rooms.summary
rooms.details[]
```

## 14.1 rooms.summary

Enthält weiterhin unter anderem:

```text
total
active
dataValid
validForHeatingCurve
tooCold
ok
tooWarm
averageDeviationK
medianDeviationK
minDeviationK
maxDeviationK
stdDevK
rangeK
coldestRoom
coldestRoomDeviationK
warmestRoom
warmestRoomDeviationK
```

## 14.2 rooms.details

Pro Raum bleiben mindestens erhalten:

```text
id
name
actualTemperatureC
temperatureSource
scheduleTargetC
effectiveTargetC
deviationK
comfortState
windowOpen
roomState
roomActive
dataValid
validForHeatingCurve
excludeReasons
thermostats[]
```

Ein einzelner auffälliger Raum darf nicht automatisch zu einer globalen Heizkurvenänderung führen.

---

# 15. analysis

Die vorhandenen Analysefenster bleiben:

```text
analysis.6h
analysis.24h
analysis.72h
analysis.7d
```

Für die KI-Heizungsoptimierung ist `analysis.72h` das primäre Bewertungsfenster.

---

# 16. Primäre 72h-Kennzahlen

Für die KI müssen im 72h-Fenster insbesondere vorhanden sein:

```text
valid
validSampleCount
validHeatingHours

outdoor.averageC
outdoor.minC
outdoor.maxC

flow.targetAverageC
flow.actualAverageC
flow.deviationAverageK
flow.returnAverageC
flow.deltaTAverageK

degreeMinutes.average
degreeMinutes.min
degreeMinutes.max

compressor.frequencyAverageHz
compressor.runtimePercent

additionalHeat.runtimePercent

rooms.averageDeviationK
rooms.medianDeviationK
rooms.minDeviationK
rooms.maxDeviationK
rooms.stdDevK
rooms.rangeK
rooms.tooColdRatioPercent
rooms.okRatioPercent
rooms.tooWarmRatioPercent

dataQualityPercent
```

---

# 17. Vorzeichenkonventionen

## 17.1 Raumabweichung

```text
RoomDeviation =
ActualRoomTemperature - TargetRoomTemperature
```

Damit gilt:

```text
negativ  -> Raum zu kalt
0        -> Soll erreicht
positiv  -> Raum zu warm
```

## 17.2 Vorlaufabweichung

```text
FlowDeviation =
FlowActual - FlowTarget
```

Damit gilt:

```text
negativ  -> Vorlauf IST unter SOLL
positiv  -> Vorlauf IST über SOLL
```

Diese Konventionen sind verbindlich.

---

# 18. OutdoorBins

Die vorhandenen fünf Außentemperaturbereiche bleiben unverändert:

```text
GT_10
5_TO_10
0_TO_5
MINUS5_TO_0
LT_MINUS5
```

Eine Änderung auf feinere Temperaturbänder ist nicht Bestandteil von v0.2.0.

---

# 19. Gültigkeit eines OutdoorBins

Ein Bin ist weiterhin gültig, wenn:

```text
validHeatingHours >= 3 h
```

Ungültige Bins dürfen von der KI nicht als Beleg für eine Heizkurvensteigung verwendet werden.

---

# 20. OutdoorBin-Erweiterung v0.2.0

Zusätzlich zu den bestehenden Kennzahlen werden je Bin neu berechnet:

```text
tooColdRatioPercent
okRatioPercent
tooWarmRatioPercent
```

Zielstruktur:

```json
"0_TO_5": {
  "valid": true,
  "sampleCount": 144,
  "validHeatingHours": 12.0,
  "averageOutdoorTemperatureC": 2.7,
  "averageRoomDeviationK": -0.3,
  "medianRoomDeviationK": -0.2,
  "averageFlowTargetC": 37.4,
  "averageFlowActualC": 37.1,
  "averageFlowDeviationK": -0.3,
  "averageDegreeMinutes": -182,
  "tooColdRatioPercent": 31.0,
  "okRatioPercent": 61.0,
  "tooWarmRatioPercent": 8.0
}
```

---

# 21. Berechnung der OutdoorBin-Ratios

Die Ratios werden aus den im jeweiligen Bin enthaltenen gültigen Raumwerten ermittelt.

Es gelten dieselben Komfortgrenzen wie in der regulären Raumanalyse.

```text
Deviation < -COMFORT_BAND_K
    -> TOO_COLD

Deviation innerhalb ±COMFORT_BAND_K
    -> OK

Deviation > +COMFORT_BAND_K
    -> TOO_WARM
```

Die Summe soll näherungsweise ergeben:

```text
TooColdRatio +
OKRatio +
TooWarmRatio
≈ 100 %
```

Rundungsabweichungen sind zulässig.

---

# 22. PersistentRooms

Die bestehende Logik bleibt unverändert.

PersistentRooms werden weiterhin über 72 Stunden ermittelt.

Die KI verwendet diese Informationen insbesondere zur Unterscheidung:

```text
globales Anlagenproblem
vs.
lokales Raumproblem
```

---

# 23. Evidence

Die bestehende Evidence-Struktur bleibt unverändert und wird ausdrücklich dem KI-Standard zugrunde gelegt.

Relevant sind insbesondere:

```text
globalTooCold
globalTooWarm
outdoorDependentDeviation
roomImbalance
flowTrackingProblem
additionalHeatInfluence
sensorMismatch
insufficientData
```

Vorhandene Confidence-Werte und Richtungsinformationen bleiben erhalten.

---

# 24. Evidence-Hierarchie

Die KI darf Evidence interpretieren.

Die KI darf Evidence nicht überschreiben.

Für NPS gilt:

```text
Messdaten
    ↓
NPS-Berechnung
    ↓
Evidence
    ↓
KI-Interpretation
```

Nicht zulässig ist:

```text
KI-Behauptung
    ↓
Überschreiben von Evidence
```

---

# 25. DataQuality

Die bestehende Datenqualitätsstruktur bleibt:

```text
percent
state
sourceQualityPercent
heatingSampleQualityPercent
roomCoverageQualityPercent
timeCoverageQualityPercent
requiredSourcesMissing
optionalSourcesMissing
currentConfigurationValidHeatingHours
warnings
```

---

# 26. AI.Ready

Die Bedeutung von `AI.Ready` wird ausdrücklich festgelegt.

`AI.Ready == true` bedeutet:

> Der aktuelle AnalysisPayload besitzt eine grundsätzlich ausreichende technische und analytische Datenbasis, um von einer KI untersucht zu werden.

`AI.Ready` bedeutet ausdrücklich nicht:

> Eine Parameteränderung ist erlaubt.

---

# 27. Voraussetzungen AI.Ready

Die bestehende Grundlogik bleibt:

```text
InsufficientData == false
Window72h gültig
globale Datenqualität >= 75 %
Payload technisch gültig
Payload innerhalb Größenlimit
```

---

# 28. Analyse trotz Sperrgrund

Bestimmte Evidence-Zustände dürfen eine KI-Analyse weiterhin zulassen.

Beispiele:

```text
SensorMismatch
FlowTrackingProblem
AdditionalHeatInfluence
RoomImbalance
```

Die KI kann dann beispielsweise:

```text
INVESTIGATE
```

empfehlen.

Eine konkrete Heizkurvenänderung kann dennoch gesperrt sein.

---

# 29. previousOptimization

Version 0.2.0 ergänzt:

```text
previousOptimization
```

Wenn keine vorherige Optimierung dokumentiert wurde:

```json
"previousOptimization": null
```

Wenn eine vorherige Änderung vorhanden ist, enthält der Block mindestens:

```json
"previousOptimization": {
  "timestamp": "2026-11-14T10:15:00+01:00",
  "parameter": "heatingCurve",
  "oldValue": 7,
  "newValue": 6,
  "evaluation": "NOT_EVALUATED"
}
```

---

# 30. Zweck von previousOptimization

Der Block verhindert insbesondere:

* zu schnelle Folgeänderungen,
* Hin-und-her-Regelung,
* Wiederholung einer noch nicht bewerteten Empfehlung,
* Bewertung neuer Messdaten ohne Kenntnis der letzten Änderung.

---

# 31. AnalysisPayload-Größenlimit

Das bestehende Maximum bleibt:

```text
65536 Bytes UTF-8
```

Die bestehende Reduktionsreihenfolge bleibt:

```text
1. Thermostatdetails entfernen
2. ungültige Raumdetails entfernen
3. ungültige OutdoorBins reduzieren
```

Falls der Payload danach weiterhin zu groß ist:

```text
ready = false
PAYLOAD_TOO_LARGE
```

---

# 32. NPS-HeatingOptimization-Prompt v1.0

Der Prompt ist nicht Teil der Messlogik.

Er stellt einen separaten fachlichen Standard dar.

Eine beliebige KI soll mit demselben Prompt und demselben AnalysisPayload grundsätzlich vergleichbare Aufgaben erhalten.

---

# 33. Verbindlicher Analyseauftrag

Der KI wird sinngemäß folgender Auftrag erteilt:

```text
Du bist der Heizungsoptimierungsberater der
NIBE Performance Suite.

Analysiere ausschließlich die Daten aus dem
NPS-AI-AnalysisPayload.

Erfinde keine fehlenden Werte.

Prüfe zuerst Datenqualität und Evidence.

Unterscheide zwischen:

- falscher Heizkurvenhöhe,
- falscher Heizkurvensteigung,
- falscher Parallelverschiebung,
- Vorlaufregelungsproblem,
- einzelnen problematischen Räumen,
- Sensorproblemen,
- Zusatzheizungseinfluss,
- unzureichender Datenbasis.

Eine Änderung der Heizkurve darf nur empfohlen werden,
wenn die Daten über unterschiedliche gültige
Außentemperaturbereiche ausreichend belastbar sind.

Einzelne kalte oder warme Räume rechtfertigen keine
globale Heizkurvenänderung.

Bei einem relevanten FlowTrackingProblem darf
nicht primär die Heizkurve verändert werden.

Bevorzuge kleine Änderungen.

Empfehle normalerweise nur eine wesentliche Änderung
pro Optimierungszyklus.

Gib ausschließlich ein gültiges
NPS-AI-RecommendationPayload zurück.
```

---

# 34. NPS-AI-RecommendationPayload v1.0

Eine KI-Empfehlung wird ausschließlich in einem standardisierten JSON-Format akzeptiert.

Grundstruktur:

```json
{
  "schema": "NPS-AI-RecommendationPayload",
  "schemaVersion": "1.0",

  "analysisReference": {
    "analysisGeneratedAt": null,
    "analysisSchemaVersion": "1.1",
    "configurationSignature": null
  },

  "analysisValid": true,
  "confidence": 0.88,

  "assessment": {
    "overallState": "OPTIMIZATION_RECOMMENDED",
    "primaryFinding": "HEATING_CURVE_TOO_STEEP"
  },

  "recommendation": {
    "action": "CHANGE_PARAMETER",
    "parameter": "heatingCurve",
    "currentValue": 7,
    "recommendedValue": 6,
    "change": -1
  },

  "secondaryRecommendation": null,

  "reasonCodes": [],

  "explanation": "",

  "observation": {
    "recommendedObservationHours": 72
  }
}
```

---

# 35. analysisReference

Die Empfehlung muss auf den verwendeten AnalysisPayload referenzieren.

Mindestens:

```text
analysisGeneratedAt
analysisSchemaVersion
configurationSignature
```

Dadurch kann verhindert werden, dass eine alte KI-Antwort auf eine zwischenzeitlich veränderte Anlagenkonfiguration angewendet wird.

---

# 36. Zulässige actions

Ausschließlich folgende Werte sind erlaubt:

```text
NO_CHANGE
CHANGE_PARAMETER
INVESTIGATE
INSUFFICIENT_DATA
```

Alle anderen Werte führen zu:

```text
RecommendationValid = false
```

---

# 37. Bedeutung der actions

## NO_CHANGE

Keine Parameteränderung wird empfohlen.

## CHANGE_PARAMETER

Eine konkrete Änderung eines freigegebenen Anlagenparameters wird vorgeschlagen.

## INVESTIGATE

Die Daten weisen auf ein Problem hin, das zunächst untersucht werden soll.

Beispiele:

```text
FLOW_TRACKING_PROBLEM
ROOM_IMBALANCE
SENSOR_PROBLEM
ADDITIONAL_HEAT_INFLUENCE
```

## INSUFFICIENT_DATA

Eine fachlich belastbare Bewertung ist nicht möglich.

---

# 38. overallState

Zulässige Grundwerte:

```text
SYSTEM_OK
OPTIMIZATION_RECOMMENDED
INVESTIGATION_REQUIRED
INSUFFICIENT_DATA
INCONCLUSIVE
```

---

# 39. primaryFinding

Zunächst zulässige Werte:

```text
SYSTEM_OK

HEATING_CURVE_TOO_HIGH
HEATING_CURVE_TOO_LOW
HEATING_CURVE_TOO_STEEP
HEATING_CURVE_TOO_FLAT

CURVE_OFFSET_TOO_HIGH
CURVE_OFFSET_TOO_LOW

FLOW_TRACKING_PROBLEM
ROOM_IMBALANCE
SENSOR_PROBLEM
ADDITIONAL_HEAT_INFLUENCE

INSUFFICIENT_DATA
INCONCLUSIVE
```

Die Liste ist versioniert erweiterbar.

---

# 40. Zulässige Änderungsparameter

Für v0.2.0 werden zunächst nur freigegeben:

```text
heatingCurve
heatingCurveOffset
```

Andere Anlagenparameter dürfen von einer KI zwar als Untersuchungsgegenstand erwähnt, aber nicht als `CHANGE_PARAMETER` ausgegeben werden.

Eine spätere Erweiterung benötigt eine neue technische Freigabe.

---

# 41. Änderungsgrenzen

## 41.1 heatingCurve

Maximale Änderung je Optimierungszyklus:

```text
±1
```

## 41.2 heatingCurveOffset

Maximale Änderung je Optimierungszyklus:

```text
±1 K
```

Größere KI-Empfehlungen werden vom Validator abgelehnt.

---

# 42. Nur eine wesentliche Änderung

Für v0.2.0 gilt:

> Pro Optimierungszyklus wird maximal eine wesentliche Parameteränderung freigegeben.

Eine KI darf eine sekundäre Empfehlung liefern.

Diese wird jedoch nicht gleichzeitig als zweite Änderung freigegeben.

---

# 43. Confidence

Zulässiger Wertebereich:

```text
0.00 ... 1.00
```

Interpretation:

```text
< 0.60
nicht ausreichend

0.60 ... 0.74
unsicher

0.75 ... 0.89
gute Evidenz

>= 0.90
sehr gute Evidenz
```

---

# 44. Mindest-Confidence für Änderung

Für:

```text
CHANGE_PARAMETER
```

muss gelten:

```text
confidence >= 0.75
```

Unterhalb dieses Wertes:

```text
ChangeAllowed = false
```

Eine Analyse kann dennoch gültig sein.

---

# 45. Recommendation-Datenpunkte

Neu anzulegen:

```text
AI.RecommendationPayload
AI.RecommendationReceivedAt
AI.RecommendationValid
```

Datentypen:

```text
RecommendationPayload
type: string
role: json

RecommendationReceivedAt
type: string
role: date

RecommendationValid
type: boolean
role: indicator
```

---

# 46. Aufnahme einer Empfehlung

Die RecommendationPayload wird zunächst manuell oder durch eine spätere externe Connector-Komponente in den Datenpunkt geschrieben.

Modul 15 führt keinen API-Aufruf aus.

---

# 47. NPS Validator

Nach Eingang einer RecommendationPayload wird diese durch den NPS Validator geprüft.

Der Validator ist autoritativ.

---

# 48. Validator-Prüfschritte

Mindestens folgende Prüfungen sind durchzuführen:

```text
JSON syntaktisch gültig?

schema korrekt?

schemaVersion unterstützt?

analysisReference vorhanden?

referenzierter AnalysisPayload noch aktuell?

ConfigurationSignature identisch?

analysisValid plausibel?

confidence gültig?

overallState zulässig?

primaryFinding zulässig?

action zulässig?

parameter zulässig?

currentValue entspricht aktueller NPS-Konfiguration?

recommendedValue plausibel?

change rechnerisch korrekt?

Änderungsgrenze eingehalten?

Datenqualität ausreichend?

Evidence widerspruchsfrei?

letzte Änderung ausreichend lange beobachtet?
```

---

# 49. RecommendationValid

`RecommendationValid == true` bedeutet:

> Die empfangene KI-Antwort entspricht syntaktisch und fachlich dem NPS-Standard.

Es bedeutet noch nicht:

> Eine Anlagenänderung darf durchgeführt werden.

---

# 50. Validation-Datenpunkte

Neu:

```text
AI.Validation.Valid
AI.Validation.Status
AI.Validation.Reason
AI.Validation.ChangeAllowed
```

Optional zusätzlich:

```text
AI.Validation.ReasonsJson
```

für mehrere gleichzeitige Sperrgründe.

---

# 51. Validation.Valid

Entspricht der technischen und semantischen Gültigkeit der RecommendationPayload.

Beispiele für `false`:

```text
INVALID_JSON
INVALID_SCHEMA
UNSUPPORTED_SCHEMA_VERSION
UNKNOWN_ACTION
UNKNOWN_FINDING
UNKNOWN_PARAMETER
STALE_ANALYSIS
CONFIGURATION_MISMATCH
INVALID_VALUE
CHANGE_LIMIT_EXCEEDED
```

---

# 52. ChangeAllowed

`ChangeAllowed` wird ausschließlich von NPS ermittelt.

Eine KI kann diesen Wert nicht setzen.

`ChangeAllowed == true` bedeutet:

> Die konkrete empfohlene Parameteränderung erfüllt zum aktuellen Zeitpunkt alle NPS-Freigaberegeln.

---

# 53. Voraussetzungen ChangeAllowed

Für `true` müssen mindestens gelten:

```text
RecommendationValid == true

action == CHANGE_PARAMETER

confidence >= 0.75

AI.Ready == true

ConfigurationSignature stimmt überein

currentValue stimmt mit aktuellem NPS-Wert überein

Parameter freigegeben

Änderungsgrenze eingehalten

kein harter fachlicher Sperrgrund

ausreichender Beobachtungszeitraum seit letzter Änderung
```

---

# 54. Harte Sperrgründe

Für eine konkrete Heizkurvenänderung gilt:

```text
InsufficientData == true
    -> ChangeAllowed = false

SensorMismatch.value == true
    -> ChangeAllowed = false

FlowTrackingProblem.value == true
    -> ChangeAllowed = false

AdditionalHeatInfluence == true
    -> ChangeAllowed = false

AI.Ready == false
    -> ChangeAllowed = false

ConfigurationSignature nicht identisch
    -> ChangeAllowed = false
```

---

# 55. RoomImbalance

`RoomImbalance == true` führt nicht zwingend zu einer vollständig ungültigen Analyse.

Für eine globale Heizkurvenänderung gilt jedoch grundsätzlich:

```text
RoomImbalance == true
    -> besondere Prüfung erforderlich
```

Wenn die globale Temperaturabweichung nicht eindeutig belegt ist:

```text
ChangeAllowed = false
```

und bevorzugt:

```text
INVESTIGATE
```

---

# 56. OutdoorDependence als Heizkurvenbeleg

Eine Änderung der Heizkurvensteigung darf nur freigegeben werden, wenn mindestens zwei gültige OutdoorBins vorhanden sind.

Für belastbarere Steigungsbewertungen sind drei oder mehr gültige Bins zu bevorzugen.

---

# 57. HEATING_CURVE_TOO_STEEP

Typischer fachlicher Zusammenhang:

```text
wärmere Außentemperaturbereiche:
eher zu kalt

kältere Außentemperaturbereiche:
eher zu warm
```

Eine Empfehlung muss mit den tatsächlichen OutdoorBin-Daten vereinbar sein.

---

# 58. HEATING_CURVE_TOO_FLAT

Typischer fachlicher Zusammenhang:

```text
wärmere Außentemperaturbereiche:
Soll weitgehend erreicht

kältere Außentemperaturbereiche:
zunehmend zu kalt
```

Auch hier müssen mehrere gültige OutdoorBins vorliegen.

---

# 59. CURVE_OFFSET

Eine Parallelverschiebung ist eher plausibel, wenn die Raumabweichung über mehrere Außentemperaturbereiche in dieselbe Richtung zeigt.

Beispiel:

```text
alle verwertbaren Bereiche überwiegend zu kalt
```

kann:

```text
CURVE_OFFSET_TOO_LOW
```

stützen.

---

# 60. FlowTracking-Schutz

Wenn der Vorlauf-Sollwert nicht ausreichend erreicht wird, darf die Heizkurve nicht als primäre Ursache behandelt werden.

Bei:

```text
FlowTrackingProblem == true
```

soll die Empfehlung bevorzugt lauten:

```text
INVESTIGATE
```

mit:

```text
FLOW_TRACKING_PROBLEM
```

---

# 61. SensorMismatch-Schutz

Bei erkanntem SensorMismatch darf keine globale Heizkurvenänderung freigegeben werden.

Ziel:

```text
INVESTIGATE
SENSOR_PROBLEM
```

---

# 62. AdditionalHeatInfluence-Schutz

Bei erheblichem Zusatzheizungseinfluss darf keine Heizkurvenänderung freigegeben werden.

Ziel:

```text
INVESTIGATE
ADDITIONAL_HEAT_INFLUENCE
```

---

# 63. Beobachtungszeit nach Änderung

Standard:

```text
72 Stunden
```

Die tatsächliche relevante Größe bleibt jedoch:

```text
currentConfigurationValidHeatingHours
```

Eine reine Kalenderzeit ohne ausreichende Heizstunden genügt nicht.

---

# 64. Mindestdaten nach Konfigurationsänderung

Bevor eine neue konkrete Änderung freigegeben werden kann, muss die aktuelle ConfigurationSignature ausreichend Heizdaten besitzen.

Mindestens gilt weiterhin:

```text
8 gültige Heizstunden
```

Für eine hochwertige KI-Empfehlung sind deutlich mehr gültige Heizstunden erwünscht.

---

# 65. NPS-AI-OptimizationRecord v1.0

Jede tatsächlich angenommene Änderung wird als OptimizationRecord dokumentiert.

Grundstruktur:

```json
{
  "schema": "NPS-AI-OptimizationRecord",
  "schemaVersion": "1.0",

  "timestamp": "2026-11-14T10:15:00+01:00",

  "analysisReference": {
    "generatedAt": null,
    "configurationSignature": null
  },

  "recommendation": {
    "parameter": "heatingCurve",
    "oldValue": 7,
    "newValue": 6
  },

  "accepted": true,

  "before": {
    "medianRoomDeviationK": null,
    "tooColdRatioPercent": null,
    "okRatioPercent": null,
    "tooWarmRatioPercent": null,
    "averageFlowDeviationK": null
  },

  "after": null,

  "evaluation": "NOT_EVALUATED"
}
```

---

# 66. Erfassung einer tatsächlichen Änderung

Da v0.2.0 die NIBE-Konfiguration nicht automatisch schreibt, muss die tatsächliche Umsetzung einer Empfehlung separat bestätigt bzw. erkannt werden.

Eine bloße KI-Empfehlung erzeugt noch keinen abgeschlossenen OptimizationRecord.

---

# 67. accepted

Mögliche Werte:

```text
true
false
```

`true` bedeutet:

> Die vorgeschlagene Änderung wurde tatsächlich übernommen.

`false` bedeutet:

> Die Empfehlung wurde verworfen oder nicht umgesetzt.

---

# 68. before

Beim Beginn eines Optimierungszyklus werden die relevanten Vorher-Kennzahlen eingefroren.

Mindestens:

```text
medianRoomDeviationK
tooColdRatioPercent
okRatioPercent
tooWarmRatioPercent
averageFlowDeviationK
```

Optional können weitere Kennzahlen ergänzt werden.

---

# 69. after

Nach ausreichender Beobachtungszeit werden dieselben Kennzahlen für die neue Konfiguration ermittelt.

---

# 70. Evaluation

Zulässige Werte:

```text
IMPROVED
UNCHANGED
WORSENED
INCONCLUSIVE
NOT_EVALUATED
```

---

# 71. Evaluation – Grundprinzip

Die Bewertung einer Änderung wird nicht ausschließlich aus einem einzelnen Messwert abgeleitet.

Sie soll mindestens berücksichtigen:

```text
MedianRoomDeviation

TooColdRatio

OKRatio

TooWarmRatio

FlowTracking

Datenqualität

vergleichbare Betriebsbedingungen
```

---

# 72. Evaluation IMROVED

`IMPROVED` ist nur zulässig, wenn die neue Konfiguration bei ausreichender Datenqualität eine erkennbare Verbesserung der globalen Raumtemperaturerreichung zeigt und keine wesentliche neue Verschlechterung entstanden ist.

---

# 73. Evaluation WORSENED

`WORSENED` ist zu setzen, wenn die Änderung die globale Temperaturerreichung erkennbar verschlechtert oder neue relevante negative Evidence erzeugt.

---

# 74. Evaluation INCONCLUSIVE

Zu verwenden bei:

```text
zu wenig Heizstunden
nicht vergleichbaren Außentemperaturen
Sensorproblemen
starkem Zusatzheizungseinfluss
anderen wesentlichen Störeinflüssen
```

---

# 75. Optimization-Datenpunkte

Neu:

```text
AI.Optimization.LastRecord
AI.Optimization.LastChangeAt
AI.Optimization.Evaluation
```

Optional:

```text
AI.Optimization.Pending
AI.Optimization.PendingSince
```

---

# 76. Datenpunktstruktur AI – Zielstand

```text
AI
├── AnalysisPayload
├── PayloadVersion
├── GeneratedAt
├── Ready
│
├── RecommendationPayload
├── RecommendationReceivedAt
├── RecommendationValid
│
├── Validation
│   ├── Valid
│   ├── Status
│   ├── Reason
│   ├── ReasonsJson
│   └── ChangeAllowed
│
└── Optimization
    ├── LastRecord
    ├── LastChangeAt
    ├── Evaluation
    ├── Pending
    └── PendingSince
```

---

# 77. Keine Änderung bestehender Roots

Der bestehende Root bleibt:

```text
0_userdata.0.NPS.HeatingOptimization
```

Es wird kein paralleler zweiter HeatingCurveAnalyzer-Root eingeführt.

---

# 78. Manuelle Betriebsart v0.2.0

Der primäre Testbetrieb lautet:

```text
1. AI.Ready prüfen

2. AI.AnalysisPayload kopieren

3. standardisierten NPS-Prompt verwenden

4. Payload an beliebige KI übergeben

5. RecommendationPayload erhalten

6. RecommendationPayload in NPS übernehmen

7. Validator ausführen

8. RecommendationValid prüfen

9. ChangeAllowed prüfen

10. Empfehlung in Jarvis darstellen

11. Benutzer entscheidet

12. Änderung gegebenenfalls manuell an NIBE durchführen

13. Optimierungsänderung dokumentieren

14. neue Konfiguration beobachten

15. Wirkung evaluieren
```

---

# 79. Anbieterunabhängigkeit

Der AnalysisPayload darf keine anbieterbezogenen Felder enthalten.

Nicht zulässig:

```text
openai
chatgpt
claude
gemini
anthropic
googleAI
```

als technische Voraussetzung des Payload-Schemas.

---

# 80. Vergleich mehrerer KI-Systeme

Der Standard ermöglicht, denselben AnalysisPayload mehreren KI-Systemen vorzulegen.

Dadurch können Empfehlungen verglichen werden.

NPS behandelt jede RecommendationPayload nach denselben Validatorregeln.

---

# 81. Externe KI darf NPS nicht umgehen

Auch wenn eine KI beispielsweise empfiehlt:

```text
heatingCurve 7 -> 4
```

gilt weiterhin die NPS-Grenze:

```text
maximal -1 pro Zyklus
```

Folge:

```text
RecommendationValid = false
oder
ChangeAllowed = false
```

je nach Art des Verstoßes.

---

# 82. Validierung alter Empfehlungen

Wenn sich seit Erzeugung des AnalysisPayload die ConfigurationSignature geändert hat:

```text
ChangeAllowed = false
```

Status:

```text
STALE_ANALYSIS
```

Die Empfehlung muss neu erzeugt werden.

---

# 83. Änderung des aktuellen Wertes

Wenn eine Empfehlung beispielsweise basiert auf:

```text
heatingCurve currentValue = 7
```

NPS inzwischen aber liest:

```text
heatingCurve = 6
```

gilt:

```text
CONFIGURATION_MISMATCH
ChangeAllowed = false
```

---

# 84. JSON-Fehler

Ungültiges JSON darf niemals zum Script-Abbruch führen.

Bei Parse-Fehler:

```text
RecommendationValid = false
Validation.Valid = false
Validation.Status = INVALID_JSON
ChangeAllowed = false
```

Der Fehler wird diagnostisch protokolliert.

---

# 85. Fehlende Pflichtfelder

Fehlende Pflichtfelder führen zu:

```text
INVALID_SCHEMA
```

oder einem präziseren Validatorstatus.

---

# 86. Unbekannte Schema-Version

Bei nicht unterstützter Version:

```text
UNSUPPORTED_SCHEMA_VERSION
```

Keine automatische Interpretation einer zukünftigen Schema-Version.

---

# 87. Sicherheit gegen Freitext

Der Validator wertet ausschließlich die strukturierten Felder des RecommendationPayload aus.

`explanation` ist rein informativ.

Freitext darf niemals:

* einen Parameter freigeben,
* eine Sperre aufheben,
* einen Confidence-Wert ersetzen,
* `ChangeAllowed` beeinflussen.

---

# 88. Jarvis-Vorbereitung

Die später darzustellenden Kerninformationen sind:

```text
AI bereit?

KI-Empfehlung vorhanden?

Empfehlung gültig?

Änderung zulässig?

Hauptbefund

Confidence

aktueller Wert

empfohlener Wert

Begründung

Sperrgrund

letzte Änderung

Evaluation letzte Änderung
```

Die konkrete Jarvis-Gerätespezifikation ist nicht Bestandteil dieses Dokuments.

---

# 89. Logging

Neue relevante Diagnoseereignisse:

```text
Recommendation empfangen

Recommendation gültig

Recommendation ungültig

ChangeAllowed true/false

Validation-Sperrgrund

OptimizationRecord angelegt

Evaluation durchgeführt
```

Normale gültige Empfehlungen sollen nicht als Warnung oder Fehler geloggt werden.

---

# 90. Fehlerbehandlung

Der bestehende `recordError()`-Mechanismus bleibt erhalten.

Neue Fehlercodes können ergänzt werden:

```text
AI_RECOMMENDATION_INVALID_JSON
AI_RECOMMENDATION_INVALID_SCHEMA
AI_RECOMMENDATION_STALE
AI_RECOMMENDATION_CONFIG_MISMATCH
AI_RECOMMENDATION_CHANGE_LIMIT
AI_OPTIMIZATION_RECORD_INVALID
```

---

# 91. Persistenz

RecommendationPayload und OptimizationRecord müssen Script-Neustarts überstehen.

Die genaue Speicherung darf über reguläre ioBroker-States erfolgen.

Der bestehende SampleBuffer bleibt davon unabhängig.

---

# 92. Historisierung

Für Influx-Historisierung sind nicht alle KI-JSON-Payloads zwingend erforderlich.

Geeignete kompakte States für Historisierung sind insbesondere:

```text
AI.Ready
AI.RecommendationValid
AI.Validation.ChangeAllowed
AI.Optimization.Evaluation
```

Die endgültige Aufnahme in `INFLUX_STATES` wird separat festgelegt.

---

# 93. Startup-Verhalten

Beim Start:

```text
bestehende RecommendationPayload nicht ungeprüft als aktuell übernehmen
```

Der Validator muss erneut feststellen, ob sie noch zur aktuellen ConfigurationSignature und zum aktuellen AnalysisPayload passt.

---

# 94. Änderung der Konfiguration

Bei Änderung der ConfigurationSignature:

```text
bestehende ChangeAllowed-Freigabe sofort ungültig
```

Mindestens:

```text
AI.Validation.ChangeAllowed = false
```

Eine alte RecommendationPayload darf nicht weiter als ausführbare Empfehlung gelten.

---

# 95. Neuer Analysezyklus

Ein neuer Optimierungszyklus beginnt, wenn:

* eine bisherige Änderung abgeschlossen/evaluiert ist,
* ausreichende neue Messdaten vorhanden sind,
* `AI.Ready == true` ist.

---

# 96. Keine automatische Selbstoptimierung in v0.2.0

Folgende Funktion ist ausdrücklich ausgeschlossen:

```text
KI-Empfehlung
    ↓
automatisches setState / Modbus Write
    ↓
NIBE ändert Parameter
```

Dies erfordert eine separate spätere Spezifikation und Sicherheitsfreigabe.

---

# 97. Entwicklungsreihenfolge

Die Implementierung von v0.2.0 erfolgt in folgender Reihenfolge:

```text
T9.1
AnalysisPayload Schema 1.1

T9.2
OutdoorBin Ratios

T9.3
previousOptimization

T9.4
Recommendation-Datenpunkte

T9.5
RecommendationPayload Parser

T9.6
Recommendation Validator

T9.7
ChangeAllowed

T9.8
OptimizationRecord

T9.9
Evaluation-Grundstruktur

T9.10
manueller End-to-End-Test
```

---

# 98. T9.1 – AnalysisPayload 1.1

Umfang:

```text
schema ergänzen
schemaVersion 1.1
analysisPeriodHours ergänzen
plant-Kontext ergänzen
previousOptimization ergänzen
```

Bestehende Payload-Blöcke bleiben erhalten.

---

# 99. T9.2 – OutdoorBin Ratios

Neu zu berechnen:

```text
tooColdRatioPercent
okRatioPercent
tooWarmRatioPercent
```

Keine Änderung der bestehenden Bin-Grenzen.

---

# 100. T9.3 – previousOptimization

Zunächst muss mindestens der letzte tatsächlich angenommene Optimierungsdatensatz im AnalysisPayload verfügbar sein.

---

# 101. T9.4 – Recommendation States

Neue AI-Datenpunkte gemäß Kapitel 45 und 50 anlegen.

---

# 102. T9.5 – Parser

Der Parser übernimmt ausschließlich:

```text
JSON lesen
Syntax prüfen
Grundschema einlesen
```

Er nimmt keine fachliche Freigabe vor.

---

# 103. T9.6 – Validator

Der Validator führt die technischen und fachlichen Prüfungen dieser Spezifikation durch.

---

# 104. T9.7 – ChangeAllowed

`ChangeAllowed` wird als separate Entscheidungsschicht implementiert.

Dies ist eine zentrale Sicherheitsanforderung.

---

# 105. T9.8 – OptimizationRecord

Implementierung der dokumentierten Vorher-/Nachher-Struktur.

---

# 106. T9.9 – Evaluation

In v0.2.0 wird mindestens die technische Struktur geschaffen.

Eine weiter verfeinerte automatische Erfolgsbewertung kann in einer Folgeversion erweitert werden.

---

# 107. T9.10 – manueller End-to-End-Test

Testkette:

```text
echte Heizdaten
    ↓
AnalysisPayload 1.1
    ↓
NPS Prompt 1.0
    ↓
KI
    ↓
RecommendationPayload 1.0
    ↓
NPS Validator
    ↓
ChangeAllowed
```

---

# 108. Mindesttestfälle AnalysisPayload

Zu prüfen:

```text
Payload gültig und Ready

Payload nicht Ready wegen Datenqualität

Payload nicht Ready wegen zu wenig Heizstunden

Payload nach ConfigurationSignature-Wechsel

Payload mit ungültigen OutdoorBins

Payload über Größenlimit
```

---

# 109. Mindesttestfälle Validator

Mindestens:

```text
gültiges NO_CHANGE

gültiges INVESTIGATE

gültiges CHANGE_PARAMETER heatingCurve +1

gültiges CHANGE_PARAMETER heatingCurve -1

Änderung +2 ablehnen

unbekannter Parameter ablehnen

Confidence zu niedrig

ConfigurationSignature falsch

currentValue falsch

alte Recommendation

ungültiges JSON

unbekannte Action

unbekannter Finding
```

---

# 110. Mindesttestfälle Evidence-Sperren

Mindestens:

```text
SensorMismatch -> ChangeAllowed false

FlowTrackingProblem -> ChangeAllowed false

AdditionalHeatInfluence -> ChangeAllowed false

InsufficientData -> ChangeAllowed false
```

---

# 111. Mindesttestfälle RoomImbalance

Zu prüfen:

```text
ein einzelner kalter Raum

mehrere persistente kalte Räume

gleichzeitig kalte und warme Räume

globale Abweichung ohne Imbalance

globale Abweichung mit Imbalance
```

---

# 112. Mindesttestfälle OutdoorDependence

Zu prüfen:

```text
nur ein gültiger Bin
-> keine Steigungsänderung

zwei gültige Bins
-> minimale Steigungsbewertung möglich

mehrere gültige Bins
-> belastbarere Bewertung

mild kalt / außen kalt warm
-> TOO_STEEP plausibel

mild OK / außen kalt zu kalt
-> TOO_FLAT plausibel
```

---

# 113. Release-Kriterien v0.2.0

v0.2.0 darf erst als STABLE freigegeben werden, wenn:

```text
bestehende v0.1.1-Funktionalität regressionsfrei

AnalysisPayload 1.1 schema-konform

OutdoorBin Ratios korrekt

RecommendationPayload Parser robust

Validator vollständig

ChangeAllowed deterministisch

OptimizationRecord persistent

manueller End-to-End-Test erfolgreich

keine automatische NIBE-Änderung vorhanden
```

---

# 114. Versionsregeln

Änderungen am Format von:

```text
NPS-AI-AnalysisPayload
NPS-AI-RecommendationPayload
NPS-AI-OptimizationRecord
```

erfordern eine Änderung der jeweiligen `schemaVersion`, wenn die Kompatibilität nicht vollständig erhalten bleibt.

---

# 115. Technischer Zielstatus

Nach Fertigstellung von v0.2.0 lautet der Zustand:

```text
NPS sammelt und bewertet Heizungsdaten.

NPS erzeugt einen standardisierten KI-Payload.

Eine beliebige KI kann daraus eine strukturierte
Empfehlung erzeugen.

NPS prüft diese Empfehlung unabhängig.

NPS entscheidet technisch, ob eine konkrete Änderung
überhaupt zulässig wäre.

Der Benutzer entscheidet weiterhin selbst,
ob die Änderung umgesetzt wird.

NPS dokumentiert die Änderung und kann deren
spätere Wirkung bewerten.
```

---

# 116. Sicherheitsstatus

Auch mit v0.2.0 bleibt Modul 15 ein:

```text
analysierender
beratender
validierender
dokumentierender
```

Baustein.

Es bleibt ausdrücklich kein autonomer Heizungsregler.

---

# 117. Freigabevermerk

Diese Spezifikation definiert den Entwicklungszielstand:

```text
15_NPS_HeatingCurveAnalyzer v0.2.0
```

für den manuellen, anbieterunabhängigen KI-Berater der NIBE Performance Suite 1.1.

Bezugsbasis bleibt:

```text
15_NPS_HeatingCurveAnalyzer v0.1.1
STABLE
```

Die bestehende v0.1.1-Logik wird nur dort verändert, wo dies in dieser Spezifikation ausdrücklich festgelegt ist.

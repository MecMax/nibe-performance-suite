# Anwenderspezifikation – 15_NPS_HeatingCurveAnalyzer v0.1.1

**NIBE Performance Suite (NPS) · Modul 15**
**Stand:** 24.08.2026
**Bezugsstand:** `15_NPS_HeatingCurveAnalyzer v0.1.1`
**Status:** STABLE – Release 0.1.1
**NPS-Zielversion:** 1.1

## 1. Zweck

Der `15_NPS_HeatingCurveAnalyzer` sammelt, normalisiert, bewertet und verdichtet alle für eine spätere Heizkurvenanalyse relevanten Betriebs- und Raumdaten.

Das Modul dient der Vorbereitung einer fachlich belastbaren Bewertung von:

- Heizkurve,
- Heizkurvenverschiebung,
- Vorlauf Soll / Ist,
- Rücklauf und Delta-T,
- Gradminuten,
- Verdichterbetrieb,
- Zusatzheizung,
- Außentemperatur,
- Raumtemperaturen,
- Solltemperaturen,
- Heizperioden,
- Fensterzuständen,
- Raum-Overrides,
- Datenqualität,
- zeitlicher Datenbasis,
- späterer KI-Auswertung.

Das Modul nimmt selbst **keine Änderung an der NIBE-Heizungsregelung vor**.

## 2. Sicherheitsprinzip

Das Modul arbeitet ausschließlich lesend auf den Anlagenquellen.

Verbindlich gilt:

```text
keine Änderung von NIBE-Parametern
keine Änderung der heatingcontrol-Konfiguration
keine externe KI-Kommunikation
kein direkter MQTT-Zugriff
```

Die erzeugten Analysewerte sind Diagnose- und Entscheidungsgrundlagen.

## 3. Datenquellen

### 3.1 NIBE-Konfiguration

Das Modul liest unter anderem:

- Heizkurve,
- Heizkurvenverschiebung,
- minimale Vorlauftemperatur,
- maximale Vorlauftemperatur,
- sieben Punkte einer eigenen Heizkurve,
- Punktverschiebung Außentemperatur,
- Punktverschiebung,
- Heizungsstart-Untertemperatur,
- Heizungs-Stopp-Temperatur,
- Zusatzheizungs-Stopp-Temperatur,
- Automatikmodus-Filterzeit,
- maximale Vorlaufdifferenz Verdichter,
- Betriebsmodus,
- Heizung Automatik.

Alle NIBE-Zugriffe erfolgen über Alias-Datenpunkte.

### 3.2 NIBE-Betriebsdaten

Für die laufende Analyse werden insbesondere verwendet:

- Außentemperatur,
- Außentemperatur BT28,
- berechneter Vorlauf,
- tatsächlicher Vorlauf,
- Rücklauf,
- Gradminuten,
- Verdichterfrequenz,
- Verdichterstatus,
- Verdichterbedarf,
- Betriebspriorität,
- Volumenstrom,
- Enteisungsstatus,
- Zusatzheizungsleistung,
- Zusatzheizungsmodus,
- erzeugte Wärmeleistung,
- elektrische Leistung.

### 3.3 heatingcontrol

Es werden zwei heatingcontrol-Instanzen berücksichtigt:

```text
heatingcontrol.0
Wohnung EG + Keller + Treppenhaus

heatingcontrol.1
Wohnung OG + Dachgeschoss
```

Je Instanz werden Heizperiode und Wartungsmodus ausgewertet.

Je Raum werden verwendet:

- `CurrentTimePeriodTemperature`,
- `CurrentTarget`,
- `State`,
- `WindowIsOpen`,
- `isActive`,
- `TemperaturOverride`,
- `TemperaturOverrideRemainingTime`.

## 4. Räume

Das Modul enthält 13 konfigurierte Räume:

1. EG Küche
2. EG Wohnzimmer
3. EG Badezimmer
4. EG Toilette
5. EG Kinderzimmer
6. EG Schlafzimmer
7. TH Erdgeschoss
8. OG Küche
9. OG Wohnzimmer
10. OG Badezimmer
11. OG Kinderzimmer
12. OG Schlafzimmer
13. DG Werkstatt

Wenn ein separater Raumfühler vorhanden ist, hat dieser Vorrang.

Ist kein gültiger Raumfühler vorhanden, wird auf Thermostattemperaturen zurückgegriffen:

```text
1 gültiger Thermostatwert  -> Thermostattemperatur
mehrere gültige Werte      -> Mittelwert der Thermostattemperaturen
```

## 5. Komfortbewertung

Als Komfortband wird verwendet:

```text
±0,5 K
```

Die Raumabweichung wird berechnet als:

```text
Ist-Raumtemperatur - Zeitplan-Solltemperatur
```

Klassifikation:

```text
Abweichung < -0,5 K  -> TOO_COLD
-0,5 K bis +0,5 K    -> OK
Abweichung > +0,5 K  -> TOO_WARM
```

## 6. Gültigkeit eines Raums

Ein Raum ist datenmäßig gültig, wenn:

- der Raum aktiv ist,
- eine plausible Isttemperatur vorhanden ist,
- eine plausible Zeitplan-Solltemperatur vorhanden ist.

Für die Heizkurvenanalyse gelten zusätzlich:

- Heizperiode der zugehörigen heatingcontrol-Instanz ist aktiv,
- Maintenance ist nicht aktiv,
- Fenster ist geschlossen,
- kein Temperatur-Override ist aktiv.

Nur dann wird `validForHeatingCurve = true`.

## 7. Gültigkeit eines Messpunkts

Ein 5-Minuten-Messpunkt ist nur für die Heizkurvenanalyse gültig, wenn unter anderem:

- NIBE-Pflichtdaten plausibel sind,
- Betriebspriorität `30` (Heizen) aktiv ist,
- Verdichter aktiv ist,
- keine Enteisung aktiv ist,
- Volumenstrom größer 0 ist,
- mindestens eine heatingcontrol-Heizperiode aktiv ist,
- mindestens 3 Räume gültig sind,
- mindestens 50 % der aktiven Räume für die Heizkurvenanalyse gültig sind.

Ausschlussgründe werden unter:

```text
Current.ExcludeReasonsJson
```

bereitgestellt.

## 8. Sample-Qualität

Jeder aktuelle Messpunkt erhält eine Qualitätsbewertung von 0 bis 100 %.

Die Bewertung berücksichtigt:

- NIBE-Pflichtdaten,
- Anteil gültiger Räume,
- Zusatzheizung,
- Plausibilität der beiden Außensensoren,
- sonstige Pflichtdatenwarnungen.

Der Wert steht unter:

```text
Current.SampleQuality
```

## 9. 5-Minuten-Betrieb

Das Modul läuft dauerhaft und erzeugt reguläre Samples im Raster:

```text
*/5 * * * *
```

also alle 5 Minuten.

Die Zeitstempel werden auf das 5-Minuten-Raster normalisiert.

Ein paralleler zweiter Lauf wird verhindert.

## 10. Ringpuffer

Die Messpunkte werden in einem internen Ringpuffer gespeichert.

Eigenschaften:

```text
Pufferdauer: 7 Tage
Sample-Raster: 5 Minuten
BufferVersion: 1.0
```

Doppelte Zeitstempel werden verworfen.

Beim Neustart wird der vorhandene Puffer geladen und weiterverwendet.

## 11. Analysefenster

Das Modul berechnet vier Analysefenster:

| Fenster | Zeitraum | Mindest-Heizstunden |
|---|---:|---:|
| `Window6h` | 6 h | 2 h |
| `Window24h` | 24 h | 4 h |
| `Window72h` | 72 h | 8 h |
| `Window7d` | 168 h | 12 h |

Die Auswertung erfolgt jeweils nur für die aktuell gültige `ConfigurationSignature`.

## 12. Ausgewertete Kennzahlen

Je Analysefenster werden unter anderem berechnet:

- gültige Sampleanzahl,
- gültige Heizstunden,
- Außentemperatur Mittel/Min/Max,
- Vorlauf Soll Mittel,
- Vorlauf Ist Mittel,
- Vorlaufabweichung Mittel,
- Rücklauf Mittel,
- Delta-T Mittel,
- Gradminuten Mittel/Min/Max,
- Verdichterfrequenz Mittel,
- Verdichterlaufzeit,
- Zusatzheizungsanteil,
- mittlere und mediane Raumabweichung,
- Min/Max Raumabweichung,
- Standardabweichung,
- Spannweite,
- Anteil zu kalter Räume,
- Anteil komfortabler Räume,
- Anteil zu warmer Räume,
- Fenster-Datenqualität.

## 13. Außentemperatur-Bins

Für die letzten 7 Tage werden gültige Heizsamples in fünf Außentemperaturbereiche aufgeteilt:

```text
> +10 °C
+5 bis +10 °C
0 bis +5 °C
-5 bis 0 °C
< -5 °C
```

Ein Bin wird ab mindestens 3 gültigen Heizstunden als gültig bewertet.

## 14. Persistente Raumabweichungen

Über 72 Stunden werden dauerhaft auffällige Räume erkannt.

Mindestbasis:

```text
6 gültige Heizstunden
```

Ein Raum gilt als persistent zu kalt oder zu warm, wenn:

- seine mittlere Abweichung außerhalb des Komfortbands liegt und
- mindestens 60 % seiner gültigen Beobachtungen dieselbe Richtung zeigen.

Ausgabe:

```text
Analysis.PersistentColdRoomsJson
Analysis.PersistentWarmRoomsJson
```

## 15. Evidence

Das Modul erzeugt einen standardisierten Evidence-Block.

Bewertet werden:

- `GlobalTooCold`,
- `GlobalTooWarm`,
- `OutdoorDependentDeviation`,
- `RoomImbalance`,
- `FlowTrackingProblem`,
- `AdditionalHeatInfluence`,
- `SensorMismatch`,
- `InsufficientData`.

Mehrere Evidenzen enthalten zusätzlich einen Confidence-Wert.

## 16. Globale Datenqualität

Die globale Datenqualität berücksichtigt:

- Vollständigkeit der Required Sources,
- Qualität der Heizsamples,
- Raumabdeckung,
- zeitliche Abdeckung.

Statuswerte:

```text
EXCELLENT
GOOD
LIMITED
INSUFFICIENT
```

Fehlt mindestens eine Required Source, wird der Status zwingend auf:

```text
INSUFFICIENT
```

begrenzt.

## 17. SourceCheck

Ab Version 0.1.1 wird der SourceCheck bei **jedem** 5-Minuten-Lauf erneut erzeugt.

Dadurch bleiben folgende Datenpunkte aktuell:

```text
Status.SourceCheckOk
Status.SourceCheckJson
```

Fehlende Required Sources führen zu:

```text
Status.Valid = false
```

Sobald die Quellen wieder vorhanden sind, kann sich der Analyzer ohne Neustart automatisch erholen.

## 18. AI.AnalysisPayload

Das Modul erzeugt einen standardisierten JSON-Payload:

```text
0_userdata.0.NPS.HeatingOptimization.AI.AnalysisPayload
```

Payload-Version:

```text
1.0
```

Der Payload enthält:

- Analyzer-Version,
- Erstellzeitpunkt,
- Ready-Status,
- Systeminformationen,
- aktuelle NIBE-Konfiguration,
- Current-Werte,
- Raumübersicht,
- Raumdetails,
- Analysefenster,
- Außentemperatur-Bins,
- persistente Räume,
- Evidence,
- Datenqualität.

Es erfolgt **keine externe KI-Kommunikation**.

Der Payload dient ausschließlich als standardisierte lokale Schnittstelle.

## 19. AI.Ready

`AI.Ready` wird nur dann `true`, wenn ausreichend Daten vorhanden sind.

Insbesondere gilt:

- `InsufficientData = false`,
- 72h-Fenster gültig,
- globale Datenqualität mindestens 75 %.

## 20. Größenlimit des KI-Payloads

Maximale Größe:

```text
65.536 Bytes
```

Bei Überschreitung wird der Payload stufenweise reduziert:

1. Thermostatdetails entfernen,
2. ungültige Raumdetails entfernen,
3. ungültige Outdoor-Bins reduzieren.

Falls das Limit weiterhin überschritten wird:

```text
AI.Ready = false
PAYLOAD_TOO_LARGE
```

## 21. Haupt-Datenpunktstruktur

Root:

```text
0_userdata.0.NPS.HeatingOptimization
```

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

## 22. Statusdatenpunkte

Wichtige Zustände:

```text
Status.Version
Status.Active
Status.Valid
Status.LastCalculation
Status.LastSample
Status.SourceCheckOk
Status.SourceCheckJson
Status.DataQualityPercent
Status.DataQualityState
Status.ErrorCount
Status.LastError
```

## 23. Interpretation

Der Analyzer ist in Version 0.1.1 ein **Mess-, Qualitäts- und Analysemodul**.

Er trifft keine automatische Stellentscheidung und verändert keine Heizkurvenparameter.

Die Ergebnisse sollen später dazu dienen, fachlich nachvollziehbar zu beurteilen, ob beispielsweise:

- die gesamte Anlage zu warm oder zu kalt läuft,
- die Heizkurvensteilheit unpassend ist,
- eine Parallelverschiebung plausibel wäre,
- einzelne Räume hydraulisch oder regelungstechnisch auffällig sind,
- der Vorlauf Soll nicht sauber verfolgt wird,
- Zusatzheizung die Bewertung beeinflusst,
- die Datenbasis für eine Empfehlung ausreichend ist.

## 24. Release 0.1.1

Release 0.1.1 ergänzt gegenüber dem vorherigen RC-Stand insbesondere:

- forcierte 5-Minuten-Schreibvorgänge für definierte Influx-Zeitreihen,
- SourceCheck bei jedem 5-Minuten-Snapshot,
- laufend aktuelle SourceCheck-Statuswerte,
- `Status.Valid=false` bei fehlenden Required Sources,
- automatische Erholung nach Wiederkehr der Required Sources,
- Verwendung des aktuellen SourceChecks für Evidence, DataQuality und AI-Payload.

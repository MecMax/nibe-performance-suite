# Anwenderspezifikation – 05_NPS_DefrostMonitor v1.1.2

**NIBE Performance Suite (NPS) · Modul 05**  
**Stand:** 22.08.2026  
**Bezugsstand:** `05_NPS_DefrostMonitor v1.1.2`  
**Status:** STABIL

## 1. Zweck

Der DefrostMonitor überwacht Enteisungs- bzw. Abtauvorgänge der NIBE-Außeneinheit. Er erkennt Beginn, laufende Dauer und Ende einer Enteisung und stellt daraus verständliche Betriebs- und Verlaufsdaten bereit.

Zusätzlich führt das Modul eine Historie der letzten 20 abgeschlossenen Enteisungen und berechnet Kennzahlen zu Dauer und Abstand zwischen den Enteisungen.

## 2. Abgrenzung

Der DefrostMonitor bewertet nicht die Effizienz der Wärmepumpe und berechnet keine Energieverluste, COP-, JAZ- oder Wirtschaftlichkeitskennzahlen.

Das Modul verändert keine NIBE-Einstellungen. Es dient ausschließlich der Erkennung, Dokumentation und zeitlichen Analyse von Enteisungsvorgängen.

## 3. Erkennung einer Enteisung

Der primäre Eingang ist der NIBE-Enteisungsstatus.

Eine Enteisung gilt als aktiv, wenn der numerische Status den Wert `1` oder `2` besitzt.

Alle anderen numerischen Statuswerte werden als „Enteisung nicht aktiv“ interpretiert.

## 4. Bereitgestellte Werte

| Datenpunkt | Bedeutung | Einheit |
|---|---|---|
| `Defrost.Status` | Technischer NIBE-Enteisungsstatus | – |
| `Defrost.Active` | Zeigt an, ob aktuell enteist wird | Boolean |
| `Defrost.Count` | Anzahl erkannter Enteisungsstarts | – |
| `Defrost.CompletedCount` | Anzahl vollständig abgeschlossener Enteisungen | – |
| `Defrost.CurrentDurationMinutes` | Dauer der aktuell laufenden Enteisung | min |
| `Defrost.LastDurationMinutes` | Dauer der zuletzt abgeschlossenen Enteisung | min |
| `Defrost.TotalDurationMinutes` | Kumulierte Dauer aller abgeschlossenen Enteisungen | min |
| `Defrost.LastStart` | Zeitpunkt des letzten Enteisungsbeginns | Datum/Zeit |
| `Defrost.LastEnd` | Zeitpunkt des letzten Enteisungsendes | Datum/Zeit |
| `Defrost.TimeSinceLastDefrostMinutes` | Zeit seit Ende der letzten Enteisung | min |
| `Defrost.LastIntervalMinutes` | Letzter Abstand zwischen zwei Enteisungen | min |
| `Defrost.AverageDurationMinutes` | Mittlere Dauer abgeschlossener Enteisungen | min |
| `Defrost.AverageIntervalMinutes` | Mittlerer Abstand zwischen Enteisungen | min |
| `Defrost.History` | JSON-Historie der letzten 20 abgeschlossenen Enteisungen | JSON |

## 5. Historie

Die Historie enthält maximal 20 abgeschlossene Enteisungen. Der neueste Eintrag steht an erster Stelle.

Je Eintrag werden gespeichert:

- Startzeit,
- Endzeit,
- Dauer,
- Außentemperatur beim Start,
- Verdichterfrequenz beim Start,
- Abstand zur vorherigen Enteisung.

Die Außentemperatur wird aus dem TemperatureMonitor übernommen. Die Verdichterfrequenz stammt aus dem CompressorMonitor.

## 6. Aktualisierung

Nach erfolgreicher Initialisierung erfolgt eine erste Aktualisierung. Danach wird der Enteisungszustand einmal pro Minute geprüft.

Die laufende Dauer einer aktiven Enteisung wird dabei fortgeschrieben.

## 7. Verhalten bei Neustart

Das Modul verwendet persistente Memory-States. Dadurch bleiben erkannte Zustände auch bei einem Neustart des JavaScript-Skripts erhalten.

Eine bereits laufende Enteisung kann damit nach einem Neustart weiterverfolgt werden.

## 8. Verhalten bei ungültigen Daten

Ist der Enteisungsstatus nicht lesbar:

- wird die Aktualisierung fachlich abgebrochen,
- werden keine Zähler oder Dauern verändert,
- `Diagnostics.ValidInput` wird auf `false` gesetzt,
- `Diagnostics.InvalidUpdates` wird erhöht,
- `System.Status` wechselt auf `WARTET`,
- eine verständliche Diagnosemeldung wird bereitgestellt.

Fehlende optionale Daten wie Außentemperatur oder Verdichterfrequenz verhindern die Erkennung der Enteisung nicht.

## 9. Status und Diagnose

| Datenpunkt | Bedeutung |
|---|---|
| `System.Active` | Zeigt an, ob das Modul aktiv ist |
| `System.Status` | Aktueller Modulzustand |
| `System.LastStart` | Zeitpunkt des letzten Modulstarts |
| `System.LastUpdate` | Zeitpunkt der letzten erfolgreichen Aktualisierung |
| `System.LastMessage` | Letzte verständliche Modulmeldung |
| `System.Version` | Aktive Modulversion |
| `Diagnostics.ValidInput` | Gültigkeit des Enteisungseingangs |
| `Diagnostics.InvalidUpdates` | Anzahl ungültiger Aktualisierungen |
| `Diagnostics.Warning` | Aktuelle Warn- oder Fehlerbeschreibung |
| `Diagnostics.Trace` | Diagnoseprotokoll der letzten Aktualisierung |

## 10. Historisierung und Statistik

Für Modul 05 ist folgende Persistenz festgelegt:

| Datenpunkt | InfluxDB | `changesOnly` | Statistics |
|---|---|---:|---|
| `Defrost.Status` | `influxdb.1` | `true` | nein |
| `Defrost.Active` | `influxdb.1` | `true` | nein |
| `Defrost.TotalDurationMinutes` | nein | – | `statistics.0`, `sumDelta=true` |
| übrige Defrost-States | nein | – | nein |
| Memory-/System-/Diagnostics-States | nein | – | nein |

`Defrost.Active` eignet sich für die Darstellung der Abtauphasen in Zeitdiagrammen. `Defrost.Status` erhält zusätzlich den technischen NIBE-Statusverlauf.

`Defrost.TotalDurationMinutes` ist ein kumulativer Zähler und dient als Basis für periodische Statistics-Auswertungen der Abtaudauer.

## 11. Interpretation

Enteisung ist bei einer Luft/Wasser-Wärmepumpe ein normaler und notwendiger Betriebsprozess.

NPS verwendet deshalb keine pauschale Qualitätsampel für Anzahl oder Dauer der Enteisungen. Entscheidend ist das Muster im Zusammenhang mit Außentemperatur, Verdichterfrequenz und Betriebsbedingungen.

## 12. Freigegebener Objektbaum

```text
DefrostMonitor
├── Defrost
│   ├── Status
│   ├── Active
│   ├── Count
│   ├── CompletedCount
│   ├── CurrentDurationMinutes
│   ├── LastDurationMinutes
│   ├── TotalDurationMinutes
│   ├── LastStart
│   ├── LastEnd
│   ├── TimeSinceLastDefrostMinutes
│   ├── LastIntervalMinutes
│   ├── AverageDurationMinutes
│   ├── AverageIntervalMinutes
│   └── History
├── Memory
│   ├── Initialized
│   ├── ActiveSinceMs
│   ├── WasActive
│   ├── LastEndMs
│   ├── CurrentIntervalMinutes
│   ├── TotalIntervalMinutes
│   ├── IntervalCount
│   ├── StartOutdoorTempC
│   └── StartCompressorFrequencyHz
├── System
│   ├── Version
│   ├── Active
│   ├── LastStart
│   ├── LastUpdate
│   ├── Status
│   └── LastMessage
└── Diagnostics
    ├── ValidInput
    ├── InvalidUpdates
    ├── Warning
    └── Trace
```

## 13. Freigabestatus

Objektbaum, Public API, Persistenz, Statistics-Abgrenzung und Verwendung durch DashboardData wurden geprüft.

**Freigabestatus: PASS**

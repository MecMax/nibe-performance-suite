# Technische Spezifikation – 05_NPS_DefrostMonitor v1.1.2

**NIBE Performance Suite (NPS) · Modul 05**  
**Stand:** 22.08.2026  
**Bezugsstand:** `05_NPS_DefrostMonitor v1.1.2`  
**Build:** 18.08.2026  
**Status:** STABIL

## 1. Modulidentität und Verantwortung

| Merkmal | Festlegung |
|---|---|
| Modul | `05_NPS_DefrostMonitor` |
| Version | `1.1.2` |
| Architektur-Schicht | Ereigniserkennung / Betriebsüberwachung |
| Coding Standard | `NPS-CS-1.0` |
| Root | `0_userdata.0.NPS.DefrostMonitor` |
| Anlage | NIBE S2125-12 + VVM S500 |
| Historienlimit | 20 abgeschlossene Enteisungen |
| Aktualisierung | minütlich |

Der DefrostMonitor ist Single Writer für alle States unter `NPS.DefrostMonitor`.

Seine Verantwortung umfasst die Erkennung von Enteisungsbeginn, laufender Enteisung und Enteisungsende sowie die persistente Verwaltung der dafür benötigten Zustände.

## 2. Eingänge

### 2.1 Primärer Eingang

```text
alias.0.Keller.Waschküche.Waermepumpe.Enteisung
```

Der primäre Eingang ist zwingend erforderlich.

Interpretation:

- Status `1` → Enteisung aktiv
- Status `2` → Enteisung aktiv
- alle anderen numerischen Werte → Enteisung nicht aktiv
- nicht lesbarer/nicht numerischer Wert → ungültiger Eingang

### 2.2 Optionale NPS-Quellen

```text
0_userdata.0.NPS.TemperatureMonitor.Temperatures.Outdoor
0_userdata.0.NPS.CompressorMonitor.Compressor.Frequency
```

Diese Werte werden beim Start einer Enteisung als Kontext für die Historie übernommen.

Fehlen diese Quellen, bleibt die eigentliche Enteisungserkennung funktionsfähig.

## 3. Public API

| State | Typ / Einheit | Funktion |
|---|---|---|
| `Defrost.Status` | number | Technischer Enteisungsstatus |
| `Defrost.Active` | boolean | Aktueller Enteisungszustand |
| `Defrost.Count` | number | Anzahl erkannter Starts |
| `Defrost.CompletedCount` | number | Anzahl abgeschlossener Vorgänge |
| `Defrost.CurrentDurationMinutes` | number / min | Aktuelle Dauer |
| `Defrost.LastDurationMinutes` | number / min | Dauer des letzten Vorgangs |
| `Defrost.TotalDurationMinutes` | number / min | Kumulierte Gesamtdauer |
| `Defrost.LastStart` | string/date | Letzter Start |
| `Defrost.LastEnd` | string/date | Letztes Ende |
| `Defrost.TimeSinceLastDefrostMinutes` | number / min | Zeit seit letzter Enteisung |
| `Defrost.LastIntervalMinutes` | number / min | Letzter Abstand |
| `Defrost.AverageDurationMinutes` | number / min | Mittlere Dauer |
| `Defrost.AverageIntervalMinutes` | number / min | Mittlerer Abstand |
| `Defrost.History` | string/json | Historie der letzten 20 Vorgänge |

## 4. Persistenter Arbeitsspeicher

| State | Funktion |
|---|---|
| `Memory.Initialized` | Kennzeichnet abgeschlossene Initialisierung |
| `Memory.ActiveSinceMs` | Startzeit aktiver Enteisung als Unix-Zeit |
| `Memory.WasActive` | Persistenter vorheriger Aktivzustand |
| `Memory.LastEndMs` | Letztes Enteisungsende als Unix-Zeit |
| `Memory.CurrentIntervalMinutes` | Abstand vor aktueller Enteisung |
| `Memory.TotalIntervalMinutes` | Summe auswertbarer Abstände |
| `Memory.IntervalCount` | Anzahl auswertbarer Abstände |
| `Memory.StartOutdoorTempC` | Außentemperatur beim Start |
| `Memory.StartCompressorFrequencyHz` | Verdichterfrequenz beim Start |

Diese States gehören zur internen Modulzustandsverwaltung und sind keine Public API für Visualisierungen.

## 5. System- und Diagnose-States

| State | Typ | Funktion |
|---|---|---|
| `System.Version` | string | Aktive Modulversion |
| `System.Active` | boolean | Aktivstatus |
| `System.LastStart` | string/date | Letzter Modulstart |
| `System.LastUpdate` | string/date | Letzte erfolgreiche Aktualisierung |
| `System.Status` | string | Modulstatus |
| `System.LastMessage` | string | Letzte Modulmeldung |
| `Diagnostics.ValidInput` | boolean | Gültigkeit des Primäreingangs |
| `Diagnostics.InvalidUpdates` | number | Zähler ungültiger Aktualisierungen |
| `Diagnostics.Warning` | string | Warn-/Fehlertext |
| `Diagnostics.Trace` | string | Trace der letzten Aktualisierung |

## 6. Zustandsmaschine

### 6.1 Initialisierung ohne aktive Enteisung

- `Memory.Initialized=true`
- `Memory.WasActive=false`
- `Memory.ActiveSinceMs=0`
- keine Änderung der Enteisungszähler

### 6.2 Enteisungsbeginn

Übergang:

```text
WasActive=false
Active=true
```

Aktionen:

- `Memory.WasActive=true`
- `Memory.ActiveSinceMs=now`
- `Defrost.LastStart` setzen
- `Defrost.CurrentDurationMinutes=0`
- `Defrost.Count` erhöhen
- optional Außentemperatur und Verdichterfrequenz erfassen
- Abstand zur vorherigen Enteisung berechnen
- bei auswertbarem Abstand Intervallstatistik aktualisieren

### 6.3 Laufende Enteisung

Übergang/Zustand:

```text
WasActive=true
Active=true
```

Aktionen:

- aktuelle Dauer aus `ActiveSinceMs` berechnen
- `Defrost.CurrentDurationMinutes` fortschreiben
- Fallback: fehlendes `ActiveSinceMs` neu setzen

### 6.4 Enteisungsende

Übergang:

```text
WasActive=true
Active=false
```

Aktionen:

- Dauer berechnen
- `Defrost.LastDurationMinutes` setzen
- `Defrost.TotalDurationMinutes` kumulativ erhöhen
- `Defrost.LastEnd` setzen
- `Defrost.CompletedCount` erhöhen
- Historieneintrag erzeugen
- Mittelwerte aktualisieren
- persistente Aktivzustände zurücksetzen

## 7. Berechnungsregeln

### 7.1 Dauer

```text
DurationMin = (EndMs - StartMs) / 60000
```

Ausgabe auf eine Nachkommastelle gerundet.

### 7.2 Abstand zwischen Enteisungen

```text
IntervalMin = (CurrentStartMs - PreviousEndMs) / 60000
```

Nur positive, zeitlich plausible Abstände werden berücksichtigt.

### 7.3 Mittlere Enteisungsdauer

```text
AverageDurationMinutes =
    TotalDurationMinutes / CompletedCount
```

Bei `CompletedCount=0` wird `0` ausgegeben.

### 7.4 Mittlerer Abstand

```text
AverageIntervalMinutes =
    Memory.TotalIntervalMinutes / Memory.IntervalCount
```

Bei `IntervalCount=0` wird `0` ausgegeben.

## 8. Historienformat

`Defrost.History` enthält ein JSON-Array mit maximal 20 Einträgen.

Schema eines Eintrags:

```json
{
  "Start": "TT.MM.JJJJ HH:mm",
  "End": "TT.MM.JJJJ HH:mm",
  "DurationMin": 0.0,
  "OutdoorTempC": 0.0,
  "CompressorFrequencyHz": 0.0,
  "IntervalMin": 0.0
}
```

Der neueste Eintrag steht an Position 0.

Bei Überschreiten von 20 Einträgen werden ältere Einträge entfernt.

## 9. Fehlerverhalten

Ist der Primäreingang nicht lesbar:

- `Diagnostics.InvalidUpdates` wird erhöht,
- `Diagnostics.ValidInput=false`,
- `Diagnostics.Warning='Enteisungsstatus nicht lesbar'`,
- `System.Status='WARTET'`,
- `System.LastMessage='Enteisungsstatus nicht lesbar'`,
- Zähler und Dauern werden nicht verändert.

Fehlt der Primärdatenpunkt bereits beim Start:

- `System.Status='FEHLER'`,
- `System.Active=false`,
- der Scheduler wird nicht regulär in Betrieb genommen.

## 10. Migration

Die v1.1.x-Linie enthält eine Migration aus dem früheren 1.0.x-Zählerstand.

Dabei wird `CompletedCount` aus dem vorhandenen `Count` und dem aktuellen Aktivzustand abgeleitet, sofern noch kein neuer Wert vorhanden ist.

Ein vorhandener `LastEnd`-Zeitstempel kann in `Memory.LastEndMs` übernommen werden.

Eine leere Historie wird als `[]` initialisiert.

## 11. Persistenz-Soll

| State | `influxdb.1` | `changesOnly` | `statistics.0` |
|---|---:|---:|---:|
| `Defrost.Status` | ja | `true` | nein |
| `Defrost.Active` | ja | `true` | nein |
| `Defrost.TotalDurationMinutes` | nein | – | ja, `sumDelta=true` |
| alle übrigen Defrost-States | nein | – | nein |
| Memory-States | nein | – | nein |
| System-/Diagnostics-States | nein | – | nein |

### Begründung

`Defrost.Active` ist die bevorzugte boolesche Zeitreihe für die Darstellung aktiver Abtauphasen.

`Defrost.Status` ergänzt den detaillierteren technischen NIBE-Status.

`Defrost.TotalDurationMinutes` ist ein monoton wachsender kumulativer Zähler und dient als Statistics-Basis für Abtaudauer pro Viertelstunde, Stunde, Tag, Woche, Monat, Quartal und Jahr.

## 12. DashboardData-Integration

DashboardData verwendet aus dem DefrostMonitor insbesondere:

```text
Defrost.Status
Defrost.Active
Defrost.Count
Defrost.CurrentDurationMinutes
Defrost.LastDurationMinutes
Defrost.TotalDurationMinutes
Defrost.LastStart
Defrost.LastEnd
Diagnostics.ValidInput
Diagnostics.Warning
System.LastUpdate
```

DashboardData stellt daraus eine reduzierte Visualisierungs-API bereit.

Für den Statistikbereich `Abtaudauer` verwendet DashboardData ausdrücklich:

```text
0_userdata.0.NPS.DefrostMonitor.Defrost.TotalDurationMinutes
```

als kumulative `sumDelta`-Quelle.

Der DefrostMonitor fließt außerdem in die NPS-Health-Bewertung von DashboardData ein.

## 13. Objektstruktur

```text
0_userdata.0.NPS.DefrostMonitor
├── Defrost
│   ├── Active
│   ├── AverageDurationMinutes
│   ├── AverageIntervalMinutes
│   ├── CompletedCount
│   ├── Count
│   ├── CurrentDurationMinutes
│   ├── History
│   ├── LastDurationMinutes
│   ├── LastEnd
│   ├── LastIntervalMinutes
│   ├── LastStart
│   ├── Status
│   ├── TimeSinceLastDefrostMinutes
│   └── TotalDurationMinutes
├── Memory
│   ├── ActiveSinceMs
│   ├── CurrentIntervalMinutes
│   ├── Initialized
│   ├── IntervalCount
│   ├── LastEndMs
│   ├── StartCompressorFrequencyHz
│   ├── StartOutdoorTempC
│   ├── TotalIntervalMinutes
│   └── WasActive
├── Diagnostics
│   ├── InvalidUpdates
│   ├── Trace
│   ├── ValidInput
│   └── Warning
└── System
    ├── Active
    ├── LastMessage
    ├── LastStart
    ├── LastUpdate
    ├── Status
    └── Version
```

Im geprüften Objektbaum wurden keine Legacy-/Zusatzstates außerhalb dieser Struktur festgestellt.

## 14. Architekturregeln

1. Single Writer für alle States unter `NPS.DefrostMonitor`.
2. Keine zusätzlichen direkten Modbus-Lesewege.
3. Der Primäreingang wird ausschließlich gelesen.
4. Außentemperatur und Verdichterfrequenz werden aus vorgelagerten NPS-Modulen gelesen.
5. Ungültige Primärdaten verändern keine Enteisungszähler oder -dauern.
6. Fehlende optionale Historienquellen verhindern die Erkennung nicht.
7. Energie- und Effizienzbewertung bleibt nachgelagerten Modulen vorbehalten.
8. Memory-States sind interne Persistenz und keine Visualisierungs-API.
9. Nur `Status` und `Active` werden als Zeitreihen in `influxdb.1` geführt.
10. `TotalDurationMinutes` ist die einzige Statistics-Basis des Moduls.

## 15. Abnahmekriterien

- Primärer Alias-Eingang existiert und ist numerisch lesbar.
- Status `1` und `2` führen zu `Defrost.Active=true`.
- Andere numerische Statuswerte führen zu `Defrost.Active=false`.
- Alle 14 Public-API-States existieren.
- Alle 9 Memory-States existieren.
- System- und Diagnose-States entsprechen der freigegebenen Struktur.
- Beginn und Ende einer Enteisung werden zustandsbasiert genau einmal erkannt.
- `Count` erhöht sich beim Start.
- `CompletedCount` erhöht sich beim Ende.
- `TotalDurationMinutes` wird nur bei abgeschlossenen Vorgängen erhöht.
- Historie enthält höchstens 20 Einträge.
- `Status` ist auf `influxdb.1` mit `changesOnly=true` konfiguriert.
- `Active` ist auf `influxdb.1` mit `changesOnly=true` konfiguriert.
- `TotalDurationMinutes` ist auf `statistics.0` mit `sumDelta=true` konfiguriert.
- Keine unnötige Persistenz auf übrigen Modulstates.
- Keine Legacy-States außerhalb der spezifizierten Struktur.

## 16. Freigabestatus

Objektbaum, Public API, persistenter Arbeitsspeicher, Influx-Zuordnung, Statistics-Konfiguration und DashboardData-Integration wurden geprüft.

**Freigabestatus: PASS**

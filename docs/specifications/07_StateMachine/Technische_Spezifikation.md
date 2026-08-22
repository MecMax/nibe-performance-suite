# Technische Spezifikation – 07_NPS_StateMachine v1.2.1

**NIBE Performance Suite (NPS) · Modul 07**  
**Stand:** 22.08.2026  
**Bezugsstand:** `07_NPS_StateMachine v1.2.1`  
**Status:** STABIL / PASS

## 1. Modulidentität und Verantwortung

| Merkmal | Festlegung |
|---|---|
| Modul | `07_NPS_StateMachine` |
| Version | `1.2.1` |
| Architekturschicht | Zustandsautomat / Prozesszustand |
| Root | `0_userdata.0.NPS.StateMachine` |
| Primäre Abhängigkeit | `06_NPS_ProcessSignals v1.1.1` |
| Coding Standard | `NPS-CS-1.0` |

Die StateMachine interpretiert ausschließlich die semantischen ProcessSignals und publiziert einen eindeutigen fachlichen Anlagenzustand.

Sie kennt keine Modbus-Register und keine Alias-Datenpunkte und erzeugt weder Ereignishistorien noch Benachrichtigungen oder Langzeitstatistiken.

## 2. Architektur

```text
Alias / technische Quellen
          ↓
   06 ProcessSignals
          ↓
   07 StateMachine
       ↙        ↘
08 EventEngine  10 DashboardData
```

Architekturprinzipien:

1. ProcessSignals ist die vorgelagerte Live-Semantikquelle.
2. StateMachine ist Single Writer für `StateMachine.Current.*`.
3. Technische Rohsignale werden nicht parallel neu interpretiert.
4. Ereignisverarbeitung bleibt Aufgabe der EventEngine.
5. Zyklusdetailaufzeichnung bleibt Aufgabe von CycleRecorder/CycleAnalyzer.

## 3. Eingangssignale

```text
0_userdata.0.NPS.ProcessSignals.Verdichter.Laeuft
0_userdata.0.NPS.ProcessSignals.Verdichter.Steht
0_userdata.0.NPS.ProcessSignals.Verdichter.BedarfAktiv
0_userdata.0.NPS.ProcessSignals.Verdichter.ErwaermerAktiv
0_userdata.0.NPS.ProcessSignals.Verdichter.AbtauungAktiv

0_userdata.0.NPS.ProcessSignals.Betriebsart.Standby
0_userdata.0.NPS.ProcessSignals.Betriebsart.Brauchwasser
0_userdata.0.NPS.ProcessSignals.Betriebsart.Heizung
0_userdata.0.NPS.ProcessSignals.Betriebsart.Pool
0_userdata.0.NPS.ProcessSignals.Betriebsart.Kuehlung
0_userdata.0.NPS.ProcessSignals.Betriebsart.Bekannt

0_userdata.0.NPS.ProcessSignals.Plausibilitaet.SignaleGueltig
```

Die Eingangssignale werden live gelesen. Eine historische Abfrage ist nicht erforderlich.

## 4. Konfiguration

Freigegebene zeitliche Parameter:

```text
ANLAUF_DAUER_SEKUNDEN   = 120
AUSLAUF_DAUER_SEKUNDEN  = 60
AKTUALISIERUNG_SEKUNDEN = 10
```

Erforderliche Modulversion:

```text
REQUIRED_PROCESS_SIGNALS_VERSION = 1.1.1
```

## 5. Zustandsmenge

```text
STILLSTAND
VORWÄRMUNG
STARTANFORDERUNG
ANLAUF
HEIZBETRIEB
BRAUCHWASSERBETRIEB
POOLBETRIEB
KÜHLBETRIEB
ABTAUUNG
AUSLAUF
STÖRUNG
```

Als laufende Verdichterzustände gelten:

```text
ANLAUF
HEIZBETRIEB
BRAUCHWASSERBETRIEB
POOLBETRIEB
KÜHLBETRIEB
ABTAUUNG
```

## 6. Current API

| State | Typ / Einheit | Funktion |
|---|---|---|
| `Current.State` | string | Aktueller fachlicher Anlagenzustand |
| `Current.OperatingMode` | string | Aktuell erkannte Betriebsart |
| `Current.StartTime` | string/date | Startzeit des aktuellen Verdichtertakts |
| `Current.StopTime` | string/date | Stoppzeit des letzten Verdichtertakts |
| `Current.Runtime` | number / s | Laufzeit ausschließlich des aktuell laufenden Verdichtertakts |

### 6.1 Verbindliche Runtime-Semantik

Für `Current.Runtime` gilt:

```text
isRunningState(Current.State) = true
    → Runtime = Sekunden seit CycleStartMs

isRunningState(Current.State) = false
    → Runtime = 0
```

Ein abgeschlossener Takt darf keine veraltete Laufzeit in `Current.Runtime` hinterlassen.

Diese Regel ist Bestandteil von v1.2.1 und wurde mit `DashboardData.Cycles.CurrentDuration = 0` bei `Cycles.Active = false` verifiziert.

## 7. Betriebsart

Die Betriebsart wird in folgender Priorität bestimmt:

```text
ABTAUUNG
BRAUCHWASSER
HEIZUNG
POOL
KÜHLUNG
STANDBY
UNBEKANNT
```

Bei Zustandswechseln wird die Betriebsart so publiziert, dass nachgelagerte Event-Konsumenten beim Zyklusstart bereits die gültige Betriebsart lesen können.

## 8. Persistenter Arbeitsspeicher

| State | Funktion |
|---|---|
| `Memory.CurrentState` | Persistierter aktueller Automatenzustand |
| `Memory.StateSinceMs` | Beginn des aktuellen Zustands als Unix-Zeit |
| `Memory.CycleStartMs` | Start des aktuellen Verdichtertakts als Unix-Zeit |
| `Memory.CycleStopMs` | Stopp des letzten Verdichtertakts als Unix-Zeit |

Die Memory-States dienen ausschließlich der Wiederaufnahme und internen Laufzeitlogik. Sie sind keine Public-History-API.

## 9. Diagnose-API

| State | Funktion |
|---|---|
| `Diagnostics.SignalsReadable` | Lesbarkeit der erforderlichen Signale |
| `Diagnostics.PreviousState` | Vorheriger Zustand |
| `Diagnostics.LastTransition` | Letzter Zustandswechsel |
| `Diagnostics.TransitionCount` | Kumulativer Zustandswechselzähler |
| `Diagnostics.Warning` | Warninformation |
| `Diagnostics.Trace` | Diagnose-Trace |

Diagnosewerte werden nicht als fachliche Langzeit-Zeitreihen behandelt.

## 10. System-API

```text
System.Active
System.LastMessage
System.LastStart
System.LastUpdate
System.Status
System.Version
```

## 11. Auswertungsprinzip

Die StateMachine wird ausgelöst durch:

- Änderungen relevanter ProcessSignals,
- zyklische Auswertung alle 10 Sekunden,
- einmalige Auswertung nach erfolgreicher Initialisierung.

Die zyklische Auswertung ist insbesondere für die zeitabhängigen Übergänge aus `ANLAUF` und `AUSLAUF` erforderlich.

## 12. Wesentliche Übergangsregeln

Globale Regeln haben Vorrang:

```text
ungültige/nicht lesbare Signale → STÖRUNG
Abtauung aktiv + Verdichter läuft → ABTAUUNG
```

Typischer Verdichterablauf:

```text
STILLSTAND
   ↓ Bedarf
STARTANFORDERUNG
   ↓ Verdichter läuft
ANLAUF
   ↓ nach 120 s
HEIZBETRIEB / BRAUCHWASSERBETRIEB / POOLBETRIEB / KÜHLBETRIEB
   ↓ Verdichter steht
AUSLAUF
   ↓ nach 60 s bei stehendem Verdichter
STILLSTAND
```

Ein weiterhin anliegender Bedarf verhindert das reguläre Zyklusende aus `AUSLAUF` nach `STILLSTAND` nicht. Ein neuer Bedarf wird anschließend regulär neu verarbeitet.

## 13. Initialzustand und Restore

Beim Start wird zunächst der persistente Automatenkontext aus `Memory.*` gelesen.

Ein gespeicherter Zustand wird nur übernommen, wenn er zur freigegebenen Zustandsmenge gehört.

Die wiederhergestellte Public API wird unmittelbar publiziert. Danach wird anhand der aktuellen ProcessSignals der gültige aktuelle Zustand bestimmt.

## 14. Persistenz-Soll

Die StateMachine benötigt keine `statistics.0`-Konfiguration.

Für die Langzeithistorie ist ausschließlich `Current.State` fachlich relevant. Im konsolidierten NPS-Stand wird dafür die aktive Instanz `influxdb.0` verwendet.

| Statebereich | `influxdb.0` | `statistics.0` |
|---|---:|---:|
| `Current.State` | ja, `changesOnly=true` | nein |
| `Current.OperatingMode` | nein | nein |
| `Current.Runtime` | nein | nein |
| `Current.StartTime` | nein | nein |
| `Current.StopTime` | nein | nein |
| `Diagnostics.*` | nein | nein |
| `Memory.*` | nein | nein |
| `System.*` | nein | nein |

Die frühere Dokumentation mit `influxdb.1` ist für den konsolidierten Stand überholt; die deaktivierte Instanz ist nicht mehr Sollbestandteil.

## 15. Begründung der Persistenzentscheidung

`Current.State` ermöglicht die zeitliche Rekonstruktion des fachlichen Anlagenbetriebs.

Nicht separat historisiert werden insbesondere:

```text
Memory.CurrentState
Diagnostics.LastTransition
Diagnostics.TransitionCount
```

Begründung:

1. `Memory.CurrentState` ist interner Arbeitsspeicher.
2. `Diagnostics.LastTransition` ist aus der `Current.State`-Zeitreihe ableitbar.
3. `Diagnostics.TransitionCount` ist ein Diagnosezähler.
4. Zusätzliche Zeitreihen wären redundant.

## 16. Objektstruktur

```text
0_userdata.0.NPS.StateMachine
├── Current
│   ├── OperatingMode
│   ├── Runtime
│   ├── StartTime
│   ├── State
│   └── StopTime
├── Diagnostics
│   ├── LastTransition
│   ├── PreviousState
│   ├── SignalsReadable
│   ├── Trace
│   ├── TransitionCount
│   └── Warning
├── Memory
│   ├── CurrentState
│   ├── CycleStartMs
│   ├── CycleStopMs
│   └── StateSinceMs
└── System
    ├── Active
    ├── LastMessage
    ├── LastStart
    ├── LastUpdate
    ├── Status
    └── Version
```

## 17. Abgrenzung zu anderen Modulen

### 17.1 ProcessSignals

ProcessSignals liefert die normalisierte Live-Semantik. Die StateMachine baut darauf auf und greift nicht direkt auf Modbus/Alias zurück.

### 17.2 EventEngine

EventEngine reagiert auf fachliche Zustandswechsel. Die StateMachine erzeugt selbst keine Ereignishistorie oder Benachrichtigungen.

### 17.3 CycleRecorder / CycleAnalyzer

Diese Module übernehmen vollständige Zyklusaufzeichnung und Analyse. `Current.Runtime` ist nur die Live-Laufzeit des aktuellen Takts.

### 17.4 DashboardData

DashboardData übernimmt StateMachine-Werte für Visualisierung und Aggregation. Die fachliche Quelle des Zustands bleibt die StateMachine.

## 18. Versionsabhängigkeit

Freigegebene Kette:

```text
06_NPS_ProcessSignals   v1.1.1
          ↓
07_NPS_StateMachine     v1.2.1
          ↓
08_NPS_EventEngine      v1.2.1
```

Die StateMachine selbst prüft exakt `06_NPS_ProcessSignals v1.1.1`.

## 19. Änderung v1.2.1

```text
1.2.1 | 2026-08-22
      | Bugfix: Current.Runtime wird beim Übergang von einem laufenden
      | Verdichterzustand in einen nicht laufenden Zustand auf 0 gesetzt.
      | Dadurch bleibt nach Taktende keine veraltete Laufzeit stehen.
      | DashboardData.Cycles.CurrentDuration zeigt im Stillstand 0.
      | Header-Abhängigkeit auf ProcessSignals 1.1.1 korrigiert.
```

Keine Änderung der Zustandsmenge oder der öffentlichen Objektstruktur.

## 20. Abnahmekriterien

- Modulversion ist `1.2.1`.
- Erforderliche ProcessSignals-Version ist `1.1.1`.
- Alle fünf `Current.*`-States existieren.
- Alle vier `Memory.*`-States existieren.
- Alle sechs `Diagnostics.*`-States existieren.
- Alle sechs `System.*`-States existieren.
- Der aktuelle Zustand gehört zur freigegebenen Zustandsmenge.
- Bei gültigen Eingangssignalen ist `Diagnostics.SignalsReadable=true`.
- Zustandswechsel werden nachvollziehbar dokumentiert.
- Während eines laufenden Verdichterzustands wird `Current.Runtime` fortgeschrieben.
- Außerhalb eines laufenden Verdichterzustands gilt `Current.Runtime=0`.
- Bei `DashboardData.Cycles.Active=false` ergibt sich `Cycles.CurrentDuration=0`.
- Nur `Current.State` ist für die Langzeithistorie vorgesehen.
- Keine StateMachine-States verwenden `statistics.0`.
- Memory- und Diagnosewerte bleiben von der Langzeitpersistenz getrennt.

## 21. Freigabestatus

Versionsabhängigkeit, Objektbaum, Zustandsmodell, Runtime-Semantik und Zusammenspiel mit DashboardData wurden geprüft.

Der v1.2.1-Bugfix wurde praktisch verifiziert.

**Freigabestatus: PASS**

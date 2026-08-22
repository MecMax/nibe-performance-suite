# Anwenderspezifikation – 06_NPS_ProcessSignals v1.1.1

**NIBE Performance Suite (NPS) · Modul 06**  
**Stand:** 22.08.2026  
**Bezugsstand:** `06_NPS_ProcessSignals v1.1.1`  
**Status:** STABIL

## 1. Zweck

`06_NPS_ProcessSignals` bildet technische Eingangswerte der Wärmepumpe auf eindeutige, semantische Prozesssignale ab. Nachfolgende NPS-Module müssen dadurch nicht selbst interpretieren, ob beispielsweise Heizung, Brauchwasser, Standby, Abtauung oder Verdichterlauf aktiv ist.

Das Modul bildet damit die Live-Semantikschicht zwischen den Alias-Eingängen und nachgelagerten Modulen wie StateMachine und CycleRecorder.

## 2. Abgrenzung

ProcessSignals:

- führt keine Energie- oder COP-Berechnung durch,
- führt keine Zyklusanalyse durch,
- führt keine Langzeitstatistik durch,
- speichert keine eigenen Zeitreihen in InfluxDB,
- verändert keine NIBE-, Modbus- oder Alias-Werte.

Die Aufgabe ist ausschließlich die aktuelle Interpretation und Plausibilisierung der Prozesssignale.

## 3. Wesentliche Eingangswerte

Das Modul verarbeitet insbesondere:

- Betriebspriorität,
- Verdichterfrequenz,
- Verdichterbedarf,
- Verdichter-Erwärmer,
- Abtauungsstatus,
- optionalen Verdichterstrom-/Leistungswert.

Die Eingangswerte werden in `Eingangswerte.*` gespiegelt und anschließend semantisch ausgewertet.

## 4. Verdichterzustand

Der Verdichterlauf wird aus der Verdichterfrequenz abgeleitet.

Bei einer ausreichenden Verdichterfrequenz wird:

- `Verdichter.Laeuft = true`
- `Verdichter.Steht = false`

gesetzt.

Damit steht nachfolgenden Modulen ein eindeutiges Boolean-Signal zur Verfügung.

## 5. Betriebsart

Aus der NIBE-Betriebspriorität werden die semantischen Betriebsarten abgeleitet:

- Standby
- Brauchwasser
- Heizung
- Pool
- Kühlung

`Betriebsart.Bekannt` zeigt an, ob die aktuelle Priorität einer bekannten Betriebsart zugeordnet werden konnte.

## 6. Abtauung

Der technische Abtauungsstatus wird in ein eindeutiges Boolean-Signal überführt.

`Verdichter.AbtauungAktiv` zeigt an, ob aktuell eine Abtauung erkannt wird.

Die detaillierte Ereignis- und Verlaufsanalyse einer Abtauung ist Aufgabe des `05_NPS_DefrostMonitor`.

## 7. Plausibilitätsprüfung

Das Modul stellt zusätzliche Signale bereit, mit denen widersprüchliche oder ungewöhnliche Betriebszustände erkannt werden können.

Dazu gehören insbesondere:

| Datenpunkt | Bedeutung |
|---|---|
| `Plausibilitaet.SignaleGueltig` | Alle erforderlichen Prozesssignale sind gültig |
| `Plausibilitaet.BedarfBeiStillstand` | Verdichterbedarf liegt an, obwohl der Verdichter steht |
| `Plausibilitaet.LaufOhneBedarf` | Verdichter läuft ohne erkannten Bedarf |
| `Plausibilitaet.AbtauungOhneVerdichterlauf` | Abtauung bei stillstehendem Verdichter |
| `Plausibilitaet.VerdichterlaufOhneBekanntePrioritaet` | Verdichter läuft bei unbekannter Betriebspriorität |

Diese Signale sind Diagnosehilfen und keine eigenständigen Alarmmeldungen.

## 8. Systemstatus

| Datenpunkt | Bedeutung |
|---|---|
| `System.Aktiv` | Modul ist aktiv |
| `System.Status` | Aktueller Modulstatus |
| `System.Version` | Aktive Modulversion |
| `System.LetzteAktualisierung` | Zeitpunkt der letzten Verarbeitung |
| `System.LetzteMeldung` | Letzte verständliche Modulmeldung |

Ein normaler Zustand liegt insbesondere bei `System.Aktiv=true`, `System.Status=OK` und `Plausibilitaet.SignaleGueltig=true` vor.

## 9. Verwendung in NPS

Die wesentliche Verarbeitungskette lautet:

```text
NIBE / Alias
     ↓
06 ProcessSignals
     ↓
07 StateMachine
     ↓
08 EventEngine
```

Der CycleRecorder verwendet ProcessSignals ebenfalls als Live-Quelle für Betriebsart und Verdichterzustand.

## 10. Historisierung

Für `06_NPS_ProcessSignals` ist bewusst **keine eigene InfluxDB- oder Statistics-Persistenz** vorgesehen.

Der geprüfte Zielzustand lautet:

| Persistenz | Festlegung |
|---|---|
| `influxdb.0` | keine ProcessSignals-States |
| `influxdb.1` | keine ProcessSignals-States |
| `statistics.0` | keine ProcessSignals-States |

Die ProcessSignals werden von den Verbrauchermodulen live gelesen. Zyklusdaten werden durch den CycleRecorder aufgezeichnet; Abtauhistorie wird vom DefrostMonitor geführt.

## 11. Kompatibilitätsstates

Folgende States bleiben in v1.1.1 bewusst aus Kompatibilitätsgründen vorhanden:

```text
Eingangswerte.Verdichterstatus
Verdichter.StatuswertGueltig
```

Sie dürfen nicht als aktuelle fachliche Quelle für den Verdichterlauf interpretiert werden.

## 12. Freigegebener Objektbaum

```text
ProcessSignals
├── Betriebsart
│   ├── Bekannt
│   ├── Brauchwasser
│   ├── Heizung
│   ├── Kuehlung
│   ├── Pool
│   └── Standby
├── Eingangswerte
│   ├── Abtauung
│   ├── Prioritaet
│   ├── VerdichterErwaermer
│   ├── Verdichterbedarf
│   ├── Verdichterfrequenz
│   ├── Verdichterstatus
│   └── Verdichterstrom
├── Plausibilitaet
│   ├── AbtauungOhneVerdichterlauf
│   ├── BedarfBeiStillstand
│   ├── LaufOhneBedarf
│   ├── SignaleGueltig
│   └── VerdichterlaufOhneBekanntePrioritaet
├── System
│   ├── Aktiv
│   ├── LetzteAktualisierung
│   ├── LetzteMeldung
│   ├── Status
│   └── Version
└── Verdichter
    ├── AbtauungAktiv
    ├── BedarfAktiv
    ├── ErwaermerAktiv
    ├── Laeuft
    ├── StatuswertGueltig
    ├── Steht
    └── StromwertGueltig
```

## 13. Freigabestatus

Objektbaum, Live-Semantik, Verbraucherabhängigkeiten sowie Influx-/Statistics-Abgrenzung wurden geprüft.

**Freigabestatus: PASS**

# Technische Spezifikation – 08_NPS_EventEngine v1.2.1

**NIBE Performance Suite (NPS) · Modul 08**  
**Stand:** 22.08.2026  
**Bezugsstand:** `08_NPS_EventEngine v1.2.1`  
**Status:** STABIL / PASS

## 1. Modulidentität und Verantwortung

| Merkmal | Festlegung |
|---|---|
| Modul | `08_NPS_EventEngine` |
| Version | `1.2.1` |
| Architekturschicht | Ereignismodell / Event-Publishing |
| Root | `0_userdata.0.NPS.Events` |
| Primäre Abhängigkeit | `07_NPS_StateMachine v1.2.1` |
| Coding Standard | `NPS-CS-1.0` |

Die EventEngine übersetzt gültige Zustandswechsel der StateMachine in standardisierte strukturierte NPS-Ereignisse.

Sie ist Single Writer für den vollständigen Bereich `NPS.Events`.

## 2. Architektur

```text
06 ProcessSignals
       ↓
07 StateMachine
       ↓
08 EventEngine
       ↓
09 NotificationBridge
       ↓
NotificationCenter
```

DashboardData konsumiert den Ereignisstrom ebenfalls für die Visualisierung und Ereignishistorie.

## 3. Eingänge

```text
0_userdata.0.NPS.StateMachine.Current.State
0_userdata.0.NPS.StateMachine.Current.OperatingMode
0_userdata.0.NPS.StateMachine.Current.StartTime
0_userdata.0.NPS.StateMachine.Current.StopTime
0_userdata.0.NPS.StateMachine.Current.Runtime
```

Es werden ausschließlich diese Public-API-Werte der StateMachine gelesen.

## 4. Versionsprüfung

```text
REQUIRED_STATE_MACHINE_VERSION = 1.2.1
```

Die EventEngine startet nur, wenn `StateMachine.System.Version` exakt dieser Version entspricht und alle erforderlichen Eingänge vorhanden sind.

Bei nicht erfüllten Abhängigkeiten gilt:

```text
Events.System.Aktiv = false
Events.System.Status = STÖRUNG
```

## 5. Gültiger Zustandskatalog

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

Laufende Verdichterzustände:

```text
ANLAUF
HEIZBETRIEB
BRAUCHWASSERBETRIEB
POOLBETRIEB
KÜHLBETRIEB
ABTAUUNG
```

## 6. Robustheit gegen Zwischenwerte

Die EventEngine verwendet nicht blind `oldState` als fachlichen Vorgänger.

Sie führt intern `lastValidState` und akzeptiert nur Werte aus `VALID_STATES`.

Ungültige oder numerische Zwischenwerte, beispielsweise `20`, `40` oder `60`, werden vollständig ignoriert und erzeugen kein Ereignis.

Dadurch entstehen Ereignisketten ausschließlich zwischen gültigen semantischen NPS-Zuständen.

## 7. Ereigniskatalog

| ID | Typ | Auslöser | Level |
|---|---|---|---|
| `NPS-VERDICHTER-1001` | `VERDICHTER_GESTARTET` | Wechsel nach ANLAUF aus nicht laufendem Zustand | info |
| `NPS-VERDICHTER-1002` | `VERDICHTER_AUSLAUF` | Wechsel nach AUSLAUF | info |
| `NPS-VERDICHTER-1003` | `VERDICHTER_GESTOPPT` | AUSLAUF → STILLSTAND | success |
| `NPS-VERDICHTER-1101` | `VORWAERMUNG_GESTARTET` | Wechsel nach VORWÄRMUNG | info |
| `NPS-VERDICHTER-1102` | `STARTANFORDERUNG_AKTIV` | Wechsel nach STARTANFORDERUNG | info |
| `NPS-VERDICHTER-1201` | `HEIZBETRIEB_GESTARTET` | Wechsel nach HEIZBETRIEB | info |
| `NPS-VERDICHTER-1301` | `BRAUCHWASSERBETRIEB_GESTARTET` | Wechsel nach BRAUCHWASSERBETRIEB | info |
| `NPS-VERDICHTER-1401` | `ABTAUUNG_GESTARTET` | Wechsel nach ABTAUUNG | info |
| `NPS-VERDICHTER-1402` | `ABTAUUNG_BEENDET` | ABTAUUNG → anderer gültiger Zustand | success |
| `NPS-VERDICHTER-1501` | `POOLBETRIEB_GESTARTET` | Wechsel nach POOLBETRIEB | info |
| `NPS-VERDICHTER-1601` | `KUEHLBETRIEB_GESTARTET` | Wechsel nach KÜHLBETRIEB | info |
| `NPS-VERDICHTER-9001` | `VERDICHTER_STOERUNG` | Wechsel nach STÖRUNG | error |
| `NPS-VERDICHTER-9002` | `VERDICHTER_STOERUNG_BEENDET` | STÖRUNG → gültiger anderer Zustand | success |
| `NPS-VERDICHTER-1900` | `ZUSTANDSWECHSEL` | sonstiger gültiger Wechsel | info |

## 8. Public API

```text
0_userdata.0.NPS.Events.Verdichter.Sequenz
0_userdata.0.NPS.Events.Verdichter.EreignisId
0_userdata.0.NPS.Events.Verdichter.Typ
0_userdata.0.NPS.Events.Verdichter.Titel
0_userdata.0.NPS.Events.Verdichter.Nachricht
0_userdata.0.NPS.Events.Verdichter.Kritikalitaet
0_userdata.0.NPS.Events.Verdichter.Zeitstempel
0_userdata.0.NPS.Events.Verdichter.ZustandVorher
0_userdata.0.NPS.Events.Verdichter.ZustandAktuell
0_userdata.0.NPS.Events.Verdichter.Betriebsart
0_userdata.0.NPS.Events.Verdichter.Startzeit
0_userdata.0.NPS.Events.Verdichter.Stoppzeit
0_userdata.0.NPS.Events.Verdichter.Laufzeit
0_userdata.0.NPS.Events.Verdichter.Nutzdaten
```

## 9. Nutzdatenvertrag

`Verdichter.Nutzdaten` enthält eine JSON-Zeichenkette mit mindestens:

```text
eventId
domain
type
source
level
title
message
timestamp
sequence
data.previousState
data.currentState
data.operatingMode
data.startTime
data.stopTime
data.runtimeSeconds
```

`domain` ist `nibe`, `source` ist `08_NPS_EventEngine`.

## 10. Publikationsvertrag

Bei einem Ereignis werden zunächst alle fachlichen Felder, Systeminformationen und Diagnosedaten geschrieben.

Anschließend wird:

```text
Verdichter.Sequenz = vorherige Sequenz + 1
```

als letzter Schreibvorgang ausgeführt.

Die Sequenz ist damit die verbindliche Synchronisationsgrenze für Konsumenten.

Nachgelagerte Module dürfen die Änderung der Sequenz als Trigger verwenden und anschließend den vollständig geschriebenen Ereignisdatensatz lesen.

## 11. Startverhalten

Beim Start wird der aktuelle `StateMachine.Current.State` geprüft.

Ist er gültig, wird er in `lastValidState` als Basis übernommen. Ist er ungültig, bleibt die Basis zunächst leer.

Beim Modulstart wird bewusst kein Ereignis veröffentlicht.

Erst ein realer nachfolgender Wechsel zwischen gültigen Zuständen löst `publishEvent()` aus.

## 12. Trigger

Die EventEngine reagiert auf:

```text
StateMachine.Current.State
change: ne
```

Es gibt keine zyklische Ereigniserzeugung.

## 13. System-API

```text
Events.System.Version
Events.System.Aktiv
Events.System.Status
Events.System.LetzterStart
Events.System.LetzteAktualisierung
Events.System.LetzteMeldung
```

Regulärer Betriebsstatus:

```text
Aktiv = true
Status = BEREIT
```

## 14. Diagnose-API

```text
Events.Diagnostics.EventCount
Events.Diagnostics.LastEventType
Events.Diagnostics.Warning
```

`EventCount` zählt die von dieser EventEngine veröffentlichten Ereignisse.

## 15. Persistenz

Die EventEngine führt selbst keine Ereignishistorie und keine Statistik.

Für die EventEngine ist keine eigene `statistics.0`-Konfiguration erforderlich.

Eine redundante Langzeithistorisierung sämtlicher `Events.*`-States ist nicht Bestandteil des Moduls. Nachgelagerte Komponenten übernehmen Ereignishistorie, Darstellung und Benachrichtigung.

## 16. Abgrenzung

### StateMachine

StateMachine entscheidet den fachlichen Anlagenzustand. EventEngine interpretiert keine Rohsignale und korrigiert keine Zustandsentscheidung.

### NotificationBridge

NotificationBridge konsumiert fertige Ereignisse und übernimmt Formatumsetzung, Routing und Publikation an den NotificationCenter.

### DashboardData

DashboardData kann Ereignisse für Anzeige, History und Tageszähler übernehmen. Die EventEngine selbst führt diese History nicht.

## 17. Objektstruktur

```text
0_userdata.0.NPS.Events
├── System
│   ├── Version
│   ├── Aktiv
│   ├── Status
│   ├── LetzterStart
│   ├── LetzteAktualisierung
│   └── LetzteMeldung
├── Verdichter
│   ├── Sequenz
│   ├── EreignisId
│   ├── Typ
│   ├── Titel
│   ├── Nachricht
│   ├── Kritikalitaet
│   ├── Zeitstempel
│   ├── ZustandVorher
│   ├── ZustandAktuell
│   ├── Betriebsart
│   ├── Startzeit
│   ├── Stoppzeit
│   ├── Laufzeit
│   └── Nutzdaten
└── Diagnostics
    ├── EventCount
    ├── LastEventType
    └── Warning
```

## 18. Versionskette

Freigegebener Stand:

```text
07_NPS_StateMachine       v1.2.1
          ↓
08_NPS_EventEngine        v1.2.1
          ↓
09_NPS_NotificationBridge v1.2.3
```

## 19. Änderung v1.2.1

```text
1.2.1 | 2026-08-22
      | Abhängigkeit auf 07_NPS_StateMachine v1.2.1 aktualisiert.
      | Keine Änderung der Ereignislogik oder Public API.
```

Die robuste Zustandsvalidierung aus der vorherigen Entwicklung bleibt unverändert erhalten.

## 20. Abnahmekriterien

- Modulversion ist `1.2.1`.
- Erforderliche StateMachine-Version ist exakt `1.2.1`.
- Alle fünf StateMachine-Eingänge existieren.
- Nur gültige semantische NPS-Zustände erzeugen Ereignisse.
- Numerische/ungültige Zwischenwerte erzeugen keine Ereignisse.
- Beim Start wird kein rückwirkendes Ereignis erzeugt.
- Ereignisfelder werden vor der Sequenz geschrieben.
- `Verdichter.Sequenz` wird pro veröffentlichtem Ereignis monoton erhöht.
- Ereignis-ID, Typ, Titel, Nachricht, Level und Nutzdaten sind konsistent.
- `AUSLAUF → STILLSTAND` erzeugt `VERDICHTER_GESTOPPT`.
- `STÖRUNG` und deren Ende werden korrekt abgebildet.
- Keine Ereignishistorie, Benachrichtigung oder Statistik innerhalb der EventEngine.
- NotificationBridge kann die Sequenz als Commit-/Triggersignal verwenden.

## 21. Freigabestatus

Die Versionskette und die Ereignisverarbeitung wurden im konsolidierten NPS-Stand geprüft. DashboardData zeigte eine konsistente Ereignisfolge; die Abhängigkeit wurde auf StateMachine v1.2.1 synchronisiert.

**Freigabestatus: PASS**

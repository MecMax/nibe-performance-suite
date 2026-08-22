# Technische Spezifikation – 09_NPS_NotificationBridge v1.2.3

**NIBE Performance Suite (NPS) · Modul 09**  
**Stand:** 22.08.2026  
**Bezugsstand:** `09_NPS_NotificationBridge v1.2.3`  
**Build:** 22.08.2026  
**Status:** STABIL / BEOBACHTEN

## 1. Modulidentität und Verantwortung

| Merkmal | Festlegung |
|---|---|
| Modul | `09_NPS_NotificationBridge` |
| Version | `1.2.3` |
| Architekturschicht | Integrationsschicht / Benachrichtigungs-Bridge |
| Root | `0_userdata.0.NPS.NotificationBridge` |
| EventEngine-Abhängigkeit | `08_NPS_EventEngine v1.2.1` |
| Ausgang | `0_userdata.0.NotificationCenter.Events.Publish` |
| Eigene Nachrichtenhistorie | nein |
| Influx-/Statistics-Persistenz | keine |

Die NotificationBridge übersetzt ausgewählte NPS-Events und direkte technische NIBE-Signale in das standardisierte Nachrichtenformat des NotificationCenters.

## 2. Eingänge

### 2.1 EventEngine

```text
0_userdata.0.NPS.Events.Verdichter.Sequenz
0_userdata.0.NPS.Events.Verdichter.EreignisId
0_userdata.0.NPS.Events.Verdichter.Typ
0_userdata.0.NPS.Events.Verdichter.Titel
0_userdata.0.NPS.Events.Verdichter.Nachricht
0_userdata.0.NPS.Events.Verdichter.Kritikalitaet
0_userdata.0.NPS.Events.Verdichter.Zeitstempel
0_userdata.0.NPS.Events.Verdichter.Nutzdaten
```

Primärer Trigger ist `Verdichter.Sequenz` mit `change: ne`.

### 2.2 Direkte technische Signale

```text
alias.0.Keller.Waschküche.Waermepumpe.UNREACH
alias.0.Keller.Waschküche.Waermepumpe.Alarmnummer
```

Beide werden mit `change: ne` überwacht.

## 3. Ausgang

Einzige externe Publikationsschnittstelle:

```text
0_userdata.0.NotificationCenter.Events.Publish
```

Die Bridge schreibt JSON-Ereignisse auf diesen EventBus und führt keine direkte Matrix-, Jarvis-, Mail- oder Telegram-Zustellung aus.

## 4. EventBus-Payload

Fachliches Schema:

```json
{
  "eventUid": "...",
  "eventId": "...",
  "domain": "nibe",
  "type": "...",
  "source": "09_NPS_NotificationBridge",
  "level": "info",
  "title": "...",
  "message": "...",
  "timestamp": "...",
  "emoji": "...",
  "jarvisIcon": "...",
  "channels": {
    "matrix": [0],
    "jarvis": true
  },
  "data": {}
}
```

`eventUid` wird bei jeder Publikation neu erzeugt.

## 5. EventEngine-Sequenz

Verarbeitung:

1. `Verdichter.Sequenz` lesen.
2. Mit `Memory.LastSequence` vergleichen.
3. Sequenzen kleiner/gleich der zuletzt verarbeiteten Sequenz ignorieren.
4. Event-ID, Typ, Zeitstempel und Nutzdaten lesen.
5. Zyklusfilter anwenden.
6. Ggf. NotificationCenter-Payload erzeugen und publizieren.
7. `Memory.LastSequence` aktualisieren.

Die EventEngine-Sequenz ist die Synchronisationsgrenze zwischen Modul 08 und Modul 09.

## 6. Zyklusfilter

Nur:

```text
VERDICHTER_GESTARTET
VERDICHTER_GESTOPPT
```

erzeugen eine NPS-Zyklusbenachrichtigung.

Andere EventEngine-Ereignisse werden als unterdrückt gezählt und als verarbeitet markiert.

## 7. Zyklusstart

```text
eventId = NPS-ZYKLUS-START
type    = cycle.started
level   = info
```

## 8. Zyklusende

```text
eventId = NPS-ZYKLUS-ENDE
type    = cycle.ended
level   = success
```

Die Nachricht enthält Betriebsart, formatierte Laufzeit und Endzeitpunkt.

## 9. Betriebsart-Normalisierung

```text
HEIZEN / HEIZBETRIEB               → Heizung
BRAUCHWASSER / BRAUCHWASSERBETRIEB → Brauchwasser
KUEHLUNG / KÜHLUNG / KÜHLBETRIEB   → Kühlung
POOL / POOLBETRIEB                  → Pool
```

Andere Werte werden unverändert weitergegeben.

## 10. UNREACH-Verarbeitung

`true`:

```text
eventId = NIBE-1002
type    = system.offline
level   = error
```

`false`:

```text
eventId = NIBE-1001
type    = system.online
level   = success
```

Ungültige Werte werden nicht publiziert und erhöhen `Statistics.SuppressedCount`.

## 11. Alarmverarbeitung

Alarm aktiv:

```text
old = 0
new != 0
eventId = NIBE-3001
type    = alarm.active
level   = error
```

Alarm beendet:

```text
old != 0
new = 0
eventId = NIBE-3002
type    = alarm.cleared
level   = success
```

Alarm geändert:

```text
old != new
eventId = NIBE-3003
type    = alarm.changed
level   = error
```

Nicht numerische Alarmwerte werden unterdrückt.

## 12. Duplikatschutz beim Start

Nach erfolgreicher Initialisierung gilt:

```text
Memory.LastSequence =
    aktuelle Events.Verdichter.Sequenz
```

Der vorhandene letzte EventEngine-Datensatz wird dadurch nach einem Bridge-Neustart nicht erneut veröffentlicht.

## 13. Public-Diagnose

### System

```text
System.Version
System.Active
System.LastStart
System.LastPublish
System.Status
System.LastMessage
```

### Diagnostics

```text
Diagnostics.ValidInput
Diagnostics.EventBusAvailable
Diagnostics.Warning
Diagnostics.Trace
```

### Statistics

```text
Statistics.PublishedCount
Statistics.SuppressedCount
Statistics.ErrorCount
```

### Memory

```text
Memory.LastSequence
Memory.LastEventId
Memory.LastEventType
Memory.LastEventValue
```

Der freigegebene Objektbaum umfasst 17 States.

## 14. Interne Statistik versus statistics.0

`NPS.NotificationBridge.Statistics` ist ausschließlich modulinterne Diagnose.

Es besteht keine Verbindung zum ioBroker-Adapter `statistics.0`.

## 15. Persistenz-Soll

Für alle States unter `0_userdata.0.NPS.NotificationBridge.*`:

| Persistenzsystem | Soll |
|---|---|
| `influxdb.0` | keine Konfiguration |
| `influxdb.1` | keine Konfiguration |
| `statistics.0` | keine Konfiguration |

## 16. Abhängigkeitsprüfung

Beim Start wird geprüft:

- `Events.System.Version` existiert,
- EventEngine-Version entspricht exakt `1.2.1`,
- alle erforderlichen EventEngine-Eingänge existieren,
- `UNREACH` existiert,
- `Alarmnummer` existiert.

Bei falscher EventEngine-Version oder fehlender Pflichtquelle wird der reguläre Start abgebrochen.

## 17. EventBus-Verfügbarkeit

Falls der NotificationCenter EventBus nicht existiert, versucht die Bridge ihn anzulegen.

Fehlt er anschließend weiterhin:

```text
System.Active = false
System.Status = FEHLER
Diagnostics.EventBusAvailable = false
```

Eine fehlgeschlagene Veröffentlichung erhöht `Statistics.ErrorCount`.

## 18. Routing

Die Implementierung verwendet für alle drei Routinggruppen:

```javascript
MATRIX: [0]
JARVIS: true
```

Dies gilt für:

- NPS-Zyklusereignisse,
- UNREACH,
- Alarmereignisse.

Die Bridge schreibt nur Routinginformationen in den NotificationCenter-Payload. Die tatsächliche Zustellung bleibt Aufgabe des NotificationCenters.

## 19. Hinweis zum Script-Header

Der Header von v1.2.3 beschreibt das Jarvis-Routing teilweise widersprüchlich: Dort steht, Jarvis werde vom NPS nicht als Benachrichtigungskanal verwendet; die tatsächliche Konfiguration setzt jedoch `JARVIS: true` für alle drei Routinggruppen.

Für die technische Spezifikation ist die tatsächliche Implementierung maßgeblich.

Die EventEngine-Versionsangabe ist in v1.2.3 dagegen korrekt auf `1.2.1` aktualisiert.

## 20. Objektstruktur

```text
0_userdata.0.NPS.NotificationBridge
├── Diagnostics
│   ├── EventBusAvailable
│   ├── Trace
│   ├── ValidInput
│   └── Warning
├── Memory
│   ├── LastEventId
│   ├── LastEventType
│   ├── LastEventValue
│   └── LastSequence
├── Statistics
│   ├── ErrorCount
│   ├── PublishedCount
│   └── SuppressedCount
└── System
    ├── Active
    ├── LastMessage
    ├── LastPublish
    ├── LastStart
    ├── Status
    └── Version
```

## 21. Architekturregeln

1. EventEngine bleibt Quelle der NPS-Verdichter-/Zyklusereignisse.
2. NotificationBridge trifft keine konkurrierende Verdichter-Zustandsentscheidung.
3. Nur Zyklusstart und vollständiges Zyklusende werden aus EventEngine-Ereignissen benachrichtigt.
4. UNREACH und Alarmnummer dürfen direkt überwacht werden.
5. NotificationCenter EventBus ist die einzige externe Publikationsschnittstelle.
6. Keine direkte Kanalzustellung durch die Bridge.
7. Beim Start werden alte EventEngine-Ereignisse nicht erneut versendet.
8. `Memory.*` bleibt interne Zustandsverwaltung.
9. Keine NotificationBridge-States in InfluxDB.
10. Keine NotificationBridge-States im ioBroker-Statistics-Adapter.
11. EventEngine und NotificationBridge bleiben getrennte Module.

## 22. Versionskette

```text
08_NPS_EventEngine        v1.2.1
          ↓
09_NPS_NotificationBridge v1.2.3
```

## 23. Änderung v1.2.3

```text
1.2.3 | 2026-08-22
      | Abhängigkeit auf 08_NPS_EventEngine v1.2.1 aktualisiert.
      | Keine Änderung der Routing-, Publikations- oder
      | Benachrichtigungslogik.
```

## 24. Abnahmekriterien

- Modulversion ist `1.2.3`.
- EventEngine v1.2.1 wird exakt validiert.
- Objektbaum enthält die freigegebenen 17 States.
- EventBus ist verfügbar.
- `System.Active=true` im regulären Betrieb.
- `System.Status=BEREIT`.
- `Diagnostics.ValidInput=true`.
- `Diagnostics.EventBusAvailable=true`.
- Zyklusstart wird korrekt publiziert.
- Zyklusende wird korrekt publiziert.
- andere EventEngine-Zwischenereignisse werden unterdrückt.
- UNREACH-Änderungen erzeugen Online-/Offline-Ereignisse.
- Alarmänderungen erzeugen die spezifizierten Alarmereignisse.
- bestehende Sequenz wird beim Start als verarbeitet markiert.
- keine NotificationBridge-States sind in `influxdb.0`, `influxdb.1` oder `statistics.0` aktiv.
- Routing entspricht der tatsächlichen Konfiguration `MATRIX:[0]`, `JARVIS:true`.

## 25. Freigabestatus

Scriptlogik, Objektbaum, EventEngine-Schnittstelle, NotificationCenter-EventBus, Duplikatschutz, direkte technische Ereignisse und Persistenz wurden geprüft.

**Freigabestatus: PASS**

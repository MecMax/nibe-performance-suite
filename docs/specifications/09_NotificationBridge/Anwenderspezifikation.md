# Anwenderspezifikation – 09_NPS_NotificationBridge v1.2.3

**NIBE Performance Suite (NPS) · Modul 09**  
**Stand:** 22.08.2026  
**Bezugsstand:** `09_NPS_NotificationBridge v1.2.3`  
**Status:** STABIL / BEOBACHTEN

## 1. Zweck

`09_NPS_NotificationBridge` verbindet die NIBE Performance Suite mit dem zentralen NotificationCenter.

Die Bridge nimmt ausgewählte NPS-Ereignisse sowie direkte technische NIBE-Signale entgegen, formatiert daraus standardisierte Benachrichtigungsereignisse und veröffentlicht diese ausschließlich auf dem EventBus des NotificationCenters.

Die eigentliche Zustellung an Matrix, Jarvis oder andere Kanäle erfolgt nicht durch die NotificationBridge selbst.

## 2. Architekturrolle

```text
08 EventEngine ─────────────┐
                            │
NIBE UNREACH ───────────────┼→ 09 NotificationBridge
                            │            ↓
NIBE Alarmnummer ───────────┘   NotificationCenter EventBus
                                         ↓
                               NotificationCenter / Kanäle
```

Die Bridge ist eine Integrationsschicht. Sie trifft keine fachliche Zustandsentscheidung für Verdichterabläufe.

## 3. NPS-Zyklusmeldungen

Aus der EventEngine werden nur zwei fachlich gewünschte Zyklusmeldungen veröffentlicht:

- `VERDICHTER_GESTARTET` → Wärmepumpenzyklus gestartet
- `VERDICHTER_GESTOPPT` → Wärmepumpenzyklus beendet

Zwischenzustände wie Anforderung, Betriebsartwechsel, Abtauung oder Auslauf werden nicht als eigene Zyklusbenachrichtigung weitergeleitet.

## 4. Zyklusstart

Die Startmeldung enthält insbesondere:

- Betriebsart,
- Startzeit,
- standardisierten Titel,
- standardisierten Ereignistyp.

## 5. Zyklusende

Die Endemeldung enthält insbesondere:

- Betriebsart,
- Laufzeit,
- Endzeit,
- standardisierten Titel,
- standardisierten Ereignistyp.

## 6. Kommunikationsüberwachung

Änderungen von `UNREACH` erzeugen:

- Wärmepumpe OFFLINE
- Wärmepumpe ONLINE

Damit kann ein Kommunikationsausfall unabhängig von der EventEngine gemeldet werden.

## 7. Alarmüberwachung

Änderungen der NIBE-Alarmnummer erzeugen:

- Alarm erkannt,
- Alarm beendet,
- Alarm geändert.

## 8. Duplikatschutz

Beim Start wird die aktuell vorhandene EventEngine-Sequenz als bereits verarbeitet gespeichert.

Dadurch wird ein vorhandenes altes Ereignis nach einem Neustart der NotificationBridge nicht erneut veröffentlicht.

## 9. NotificationCenter EventBus

Ein publiziertes Ereignis enthält insbesondere Event-UID, Ereignis-ID, Domain, Typ, Quelle, Kritikalität, Titel, Nachricht, Zeitstempel, Emoji/Icon, Kanalrouting und strukturierte Nutzdaten.

Die Bridge führt selbst keine Nachrichtenhistorie.

## 10. Routing

Die tatsächliche Implementierung verwendet für NPS-Zyklusereignisse, UNREACH und Alarmereignisse:

```text
matrix: [0]
jarvis: true
```

Damit wird Matrix auf `matrix-org.0` begrenzt; Jarvis-Routing bleibt aktiviert.

Die Bridge liefert lediglich die Routinginformation. Die tatsächliche Zustellung erfolgt durch das NotificationCenter.

## 11. System und Diagnose

Regulärer Betrieb:

```text
System.Active = true
System.Status = BEREIT
Diagnostics.ValidInput = true
Diagnostics.EventBusAvailable = true
```

Unter `Statistics.*` werden ausschließlich interne Diagnosezähler geführt. Diese haben nichts mit dem ioBroker-Adapter `statistics.0` zu tun.

## 12. Historisierung

Für die NotificationBridge ist keine zusätzliche Langzeitpersistenz vorgesehen:

```text
influxdb.0   → keine States
influxdb.1   → keine States
statistics.0 → keine States
```

## 13. Objektbaum

```text
NotificationBridge
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

## 14. Versionskette

```text
08_NPS_EventEngine        v1.2.1
          ↓
09_NPS_NotificationBridge v1.2.3
```

## 15. Version 1.2.3

Version 1.2.3 aktualisiert die feste Abhängigkeit auf `08_NPS_EventEngine v1.2.1`.

Routing-, Publikations- und Benachrichtigungslogik wurden dabei nicht verändert.

## 16. Freigabestatus

Objektbaum, EventEngine-Schnittstelle, EventBus-Publishing, Duplikatschutz, technische Direktmeldungen und Persistenz wurden geprüft.

**Freigabestatus: PASS**

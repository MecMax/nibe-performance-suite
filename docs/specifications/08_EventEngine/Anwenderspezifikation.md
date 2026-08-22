# Anwenderspezifikation – 08_NPS_EventEngine v1.2.1

**NIBE Performance Suite (NPS) · Modul 08**  
**Stand:** 22.08.2026  
**Bezugsstand:** `08_NPS_EventEngine v1.2.1`  
**Status:** STABIL / PASS

## 1. Zweck

Die EventEngine übersetzt tatsächliche Zustandswechsel der `07_NPS_StateMachine` in standardisierte NPS-Ereignisse.

Sie dokumentiert damit wichtige Betriebsabläufe wie Verdichterstart, Heiz- oder Brauchwasserbetrieb, Abtauung, Auslauf, Stopp und Störungszustände.

## 2. Abgrenzung

Die EventEngine:

- trifft keine eigene Zustandsentscheidung,
- berechnet keine Betriebsstatistiken,
- führt keine Ereignishistorie,
- versendet keine Matrix-, Jarvis-, Mail- oder sonstigen Benachrichtigungen.

Benachrichtigung und Routing sind Aufgabe der `09_NPS_NotificationBridge`.

## 3. Eingang

Die EventEngine liest ausschließlich die Public API der StateMachine:

```text
StateMachine.Current.State
StateMachine.Current.OperatingMode
StateMachine.Current.StartTime
StateMachine.Current.StopTime
StateMachine.Current.Runtime
```

## 4. Ereignisse

Typische Ereignisse sind:

| Ereignis | Bedeutung |
|---|---|
| `VERDICHTER_GESTARTET` | Verdichter ist angelaufen |
| `HEIZBETRIEB_GESTARTET` | Heizbetrieb wurde erreicht |
| `BRAUCHWASSERBETRIEB_GESTARTET` | Brauchwasserbereitung wurde erreicht |
| `POOLBETRIEB_GESTARTET` | Poolbetrieb wurde erreicht |
| `KUEHLBETRIEB_GESTARTET` | Kühlbetrieb wurde erreicht |
| `ABTAUUNG_GESTARTET` | Abtauung wurde begonnen |
| `ABTAUUNG_BEENDET` | Abtauung wurde beendet |
| `VERDICHTER_AUSLAUF` | Verdichter befindet sich im Auslauf |
| `VERDICHTER_GESTOPPT` | Verdichtertakt ist beendet |
| `VERDICHTER_STOERUNG` | StateMachine meldet STÖRUNG |
| `VERDICHTER_STOERUNG_BEENDET` | gültiger Zustand nach STÖRUNG wiederhergestellt |
| `ZUSTANDSWECHSEL` | sonstiger gültiger Zustandswechsel |

## 5. Kritikalität

Die EventEngine verwendet:

```text
info
success
error
```

Normale Betriebswechsel sind überwiegend `info`. Erfolgreich abgeschlossene Vorgänge wie Verdichterstopp oder beendete Abtauung sind `success`. Der Zustand `STÖRUNG` erzeugt `error`.

## 6. Public API

Der jeweils letzte vollständige Ereignisdatensatz wird unter:

```text
0_userdata.0.NPS.Events.Verdichter.*
```

bereitgestellt.

Er enthält insbesondere Ereignis-ID, Typ, Titel, Nachricht, Kritikalität, Zeitstempel, vorherigen und aktuellen Zustand, Betriebsart, Start-/Stoppzeit, Laufzeit und strukturierte Nutzdaten.

## 7. Sequenz als Commit-Signal

`Verdichter.Sequenz` ist die fortlaufende Ereignisnummer und zugleich das verbindliche Commit-/Triggersignal für nachgelagerte Module.

Alle anderen Ereignisfelder werden zuerst geschrieben. Erst danach wird die Sequenz erhöht.

Dadurch können Verbraucher davon ausgehen, dass beim Wechsel der Sequenz der zugehörige Ereignisdatensatz vollständig geschrieben ist.

## 8. Verhalten beim Start

Beim Start erzeugt die EventEngine bewusst kein rückwirkendes Ereignis.

Der aktuell gültige StateMachine-Zustand wird nur als Basis übernommen. Erst ein danach eintretender realer Zustandswechsel erzeugt ein neues Ereignis.

## 9. Schutz gegen ungültige Zwischenwerte

Nur die freigegebenen semantischen NPS-Zustände werden verarbeitet.

Kurzzeitig auftretende numerische oder sonstige ungültige Zwischenwerte werden ignoriert. Die EventEngine merkt sich den letzten gültigen semantischen Zustand und bildet Ereignisse nur zwischen gültigen Zuständen.

## 10. Historisierung

Die EventEngine selbst führt keine Historie und benötigt keine eigene InfluxDB- oder Statistics-Persistenz.

Die Ereignishistorie wird von nachgelagerten Komponenten aus dem Ereignisstrom aufgebaut.

## 11. Versionskette

```text
07_NPS_StateMachine       v1.2.1
          ↓
08_NPS_EventEngine        v1.2.1
          ↓
09_NPS_NotificationBridge v1.2.3
```

## 12. Version 1.2.1

Version 1.2.1 aktualisiert die feste Abhängigkeit auf `07_NPS_StateMachine v1.2.1`.

Die Ereignisdefinitionen, Public API und Publikationslogik bleiben unverändert.

## 13. Freigabestatus

Die EventEngine wurde im Zusammenspiel mit StateMachine, NotificationBridge und DashboardData geprüft.

**Freigabestatus: PASS**

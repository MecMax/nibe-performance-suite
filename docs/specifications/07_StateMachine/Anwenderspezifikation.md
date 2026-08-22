# Anwenderspezifikation – 07_NPS_StateMachine v1.2.1

**NIBE Performance Suite (NPS) · Modul 07**  
**Stand:** 22.08.2026  
**Bezugsstand:** `07_NPS_StateMachine v1.2.1`  
**Status:** STABIL / PASS

## 1. Zweck

Die StateMachine übersetzt die von `06_NPS_ProcessSignals` bereitgestellten, bereits normalisierten Prozesssignale in einen eindeutigen fachlichen Anlagenzustand.

Sie beantwortet insbesondere:

- Steht der Verdichter?
- Liegt eine Startanforderung vor?
- Befindet sich der Verdichter im Anlauf?
- Arbeitet die Anlage für Heizung, Warmwasser, Pool oder Kühlung?
- Läuft eine Abtauung?
- Befindet sich die Anlage im Auslauf?
- Sind die Eingangssignale ungültig und muss der Zustand `STÖRUNG` verwendet werden?

Die StateMachine greift nicht direkt auf Modbus-Register oder Alias-Datenpunkte zu.

## 2. Zustände

Die freigegebene Zustandsmenge lautet:

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

`Current.State` ist die fachliche Quelle für den aktuell erkannten Prozesszustand.

## 3. Wichtige Anwenderdaten

| Datenpunkt | Bedeutung |
|---|---|
| `Current.State` | Aktueller fachlicher Anlagenzustand |
| `Current.OperatingMode` | Aktuell erkannte Betriebsart |
| `Current.StartTime` | Startzeit des aktuellen Verdichtertakts |
| `Current.StopTime` | Stoppzeit des letzten Verdichtertakts |
| `Current.Runtime` | Laufzeit des aktuell laufenden Verdichtertakts in Sekunden |

## 4. Bedeutung von Current.Runtime

`Current.Runtime` beschreibt ausschließlich die Laufzeit eines **aktuell laufenden** Verdichtertakts.

Während eines laufenden Verdichterzustands wird die Laufzeit fortgeschrieben.

Sobald die StateMachine in einen nicht laufenden Zustand wechselt, gilt:

```text
Current.Runtime = 0 s
```

Damit darf im Stillstand keine Laufzeit des zuvor abgeschlossenen Takts stehen bleiben.

Die Laufzeit abgeschlossener Zyklen wird von nachgelagerten Modulen, insbesondere CycleRecorder/CycleAnalyzer und DashboardData, verwaltet.

## 5. Betriebsart

`Current.OperatingMode` kann insbesondere folgende Werte liefern:

```text
STANDBY
BRAUCHWASSER
HEIZUNG
POOL
KÜHLUNG
ABTAUUNG
UNBEKANNT
```

Die Betriebsart wird aus den semantischen ProcessSignals abgeleitet.

## 6. Start und Stopp eines Verdichtertakts

Beim Beginn eines laufenden Verdichterzustands wird die Taktstartzeit gespeichert.

Beim Ende des Takts wird die Stoppzeit gespeichert.

Nach dem Taktende:

- bleibt `Current.StopTime` als Information zum letzten Takt erhalten,
- bleibt die abgeschlossene Taktlaufzeit nicht in `Current.Runtime` stehen,
- `Current.Runtime` wird auf `0 s` gesetzt.

## 7. Störung

Sind erforderliche Eingangssignale nicht lesbar oder meldet ProcessSignals ungültige Signale, wechselt die StateMachine in:

```text
STÖRUNG
```

Sobald die erforderlichen Signale wieder lesbar und gültig sind, bestimmt die StateMachine den fachlich passenden aktuellen Zustand neu.

## 8. Zusammenspiel mit anderen NPS-Modulen

```text
06 ProcessSignals
       ↓
07 StateMachine
       ↓
08 EventEngine
       ↓
09 NotificationBridge

07 StateMachine
       ↓
10 DashboardData
```

Die EventEngine verwendet Zustandswechsel zur Ereigniserzeugung. DashboardData verwendet den aktuellen Zustand und die Taktinformationen für die Visualisierung.

## 9. Historisierung

Die StateMachine selbst erzeugt keine Langzeitstatistiken.

Für die langfristige Rekonstruktion des Anlagenbetriebs ist nur die Zeitreihe von `Current.State` fachlich erforderlich. Interne Memory-, Diagnose- und Systemwerte sollen nicht redundant historisiert werden.

Im konsolidierten NPS-Stand wird die aktive InfluxDB-Instanz `influxdb.0` verwendet; die frühere `influxdb.1`-Zuordnung ist nicht mehr Bestandteil des Sollstands.

`statistics.0` ist für die StateMachine nicht erforderlich.

## 10. Verhalten nach Neustart

Der für den Zustandsautomaten erforderliche Kontext wird unter `StateMachine.Memory.*` gespeichert.

Nach einem Neustart wird dieser Kontext wiederhergestellt und die Public API unmittelbar initialisiert. Danach erfolgt die reguläre Bewertung der aktuellen ProcessSignals.

## 11. Version 1.2.1

Version 1.2.1 enthält insbesondere den Bugfix:

```text
Takt beendet
    ↓
nicht laufender Zustand
    ↓
Current.Runtime = 0
```

Damit zeigt auch `DashboardData.Cycles.CurrentDuration` im Stillstand wieder korrekt `0 min`.

Zusätzlich ist die erforderliche ProcessSignals-Version auf `1.1.1` dokumentiert.

## 12. Freigabestatus

Die Version `07_NPS_StateMachine v1.2.1` wurde im Zusammenspiel mit EventEngine und DashboardData geprüft.

Das Verhalten `Current.Runtime = 0` nach Zyklusende wurde praktisch verifiziert.

**Freigabestatus: PASS**

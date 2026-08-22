# NPS – Technische Spezifikation
## Modul 02_NPS_EnergyAllocation

**Dokumentversion:** 1.0  
**Status:** FROZEN / technisch freigegeben  
**Bezugsstand:** `02_NPS_EnergyAllocation.js` Version **1.2.1**, Build 2026-08-18  
**Architekturschicht:** elektrische Energiezuordnung  
**Lizenz:** MIT

---

## T1. Architektur

Datenfluss:

```text
NPS ElectricalMeters.Aktuell.Gesamt ─┐
NIBE Alias prio ─────────────────────┼→ 02_NPS_EnergyAllocation
NIBE Alias Verdichterfrequenz ───────┘          ↓
                                      EnergyAllocation.Meters.*
```

Die Wärmeerzeugung ist ausdrücklich nicht Aufgabe dieses Moduls; sie bleibt Aufgabe von NPS VirtualMeters.

## T2. Konfiguration

```text
VERSION = 1.2.1
ROUND_DIGITS = 3
POST_RUN_WINDOW_MINUTES = 10
COMPRESSOR_ON_THRESHOLD_HZ = 0.1
WATCHDOG_CRON = */1 * * * *
STATE_CREATE_DELAY_MS = 1000
DEBUG = false
```

## T3. Eingänge

| Schlüssel | ID |
|---|---|
| `TOTAL_ELECTRICITY` | `0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt` |
| `PRIORITY` | `alias.0.Keller.Waschküche.Waermepumpe.prio` |
| `COMPRESSOR_FREQUENCY` | `alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)` |

Alle drei Objekte müssen beim Start existieren.

## T4. Objektstruktur

Der aktuelle Export enthält **37 Objekte: 32 States und 5 Containerobjekte (Root + 4 Channels)**.

Bereiche:

- `Meters`
- `Memory`
- `System`
- `Diagnostics`

### T4.1 Meters

Sieben kumulative `number`-States mit Einheit kWh:

`Heating`, `Warmwater`, `Standby`, `Pool`, `Cooling`, `Unknown`, `TotalAllocated`.

### T4.2 Persistenter Memory-Bereich

| State | Zweck |
|---|---|
| `Initialized` | Initialisierungsmarker |
| `LastTotalElectricity` | Vergleichsbasis für Delta |
| `LastPriority` | zuletzt beobachtete Priorität |
| `LastCompressorFrequency` | zuletzt beobachtete Frequenz |
| `CycleState` | persistenter Zykluszustand |
| `CycleCategory` | Kategorie des Zyklus |
| `CycleStartMs` | Startzeit |
| `CompressorStopMs` | Verdichterstopp |
| `PostRunUntilMs` | Ende Nachlauffenster |

## T5. Kategorien

```text
10 → Standby
20 → Warmwater
30 → Heating
40 → Pool
50 → Cooling
60 → Cooling
sonst → Unknown
```

Implementiert in `categoryForPriority()`.

## T6. Verdichtererkennung

```text
running = frequency > 0.1 Hz
```

Ein Wechsel von nicht laufend zu laufend öffnet einen Zyklus.

Ein Wechsel von laufend zu nicht laufend führt bei aktivem Zyklus in den Nachlauf.

## T7. Zustandsautomat

```text
READY    = BEREIT
ACTIVE   = ZYKLUS_AKTIV
POST_RUN = NACHLAUF
```

### T7.1 openCycle()

- Kategorie aus aktueller Priorität bestimmen
- Startzeit setzen
- Stop-/Nachlaufzeit löschen
- Zustand `ZYKLUS_AKTIV`
- Kategorie persistent speichern

### T7.2 enterPostRun()

- Verdichterstoppzeit setzen
- `PostRunUntilMs = now + 10 min`
- Kategorie des letzten Zyklus beibehalten
- Zustand `NACHLAUF`

### T7.3 closeCycle()

- Zustand `BEREIT`
- Kategorie leeren
- Zeitwerte auf 0
- Restnachlauf auf 0

## T8. Deltaermittlung

Bei Änderung des monotonen Gesamtzählers:

```text
delta = round(current - last, 3)
```

Danach wird `LastTotalElectricity` sofort auf `current` gesetzt.

### T8.1 delta < 0

Interpretation: Zählerreset.

Keine Verteilung.

### T8.2 delta = 0

Keine weitere Verarbeitung.

### T8.3 delta > 0

Kategorie wird über `determineAllocationCategory()` bestimmt und über `allocateDelta()` aufgeschlagen.

```text
Meters.<Kategorie> += delta
Meters.TotalAllocated += delta
```

## T9. Zuordnungspriorität

Die Kategorie wird in dieser Reihenfolge bestimmt:

1. `ZYKLUS_AKTIV` + vorhandene CycleCategory → Zykluskategorie
2. `NACHLAUF` + vorhandene CycleCategory + Nachlauf noch gültig → Zykluskategorie
3. sonst → Kategorie der aktuellen Betriebspriorität

Damit hat ein laufender bzw. nachlaufender Zyklus Vorrang vor einem zwischenzeitlich veränderten `prio`-Wert.

## T10. Ereignisse

Drei `change: ne`-Subscriptions:

- Gesamtstromzähler → `handleEnergyChange`
- Priorität → `handlePriorityChange`
- Verdichterfrequenz → `handleCompressorChange`

Der Watchdog läuft jede Minute und dient im Wesentlichen dazu, die verbleibende Nachlaufzeit zu aktualisieren und einen abgelaufenen Nachlauf zu schließen.

## T11. Recovery

Ist `Memory.Initialized=false`, wird `initializeMemory()` ausgeführt.

Bei bereits initialisiertem Modul setzt `recoverState()` beim Neustart:

- aktuellen Gesamtstromzähler als neue Basis,
- aktuelle Priorität,
- aktuelle Verdichterfrequenz.

Wichtig:

> Während eines Scriptstillstands entstandene elektrische Energie wird absichtlich nicht nachträglich verteilt.

Danach wird der persistente Zyklusstatus gegen die aktuelle Verdichterfrequenz plausibilisiert.

## T12. Fehlerbehandlung

### Fehlende Eingangsobjekte

`checkInputObjects()`:

```text
Diagnostics.ValidInput = false
System.Status = FEHLER
System.Active = false
```

### Eingangswerte beim Start nicht numerisch lesbar

```text
System.Status = WARTET
Diagnostics.ValidInput = false
```

In diesem Pfad werden keine Subscriptions und kein Watchdog registriert.

### Ungültiger Gesamtstromwert im laufenden Betrieb

```text
Diagnostics.ValidInput = false
Diagnostics.Warning = Ungültiger Gesamtverbrauchswert
```

## T13. Write-Semantik

`writeId()` schreibt nur, wenn sich der Wert tatsächlich geändert hat.

`addTo()` rundet auf drei Nachkommastellen.

Dadurch werden unveränderte Werte nicht künstlich erneut geschrieben.

## T14. Persistenz – verbindlicher Soll- und Ist-Stand

Alle sieben `Meters.*` werden einheitlich langfristig in `influxdb.0` historisiert.

| Meter | influxdb.0 | changesOnly | influxdb.1 | statistics.0 | sumDelta |
|---|---:|---:|---:|---:|---:|
| `Heating` | ja | `true` | deaktiviert | ja | `true` |
| `Warmwater` | ja | `true` | deaktiviert | ja | `true` |
| `Standby` | ja | `true` | deaktiviert | ja | `true` |
| `Pool` | ja | `true` | deaktiviert | ja | `true` |
| `Cooling` | ja | `true` | deaktiviert | ja | `true` |
| `Unknown` | ja | `true` | deaktiviert | ja | `true` |
| `TotalAllocated` | ja | `true` | deaktiviert | ja | `true` |

### T14.1 Persistenzregel

Für alle sieben kumulativen elektrischen Energiezähler gilt verbindlich:

```text
influxdb.0.enabled = true
influxdb.0.changesOnly = true

statistics.0.enabled = true
statistics.0.sumDelta = true
```

`influxdb.1` ist für diese sieben States nicht die aktive Historisierungsinstanz.

### T14.2 Begründung

Die `Meters.*` sind kumulative Langzeit-Energiezähler. Für sie ist eine langfristige Historie sinnvoll; ein lückenloses periodisches Raster bei unverändertem Wert ist dagegen nicht erforderlich.

`statistics.0` verwendet `sumDelta=true`, um aus den kumulativen Zählerständen Zeitraumdifferenzen abzuleiten.

### T14.3 Verantwortlichkeit

Die Persistenzkonfiguration liegt in `common.custom` der ioBroker-Objekte. Das produktive Modul selbst erzeugt oder verändert diese Adapterkonfiguration nicht.

Die aktuelle Objektprüfung bestätigt die Sollkonfiguration **7/7**.

## T15. Script ↔ Objektbaum

Die vom Script definierten Fach-, Memory-, System- und Diagnosestates sind im Export vorhanden.

Der aktuelle Runtime-Stand zeigt u. a.:

```text
System.Version = 1.2.1
System.Active = true
System.Status = BEREIT
Diagnostics.ValidInput = true
Memory.CycleState = BEREIT
```

Der Export enthält bereits reale Diagnosewerte, darunter erkannte Prioritätswechsel und verzögerte Nachlaufzuordnungen.

## T16. As-built-Auffälligkeiten

### A. Abhängigkeiten im Header

Unter `Abhängigkeiten / Erforderlich:` ist im Header keine konkrete erforderliche Moduldatei aufgeführt. Technisch besteht jedoch eine harte Laufzeitabhängigkeit zu:

```text
0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt
```

Damit ist das Modul faktisch von der Bereitstellung dieses States durch ElectricalMeters abhängig.

### B. Empfohlene Module

Im Header werden `04_NPS_CompressorMonitor.js` und `07_NPS_StateMachine.js` empfohlen. Das vorliegende Script liest jedoch keine States dieser Module direkt. Für die aktuelle Funktion sind sie daher keine direkte technische Eingangsabhängigkeit.

### C. Current-Energiedatenpunkte

Der Header nennt als Aufgabe „Bereitstellung gemeinsamer Current-Energiedatenpunkte“. Im vorliegenden Script werden jedoch ausschließlich States unter `EnergyAllocation.*` angelegt und beschrieben. Separate `Current`-Energiedatenpunkte außerhalb dieses Baums sind in dieser Version nicht implementiert.

### D. Influx

Die aktuelle teilweise Influx-Historisierung ist Objektkonfiguration und nicht Bestandteil der Scriptlogik.

## T17. Testfälle

1. **Verdichterstart bei Priorität 30**  
   Erwartung: `ZYKLUS_AKTIV`, Kategorie `Heating`.

2. **Priorität wechselt während Zyklus**  
   Erwartung: Zykluskategorie bleibt für die Delta-Zuordnung maßgeblich.

3. **Verdichterstopp**  
   Erwartung: `NACHLAUF` für 10 Minuten.

4. **Delta im Nachlauf**  
   Erwartung: Zuordnung zur letzten Zykluskategorie; `DelayedAllocations` steigt.

5. **Nachlauf abgelaufen**  
   Erwartung: Watchdog setzt `BEREIT`.

6. **Delta außerhalb Zyklus**  
   Erwartung: Kategorie anhand aktueller Priorität.

7. **Zählerreset**  
   Erwartung: kein negatives Delta auf Meters; `CounterResets` steigt.

8. **Scriptneustart**  
   Erwartung: aktueller Gesamtzähler wird neue Basis; Stillstandsdelta wird nicht verteilt.

9. **Unbekannte Priorität**  
   Erwartung: Kategorie `Unknown`.

10. **TotalAllocated**  
    Erwartung: steigt bei jedem erfolgreich verteilten positiven Delta exakt um denselben Betrag.

## T18. Prüfergebnis und Freigabe

**Script, Objektbaum und Persistenz sind im geprüften Stand grundsätzlich konsistent.**

Bestätigt:

- Version `1.2.1`
- sieben virtuelle elektrische Energiezähler vorhanden
- persistenter Memory-Bereich vorhanden
- System- und Diagnosestates vorhanden
- `7/7 Meters.*` auf `influxdb.0`
- für alle sieben `changesOnly=true`
- für alle sieben `statistics.0.enabled=true`
- für alle sieben `sumDelta=true`
- frühere aktive Zuordnungen zu `influxdb.1` sind deaktiviert

Weiterhin dokumentierte, derzeit nicht blockierende Punkte:

1. Die harte Laufzeitabhängigkeit von `0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt` sollte bei einer späteren Headerpflege ausdrücklich unter „Erforderlich“ genannt werden.
2. Die Header-Aussage „Bereitstellung gemeinsamer Current-Energiedatenpunkte“ entspricht dem aktuellen Script nicht und sollte bei einer späteren Code-/Headerrevision entfernt oder konkret umgesetzt werden.
3. `04_NPS_CompressorMonitor` und `07_NPS_StateMachine` werden im Header als empfohlen genannt, sind aber keine direkten Eingangsquellen dieser Version.

**Freigabestatus: technisch freigegeben und eingefroren.**

Änderungen an Datenquellen, Prioritätsmapping, Zyklus-/Nachlaufmodell, Persistenz oder Datenpunktstruktur erfordern künftig eine dokumentierte Spezifikationsänderung und eine neue Dokumentversion.

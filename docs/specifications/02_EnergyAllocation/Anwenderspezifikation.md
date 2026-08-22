# NPS – Anwenderspezifikation
## Modul 02_NPS_EnergyAllocation

**Dokumentversion:** 1.0  
**Status:** FROZEN / fachlich freigegeben  
**Bezugsstand:** `02_NPS_EnergyAllocation` Version **1.2.1**, Build 2026-08-18  
**Datenwurzel:** `0_userdata.0.NPS.EnergyAllocation`

---

## 1. Zweck

Das Modul verteilt den kumulativen elektrischen Gesamtverbrauch der Wärmepumpe auf virtuelle elektrische Energiezähler für die Betriebsarten Heizung, Brauchwasser, Standby, Pool, Kühlung und unbekannte Betriebszustände.

Die Zuordnung erfolgt ereignisgesteuert und berücksichtigt Verdichterzyklen. Dadurch können elektrische Zähleränderungen, die von der NIBE zeitverzögert gemeldet werden, noch dem zuvor beendeten Verdichterzyklus zugeordnet werden.

## 2. Eingangsdaten

Das Modul verwendet drei Eingänge:

| Bedeutung | Quelle |
|---|---|
| monotoner elektrischer Gesamtzähler | `0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt` |
| aktuelle Betriebspriorität | `alias.0.Keller.Waschküche.Waermepumpe.prio` |
| Verdichterfrequenz | `alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)` |

Die Eingänge werden ausschließlich gelesen.

## 3. Virtuelle elektrische Energiezähler

Unter `Meters.*` stehen sieben kumulative Zähler zur Verfügung:

| State | Bedeutung |
|---|---|
| `Heating` | elektrische Energie Heizung |
| `Warmwater` | elektrische Energie Brauchwasser |
| `Standby` | elektrische Energie Standby |
| `Pool` | elektrische Energie Pool |
| `Cooling` | elektrische Energie Kühlung |
| `Unknown` | nicht eindeutig zuordenbare elektrische Energie |
| `TotalAllocated` | Summe aller vom Modul zugeordneten elektrischen Energiedeltas |

Einheit aller Zähler: **kWh**.

## 4. Zuordnung der NIBE-Betriebspriorität

| Priorität | Kategorie |
|---:|---|
| 10 | Standby |
| 20 | Warmwater |
| 30 | Heating |
| 40 | Pool |
| 50 | Cooling |
| 60 | Cooling |
| sonstige | Unknown |

## 5. Zyklusmodell

Das Modul kennt drei interne Zykluszustände:

```text
BEREIT
  ↓ Verdichterstart
ZYKLUS_AKTIV
  ↓ Verdichterstopp
NACHLAUF
  ↓ nach 10 Minuten
BEREIT
```

Ein Verdichter gilt ab einer Frequenz von mehr als **0,1 Hz** als aktiv.

Während `ZYKLUS_AKTIV` werden Stromdeltas der beim Zyklusstart bestimmten Kategorie zugerechnet.

Nach dem Verdichterstopp bleibt diese Kategorie für **10 Minuten** erhalten. In diesem Nachlauf eintreffende Zähleränderungen werden weiterhin dem letzten Verdichterzyklus zugeordnet.

## 6. Verhalten außerhalb eines Verdichterzyklus

Liegt kein aktiver Zyklus und kein gültiger Nachlauf vor, wird ein neues Stromdelta anhand der aktuellen Betriebspriorität zugeordnet.

Damit kann beispielsweise ein Verbrauch bei Priorität 10 dem Standby-Zähler zugerechnet werden.

## 7. Behandlung eines Zählerresets

Ist der aktuelle Gesamtstromzähler kleiner als der zuvor gespeicherte Wert, erkennt das Modul einen Zählerreset.

Das negative Delta wird **nicht verteilt**. Stattdessen:

- steigt `Diagnostics.CounterResets`,
- `System.Status` wird `WARNUNG`,
- die Diagnose erhält einen entsprechenden Hinweis.

Der aktuelle Gesamtzähler wird anschließend als neue Vergleichsbasis gespeichert.

## 8. Neustartverhalten

Beim Neustart übernimmt das Modul den aktuellen elektrischen Gesamtzähler als neue Basis.

Dadurch wird bewusst **kein während eines Scriptstillstands entstandenes Delta nachträglich verteilt**, weil dessen korrekte Betriebsart nicht zuverlässig bestimmbar wäre.

Der persistente Zykluszustand wird anhand der aktuellen Verdichterfrequenz wiederhergestellt bzw. plausibilisiert.

## 9. Diagnose

Das Modul stellt unter `Diagnostics.*` u. a. bereit:

- Eingangsdaten gültig
- letztes Stromdelta
- zuletzt zugeordnete Kategorie
- Grund der letzten Zuordnung
- Zykluszustand
- aktive Kategorie
- verbleibende Nachlaufzeit
- Anzahl verzögerter Zuordnungen
- erkannte Zählerresets
- erkannte Prioritätswechsel
- Warnung
- Diagnosetrace

## 10. Systemstatus

Typische Statuswerte sind:

| Status | Bedeutung |
|---|---|
| `STARTET` | Initialisierung |
| `BEREIT` | normale Bereitschaft / letzte Zuordnung abgeschlossen |
| `AKTIV` | Verdichterzyklus geöffnet |
| `NACHLAUF` | 10-Minuten-Nachlauf aktiv |
| `WARNUNG` | z. B. Zählerreset erkannt |
| `FEHLER` | erforderlicher Eingang fehlt |
| `WARTET` | Eingangswerte beim Start nicht vollständig lesbar |
| `GESTOPPT` | Modul beendet |

## 11. Persistenz

Für alle sieben virtuellen Energiezähler ist die Persistenz nun einheitlich festgelegt:

- `Heating` → `influxdb.0`
- `Warmwater` → `influxdb.0`
- `Standby` → `influxdb.0`
- `Pool` → `influxdb.0`
- `Cooling` → `influxdb.0`
- `Unknown` → `influxdb.0`
- `TotalAllocated` → `influxdb.0`

Für alle sieben gilt:

```text
influxdb.0.enabled = true
changesOnly = true
statistics.0.enabled = true
statistics.0.sumDelta = true
```

Eine eventuell vorhandene frühere Zuordnung zu `influxdb.1` ist deaktiviert.

Begründung: Die sieben `Meters.*` sind kumulative elektrische Energiezähler und sollen langfristig für Tages-, Monats-, Jahres- und Effizienzvergleiche verfügbar bleiben. Ein künstliches 5-Minuten-Raster ist nicht erforderlich; historisiert werden daher nur tatsächliche Zähleränderungen.

## 12. Abgrenzung

Das Modul:

- erzeugt keine Wärmemengenzähler,
- berechnet keinen COP,
- verändert keine NIBE-Einstellungen,
- verändert keine Alias- oder Modbuswerte,
- rekonstruiert keine Energie aus Zeiträumen, in denen das Script nicht lief.

## 13. Erfolgskriterien

Der Betrieb ist plausibel, wenn:

- `System.Active = true`,
- `Diagnostics.ValidInput = true`,
- der Zyklusstatus zur Verdichteraktivität passt,
- jedes positive Gesamtstromdelta genau einer Kategorie zugeordnet wird,
- `TotalAllocated` mit jedem verteilten positiven Delta um denselben Betrag steigt,
- negative Deltas nicht verteilt werden.

## 14. Freigabestatus

Diese Anwenderspezifikation beschreibt den geprüften Stand von `02_NPS_EnergyAllocation` Version 1.2.1 einschließlich der verbindlich festgelegten Persistenz der sieben `Meters.*`.

**Status: fachlich freigegeben und eingefroren.**

Spätere Änderungen an Zuordnungslogik, Persistenz oder Datenpunkten sind als dokumentierte Spezifikationsänderung zu behandeln.

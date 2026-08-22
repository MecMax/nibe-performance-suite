# NPS – Anwenderspezifikation  
## Modul 01_NPS_VirtualMeters

**Dokumentversion:** 1.0  
**Dokumentstatus:** As-built / zur fachlichen Freigabe  
**Bezugsstand Modul:** `01_NPS_VirtualMeters` Version **1.2.1**, Build 2026-08-18  
**System:** NIBE S2125-12 + VVM S500  
**Datenwurzel:** `0_userdata.0.NPS.VirtualMeters`

---

## 1. Zweck

`01_NPS_VirtualMeters` stellt die zentralen kumulativen Wärmemengenzähler der NIBE Performance Suite bereit.

Das Modul übernimmt vier Wärmemengenzähler aus dem Alias-Datenraum, prüft deren Plausibilität und stellt daraus sechs normierte NPS-Zähler bereit:

- Heizenergie nur Verdichter
- Heizenergie inklusive interner Zusatzheizung
- Brauchwasserenergie nur Verdichter
- Brauchwasserenergie inklusive interner Zusatzheizung
- Gesamterzeugung nur Verdichter
- Gesamterzeugung inklusive interner Zusatzheizung

Die beiden Gesamtwerte werden aus Heizung plus Brauchwasser gebildet.

Das Modul führt **keine COP-, JAZ-, Delta- oder Zeitraumrechnung** durch. Diese Aufgaben gehören zu nachgelagerten NPS-Modulen.

---

## 2. Rolle innerhalb der NPS

Das Modul ist der **Single Point of Truth für Wärmemengenzähler**.

Für nachgelagerte NPS-Module gilt:

> Wärmemengenzähler werden ausschließlich aus `0_userdata.0.NPS.VirtualMeters.*` bezogen.

Direkte Zugriffe nachgelagerter Module auf die zugrunde liegenden Alias- oder Modbus-Wärmemengenzähler sind nicht vorgesehen.

Damit trennt das Modul die NIBE-/Alias-Ebene von der internen NPS-Verarbeitung.

---

## 3. Eingangsdaten

Das Modul liest vier kumulative Wärmemengenzähler:

| Bedeutung | Quelle |
|---|---|
| Heizung – nur Verdichter | `alias.0.Keller.Waschküche.Waermepumpe.Heizung_nur_Verdichter` |
| Heizung – inkl. interner Zusatzheizung | `alias.0.Keller.Waschküche.Waermepumpe.Heizung_einschl_interner_ZH` |
| Brauchwasser – nur Verdichter | `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_nur_Verdichter` |
| Brauchwasser – inkl. interner Zusatzheizung | `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_einschl_interner_ZH` |

Alle Eingänge werden **nur gelesen**.

---

## 4. Ausgabewerte

### 4.1 Öffentliche Wärmemengenzähler

| Datenpunkt | Bedeutung | Einheit |
|---|---|---:|
| `Heizung.NurVerdichter` | kumulative Heizenergie des Verdichters | kWh |
| `Heizung.InklusiveZusatzheizung` | kumulative Heizenergie inkl. interner Zusatzheizung | kWh |
| `Brauchwasser.NurVerdichter` | kumulative Brauchwasserenergie des Verdichters | kWh |
| `Brauchwasser.InklusiveZusatzheizung` | kumulative Brauchwasserenergie inkl. interner Zusatzheizung | kWh |
| `Gesamt.NurVerdichter` | Heizung + Brauchwasser, jeweils nur Verdichter | kWh |
| `Gesamt.InklusiveZusatzheizung` | Heizung + Brauchwasser, jeweils inkl. Zusatzheizung | kWh |

Alle sechs Werte sind kumulative Zähler und keine Zeitraumverbräuche.

### 4.2 Qualitätsinformationen

Unter `Qualitaet.*` stehen:

- `Gueltig` – die aktuellen Eingangswerte haben die Plausibilitätsprüfung bestanden.
- `Vollstaendig` – der aktuelle Eingangssatz ist vollständig und gültig.
- `LetzterGueltigerWert` – Zeitpunkt der letzten erfolgreichen Verarbeitung.

### 4.3 Systeminformationen

Unter `System.*` stehen insbesondere:

- Modulversion
- Aktivstatus
- Modulstatus
- letzter Start
- letzte erfolgreiche Aktualisierung
- letzte Meldung
- Heartbeat
- `StatisticsReady`

### 4.4 Diagnoseinformationen

Unter `Diagnose.*` stehen:

- Anzahl erfolgreicher Aktualisierungen
- Anzahl ungültiger Aktualisierungen
- letzte Warnung
- Diagnosetrace der letzten Verarbeitung

---

## 5. Aktualisierungsverhalten

Eine Aktualisierung wird ausgelöst:

1. einmal beim Modulstart nach erfolgreicher Initialisierung,
2. bei Änderungen eines der vier Eingangszähler, mit **250 ms Entprellung**,
3. zusätzlich durch einen Watchdog **alle fünf Minuten**.

Mehrere nahezu gleichzeitige Änderungen werden zusammengefasst. Überschneidet sich eine Aktualisierung mit einer bereits laufenden Verarbeitung, wird ein weiterer Lauf nachgeholt.

---

## 6. Plausibilitätsregeln

Ein Eingangswert ist verwendbar, wenn er:

- vorhanden und lesbar,
- numerisch,
- endlich,
- und größer oder gleich 0 ist.

Zusätzlich gelten:

- `Heizung.InklusiveZusatzheizung >= Heizung.NurVerdichter`
- `Brauchwasser.InklusiveZusatzheizung >= Brauchwasser.NurVerdichter`

Schlägt eine Prüfung fehl, werden die zuletzt gültigen Wärmemengenzähler **nicht überschrieben**.

---

## 7. Verhalten bei Fehlern

### Fehlender Eingang beim Start

Fehlt mindestens ein konfigurierter Alias-Datenpunkt:

- `Qualitaet.Gueltig = false`
- `Qualitaet.Vollstaendig = false`
- `System.Status = FEHLER`
- `System.Aktiv = false`
- die fehlenden Quellen werden in der Diagnose protokolliert.

### Ungültiger Wert im laufenden Betrieb

Bei nicht lesbaren, negativen oder unplausiblen Werten:

- bleiben die zuletzt gültigen sechs Wärmemengenzähler erhalten,
- `Qualitaet.Gueltig = false`,
- `Qualitaet.Vollstaendig = false`,
- `System.Status = WARTET`,
- der Diagnosezähler für ungültige Aktualisierungen steigt.

Sobald wieder ein vollständiger gültiger Eingangssatz vorliegt, wechselt das Modul selbstständig zurück auf `BEREIT`.

---

## 8. Bedeutung der Statuswerte

| Status | Bedeutung |
|---|---|
| `STARTET` | Initialisierung läuft |
| `BEREIT` | letzter Verarbeitungslauf war erfolgreich |
| `WARTET` | Eingangswerte sind momentan nicht vollständig gültig |
| `FEHLER` | struktureller oder interner Fehler |
| `GESTOPPT` | Script wurde beendet |

---

## 9. Historisierung und Zeitraumwerte

Im aktuellen Anlagenstand werden alle sechs öffentlichen Wärmemengenzähler:

- in `influxdb.0` historisiert,
- mit `changesOnly = true`,
- und in `statistics.0` mit `sumDelta = true` verarbeitet.

Damit bleiben die kumulativen Zähler selbst als Historie erhalten, während `statistics.0` aus ihren Änderungen Zeitraumwerte ableiten kann.

Das 5-Minuten-Watchdog-Intervall bedeutet **nicht**, dass bei unverändertem Zählerstand zwingend alle fünf Minuten ein neuer Influx-Punkt entsteht; das aktuelle Influx-Verhalten ist bewusst `changesOnly=true`.

---

## 10. Abgrenzung

Das Modul:

- verändert keine NIBE-Einstellungen,
- schreibt nicht auf Alias- oder Modbus-Datenpunkte,
- berechnet keine elektrische Energie,
- berechnet keinen COP oder JAZ,
- erzeugt keine Tages-, Wochen-, Monats- oder Jahresauswertung,
- bewertet nicht die Effizienz der Wärmepumpe.

Diese Funktionen liegen in anderen NPS-Modulen.

---

## 11. Anwenderseitige Erfolgskriterien

Das Modul arbeitet fachlich korrekt, wenn:

- `System.Aktiv = true`,
- `System.Status = BEREIT`,
- `Qualitaet.Gueltig = true`,
- `Qualitaet.Vollstaendig = true`,
- die vier Teilzähler den NIBE-Aliaswerten entsprechen,
- `Gesamt.NurVerdichter = Heizung.NurVerdichter + Brauchwasser.NurVerdichter`,
- `Gesamt.InklusiveZusatzheizung = Heizung.InklusiveZusatzheizung + Brauchwasser.InklusiveZusatzheizung`,
- und nachgelagerte Module ausschließlich die NPS-VirtualMeters verwenden.

---

## 12. As-built-Hinweise

Diese Spezifikation beschreibt den tatsächlich vorliegenden Stand aus Script 1.2.1 und aktuellem ioBroker-Objektbaum.

Zwei technische Details sind für Anwender besonders relevant:

1. `System.StatisticsReady` wird nach einer erfolgreichen Datenverarbeitung auf `true` gesetzt. Es ist im aktuellen Script **keine aktive Funktionsprüfung des Statistics-Adapters** implementiert.
2. `Qualitaet.Gueltig` und `Qualitaet.Vollstaendig` werden im aktuellen Programmablauf gemeinsam gesetzt und haben damit derzeit praktisch denselben Wahrheitswert.

---

## 13. Freigabestatus

**As-built-Dokumentation erstellt.**  
Eine fachliche Änderung des Moduls ist mit diesem Dokument noch nicht verbunden.

# NPS – Technische Spezifikation  
## Modul 01_NPS_VirtualMeters

**Dokumentversion:** 1.0  
**Dokumentstatus:** As-built / zur technischen Freigabe  
**Bezugsstand:** `01_NPS_VirtualMeters.js` Version **1.2.1**, Build 2026-08-18  
**Coding Standard laut Header:** NPS-CS-1.0  
**Architekturschicht:** Datenerfassung / Normalisierung  
**Lizenz:** MIT

---

## T1. Architektur und Verantwortung

### T1.1 Modulrolle

`01_NPS_VirtualMeters` normalisiert die kumulativen NIBE-Wärmemengenzähler in den NPS-Datenraum.

Wurzel:

```text
0_userdata.0.NPS.VirtualMeters
```

Das Modul ist gemäß AR-004 der **Single Point of Truth** für Wärmemengenzähler.

Datenfluss:

```text
NIBE / Modbus
    ↓
Alias
    ↓
01_NPS_VirtualMeters
    ↓
0_userdata.0.NPS.VirtualMeters.*
    ↓
Statistics / Folgemodule
```

Nachgelagerte NPS-Module dürfen für Wärmemengen nicht direkt auf die Alias- oder Modbus-Ebene zugreifen.

### T1.2 Schreibbereich

Fachlich schreibt das Script ausschließlich unter:

```text
0_userdata.0.NPS.VirtualMeters.*
```

Die vier Alias-Quellen werden ausschließlich gelesen.

### T1.3 Single Writer

Das Script versteht sich als Single Writer für seine Modulstates. Bestehende Objekte werden bei der Initialisierung nicht normalisiert oder überschrieben; `ensure*()` legt nur fehlende Objekte an.

---

## T2. Konfiguration

```javascript
VERSION = "1.2.1"
STATE_CREATE_DELAY_MS = 1000
DEBOUNCE_MS = 250
WATCHDOG_CRON = "*/5 * * * *"
```

### T2.1 Eingangsquellen

| Schlüssel | ioBroker-ID |
|---|---|
| `HEIZUNG_VERDICHTER` | `alias.0.Keller.Waschküche.Waermepumpe.Heizung_nur_Verdichter` |
| `HEIZUNG_INKL_ZUSATZ` | `alias.0.Keller.Waschküche.Waermepumpe.Heizung_einschl_interner_ZH` |
| `BRAUCHWASSER_VERDICHTER` | `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_nur_Verdichter` |
| `BRAUCHWASSER_INKL_ZUSATZ` | `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_einschl_interner_ZH` |

---

## T3. Öffentliche Fachschnittstelle

Die Public API besteht aus sechs kumulativen Zählern:

| Relative ID | Typ | Rolle | Einheit | Berechnung |
|---|---|---|---|---|
| `Heizung.NurVerdichter` | number | value.energy | kWh | direkte Normalisierung des Aliaswerts |
| `Heizung.InklusiveZusatzheizung` | number | value.energy | kWh | direkte Normalisierung des Aliaswerts |
| `Brauchwasser.NurVerdichter` | number | value.energy | kWh | direkte Normalisierung des Aliaswerts |
| `Brauchwasser.InklusiveZusatzheizung` | number | value.energy | kWh | direkte Normalisierung des Aliaswerts |
| `Gesamt.NurVerdichter` | number | value.energy | kWh | Heizung.NurVerdichter + Brauchwasser.NurVerdichter |
| `Gesamt.InklusiveZusatzheizung` | number | value.energy | kWh | Heizung.InklusiveZusatzheizung + Brauchwasser.InklusiveZusatzheizung |

Formeln:

```text
Gesamt.NurVerdichter
= Heizung.NurVerdichter
+ Brauchwasser.NurVerdichter

Gesamt.InklusiveZusatzheizung
= Heizung.InklusiveZusatzheizung
+ Brauchwasser.InklusiveZusatzheizung
```

---

## T4. Datenpunktbaum

Der aktuelle Objekt-Export enthält **28 Objekte**, davon **21 States** und **7 Channels**.

### T4.1 Qualitätsstates

| ID | Typ | Rolle | Zweck |
|---|---|---|---|
| `Qualitaet.Gueltig` | boolean | indicator | aktuelle Eingangswerte gültig |
| `Qualitaet.Vollstaendig` | boolean | indicator | Datensatz vollständig |
| `Qualitaet.LetzterGueltigerWert` | string | date | Zeitstempel letzter gültiger Lauf |

### T4.2 Systemstates

| ID | Typ | Rolle |
|---|---|---|
| `System.Version` | string | text |
| `System.Aktiv` | boolean | indicator |
| `System.Status` | string | text |
| `System.LetzterStart` | string | date |
| `System.LetzteAktualisierung` | string | date |
| `System.LetzteMeldung` | string | text |
| `System.Heartbeat` | string | date |
| `System.StatisticsReady` | boolean | indicator |

### T4.3 Diagnosestates

| ID | Typ | Rolle |
|---|---|---|
| `Diagnose.Aktualisierungen` | number | value |
| `Diagnose.UngueltigeAktualisierungen` | number | value |
| `Diagnose.LetzteWarnung` | string | text |
| `Diagnose.Trace` | string | siehe As-built-Abweichung |

---

## T5. Objektinitialisierung

### T5.1 Erzeugungslogik

Das Script nutzt:

- `ensureFolder()`
- `ensureChannel()`
- `ensureState()`
- `ensureNumber()`
- `ensureString()`
- `ensureBoolean()`

Grundregel:

```text
existiert Objekt/State bereits → keine Änderung
fehlt Objekt/State → anlegen
```

Damit werden bestehende `common`, `native` und `custom`-Eigenschaften nicht durch das Script überschrieben.

### T5.2 Konsequenz

Die tatsächliche Objektstruktur kann Metadaten enthalten, die aus `00_Structure`, Admin-Konfiguration oder früheren Versionen stammen.

Dies ist im aktuellen Export sichtbar und muss bei Soll-/Ist-Prüfungen berücksichtigt werden.

---

## T6. Eingangswerte und Validierung

### T6.1 Numerische Validierung

`readNumber()` akzeptiert nur Werte, die:

```text
nicht undefined
nicht null
nicht ""
Number(value) endlich
value >= 0
```

sind.

Andernfalls:

```text
valid = false
value = null
```

### T6.2 Plausibilitätsprüfung

Zusätzlich gilt:

```text
Heizung.InklusiveZusatzheizung
>= Heizung.NurVerdichter
```

und:

```text
Brauchwasser.InklusiveZusatzheizung
>= Brauchwasser.NurVerdichter
```

### T6.3 Fehlerstrategie

Bei ungültigem Eingangssatz werden die sechs zuletzt gültigen Fachwerte nicht überschrieben.

Gesetzt werden:

```text
Diagnose.UngueltigeAktualisierungen += 1
Qualitaet.Gueltig = false
Qualitaet.Vollstaendig = false
System.Status = "WARTET"
System.LetzteMeldung = "Wärmemengenzähler nicht vollständig gültig"
Diagnose.LetzteWarnung = <Fehlertext>
```

Bei internem Exception-Pfad:

```text
System.Status = "FEHLER"
System.LetzteMeldung = "Interner Verarbeitungsfehler"
```

---

## T7. Erfolgreicher Verarbeitungslauf

Bei gültigen Eingängen:

1. vier Teilzähler schreiben,
2. zwei Gesamtzähler berechnen und schreiben,
3. `Diagnose.Aktualisierungen` erhöhen,
4. Zeitstempel erzeugen,
5. Qualitäts- und Systemstates aktualisieren,
6. Diagnosetrace schreiben.

Erfolgszustand:

```text
Qualitaet.Gueltig = true
Qualitaet.Vollstaendig = true
System.StatisticsReady = true
System.Status = "BEREIT"
Diagnose.LetzteWarnung = ""
```

---

## T8. Trigger- und Laufzeitmodell

### T8.1 Start

`start()`:

1. Objektbaum sicherstellen,
2. 1000 ms warten,
3. Systemstates initialisieren,
4. Existenz der vier Eingänge prüfen,
5. Trigger registrieren,
6. 5-Minuten-Watchdog registrieren,
7. sofort `performUpdate()` ausführen,
8. `started = true`.

### T8.2 Änderungstrigger

Für alle vier Alias-Quellen:

```javascript
change: "ne"
```

Die Verarbeitung wird über `requestUpdate()` um **250 ms** entprellt.

### T8.3 Watchdog

```text
*/5 * * * *
```

`performUpdate()` läuft damit mindestens alle fünf Minuten, auch wenn kein Aliaswert geändert wurde.

### T8.4 Parallelisierungsschutz

```text
updateRunning
updatePending
```

Verhindert parallele Aktualisierungsläufe.

Wenn während eines laufenden Updates eine weitere Anforderung eintrifft:

```text
updatePending = true
```

Nach Abschluss wird genau ein weiterer Lauf über `setTimeout(..., 0)` nachgeholt.

### T8.5 Stop

`onStop()` setzt:

```text
System.Aktiv = false
System.Status = "GESTOPPT"
System.LetzteMeldung = "Modul wurde beendet"
```

---

## T9. Schreibsemantik

`write(id, value)` schreibt nur, wenn:

```text
State nicht vorhanden → Warnung, kein Schreiben
oder
aktueller Wert !== neuer Wert → setState(..., ack=true)
```

Unveränderte Werte erzeugen somit **keinen erneuten State-Write**.

Das ist für die Persistenz relevant: Der 5-Minuten-Watchdog garantiert einen Verarbeitungslauf, aber kein künstliches 5-Minuten-Raster für unveränderte Wärmemengenzähler.

---

## T10. Persistenz – aktueller As-built-Stand

Alle sechs Public-API-Zähler sind derzeit auf `influxdb.0` und `statistics.0` konfiguriert.

| State | influxdb.0 | changesOnly | statistics.0 | sumDelta |
|---|---:|---:|---:|---:|
| `Heizung.NurVerdichter` | ja | `true` | ja | `true` |
| `Heizung.InklusiveZusatzheizung` | ja | `true` | ja | `true` |
| `Brauchwasser.NurVerdichter` | ja | `true` | ja | `true` |
| `Brauchwasser.InklusiveZusatzheizung` | ja | `true` | ja | `true` |
| `Gesamt.NurVerdichter` | ja | `true` | ja | `true` |
| `Gesamt.InklusiveZusatzheizung` | ja | `true` | ja | `true` |

### T10.1 Bedeutung

- Influx speichert die kumulativen Zählerstände bei Änderungen.
- Statistics berechnet mit `sumDelta=true` die Zählerdifferenzen für Zeitraumsauswertungen.
- Die Persistenzkonfiguration liegt im ioBroker-Objekt unter `common.custom` und wird vom Script selbst weder erzeugt noch verändert.

---

## T11. Datenqualität und Diagnose

### T11.1 `Qualitaet.Gueltig` und `Qualitaet.Vollstaendig`

Im aktuellen Programmablauf werden beide States immer gemeinsam auf `true` bzw. `false` gesetzt.

Damit existieren zwei semantisch unterschiedliche Datenpunkte, deren Logik in Version 1.2.1 praktisch identisch ist.

### T11.2 `System.StatisticsReady`

Der State wird bei jedem erfolgreichen Verarbeitungslauf auf `true` gesetzt.

Das Script prüft **nicht**, ob:

- `statistics.0` installiert ist,
- die sechs States dort tatsächlich aktiviert sind,
- oder der Adapter funktionsfähig ist.

Der aktuelle technische Bedeutungsumfang ist daher:

> „Ein gültiger VirtualMeters-Datensatz wurde erfolgreich geschrieben.“

Nicht nachgewiesen wird eine echte Statistics-Adapter-Bereitschaft.

---

## T12. Script ↔ Objektbaum – As-built-Abgleich

### T12.1 Grundsätzlich passend

Die sechs Public-API-States, Qualitäts-, System- und Diagnosestates sind im aktuellen Objektbaum vorhanden.

Der aktuelle Runtime-Stand zeigt u. a.:

```text
System.Version = 1.2.1
System.Aktiv = true
System.Status = BEREIT
Qualitaet.Gueltig = true
Qualitaet.Vollstaendig = true
```

### T12.2 Bekannte Metadatenabweichungen

#### A. Root-Objekttyp

Das Script würde `{root}` bei Neuinstallation als `folder` anlegen.

Im aktuellen Objektbaum ist `{root}` jedoch ein `channel`.

Da `ensureFolder()` vorhandene Objekte nicht verändert, bleibt der bestehende Typ erhalten.

**Bewertung:** funktional unkritisch; As-built-Struktur hat Vorrang.

#### B. Root-Name

Script-Neuanlage:

```text
NPS VirtualMeters
```

Aktueller Objektbaum:

```text
Virtuelle Zähler
```

**Bewertung:** reine Metadatenabweichung.

#### C. `Diagnose.Trace` Rolle

Das Script legt `Diagnose.Trace` über `ensureString()` ohne explizite Rolle als:

```text
role = text
```

an.

Im aktuellen Objektbaum steht:

```text
role = json
```

Der tatsächliche Inhalt ist jedoch eine mehrzeilige Textdarstellung und **kein JSON**.

**Bewertung:** technische Metadatenabweichung. Bei einer späteren Bereinigung wäre `role=text` fachlich konsistenter zum Inhalt.

#### D. Änderungsverlauf

Script/Header melden Version **1.2.1**, der dokumentierte Änderungsverlauf enthält jedoch Einträge für 1.2.0, 1.0.1 und 1.0.0, aber keinen eigenen 1.2.1-Eintrag.

**Bewertung:** Dokumentationslücke im Scriptheader; keine Laufzeitabweichung.

---

## T13. Sicherheits- und Architekturregeln

Das Modul darf:

- vier Alias-Wärmemengenzähler lesen,
- ausschließlich NPS-VirtualMeters-States beschreiben.

Das Modul darf nicht:

- NIBE-Parameter verändern,
- Alias-Werte verändern,
- Modbus-Werte verändern,
- COP/JAZ berechnen,
- andere NPS-Fachmodule ersetzen.

AR-004 bleibt verbindlich:

> Alle Folgemodule verwenden für Wärmemengen ausschließlich `0_userdata.0.NPS.VirtualMeters.*`.

---

## T14. Technische Testfälle

### T14.1 Normalbetrieb

**Voraussetzung:** vier gültige, plausible Aliaswerte.

**Erwartung:**

```text
Qualitaet.Gueltig = true
Qualitaet.Vollstaendig = true
System.Status = BEREIT
```

und korrekte sechs Wärmemengenzähler.

### T14.2 Negativer Eingang

**Test:** ein Eingang < 0.

**Erwartung:**

- Fachwerte bleiben auf letztem gültigem Stand.
- `System.Status = WARTET`.
- Ungültig-Zähler steigt.

### T14.3 Zusatzheizungszähler kleiner als Verdichterzähler

**Erwartung:** Datensatz wird abgewiesen.

### T14.4 Fehlender Eingang beim Start

**Erwartung:**

```text
System.Status = FEHLER
System.Aktiv = false
```

Keine Trigger-/Watchdog-Registrierung nach gescheiterter Startvalidierung.

### T14.5 Recovery

Nach einem ungültigen Lauf werden wieder gültige Werte geliefert.

**Erwartung:** nächster Trigger/Watchdog-Lauf setzt das Modul selbstständig wieder auf `BEREIT`.

### T14.6 Gesamtzähler

Für beliebige gültige Eingänge muss exakt gelten:

```text
Gesamt.NurVerdichter
= Heizung.NurVerdichter + Brauchwasser.NurVerdichter
```

und entsprechend für `InklusiveZusatzheizung`.

### T14.7 Watchdog

Ohne Eingangswertänderung muss `performUpdate()` alle fünf Minuten laufen. Wegen der Write-on-change-Semantik müssen dabei nicht zwingend neue Zähler-State-Timestamps entstehen.

---

## T15. Freigabe- und Änderungsregel

Dieses Dokument beschreibt **As-built Version 1.2.1**.

Vor einer Änderung am produktiven Modul sollten:

1. gewünschte Änderung fachlich spezifiziert,
2. technische Auswirkung dokumentiert,
3. Script und Objektbaum geprüft,
4. Persistenz-/Statistics-Auswirkungen bewertet,
5. Versionsnummer und Änderungsverlauf angepasst

werden.

---

## T16. Prüfergebnis

**Script und Objektbaum sind funktional konsistent.**

Es bestehen keine erkennbaren fachlichen Blocker für den aktuellen Betrieb.

Dokumentations-/Metadatenpunkte für eine spätere Bereinigung:

1. fehlender Änderungsverlaufseintrag für 1.2.1,
2. `Diagnose.Trace` ist im Objektbaum als `role=json` hinterlegt, obwohl der Inhalt Text ist,
3. `System.StatisticsReady` ist keine echte Adapter-Bereitschaftsprüfung,
4. `Qualitaet.Gueltig` und `Qualitaet.Vollstaendig` besitzen derzeit identische Laufzeitlogik,
5. Root-Typ/-Name unterscheiden sich von einer vollständigen Neuanlage durch dieses Script, weil die bestehende NPS-Struktur erhalten bleibt.

Diese Punkte werden in dieser As-built-Spezifikation dokumentiert, aber **nicht automatisch als Codeänderung umgesetzt**.

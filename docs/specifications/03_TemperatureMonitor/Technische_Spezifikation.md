# Technische Spezifikation – 03_NPS_TemperatureMonitor v1.0.2

**NIBE Performance Suite (NPS) · Modul 03**  
**Stand:** 22.08.2026  
**Bezugsstand:** `03_NPS_TemperatureMonitor v1.0.2`, Build 18.08.2026  
**Status:** STABIL

## 1. Modulidentität und Verantwortung

| Merkmal | Festlegung |
|---|---|
| Modul | `03_NPS_TemperatureMonitor` |
| Version | `1.0.2` |
| Build | `2026-08-18` |
| Status | STABIL |
| Architekturschicht | Datenerfassung / Normalisierung |
| Coding Standard | NPS-CS-1.0 |
| Root | `0_userdata.0.NPS.TemperatureMonitor` |
| Gerät | NIBE S2125-12 + VVM S500 |

Das Modul ist Single Writer für seine States unter `NPS.TemperatureMonitor`. Es erfasst, validiert, normalisiert und publiziert Temperatur- und Hydraulikwerte. Energie-, COP-, JAZ- und Optimierungslogik liegen ausdrücklich außerhalb der Modulgrenze.

## 2. Eingänge

| Schlüssel | Alias | Verwendung |
|---|---|---|
| `OUTDOOR` | `alias.0.Keller.Waschküche.Waermepumpe.Außenlufttemperatur_(EB101-BT28)` | Außenlufttemperatur |
| `SUPPLY` | `alias.0.Keller.Waschküche.Waermepumpe.Vorlauf` | Vorlauftemperatur |
| `RETURN` | `alias.0.Keller.Waschküche.Waermepumpe.Ruecklauf` | Rücklauftemperatur |
| `FLOW` | `alias.0.Keller.Waschküche.Waermepumpe.Volumenstrommesser_(BF1)` | Volumenstrom |

Alle Eingänge werden ausschließlich gelesen.

## 3. Public API

| State | Typ / Einheit | Berechnung / Quelle |
|---|---|---|
| `Temperatures.Outdoor` | number / °C | OUTDOOR, gerundet |
| `Temperatures.Supply` | number / °C | SUPPLY, gerundet |
| `Temperatures.Return` | number / °C | RETURN, gerundet |
| `Temperatures.Spread` | number / K | SUPPLY − RETURN |
| `Temperatures.MeanHeatingWater` | number / °C | (SUPPLY + RETURN) / 2 |
| `Temperatures.TemperatureLift` | number / K | SUPPLY − OUTDOOR |
| `Hydraulics.Flow` | number / l/min | FLOW, gerundet |

## 4. Interne System- und Diagnose-States

| State | Funktion |
|---|---|
| `System.Version` | Aktive Modulversion |
| `System.Active` | Aktivstatus |
| `System.LastStart` | Letzter Modulstart |
| `System.LastUpdate` | Letzte erfolgreiche Aktualisierung |
| `System.Status` | STARTET/BEREIT/WARTET/FEHLER/GESTOPPT |
| `System.LastMessage` | Letzte Modulmeldung |
| `Diagnostics.ValidInput` | Gültigkeit der Eingänge |
| `Diagnostics.InvalidUpdates` | Zähler ungültiger Aktualisierungen |
| `Diagnostics.Warning` | Warn-/Fehlertext |
| `Diagnostics.Trace` | Trace der letzten Aktualisierung |

## 5. Validierungsregeln

| Eingang | Zulässiger Bereich |
|---|---:|
| Outdoor | -60 bis +70 °C |
| Supply | -20 bis +100 °C |
| Return | -20 bis +100 °C |
| Flow | 0 bis 300 l/min |

Zusätzlich müssen alle vier Werte vorhanden, numerisch lesbar und endlich sein.

Bei ungültigen Werten:

1. `Diagnostics.InvalidUpdates` wird erhöht.
2. `Diagnostics.ValidInput=false`.
3. `Diagnostics.Warning` enthält die Ursache.
4. `System.Status=WARTET`.
5. Die fachlichen Ausgänge werden nicht überschrieben.

Fehlen bereits beim Start erforderliche Eingangsobjekte, wird `System.Status=FEHLER` gesetzt.

## 6. Ablauf und Trigger

Beim Start werden Root, Channels und States bei Bedarf angelegt.

Nach:

```text
STATE_CREATE_DELAY_MS = 1000 ms
```

werden Version, Aktivstatus und Startinformationen gesetzt und die Eingangsdatenpunkte geprüft.

Bei erfolgreicher Initialisierung:

1. erste unmittelbare Aktualisierung,
2. anschließend Scheduler mit:

```text
UPDATE_CRON = '* * * * *'
```

Damit erfolgt eine Aktualisierung einmal pro Minute.

Beim Stoppen wird der Scheduler entfernt und der Modulstatus auf `GESTOPPT` gesetzt.

## 7. Rundung

```text
ROUND_DIGITS = 1
```

Alle fachlichen Mess- und Berechnungswerte werden auf eine Nachkommastelle gerundet.

## 8. Berechnungsregeln

```text
Spread = Supply - Return

MeanHeatingWater = (Supply + Return) / 2

TemperatureLift = Supply - Outdoor
```

Die Berechnung erfolgt auf Basis der eingelesenen Werte; anschließend werden die Ergebnisse gerundet.

## 9. Persistenz-Soll

Die sieben Public-API-Messwerte sind für die Zeitreihenhistorie vorgesehen.

Für den konsolidierten NPS-Anlagenstand gilt:

| State | `influxdb.0` | `statistics.0` |
|---|---:|---:|
| `Temperatures.Outdoor` | ja, changesOnly | nein |
| `Temperatures.Supply` | ja, changesOnly | nein |
| `Temperatures.Return` | ja, changesOnly | nein |
| `Temperatures.Spread` | ja, changesOnly | nein |
| `Temperatures.MeanHeatingWater` | ja, changesOnly | nein |
| `Temperatures.TemperatureLift` | ja, changesOnly | nein |
| `Hydraulics.Flow` | ja, changesOnly | nein |

Die frühere Spezifikation dokumentierte hierfür `influxdb.1`. Diese Instanz wurde im Zuge der Konsolidierung deaktiviert bzw. entfernt; maßgeblich ist nun `influxdb.0`.

System- und Diagnose-States benötigen keine fachliche Langzeitpersistenz.

## 10. Bereinigte Legacy-Struktur

Nicht mehr Bestandteil der v1.0.2-Schnittstelle sind insbesondere:

```text
TemperatureMonitor.Heizung.*
System.LetzteAktualisierung
System.LetzteMeldung
```

Die aktuelle Schnittstelle verwendet ausschließlich:

```text
Temperatures.*
Hydraulics.*
System.*
Diagnostics.*
```

## 11. Architekturregeln

- Eigenständiges Fachmodul; keine Zusammenlegung mit anderen NPS-Modulen.
- Single Writer für alle States unter `NPS.TemperatureMonitor`.
- Ungültige Eingänge überschreiben keine zuletzt gültigen Messwerte.
- Nachfolgende Module verwenden die Public API des TemperatureMonitor.
- Keine Energie-, COP-, JAZ- oder Optimierungsberechnung.
- Keine `statistics.0`-Abhängigkeit.

## 12. Objektstruktur

```text
0_userdata.0.NPS.TemperatureMonitor
├── Temperatures
│   ├── Outdoor
│   ├── Supply
│   ├── Return
│   ├── Spread
│   ├── MeanHeatingWater
│   └── TemperatureLift
├── Hydraulics
│   └── Flow
├── System
│   ├── Version
│   ├── Active
│   ├── LastStart
│   ├── LastUpdate
│   ├── Status
│   └── LastMessage
└── Diagnostics
    ├── ValidInput
    ├── InvalidUpdates
    ├── Warning
    └── Trace
```

## 13. Abhängigkeiten

- ioBroker JavaScript-Adapter
- vier vorhandene und numerisch lesbare Alias-Eingänge

Das Modul besitzt in v1.0.2 keine feste Laufzeitabhängigkeit zu `00_NPS_Structure`.

## 14. Abnahmekriterien

- Modulversion ist `1.0.2`.
- Alle vier Alias-Eingänge existieren und sind numerisch lesbar.
- Alle sieben Public-API-States existieren.
- Bei gültigen Eingängen gilt `Diagnostics.ValidInput=true`.
- Bei gültigen Eingängen gilt `System.Status=BEREIT`.
- Berechnungen entsprechen den dokumentierten Formeln.
- Alle fachlichen Werte werden auf eine Nachkommastelle gerundet.
- Ungültige Eingänge überschreiben keine zuletzt gültigen fachlichen Werte.
- Die sieben fachlichen States werden über `influxdb.0` historisiert.
- `statistics.0` ist für TemperatureMonitor nicht erforderlich.
- Keine Legacy-States unter `TemperatureMonitor.Heizung.*`.
- Keine alten deutschen System-States `LetzteAktualisierung` oder `LetzteMeldung`.

## 15. Freigabestatus

Der produktive Quellstand `03_NPS_TemperatureMonitor v1.0.2` ist als stabiler NPS-V1-Stand dokumentiert.

**Freigabestatus: STABIL**

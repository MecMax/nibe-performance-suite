# Technische Spezifikation -- 04_NPS_CompressorMonitor v1.0.2

**NIBE Performance Suite (NPS) · Modul 04**\
**Stand:** 22.08.2026\
**Bezugsstand:** `04_NPS_CompressorMonitor v1.0.2`\
**Status:** STABIL

## 1. Modulidentität und Verantwortung

  Merkmal              Festlegung
  -------------------- --------------------------------------
  Modul                `04_NPS_CompressorMonitor`
  Version              `1.0.2`
  Status               STABIL
  Architekturschicht   Datenerfassung / Normalisierung
  Root                 `0_userdata.0.NPS.CompressorMonitor`
  Anlage               NIBE S2125-12 + VVM S500

Der CompressorMonitor ist Single Writer für seine States unter
`NPS.CompressorMonitor`.

Seine Verantwortung umfasst Erfassung, Validierung, Normalisierung und
Publikation der grundlegenden Verdichterdaten. Periodenstatistiken,
Zyklusbewertung, Energie- und Effizienzanalyse liegen außerhalb der
Modulgrenze.

## 2. Eingänge

Das Modul verwendet vier Alias-Eingänge für:

-   aktuelle Verdichterfrequenz,
-   kumulative Verdichterstarts,
-   Verdichterstatus,
-   kumulative Verdichterlaufzeit.

Alle Eingänge werden ausschließlich gelesen.

## 3. Public API

  ------------------------------------------------------------------------
  State                    Typ / Einheit           Funktion
  ------------------------ ----------------------- -----------------------
  `Compressor.Frequency`   number / Hz             Aktuelle
                                                   Verdichterfrequenz

  `Compressor.Starts`      number                  Kumulative
                                                   Verdichterstarts

  `Compressor.Status`      string                  Technischer
                                                   Verdichterstatus

  `Compressor.Runtime`     number / h              Kumulative
                                                   Verdichterlaufzeit

  `Compressor.Running`     boolean                 Abgeleiteter aktueller
                                                   Verdichterbetrieb
  ------------------------------------------------------------------------

## 4. System- und Diagnose-States

  ------------------------------------------------------------------------------
  State                          Typ                     Funktion
  ------------------------------ ----------------------- -----------------------
  `System.Version`               string                  Aktive Modulversion

  `System.Active`                boolean                 Aktivstatus

  `System.LastStart`             string/date             Letzter Modulstart

  `System.LastUpdate`            string/date             Letzte erfolgreiche
                                                         Aktualisierung

  `System.Status`                string                  Modulstatus

  `System.LastMessage`           string                  Letzte Modulmeldung

  `Diagnostics.ValidInput`       boolean                 Gültigkeit der Eingänge

  `Diagnostics.InvalidUpdates`   number                  Zähler ungültiger
                                                         Aktualisierungen

  `Diagnostics.Warning`          string                  Warn-/Fehlertext

  `Diagnostics.Trace`            string                  Trace der letzten
                                                         Aktualisierung
  ------------------------------------------------------------------------------

## 5. Verarbeitung

Beim Start werden die erforderlichen Channels und States bereitgestellt
und die Eingangsquellen geprüft.

Nach erfolgreicher Initialisierung erfolgt eine erste Aktualisierung.
Danach arbeitet das Modul in einem minütlichen Raster.

Die Eingangswerte werden validiert und anschließend in die normierte
Public API übernommen. `Compressor.Running` wird als eindeutiges
Betriebssignal aus den Verdichterdaten abgeleitet.

## 6. Fehlerverhalten

Bei ungültigen Eingangsdaten:

-   wird `Diagnostics.ValidInput` entsprechend gesetzt,
-   wird `Diagnostics.InvalidUpdates` erhöht,
-   wird eine Warn-/Fehlerinformation bereitgestellt,
-   wird der Modulstatus angepasst,
-   werden ungültige Werte nicht ungeprüft als neue fachliche Werte
    publiziert.

## 7. Persistenz-Soll

  State                      `influxdb.1`   `changesOnly`   `statistics.0`
  ------------------------ -------------- --------------- ----------------
  `Compressor.Frequency`               ja          `true`             nein
  `Compressor.Running`                 ja          `true`             nein
  `Compressor.Starts`                nein              --             nein
  `Compressor.Runtime`               nein              --             nein
  `Compressor.Status`                nein              --             nein

Für `Frequency` und `Running` dient `influxdb.1` der zeitlichen
Betriebsanalyse.

`Starts` und `Runtime` sind kumulative Quellwerte. Im CompressorMonitor
wird bewusst keine zweite Statistics-Kette aufgebaut. Die für Dashboard
und Periodenwerte benötigte Statistics-Verarbeitung erfolgt in der
nachgelagerten DashboardData-Struktur.

`Status` wird nicht historisiert, da der technische Rohstatus für die
vorgesehenen NPS-Auswertungen keine eigene Zeitreihe benötigt.

## 8. DashboardData-Abgrenzung

DashboardData darf die Public API des CompressorMonitor als Quelle
verwenden.

Insbesondere gilt:

-   `Frequency` dient als aktueller Verdichterfrequenzwert und kann für
    nachgelagerte Frequenzkennzahlen verwendet werden.
-   `Running` dient als eindeutiges Verdichter-Betriebssignal.
-   `Starts` und `Runtime` stellen kumulative Grundwerte bereit.
-   Tages- und Periodenwerte für Starts und Laufzeit gehören nicht zum
    CompressorMonitor.
-   Eine Statistics-Konfiguration direkt auf `CompressorMonitor.Starts`
    oder `CompressorMonitor.Runtime` ist für die bestehende Architektur
    nicht erforderlich.

## 9. Objektstruktur

``` text
0_userdata.0.NPS.CompressorMonitor
├── Compressor
│   ├── Frequency
│   ├── Running
│   ├── Runtime
│   ├── Starts
│   └── Status
├── Diagnostics
│   ├── InvalidUpdates
│   ├── Trace
│   ├── ValidInput
│   └── Warning
└── System
    ├── Active
    ├── LastMessage
    ├── LastStart
    ├── LastUpdate
    ├── Status
    └── Version
```

Es wurden keine zusätzlichen Legacy-States im geprüften Objektbaum
festgestellt.

## 10. Architekturregeln

1.  Der CompressorMonitor ist Single Writer seiner eigenen Public API.
2.  Alias-Quellen werden ausschließlich gelesen.
3.  Nachfolgende NPS-Module sollen die normierte Public API verwenden,
    sofern diese den benötigten Wert bereitstellt.
4.  Periodenstatistiken und Taktanalysen werden nicht in Modul 04
    implementiert.
5.  Keine Energie-, COP- oder Effizienzberechnung in Modul 04.
6.  Keine Schreibzugriffe auf NIBE-, Modbus- oder Alias-Quellen.
7.  `Frequency` und `Running` werden ausschließlich über `influxdb.1`
    historisiert.
8.  Für `Starts`, `Runtime` und `Status` wird im CompressorMonitor keine
    zusätzliche Persistenz eingerichtet.

## 11. Abnahmekriterien

-   Alle erforderlichen Alias-Eingänge sind vorhanden und lesbar.
-   Alle fünf Public-API-States existieren.
-   System- und Diagnose-States entsprechen der freigegebenen Struktur.
-   Bei gültigen Eingängen ist `Diagnostics.ValidInput=true`.
-   Das Modul aktualisiert die Verdichterdaten im vorgesehenen Raster.
-   `Compressor.Running` wird korrekt als Boolean bereitgestellt.
-   `Frequency` ist auf `influxdb.1` mit `changesOnly=true`
    konfiguriert.
-   `Running` ist auf `influxdb.1` mit `changesOnly=true` konfiguriert.
-   `Starts`, `Runtime` und `Status` besitzen keine zusätzliche
    CompressorMonitor-Historisierung.
-   Keine Legacy-/Zusatzstates außerhalb der spezifizierten Struktur.

## 12. Freigabestatus

Objektbaum, Public API, Influx-Zuordnung, Statistics-Abgrenzung und
Nutzung durch die nachgelagerte DashboardData-Architektur wurden
geprüft.

**Freigabestatus: PASS**

# Anwenderspezifikation -- 04_NPS_CompressorMonitor v1.0.2

**NIBE Performance Suite (NPS) · Modul 04**\
**Stand:** 22.08.2026\
**Bezugsstand:** `04_NPS_CompressorMonitor v1.0.2`\
**Status:** STABIL

## 1. Zweck

Der CompressorMonitor stellt die grundlegenden Betriebsdaten des
Verdichters in einer einheitlichen NPS-Struktur bereit. Er erfasst
Verdichterfrequenz, kumulative Verdichterstarts, Verdichterstatus und
kumulative Laufzeit und leitet daraus den Zustand `Running` ab.

Das Modul dient als verlässliche Datenbasis für nachfolgende NPS-Module,
DashboardData und Visualisierungen.

## 2. Abgrenzung

Der CompressorMonitor berechnet selbst keine Tageswerte, Taktkennzahlen,
mittlere Zyklusdauer, Energie-, COP- oder Effizienzkennzahlen.

Insbesondere gehören die Auswertung von Starts und Laufzeit nach
Zeitperioden sowie die Verdichteranalyse nicht in dieses Modul.

Das Modul verändert keine NIBE-Einstellungen und schreibt nicht in die
Alias-Eingänge.

## 3. Bereitgestellte Werte

  ------------------------------------------------------------------------
  Datenpunkt               Bedeutung               Einheit
  ------------------------ ----------------------- -----------------------
  `Compressor.Frequency`   Aktuelle                Hz
                           Verdichterfrequenz      

  `Compressor.Starts`      Kumulative Anzahl der   --
                           Verdichterstarts        

  `Compressor.Status`      Technischer             Text
                           Verdichterstatus        

  `Compressor.Runtime`     Kumulative              h
                           Verdichterlaufzeit      

  `Compressor.Running`     Zeigt an, ob der        Boolean
                           Verdichter aktuell      
                           läuft                   
  ------------------------------------------------------------------------

## 4. Aktualisierung

Nach erfolgreicher Initialisierung erfolgt eine erste Aktualisierung.
Anschließend werden die Verdichterdaten einmal pro Minute neu eingelesen
und geprüft.

## 5. Verdichter läuft

`Compressor.Running` wird aus den aktuellen Verdichterdaten abgeleitet.
Der State dient nachfolgenden Modulen und Visualisierungen als
eindeutiges Betriebssignal.

## 6. Verhalten bei ungültigen Daten

Fehlende, nicht numerische oder unplausible Eingangswerte werden nicht
ungeprüft in die Public API übernommen.

Der Modulstatus und die Diagnose-Datenpunkte zeigen Fehler- bzw.
Wartezustände an. Ungültige Aktualisierungsversuche werden gezählt.

## 7. Status und Diagnose

  -----------------------------------------------------------------------
  Datenpunkt                          Bedeutung
  ----------------------------------- -----------------------------------
  `System.Active`                     Zeigt an, ob das Modul aktiv ist

  `System.Status`                     Aktueller Modulzustand

  `System.LastStart`                  Zeitpunkt des letzten Modulstarts

  `System.LastUpdate`                 Zeitpunkt der letzten erfolgreichen
                                      Aktualisierung

  `System.LastMessage`                Letzte verständliche Modulmeldung

  `System.Version`                    Aktive Modulversion

  `Diagnostics.ValidInput`            Gültigkeit der Eingangsdaten

  `Diagnostics.InvalidUpdates`        Anzahl ungültiger Aktualisierungen

  `Diagnostics.Warning`               Aktuelle Warn- oder
                                      Fehlerbeschreibung

  `Diagnostics.Trace`                 Diagnoseprotokoll der letzten
                                      Aktualisierung
  -----------------------------------------------------------------------

## 8. Historisierung

Für den CompressorMonitor ist folgende Persistenz festgelegt:

  Datenpunkt               InfluxDB         `changesOnly` Statistics
  ------------------------ -------------- --------------- ------------
  `Compressor.Frequency`   `influxdb.1`            `true` nein
  `Compressor.Running`     `influxdb.1`            `true` nein
  `Compressor.Starts`      keine                       -- nein
  `Compressor.Runtime`     keine                       -- nein
  `Compressor.Status`      keine                       -- nein

`Starts` und `Runtime` werden im CompressorMonitor bewusst nicht
zusätzlich über `statistics.0` ausgewertet. Die periodische Auswertung
dieser Größen erfolgt in der dafür vorgesehenen nachgelagerten
DashboardData-Kette.

## 9. Anwenderbewertung

Ein normaler Betriebszustand liegt vor, wenn:

-   `System.Active = true`
-   `System.Status = BEREIT`
-   `Diagnostics.ValidInput = true`

Bei `WARTET` oder `FEHLER` sollten zuerst `Diagnostics.Warning` und
`Diagnostics.Trace` geprüft werden.

## 10. Freigegebener Objektbaum

``` text
CompressorMonitor
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

## 11. Freigabestatus

Für `04_NPS_CompressorMonitor v1.0.2` wurden Objektbaum, Public API,
Persistenz und Abgrenzung zu DashboardData geprüft.

**Freigabestatus: PASS**

# Persistenz-Spezifikation – 10_NPS_DashboardData v5.11.0-rc.2

**NIBE Performance Suite (NPS) · Modul 10**
**Stand:** 26.08.2026
**Bezugsstand:** `10_NPS_DashboardData v5.11.0-rc.2`
**Strukturversion:** 35
**Status:** RC / Funktionsprüfung PASS

## 1. Ziel

Diese Spezifikation trennt klar zwischen:

1. fachlichen Quellzählern,
2. `statistics.0`-Periodenbildung,
3. fertigen DashboardData-Tageswerten,
4. `influxdb.0`-Zeitreihen für HistoryGraphs,
5. reinen Präsentationsprojektionen wie `HeatingOptimization`.

Ziel ist die Vermeidung redundanter oder widersprüchlicher Persistenz.

## 2. Grundprinzip

```text
Fachlicher kumulativer Quellzähler
          ↓
     statistics.0
   save.sumDelta.*
          ↓
     DashboardData
   Perioden/Tageswerte
          ↓
ausgewählte fertige History-Werte
          ↓
       influxdb.0
```

`statistics.0` und `influxdb.0` haben unterschiedliche Aufgaben.

Fachlich bereits verdichtete Analyseergebnisse werden von DashboardData nicht erneut akkumuliert.

## 3. statistics.0

`statistics.0` wird an den fachlichen Quellzählern aktiviert, wenn aus kumulativen Zählern Periodendeltas benötigt werden.

DashboardData liest diese Werte, insbesondere `save.sumDelta`.

DashboardData soll seine daraus erzeugten Anzeige-DPs nicht erneut mit `statistics.0` akkumulieren.

## 4. influxdb.0

`influxdb.0` ist die aktive Zeitreiheninstanz im konsolidierten NPS-Stand.

Die deaktivierte frühere Instanz `influxdb.1` gehört nicht mehr zum Sollbestand dieser DashboardData-Spezifikation.

## 5. DashboardData-Grundregel

Nicht pauschal historisieren:

```text
Overview.*
Performance.*
Temperatures.*
Compressor.*        (außer History)
Energy.*            (außer History)
Electrical.*
Cycles.*
Defrost.*
Events.*
HeatingOptimization.*
System.*
Help.*
```

Diese Werte sind primär View-Model-/Anzeigezustände oder werden bereits an fachlich geeigneterer Stelle historisiert.

## 6. Compressor-History

Folgende fertige Tageswerte werden in `influxdb.0` historisiert:

| State | Einheit | Quelle |
|---|---:|---|
| `Compressor.History.StartsPerDay` | Anzahl | abgeschlossenes `statistics.0.save.sumDelta` |
| `Compressor.History.RuntimePerDay` | min | abgeschlossenes `statistics.0.save.sumDelta` |

Sie werden nicht zusätzlich mit `statistics.0` versehen.

## 7. Energy-History

Folgende fertige Tageswerte werden in `influxdb.0` historisiert:

| State | Einheit |
|---|---:|
| `Energy.History.ElectricTotalPerDay` | kWh |
| `Energy.History.ElectricHeatingPerDay` | kWh |
| `Energy.History.ElectricWarmwaterPerDay` | kWh |
| `Energy.History.ElectricZHPerDay` | kWh |
| `Energy.History.HeatTotalPerDay` | kWh |
| `Energy.History.HeatHeatingPerDay` | kWh |
| `Energy.History.HeatWarmwaterPerDay` | kWh |
| `Energy.History.HeatZHPerDay` | kWh |

Die Werte repräsentieren abgeschlossene Tagesperioden und dienen direkt der Zeitreihendarstellung.

## 8. Energy-Periodenvergleich

`Energy.PeriodComparisonJson` ist ein formatierter Anzeige-DP und wird nicht als Zeitreihe historisiert.

## 9. Performance-Periodenvergleich

`Performance.PeriodComparisonJson` ist ebenfalls ein formatierter Anzeige-DP. Keine eigene Influx- oder Statistics-Persistenz.

## 10. Cycles.History

`Cycles.History` ist eine begrenzte JSON-Tabelle der letzten maximal 20 abgeschlossenen Zyklen und keine Influx-Zeitreihe.

## 11. Events.History

`Events.History` ist eine begrenzte JSON-Tabelle der letzten maximal 50 Ereignisse. Keine zusätzliche `statistics.0`-Konfiguration und keine pauschale Influx-Historisierung des JSON-States.

## 12. Temperatures

DashboardData.Temperatures ist eine Präsentationskopie bzw. Ergänzung fachlicher Temperaturwerte. Langzeit-Temperaturhistorie soll an den vorgesehenen fachlichen Temperatur-/Quellstates geführt werden.

## 13. Overview / Health / System

Health-, Status-, Diagnose-, Farb-, Icon- und Hilfsstates sind View-Model-Zustände und benötigen grundsätzlich weder `statistics.0` noch eine pauschale Influx-Historisierung.

## 14. Electrical

`Electrical.CurrentPower` ist ein Anzeige-Livewert. Die langfristige Datenhaltung erfolgt über ElectricalMeters bzw. die vorgesehenen fachlichen Quellen.

## 15. HeatingOptimization

`DashboardData.HeatingOptimization` ist eine reine Präsentationsprojektion der fachlichen Daten aus `15_NPS_HeatingCurveAnalyzer`.

Dies umfasst insbesondere:

- Status und aktuellen Anlagenzustand,
- Raumkomfort und Raumabweichungen,
- 72-h-Hauptanalyse,
- Evidence-/Analysehinweise,
- Datenqualität und Quellenprüfung,
- aktuelle Heizungs-/Heizkurvenkonfiguration,
- aufbereitete JSON-Tabellen.

Die fachliche Analyse und Verdichtung erfolgt ausschließlich in `15_NPS_HeatingCurveAnalyzer`.

Für `DashboardData.HeatingOptimization.*` wird daher weder `statistics.0` noch eine pauschale Historisierung über `influxdb.0` eingerichtet.

Dies gilt auch für:

```text
HeatingOptimization.Tables.RoomsJson
HeatingOptimization.Tables.AnalysisWindowsJson
HeatingOptimization.Tables.EvidenceJson
HeatingOptimization.Tables.DataQualityJson
```

Diese States sind Präsentationstabellen und keine Zeitreihen.

Falls zukünftig Langzeitanalysen der Heizkurvenoptimierung benötigt werden, ist deren Persistenz fachlich am HeatingCurveAnalyzer bzw. an ausdrücklich dafür vorgesehenen History-States zu definieren. Eine redundante Historisierung der DashboardData-Präsentationsstates ist nicht vorgesehen.

## 16. Unterschiedliche Erfassungsstartpunkte

Kumulative obere Energy-Werte und Statistics-Perioden können unterschiedliche Startzeitpunkte besitzen. Eine daraus entstehende Abweichung ist kein Persistenzfehler, solange beide Werte aus ihren spezifizierten Quellen und Zeitbasen korrekt gebildet werden.

## 17. Sollmatrix

| Bereich | `influxdb.0` | `statistics.0` auf DashboardData |
|---|---|---|
| Overview | nein | nein |
| Performance | nein | nein |
| Temperatures | nein* | nein |
| Compressor Live | nein | nein |
| Compressor.History | **ja** | nein |
| Energy Live/Period JSON | nein | nein |
| Energy.History | **ja** | nein |
| Electrical | nein | nein |
| Cycles | nein | nein |
| Defrost | nein | nein |
| Events | nein | nein |
| HeatingOptimization | nein | nein |
| System | nein | nein |
| Help | nein | nein |

\* Temperaturzeitreihen werden an den fachlich vorgesehenen Temperatur-/Quellstates historisiert.

## 18. Verbotene Doppelung

Nicht zulässig:

```text
Quellzähler
→ statistics.0
→ DashboardData-Anzeigewert
→ statistics.0 erneut
```

Ebenso soll ein bereits fachlich historisierter Livewert nicht ohne konkreten Zweck zusätzlich als identische DashboardData-Kopie historisiert werden.

Für HeatingOptimization gilt entsprechend:

```text
15_NPS_HeatingCurveAnalyzer
→ fachliche Analyse/Verdichtung
→ DashboardData.HeatingOptimization
→ keine erneute fachliche Akkumulation
→ keine pauschale redundante Historisierung
```

## 19. Abnahme

Im Konsolidierungsstand vom 22.08.2026 wurde geprüft:

- aktive Influx-Instanz ist `influxdb.0`,
- History-DPs für Compressor und Energy sind gezielt historisiert,
- `statistics.0` dient der Delta-/Periodenbildung an den Quellzählern,
- DashboardData-Historywerte werden nicht nochmals statistisch akkumuliert,
- Live-/View-Model-DPs werden nicht pauschal doppelt historisiert.

Für v5.11.0-rc.2 wird zusätzlich festgelegt:

- `HeatingOptimization.*` ist eine Präsentationsprojektion von Modul 15,
- keine `statistics.0`-Akkumulation auf `DashboardData.HeatingOptimization.*`,
- keine pauschale `influxdb.0`-Historisierung von `DashboardData.HeatingOptimization.*`,
- die vier `HeatingOptimization.Tables.*`-JSON-States sind reine Präsentationsdaten,
- zukünftige Langzeitpersistenz der Heizkurvenanalyse ist fachlich in Modul 15 bzw. ausdrücklich vorgesehenen History-States zu spezifizieren.

**Persistenzstatus: RC / Funktionsprüfung PASS**

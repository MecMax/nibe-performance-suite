# Persistenz-Spezifikation – 10_NPS_DashboardData v5.10.2

**NIBE Performance Suite (NPS) · Modul 10**  
**Stand:** 22.08.2026  
**Bezugsstand:** `10_NPS_DashboardData v5.10.2`  
**Status:** FREIGEGEBEN

## 1. Ziel

Diese Spezifikation trennt klar zwischen:

1. fachlichen Quellzählern,
2. `statistics.0`-Periodenbildung,
3. fertigen DashboardData-Tageswerten,
4. `influxdb.0`-Zeitreihen für HistoryGraphs.

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

`statistics.0` und `influxdb.0` haben damit unterschiedliche Aufgaben.

## 3. statistics.0

`statistics.0` wird an den fachlichen Quellzählern aktiviert, wenn aus kumulativen Zählern Periodendeltas benötigt werden.

DashboardData liest diese Werte, insbesondere `save.sumDelta`.

Typische Perioden:

```text
15 Minuten
60 Minuten
24 Stunden
Heute/Gestern
Woche
Monat
Quartal
Jahr
```

DashboardData soll seine daraus erzeugten Anzeige-DPs nicht erneut mit `statistics.0` akkumulieren.

## 4. influxdb.0

`influxdb.0` ist die aktive Zeitreiheninstanz im konsolidierten NPS-Stand.

Die deaktivierte frühere Instanz `influxdb.1` gehört nicht mehr zum Sollbestand.

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

Diese Werte sind bewusst für HistoryGraphs bestimmt.

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

Sie werden nicht erneut mit `statistics.0` akkumuliert.

## 8. Energy-Periodenvergleich

`Energy.PeriodComparisonJson` ist ein formatierter Anzeige-DP und wird nicht als Zeitreihe historisiert.

Er enthält 14 Statistics-Perioden, die aus den zugrunde liegenden Statistics-Werten erzeugt werden.

Die eigentliche Persistenz liegt an den fachlichen Quellen bzw. den fertigen Tages-History-DPs, nicht am JSON.

## 9. Performance-Periodenvergleich

`Performance.PeriodComparisonJson` ist ebenfalls ein formatierter Anzeige-DP.

Keine eigene Influx- oder Statistics-Persistenz.

Die enthaltenen Kennzahlen werden bei Aktualisierung aus den fachlichen Periodenquellen neu berechnet.

## 10. Cycles.History

`Cycles.History` ist eine begrenzte JSON-Tabelle der letzten maximal 20 abgeschlossenen Zyklen.

Sie ist eine Anzeige-History innerhalb des States und keine Influx-Zeitreihe.

Die zugrunde liegenden Zyklusdaten stammen aus CycleAnalyzer/CycleRecorder.

## 11. Events.History

`Events.History` ist eine begrenzte JSON-Tabelle der letzten maximal 50 Ereignisse.

Sie wird sequenzgesteuert aus EventEngine-Ereignissen aufgebaut.

Keine zusätzliche `statistics.0`-Konfiguration; keine pauschale Influx-Historisierung des JSON-States.

## 12. Temperatures

DashboardData.Temperatures ist eine Präsentationskopie bzw. Ergänzung fachlicher Temperaturwerte.

Langzeit-Temperaturhistorie soll an den dafür vorgesehenen fachlichen Temperatur-/Quellstates geführt werden, nicht redundant an sämtlichen DashboardData-Temperaturstates.

## 13. Overview / Health / System

Health-, Status-, Diagnose-, Farb-, Icon- und Hilfsstates sind View-Model-Zustände.

Sie benötigen grundsätzlich weder `statistics.0` noch eine pauschale Influx-Historisierung.

## 14. Electrical

`Electrical.CurrentPower` ist ein Anzeige-Livewert.

Die langfristige elektrische Energie- und Leistungsdatenhaltung erfolgt über ElectricalMeters bzw. die vorgesehenen fachlichen Quellen. DashboardData erzeugt keine parallele Langzeitquelle.

## 15. Unterschiedliche Erfassungsstartpunkte

Kumulative obere Energy-Werte und Statistics-Perioden können unterschiedliche Startzeitpunkte besitzen.

Daher ist beispielsweise nicht zwingend:

```text
Energy.HeatHeating
=
PeriodComparison → Laufendes Jahr → Wärme Heizung
```

solange beide Werte aus ihren spezifizierten Quellen und Zeitbasen korrekt gebildet werden.

Diese Abweichung ist kein Persistenzfehler.

## 16. Sollmatrix

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
| System | nein | nein |
| Help | nein | nein |

`*` Temperaturzeitreihen werden an den fachlich vorgesehenen Temperatur-/Quellstates historisiert.

## 17. Verbotene Doppelung

Nicht zulässig ist eine Architektur nach dem Muster:

```text
Quellzähler
→ statistics.0
→ DashboardData-Anzeigewert
→ statistics.0 erneut
```

Ebenso soll ein bereits fachlich historisierter Livewert nicht ohne konkreten Zweck zusätzlich als identische DashboardData-Kopie historisiert werden.

## 18. Abnahme

Im Konsolidierungsstand vom 22.08.2026 wurde geprüft:

- aktive Influx-Instanz ist `influxdb.0`,
- History-DPs für Compressor und Energy sind gezielt historisiert,
- `statistics.0` dient der Delta-/Periodenbildung an den Quellzählern,
- DashboardData-Historywerte werden nicht nochmals statistisch akkumuliert,
- Live-/View-Model-DPs werden nicht pauschal doppelt historisiert.

**Persistenzstatus: PASS**

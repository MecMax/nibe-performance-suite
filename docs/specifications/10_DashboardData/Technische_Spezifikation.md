# Technische Spezifikation – 10_NPS_DashboardData v5.10.2

**NIBE Performance Suite (NPS) · Modul 10**  
**Stand:** 22.08.2026  
**Bezugsstand:** `10_NPS_DashboardData v5.10.2`  
**Build:** 18.08.2026  
**Strukturversion:** 33  
**Status:** STABIL / PASS

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `10_NPS_DashboardData` |
| Version | `5.10.2` |
| Strukturversion | `33` |
| Schicht | Präsentationsschicht / Dashboard-Datenadapter |
| Root | `0_userdata.0.NPS.DashboardData` |
| Coding Standard | `NPS-CS-1.0` |
| Single Writer | ja |

DashboardData ist die zentrale, Jarvis-optimierte View-Model-Schicht der NPS.

## 2. Architekturregeln

1. Keine Veränderung fachlicher Quelldaten.
2. Single Writer für `0_userdata.0.NPS.DashboardData`.
3. Fehlende Quelldaten werden als ungültig/null behandelt und nicht automatisch als 0 interpretiert.
4. Gesamtstrom stammt ausschließlich aus ElectricalMeters.
5. Wärmemengen stammen ausschließlich aus VirtualMeters.
6. Stromaufteilung stammt weiterhin aus EnergyAllocation.
7. Betriebsartenfarben und Bewertungsfarben bleiben getrennte Konzepte.
8. Fachliche Quellmodule bleiben Single Source of Truth; DashboardData formatiert und aggregiert für die Anzeige.

## 3. Hauptstruktur

```text
DashboardData
├── Overview
├── Performance
├── Temperatures
├── Compressor
├── Energy
├── Electrical
├── Cycles
├── Defrost
├── Events
├── Periods
├── Statistics
├── System
└── Help
```

## 4. Aktualisierungsmodell

- ereignisgesteuerte Aktualisierung bei Änderungen relevanter NPS-Quellen,
- vollständiger Watchdog-Refresh alle fünf Minuten,
- Zielaktualität der Livewerte unter einer Sekunde.

Ereignis-History wird nicht bei jedem Watchdoglauf erweitert, sondern nur bei einer neuen EventEngine-Sequenz.

## 5. Betriebsartenfarben

```text
Heizung     #C45A32
Warmwasser  #00A6A6
Standby     #78909C
Abtauen     #8E5BB7
Kühlen      #2196F3
Aus         #616161
Unbekannt   grey
```

`#C45A32` bleibt Statusfarbe für aktive Betriebsanzeigen und ist keine normale Messkurvenfarbe.

## 6. Bewertungsfarben

```text
lime
green
yellow
orange
red
grey
```

Health:

```text
>=98  lime
>=90  green
>=80  yellow
>=60  orange
<60   red
```

## 7. Overview

Overview aggregiert Betriebsart, Zykluszustand, StateMachine-Zustand, technische Alarm-/Bereitschaftsinformation und Health.

Wesentliche Ausgaben umfassen:

```text
Mode
ModeColor
ModeIcon
ActiveCycle
ActiveCycleType
State
Notice
AlarmNumber
AlarmActive
TechnicalState
Status
HealthPercent
HealthState
HealthColor
HealthMessage
HealthReason
HealthDetails
HealthTable
HealthLastUpdate
LastUpdate
```

`HealthDetails` ist das technische Diagnose-JSON. `HealthTable` ist die Jarvis-optimierte Tabelle mit wirksamen Einzelabzügen; bei 100 % wird „Keine Abzüge“ ausgegeben.

## 8. Performance

Wesentliche Ausgaben:

```text
Performance.ThermalPower
Performance.LiveCOP
Performance.LiveCOPValid
Performance.PeriodComparisonJson
```

Der Periodenvergleich enthält:

- COP gesamt,
- COP Heizung,
- COP Warmwasser,
- Verdichteranteil,
- Zusatzheizungsanteil,

für Heute, Gestern, laufende Woche, laufenden Monat und laufendes Jahr.

Alle öffentlichen COP-Ausgaben werden auf eine Nachkommastelle gerundet.

### 8.1 Gesamt-COP

Gesamt-COP verwendet die gesamte relevante Wärmemenge und den elektrischen Gesamtverbrauch aus ElectricalMeters.

### 8.2 Warmwasser-COP

Warmwasser-COP verwendet Warmwasserwärme und den Warmwasser zugeordneten Strom aus EnergyAllocation.

Damit kann COP gesamt fachlich niedriger als COP Warmwasser sein.

## 9. Energy

Energy stellt kumulative Energie-, COP- und Anteilswerte sowie Periodenvergleiche bereit.

Quellenprinzip:

```text
Gesamtstrom     → ElectricalMeters
Wärmemengen     → VirtualMeters
Stromaufteilung → EnergyAllocation
```

`Energy.PeriodComparisonJson` enthält 14 Statistics-Zeiträume von Viertelstunde bis Jahr.

Jarvis-JSON-kWh-Werte werden mit einer Nachkommastelle und deutschem Dezimaltrennzeichen formatiert; numerische Public-API-Werte bleiben numerisch.

### 9.1 History

```text
Energy.History.ElectricTotalPerDay
Energy.History.ElectricHeatingPerDay
Energy.History.ElectricWarmwaterPerDay
Energy.History.ElectricZHPerDay
Energy.History.HeatTotalPerDay
Energy.History.HeatHeatingPerDay
Energy.History.HeatWarmwaterPerDay
Energy.History.HeatZHPerDay
```

Diese States enthalten abgeschlossene Tageswerte für HistoryGraphs.

## 10. Electrical

Der Bereich stellt insbesondere die aktuelle elektrische Leistung bereit:

```text
Electrical.CurrentPower
```

Gesamtstromwerte werden aus ElectricalMeters bezogen.

## 11. Compressor

Wesentliche Ausgaben:

```text
Active
Mode
Frequency
Runtime
Starts
StartsToday
RuntimeToday
AverageCycleDurationToday
AverageFrequencyToday
State
Status
QualityColor
```

`State` enthält den fachlichen Klartextzustand der StateMachine. `Status` enthält den technischen CompressorMonitor-Rohstatus.

Bei `StartsToday=0` wird `AverageCycleDurationToday` explizit auf 0 gesetzt.

Ohne heutige gültige aktive Frequenzmesszeit wird `AverageFrequencyToday` explizit auf 0 gesetzt.

Messlücken über zehn Minuten werden für die zeitgewichtete Tagesfrequenz verworfen.

### 11.1 Compressor History

```text
Compressor.History.StartsPerDay
Compressor.History.RuntimePerDay
```

sind abgeschlossene Tageswerte.

## 12. Cycles

Wesentliche Ausgaben umfassen:

```text
Cycles.Active
Cycles.CurrentDuration
Cycles.Duration
Cycles.Type
Cycles.COP
Cycles.ElectricEnergy
Cycles.HeatEnergy
Cycles.Quality
Cycles.History
```

`CurrentDuration` stammt aus `StateMachine.Current.Runtime` und wird in Minuten dargestellt.

Verbindliche Semantik:

```text
Cycles.Active = false
→ Cycles.CurrentDuration = 0
```

Die v1.2.1-Korrektur der StateMachine stellt sicher, dass nach Zyklusende keine alte Runtime stehen bleibt.

`Cycles.History` enthält maximal 20 abgeschlossene Zyklen, neuester Eintrag zuerst. Die Startzeit wird im Format `TT.MM.JJJJ HH:mm` dargestellt.

## 13. Temperatures

Wesentliche Ausgaben:

```text
Outdoor
Supply
SupplyTarget
SupplyDeviation
Return
Spread
MeanHeatingWater
TemperatureLift
Flow
Warmwater
WarmwaterCharging
QualityColor
```

Formeln:

```text
SupplyDeviation = Supply - SupplyTarget
Spread = Supply - Return
MeanHeatingWater = (Supply + Return) / 2
TemperatureLift = Supply - Outdoor
```

`Warmwater` entspricht Warmwasser oben BT7. `WarmwaterCharging` entspricht Brauchwasserbereitung BT6.

## 14. Defrost

Wesentliche DashboardData-Public-API:

```text
Defrost.Active
Defrost.Duration
Defrost.Count
Defrost.LastDuration
Defrost.LastStart
Defrost.QualityColor
```

Defrost-spezifische Detailwerte ohne DashboardData-Pendant verbleiben auf der Public API des DefrostMonitor.

## 15. Events

`Events.History` enthält maximal 50 Ereignisse.

Spalten:

```text
Zeitpunkt
Ereignis
Kategorie
Status
Details
```

Tageszähler:

```text
Events.Today.Date
Events.Today.HeatingCycles
Events.Today.WarmwaterCycles
Events.Today.Defrosts
Events.Today.Warnings
Events.Today.Errors
```

Verarbeitung erfolgt nur bei neuer EventEngine-Sequenz. Watchdog- oder Fremdtrigger dürfen keine Duplikate erzeugen.

## 16. System

Wesentliche Ausgaben:

```text
Version
StructureVersion
SourceVersion
Status
DataValid
ErrorCounter
UpdateCounter
HealthPercent
HealthState
HealthColor
HealthMessage
TechnicalState
TechnicalStateCode
TechnicalMessage
LastUpdate
Ruecksprung
```

`System.Ruecksprung` enthält statisch:

```text
← RÜCKSPRUNG
```

für die Jarvis-Navigation.

## 17. Help

Seit v5.10.0 existiert eine zentrale Bedienhilfe. Seit v5.10.1 sind alle acht Detailhilfen vollständig ausgebaut.

```text
Help.General
Help.System
Help.Performance
Help.Energy
Help.Compressor
Help.Temperatures
Help.Cycles
Help.Events
Help.Defrost
Help.Manifest
```

Die HTML-Inhalte werden zentral aus `HELP_DOCUMENTATION` gerendert.

## 18. Statistics-Nutzung

DashboardData liest `statistics.0.save.sumDelta` an dafür vorgesehenen fachlichen Quellzählern.

Typische Verwendungen:

- Periodenwerte,
- Tageswerte,
- Verdichterstarts/-laufzeit,
- Energieperioden.

DashboardData soll nicht dieselben Rohzähler zusätzlich selbst statistisch akkumulieren.

## 19. Influx-Nutzung

DashboardData ist grundsätzlich eine View-Model-Schicht. Eine pauschale Historisierung aller DashboardData-States ist nicht vorgesehen.

Ausnahme sind bewusst erzeugte fertige Tageswerte für HistoryGraphs, insbesondere:

```text
Compressor.History.StartsPerDay
Compressor.History.RuntimePerDay

Energy.History.ElectricTotalPerDay
Energy.History.ElectricHeatingPerDay
Energy.History.ElectricWarmwaterPerDay
Energy.History.ElectricZHPerDay
Energy.History.HeatTotalPerDay
Energy.History.HeatHeatingPerDay
Energy.History.HeatWarmwaterPerDay
Energy.History.HeatZHPerDay
```

Diese werden über `influxdb.0` historisiert.

Details siehe `Persistenz_Spezifikation.md`.

## 20. Funktionale Abnahme 22.08.2026

Geprüft und PASS:

```text
Overview
Performance
Energy
Compressor
Cycles
Temperatures
Defrost
Events
System
```

Besonders verifiziert:

```text
Cycles.Active = false
Cycles.CurrentDuration = 0
```

Die funktionale Konsolidierung erforderte keine Änderung an `10_NPS_DashboardData v5.10.2`.

## 21. Abnahmekriterien

- `System.Version = 5.10.2`.
- `System.StructureVersion = 33`.
- `System.DataValid = true` bei gültigen Quellen.
- Alle Hauptbereiche werden konsistent aktualisiert.
- Gesamtstrom stammt aus ElectricalMeters.
- Wärmemengen stammen aus VirtualMeters.
- Stromaufteilung stammt aus EnergyAllocation.
- öffentliche COP-Werte haben eine Nachkommastelle.
- Event-History erzeugt keine Watchdog-Duplikate.
- abgeschlossene Tageswerte sind für HistoryGraphs verfügbar.
- bei inaktivem Zyklus ist `CurrentDuration=0`.
- Help-Bereich enthält allgemeine und acht Detailhilfen.
- keine pauschale Doppelhistorisierung der DashboardData-Public-API.

**Freigabestatus: PASS**

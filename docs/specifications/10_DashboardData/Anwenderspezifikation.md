# Anwenderspezifikation – 10_NPS_DashboardData v5.10.2

**NIBE Performance Suite (NPS) · Modul 10**  
**Stand:** 22.08.2026  
**Bezugsstand:** `10_NPS_DashboardData v5.10.2`  
**Strukturversion:** 33  
**Status:** STABIL / PASS

## 1. Zweck

DashboardData ist die zentrale Präsentations- und View-Model-Schicht der NIBE Performance Suite. Das Modul sammelt bereits fachlich aufbereitete Werte aus den NPS-Modulen, vereinheitlicht Darstellung, Einheiten, Rundung, Farben, Tabellen und Hilfetexte und stellt eine stabile Schnittstelle für Jarvis bereit.

DashboardData verändert keine fachlichen Quelldaten.

## 2. Hauptbereiche

Die Public API umfasst insbesondere:

```text
Overview
Performance
Temperatures
Compressor
Energy
Electrical
Cycles
Defrost
Events
System
Help
```

Zusätzlich existieren interne bzw. ergänzende Perioden- und Statistikbereiche.

## 3. Datenquellen

Grundregeln:

- Gesamtstrom ausschließlich aus `ElectricalMeters`.
- Wärmemengen ausschließlich aus `VirtualMeters`.
- Stromaufteilung Heizung/Warmwasser aus `EnergyAllocation`.
- Temperaturen aus TemperatureMonitor bzw. den vorgesehenen NIBE-Temperaturquellen.
- Verdichterdaten aus CompressorMonitor und StateMachine.
- Zyklusdaten aus CycleAnalyzer/StateMachine.
- Ereignisse aus EventEngine.
- Abtaudaten aus DefrostMonitor.

DashboardData ist keine zweite Berechnungsquelle für Messwerte, die bereits fachlich in einem Quellmodul vorliegen.

## 4. Overview

`Overview` fasst den Anlagenzustand zusammen. Dazu gehören Betriebsart, aktiver Zyklus, fachlicher Zustand, Alarmstatus, technischer Zustand sowie Health-Bewertung.

Die Health-Bewertung stellt sowohl eine technische Detaildarstellung (`HealthDetails`) als auch eine Jarvis-optimierte Tabelle (`HealthTable`) bereit.

Health-Farben:

```text
>= 98 %  lime
>= 90 %  green
>= 80 %  yellow
>= 60 %  orange
<  60 %  red
```

## 5. Performance

Der Bereich stellt insbesondere bereit:

- aktuelle Wärmeleistung,
- Live-COP,
- Gültigkeit des Live-COP,
- Periodenvergleich für COP gesamt, Heizung und Warmwasser,
- Verdichter- und Zusatzheizungsanteil.

Öffentliche COP-Werte werden mit einer Nachkommastelle dargestellt.

Ein `LiveCOP` von 0 bei `LiveCOPValid=false` bedeutet nicht COP 0 im fachlichen Sinn, sondern aktuell keine gültige Live-COP-Berechnung.

## 6. Energy

Energy stellt Strom- und Wärmemengen sowie COP- und Anteilswerte bereit.

Der Periodenvergleich umfasst 14 Zeiträume von Viertelstunde bis Jahr.

Zusätzlich stehen abgeschlossene Tageswerte für HistoryGraphs zur Verfügung.

Die oberen kumulativen Energieanzeigen und die Statistics-Perioden können unterschiedliche Erfassungsstartpunkte besitzen und müssen deshalb nicht identische Jahreswerte zeigen.

## 7. Compressor

Der Verdichterbereich enthält unter anderem:

- aktiv/inaktiv,
- Betriebsart,
- Frequenz,
- kumulative Laufzeit und Starts,
- Starts und Laufzeit heute,
- mittlere Zyklusdauer heute,
- mittlere Frequenz heute,
- fachlichen StateMachine-Zustand,
- technischen CompressorMonitor-Status,
- abgeschlossene Tageswerte für HistoryGraphs.

## 8. Cycles

Der Zyklusbereich zeigt den aktuellen und den letzten abgeschlossenen Zyklus.

Wichtige Semantik:

```text
Cycles.Active = false
→ Cycles.CurrentDuration = 0 min
```

`CurrentDuration` beschreibt ausschließlich einen aktuell laufenden Verdichtertakt.

`Duration`, `COP`, Energie, Qualität und Typ können dagegen Daten des letzten abgeschlossenen Zyklus enthalten.

`Cycles.History` enthält maximal 20 abgeschlossene Zyklen.

## 9. Temperatures

Bereitgestellt werden insbesondere:

- Außentemperatur,
- Vorlauf IST,
- Vorlauf SOLL,
- Vorlaufabweichung,
- Rücklauf,
- Spreizung,
- mittlere Heizwassertemperatur,
- Temperaturhub,
- Volumenstrom,
- Warmwasser oben BT7,
- Warmwasserbereitung BT6.

Die Vorlaufabweichung ist:

```text
SupplyDeviation = Supply - SupplyTarget
```

## 10. Defrost

Der Bereich enthält unter anderem:

```text
Active
Duration
Count
LastDuration
LastStart
QualityColor
```

Weitere Detailwerte können weiterhin direkt aus der Public API des DefrostMonitor stammen, wenn DashboardData dafür kein Pendant besitzt.

## 11. Events

DashboardData übernimmt neue EventEngine-Ereignisse sequenzgesteuert.

`Events.History` enthält maximal 50 Ereignisse. Zusätzlich existieren Tageszähler für Heizzyklen, Warmwasserzyklen, Abtauungen, Warnungen und Fehler.

Watchdog-Refreshes erzeugen keine Ereignisduplikate.

## 12. System

Der Systembereich enthält unter anderem:

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

`Ruecksprung` ist ein statischer Navigationsdatenpunkt für Jarvis.

## 13. Bedienhilfe

Seit v5.10.x enthält DashboardData eine zentrale Bedienhilfe:

- allgemeine Hilfe,
- System,
- Performance,
- Energy,
- Compressor,
- Temperatures,
- Cycles,
- Events,
- Defrost,
- Manifest.

Die HTML-Inhalte werden aus einer zentral gepflegten Struktur erzeugt und können später auch als Grundlage einer Gesamtdokumentation dienen.

## 14. Aktualisierung

DashboardData aktualisiert Livewerte ereignisgesteuert bei Änderungen relevanter Quellen.

Zusätzlich erfolgt ein vollständiger Watchdog-Refresh alle fünf Minuten.

## 15. Persistenz

DashboardData ist grundsätzlich eine Präsentationsschicht. Nur ausgewählte fertige Tageswerte, die gezielt für HistoryGraphs erzeugt werden, werden in `influxdb.0` historisiert.

`statistics.0` wird dagegen an den fachlichen Quellzählern verwendet und von DashboardData zur Periodenbildung gelesen.

Die genaue Regel ist in `Persistenz_Spezifikation.md` dokumentiert.

## 16. Funktionale Freigabe

Am 22.08.2026 wurden die Bereiche:

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

funktional geprüft.

Alle geprüften Bereiche wurden mit **PASS** bewertet.

Für DashboardData selbst war aufgrund dieser Konsolidierungsrunde keine Codeänderung erforderlich.

**Freigabestatus: PASS**

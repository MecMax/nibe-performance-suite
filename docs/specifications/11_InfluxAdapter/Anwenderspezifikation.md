# Anwenderspezifikation – 11_NPS_InfluxAdapter v1.0.4

**NIBE Performance Suite (NPS) · Modul 11**  
**Stand:** 22.08.2026  
**Bezugsstand:** `11_NPS_InfluxAdapter v1.0.4`  
**Status:** STABIL / PASS

## 1. Zweck

Der InfluxAdapter stellt abgeschlossene historische Wärmepumpenzyklen für nachgelagerte NPS-Auswertungen bereit.

Er liest die vom CycleAnalyzer erzeugten vollständigen `CycleReportJson`-Dokumente aus der dafür vorgesehenen InfluxDB-Historie, prüft und dedupliziert sie und stellt daraus strukturierte Zykluslisten bereit.

## 2. Architektur

```text
CycleAnalyzer
    ↓
History.CycleReportJson
    ↓
influxdb.1
    ↓
11 InfluxAdapter
    ↓
PerformanceAnalyzer
```

Der InfluxAdapter berechnet keine Energie-, Wärme- oder COP-Werte neu.

## 3. Trennung der InfluxDB-Instanzen

Die NPS verwendet unterschiedliche InfluxDB-Instanzen für unterschiedliche Aufgaben.

Für den InfluxAdapter gilt ausdrücklich:

```text
influxdb.1
→ historische CycleAnalyzer-CycleReports
→ Quelle des InfluxAdapters
```

`influxdb.0` ist nicht die Quelle der CycleReports des InfluxAdapters.

Diese Trennung ist beabsichtigt und darf nicht durch eine pauschale Vereinheitlichung der InfluxDB-Instanzen aufgehoben werden.

## 4. Historische Quelle

Verbindliche Quelle:

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

Dieser Datenpunkt enthält vollständige JSON-Berichte abgeschlossener Zyklen.

## 5. Verarbeitung

Bei einer Aktualisierung führt der Adapter eine Historienabfrage aus und verarbeitet die gefundenen CycleReports.

Dabei werden:

- JSON-Dokumente geparst,
- ungültige Reports verworfen,
- Duplikate entfernt,
- Zyklen nach Typ getrennt,
- Ergebnislisten für nachgelagerte Module bereitgestellt.

## 6. Zyklustypen

Die Reports werden insbesondere nach folgenden fachlichen Gruppen getrennt:

```text
Heizung
Warmwasser
Abtauung
```

## 7. Konfiguration

Die verwendete InfluxDB-Instanz wird über:

```text
0_userdata.0.NPS.InfluxAdapter.Configuration.InfluxInstance
```

festgelegt.

Sollwert für den aktuellen NPS-Stand:

```text
influxdb.1
```

## 8. Aktualisierung

Der Adapter unterstützt automatische Aktualisierung sowie einen manuellen Refresh über den vorgesehenen Command-Datenpunkt.

Pro Refresh wird die CycleReport-Historie mit einer Influx-Abfrage geladen.

## 9. Datenqualität

Der Adapter stellt Diagnoseinformationen zur Verfügung, damit erkennbar ist:

- ob die Historienabfrage erfolgreich war,
- wie viele Reports gelesen wurden,
- wie viele gültig geparst wurden,
- ob Reports verworfen oder dedupliziert wurden,
- wann zuletzt erfolgreich aktualisiert wurde.

## 10. Abgrenzung

Der InfluxAdapter:

- schreibt keine CycleReports,
- verändert keine CycleAnalyzer-Daten,
- berechnet keinen COP,
- berechnet keine Energie,
- ersetzt den CycleAnalyzer nicht,
- ersetzt die InfluxDB nicht.

Er ist ausschließlich ein historischer Datenadapter.

## 11. Version 1.0.4

Version 1.0.4 dokumentiert ausdrücklich die bestehende Architekturtrennung der InfluxDB-Instanzen.

Für CycleReports bleibt:

```text
InfluxInstance = influxdb.1
```

Die zwischenzeitlich getestete Umstellung auf `influxdb.0` wurde verworfen, da dort keine CycleReport-Historie vorliegt.

## 12. Praktische Verifikation

Am 22.08.2026 wurde v1.0.4 produktiv gestartet.

Ergebnis:

```text
[NPS InfluxAdapter] Version 1.0.4 gestartet.
[NPS InfluxAdapter] 28 CycleReport(s) mit einer Influx-Abfrage geladen
```

Damit sind Konfiguration, Historienzugriff und Architekturzuordnung praktisch bestätigt.

**Freigabestatus: PASS**

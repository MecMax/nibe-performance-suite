# Technische Spezifikation – 11_NPS_InfluxAdapter v1.0.4

**NIBE Performance Suite (NPS) · Modul 11**  
**Stand:** 22.08.2026  
**Bezugsstand:** `11_NPS_InfluxAdapter v1.0.4`  
**Status:** STABIL / PASS

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `11_NPS_InfluxAdapter` |
| Version | `1.0.4` |
| Architekturschicht | Historischer Datenadapter |
| Root | `0_userdata.0.NPS.InfluxAdapter` |
| Historische Quelle | `CycleAnalyzer.History.CycleReportJson` |
| Standard-Influxinstanz | `influxdb.1` |

## 2. Verantwortung

Der InfluxAdapter liest historische vollständige CycleReports aus InfluxDB und transformiert sie in eine für nachgelagerte NPS-Module direkt nutzbare Struktur.

Nicht Bestandteil der Verantwortung sind:

```text
Energieberechnung
COP-Berechnung
Zyklusbildung
Zyklusbewertung
Schreiben der CycleReports
Änderung von Quelldaten
```

## 3. Datenfluss

```text
98 CycleRecorder
      ↓
13 CycleAnalyzer
      ↓
CycleAnalyzer.History.CycleReportJson
      ↓
influxdb.1
      ↓
11 InfluxAdapter
      ↓
14 PerformanceAnalyzer
```

## 4. InfluxDB-Architektur

Die NPS unterscheidet bewusst zwischen den InfluxDB-Instanzen.

### 4.1 influxdb.1

Für den InfluxAdapter fachlich maßgeblich:

```text
CycleAnalyzer.History.CycleReportJson
→ influxdb.1
→ InfluxAdapter
```

### 4.2 influxdb.0

`influxdb.0` wird für andere NPS-Zeitreihen verwendet, ist aber nicht die historische Quelle des InfluxAdapters.

Eine Änderung des InfluxAdapter-Defaults von `.1` auf `.0` ist daher keine technische Bereinigung, sondern würde die fachliche Datenquelle verändern.

## 5. Konfiguration

Verbindlicher Konfigurationsstate:

```text
0_userdata.0.NPS.InfluxAdapter.Configuration.InfluxInstance
```

Sollwert:

```text
influxdb.1
```

Default in v1.0.4:

```javascript
INFLUX_INSTANCE: 'influxdb.1'
```

## 6. Historienquelle

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

Die Historie dieses States enthält vollständige JSON-Dokumente bereits abgeschlossener und vom CycleAnalyzer bewerteter Zyklen.

## 7. Abfrageprinzip

Pro Refresh wird genau eine Historienabfrage für `CycleReportJson` ausgeführt.

Die Abfrage liefert die im konfigurierten Zeitraum verfügbaren historischen Werte. Die weitere Aufbereitung erfolgt lokal im Adapter.

Dadurch werden nicht für jede Kennzahl separate Influx-Abfragen benötigt.

## 8. Verarbeitungspipeline

```text
Influx-History
    ↓
Rohwerte extrahieren
    ↓
JSON parsen
    ↓
Schema/Plausibilität prüfen
    ↓
ungültige Reports verwerfen
    ↓
Duplikate entfernen
    ↓
chronologisch/fachlich aufbereiten
    ↓
nach Zyklustyp trennen
    ↓
Public API aktualisieren
```

## 9. Deduplizierung

Mehrfach vorhandene identische CycleReports dürfen in den Ergebnislisten nicht mehrfach erscheinen.

Die Deduplizierung ist Bestandteil der Adapterlogik und verändert die zugrunde liegende InfluxDB-Historie nicht.

## 10. Typtrennung

Die gültigen CycleReports werden in fachliche Gruppen aufgeteilt, insbesondere:

```text
Heizung
Warmwasser
Abtauung
```

Damit können nachgelagerte Auswertungen typspezifisch arbeiten, ohne die historische InfluxDB erneut abfragen zu müssen.

## 11. Datenhoheit

Für Kennzahlen innerhalb eines CycleReports gilt:

```text
CycleAnalyzer = fachliche Quelle
InfluxAdapter = Transport-/Historienadapter
```

Der InfluxAdapter übernimmt vorhandene Werte und berechnet insbesondere folgende Größen nicht neu:

```text
ElectricKWh
HeatKWh
COP
Duration
Temperaturen
Frequenzen
Qualitätskennzahlen
```

## 12. Refresh

Der Adapter unterstützt einen expliziten Refresh über seine Command-Schnittstelle sowie die im Script vorgesehene automatische Aktualisierung.

Ein Refresh soll genau eine Historienabfrage erzeugen.

## 13. Fehlerbehandlung

Fehler können insbesondere entstehen durch:

- nicht verfügbare InfluxDB-Instanz,
- fehlende Historienquelle,
- fehlgeschlagene History-Abfrage,
- ungültige JSON-Werte,
- unvollständige CycleReports.

Einzelne ungültige Reports dürfen die Verarbeitung gültiger Reports nicht verhindern.

## 14. Persistenz

Der InfluxAdapter selbst ist kein neues Langzeitarchiv.

Die Langzeitpersistenz liegt bei:

```text
CycleAnalyzer.History.CycleReportJson
→ influxdb.1
```

Die vom InfluxAdapter erzeugten Listen sind Arbeits-/Ausgabedaten für nachgelagerte Module und sollen nicht als redundante Kopie der vollständigen CycleReport-Historie betrachtet werden.

## 15. Versionshistorie v1.0.4

```text
1.0.4 | 2026-08-22
      | Architekturtrennung influxdb.0 / influxdb.1 ausdrücklich dokumentiert.
      | influxdb.1 bleibt Standardinstanz für persistierte
      | CycleAnalyzer-CycleReports.
      | Zwischenzeitliche Umstellung auf influxdb.0 verworfen.
      | Keine Änderung an Historienabfrage, Validierung,
      | Deduplizierung, Typtrennung oder Refresh-Logik.
```

## 16. Verifikation

Produktiver Test am 22.08.2026:

```text
Version 1.0.4 gestartet
28 CycleReport(s) mit einer Influx-Abfrage geladen
```

Damit wurden folgende Punkte praktisch bestätigt:

- Script startet fehlerfrei.
- `influxdb.1` ist erreichbar.
- `CycleReportJson` besitzt Historieneinträge.
- die Historienabfrage funktioniert.
- 28 CycleReports werden geladen.
- eine einzige Influx-Abfrage genügt.

## 17. Abnahmekriterien

- Modulversion ist `1.0.4`.
- Default-Influxinstanz ist `influxdb.1`.
- Laufzeitkonfiguration verwendet `influxdb.1`.
- Historienquelle ist `CycleAnalyzer.History.CycleReportJson`.
- pro Refresh wird eine History-Abfrage verwendet.
- gültige JSON-Reports werden verarbeitet.
- ungültige Reports werden kontrolliert verworfen.
- Duplikate werden entfernt.
- Zyklustypen werden getrennt bereitgestellt.
- Energie und COP werden nicht neu berechnet.
- bestehende CycleReports können erfolgreich aus `influxdb.1` geladen werden.
- `influxdb.0` wird nicht fälschlich als CycleReport-Quelle verwendet.

## 18. Freigabestatus

Der produktive Test mit 28 geladenen CycleReports bestätigt die korrekte Funktionsweise von v1.0.4 und die vorgesehene InfluxDB-Architektur.

**Freigabestatus: PASS**

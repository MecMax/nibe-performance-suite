# Persistenz-Spezifikation – 11_NPS_InfluxAdapter v1.0.4

**NIBE Performance Suite (NPS) · Modul 11**  
**Stand:** 22.08.2026  
**Status:** FREIGEGEBEN

## 1. Ziel

Diese Spezifikation beschreibt die für den InfluxAdapter maßgebliche Trennung der beiden InfluxDB-Instanzen.

## 2. Grundsatz

Die Instanznummern `.0` und `.1` sind nicht austauschbar.

Sie repräsentieren unterschiedliche Persistenzaufgaben innerhalb der NPS.

## 3. CycleReport-Pfad

```text
CycleAnalyzer
    ↓
History.CycleReportJson
    ↓
influxdb.1
    ↓
InfluxAdapter
    ↓
PerformanceAnalyzer
```

Für diesen Datenfluss ist `influxdb.1` verbindlich.

## 4. influxdb.1

`influxdb.1` enthält die historische CycleAnalyzer-Zyklusdatenbasis, insbesondere:

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

Der InfluxAdapter fragt diese Instanz ab.

## 5. influxdb.0

`influxdb.0` bleibt für andere NPS-Zeitreihen vorgesehen.

Dass ein Datenpunkt oder Modul `influxdb.0` verwendet, bedeutet nicht, dass auch CycleReports dorthin verschoben werden sollen.

## 6. Keine automatische Migration

Eine Änderung des Adapter-Defaults darf nicht als Migration der Historie interpretiert werden.

Insbesondere gilt:

```text
Default ändern
≠
historische Daten verschieben
```

Der Test mit `influxdb.0` ergab deshalb 0 CycleReports, während `influxdb.1` weiterhin 28 Reports lieferte.

## 7. Sollkonfiguration

```text
InfluxAdapter.Configuration.InfluxInstance = influxdb.1
```

und:

```text
CycleAnalyzer.History.CycleReportJson
→ Historisierung in influxdb.1 aktiviert
```

## 8. Redundanzvermeidung

Die vollständigen CycleReports sollen nicht ohne fachlichen Grund parallel identisch in beiden InfluxDB-Instanzen gespeichert werden.

Der InfluxAdapter erzeugt ebenfalls kein zweites Langzeitarchiv.

## 9. Abnahme

Am 22.08.2026 wurden mit `influxdb.1` 28 CycleReports in einer History-Abfrage geladen.

Damit ist die Persistenzkette praktisch bestätigt.

**Persistenzstatus: PASS**

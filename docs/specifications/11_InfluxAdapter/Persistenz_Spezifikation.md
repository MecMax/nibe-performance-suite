# Persistenz-Spezifikation – 11_NPS_InfluxAdapter v1.1.0-rc.1

**NIBE Performance Suite (NPS) · Modul 11**
**Stand:** 23.08.2026
**Bezugsstand:** `11_NPS_InfluxAdapter v1.1.0-rc.1`
**Status:** RELEASE CANDIDATE / FUNKTIONSPRÜFUNG PASS

## 1. Ziel

Diese Spezifikation beschreibt die für den InfluxAdapter maßgebliche Trennung der beiden InfluxDB-Instanzen sowie die kontrollierte Historisierung der von Jarvis-HistoryGraphs verwendeten `DashboardData`-Datenpunkte.

## 2. Grundsatz

Die Instanznummern `.0` und `.1` sind nicht austauschbar. Sie repräsentieren unterschiedliche Persistenzaufgaben innerhalb der NPS. Ein durch den InfluxAdapter verwalteter HistoryGraph-Datenpunkt soll nicht gleichzeitig aktiv in beiden InfluxDB-Instanzen historisiert werden.

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

Für diesen Datenfluss ist `influxdb.1` verbindlich. `CycleAnalyzer.History.CycleReportJson` bleibt eine geschützte Quelle und wird durch die HistoryGraph-Konfigurationslogik nicht verändert.

## 4. influxdb.1

`influxdb.1` enthält die historische CycleAnalyzer-Zyklusdatenbasis und die zeitlich höher aufgelösten Betriebs-, Temperatur-, Zyklus- und Ereignisdaten für Jarvis-HistoryGraphs.

Verbindliche CycleReport-Quelle:

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

## 5. influxdb.0

`influxdb.0` dient den langfristig aufzubewahrenden Tages- und Aggregatwerten der NPS. Eine Nutzung von `influxdb.0` für andere NPS-Zeitreihen ändert nicht die CycleReport-Quelle des InfluxAdapters.

## 6. HistoryGraph-Persistenz

Der InfluxAdapter verwaltet 28 ausgewählte Datenpunkte unter `0_userdata.0.NPS.DashboardData.*`. Die Auswahl entspricht den aktuell verwendeten Jarvis-HistoryGraphs.

Es gelten vier Profile:

| Profil | Zweck | Instanz | Speicherung |
|---|---|---|---|
| A | Tages-/Langzeitwerte | `influxdb.0` | nur Änderungen, keine Blockzeit, kein Relog |
| B | kontinuierliche Mess-/Sollwerte | `influxdb.1` | nur Änderungen, Relog nach 300 s, keine Blockzeit |
| C | dynamische Betriebswerte | `influxdb.1` | nur Änderungen, Blockzeit 60 s |
| D | Ereignis-/Zykluswerte | `influxdb.1` | nur Änderungen, keine Blockzeit, kein Relog |

Profil B stellt sicher, dass länger konstante Werte – insbesondere `Temperatures.SupplyTarget` – im HistoryGraph durch regelmäßige Stützpunkte erhalten bleiben.

## 7. SAFE_ADD_ONLY

Die Verwaltung arbeitet verbindlich im Modus `SAFE_ADD_ONLY`:

- Bereits aktive History-Konfigurationen werden nicht automatisch verändert.
- Ist nur die andere InfluxDB-Instanz aktiv, wird keine zweite Instanz zugeschaltet.
- Sind `.0` und `.1` gleichzeitig aktiv, wird eine Doppelhistorie gemeldet und nichts automatisch verändert.
- Ist keine InfluxDB-Historisierung aktiv, kann die Zielkonfiguration ausschließlich durch `Command.ApplyHistoryConfig` ergänzt werden.
- Beim Skriptstart wird nur ein Audit durchgeführt.
- Andere `common.custom`-Konfigurationen bleiben erhalten.

## 8. Keine automatische Migration

Eine Änderung des Adapter-Defaults oder des Zielprofils darf nicht als Migration historischer Daten interpretiert werden.

```text
Konfiguration ändern
≠
historische Daten verschieben
```

Bestehende Daten werden nicht zwischen `influxdb.0` und `influxdb.1` migriert.

## 9. Redundanzvermeidung

Die vollständigen CycleReports und die 28 verwalteten HistoryGraph-Datenpunkte sollen nicht ohne fachlichen Grund parallel identisch in beiden InfluxDB-Instanzen gespeichert werden. Doppelaktivierungen werden diagnostiziert.

## 10. Diagnose und Bedienung

Verbindliche Diagnose-/Command-Schnittstellen:

```text
0_userdata.0.NPS.InfluxAdapter.Command.AuditHistoryConfig
0_userdata.0.NPS.InfluxAdapter.Command.ApplyHistoryConfig
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.Status
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.ManagedCount
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.PreservedCount
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.MissingCount
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.ConflictCount
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.DuplicateCount
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.MissingObjectCount
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.AppliedCount
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.LastAudit
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.ReportJson
```

## 11. Abnahme 23.08.2026

Nach Anwendung der fehlenden History-Konfigurationen und anschließendem Neustart wurde geprüft:

```text
28 verwaltet
28 unverändert
0 fehlend
0 ergänzt
0 Konflikte
0 Doppelhistorien
0 fehlende Objekte
```

Zusätzlich wurden 30 CycleReports mit einer einzigen Influx-Abfrage erfolgreich geladen.

**Persistenzstatus RC.1: PASS**

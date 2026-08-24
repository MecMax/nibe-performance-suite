# Anwenderspezifikation – 11_NPS_InfluxAdapter v1.1.0-rc.1

**NIBE Performance Suite (NPS) · Modul 11**
**Stand:** 23.08.2026
**Bezugsstand:** `11_NPS_InfluxAdapter v1.1.0-rc.1`
**Status:** RELEASE CANDIDATE / FUNKTIONSPRÜFUNG PASS

## 1. Zweck

Der InfluxAdapter stellt abgeschlossene historische Wärmepumpenzyklen für nachgelagerte NPS-Auswertungen bereit. Zusätzlich überwacht er die für die Jarvis-HistoryGraphs benötigten InfluxDB-History-Einstellungen der ausgewählten DashboardData-Datenpunkte.

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

Parallel dazu prüft der InfluxAdapter die History-Konfiguration der Jarvis-Datenpunkte. Er berechnet keine Energie-, Wärme- oder COP-Werte neu.

## 3. Trennung der InfluxDB-Instanzen

Die NPS verwendet die beiden InfluxDB-Instanzen bewusst für unterschiedliche Aufgaben:

- `influxdb.0`: langfristige Tages- und Aggregatwerte.
- `influxdb.1`: CycleReports sowie zeitlich höher aufgelöste Betriebs-, Temperatur-, Zyklus- und Ereignisdaten.

`influxdb.1` bleibt verbindliche Quelle der CycleReports. Eine pauschale Vereinheitlichung der Instanzen ist nicht vorgesehen.

## 4. Jarvis-HistoryGraphs

Für die aktuell verwendeten Jarvis-HistoryGraphs überwacht der Adapter 28 ausgewählte Datenpunkte aus `0_userdata.0.NPS.DashboardData.*`.

Auch länger unveränderte Mess- und Sollwerte können für die HistoryGraph-Darstellung regelmäßig erneut gespeichert werden. Dies betrifft insbesondere Werte wie den Vorlauf-Sollwert.

## 5. Sicherheitsprinzip

Der Adapter arbeitet für die History-Konfiguration nach dem Prinzip `SAFE_ADD_ONLY`.

Das bedeutet für den Anwender:

- bereits funktionierende History-Einstellungen werden nicht automatisch verändert;
- eine bereits aktive andere InfluxDB-Instanz wird nicht zusätzlich aktiviert;
- Doppelhistorien werden gemeldet, aber nicht automatisch verändert;
- fehlende History wird nicht beim Start automatisch eingerichtet.

Damit soll verhindert werden, dass eine funktionierende bestehende Historisierung durch ein Update unbemerkt verändert wird.

## 6. Automatischer Audit beim Start

Bei jedem Start prüft der Adapter die verwalteten History-Datenpunkte. Dabei werden keine fehlenden History-Einstellungen automatisch ergänzt.

Der Gesamtzustand ist unter folgendem Datenpunkt sichtbar:

```text
0_userdata.0.NPS.InfluxAdapter.HistoryConfig.Status
```

Zusätzliche Diagnosewerte zeigen unter anderem Anzahl der verwalteten, fehlenden, konfliktbehafteten und doppelt historisierten Datenpunkte.

## 7. Manuelle Befehle

### History erneut prüfen

```text
0_userdata.0.NPS.InfluxAdapter.Command.AuditHistoryConfig
```

Einmal auf `true` setzen. Nach der Prüfung setzt das Skript den Schalter wieder zurück.

### Fehlende History ergänzen

```text
0_userdata.0.NPS.InfluxAdapter.Command.ApplyHistoryConfig
```

Dieser Befehl ergänzt ausschließlich fehlende, konfliktfreie History-Konfigurationen. Bereits aktive Konfigurationen werden nicht überschrieben. Auch dieser Schalter wird anschließend automatisch auf `false` zurückgesetzt.

`ApplyHistoryConfig` sollte nur verwendet werden, wenn der vorherige Audit fehlende History-Konfigurationen meldet.

## 8. Diagnose

Wichtige Datenpunkte:

```text
HistoryConfig.ManagedCount
HistoryConfig.PreservedCount
HistoryConfig.MissingCount
HistoryConfig.ConflictCount
HistoryConfig.DuplicateCount
HistoryConfig.MissingObjectCount
HistoryConfig.AppliedCount
HistoryConfig.LastAudit
HistoryConfig.Status
HistoryConfig.ReportJson
```

Ein idealer Zustand nach vollständiger Einrichtung ist beispielsweise:

```text
28 verwaltet
28 vorhanden/unverändert
0 fehlend
0 Konflikte
0 Doppelhistorien
0 fehlende Objekte
```

## 9. CycleReport-Verarbeitung

Die historische Quelle bleibt:

```text
0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
```

Bei einer Aktualisierung führt der Adapter eine Historienabfrage aus, prüft die gefundenen JSON-Dokumente, verwirft ungültige Reports, entfernt Duplikate und stellt die Zyklen nach Typ getrennt bereit.

## 10. Laufender Betrieb

`11_NPS_InfluxAdapter` soll dauerhaft aktiv bleiben. Er aktualisiert die CycleReport-Historie und führt beim Skriptstart den History-Konfigurationsaudit durch.

Die 28 History-Konfigurationen werden im laufenden Betrieb nicht ständig neu geschrieben.

## 11. Abgrenzung

Der InfluxAdapter:

- schreibt oder verändert keine CycleReports;
- berechnet keinen COP und keine Energie;
- ersetzt weder CycleAnalyzer noch InfluxDB;
- migriert keine historischen Daten zwischen `influxdb.0` und `influxdb.1`;
- korrigiert Konflikte oder Doppelhistorien nicht automatisch.

Er ist damit historischer Datenadapter und sicherer Konfigurationswächter für die NPS-HistoryGraph-Persistenz.

## 12. Praktische Verifikation RC.1

Am 23.08.2026 wurde die neue History-Konfiguration produktiv geprüft.

Vor der Ergänzung:

```text
28 verwaltet | 10 unverändert | 18 fehlend |
0 Konflikte | 0 Doppelhistorien
```

Nach dem einmaligen Apply und anschließendem Neustart:

```text
28 verwaltet | 28 unverändert | 0 fehlend |
0 Konflikte | 0 Doppelhistorien
```

Zusätzlich wurden 30 CycleReports mit einer Influx-Abfrage erfolgreich geladen.

**Freigabestatus RC.1: FUNKTIONSPRÜFUNG PASS**

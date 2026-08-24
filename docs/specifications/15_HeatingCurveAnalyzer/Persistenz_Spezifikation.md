# Persistenz-Spezifikation – 15_NPS_HeatingCurveAnalyzer v0.1.1

**NIBE Performance Suite (NPS) · Modul 15**
**Stand:** 24.08.2026
**Bezugsstand:** `15_NPS_HeatingCurveAnalyzer v0.1.1`
**Status:** STABLE – Release 0.1.1

## 1. Ziel

Diese Spezifikation beschreibt die Persistenz- und Zeitreihenanforderungen des `15_NPS_HeatingCurveAnalyzer`.

Das Modul verwendet zwei unterschiedliche Persistenzmechanismen:

1. einen internen 7-Tage-Samplepuffer,
2. ausgewählte ioBroker-Datenpunkte für externe Historisierung, insbesondere InfluxDB.

## 2. Root

Alle vom Modul erzeugten Datenpunkte liegen unter:

```text
0_userdata.0.NPS.HeatingOptimization
```

## 3. Interner Samplepuffer

Persistenter Datenpunkt:

```text
Internal.SampleBufferJson
```

Begleitdaten:

```text
Internal.SampleCount
Internal.BufferVersion
Internal.LastSampleTimestamp
Internal.LastConfigSignature
```

## 4. Buffer-Version

Verbindliche Version:

```text
1.0
```

Beim Start wird geprüft, ob der gespeicherte Buffer zur erwarteten `BUFFER_VERSION` passt.

Bei inkompatibler Version wird der alte Puffer nicht übernommen.

## 5. Buffer-Zeitraum

Maximales Alter:

```text
7 Tage
```

Ältere Samples werden verworfen.

## 6. Sample-Raster

Das Modul arbeitet mit:

```text
5 Minuten
```

Ein Sample-Zeitstempel wird auf das aktuelle 5-Minuten-Raster normalisiert.

## 7. Deduplizierung

Im Buffer darf je Zeitstempel nur ein Sample vorhanden sein.

Doppelte Zeitstempel werden nicht erneut aufgenommen.

Beim Laden des Buffers werden ebenfalls doppelte Zeitstempel bereinigt; der jeweils letzte Datensatz gewinnt.

## 8. Buffer-Schema

Ein Sample enthält mindestens:

```text
ts
configSignature
valid
quality
nibe
rooms
excludeReasons
```

Die geladenen Datensätze werden vor Verwendung strukturell geprüft.

Ungültige Samples werden verworfen.

## 9. Konfigurationsbindung

Jedes Sample enthält:

```text
configSignature
```

Die Analysefenster verwenden nur Samples, deren Signatur der aktuellen NIBE-Konfiguration entspricht.

Dadurch werden Messungen aus unterschiedlichen Heizkurvenkonfigurationen nicht unkontrolliert vermischt.

## 10. ConfigurationSignature

Die Signatur umfasst unter anderem:

- Heizkurve,
- Heizkurvenverschiebung,
- Vorlauf Min/Max,
- eigene Heizkurvenpunkte P1-P7,
- Punktverschiebung,
- Heizungsstart-Untertemperatur,
- Heizungs-Stopp-Temperatur,
- Zusatzheizungs-Stopp-Temperatur,
- Automatikfilterzeit,
- maximale Vorlaufdifferenz,
- Betriebsmodus,
- Heizungsautomatik.

Bei Änderung wird:

```text
Configuration.ChangedAt
```

aktualisiert.

## 11. Historisierungsrelevante States

Version 0.1.1 definiert ausdrücklich einen Satz von Datenpunkten, die für 5-Minuten-Zeitreihen vorgesehen sind.

Diese werden bei jedem regulären Sample geschrieben, auch wenn sich ihr Wert gegenüber dem vorherigen Sample nicht geändert hat.

### 11.1 Configuration

```text
Configuration.HeatingCurve
Configuration.HeatingCurveOffset
Configuration.FlowMin
Configuration.FlowMax
Configuration.HeatingStopTemperature
Configuration.AdditionalHeatStopTemperature
```

### 11.2 Current

```text
Current.OutdoorTemperature
Current.OutdoorTemperatureBT28
Current.OutdoorSensorDifference
Current.FlowTarget
Current.FlowActual
Current.ReturnTemperature
Current.SupplyDeviation
Current.DeltaT
Current.DegreeMinutes
Current.CompressorFrequency
Current.CompressorActive
Current.OperatingPriority
Current.VolumeFlow
Current.DefrostActive
Current.AdditionalHeatPower
Current.AdditionalHeatActive
Current.HeatPower
Current.ElectricalPower
Current.SampleValid
Current.SampleQuality
```

### 11.3 Rooms

```text
Rooms.ActiveCount
Rooms.DataValidCount
Rooms.ValidForHeatingCurveCount
Rooms.TooColdCount
Rooms.OKCount
Rooms.TooWarmCount
Rooms.AverageDeviation
Rooms.MedianDeviation
Rooms.MinimumDeviation
Rooms.MaximumDeviation
Rooms.DeviationStdDev
Rooms.DeviationRange
Rooms.ColdestRoomDeviation
Rooms.WarmestRoomDeviation
```

### 11.4 Status

```text
Status.DataQualityPercent
```

## 12. Zweck des erzwungenen Schreibens

In Version 0.1.1 gilt für die oben definierten States:

```text
reguläres 5-Minuten-Sample
→ State schreiben
→ auch wenn Wert unverändert
```

Damit können externe Historienadapter ein gleichmäßiges Zeitraster aufbauen.

Dies betrifft nur die ausdrücklich in `INFLUX_STATES` definierten Datenpunkte.

## 13. Kein automatisches Influx-Setup

Der HeatingCurveAnalyzer selbst konfiguriert keine InfluxDB-Instanz und aktiviert keine History-Einstellungen.

Er erzeugt lediglich die dafür vorgesehenen Datenpunktwerte im 5-Minuten-Raster.

Die eigentliche Historisierung bleibt Aufgabe der ioBroker-/NPS-Persistenzkonfiguration.

## 14. Analysefenster

Folgende Verdichtungen werden als States bereitgestellt:

```text
Analysis.Window6h.*
Analysis.Window24h.*
Analysis.Window72h.*
Analysis.Window7d.*
```

Sie werden aus dem internen Samplepuffer berechnet.

## 15. Globale Analyse-JSONs

Persistenzrelevante Verdichtungen:

```text
Analysis.OutdoorBinsJson
Analysis.PersistentColdRoomsJson
Analysis.PersistentWarmRoomsJson
Analysis.EvidenceJson
```

## 16. Räume

Die aktuelle Raumstruktur wird als JSON bereitgestellt:

```text
Rooms.Json
```

Sie enthält:

- Summary,
- Detaildaten aller 13 Räume,
- Temperaturquellen,
- Sollwerte,
- Abweichungen,
- Fensterzustände,
- Aktivstatus,
- Override-Informationen,
- Thermostatdetails,
- Gültigkeitsflags,
- Ausschlussgründe.

## 17. AI-Payload

Der vollständige standardisierte Payload liegt unter:

```text
AI.AnalysisPayload
```

Weitere States:

```text
AI.PayloadVersion
AI.GeneratedAt
AI.Ready
```

Der Payload ist lokale Datenbereitstellung; es erfolgt keine externe Übertragung.

## 18. Payload-Größenlimit

Maximale Payload-Größe:

```text
65536 Bytes
```

Reduktionsstufen:

```text
1. Thermostatdetails entfernen
2. ungültige Raumdetails entfernen
3. ungültige Outdoor-Bins reduzieren
```

Bei verbleibender Überschreitung wird:

```text
AI.Ready = false
```

gesetzt.

## 19. Neustartverhalten

Beim Start:

1. Datenpunkte sicherstellen,
2. Buffer laden,
3. Buffer bereinigen,
4. Buffer wieder persistieren,
5. Startup-Snapshot ohne neues Buffer-Sample ausführen,
6. vorhandenen Buffer neu aggregieren,
7. Scheduler aktivieren.

Dadurch bleibt die vorhandene 7-Tage-Datenbasis über Script-Neustarts erhalten.

## 20. Stop-Verhalten

Beim Stop:

- Scheduler beenden,
- Buffer persistieren,
- `Status.Active = false`.

## 21. Fehlerfall

Fehler werden dokumentiert unter:

```text
Status.ErrorCount
Status.LastError
```

Ein fehlerhafter Lauf soll die bereits gespeicherte Datenbasis nicht zerstören.

## 22. SourceCheck und Persistenz

Ab v0.1.1 wird der SourceCheck bei jedem Snapshot neu berechnet.

Die aktuellen Ergebnisse werden gespeichert unter:

```text
Status.SourceCheckOk
Status.SourceCheckJson
```

Damit ist die dokumentierte Datenqualität nicht nur ein Startup-Zustand.

## 23. Datenqualität

Aktuelle globale Qualitätswerte:

```text
Status.DataQualityPercent
Status.DataQualityState
```

Fensterspezifische Qualitätswerte:

```text
Analysis.Window6h.DataQualityPercent
Analysis.Window24h.DataQualityPercent
Analysis.Window72h.DataQualityPercent
Analysis.Window7d.DataQualityPercent
```

## 24. Persistenzgrundsatz

Der Analyzer trennt:

```text
Rohquellen
→ aktueller normalisierter Zustand
→ 5-Minuten-Sample
→ interner 7-Tage-Puffer
→ Verdichtungen
→ Evidence
→ AI-Payload
```

Die Ursprungsdaten in NIBE, Alias und heatingcontrol werden nicht verändert.

## 25. Release 0.1.1

Persistenzrelevante Änderung von v0.1.1:

```text
definierte INFLUX_STATES werden bei jedem regulären 5-Minuten-Sample
auch bei unverändertem Wert geschrieben
```

Damit ist die Zeitreihenbildung für nachgelagerte Historisierung stabiler und reproduzierbarer.

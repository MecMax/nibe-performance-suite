# Anwenderspezifikation – 98_NPS_CycleRecorder v2.5.2

**NIBE Performance Suite (NPS) · Modul 98**  
**Bezugsstand:** `98_NPS_CycleRecorder v2.5.2`  
**Build:** 19.08.2026  
**Status:** STABIL

## 1. Zweck

Der CycleRecorder zeichnet vollständige Warmwasserzyklen der Wärmepumpe als Rohdatensatz auf.

Jeder Lauf besteht aus:

- Vorlaufpuffer,
- fachlichem Hauptzyklus,
- Nachlaufpuffer.

Nach Abschluss wird der vollständige Lauf einschließlich Samples und Zusammenfassung unter `CycleRecorder.LastRun.*` bereitgestellt. Die fachliche Einzelzyklusanalyse erfolgt anschließend durch `13_NPS_CycleAnalyzer`.

## 2. Modulgrenze

Der CycleRecorder zeichnet auf, entscheidet aber nicht über die fachliche Qualität eines Zyklus.

Er:

- trifft keine Anlagensteuerungsentscheidung,
- führt keine Mehrzyklusanalyse durch,
- rekonstruiert keine historischen Zyklen,
- schreibt ausschließlich in `0_userdata.0.NPS.CycleRecorder`.

## 3. Datenfluss

```text
NPS-Module + ergänzende Aliase
            ↓
      98 CycleRecorder
            ↓
     LastRun.Json
     LastRun.Id
            ↓
      13 CycleAnalyzer
```

`LastRun.Id` wird erst nach allen Nutzdaten geschrieben und ist das Commit-Signal für den CycleAnalyzer.

## 4. Aufzeichnung

Standardkonfiguration:

```text
Sampling             10 Sekunden
Vorlaufpuffer        15 Minuten
Nachlaufpuffer       15 Minuten
Recorder-Schema      2
```

Der Vorlauf wird permanent als Ringpuffer geführt.

## 5. Zykluserkennung

Im aktuellen v2.5.2-Stand startet die Aufzeichnung bei erkanntem Warmwasserbetrieb.

Der Hauptzyklus bleibt aktiv, solange Warmwasserbetrieb oder Verdichterlauf erkannt wird.

Nach Ende des Hauptzyklus wird der konfigurierte Nachlauf aufgezeichnet.

## 6. Messwerte

Ein Sample enthält unter anderem:

- Prozesssignale,
- StateMachine-Zustand und Übergangsdaten,
- Verdichterstatus, Frequenz, Starts und Laufzeit,
- Vorlauf, Rücklauf und Spreizung,
- elektrische Leistung und elektrische Zähler,
- thermische VirtualMeters,
- Eventdaten,
- Notification-Zähler,
- ergänzende Anlagen-Aliase.

## 7. Energiearchitektur

### Elektrische Energie

Elektrische Momentanleistung:

```text
NPS.ElectricalMeters.Aktuell.Leistung
```

Elektrischer Gesamtzähler:

```text
NPS.ElectricalMeters.Aktuell.Gesamt
```

Die elektrische Zyklusenergie wird innerhalb `triggerStart..triggerEnd` trapezförmig aus der Momentanleistung integriert.

### Thermische Energie

Die thermische Zyklusenergie stammt ausschließlich aus den typbezogenen NPS-VirtualMeters inklusive Zusatzheizung.

Direkte NIBE-Wärmezähler werden für die Zyklusbilanz nicht verwendet.

### Zusatzheizung

Die Zusatzheizungsleistung wird über den Alias:

```text
Leistung_interne_Zusatzheizung
```

erfasst.

v2.5.2 korrigiert diesen Alias; dokumentierte NIBE-Zuordnung: Register 1027 / 31027, Einheit kW.

## 8. Bilanzgrenzen

Energie wird ausschließlich für den fachlichen Hauptzyklus bilanziert:

```text
triggerStart .. triggerEnd
```

Vor- und Nachlauf dienen der Diagnose und werden nicht in die COP-Energiebilanz einbezogen.

## 9. Leistungsintegration

Messlücken größer als 1,75 Samplingintervalle werden nicht künstlich hochgerechnet.

Nicht integrierbare Zeit wird separat dokumentiert.

## 10. Ergebnis

Nach einem abgeschlossenen Lauf werden unter anderem veröffentlicht:

```text
LastRun.Id
LastRun.Type
LastRun.Start
LastRun.End
LastRun.DurationSeconds
LastRun.SampleCount
LastRun.COP
LastRun.ElectricEnergyKWh
LastRun.HeatEnergyKWh
LastRun.Json
LastRun.File
```

## 11. Optionaler Dateiexport

Der vollständige Lauf kann zusätzlich als JSON-Datei unter:

```text
NPS/Recorder
```

gespeichert werden.

Der Dateiexport ist eine optionale Sicherungs-/Diagnosefunktion und ersetzt nicht den Datenvertrag `LastRun.Json` / `LastRun.Id`.

## 12. Diagnose

Das Modul meldet unter anderem:

```text
Diagnostics.Warning
Diagnostics.Trace
Diagnostics.DroppedSamples
Diagnostics.RunCount
Diagnostics.MissingSources
```

Fehlende Quellen werden gesammelt und im Lauf dokumentiert.

## 13. Version 2.5.2

v2.5.2 korrigiert den Alias der internen Zusatzheizungsleistung auf:

```text
alias.0.Keller.Waschküche.Waermepumpe.Leistung_interne_Zusatzheizung
```

Die Energiearchitektur aus v2.4/v2.5 bleibt unverändert:

- elektrische Leistung und Gesamtenergie aus ElectricalMeters,
- thermische Zähler aus VirtualMeters,
- Wärmeleistungs-Alias nur als Diagnosewert.

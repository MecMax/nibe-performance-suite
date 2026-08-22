# Anwenderspezifikation – 13_NPS_CycleAnalyzer v2.4.0

**NIBE Performance Suite (NPS) · Modul 13**  
**Bezugsstand:** `13_NPS_CycleAnalyzer v2.4.0`  
**Status:** STABIL

## 1. Zweck

Der CycleAnalyzer analysiert jeden vom CycleRecorder vollständig abgeschlossenen Lauf. Er verarbeitet nicht die laufende Anlage, sondern einen bereits aufgezeichneten Zyklus als geschlossenes Datenpaket.

Aus dem Recorder-JSON werden Kennzahlen zu Laufdauer, Verdichter, Temperaturen, Leistung, Energie, Ereignissen und Datenqualität erzeugt. Das Ergebnis wird als Einzelwerte, Textbericht und vollständiger `CycleReport` veröffentlicht.

## 2. Architektur

```text
98_NPS_CycleRecorder
        ↓
13_NPS_CycleAnalyzer
        ↓
History.CycleReportJson
        ↓
influxdb.1
        ↓
11_NPS_InfluxAdapter
        ↓
14_NPS_PerformanceAnalyzer
```

Der CycleAnalyzer führt selbst keine Historienabfrage und keine Mehrzyklusbewertung durch.

## 3. Eingang

Verbindliche Quelle:

```text
0_userdata.0.NPS.CycleRecorder.LastRun.Json
```

Commit- und Triggersignal:

```text
0_userdata.0.NPS.CycleRecorder.LastRun.Id
```

Unterstützt wird Recorder-Schema-Version 2.

## 4. Analyseabschnitte

Die Samples werden anhand der Recorder-Zeitgrenzen in drei Bereiche getrennt:

- Vorlauf / Prebuffer,
- Hauptlauf,
- Nachlauf / Postbuffer.

Die fachlichen Zykluskennzahlen beziehen sich überwiegend auf den Hauptlauf zwischen `triggerStart` und `triggerEnd`.

## 5. Analysierte Kennzahlen

### Verdichter
- Laufzeit,
- minimale Frequenz,
- maximale Frequenz,
- mittlere Frequenz,
- Starts.

### Temperaturen
- Außentemperatur,
- Warmwasser oben,
- Brauchwasser-Ladetemperatur,
- Vorlauf,
- Rücklauf,
- Spreizung.

Je nach Messgröße werden Start, Ende, Minimum, Maximum, Mittelwert oder Temperaturanstieg bereitgestellt.

### Leistung
- mittlere und maximale elektrische Leistung,
- mittlere und maximale Wärmeleistung.

### Energie
- elektrische Zyklusenergie,
- thermische Zyklusenergie,
- COP,
- integrierte elektrische Energie,
- Zusatzheizungsenergie,
- Integrationszeit und nicht integrierte Zeit,
- Start-/Endzähler und Quellen der Energiebilanz.

### Ereignisse
- Abtauungen,
- Zustandswechsel,
- Prioritätswechsel,
- Zustandsfolge.

## 6. COP- und Energiebilanz

Seit v2.4.0 folgt die thermische Zyklusenergie vollständig der NPS-Architektur:

```text
thermische Energie → VirtualMeters inkl. Zusatzheizung
```

Direkte Fallback-Zugriffe auf NIBE-Wärmezähler wurden entfernt.

Die elektrische Zyklusenergie wird aus der vom Recorder bereitgestellten Bilanz übernommen; der Analyzer rekonstruiert sie nur im vorgesehenen Fallbackpfad.

## 7. Datenqualität

Jeder Zyklus erhält einen Qualitätswert von 0 bis 100 %.

Bewertung:

```text
>= 98 %  SEHR GUT
>= 90 %  GUT
>= 70 %  EINGESCHRÄNKT
<  70 %  UNGENÜGEND
```

Berücksichtigt werden insbesondere:

- erwartete und fehlende Samples,
- ungewöhnlich große Samplelücken,
- Abdeckung kritischer Messgrößen,
- vom Recorder gemeldete fehlende Quellen,
- verworfene Samples.

## 8. Analyse gültig

`Analysis.Valid` kennzeichnet, ob grundsätzlich eine auswertbare Analyse erzeugt werden konnte.

Die Qualitätsbewertung ist davon getrennt. Ein technisch analysierbarer Zyklus kann daher eine eingeschränkte Datenqualität besitzen.

## 9. Berichte

Der Analyzer veröffentlicht:

```text
Report.Text
Report.Json
```

für den zuletzt analysierten Zyklus.

Der vollständige stabile Übergabevertrag zur Historisierung ist:

```text
History.CycleReportJson
```

## 10. Historisierung

`History.CycleReportJson` wird in `influxdb.1` historisiert.

Damit wird jeder abgeschlossene Zyklus als vollständiges, in sich geschlossenes Dokument gespeichert. Der InfluxAdapter kann daraus später die Zyklushistorie laden, ohne Einzelmesswerte rekonstruieren zu müssen.

## 11. Doppelanalyseschutz

Die zuletzt verarbeitete Recorder-Lauf-ID wird persistent gespeichert.

Ein bereits analysierter Lauf wird nicht erneut ausgewertet. Überlappende Analyseanforderungen werden seriell verarbeitet.

## 12. Version 2.4.0

v2.4.0 stellt den Analyzer-Fallback für thermische Zyklusenergie vollständig auf NPS `VirtualMeters` inklusive Zusatzheizung um.

Direkte Alias-Zugriffe auf NIBE-Wärmezähler wurden entfernt.

Public API und CycleReport-Vertrag bleiben erhalten.

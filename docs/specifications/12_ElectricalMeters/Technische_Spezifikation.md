# Technische Spezifikation – 12_NPS_ElectricalMeters v1.1.1

**NIBE Performance Suite (NPS) · Modul 12**  
**Bezugsstand:** `12_NPS_ElectricalMeters v1.1.1`  
**Build:** 30.07.2026  
**Status:** BEOBACHTUNG

## 1. Modulidentität

| Merkmal | Festlegung |
|---|---|
| Modul | `12_NPS_ElectricalMeters` |
| Version | `1.1.1` |
| Schicht | Energieerfassung / elektrische Zähler |
| Root | `0_userdata.0.NPS.ElectricalMeters` |
| Aufgabe | elektrische Energie- und Leistungsaufbereitung |

## 2. Eingänge

### Stundenregister

```text
alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_für_Heizung_in_der_letzten_Stunde
alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_für_Brauchwasser_in_der_letzten_Stunde
alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_der_Zusatzheizung_für_Heizung_in_der_letzten_Stunde
alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_der_Zusatzheizung_für_Brauchwasser_in_der_letzten_Stunde
```

### Aktuelle elektrische Daten

```text
alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll___Tatsächlicher_Energieverbrauch
alias.0.Keller.Waschküche.Waermepumpe.Gesamtverbrauch
```

Einheiten werden anhand der Objektmetadaten erkannt; Fallback für Energie ist kWh.

## 3. Stundenregisterlogik

Das Modul liest die vier NIBE-Stundenwerte für die unmittelbar vorherige Stunde.

Konfiguration:

```text
CHECK_CRON = jede Minute
READ_DELAY_MINUTES = 10
```

Ein Periodenschlüssel verhindert Mehrfachverarbeitung derselben Stunde.

Kumulative Fortschreibung:

```text
Registerwert_neu = Registerwert_alt + Stundenwert
```

und:

```text
Gesamt_neu =
Gesamt_alt +
HeizungStandbyUnbekannt_Stunde +
Brauchwasser_Stunde
```

Zusatzheizungswerte werden separat geführt und nicht nochmals zum Register-Gesamt addiert.

## 4. Fachliche Semantik

`HeizungStandbyUnbekannt` ist keine reine Heizenergie.

Unzulässig sind daraus abgeleitete Annahmen wie:

```text
Verdichter Heizung =
HeizungStandbyUnbekannt - ZusatzheizungHeizung
```

Die vorhandenen Stundenregister erlauben diese fachliche Trennung nicht belastbar.

## 5. Leistungsintegration

Die elektrische Momentanleistung wird in Watt normalisiert.

Die Integration erfolgt trapezförmig:

```text
DeltaE =
((P_alt + P_neu) / 2 / 1000) * DeltaZeit_h
```

Es werden nur nichtnegative Deltas übernommen.

Maximale zulässige Messlücke:

```text
MAX_POWER_GAP_MINUTES = 5
```

Bei größeren Lücken erfolgt keine Energieschätzung.

Maximal plausibler Leistungswert:

```text
MAX_REASONABLE_POWER_W = 30000
```

## 6. Monotoner Masterzähler

Verbindlicher Public-API-Zähler:

```text
ElectricalMeters.Aktuell.Gesamt
```

Publikationsregel:

```text
published = max(previous, candidate)
```

Der Zähler kann daher niemals durch eine verspätete oder niedrigere NIBE-Verankerung zurückgesetzt werden.

## 7. NIBE-Verankerung

Der NIBE-Gesamtzähler wird nach kWh normalisiert und unter:

```text
Aktuell.NibeGesamt
```

veröffentlicht.

Bei einer Änderung des NIBE-Zählers wird:

- `LastCounterUpdate` aktualisiert,
- `Memory.LastNibeCounter` aktualisiert,
- `Aktuell.IntegrierteEnergie` zurückgesetzt.

Der NIBE-Wert wird anschließend über die monotone Publikationsregel mit dem bisherigen NPS-Zähler abgeglichen.

## 8. Geschätzter Zähler

```text
Aktuell.GeschaetzterZaehler =
Aktuell.NibeGesamt +
Aktuell.IntegrierteEnergie
```

Dieser State ist ein Diagnosewert und nicht der Masterzähler.

## 9. Offset und Korrektur

```text
Offset = Aktuell.Gesamt - Aktuell.NibeGesamt
```

Bewertung:

```text
<= 0,5 kWh → OK
>  0,5 kWh → WARNUNG
>  2,0 kWh → KRITISCH
```

`Aktuell.KorrekturDelta` dokumentiert das Delta der letzten NIBE-Synchronisation.

v1.1.1 migriert bei Bedarf einen vorhandenen Wert aus:

```text
Aktuell.LetzteKorrektur
```

nach:

```text
Aktuell.KorrekturDelta
```

Der alte State wird anschließend nicht mehr beschrieben.

## 10. Public API

### Registerwerte

```text
Registerwerte.HeizungStandbyUnbekannt
Registerwerte.Brauchwasser
Registerwerte.ZusatzheizungHeizung
Registerwerte.ZusatzheizungBrauchwasser
Gesamt
```

### Aktuell

```text
Aktuell.Leistung
Aktuell.NibeGesamt
Aktuell.Gesamt
Aktuell.IntegrierteEnergie
Aktuell.GeschaetzterZaehler
Aktuell.Offset
Aktuell.KorrekturDelta
Aktuell.OffsetStatus
Aktuell.Valid
Aktuell.Status
Aktuell.LastPowerUpdate
Aktuell.LastCounterUpdate
Aktuell.LastIntegration
```

### Hourly

```text
Hourly.HeizungStandbyUnbekannt
Hourly.Brauchwasser
Hourly.ZusatzheizungHeizung
Hourly.ZusatzheizungBrauchwasser
Hourly.Gesamt
Hourly.PeriodStart
Hourly.PeriodEnd
Hourly.ProcessedAt
```

### Memory

```text
Memory.LastProcessedPeriod
Memory.FirstProcessedPeriod
Memory.ProcessedHours
Memory.MissingHoursDetected
Memory.LastPowerW
Memory.LastPowerTimestamp
Memory.LastNibeCounter
```

### Diagnostics

```text
Diagnostics.LastCheck
Diagnostics.LastMessage
Diagnostics.WaitingForPeriod
Diagnostics.SourcesReady
Diagnostics.MinutesAfterHour
Diagnostics.InvalidValueCount
Diagnostics.LastInputJson
Diagnostics.MaxOffset
Diagnostics.PowerGapCount
Diagnostics.InvalidPowerCount
Diagnostics.LastCurrentMeterMessage
```

### System

```text
System.Version
System.Status
System.LastStart
System.LastUpdate
System.Heartbeat
System.LastError
```

## 11. Nachgelagerter Datenvertrag

Für den aktuellen Gesamtstromverbrauch ist ausschließlich:

```text
0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt
```

die zentrale NPS-Quelle.

Nachgelagerte Module sollen nicht parallel direkt auf den verzögerten NIBE-Gesamtzähler zugreifen, wenn der aktuelle NPS-Gesamtstrom benötigt wird.

## 12. Abnahmekriterien

- Modulversion `1.1.1`.
- Stundenregister werden höchstens einmal je Periodenschlüssel verarbeitet.
- Heizung/Standby/Unbekannt wird fachlich nicht als reine Heizenergie bezeichnet.
- keine künstlichen Verdichterzähler aus Differenzen.
- Leistungswerte werden normiert und plausibilisiert.
- Integrationslücken über fünf Minuten werden verworfen.
- `Aktuell.Gesamt` ist streng monoton.
- `GeschaetzterZaehler` entspricht NIBE-Basis plus integrierter Energie.
- Offset und Korrekturdelta sind nachvollziehbar.
- nachgelagerte NPS-Module können `Aktuell.Gesamt` als zentrale elektrische Gesamtquelle verwenden.


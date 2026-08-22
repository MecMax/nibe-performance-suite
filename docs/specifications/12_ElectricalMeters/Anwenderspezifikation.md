# Anwenderspezifikation – 12_NPS_ElectricalMeters v1.1.1

**NIBE Performance Suite (NPS) · Modul 12**  
**Bezugsstand:** `12_NPS_ElectricalMeters v1.1.1`  
**Build:** 30.07.2026  
**Status:** BEOBACHTUNG

## 1. Zweck

ElectricalMeters ist die zentrale NPS-Quelle für die elektrische Energie der Wärmepumpe.

Das Modul kombiniert zwei unterschiedliche Datenwege:

1. Rekonstruktion kumulativer elektrischer Energie aus vier nachlaufenden NIBE-Stundenwerten.
2. Aufbau eines aktuellen, streng monotonen Gesamtstromzählers aus NIBE-Gesamtzähler und kontinuierlicher Leistungsintegration.

## 2. NIBE-Stundenwerte

Verarbeitet werden:

- Heizung + Standby + unbekannte Verbräuche,
- Brauchwasser,
- Zusatzheizung Heizung,
- Zusatzheizung Brauchwasser.

Ein in der aktuellen Stunde gelieferter Stundenwert gehört zur unmittelbar vorherigen abgeschlossenen Stunde.

Der Heizungswert darf ausdrücklich nicht als reine Heizenergie interpretiert werden, weil er auch Standby und nicht eindeutig zuordenbare Verbräuche enthalten kann.

## 3. Kumulative Registerzähler

Bereitgestellt werden:

```text
ElectricalMeters.Registerwerte.HeizungStandbyUnbekannt
ElectricalMeters.Registerwerte.Brauchwasser
ElectricalMeters.Registerwerte.ZusatzheizungHeizung
ElectricalMeters.Registerwerte.ZusatzheizungBrauchwasser
ElectricalMeters.Gesamt
```

Dabei gilt:

```text
Register-Gesamt =
HeizungStandbyUnbekannt + Brauchwasser
```

Aus diesen Registern wird keine künstliche Verdichterenergie durch Subtraktion der Zusatzheizung erzeugt.

## 4. Aktueller Gesamtstromzähler

Der Bereich `Aktuell` stellt den für laufende NPS-Auswertungen maßgeblichen elektrischen Gesamtverbrauch bereit.

Wichtige Werte:

```text
Aktuell.Leistung
Aktuell.NibeGesamt
Aktuell.IntegrierteEnergie
Aktuell.GeschaetzterZaehler
Aktuell.Gesamt
Aktuell.Offset
Aktuell.KorrekturDelta
Aktuell.OffsetStatus
Aktuell.Valid
```

`Aktuell.Gesamt` ist der veröffentlichte monotone Masterzähler und darf niemals sinken.

## 5. Leistungsintegration

Zwischen Aktualisierungen des NIBE-Gesamtzählers integriert ElectricalMeters die aktuelle elektrische Leistung.

```text
GeschaetzterZaehler =
NibeGesamt + IntegrierteEnergie
```

`GeschaetzterZaehler` dient der Diagnose. Der verbindliche veröffentlichte Zähler bleibt `Aktuell.Gesamt`.

## 6. Synchronisation mit NIBE

Wenn sich der NIBE-Gesamtzähler ändert, wird er als neue Referenz übernommen. Der veröffentlichte NPS-Zähler wird dabei nur erhöht, niemals vermindert.

Abweichungen zwischen NPS- und NIBE-Zähler werden über Offset, Korrekturdelta und Qualitätsstatus sichtbar gemacht.

## 7. Qualitätsüberwachung

Die Zählerabweichung wird bewertet:

```text
|Offset| <= 0,5 kWh  → OK
|Offset| >  0,5 kWh  → WARNUNG
|Offset| >  2,0 kWh  → KRITISCH
```

Zusätzlich werden ungültige Leistungswerte und zu große Integrationslücken diagnostiziert.

## 8. Stundenverarbeitung

Die NIBE-Stundenregister werden nach Stundenbeginn mit einer Verzögerung von 10 Minuten gelesen.

Damit wird berücksichtigt, dass die Register nachlaufend aktualisiert werden.

Eine Stunde wird nur einmal kumuliert.

## 9. Verwendung in der NPS

Die Standardquelle für den elektrischen Gesamtverbrauch ist:

```text
0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt
```

Dieser Zähler wird von nachgelagerten Modulen für Energiezuordnung, COP, Zyklusaufzeichnung, Dashboard und Periodenauswertungen verwendet.

## 10. Version 1.1.1

v1.1.1 ergänzt:

- `Aktuell.GeschaetzterZaehler`,
- Umbenennung von `Aktuell.LetzteKorrektur` nach `Aktuell.KorrekturDelta`,
- Migration eines vorhandenen Altwerts,
- verbesserte Nachvollziehbarkeit der laufenden Zählerbildung.


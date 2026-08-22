# Persistenz-Spezifikation – 12_NPS_ElectricalMeters v1.1.1

**NIBE Performance Suite (NPS) · Modul 12**  
**Bezugsstand:** `12_NPS_ElectricalMeters v1.1.1`

## 1. Grundsatz

ElectricalMeters stellt sowohl kumulative Zähler als auch Diagnose- und Livewerte bereit. Persistenz muss nach fachlicher Verwendung unterschieden werden.

## 2. Zentraler Statistics-Zähler

Für Verbrauchsperioden ist der maßgebliche aktuelle Gesamtstromzähler:

```text
0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt
```

Er ist die Standardquelle für COP-, Tages-, Wochen-, Monats-, Jahres-, Dashboard- und Reportauswertungen.

Die konkrete `statistics.0`-Konfiguration ist im Anlagenstand zu prüfen und darf nicht durch parallele Statistics-Bildung auf abgeleiteten DashboardData-Kopien verdoppelt werden.

## 3. Diagnosewerte v1.1.1

Für:

```text
Aktuell.GeschaetzterZaehler
Aktuell.KorrekturDelta
```

lautet die dokumentierte Empfehlung des v1.1.1-Standes:

```text
InfluxDB: influxdb.1
Statistics: nicht aktivieren
```

## 4. Keine doppelte Berechnung

`GeschaetzterZaehler` ist Diagnose und darf nicht anstelle von `Aktuell.Gesamt` als zweiter Masterzähler für Periodenberechnungen verwendet werden.

`KorrekturDelta` ist ebenfalls kein kumulativer Verbrauchszähler.

## 5. Registerwerte

Die kumulativen Registerwerte besitzen eine andere Semantik als der aktuelle monotone Masterzähler. Sie bilden die nachlaufenden NIBE-Stundenregister kumulativ ab.

Sie dürfen nicht mit dem aktuellen Masterzähler gleichgesetzt werden.

## 6. Hinweis zur Instanzarchitektur

Diese Spezifikation übernimmt für `GeschaetzterZaehler` und `KorrekturDelta` die im vorhandenen v1.1.1-README ausdrücklich dokumentierte Empfehlung `influxdb.1`.

Eine darüber hinausgehende pauschale Zuordnung aller ElectricalMeters-States zu `influxdb.0` oder `influxdb.1` ist durch die vorliegenden ElectricalMeters-Quellen nicht belegt und sollte vor einer Änderung am produktiven Objektbestand separat geprüft werden.


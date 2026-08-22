# Anwenderspezifikation – 03_NPS_TemperatureMonitor v1.0.2

**NIBE Performance Suite (NPS) · Modul 03**  
**Stand:** 22.08.2026  
**Bezugsstand:** `03_NPS_TemperatureMonitor v1.0.2`, Build 18.08.2026  
**Status:** STABIL

## 1. Zweck

Der TemperatureMonitor erfasst die grundlegenden Temperatur- und Hydraulikwerte der Wärmepumpe, prüft sie auf Plausibilität und stellt sie in einheitlicher Form für nachfolgende NPS-Module bereit.

Das Modul berechnet bewusst keine Energie-, COP-, JAZ- oder Optimierungskennzahlen.

## 2. Erfasste Messwerte

- Außenlufttemperatur BT28
- Vorlauftemperatur
- Rücklauftemperatur
- Volumenstrom BF1

Die Messwerte werden ausschließlich aus den dafür vorgesehenen ioBroker-Alias-Datenpunkten gelesen.

## 3. Berechnete Werte

### Spreizung

```text
Spreizung = Vorlauf - Rücklauf
```

### Mittlere Heizwassertemperatur

```text
Mittlere Heizwassertemperatur = (Vorlauf + Rücklauf) / 2
```

### Temperaturhub

```text
Temperaturhub = Vorlauf - Außenluft
```

Alle veröffentlichten Mess- und Berechnungswerte werden auf eine Nachkommastelle gerundet.

## 4. Öffentliche Datenpunkte

```text
0_userdata.0.NPS.TemperatureMonitor.Temperatures.Outdoor
0_userdata.0.NPS.TemperatureMonitor.Temperatures.Supply
0_userdata.0.NPS.TemperatureMonitor.Temperatures.Return
0_userdata.0.NPS.TemperatureMonitor.Temperatures.Spread
0_userdata.0.NPS.TemperatureMonitor.Temperatures.MeanHeatingWater
0_userdata.0.NPS.TemperatureMonitor.Temperatures.TemperatureLift
0_userdata.0.NPS.TemperatureMonitor.Hydraulics.Flow
```

## 5. Plausibilitätsprüfung

Die Eingänge müssen vorhanden, numerisch lesbar und endlich sein.

Zulässige Wertebereiche:

| Messwert | Bereich |
|---|---:|
| Außenluft | -60 bis +70 °C |
| Vorlauf | -20 bis +100 °C |
| Rücklauf | -20 bis +100 °C |
| Volumenstrom | 0 bis 300 l/min |

Ungültige Eingangswerte überschreiben keine zuletzt gültigen Messwerte.

## 6. Status und Diagnose

Das Modul stellt unter `System.*` Informationen zu Version, Aktivstatus, Start, letzter Aktualisierung, Status und letzter Meldung bereit.

Unter `Diagnostics.*` werden die Gültigkeit der Eingangsdaten, die Anzahl ungültiger Aktualisierungen sowie Warn- und Traceinformationen bereitgestellt.

Mögliche Statuswerte sind insbesondere:

```text
STARTET
BEREIT
WARTET
FEHLER
GESTOPPT
```

## 7. Aktualisierung

Nach erfolgreicher Initialisierung erfolgt sofort eine erste Messwertaktualisierung.

Danach werden die Werte einmal pro Minute aktualisiert.

## 8. Verwendung innerhalb der NPS

Der TemperatureMonitor ist die normalisierte Quelle für Temperatur- und Hydraulikwerte nachgelagerter NPS-Module.

Nachfolgende Module sollen die Public API des TemperatureMonitor verwenden und nicht dessen Rohquellen erneut interpretieren.

## 9. Historisierung

Die sieben fachlichen Public-API-Werte sind für die Zeitreihenhistorie vorgesehen.

Im konsolidierten Anlagenstand wird hierfür die aktive InfluxDB-Instanz `influxdb.0` verwendet. `statistics.0` ist für diese Messwerte nicht erforderlich.

## 10. Legacy-Bereinigung

Frühere Datenpunkte unter `TemperatureMonitor.Heizung.*` sowie die alten deutschen System-Datenpunkte `System.LetzteAktualisierung` und `System.LetzteMeldung` gehören nicht mehr zur Schnittstelle v1.0.2.

## 11. Freigabestatus

Die Version `03_NPS_TemperatureMonitor v1.0.2` ist der stabile NPS-V1-Stand.

**Status: STABIL**

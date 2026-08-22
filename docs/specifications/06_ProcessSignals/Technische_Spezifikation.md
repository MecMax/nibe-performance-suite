# Technische Spezifikation – 06_NPS_ProcessSignals v1.1.1

**NIBE Performance Suite (NPS) · Modul 06**  
**Stand:** 22.08.2026  
**Bezugsstand:** `06_NPS_ProcessSignals v1.1.1`  
**Status:** STABIL

## 1. Modulidentität und Verantwortung

| Merkmal | Festlegung |
|---|---|
| Modul | `06_NPS_ProcessSignals` |
| Version | `1.1.1` |
| Architekturschicht | Live-Semantik / Prozesssignale |
| Root | `0_userdata.0.NPS.ProcessSignals` |
| Persistenz | keine Influx-/Statistics-Persistenz |

ProcessSignals normalisiert und interpretiert technische Eingangswerte und stellt nachfolgenden NPS-Modulen eindeutige Boolean- und Statussignale zur Verfügung.

## 2. Architekturrolle

```text
Alias / technische Quellen
          ↓
   06 ProcessSignals
          ↓
   07 StateMachine
          ↓
     08 EventEngine

06 ProcessSignals
          ↓
   98 CycleRecorder
```

ProcessSignals ist eine Live-Verarbeitungsschicht. Langzeitpersistenz gehört nicht zu seiner Verantwortung.

## 3. Eingangsklassen

Die Verarbeitung umfasst vier erforderliche Kernsignale und optionale Zusatzsignale. Fachlich verarbeitet werden:

- Betriebspriorität,
- Verdichterfrequenz,
- Verdichterbedarf,
- Verdichter-Erwärmer,
- Abtauungsstatus,
- optionaler Strom-/Leistungswert.

Die Werte werden unter `Eingangswerte.*` normalisiert bzw. gespiegelt.

## 4. Betriebsart-Mapping

Die NIBE-Priorität wird auf semantische Boolean-States abgebildet:

```text
Betriebsart.Standby
Betriebsart.Brauchwasser
Betriebsart.Heizung
Betriebsart.Pool
Betriebsart.Kuehlung
Betriebsart.Bekannt
```

Zu einem gültigen Zeitpunkt soll höchstens die zur aktuellen Priorität passende fachliche Betriebsart aktiv sein.

`Betriebsart.Bekannt` kennzeichnet eine erfolgreich interpretierbare Priorität.

## 5. Verdichterlogik

Der aktuelle Verdichterlauf wird ausschließlich aus der Verdichterfrequenz abgeleitet.

Die zentrale semantische Ausgabe lautet:

```text
Verdichter.Laeuft
```

Das Gegenstück ist:

```text
Verdichter.Steht
```

Weitere Verdichtersignale:

```text
Verdichter.BedarfAktiv
Verdichter.ErwaermerAktiv
Verdichter.AbtauungAktiv
Verdichter.StromwertGueltig
```

## 6. Abtaulogik

Der technische Abtauungsstatus wird in `Eingangswerte.Abtauung` normalisiert und als:

```text
Verdichter.AbtauungAktiv
```

semantisch bereitgestellt.

Die Langzeit- und Ereignisanalyse erfolgt nicht hier, sondern im DefrostMonitor.

## 7. Plausibilitätslogik

Folgende Diagnosezustände werden berechnet:

```text
Plausibilitaet.SignaleGueltig
Plausibilitaet.BedarfBeiStillstand
Plausibilitaet.LaufOhneBedarf
Plausibilitaet.AbtauungOhneVerdichterlauf
Plausibilitaet.VerdichterlaufOhneBekanntePrioritaet
```

`SignaleGueltig` ist für nachgelagerte Module ein wichtiges Freigabe-/Qualitätssignal.

## 8. Verbraucher

### 8.1 StateMachine

`07_NPS_StateMachine` verwendet ProcessSignals als Live-Eingang und benötigt unter anderem:

- `Verdichter.Laeuft`
- `Verdichter.Steht`
- `Verdichter.BedarfAktiv`
- `Verdichter.ErwaermerAktiv`
- `Verdichter.AbtauungAktiv`
- Betriebsart-Signale
- `Plausibilitaet.SignaleGueltig`

Die StateMachine benötigt keine historische Influx-Abfrage der ProcessSignals.

### 8.2 CycleRecorder

`98_NPS_CycleRecorder` verwendet insbesondere:

```text
Betriebsart.Brauchwasser
Betriebsart.Heizung
Betriebsart.Standby
Verdichter.Laeuft
```

als Live-Signale beim Sampling.

Die Zyklusaufzeichnung wird vom CycleRecorder selbst erzeugt. Eine zusätzliche ProcessSignals-Zeitreihe ist dafür nicht erforderlich.

## 9. Persistenz-Soll

Für alle States unter:

```text
0_userdata.0.NPS.ProcessSignals
```

gilt:

| System | Soll |
|---|---|
| `influxdb.0` | deaktiviert / nicht konfiguriert |
| `influxdb.1` | deaktiviert / nicht konfiguriert |
| `statistics.0` | deaktiviert / nicht konfiguriert |

Der aktuelle geprüfte Objekt-Export erfüllt dieses Ziel.

## 10. Begründung der Persistenzentscheidung

Die zuvor historisierten States:

```text
Betriebsart.Brauchwasser
Betriebsart.Heizung
Eingangswerte.Abtauung
Eingangswerte.Prioritaet
```

wurden aus der Influx-Historisierung entfernt.

Gründe:

1. StateMachine verwendet diese Informationen live.
2. CycleRecorder verwendet die relevanten ProcessSignals live und erzeugt eine eigene Zyklusaufzeichnung.
3. Abtauhistorie wird fachlich im DefrostMonitor geführt.
4. Eine parallele ProcessSignals-Historie wäre redundant.
5. ProcessSignals bleibt damit klar auf seine Aufgabe als Live-Semantikschicht begrenzt.

## 11. Kompatibilitätsstates

Folgende States sind in v1.1.1 bewusst weiterhin vorhanden:

```text
Eingangswerte.Verdichterstatus
Verdichter.StatuswertGueltig
```

Sie sind Kompatibilitätsstates und kein versehentlicher Legacy-Rest.

Sie sollen in der aktuellen Version nicht gelöscht werden.

Der Verdichterlauf wird nicht aus `Eingangswerte.Verdichterstatus`, sondern aus der Verdichterfrequenz abgeleitet.

## 12. Objektstruktur

```text
0_userdata.0.NPS.ProcessSignals
├── Betriebsart
│   ├── Bekannt
│   ├── Brauchwasser
│   ├── Heizung
│   ├── Kuehlung
│   ├── Pool
│   └── Standby
├── Eingangswerte
│   ├── Abtauung
│   ├── Prioritaet
│   ├── VerdichterErwaermer
│   ├── Verdichterbedarf
│   ├── Verdichterfrequenz
│   ├── Verdichterstatus
│   └── Verdichterstrom
├── Plausibilitaet
│   ├── AbtauungOhneVerdichterlauf
│   ├── BedarfBeiStillstand
│   ├── LaufOhneBedarf
│   ├── SignaleGueltig
│   └── VerdichterlaufOhneBekanntePrioritaet
├── System
│   ├── Aktiv
│   ├── LetzteAktualisierung
│   ├── LetzteMeldung
│   ├── Status
│   └── Version
└── Verdichter
    ├── AbtauungAktiv
    ├── BedarfAktiv
    ├── ErwaermerAktiv
    ├── Laeuft
    ├── StatuswertGueltig
    ├── Steht
    └── StromwertGueltig
```

## 13. Architekturregeln

1. ProcessSignals ist die semantische Live-Schicht für Prozesssignale.
2. Keine Energie-, COP-, Zyklus- oder Langzeitstatistik in Modul 06.
3. Keine Schreibzugriffe auf NIBE-, Modbus- oder Alias-Quellen.
4. Nachfolgende Module sollen semantische ProcessSignals anstelle eigener Parallelinterpretationen verwenden, soweit die benötigte Information bereitsteht.
5. Verdichterlauf wird aus der Verdichterfrequenz abgeleitet.
6. Abtauung wird semantisch als Boolean bereitgestellt; die Ereignisanalyse erfolgt im DefrostMonitor.
7. ProcessSignals erhält keine eigene InfluxDB-Historisierung.
8. ProcessSignals erhält keine `statistics.0`-Konfiguration.
9. Die beiden dokumentierten Kompatibilitätsstates bleiben in v1.1.1 bestehen.

## 14. Dokumentationshinweis StateMachine

Bei der Konsolidierung von `07_NPS_StateMachine` ist dessen Versionsangabe zur ProcessSignals-Abhängigkeit zu prüfen.

Die aktuelle NPS-V1-Baseline verwendet:

```text
06_NPS_ProcessSignals v1.1.1
```

Eine ältere Header-Angabe auf `v1.1.0` ist bei der StateMachine-Dokumentationspflege entsprechend zu korrigieren.

## 15. Abnahmekriterien

- Objektbaum entspricht der freigegebenen Struktur.
- `System.Aktiv=true` im regulären Betrieb.
- `Plausibilitaet.SignaleGueltig=true` bei gültigen Pflichtsignalen.
- Verdichterlauf wird korrekt aus der Frequenz abgeleitet.
- Betriebspriorität wird korrekt in semantische Betriebsart-Signale umgesetzt.
- Abtauungsstatus wird korrekt in `Verdichter.AbtauungAktiv` umgesetzt.
- StateMachine kann die erforderlichen Live-Signale lesen.
- CycleRecorder kann die erforderlichen Live-Signale lesen.
- Keine ProcessSignals-States sind in `influxdb.0` aktiv.
- Keine ProcessSignals-States sind in `influxdb.1` aktiv.
- Keine ProcessSignals-States sind in `statistics.0` aktiv.
- Kompatibilitätsstates bleiben erhalten.

## 16. Freigabestatus

Objektbaum, Semantik, Plausibilitätslogik, Verbraucherabhängigkeiten und Persistenz wurden geprüft.

**Freigabestatus: PASS**

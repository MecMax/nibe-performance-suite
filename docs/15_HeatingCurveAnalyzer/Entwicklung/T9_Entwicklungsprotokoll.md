# NPS -- HeatingCurveAnalyzer

## Finales Entwicklungsprotokoll T9.1--T9.10

**Projekt:** NIBE Performance Suite (NPS)\
**Modul:** `15_NPS_HeatingCurveAnalyzer`\
**Zielversion:** NPS 1.1\
**Release:** `v0.2.0`\
**Status:** FREIGEGEBEN\
**Entwicklungsumfang:** T9.1 bis T9.10

> **Die KI berät. NPS validiert. Der Benutzer entscheidet.**

## 1. Ziel

Mit NPS 1.1 wurde der HeatingCurveAnalyzer um einen standardisierten und
sicheren Workflow für KI-gestützte Heizungsoptimierung erweitert. Die KI
erhält ausschließlich von NPS vorbereitete Analysedaten. Ihre Empfehlung
wird anschließend erneut durch NPS geprüft. Änderungen an der NIBE
erfolgen ausschließlich nach Benutzerentscheidung und manuell.

Der produktive `HeatingCurveAnalyzer v0.2.0` führt keine automatische
Änderung von NIBE-Heizparametern durch.

## 2. Ausgangspunkt

Bereits vorhanden waren die Erfassung und Normalisierung der relevanten
NIBE-Daten, 13 konfigurierte Räume, Raumdaten aus heatingcontrol/Hama
bzw. separaten Raumfühlern, Fensterzustände, Vorlauf Soll/Ist,
Außentemperatur, zeitbasierte Analysefenster, Evidence, Datenqualität
und `AI.Ready`.

T9 erweitert diese Basis zu einem geschlossenen KI-Beratungs- und
Optimierungszyklus.

## 3. Verbindliche NPS-AI-Standards

### NPS-AI-AnalysisPayload v1.1

Standardisierter Analyse-Datensatz für die externe KI mit
Anlagenkonfiguration, Messwerten, Analysefenstern, Raumkomfort,
Vorlaufverhalten, Outdoor Bins, Evidence, Datenqualität,
Konfigurationssignatur und vorheriger Optimierung.

### NPS-HeatingOptimization-Prompt v1.0

Standardprompt für die externe KI. Fehlende Werte dürfen nicht erfunden
werden; die Antwort soll ausschließlich als standardisierter
RecommendationPayload erfolgen.

### NPS-AI-RecommendationPayload v1.0

Standardisierte KI-Antwort. Unterstützte Aktionen sind `NO_CHANGE`,
`CHANGE_PARAMETER`, `INVESTIGATE` und `INSUFFICIENT_DATA`. Direkt
änderbar sind zunächst `heatingCurve` und `heatingCurveOffset`. Pro
Zyklus sind maximal ±1 Heizkurvenstufe bzw. ±1 K Parallelverschiebung
vorgesehen. Für `CHANGE_PARAMETER` gilt eine Mindestkonfidenz von 0,75.

### NPS-AI-OptimizationRecord v1.0

Standardisierte Dokumentation eines Optimierungszyklus mit Empfehlung,
Ausgangskonfiguration, Änderung, Vorher-/Nachher-Snapshot,
Beobachtungszeit und Evaluation.

## 4. Entwicklungsstufen

### T9.1 -- AnalysisPayload Schema 1.1

Erweiterung des Analyse-Payloads auf Schema 1.1 einschließlich
eindeutiger Schema-/Versionsinformationen, Anlageninformationen,
Konfigurationssignatur und Vorbereitung für `previousOptimization`.

**Ergebnis: PASS**

### T9.2 -- Outdoor-Bin-Ratios

Ergänzung von `tooColdRatioPercent`, `okRatioPercent` und
`tooWarmRatioPercent` je Außentemperaturbereich.

**Ergebnis: PASS**

### T9.3 -- previousOptimization

Einführung von `AI.Optimization.LastRecord` und Bereitstellung der
letzten gültigen Optimierung im AnalysisPayload.

**Ergebnis: PASS**

### T9.4 -- Recommendation-Datenpunkte

Aufbau der Datenpunktstruktur unter `AI.Recommendation`. Nur
`InputPayload` ist für die Eingabe vorgesehen. Die finale Modulstruktur
umfasst 229 Datenpunkte.

**Ergebnis: PASS**

### T9.5 -- RecommendationPayload Parser

Ereignisgesteuerter Parser für `AI.Recommendation.InputPayload`:
JSON-Prüfung, Objektprüfung und Projektion der Felder. Leere/default
Recommendation wird als normaler Zustand behandelt.

**Ergebnis: PASS**

### T9.6 -- Recommendation Validator

Validierung von Schema, Analyse-Referenz, Datentypen, Aktionen,
Parametern, Änderungsgröße, arithmetischer Konsistenz, Mindestkonfidenz
und Beobachtungszeit. `Recommendation.Valid=true` bedeutet noch keine
Änderungsfreigabe.

**Ergebnis: PASS**

### T9.7 -- ChangeAllowed

Zusätzliche NPS-Sicherheitsprüfung. Wichtige Blocker sind
`RECOMMENDATION_INVALID`, `ACTION_NOT_CHANGE_PARAMETER`,
`ANALYSIS_NOT_VALID`, `AI_NOT_READY`, `EVIDENCE_UNAVAILABLE`,
`INSUFFICIENT_DATA`, `SENSOR_MISMATCH`, `FLOW_TRACKING_PROBLEM`,
`ADDITIONAL_HEAT_INFLUENCE`,
`INSUFFICIENT_OUTDOOR_BINS_FOR_SLOPE_CHANGE`,
`FINDING_REQUIRES_INVESTIGATION`, `CONFIGURATION_SIGNATURE_MISMATCH`,
`CURRENT_PARAMETER_UNAVAILABLE` und `CURRENT_VALUE_MISMATCH`.

Für eine Änderung müssen `Recommendation.Valid=true` und
`Recommendation.ChangeAllowed=true` vorliegen.

**Ergebnis: PASS**

### T9.8 -- OptimizationRecord

Einführung von `AI.Optimization.PendingRecord`,
`AI.Optimization.LastRecord` und `AI.Optimization.Status`.

Typischer Ablauf:

`IDLE → WAITING_FOR_MANUAL_CHANGE → OBSERVING → EVALUATED`

NPS erkennt die manuelle Änderung und prüft, ob sie der freigegebenen
Empfehlung entspricht. Unerwartete Konfigurationsänderungen werden
fail-safe behandelt. NPS schreibt selbst keine NIBE-Parameter.

**Struktur/Fail-Safe: PASS**\
**Empty-Recommendation-FIX1: PASS**\
**Realer positiver saisonaler Feldtest: nachgelagert**

### T9.9 -- Evaluation

Nach einer passenden manuellen Änderung beginnt eine 72-h-Beobachtung.
Bewertet werden insbesondere die absolute 72-h-Median-Raumabweichung und
der 72-h-OK-Anteil. Relevanzschwellen: 0,2 K bzw. 5 Prozentpunkte.

Mögliche Ergebnisse: `IMPROVED`, `UNCHANGED`, `WORSENED`,
`INCONCLUSIVE`.

Bei fehlenden Daten, geänderter Konfiguration oder widersprüchlichen
Kennzahlen wird fail-safe `INCONCLUSIVE` verwendet.

**Struktur/Fail-Safe: PASS**\
**Isolierte Klassifikationstests: PASS**\
**Realer positiver saisonaler Feldtest: nachgelagert**

### T9.10 -- End-to-End-/Startup-Integritätstest

Isolierte Prüfung der vollständigen Kette:

`Recommendation → Validator → ChangeAllowed → PendingRecord → simulierte manuelle Änderung → OBSERVING → Evaluation`

In ioBroker bestätigt:

``` text
T9.10 Startup-Integritätstest: PASS
Stufe=COMPLETE
Ergebnis=IMPROVED
isoliert=true
Anlagenzugriff=false
```

Der Test wurde als interner Startup-Integritätstest in den Release
übernommen.

**Ergebnis: PASS**

## 5. Release Candidate v0.2.0-rc.1

Nach T9.1--T9.10 wurde `v0.2.0-rc.1` erzeugt. Gegenüber alpha.10 wurden
nur Release-Metadaten/Bezeichnungen bereinigt, keine Funktionslogik.

Der ioBroker-Test bestätigte: - 229 bestehende Datenpunkte, keine
Neuanlage/Normalisierung, - Startup-Integritätstest PASS, - 160/160
Required Sources OK, - 9/9 Optional Sources OK, - 13/13 Raumquellen
gültig, - Scheduler aktiv, - Initialisierung erfolgreich.

**RC.1-Abnahme: PASS**

## 6. Release v0.2.0

`v0.2.0` wurde direkt aus dem geprüften RC.1 erzeugt. Geändert wurden
ausschließlich Header-Version, Release-Status und `VERSION`-Konstante.
Die Funktionslogik blieb unverändert.

SHA-256 des freigegebenen Skripts:

`48f1fd9876efe75048b647530fe6251d420f05d0f0411c0d974ff2a215c6ce25`

## 7. Finaler Release-Smoke-Test

In ioBroker bestätigt:

``` text
Version 0.2.0 gestartet
DP-Struktur: 0 neu | 229 bereits vorhanden | 0 normalisiert
T9.10 Startup-Integritätstest: PASS
Stufe=COMPLETE
Ergebnis=IMPROVED
isoliert=true
Anlagenzugriff=false
Sources: 160/160 required OK | 9/9 optional OK
Räume: 13/13 Quellen gültig
Scheduler: 5-Minuten-Raster aktiv
v0.2.0 Initialisierung erfolgreich
```

Zum Prüfzeitpunkt bestand kein gültiger Heizbetrieb; `AI.Ready=false`
war daher erwartetes Fail-Safe-Verhalten.

**Release-Smoke-Test: PASS**

## 8. Sicherheitsarchitektur

``` text
NPS-Messdaten
  ↓
NPS-Analyse / AI.Ready
  ↓
externe KI
  ↓
RecommendationPayload
  ↓
NPS Parser
  ↓
NPS Validator
  ↓
NPS ChangeAllowed
  ↓
Benutzerentscheidung
  ↓
manuelle NIBE-Änderung
  ↓
72-h-Beobachtung
  ↓
NPS-Evaluation
```

Bewusste Designentscheidungen: - keine direkte KI-Steuerung der NIBE, -
NPS bildet die Vertrauensgrenze, - kleine Änderungsschritte, - nur eine
wesentliche Änderung je Zyklus, - 72-h-Beobachtung vor dem nächsten
Schritt, - Konfigurationssignatur gegen veraltete Empfehlungen, -
Fail-Safe bei unzureichenden oder widersprüchlichen Daten.

## 9. Offener saisonaler Feldtest

Die reale positive T9.8/T9.9-Kette bleibt als nachgelagerte Validierung
vorgemerkt. Bei geeigneter Heizperiode ist einmal der vollständige reale
Ablauf zu prüfen:

1.  `AI.Ready=true`
2.  realen AnalysisPayload an KI übergeben
3.  gültigen RecommendationPayload importieren
4.  `Valid=true`
5.  `ChangeAllowed=true`
6.  Empfehlung prüfen
7.  freigegebenen Parameter manuell an der NIBE ändern
8.  Übergang nach `OBSERVING` bestätigen
9.  mindestens 72 Stunden beobachten
10. reale Evaluation prüfen

Dieser Feldtest war kein Blocker für v0.2.0.

## 10. Anwenderdokumentation

Zusätzlich wurde `KI_Anwenderanleitung.md` erstellt. Sie beschreibt den
praktischen Ablauf von `AI.Ready` über Standardprompt und
RecommendationPayload bis zu manueller Änderung, Beobachtung und
Evaluation einschließlich der verbindlichen Sicherheitsregeln.

## 11. Abschlussstatus

  Bereich                           Status
  --------------------------------- ----------------------------
  T9.1 AnalysisPayload 1.1          PASS
  T9.2 Outdoor-Bin-Ratios           PASS
  T9.3 previousOptimization         PASS
  T9.4 Recommendation States        PASS
  T9.5 Parser                       PASS
  T9.6 Validator                    PASS
  T9.7 ChangeAllowed                PASS
  T9.8 OptimizationRecord           PASS / Feldtest vorgemerkt
  T9.9 Evaluation                   PASS / Feldtest vorgemerkt
  T9.10 Integritätstest             PASS
  RC.1-Laufzeittest                 PASS
  v0.2.0 Release-Smoke-Test         PASS
  Produktive ioBroker-Bereinigung   abgeschlossen

## 12. Freigabe

**`15_NPS_HeatingCurveAnalyzer v0.2.0` ist für NPS 1.1 freigegeben.**

Die reale Heizungsoptimierung erfolgt ausschließlich nach dem
dokumentierten manuellen KI-Workflow.

> **Die KI berät. NPS validiert. Der Benutzer entscheidet.**

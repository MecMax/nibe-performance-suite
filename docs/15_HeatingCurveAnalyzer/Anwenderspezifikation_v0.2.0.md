# NPS -- HeatingCurveAnalyzer

## Anwenderspezifikation v0.2.0

**Projekt:** NIBE Performance Suite (NPS)\
**Modul:** `15_NPS_HeatingCurveAnalyzer`\
**Modulversion:** `v0.2.0`\
**Zielversion:** NPS 1.1\
**Status:** FREIGEGEBEN

------------------------------------------------------------------------

## 1. Zweck des Moduls

Der `15_NPS_HeatingCurveAnalyzer` unterstützt den Anwender bei der
Beurteilung und schrittweisen Optimierung der Heizkurve einer
NIBE-Heizungsanlage.

Das Modul sammelt und verdichtet relevante Anlagen- und Raumdaten,
bewertet deren Qualität und stellt daraus nachvollziehbare Kennzahlen
und Evidence bereit. Zusätzlich kann es einen standardisierten
Analyse-Datensatz für eine externe KI erzeugen und eine von der KI
zurückgegebene Empfehlung nach verbindlichen NPS-Regeln prüfen.

Das Modul verändert die NIBE-Heizungsparameter **nicht automatisch**.

Der verbindliche Grundsatz lautet:

> **Die KI berät. NPS validiert. Der Benutzer entscheidet.**

------------------------------------------------------------------------

## 2. Anwenderziel

Der Anwender soll mit dem Modul insbesondere folgende Fragen beantworten
können:

-   Ist die vorhandene Datenbasis für eine Heizkurvenbewertung
    ausreichend?
-   Werden die Räume im Heizbetrieb überwiegend ausreichend warm?
-   Ist die Vorlauf-Solltemperatur plausibel?
-   Folgt die tatsächliche Vorlauftemperatur dem Sollwert ausreichend
    gut?
-   Gibt es Hinweise auf eine insgesamt zu hohe oder zu niedrige
    Heizkurve?
-   Gibt es Hinweise auf eine zu steile oder zu flache Heizkurve?
-   Ist eher eine Änderung der Heizkurve oder der Parallelverschiebung
    sinnvoll?
-   Gibt es Störungen oder Randbedingungen, die zunächst untersucht
    werden sollten?
-   Kann eine externe KI auf Basis der vorhandenen Daten sinnvoll um Rat
    gefragt werden?
-   Ist eine von der KI vorgeschlagene Änderung nach den NPS-Regeln
    zulässig?
-   Hat eine manuell vorgenommene Optimierung nach der Beobachtungszeit
    tatsächlich geholfen?

------------------------------------------------------------------------

## 3. Abgrenzung

Der HeatingCurveAnalyzer ist ein **Analyse- und Beratungsmodul**.

Nicht Bestandteil von v0.2.0 sind:

-   automatische Änderung der NIBE-Heizkurve,
-   automatische Änderung der Heizkurvenverschiebung,
-   automatische Übernahme einer KI-Empfehlung,
-   direkte Steuerung von heatingcontrol,
-   direkte Steuerung der Hama-Thermostate,
-   eigenständige externe KI-Kommunikation,
-   Ersatz der vorhandenen NIBE-Regelung.

Eine Änderung an der Anlage erfolgt ausschließlich bewusst und manuell
durch den Anwender.

------------------------------------------------------------------------

## 4. Verwendete Informationen

Für die Analyse werden unter anderem folgende Informationen
berücksichtigt:

-   NIBE-Betriebszustand,
-   Verdichterzustand,
-   Außentemperatur,
-   Vorlauf Soll,
-   Vorlauf Ist,
-   Rücklauftemperatur,
-   Volumenstrom bzw. verfügbare Anlageninformationen,
-   Heizkurvenparameter,
-   Heizkurvenverschiebung,
-   Raum-Isttemperaturen,
-   Raum-Solltemperaturen,
-   Fensterzustände,
-   heatingcontrol-Informationen,
-   vorhandene Hama-Thermostatdaten,
-   zeitliche Historie der gültigen Messpunkte.

Die vorhandenen Räume werden gemeinsam ausgewertet. Nicht jeder einzelne
Messpunkt ist automatisch für eine Heizkurvenanalyse geeignet.

------------------------------------------------------------------------

## 5. Gültige Heizkurven-Messpunkte

NPS unterscheidet zwischen vorhandenen Messdaten und tatsächlich für die
Heizkurvenanalyse geeigneten Messpunkten.

Ein Messpunkt kann beispielsweise ausgeschlossen werden, wenn:

-   die NIBE nicht heizt,
-   der Verdichter nicht aktiv ist,
-   kein geeigneter Volumenstrom vorliegt,
-   keine Heizperiode aktiv ist,
-   zu wenige gültige Räume vorhanden sind,
-   der Anteil gültiger Räume zu gering ist.

Dadurch sollen Betriebszustände, die keine belastbare Aussage über die
Heizkurve erlauben, nicht die Optimierungsanalyse verfälschen.

------------------------------------------------------------------------

## 6. Analysezeiträume

Das Modul betrachtet unterschiedliche Zeitfenster, insbesondere:

-   6 Stunden,
-   24 Stunden,
-   72 Stunden,
-   7 Tage.

Kurze Zeitfenster helfen bei der aktuellen Beurteilung. Für eine
belastbare Heizkurvenoptimierung sind insbesondere längerfristige Daten
relevant.

Für die zentrale KI-/Optimierungsbewertung spielt das 72-h-Fenster eine
besondere Rolle.

------------------------------------------------------------------------

## 7. Raumkomfort

Die Raumtemperaturen werden relativ zu den jeweiligen Solltemperaturen
betrachtet.

Dabei wird zwischen zu kalt, im Komfortbereich und zu warm
unterschieden.

Zu den wesentlichen Kennzahlen gehören unter anderem:

-   mittlere Raumabweichung,
-   Median der Raumabweichungen,
-   Verhältnis zu kalter Beobachtungen,
-   Verhältnis der Beobachtungen im Komfortbereich,
-   Verhältnis zu warmer Beobachtungen.

Der grundlegende Komfortbereich beträgt ±0,5 K um die jeweilige
Raum-Solltemperatur.

------------------------------------------------------------------------

## 8. Außentemperaturabhängigkeit

Für die Beurteilung der Heizkurvensteigung werden die gültigen Heizdaten
zusätzlich nach Außentemperaturbereichen ausgewertet.

Für geeignete Outdoor Bins werden unter anderem die Komfortanteile
bestimmt:

-   `tooColdRatioPercent`
-   `okRatioPercent`
-   `tooWarmRatioPercent`

Damit kann NPS bzw. eine externe KI erkennen, ob sich das Raumverhalten
bei unterschiedlichen Außentemperaturen systematisch verändert.

Eine Änderung der Heizkurvensteigung benötigt eine ausreichende
Datenbasis über mehrere Außentemperaturbereiche.

------------------------------------------------------------------------

## 9. Evidence

NPS stellt zusätzliche Evidence bereit, um typische Ursachen voneinander
unterscheiden zu können.

Dazu gehören insbesondere:

-   globaler Temperaturzustand,
-   Vorlauf-Nachführung,
-   Außentemperaturabhängigkeit,
-   Raumungleichgewicht,
-   Einfluss der Zusatzheizung,
-   mögliche Sensorabweichungen,
-   unzureichende Daten.

Evidence soll verhindern, dass jede Komfortabweichung vorschnell als
Fehler der Heizkurve interpretiert wird.

------------------------------------------------------------------------

## 10. Datenqualität

Das Modul bewertet die Qualität und Verwendbarkeit der vorhandenen
Daten.

Eine geringe Datenqualität kann beispielsweise durch zu wenige gültige
Heizstunden, unzureichende Raumdaten oder ungeeignete Anlagenzustände
entstehen.

Eine geringe Datenqualität ist kein Anlagenfehler. Sie bedeutet zunächst
nur, dass eine belastbare Optimierungsentscheidung noch nicht möglich
ist.

------------------------------------------------------------------------

## 11. AI.Ready

Der zentrale Freigabeindikator für eine externe KI-Auswertung ist:

`0_userdata.0.NPS.HeatingOptimization.AI.Ready`

### `AI.Ready = false`

Die aktuelle Datenbasis reicht nach den NPS-Regeln nicht für eine
belastbare KI-Heizungsoptimierung aus.

In diesem Zustand soll keine Heizkurvenänderung aufgrund einer
KI-Empfehlung durchgeführt werden.

### `AI.Ready = true`

Die vorhandene Datenbasis ist ausreichend, um den standardisierten
Analyse-Payload einer externen KI zur Beurteilung vorzulegen.

`AI.Ready=true` bedeutet **nicht**, dass eine Änderung erforderlich ist.

------------------------------------------------------------------------

## 12. NPS-AI-AnalysisPayload

Wenn `AI.Ready=true` ist, stellt NPS den standardisierten
Analyse-Datensatz bereit:

`0_userdata.0.NPS.HeatingOptimization.AI.AnalysisPayload`

Verwendeter Standard:

**`NPS-AI-AnalysisPayload v1.1`**

Der Payload fasst die für die KI relevanten Informationen zusammen. Der
Anwender muss nicht selbst einzelne Messwerte zusammensuchen.

Die praktische Verwendung ist in `KI_Anwenderanleitung.md` beschrieben.

------------------------------------------------------------------------

## 13. KI-Empfehlung

Die externe KI soll ihre Empfehlung im Standard:

**`NPS-AI-RecommendationPayload v1.0`**

zurückgeben.

Mögliche grundlegende Aktionen sind:

-   `NO_CHANGE`
-   `CHANGE_PARAMETER`
-   `INVESTIGATE`
-   `INSUFFICIENT_DATA`

Für direkte Optimierungsschritte sind in v0.2.0 zunächst vorgesehen:

-   `heatingCurve`
-   `heatingCurveOffset`

Die zulässige Änderung pro Optimierungszyklus ist bewusst klein:

-   Heizkurve maximal ±1,
-   Heizkurvenverschiebung maximal ±1 K.

------------------------------------------------------------------------

## 14. Import der KI-Empfehlung

Der RecommendationPayload wird vom Anwender in folgenden Datenpunkt
übernommen:

`0_userdata.0.NPS.HeatingOptimization.AI.Recommendation.InputPayload`

NPS verarbeitet die Antwort anschließend automatisch.

Die Verarbeitung besteht aus drei Sicherheitsstufen:

`Parser → Validator → ChangeAllowed`

------------------------------------------------------------------------

## 15. Recommendation.Valid

Der Validator prüft die KI-Antwort auf Einhaltung des vereinbarten
Formats und der fachlichen Grundregeln.

Der zentrale Datenpunkt ist:

`AI.Recommendation.Valid`

### `Valid = false`

Die Empfehlung darf nicht verwendet werden.

### `Valid = true`

Die Empfehlung ist formal und semantisch gültig.

Dies ist noch **keine Freigabe für eine Anlagenänderung**.

------------------------------------------------------------------------

## 16. Recommendation.ChangeAllowed

Die entscheidende zusätzliche Sicherheitsprüfung erfolgt über:

`AI.Recommendation.ChangeAllowed`

NPS vergleicht die Empfehlung mit dem aktuellen Anlagen-, Analyse- und
Evidence-Zustand.

Eine Änderung darf nur in Betracht gezogen werden, wenn gleichzeitig
gilt:

``` text
AI.Ready = true
Recommendation.Valid = true
Recommendation.ChangeAllowed = true
```

Eine formal gültige Empfehlung kann trotzdem blockiert werden.

Mögliche Gründe sind beispielsweise:

-   Analyse inzwischen nicht mehr gültig,
-   unzureichende Daten,
-   Sensorproblem,
-   Vorlauf-Nachführungsproblem,
-   relevanter Zusatzheizungseinfluss,
-   ungeeigneter Befund für eine direkte Parameteränderung,
-   geänderte Anlagenkonfiguration,
-   aktueller Parameter stimmt nicht mehr mit der KI-Annahme überein,
-   unzureichende Außentemperaturbasis für eine Steigungsänderung.

------------------------------------------------------------------------

## 17. Benutzerentscheidung

Auch bei `ChangeAllowed=true` erfolgt keine automatische Änderung.

Der Anwender prüft:

-   vorgeschlagenen Parameter,
-   aktuellen Wert,
-   empfohlenen Wert,
-   Änderungsgröße,
-   Konfidenz,
-   Primary Finding,
-   Erklärung der KI,
-   aktuellen Anlagenzustand.

Erst danach entscheidet der Anwender, ob die Empfehlung umgesetzt wird.

------------------------------------------------------------------------

## 18. Manuelle Anlagenänderung

Eine akzeptierte Änderung wird ausschließlich **manuell an der NIBE**
durchgeführt.

Dabei soll nur die freigegebene wesentliche Änderung vorgenommen werden.

Mehrere gleichzeitige Heizkurvenänderungen würden die spätere
Wirkungsbewertung erschweren und sollen vermieden werden.

------------------------------------------------------------------------

## 19. OptimizationRecord

NPS dokumentiert einen freigegebenen Optimierungszyklus.

Wichtige Zustände sind:

`IDLE → WAITING_FOR_MANUAL_CHANGE → OBSERVING → EVALUATED`

### WAITING_FOR_MANUAL_CHANGE

NPS wartet auf die vom Benutzer vorzunehmende Änderung.

### OBSERVING

NPS hat die passende Konfigurationsänderung erkannt und beobachtet deren
Wirkung.

### EVALUATED

Die Beobachtungsperiode wurde abgeschlossen und bewertet.

Eine unerwartete Konfigurationsänderung wird nicht als gültige Umsetzung
der Empfehlung gewertet.

------------------------------------------------------------------------

## 20. Beobachtungszeit

Der Standard für einen Optimierungszyklus beträgt:

**72 Stunden**

Während dieser Zeit soll die relevante Anlagenkonfiguration möglichst
unverändert bleiben.

Zusätzlich müssen ausreichend verwertbare Heizdaten entstehen. Eine
reine Zeitspanne von 72 Stunden garantiert daher noch keine belastbare
Bewertung.

------------------------------------------------------------------------

## 21. Evaluation

Nach der Beobachtung vergleicht NPS die Situation vor und nach der
Änderung.

In v0.2.0 werden insbesondere betrachtet:

-   absolute 72-h-Median-Raumabweichung,
-   72-h-Anteil der Beobachtungen im Komfortbereich.

Als relevante Veränderung gelten:

-   0,2 K bei der absoluten Medianabweichung,
-   5 Prozentpunkte beim OK-Anteil.

Mögliche Ergebnisse:

### IMPROVED

Die Komfortkennzahlen haben sich relevant verbessert.

### UNCHANGED

Es ist keine ausreichend große Veränderung erkennbar.

### WORSENED

Die Komfortkennzahlen haben sich relevant verschlechtert.

### INCONCLUSIVE

Eine belastbare Aussage ist nicht möglich, beispielsweise wegen
fehlender Daten, widersprüchlicher Kennzahlen oder einer
Konfigurationsänderung während der Beobachtung.

------------------------------------------------------------------------

## 22. Neuer Optimierungszyklus

Eine Heizungsoptimierung soll schrittweise erfolgen:

``` text
Daten sammeln
  ↓
AI.Ready
  ↓
KI analysiert
  ↓
NPS validiert
  ↓
Benutzer entscheidet
  ↓
eine Änderung
  ↓
72 h beobachten
  ↓
NPS bewertet
  ↓
erneut Daten sammeln
```

Eine weitere Änderung soll nicht automatisch aus einer vorherigen
Empfehlung abgeleitet werden.

------------------------------------------------------------------------

## 23. Startup-Integritätstest

v0.2.0 enthält einen internen isolierten Startup-Integritätstest für die
KI-Optimierungskette.

Er prüft die logische Verarbeitung von Recommendation, Validator,
ChangeAllowed, OptimizationRecord und Evaluation ohne Zugriff auf die
reale Anlage.

Ein erfolgreicher Start wird beispielsweise protokolliert als:

``` text
T9.10 Startup-Integritätstest: PASS
Stufe=COMPLETE
Ergebnis=IMPROVED
isoliert=true
Anlagenzugriff=false
```

Der Test verändert keine NIBE-Konfiguration.

------------------------------------------------------------------------

## 24. Verhalten außerhalb der Heizperiode

Außerhalb eines geeigneten Heizbetriebs kann beispielsweise gelten:

``` text
SampleValid = false
AI.Ready = false
Evidence = INSUFFICIENT
```

Dies ist ein erwarteter Zustand und kein Fehler des Moduls.

NPS wartet, bis wieder ausreichend geeignete Heizdaten vorliegen.

------------------------------------------------------------------------

## 25. Sicherheitsregeln

Für den produktiven Betrieb gelten:

1.  Keine KI-Optimierung bei `AI.Ready=false`.
2.  Keine KI-Empfehlung verwenden, wenn `Recommendation.Valid=false`.
3.  Keine Änderung durchführen, wenn
    `Recommendation.ChangeAllowed=false`.
4.  Keine KI-Ausgabe direkt automatisiert an die NIBE weitergeben.
5.  Nur eine freigegebene wesentliche Änderung pro Optimierungszyklus
    durchführen.
6.  Während der Beobachtung keine weiteren wesentlichen
    Heizkurvenänderungen vornehmen.
7.  Fehlende Daten nicht durch KI-Schätzungen ersetzen.
8.  Bei `INVESTIGATE`, `INSUFFICIENT_DATA` oder `INCONCLUSIVE` zunächst
    die Ursache untersuchen.
9.  Die Entscheidung über eine Anlagenänderung verbleibt beim Benutzer.

------------------------------------------------------------------------

## 26. Anwenderdokumentation

Zum Modul gehören:

-   `Anwenderspezifikation_v0.2.0.md` -- Zweck, Verhalten und
    Bedienlogik des Moduls,
-   `Technische_Spezifikation_v0.2.0.md` -- technische Architektur und
    Implementierungsregeln,
-   `KI_Anwenderanleitung.md` -- praktische
    Schritt-für-Schritt-Anleitung für die KI-Nutzung,
-   `Entwicklung/T9_Entwicklungsprotokoll.md` -- dokumentierter
    Entwicklungs- und Freigabeverlauf.

------------------------------------------------------------------------

## 27. Freigabestatus

`15_NPS_HeatingCurveAnalyzer v0.2.0` wurde nach Abschluss der
Entwicklungsstufen T9.1--T9.10, Release-Candidate-Prüfung und finalem
ioBroker-Smoke-Test für NPS 1.1 freigegeben.

Der reale positive T9.8/T9.9-Optimierungszyklus bleibt für geeignete
Heizbedingungen als nachgelagerter saisonaler Feldtest vorgemerkt.

> **Die KI berät. NPS validiert. Der Benutzer entscheidet.**

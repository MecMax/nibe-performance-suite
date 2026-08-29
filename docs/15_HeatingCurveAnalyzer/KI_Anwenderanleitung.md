# NPS -- Heizungsoptimierung mit KI

**Modul:** `15_NPS_HeatingCurveAnalyzer`\
**NPS-Version:** 1.1\
**HeatingCurveAnalyzer:** v0.2.0\
**Dokument:** KI-Anwenderanleitung\
**Status:** Freigegeben

> **Grundsatz: Die KI berät. NPS validiert. Der Benutzer entscheidet.**

## 1. Zweck dieser Anleitung

Der `15_NPS_HeatingCurveAnalyzer` bereitet die Mess- und Analysedaten
der Heizungsanlage so auf, dass eine KI bei der Beurteilung der
Heizkurve unterstützen kann.

Die KI steuert die NIBE **nicht**. Sie erhält einen standardisierten
Analyse-Datensatz, erstellt daraus eine Empfehlung und gibt diese in
einem definierten JSON-Format zurück. Anschließend prüft NPS die
Empfehlung erneut. Erst wenn NPS die Änderung zulässt, entscheidet der
Benutzer, ob er sie manuell an der NIBE umsetzt.

Der vollständige Ablauf lautet:

**NPS analysiert → KI berät → NPS validiert → Benutzer entscheidet →
NIBE wird manuell geändert → NPS beobachtet → NPS bewertet**

------------------------------------------------------------------------

## 2. Voraussetzungen

Vor einer KI-Auswertung muss NPS ausreichend verwertbare Heizdaten
gesammelt haben.

Der entscheidende Datenpunkt ist:

`0_userdata.0.NPS.HeatingOptimization.AI.Ready`

### `AI.Ready = false`

Es liegen momentan keine ausreichend belastbaren Daten für eine
Heizungsoptimierung vor. Das kann beispielsweise bei Sommerbetrieb,
fehlendem Heizbetrieb, zu wenigen gültigen Heizstunden oder
unzureichender Datenqualität auftreten.

**Keine Änderung der Heizkurve aufgrund einer KI-Empfehlung
durchführen.**

### `AI.Ready = true`

NPS hält die vorhandenen Daten für ausreichend, um sie einer KI zur
Analyse vorzulegen.

`AI.Ready=true` ist dabei noch **keine Änderungsempfehlung**. Es
bedeutet lediglich, dass eine Analyse sinnvoll durchgeführt werden kann.

------------------------------------------------------------------------

## 3. Analyse-Daten aus NPS kopieren

Für die KI wird ausschließlich der standardisierte NPS-Analyse-Datensatz
verwendet:

`0_userdata.0.NPS.HeatingOptimization.AI.AnalysisPayload`

Der Inhalt ist JSON nach dem Standard:

**`NPS-AI-AnalysisPayload v1.1`**

Den **vollständigen Wert** dieses Datenpunkts kopieren.

Der Payload enthält unter anderem:

-   aktuelle NIBE-Konfiguration,
-   Heizkurve und Parallelverschiebung,
-   aktuelle Betriebsdaten,
-   Vorlauf Soll/Ist,
-   Außentemperaturen,
-   Raumtemperaturen und Solltemperaturen,
-   gültige Heizstunden,
-   Datenqualität,
-   6-h-, 24-h-, 72-h- und 7-Tage-Auswertungen,
-   Außentemperaturbereiche (Outdoor Bins),
-   Evidence zur Bewertung möglicher Ursachen,
-   Informationen über eine vorherige Optimierung.

Ein manuelles Zusammenstellen einzelner Messwerte ist nicht
erforderlich.

------------------------------------------------------------------------

## 4. Standardprompt für die KI

Der folgende Prompt sollte möglichst unverändert verwendet werden.

### NPS-Standardprompt

> Analysiere den nachfolgenden `NPS-AI-AnalysisPayload` nach dem
> Standard `NPS-HeatingOptimization-Prompt v1.0`.
>
> Prüfe insbesondere, ob die aktuelle Heizkurve oder die
> Heizkurvenverschiebung optimiert werden sollte.
>
> Berücksichtige Datenqualität, Raumkomfort, Vorlaufverhalten,
> Außentemperaturabhängigkeit, vorhandene Evidence und vorherige
> Optimierungen.
>
> Erfinde keine fehlenden Messwerte.
>
> Empfehle keine Änderung, wenn die Daten keine belastbare Aussage
> erlauben oder zunächst eine andere Ursache untersucht werden sollte.
>
> Gib als Ergebnis **ausschließlich ein gültiges JSON-Objekt nach
> `NPS-AI-RecommendationPayload v1.0`** zurück. Keine zusätzliche
> Erklärung außerhalb des JSON.
>
> NPS validiert die Empfehlung anschließend. Die Heizungsanlage darf
> nicht automatisch verändert werden.
>
> **NPS-AI-AnalysisPayload:**
>
> `[HIER DEN VOLLSTÄNDIGEN INHALT VON AI.AnalysisPayload EINFÜGEN]`

Dieser Prompt kann grundsätzlich bei unterschiedlichen KI-Systemen
verwendet werden. Entscheidend ist, dass die Antwort dem
NPS-Recommendation-Format entspricht.

------------------------------------------------------------------------

## 5. Was darf die KI empfehlen?

Für v0.2.0 sind als direkte Optimierungsparameter vorgesehen:

-   `heatingCurve` -- Heizkurve
-   `heatingCurveOffset` -- Parallelverschiebung der Heizkurve

Eine Änderung ist pro Optimierungszyklus bewusst begrenzt:

-   Heizkurve: maximal **±1**
-   Parallelverschiebung: maximal **±1 K**

Die KI kann außerdem zu dem Ergebnis kommen, dass:

-   keine Änderung erforderlich ist,
-   zunächst ein Problem untersucht werden sollte,
-   die Daten nicht ausreichen.

Eine KI-Empfehlung ist **niemals automatisch eine Freigabe zur
Änderung**.

------------------------------------------------------------------------

## 6. Antwort der KI

Die KI muss ein JSON nach:

**`NPS-AI-RecommendationPayload v1.0`**

zurückgeben.

Ein vereinfachtes Beispiel für eine Änderungsempfehlung:

``` json
{
  "schema": "NPS-AI-RecommendationPayload",
  "schemaVersion": "1.0",
  "analysisReference": {
    "analysisGeneratedAt": "2026-10-15T08:00:00.000Z",
    "analysisSchemaVersion": "1.1",
    "configurationSignature": "..."
  },
  "analysisValid": true,
  "confidence": 0.88,
  "assessment": {
    "overallState": "OPTIMIZATION_RECOMMENDED",
    "primaryFinding": "HEATING_CURVE_TOO_STEEP"
  },
  "recommendation": {
    "action": "CHANGE_PARAMETER",
    "parameter": "heatingCurve",
    "currentValue": 6,
    "recommendedValue": 5,
    "change": -1
  },
  "secondaryRecommendation": null,
  "reasonCodes": [],
  "explanation": "Die Auswertung deutet auf eine zu steile Heizkurve hin.",
  "observation": {
    "recommendedObservationHours": 72
  }
}
```

**Wichtig:** Werte aus diesem Beispiel dürfen nicht als Empfehlung für
die eigene Anlage übernommen werden.

------------------------------------------------------------------------

## 7. KI-Antwort in NPS importieren

Das vollständige JSON der KI wird in folgenden Datenpunkt geschrieben:

`0_userdata.0.NPS.HeatingOptimization.AI.Recommendation.InputPayload`

Danach verarbeitet NPS die Antwort automatisch.

NPS übernimmt dabei mehrere getrennte Prüfungen:

**Parser → Validator → ChangeAllowed**

------------------------------------------------------------------------

## 8. Parser und Validator verstehen

Nach dem Import sind insbesondere diese Datenpunkte wichtig:

`AI.Recommendation.Valid`\
`AI.Recommendation.ValidationState`\
`AI.Recommendation.ValidationErrorsJson`

### `Valid = false`

Die Antwort darf nicht verwendet werden.

Mögliche Ursachen sind beispielsweise:

-   ungültiges JSON,
-   falsches Schema,
-   fehlende Pflichtfelder,
-   unzulässiger Parameter,
-   zu große Änderung,
-   zu geringe Konfidenz,
-   widersprüchliche Werte.

### `Valid = true`

Die KI-Antwort ist formal und semantisch nach den NPS-Regeln gültig.

**Das bedeutet noch nicht, dass die Änderung durchgeführt werden darf.**

------------------------------------------------------------------------

## 9. ChangeAllowed -- die entscheidende Sicherheitsprüfung

Der wichtigste Datenpunkt vor einer Änderung ist:

`0_userdata.0.NPS.HeatingOptimization.AI.Recommendation.ChangeAllowed`

Eine Änderung darf nur in Betracht gezogen werden, wenn gleichzeitig
gilt:

``` text
AI.Ready                     = true
AI.Recommendation.Valid      = true
AI.Recommendation.ChangeAllowed = true
```

NPS prüft für `ChangeAllowed` zusätzlich die aktuelle Situation der
Anlage.

Eine Änderung wird beispielsweise blockiert bei:

-   inzwischen ungültiger Analyse,
-   `AI.Ready=false`,
-   unzureichenden Daten,
-   Sensorproblemen,
-   Problemen bei der Vorlaufnachführung,
-   relevantem Einfluss des Zusatzheizers,
-   geänderter Anlagenkonfiguration,
-   Abweichung zwischen dem von der KI angenommenen und dem aktuellen
    Parameterwert,
-   unzureichender Außentemperaturbasis für eine Änderung der
    Heizkurvensteigung,
-   Befunden, die zunächst untersucht werden müssen.

Damit kann eine formal korrekte KI-Antwort trotzdem von NPS abgelehnt
werden.

------------------------------------------------------------------------

## 10. Empfehlung vor der Änderung kontrollieren

Vor einer manuellen Änderung mindestens folgende Werte kontrollieren:

``` text
AI.Recommendation.Valid
AI.Recommendation.ChangeAllowed
AI.Recommendation.Parameter
AI.Recommendation.CurrentValue
AI.Recommendation.RecommendedValue
AI.Recommendation.Change
AI.Recommendation.ConfidencePercent
AI.Recommendation.PrimaryFinding
AI.Recommendation.Explanation
```

Beispiel:

``` text
Valid:             true
ChangeAllowed:     true
Parameter:         heatingCurve
CurrentValue:      6
RecommendedValue:  5
Change:            -1
Confidence:        88 %
```

Erst jetzt liegt eine von NPS akzeptierte Änderungsempfehlung vor.

------------------------------------------------------------------------

## 11. Benutzer entscheidet

Auch bei `ChangeAllowed=true` führt NPS die Änderung **nicht
automatisch** aus.

Der Benutzer entscheidet, ob die Empfehlung umgesetzt wird.

Vor der Änderung sollte geprüft werden:

-   Ist die Empfehlung nachvollziehbar?
-   Ist die Anlage momentan in einem normalen Betriebszustand?
-   Sind keine anderen bewussten Änderungen gleichzeitig geplant?
-   Kann die anschließende Beobachtungszeit eingehalten werden?

Wenn Zweifel bestehen, wird **nichts geändert**.

------------------------------------------------------------------------

## 12. Änderung an der NIBE

Wird die Empfehlung angenommen, erfolgt die Änderung **manuell an der
NIBE**.

Beispiel:

``` text
Parameter:          heatingCurve
Bisher:             6
Empfohlen:           5
```

Dann wird ausschließlich dieser Parameter von 6 auf 5 geändert.

Nicht gleichzeitig weitere wesentliche Heizparameter verändern. Sonst
kann NPS die Wirkung der einzelnen Änderung nicht mehr zuverlässig
beurteilen.

------------------------------------------------------------------------

## 13. OptimizationRecord

Sobald NPS eine zulässige Empfehlung erkannt hat, wird der
Optimierungszyklus dokumentiert.

Wichtige Datenpunkte:

`AI.Optimization.PendingRecord`\
`AI.Optimization.LastRecord`\
`AI.Optimization.Status`

Der typische Ablauf ist:

``` text
IDLE
  ↓
WAITING_FOR_MANUAL_CHANGE
  ↓
manuelle NIBE-Änderung
  ↓
OBSERVING
  ↓
EVALUATED
```

### WAITING_FOR_MANUAL_CHANGE

NPS wartet darauf, dass die freigegebene Änderung tatsächlich manuell
vorgenommen wird.

### OBSERVING

NPS hat die passende Konfigurationsänderung erkannt und beginnt die
Beobachtungsphase.

### EVALUATED

Die Beobachtungsphase wurde abgeschlossen und bewertet.

------------------------------------------------------------------------

## 14. Beobachtungsphase

Der NPS-Standard für einen Optimierungszyklus beträgt:

**72 Stunden**

Während dieser Zeit sollte die Konfiguration möglichst unverändert
bleiben.

NPS benötigt außerdem ausreichend gültige Heizdaten. Eine reine
Zeitspanne von 72 Stunden reicht nicht automatisch aus, wenn innerhalb
dieser Zeit kaum verwertbarer Heizbetrieb stattgefunden hat.

Insbesondere sollten während der Beobachtung keine weiteren Heizkurven-
oder Parallelverschiebungsänderungen vorgenommen werden.

------------------------------------------------------------------------

## 15. Bewertung nach der Änderung

NPS vergleicht die Situation vor und nach der Änderung.

Die Bewertungsbasis von v0.2.0 umfasst insbesondere:

-   absolute 72-h-Medianabweichung der Räume,
-   72-h-Anteil der Raumbeobachtungen innerhalb des Komfortbereichs.

Für die Bewertung werden kleine Schwankungen bewusst toleriert. Als
relevante Änderung gelten:

-   Medianabweichung: **0,2 K**
-   OK-Anteil: **5 Prozentpunkte**

Mögliche Ergebnisse:

### IMPROVED

Die Komfortkennzahlen haben sich relevant verbessert, ohne dass die
andere Kennzahl relevant schlechter geworden ist.

### UNCHANGED

Es gibt keine ausreichend große Veränderung.

### WORSENED

Die Komfortkennzahlen haben sich relevant verschlechtert, ohne dass die
andere Kennzahl relevant besser geworden ist.

### INCONCLUSIVE

Eine zuverlässige Aussage ist nicht möglich, beispielsweise aufgrund
fehlender Daten, einer Konfigurationsänderung während der Beobachtung
oder widersprüchlicher Kennzahlen.

`INCONCLUSIVE` bedeutet ausdrücklich **nicht**, dass die Änderung gut
oder schlecht war.

------------------------------------------------------------------------

## 16. Was mache ich mit dem Ergebnis?

### Bei IMPROVED

Die Änderung kann zunächst beibehalten werden. Ein weiterer
Optimierungszyklus sollte erst nach erneuter ausreichender Datensammlung
und einer neuen NPS-/KI-Analyse begonnen werden.

### Bei UNCHANGED

Keine automatische weitere Änderung vornehmen. Zunächst erneut Daten
sammeln und eine neue Analyse durchführen.

### Bei WORSENED

Keine weitere Änderung in derselben Richtung durchführen. Die Situation
sollte geprüft werden. Eine Rücknahme einer Einstellung bleibt eine
bewusste Benutzerentscheidung.

### Bei INCONCLUSIVE

Keine Schlussfolgerung aus dem Optimierungsversuch ziehen. Ursache für
die unzureichende Bewertung prüfen und später erneut analysieren.

------------------------------------------------------------------------

## 17. Neuer Optimierungszyklus

Eine Optimierung soll schrittweise erfolgen.

``` text
Daten sammeln
      ↓
AI.Ready=true
      ↓
AnalysisPayload an KI
      ↓
RecommendationPayload zurück an NPS
      ↓
Valid=true
      ↓
ChangeAllowed=true
      ↓
Benutzer entscheidet
      ↓
eine Änderung manuell durchführen
      ↓
72 h beobachten
      ↓
Ergebnis bewerten
      ↓
neue Daten sammeln
```

Nicht mehrere KI-Empfehlungen nacheinander anwenden, ohne die Wirkung
der vorherigen Änderung abzuwarten.

------------------------------------------------------------------------

## 18. Sicherheitsregeln

Für die Verwendung der KI gelten folgende verbindliche Regeln:

1.  **Keine KI-Optimierung bei `AI.Ready=false`.**
2.  **Keine Empfehlung verwenden, wenn `Recommendation.Valid=false`.**
3.  **Keine Parameteränderung durchführen, wenn `ChangeAllowed=false`.**
4.  **KI-Ausgaben niemals direkt automatisiert an die NIBE
    weitergeben.**
5.  **Nur die von NPS freigegebene einzelne Änderung durchführen.**
6.  **Während der Beobachtungsphase keine weiteren wesentlichen
    Heizkurvenänderungen vornehmen.**
7.  **Fehlende Messwerte niemals durch Schätzungen der KI ersetzen
    lassen.**
8.  **Bei `INVESTIGATE`, `INSUFFICIENT_DATA` oder `INCONCLUSIVE`
    zunächst die Ursache untersuchen.**
9.  **Der Benutzer behält immer die Entscheidungshoheit.**

------------------------------------------------------------------------

## 19. Kurzablauf für den Alltag

Wenn NPS genügend Heizdaten gesammelt hat:

``` text
1. AI.Ready prüfen
      ↓
2. AnalysisPayload kopieren
      ↓
3. Standardprompt + Payload an KI senden
      ↓
4. Nur RecommendationPayload-JSON zurücknehmen
      ↓
5. JSON in Recommendation.InputPayload einfügen
      ↓
6. Valid prüfen
      ↓
7. ChangeAllowed prüfen
      ↓
8. Empfehlung kontrollieren
      ↓
9. Benutzer entscheidet
      ↓
10. Änderung manuell an der NIBE
      ↓
11. 72 h beobachten
      ↓
12. OptimizationRecord/Evaluation prüfen
```

------------------------------------------------------------------------

## 20. Beispiel eines vollständigen Durchlaufs

### Ausgangslage

NPS meldet:

``` text
AI.Ready = true
```

Der Benutzer kopiert `AI.AnalysisPayload` und sendet ihn zusammen mit
dem NPS-Standardprompt an eine KI.

### KI-Empfehlung

Die KI gibt beispielsweise zurück:

``` text
PrimaryFinding:    HEATING_CURVE_TOO_STEEP
Action:            CHANGE_PARAMETER
Parameter:         heatingCurve
CurrentValue:      6
RecommendedValue:  5
Change:            -1
Confidence:        88 %
Observation:       72 h
```

### NPS-Prüfung

Nach dem Einfügen des JSON in `AI.Recommendation.InputPayload` ergibt
die Prüfung:

``` text
Recommendation.Valid       = true
Recommendation.ChangeAllowed = true
```

### Entscheidung

Der Benutzer prüft die Empfehlung und entscheidet, sie umzusetzen.

### Manuelle Änderung

An der NIBE wird ausschließlich die Heizkurve von 6 auf 5 geändert.

### Beobachtung

NPS erkennt die Änderung:

``` text
AI.Optimization.Status = OBSERVING
```

Die Anlage wird 72 Stunden unter möglichst unveränderten Bedingungen
beobachtet.

### Bewertung

Nach Ablauf der Beobachtung kann beispielsweise erscheinen:

``` text
AI.Optimization.Status = EVALUATED
Evaluation.Status      = IMPROVED
```

Damit ist dieser Optimierungszyklus abgeschlossen.

Die nächste Änderung erfolgt **nicht automatisch**. Für einen weiteren
Schritt wird erneut auf geeignete Daten und `AI.Ready=true` gewartet.

------------------------------------------------------------------------

## 21. Merksatz

> **NPS liefert der KI geprüfte Daten.\
> Die KI formuliert eine Empfehlung.\
> NPS prüft diese Empfehlung.\
> Der Benutzer entscheidet und ändert die NIBE manuell.\
> NPS misst anschließend, ob die Änderung tatsächlich geholfen hat.**

Dieses Verfahren verhindert, dass eine KI unmittelbar in die
Heizungsregelung eingreift, und macht Optimierungsentscheidungen
nachvollziehbar und schrittweise überprüfbar.

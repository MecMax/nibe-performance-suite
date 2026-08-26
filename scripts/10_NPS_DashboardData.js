/*****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               10_NPS_DashboardData
 * Datei:               10_NPS_DashboardData.js
 * Version:             5.11.0-rc.2
 * Build:               2026-08-25
 * Modulstatus:         STABIL
 * Architektur-Schicht: Präsentationsschicht / Dashboard-Datenadapter
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Bereitet die öffentlichen NPS-Daten für Visualisierungen auf. Die Ausgabe
 * folgt unmittelbar der fachlichen Dashboard-Navigation:
 *
 * - Overview
 * - Temperatures
 * - Compressor
 * - Energy
 * - Electrical
 * - Cycles
 * - Defrost
 * - Events
 * - System
 *
 * Die Version 4.0.0 ersetzt die bisherige Struktur vollständig. Es besteht
 * bewusst keine Rückwärtskompatibilität zu DashboardData 1.x.
 *
 * WICHTIGER MIGRATIONSHINWEIS
 * ---------------------------
 * Nur bei einer Migration von DashboardData 1.x auf 4.x:
 * 1. altes Script 10_NPS_DashboardData stoppen,
 * 2. 0_userdata.0.NPS.DashboardData vollständig löschen,
 * 3. dieses Script einfügen und starten,
 * 4. Jarvis ausschließlich mit den Slim-Datenpunkten verknüpfen.
 *
 * Upgrade von 4.7.0 auf 4.8.0:
 * - vorhandene DashboardData-Datenpunkte nicht löschen,
 * - Script ersetzen und starten; die Struktur bleibt unverändert.
 * - Health-Bewertung erhält den neuen Status KRITISCH für 60–79 %.
 *
 * Architekturregeln
 * -----------------
 * - reine Präsentations- und Formatierungsschicht
 * - keine Veränderung fachlicher Quelldaten
 * - Single Writer für 0_userdata.0.NPS.DashboardData
 * - fehlende Quelldaten werden als ungültig/null behandelt, nicht als 0
 * - Gesamtstrom ausschließlich aus ElectricalMeters
 * - Wärmemengen ausschließlich aus VirtualMeters
 * - Stromaufteilung weiterhin aus EnergyAllocation
 * - Farben für Betriebsarten und Bewertungsampeln bleiben getrennt
 *
 * Betriebsartenfarben
 * -------------------
 * Heizung:     #C45A32
 * Warmwasser:  #00A6A6
 * Standby:     #78909C
 * Abtauen:     #8E5BB7
 * Kühlen:      #2196F3
 * Aus:         #616161
 * Unbekannt:   grey
 *
 * Bewertungsfarben
 * ----------------
 * lime, green, yellow, orange, red, grey
 *
 * Aktualisierung
 * --------------
 * - ereignisgesteuert bei Änderungen der NPS-Quellmodule
 * - vollständiger Watchdog-Refresh alle fünf Minuten
 * - Zielaktualität der Livewerte: unter einer Sekunde
 *
 * Änderungsverlauf
 * ----------------
 * 5.11.0-rc.2 | 2026-08-25
 *             | Bedienhilfe für HeatingOptimization ergänzt.
 *             | Neu: Help.HeatingOptimization als HTML-Hilfeseite für
 *             | Anlagenstatus, Raumkomfort, 72-h-Heizkurvenanalyse,
 *             | Analysehinweise, Datenqualität, Heizkurvenparameter und
 *             | die drei Jarvis-HistoryGraphs.
 *             | Help.Manifest enthält nun 10 Kapitel (Allgemein + 9 Detailseiten).
 *             | Dokumentationsversion auf 1.1.0 und Strukturversion auf 35 erhöht.
 * 5.11.0-rc.1 | 2026-08-24
 *             | Neuer öffentlicher Bereich DashboardData.HeatingOptimization
 *             | für 15_NPS_HeatingCurveAnalyzer v0.1.1.
 *             | Reine Präsentationsprojektion ohne neue Heizungs-Fachlogik.
 *             | Neu: Status, Current, Rooms, 72h-Hauptanalyse, Evidence,
 *             | DataQuality, Configuration sowie vier fertige Jarvis-JSON-
 *             | Tabellen RoomsJson, AnalysisWindowsJson, EvidenceJson und
 *             | DataQualityJson.
 *             | Komplexe Analyzer-JSONs werden robust geparst; Fehler einer
 *             | Tabelle beeinträchtigen die übrigen Dashboardbereiche nicht.
 *             | Modul-15-History wird nicht nach DashboardData dupliziert.
 *             | Dashboard-Strukturversion auf 34 erhöht.
 * 5.10.1 | 2026-08-17
 *        | Bedienhilfen der acht Detailseiten vollständig ausgebaut.
 *        | Help.System, Performance, Energy, Compressor, Temperatures,
 *        | Cycles, Events und Defrost enthalten nun die freigegebenen
 *        | Kennzahlen-, Bewertungs-, Farb- und Interpretationshilfen.
 *        | Die HTML-Inhalte bleiben zentral in HELP_DOCUMENTATION gepflegt.
 *        | Strukturversion auf 33 erhöht.
 * 5.10.0 | 2026-08-17
 *        | Zentrale NPS-Bedienhilfe für Jarvis und spätere PDF-Erzeugung ergänzt.
 *        | Neu: Help.General sowie 8 modulspezifische HTML-Hilfen für System,
 *        | Performance, Energy, Compressor, Temperatures, Cycles, Events und Defrost.
 *        | Help.Manifest stellt Kapitelreihenfolge und Metadaten als JSON bereit.
 *        | Inhalte werden aus einer strukturierten Single Source of Truth gerendert.
 *        | Dashboard-Strukturversion auf 32 erhöht.
 * 5.9.7 | 2026-08-17
 *       | System um statischen Jarvis-Navigationsdatenpunkt Ruecksprung erweitert.
 *       | Neu: System.Ruecksprung mit dem Wert "← RÜCKSPRUNG" für HomeKitTile.
 *       | Dashboard-Strukturversion auf 31 erhöht.
 * 5.9.6 | 2026-08-16
 *       | Overview.HealthTable um den formatierten Berechnungszeitpunkt erweitert.
 *       | Neue Spalte: Zeitpunkt im Format TT.MM.JJJJ, HH:mm.
 *       | Jeder Abzug trägt denselben Health-Berechnungszeitpunkt.
 *       | HealthDetails und die Health-Berechnung bleiben unverändert.
 *       | Strukturversion bleibt 30.
 * 5.9.5 | 2026-08-16
 *       | Overview.HealthTable auf tatsächlich wirksame Health-Abzüge reduziert.
 *       | Spalten: Kriterium, Abzug, Ursache, Details.
 *       | Bei 100 % Health wird eine einzelne Zeile 'Keine Abzüge' ausgegeben.
 *       | HealthDetails und die Health-Berechnung bleiben unverändert.
 *       | Strukturversion bleibt 30.
 * 5.9.4 | 2026-08-16
 *       | Overview.HealthTable für Jarvis neu strukturiert.
 *       | Eine Zeile je Health-Prüfkriterium mit Prüfung, Gewicht, Status,
 *       | Abzug und Ursache. Einzelabzüge bleiben vollständig sichtbar.
 *       | HealthDetails bleibt als technische Diagnose unverändert erhalten.
 *       | Strukturversion bleibt 30.
 * 5.9.3 | 2026-08-15
 *       | Tageswerte des Verdichters gegen stehengebliebene Restwerte gehärtet.
 *       | AverageCycleDurationToday wird bei 0 Starts explizit auf 0 min gesetzt.
 *       | AverageFrequencyToday wird ohne heutige gültige Verdichter-Messzeit
 *       | explizit auf 0 Hz gesetzt. Alte Werte vom Vortag bleiben damit nicht
 *       | mehr in DashboardData/Jarvis sichtbar. Strukturversion bleibt 30.
 * 5.9.2 | 2026-08-15
 *       | Energy.PeriodComparisonJson an die Jarvis-Anzeige angepasst.
 *       | Alle kWh-Werte werden in der JSON-Tabelle mit genau einer
 *       | Nachkommastelle und deutschem Dezimaltrennzeichen ausgegeben.
 *       | Numerische Public-API-Datenpunkte und interne Berechnungen bleiben
 *       | unverändert; Strukturversion bleibt 30.
 * 5.9.1 | 2026-08-15
 *       | Performance.PeriodComparisonJson an die Jarvis-Anzeige angepasst.
 *       | COP-Werte werden in der JSON-Tabelle immer mit genau einer
 *       | Nachkommastelle und deutschem Dezimaltrennzeichen ausgegeben.
 *       | Verdichter- und Zusatzheizungsanteil werden ganzzahlig dargestellt.
 *       | Numerische Public-API-Datenpunkte und interne Berechnungen bleiben
 *       | unverändert; Strukturversion bleibt 30.
 * 5.9.0 | 2026-08-13
 *       | Events um Jarvis-Ereignishistorie und Tageszähler erweitert.
 *       | Neu: Events.History mit maximal 50 Ereignissen.
 *       | Spalten: Zeitpunkt, Ereignis, Kategorie, Status, Details.
 *       | Neu: Events.Today.HeatingCycles, WarmwaterCycles, Defrosts,
 *       | Warnings und Errors.
 *       | Events.Today.Date dient intern zur Tagesrücksetzung.
 *       | Verarbeitung nur bei neuer EventEngine-Sequenz; keine Duplikate
 *       | durch Watchdog- oder Fremdtrigger.
 *       | Dashboard-Strukturversion erhöht.
 * 5.8.7 | 2026-08-13
 *       | Energy.History um abgeschlossene Tageswerte für HistoryGraphs erweitert.
 *       | Neu: ElectricTotalPerDay, ElectricHeatingPerDay,
 *       | ElectricWarmwaterPerDay, ElectricZHPerDay,
 *       | HeatTotalPerDay, HeatHeatingPerDay,
 *       | HeatWarmwaterPerDay und HeatZHPerDay.
 *       | Quellen: statistics.0.save.sumDelta; Zusatzheizung elektrisch
 *       | aus den beiden ElectricalMeters-Zusatzheizungsregistern,
 *       | Zusatzheizungswärme aus Gesamtwärme minus Verdichterwärme.
 *       | Dashboard-Strukturversion erhöht.
 * 5.8.6 | 2026-08-13
 *       | Energy um vollständigen Periodenvergleich als JSON-Tabelle erweitert.
 *       | Neu: Energy.PeriodComparisonJson.
 *       | Enthält alle 14 Statistics-Perioden von Viertelstunde bis Jahr.
 *       | Spalten: Zeitraum, Strom gesamt, Wärme gesamt, Wärme Heizung,
 *       | Wärme Warmwasser. Dashboard-Strukturversion erhöht.
 * 5.8.5 | 2026-08-13
 *       | Periods.Day um Verdichterwärme heute erweitert.
 *       | Neu: Periods.Day.HeatCompressor in kWh.
 *       | Berechnung aus Tages-Heizwärme nur Verdichter +
 *       | Tages-Warmwasserwärme nur Verdichter.
 *       | Dashboard-Strukturversion erhöht.
 * 5.8.4 | 2026-08-13
 *       | Temperatures um Warmwasserbereitung BT6 erweitert.
 *       | Neu: Temperatures.WarmwaterCharging in °C.
 *       | Quelle: alias.0.Keller.Waschküche.Waermepumpe.Brauchwasserbereitung.
 *       | Bestehendes Temperatures.Warmwater als Warmwasser oben (BT7) bezeichnet.
 *       | Dashboard-Strukturversion erhöht.
 * 5.8.3 | 2026-08-13
 *       | Temperatures um Vorlauf-Sollwert und Vorlaufabweichung erweitert.
 *       | Neu: Temperatures.SupplyTarget in °C.
 *       | Neu: Temperatures.SupplyDeviation in K.
 *       | SupplyDeviation = Vorlauf Ist - Vorlauf Soll.
 *       | Quelle SupplyTarget: NIBE-Alias Berechneter_Vorlauf_Klimatisierungssystem_1.
 *       | Dashboard-Strukturversion erhöht.
 * 5.8.2 | 2026-08-13
 *       | Compressor.History um abgeschlossene Tageswerte erweitert.
 *       | Neu: StartsPerDay und RuntimePerDay.
 *       | Quellen: statistics.0.save.sumDelta der kumulativen Compressorwerte.
 *       | Public API erweitert; Strukturversion erhöht.
 * 5.8.1 | 2026-08-13
 *       | AverageFrequencyToday gegen veraltete CompressorMonitor-Daten gehärtet.
 *       | Zeitgewichtung erfolgt nur noch bei aktivem Verdichter,
 *       | gültigen CompressorMonitor-Daten und Datenalter <= MAX_DATA_AGE_SECONDS.
 *       | Public API unverändert; Strukturversion unverändert.
 * 5.8.0 | 2026-08-12
 *       | Compressor-Seite um Betriebsart und Tages-Betriebsdaten erweitert.
 *       | Neu: Compressor.Mode, StartsToday, RuntimeToday,
 *       | AverageCycleDurationToday und AverageFrequencyToday.
 *       | Starts/Laufzeit heute aus statistics.0; mittlere Zyklusdauer daraus.
 *       | Mittlere Frequenz heute als zeitgewichteter Mittelwert bei aktivem
 *       | Verdichter; Messlücken über 10 Minuten werden verworfen.
 *       | Dashboard-Strukturversion erhöht.
 * 5.7.1 | 2026-08-12
 *       | Cycles.History: Startzeit um vierstellige Jahreszahl erweitert.
 *       | Format jetzt TT.MM.JJJJ HH:mm.
 * 5.7.0 | 2026-08-12
 *       | Cycles.History als JSON-Tabelle für Jarvis ergänzt.
 *       | Enthält maximal die letzten 20 abgeschlossenen Zyklen.
 *       | Spalten: Start, Typ, Dauer, COP, Wärme, Strom, Qualität.
 *       | Neuester Zyklus steht an erster Stelle; Duplikate werden verhindert.
 *       | Aktualisierung erfolgt nach neuer CycleAnalyzer-Zyklusanalyse.
 *       | Dashboard-Strukturversion erhöht.
 * 5.6.2 | 2026-08-10
 *       | Periods.Day um Zusatzheizungsanteil heute erweitert.
 *       | Neu: Periods.Day.ShareZH in %.
 *       | Berechnung aus Tages-Zusatzheizungswärme / Tages-Gesamtwärme.
 *       | Dashboard-Strukturversion erhöht.
 * 5.6.1 | 2026-08-10
 *       | Alle öffentlichen COP-Ausgaben auf eine Nachkommastelle vereinheitlicht.
 *       | Betroffen: Live-COP, Energy-COPs, Tages-COPs, Statistics-COPs,
 *       | Performance.PeriodComparisonJson und Zyklus-COP.
 *       | Interne Quellwerte bleiben unverändert; gerundet wird nur bei
 *       | Berechnung/Publikation in DashboardData.
 *       | Strukturversion unverändert.
 * 5.6.0 | 2026-08-10
 *       | Performance-Periodenvergleich als fertige JSON-Tabelle ergänzt.
 *       | Neu: Performance.PeriodComparisonJson.
 *       | Enthält COP gesamt, COP Heizung, COP Warmwasser,
 *       | Verdichteranteil und Zusatzheizungsanteil für
 *       | Heute, Gestern, laufende Woche, laufenden Monat und laufendes Jahr.
 *       | Dashboard-Strukturversion erhöht.
 * 5.5.9 | 2026-08-08
 *       | Mappingfehler aus 5.5.8 korrigiert.
 *       | ShareCompressor und HeatZH werden jetzt korrekt nach Periods.Day
 *       | statt fälschlich nach Energy geschrieben.
 *       | Strukturversion bleibt 19.
 * 5.5.8 | 2026-08-08
 *       | Tagesübersicht um Verdichteranteil und Zusatzheizungswärme erweitert.
 *       | Neu: Periods.Day.ShareCompressor in %.
 *       | Neu: Periods.Day.HeatZH in kWh.
 *       | Tageswerte basieren auf statistics.0 der VirtualMeters.
 * 5.5.7 | 2026-08-08
 *       | Cycles um die Laufzeit des aktuell laufenden Verdichtertakts erweitert.
 *       | Neu: Cycles.CurrentDuration in min.
 *       | Quelle: StateMachine.Current.Runtime.
 *       | Dashboard-Strukturversion erhöht.
 * 5.5.6 | 2026-08-08
 *       | Korrektur: doppelten SOURCE-Eintrag ELECTRICAL_POWER entfernt.
 *       | Live-COP-Funktionalität unverändert; vorhandene ElectricalMeters-
 *       | Quelle wird weiterverwendet.
 * 5.5.5 | 2026-08-08
 *       | Live-COP ergänzt.
 *       | Berechnung: Wärmeleistung EB101 / elektrische Gesamtleistung.
 *       | Neu: Performance.LiveCOP und Performance.LiveCOPValid.
 *       | Dashboard-Strukturversion auf 17 erhöht.
 * 5.5.4 | 2026-08-08
 *       | Neuer öffentlicher Bereich DashboardData.Performance.
 *       | Neu: Performance.ThermalPower (aktuelle Wärmeleistung EB101).
 *       | Quelle: alias.0.Keller.Waschküche.Waermepumpe.Erzeugte_Leistung_Wärme_(EB101).
 *       | Dashboard-Strukturversion auf 16 erhöht.
 * 5.5.3 | 2026-08-08
 *       | Temperatures um Brauchwassertemperatur erweitert.
 *       | Quelle: alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_oben.
 *       | Neu: DashboardData.Temperatures.Warmwater in °C.
 *       | Dashboard-Strukturversion auf 15 erhöht.
 * 5.5.2 | 2026-08-08
 *       | Overview um NIBE-Alarmstatus erweitert.
 *       | Neu: Overview.AlarmNumber und Overview.AlarmActive.
 *       | AlarmActive ist true, wenn AlarmNumber > 0.
 *       | Dashboard-Strukturversion auf 14 erhöht.
 * 5.5.1 | 2026-08-08
 *       | TypeScript-Prüfung im ioBroker JavaScript-Editor korrigiert.
 *       | STATISTICS_AREAS und DERIVED_STATISTICS_AREAS werden bei der
 *       | Strukturerzeugung getrennt durchlaufen; keine concat-Typkollision.
 * 5.5.0 | 2026-08-08
 *       | Neuer öffentlicher Bereich DashboardData.AdditionalHeat.
 *       | Active zeigt den Betrieb der internen Zusatzheizung anhand der
 *       | aktuellen Zusatzheizungsleistung (> 0 kW).
 *       | Power veröffentlicht die aktuelle Zusatzheizungsleistung in kW.
 *       | Mode veröffentlicht den aktuellen NIBE-Zusatzheizungsmodus.
 *       | Dashboard-Strukturversion auf 13 erhöht.
 * 5.4.0 | 2026-07-30
 *       | Neuer öffentlicher Bereich DashboardData.Electrical für Jarvis.
 *       | Live-, Zähler-, Offset-, Gültigkeits- und Zeitstempeldaten werden
 *       | direkt aus ElectricalMeters 1.1.1 übernommen.
 *       | OffsetStatus wird in die Bewertungsfarbe green/orange/red/grey
 *       | übersetzt. Bestehende Energy- und Statistics-Strukturen bleiben
 *       | unverändert.
 * 5.2.0 | 2026-07-30
 *       | Dashboard-Statistik-JSONs um alle kumulativen Zähler aus
 *       | VirtualMeters und ElectricalMeters ergänzt.
 *       | Neu: VirtualMeters Gesamt nur Verdichter und Gesamt inklusive
 *       | Zusatzheizung sowie die vier elektrischen Registerzähler und deren
 *       | Register-Gesamtsumme.
 *       | Der monotone aktuelle Gesamtstromzähler bleibt Statistics.StromGesamt.
 * 5.1.0 | 2026-07-30
 *       | Elektrischer Gesamtzähler auf
 *       | NPS.ElectricalMeters.Aktuell.Gesamt umgestellt.
 *       | Tages-, Jahres- und Periodenstatistiken für Gesamtstrom verwenden
 *       | nun ebenfalls den ElectricalMeters-Zähler.
 *       | Energy.HeatTotal wird aus den aktuellen kumulativen VirtualMeters
 *       | für Heizung und Warmwasser gebildet und nicht mehr aus Jahresdeltas.
 *       | Keine Änderung an den aufgeteilten EnergyAllocation-Zählern.
 * 5.0.1 | 2026-07-27
 *       | Fehlende Energie-Summendatenpunkte ergänzt:
 *       | Energy.HeatTotal und Periods.Day.HeatTotal.
 *       | CycleAnalyzer-Quellpfade auf Energy.ElectricKWh und
 *       | Energy.HeatKWh korrigiert.
 *       | Veröffentlichungslogik und Datenpunktstruktur synchronisiert.
 * 5.0.0 | 2026-07-27
 *       | COP-Bilanzierung projektweit vereinheitlicht.
 *       | Gesamtstrom für Tages- und Jahres-COP wird direkt aus statistics.0
 *       | des Alias-Gesamtverbrauchs gelesen.
 *       | Wärmeenergie wird aus den VirtualMeters inklusive Zusatzheizung gelesen.
 *       | EnergyAllocation bleibt reine Verteilungs- und Diagnosequelle.
 *       | Zyklus-COP wird unverändert aus dem CycleAnalyzer übernommen.
 * 4.8.0 | 2026-07-27
 *       | Health-Klassifizierung fachlich erweitert.
 *       | 60–79 % werden nun als KRITISCH mit orange bewertet.
 *       | 0–59 % werden als STÖRUNG mit red bewertet.
 *       | HealthState, HealthColor, HealthDetails und HealthTable sind konsistent.
 * 4.7.0 | 2026-07-27
 *       | Overview.HealthTable als Jarvis-optimierte JSON-Tabelle ergänzt.
 *       | HealthDetails bleibt als technisches Diagnose-JSON erhalten.
 *       | HealthTable stellt Zusammenfassung und Einzelprüfungen zeilenweise dar.
 * 4.6.1 | 2026-07-27
 *       | EnergyAllocation.System.LastUpdate aus der Health-Altersprüfung entfernt.
 *       | Das Alter bleibt in HealthDetails rein informativ sichtbar.
 *       | energy.valid und energy.warning bleiben unverändert Teil der Bewertung.
 * 4.6.0 | 2026-07-27
 *       | Health-Bewertung in Overview vollständig nachvollziehbar gemacht.
 *       | HealthReason, HealthDetails und HealthLastUpdate ergänzt.
 *       | Jeder Abzug enthält Kriterium, Gewichtung, Ursache und Quelldaten.
 *       | HealthPercent bleibt die Summe der bestandenen Gewichtungen.
 * 4.5.0 | 2026-07-27
 *       | Aggregierte COP-Werte werden aus synchronen statistics.0-
 *       | Jahresdeltas berechnet; Tages-COP bleibt unter Periods.Day.
 *       | Compressor.State enthält den Klartextzustand der StateMachine,
 *       | Compressor.Status den technischen CompressorMonitor-Rohstatus.
 *       | Health-Score 0–100 %, HealthState, HealthMessage sowie der
 *       | technische Anlagenzustand für Overview und System ergänzt.
 * 4.4.0 | 2026-07-26
 *       | Verdichterzustand und Verdichterstatus werden ausschließlich aus
 *       | StateMachine.Current.State der StateMachine übernommen.
 *       | Nicht verifizierte numerische Statuswerte werden nicht verwendet.
 *       | Statistikquelle Abtaudauer auf den kumulativen Zähler
 *       | DefrostMonitor.Defrost.TotalDurationMinutes umgestellt.
 * 4.3.1 | 2026-07-26
 *       | Ereignis-Trigger für Statistics optimiert.
 *       | Statistics-Perioden werden über den 5-Minuten-Watchdog
 *       | aktualisiert; dadurch deutlich weniger Subscriptions.
 *       | TypeScript-kompatible createState-Aufrufe ohne ack-Parameter.
 * 4.3.0 | 2026-07-26
 *       | Neuer Bereich Statistics mit Perioden-JSON je Statistikzähler.
 *       | Je Statistik zusätzlich Yesterday, LastMonth und LastYear als
 *       | numerische, für InfluxDB geeignete Datenpunkte.
 *       | Laufende Perioden werden aus statistics.0.temp.sumDelta gelesen,
 *       | abgeschlossene Vorperioden aus statistics.0.save.sumDelta.
 *       | Konfigurierbarer Strompreis für Kostenanzeige in Energie-JSONs.
 *       | Bestehende Public API bleibt unverändert erhalten.
 * 4.2.0 | 2026-07-25
 *       | Parallele Tagesauswertung über den Standardadapter statistics.0.
 *       | Neuer Bereich Periods.Day mit Strom-, Wärme- und COP-Tageswerten.
 *       | Bestehende Energy-Struktur bleibt zum direkten Vergleich erhalten.
 *       | Public API auf 74 Datenpunkte erweitert.
 * 4.1.0 | 2026-07-25
 *       | Laufzeiten im Dashboard einheitlich auf Minuten umgestellt.
 *       | Dashboard-Zeitstempel auf lokale ISO-8601-Zeit vereinheitlicht.
 *       | Energy.COPTotal ergänzt; COPHeating und COPWarmwater werden
 *       | aus den kumulativen Energiezählern berechnet.
 *       | Public API auf 65 Datenpunkte erweitert.
 * 4.0.1 | 2026-07-24
 *       | SelfTest-Meldungen auf Overview.Message korrigiert.
 *       | Public API bleibt unverändert bei exakt 64 Datenpunkten.
 * 4.0.0 | 2026-07-24
 *       | DashboardData Slim als stabile Public API für Jarvis.
 *       | Reduktion auf 64 visualisierungsrelevante Datenpunkte.
 *       | Ereignissteuerung plus 5-Minuten-Watchdog.
 *       | Keine JSON-, Valid-, Warning- oder Datenalter-Hilfswerte.
 * 3.0.0 | 2026-07-23
 *       | Vereinfachte und bereinigte Produktionsfassung.
 *       | Korrekte Bewertungsfarben ohne ungültige Property-Zugriffe.
 *       | Reduzierte Startlogik und eindeutiger SelfTest.
 * 2.1.0 | 2026-07-23
 *       | Robuste Initialisierung mit Zielprüfung und SelfTest.
 *       | Erstbefüllung erst nach vollständiger State-Erzeugung.
 * 2.0.0 | 2026-07-23
 *       | Vollständiger Neuaufbau der DashboardData-Public-API.
 *       | Gliederung nach Overview, Temperatures, Compressor, Energy,
 *       | Cycles, Defrost, Events und System.
 ****************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '5.11.0-rc.2',
        STRUCTURE_VERSION: 35,
        EVENT_HISTORY_LIMIT: 50,
        COMP_FREQ_MAX_INTEGRATION_GAP_SECONDS: 600,
        CYCLE_HISTORY_LIMIT: 20,
        DEBUG: false,

        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.DashboardData',

        UPDATE_CRON: '*/5 * * * *',
        STATE_CREATE_DELAY_MS: 250,
        STRUCTURE_WAIT_TIMEOUT_MS: 10000,
        STRUCTURE_WAIT_INTERVAL_MS: 250,
        EVENT_DEBOUNCE_MS: 500,
        MAX_DATA_AGE_SECONDS: 180,
        DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH: 0.30,

        MODE_COLORS: Object.freeze({
            HEATING: '#C45A32',
            WARMWATER: '#00A6A6',
            STANDBY: '#78909C',
            DEFROST: '#8E5BB7',
            COOLING: '#2196F3',
            OFF: '#616161',
            UNKNOWN: 'grey'
        }),

        QUALITY_COLORS: Object.freeze({
            EXCELLENT: 'lime',
            GOOD: 'green',
            MEDIUM: 'yellow',
            WARNING: 'orange',
            CRITICAL: 'red',
            INVALID: 'grey'
        })
    };

    const HELP_DOCUMENTATION = Object.freeze({
        version: '1.1.0',
        title: 'NIBE Performance Suite – Bedienungs- und Auswertungshandbuch',
        chapters: Object.freeze([
            {
                key: 'General',
                number: 1,
                title: 'NPS – Allgemeine Bedienung',
                summary: 'Grundlagen zur Navigation, Farbgebung und Interpretation der NIBE Performance Suite.',
                sections: [
                    {
                        title: 'Navigation',
                        paragraphs: [
                            'Die Hauptseite führt zu neun Detailseiten: System, Leistung & Effizienz, Energie, Verdichter, Temperaturen, Zyklus, Ereignisse, Enteisung und Heizungsanalyse.',
                            'Ein Pfeil nach rechts kennzeichnet den Sprung in eine Detailansicht. Ein Pfeil nach links kennzeichnet den Rücksprung zur NPS-Hauptseite.'
                        ]
                    },
                    {
                        title: 'Drei verschiedene Farbarten',
                        paragraphs: [
                            'NPS unterscheidet bewusst zwischen Betriebsartenfarben, Bewertungsfarben und reinen Kurvenfarben. Eine Kurvenfarbe ist keine Qualitätsbewertung.'
                        ],
                        table: {
                            headers: ['Art', 'Bedeutung'],
                            rows: [
                                ['Betriebsartenfarbe', 'Zeigt, welcher Anlagenprozess aktuell aktiv ist.'],
                                ['Bewertungsfarbe', 'Ampel für Qualität, Effizienz oder Plausibilität.'],
                                ['Kurvenfarbe', 'Dient nur zur eindeutigen Wiedererkennung einer Messreihe im Diagramm.']
                            ]
                        }
                    },
                    {
                        title: 'Betriebsartenfarben',
                        colorRows: [
                            ['#C45A32', 'Heizung'],
                            ['#00A6A6', 'Warmwasser'],
                            ['#78909C', 'Standby'],
                            ['#8E5BB7', 'Abtauen'],
                            ['#2196F3', 'Kühlen'],
                            ['#616161', 'Aus'],
                            ['grey', 'Unbekannt']
                        ]
                    },
                    {
                        title: 'Bewertungsfarben',
                        colorRows: [
                            ['lime', 'Exzellent / hervorragend'],
                            ['green', 'Gut'],
                            ['yellow', 'Normal / Warnung'],
                            ['orange', 'Auffällig / kritisch'],
                            ['red', 'Kritisch / Störung'],
                            ['grey', 'Keine gültige Bewertung']
                        ]
                    },
                    {
                        title: 'COP-Ampel',
                        table: {
                            headers: ['COP', 'Bewertung'],
                            rows: [
                                ['< 0,1', 'Grau – keine Bewertung / Anlage inaktiv'],
                                ['0,1 bis < 2,2', 'Rot – kritisch'],
                                ['2,2 bis < 3,0', 'Orange – auffällig'],
                                ['3,0 bis < 3,8', 'Gelb – normal'],
                                ['3,8 bis < 4,5', 'Grün – gut'],
                                ['≥ 4,5', 'Lime – hervorragend']
                            ]
                        },
                        paragraphs: [
                            'COP-Werte werden in NPS mit einer Nachkommastelle dargestellt. Einzelne Momentanwerte sollten immer zusammen mit Betriebsart, Außentemperatur und Leistungsanforderung betrachtet werden.'
                        ]
                    },
                    {
                        title: 'Hinweis zur Interpretation',
                        paragraphs: [
                            'NPS ist eine Analyse- und Visualisierungsschicht. Eine rote Bewertung eines Analysewertes ist nicht automatisch gleichbedeutend mit einer technischen Störung der Wärmepumpe.',
                            'Für technische Störungen sind insbesondere Alarmstatus und technischer Anlagenzustand maßgeblich.'
                        ]
                    }
                ]
            },
            {
                key: 'System', number: 2, title: 'System',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – System</h1>
<p>Die Detailseite <b>System</b> dient der übergeordneten Zustands- und Datenüberwachung der NIBE Performance Suite. Sie hilft dabei zu unterscheiden, ob ein Problem von der Wärmepumpenanlage selbst, von der Datenbereitstellung oder von einem NPS-Modul ausgeht.</p>

<h2>Anlagenzustand</h2>
<p>Der Anlagenzustand beschreibt die technische Gesamtbewertung der überwachten Wärmepumpenanlage. Ein auffälliger Anlagenzustand sollte deshalb anders bewertet werden als ein reines Daten- oder NPS-Problem.</p>

<h2>NPS Health</h2>
<p><b>NPS Health</b> ist ein Wert zwischen 0 und 100 %. Er bewertet die Qualität und Plausibilität der für NPS verfügbaren Informationen. <b>100 % bedeutet, dass aktuell kein bewertetes Prüfkriterium zu einem Abzug führt.</b> Ein niedriger Health-Wert bedeutet dagegen nicht automatisch, dass die Wärmepumpe eine technische Störung hat.</p>
<table>
<tr><th>Health</th><th>Bewertung</th><th>Bedeutung</th></tr>
<tr><td>≥ 98 %</td><td><span class="good">●</span> hervorragend</td><td>Keine bzw. praktisch keine Einschränkungen</td></tr>
<tr><td>90–&lt;98 %</td><td><span class="green">●</span> gut</td><td>Geringfügige Einschränkungen</td></tr>
<tr><td>80–&lt;90 %</td><td><span class="yellow">●</span> eingeschränkt</td><td>Auffälligkeiten sollten geprüft werden</td></tr>
<tr><td>60–&lt;80 %</td><td><span class="orange">●</span> deutlich eingeschränkt</td><td>Mehrere oder relevante Einschränkungen</td></tr>
<tr><td>&lt;60 %</td><td><span class="red">●</span> kritisch</td><td>NPS-Daten bzw. Auswertung deutlich beeinträchtigt</td></tr>
</table>

<h2>Health-Berechnungsdetails</h2>
<p>Die Tabelle zeigt nur tatsächlich wirksame Abzüge. Enthalten sind Kriterium, Abzug, Ursache, Details und Berechnungszeitpunkt. Bei 100 % Health sind keine Abzüge vorhanden.</p>

<h2>Datenqualität, Modulstatus und Fehlerzähler</h2>
<p><b>Daten gültig</b> zeigt, ob die für die Darstellung benötigten Eingangsdaten verwendbar sind. <b>Modulstatus</b> zeigt den Zustand der beteiligten NPS-Module. <b>Fehlerzähler</b> unterstützen die Diagnose; ein Wert größer als null weist auf registrierte Fehler hin, beschreibt aber noch nicht Ursache oder Schwere.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td><b>Anlagenzustand OK + Health 100 %</b></td><td>Anlage und NPS-Datenlage sind unauffällig.</td></tr>
<tr><td><b>Anlagenzustand OK + Health 85 %</b></td><td>Die Anlage kann technisch in Ordnung sein; NPS hat jedoch Einschränkungen erkannt.</td></tr>
<tr><td><b>Anlagenzustand auffällig + Health 100 %</b></td><td>Die Datenbasis ist gut, gleichzeitig liegt ein technischer Anlagenhinweis vor.</td></tr>
<tr><td><b>Health niedrig + Modulstatus nicht OK</b></td><td>Ein Problem innerhalb der Datenverarbeitung bzw. eines NPS-Moduls ist wahrscheinlich.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Anlagenzustand und NPS Health sind zwei unterschiedliche Bewertungen. Der Anlagenzustand beschreibt den technischen Zustand der Wärmepumpenanlage, NPS Health dagegen die Qualität, Vollständigkeit und Plausibilität der für NPS verfügbaren Informationen.</div>
</div>
`,
                summary: 'Systemzustand, Datenqualität, Health-Bewertung und technische Diagnose.',
                sections: [
                    {
                        title: 'Wichtige Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['NPS Health', 'Gesamtbewertung der überwachten NPS-Datenqualität von 0 bis 100 %.'],
                                ['Health-Zustand', 'Textuelle Einordnung des Health-Wertes.'],
                                ['Technischer Anlagenzustand', 'Bewertung von Erreichbarkeit und aktivem NIBE-Alarm.'],
                                ['Dashboarddaten gültig', 'Zeigt, ob die wichtigsten Datenquellen aktuell gültige Daten liefern.'],
                                ['Update-/Fehlerzähler', 'Diagnosewerte des DashboardData-Moduls.']
                            ]
                        }
                    },
                    {
                        title: 'Health-Ampel',
                        table: {
                            headers: ['Health', 'Bewertung'],
                            rows: [
                                ['< 60 %', 'Rot – STÖRUNG'],
                                ['60–79 %', 'Orange – KRITISCH'],
                                ['80–89 %', 'Gelb – WARNUNG'],
                                ['90–97 %', 'Grün – GUT'],
                                ['≥ 98 %', 'Lime – EXZELLENT']
                            ]
                        }
                    },
                    {
                        title: 'Health richtig lesen',
                        paragraphs: [
                            'Health bewertet die Verfügbarkeit und Plausibilität der NPS-Datenquellen. 100 % bedeutet, dass aktuell kein bewertetes Prüfkriterium einen Abzug verursacht.',
                            'Die Health-Tabelle zeigt ausschließlich wirksame Abzüge mit Kriterium, Abzug, Ursache, Details und Berechnungszeitpunkt. Ein niedriger Health-Wert bedeutet nicht automatisch eine technische Störung der NIBE-Anlage.'
                        ]
                    }
                ]
            },
            {
                key: 'Performance', number: 3, title: 'Leistung & Effizienz',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Leistung &amp; Effizienz</h1>
<p>Die Detailseite zeigt, wie effizient die Wärmepumpe elektrische Energie in nutzbare Wärme umsetzt. Sie verbindet aktuelle Leistungswerte mit COP-Kennzahlen und der Aufteilung zwischen Verdichter und Zusatzheizung.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Elektrische Leistung</td><td>Aktuell von der Wärmepumpenanlage aufgenommene elektrische Leistung.</td></tr>
<tr><td>Wärmeleistung</td><td>Aktuell von der Anlage bereitgestellte thermische Leistung.</td></tr>
<tr><td>Live-COP</td><td>Momentanes Verhältnis von Wärmeleistung zu elektrischer Leistung.</td></tr>
<tr><td>COP gesamt</td><td>Verhältnis von erzeugter Wärme zu eingesetzter elektrischer Energie für den Gesamtbetrieb.</td></tr>
<tr><td>COP Heizung</td><td>Effizienz des Betriebs für die Raumheizung.</td></tr>
<tr><td>COP Warmwasser</td><td>Effizienz der Warmwasserbereitung.</td></tr>
<tr><td>Verdichteranteil</td><td>Anteil der erzeugten Wärmemenge, der vom Verdichter bereitgestellt wurde.</td></tr>
<tr><td>Zusatzheizungsanteil</td><td>Anteil der Wärmemenge aus der elektrischen Zusatzheizung.</td></tr>
</table>

<h2>COP verstehen</h2>
<p><b>COP = erzeugte Wärme ÷ eingesetzte elektrische Energie.</b> Ein COP von 4,0 bedeutet beispielsweise, dass aus 1 kWh elektrischer Energie rechnerisch etwa 4 kWh Wärme bereitgestellt wurden.</p>
<p>Der Live-COP ist eine Momentaufnahme und kann kurzfristig deutlich schwanken. Periodische COP-Werte über längere Zeiträume sind für die Effizienzbewertung aussagekräftiger.</p>

<h2>COP-Ampel</h2>
<table>
<tr><th>COP</th><th>Bewertung</th></tr>
<tr><td>≥ 4,5</td><td><span class="good">●</span> hervorragend</td></tr>
<tr><td>3,8–&lt;4,5</td><td><span class="green">●</span> gut</td></tr>
<tr><td>3,0–&lt;3,8</td><td><span class="yellow">●</span> normal</td></tr>
<tr><td>2,2–&lt;3,0</td><td><span class="orange">●</span> auffällig</td></tr>
<tr><td>0,1–&lt;2,2</td><td><span class="red">●</span> kritisch</td></tr>
<tr><td>&lt;0,1</td><td><span class="grey">●</span> keine sinnvolle Bewertung / inaktiv</td></tr>
</table>

<h2>Verdichter- und Zusatzheizungsanteil</h2>
<p>Verdichteranteil und Zusatzheizungsanteil ergänzen sich grundsätzlich zu ungefähr 100 %. Ein hoher Verdichteranteil ist energetisch meist günstig. Zusatzheizung ist jedoch nicht automatisch ein Fehler und kann bei hoher Last oder besonderen Betriebszuständen erforderlich sein.</p>

<h2>Leistung ist nicht Energie</h2>
<p><b>kW</b> beschreibt die momentane Leistung. <b>kWh</b> beschreibt die über einen Zeitraum aufsummierte Energiemenge.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Hoher COP + hoher Verdichteranteil</td><td>Energetisch günstiger Wärmepumpenbetrieb.</td></tr>
<tr><td>Niedriger Live-COP für kurze Zeit</td><td>Noch kein Hinweis auf ein Problem; Betriebsart und Verlauf betrachten.</td></tr>
<tr><td>COP Warmwasser niedriger als COP Heizung</td><td>Grundsätzlich erwartbar, da höhere Temperaturen erforderlich sind.</td></tr>
<tr><td>Zusatzheizungsanteil steigt</td><td>Ursache prüfen, aber nicht automatisch als Störung bewerten.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Einzelne COP-Werte nie isoliert bewerten. Außentemperatur, Vorlauftemperatur, Betriebsart, Warmwasserbereitung, Enteisung und Zusatzheizung beeinflussen die Effizienz.</div>
</div>
`,
                summary: 'Aktuelle Wärmeleistung, Live-COP und periodische Effizienzkennzahlen.',
                sections: [
                    {
                        title: 'Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['Wärmeleistung', 'Aktuell von der Außeneinheit EB101 erzeugte thermische Leistung in kW.'],
                                ['Live-COP', 'Aktuelle Wärmeleistung geteilt durch die aktuelle elektrische Gesamtleistung.'],
                                ['COP gesamt', 'Verhältnis von erzeugter Gesamtwärme zu eingesetzter elektrischer Energie.'],
                                ['COP Heizung', 'Effizienz für den Heizbetrieb.'],
                                ['COP Warmwasser', 'Effizienz für die Warmwasserbereitung.'],
                                ['Verdichteranteil', 'Anteil der Wärmeerzeugung, der dem Verdichter zugerechnet wird.'],
                                ['Zusatzheizungsanteil', 'Anteil der Wärmeerzeugung aus der Zusatzheizung.']
                            ]
                        }
                    },
                    {
                        title: 'Bewertung',
                        paragraphs: [
                            'Für COP gesamt, COP Heizung und COP Warmwasser gilt die allgemeine COP-Ampel aus Kapitel 1.',
                            'Verdichter- und Zusatzheizungsanteil sind zunächst Bilanzkennzahlen. Ein hoher Zusatzheizungsanteil ist ein Anlass zur Analyse, aber nicht automatisch eine Störung.'
                        ]
                    }
                ]
            },
            {
                key: 'Energy', number: 4, title: 'Energie',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Energie</h1>
<p>Die Detailseite zeigt die über einen Zeitraum aufsummierten elektrischen und thermischen Energiemengen der Wärmepumpe. Sie beantwortet vor allem: Wie viel Strom wurde eingesetzt, wie viel Wärme daraus erzeugt und mit welcher Effizienz?</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Strom</td><td>Aufgenommene elektrische Energie in kWh.</td></tr>
<tr><td>Wärme gesamt</td><td>Insgesamt bereitgestellte thermische Energie in kWh.</td></tr>
<tr><td>Wärme Heizung</td><td>Wärmemenge für die Raumheizung.</td></tr>
<tr><td>Wärme Warmwasser</td><td>Wärmemenge für die Warmwasserbereitung.</td></tr>
<tr><td>Wärme Verdichter</td><td>Durch den Wärmepumpenprozess erzeugte Wärmemenge.</td></tr>
<tr><td>Wärme Zusatzheizung</td><td>Durch die elektrische Zusatzheizung bereitgestellte Wärmemenge.</td></tr>
<tr><td>COP gesamt / Heizung / Warmwasser</td><td>Energiebezogene Effizienz für den jeweiligen Betrachtungsbereich.</td></tr>
<tr><td>Verdichteranteil / Zusatzheizungsanteil</td><td>Anteile der bereitgestellten Wärme nach Erzeugungsart.</td></tr>
</table>

<h2>Leistung und Energie unterscheiden</h2>
<p><b>kW = Leistung</b>, also momentane Aufnahme oder Erzeugung. <b>kWh = Energie</b>, also über einen Zeitraum aufsummierte Leistung.</p>

<h2>Datenbasis</h2>
<p>Die NPS-Wärmemengen stammen aus den VirtualMeters. Sie bilden die zentrale Datenquelle für die nachfolgenden Energie- und Effizienzberechnungen.</p>

<h2>COP im Energieverlauf</h2>
<p><b>COP = erzeugte Wärmeenergie ÷ eingesetzte elektrische Energie.</b> Für die Bewertung gelten dieselben NPS-Grenzen wie auf der Seite Leistung &amp; Effizienz.</p>

<h2>Zeiträume</h2>
<p>Verglichen werden laufende und abgeschlossene Perioden wie Heute, Gestern, Woche, Monat oder Jahr. Gleich lange bzw. vergleichbare Zeiträume sollten bevorzugt miteinander verglichen werden.</p>

<h2>Diagramme richtig lesen</h2>
<p>Einzelne Ausschläge sind weniger aussagekräftig als Trends und wiederkehrende Veränderungen. Ein sinkender COP sollte gemeinsam mit Außentemperatur, Vorlauf, Warmwasserbetrieb, Zusatzheizung und Enteisungen betrachtet werden.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Stromverbrauch und Wärmemenge steigen ähnlich stark</td><td>Zunächst plausibel bei höherem Wärmebedarf.</td></tr>
<tr><td>Strom steigt deutlich stärker als Wärme</td><td>COP sinkt; Betriebsbedingungen und Zusatzheizung prüfen.</td></tr>
<tr><td>Wärmebedarf steigt bei fallender Außentemperatur</td><td>Grundsätzlich erwartbares Verhalten.</td></tr>
<tr><td>Ein einzelner schlechter Tag</td><td>Noch keine belastbare Aussage; Woche bzw. Monat vergleichen.</td></tr>
</table>

<div class="note"><b>Hinweis:</b> Die dargestellten Energiemengen und COP-Werte sind Auswertungswerte. Ihre Genauigkeit hängt von Qualität und Aktualität der zugrunde liegenden Daten ab.</div>
</div>
`,
                summary: 'Elektrische Energie, Wärmemengen und deren Aufteilung nach Heizung, Warmwasser, Verdichter und Zusatzheizung.',
                sections: [
                    {
                        title: 'Datenquellen',
                        paragraphs: [
                            'Gesamtstrom stammt aus ElectricalMeters. Wärmemengen stammen ausschließlich aus VirtualMeters. Die Stromaufteilung auf Betriebsarten stammt aus EnergyAllocation.'
                        ]
                    },
                    {
                        title: 'Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['Strom gesamt', 'Kumulierte elektrische Energie der Anlage.'],
                                ['Strom Heizung', 'Der Heizung zugeordnete elektrische Energie.'],
                                ['Strom Warmwasser', 'Der Warmwasserbereitung zugeordnete elektrische Energie.'],
                                ['Wärme gesamt', 'Erzeugte Wärmeenergie inklusive Zusatzheizung.'],
                                ['Wärme nur Verdichter', 'Wärmemenge, die dem Verdichter zugerechnet wird.'],
                                ['Wärme Zusatzheizung', 'Differenz zwischen Gesamtwärme und Verdichterwärme.'],
                                ['Periodenvergleich', 'Vergleicht Energiekennzahlen von Viertelstunde bis Jahr.']
                            ]
                        }
                    },
                    {
                        title: 'Interpretation',
                        paragraphs: [
                            'Für Effizienzbewertungen sollte Energie immer über ausreichend lange Zeiträume betrachtet werden. Kurze Zeiträume können durch Warmwasserbereitung, Abtauung oder Anlagenstillstand stark verzerrt sein.'
                        ]
                    }
                ]
            },
            {
                key: 'Compressor', number: 5, title: 'Verdichter',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Verdichter</h1>
<p>Die Detailseite zeigt, wie der Verdichter aktuell arbeitet und wie sich sein Betrieb über den Tag entwickelt. Im Mittelpunkt stehen Aktivstatus, Betriebsart, Frequenz, Starts, Laufzeit, Zyklusdauer und Modulation.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Verdichter aktiv</td><td>Zeigt, ob der Verdichter momentan läuft.</td></tr>
<tr><td>Betriebsart / Zyklustyp</td><td>Ordnet den aktuellen Verdichterlauf dem Betriebszweck zu.</td></tr>
<tr><td>Frequenz</td><td>Aktuelle Verdichterfrequenz in Hz; Maß für den Modulationsgrad.</td></tr>
<tr><td>Starts gesamt / heute</td><td>Kumulierte bzw. heutige Anzahl der Verdichterstarts.</td></tr>
<tr><td>Laufzeit gesamt / heute</td><td>Kumulierte bzw. heutige Verdichterlaufzeit.</td></tr>
<tr><td>Ø Zyklusdauer</td><td>Mittlere Dauer der heutigen Verdichterläufe.</td></tr>
<tr><td>Ø Frequenz</td><td>Zeitgewichtete mittlere Verdichterfrequenz während des heutigen Betriebs.</td></tr>
</table>

<h2>Frequenz und Modulation</h2>
<p>Eine niedrige Frequenz bedeutet geringere momentane Verdichterleistung, eine höhere Frequenz entsprechend mehr Leistung. Eine niedrige Frequenz ist nicht automatisch gut und eine hohe Frequenz nicht automatisch schlecht. Entscheidend ist, ob die Leistung zum aktuellen Bedarf passt.</p>

<h2>Starts und Laufzeit</h2>
<p>Viele Starts innerhalb kurzer Zeit können auf kurze Zyklen hindeuten. Die reine Anzahl reicht jedoch nicht für eine Bewertung aus. Starts und Zyklusdauer sollten immer gemeinsam betrachtet werden. Eine hohe tägliche Laufzeit kann bei kaltem Wetter völlig normal sein.</p>

<h2>Modulationsanalyse</h2>
<p>Ein typischer Verlauf kann lauten: Start → höhere Frequenz → Annäherung an den Wärmebedarf → Abmodulation → längerer stabiler Betrieb. Wiederholte Folgen aus Start → kurzer Lauf → Abschaltung → kurzer Stillstand → erneuter Start können auf häufiges Takten hindeuten.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Verdichterfrequenz</td><td><code>#26A69A</code></td></tr>
<tr><td>Außentemperatur</td><td><code>#42A5F5</code></td></tr>
</table>
<p class="small">Kurvenfarben dienen der Wiedererkennung und sind keine Qualitätsbewertung.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Langer Heizzyklus + konstante niedrige/moderate Frequenz</td><td>Spricht grundsätzlich für gleichmäßigen modulierenden Betrieb.</td></tr>
<tr><td>Hohe Frequenz bei niedriger Außentemperatur</td><td>Kann aufgrund höheren Wärmebedarfs völlig normal sein.</td></tr>
<tr><td>Viele Starts + sehr kurze Zyklusdauer</td><td>Mögliches häufiges Takten; Temperaturverlauf, Wärmeabnahme und Regelung prüfen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Verdichterfrequenz, Starts und Laufzeit besitzen für sich allein keine NPS-Qualitätsampel. Erst das Zusammenspiel mit Zyklusdauer, Temperaturen, Außentemperatur, Betriebsart und Effizienz ermöglicht eine sinnvolle Bewertung.</div>
</div>
`,
                summary: 'Aktueller Verdichterzustand, Modulation, Starts und Laufzeiten.',
                sections: [
                    {
                        title: 'Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['Verdichter aktiv', 'Zeigt, ob der Verdichter aktuell läuft.'],
                                ['Betriebsart', 'Aktueller Prozess, z. B. Heizung oder Warmwasser.'],
                                ['Frequenz', 'Aktuelle Verdichterfrequenz in Hz.'],
                                ['Starts gesamt / heute', 'Anzahl der Verdichterstarts insgesamt bzw. seit Tagesbeginn.'],
                                ['Laufzeit gesamt / heute', 'Kumulierte Verdichterlaufzeit insgesamt bzw. des laufenden Tages.'],
                                ['Ø Zyklusdauer heute', 'Laufzeit heute geteilt durch die Anzahl der Starts heute.'],
                                ['Ø Frequenz heute', 'Zeitgewichtete mittlere Verdichterfrequenz während gültiger aktiver Messzeit.']
                            ]
                        }
                    },
                    {
                        title: 'Interpretation',
                        paragraphs: [
                            'Für Verdichterfrequenz, Starts und Zyklusdauer gibt es bewusst keine allgemeine Rot-Gelb-Grün-Ampel. Diese Werte müssen zusammen mit Außentemperatur, Wärmebedarf, Betriebsart und Anlagenzustand beurteilt werden.',
                            'Lange gleichmäßige Laufzeiten sind im Heizbetrieb grundsätzlich günstiger als häufiges kurzes Takten, solange Komfort und Systemgrenzen eingehalten werden.'
                        ]
                    }
                ]
            },
            {
                key: 'Temperatures', number: 6, title: 'Temperaturen',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Temperaturen</h1>
<p>Die Detailseite zeigt die wichtigsten thermischen Betriebsgrößen der Wärmepumpe. Sie hilft zu beurteilen, ob die Anlage die angeforderte Vorlauftemperatur erreicht, wie groß die Differenz zwischen Vor- und Rücklauf ist und unter welchen Außen- und Warmwasserbedingungen die Wärmepumpe arbeitet.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Außentemperatur</td><td>Aktuelle von NPS verwendete Außentemperatur.</td></tr>
<tr><td>Vorlauf SOLL</td><td>Von der Regelung aktuell angeforderte Vorlauftemperatur.</td></tr>
<tr><td>Vorlauf IST</td><td>Tatsächlich gemessene Vorlauftemperatur.</td></tr>
<tr><td>Vorlaufabweichung</td><td>Differenz Vorlauf IST − Vorlauf SOLL in Kelvin.</td></tr>
<tr><td>Rücklauf</td><td>Temperatur des Heizwassers beim Rücklauf zur Wärmepumpe.</td></tr>
<tr><td>Spreizung</td><td>Temperaturdifferenz zwischen Vorlauf und Rücklauf.</td></tr>
<tr><td>Warmwasser oben / BT7</td><td>Temperatur im oberen Bereich des Warmwasserspeichers.</td></tr>
<tr><td>WW-Ladetemperatur / BT6</td><td>Temperatur im Bereich der Warmwasserladung.</td></tr>
<tr><td>Verdichterfrequenz</td><td>Zusätzliche Vergleichsgröße für Temperaturveränderungen und Modulation.</td></tr>
</table>

<h2>Vorlaufabweichung</h2>
<p><b>Vorlaufabweichung = Vorlauf IST − Vorlauf SOLL.</b> Negativ bedeutet kälter als angefordert, 0 K entspricht dem Sollwert, positiv bedeutet wärmer als angefordert. Die beste NPS-Bewertung liegt ungefähr bei −0,5 K bis +0,5 K; mit zunehmender Abweichung wechselt die Bewertung über Grün, Gelb, Orange zu Rot.</p>

<h2>Spreizung</h2>
<p><b>Spreizung = Vorlauf − Rücklauf.</b> Sie hängt unter anderem von Volumenstrom, Wärmeabnahme, Verdichterleistung und Betriebszustand ab. NPS verwendet hierfür keine allgemeine Qualitätsampel.</p>

<h2>Warmwasser BT7 und BT6</h2>
<p><b>BT7</b> beschreibt die Temperatur im oberen Speicherbereich und ist besonders relevant für die verfügbare Warmwassertemperatur. <b>BT6</b> wird zur Beurteilung der Warmwasserladung herangezogen. Beide Messwerte erfüllen unterschiedliche Aufgaben und sollten nicht gleichgesetzt werden.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Außentemperatur</td><td><code>#42A5F5</code></td></tr>
<tr><td>Vorlauf IST</td><td><code>#EF6C3E</code></td></tr>
<tr><td>Vorlauf SOLL</td><td><code>#FBC02D</code></td></tr>
<tr><td>Rücklauf</td><td><code>#AB47BC</code></td></tr>
<tr><td>Warmwasser oben / BT7</td><td><code>#EC407A</code></td></tr>
<tr><td>WW-Ladetemperatur / BT6</td><td><code>#FF9800</code></td></tr>
<tr><td>Verdichterfrequenz</td><td><code>#26A69A</code></td></tr>
</table>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Vorlauf IST nahe SOLL</td><td>Regelung erreicht die aktuell angeforderte Temperatur.</td></tr>
<tr><td>Vorlauf IST kurzfristig unter SOLL</td><td>Kann nach Verdichterstart oder bei steigender Wärmeanforderung normal sein.</td></tr>
<tr><td>Vorlauf IST dauerhaft deutlich unter SOLL</td><td>Wärmeleistung, Verdichterfrequenz, Volumenstrom und Betriebszustand mit untersuchen.</td></tr>
<tr><td>BT7 sinkt</td><td>Warmwasservorrat im oberen Speicherbereich kühlt ab bzw. wird genutzt.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Temperaturen immer als System betrachten. Vorlauf, Rücklauf, Sollwert, Außentemperatur und Verdichterfrequenz beeinflussen sich gegenseitig.</div>
</div>
`,
                summary: 'Temperatur- und Hydraulikwerte für Heizkreis und Warmwasser.',
                sections: [
                    {
                        title: 'Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['Außentemperatur', 'Außentemperatur als zentrale Einflussgröße der Heizkurve.'],
                                ['Vorlauf Soll', 'Von der Regelung berechnete Ziel-Vorlauftemperatur.'],
                                ['Vorlauf Ist', 'Tatsächlich gemessene Vorlauftemperatur.'],
                                ['Vorlaufabweichung', 'Vorlauf Ist minus Vorlauf Soll in Kelvin.'],
                                ['Rücklauf', 'Temperatur des zurückströmenden Heizwassers.'],
                                ['Spreizung', 'Temperaturdifferenz zwischen Vorlauf und Rücklauf.'],
                                ['Volumenstrom', 'Aktueller Heizwasservolumenstrom in l/min.'],
                                ['Warmwasser oben (BT7)', 'Temperatur im oberen Bereich des Warmwasserspeichers.'],
                                ['Warmwasserbereitung (BT6)', 'Temperatur im Bereich der Warmwasserladung.']
                            ]
                        }
                    },
                    {
                        title: 'Vorlaufabweichung',
                        paragraphs: [
                            'Die ideale Vorlaufabweichung liegt um 0 K. Negative Werte bedeuten: Ist-Vorlauf liegt unter Soll. Positive Werte bedeuten: Ist-Vorlauf liegt über Soll.',
                            'Die in Jarvis verwendete Ampel ist symmetrisch um 0 K aufgebaut; kleine Abweichungen werden besser bewertet als große Abweichungen in beide Richtungen.'
                        ]
                    }
                ]
            },
            {
                key: 'Cycles', number: 7, title: 'Zyklus',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Zyklus</h1>
<p>Die Detailseite betrachtet einzelne abgeschlossene Verdichterläufe. Dadurch lässt sich beurteilen, wie lange ein Zyklus lief, welchem Zweck er diente, wie viel Strom und Wärme umgesetzt wurden, welchen COP er erreichte und wie NPS seine Qualität bewertet.</p>

<h2>Was ist ein Zyklus?</h2>
<p>Ein Zyklus beschreibt einen zusammenhängenden Verdichterlauf vom Start bis zum Ende. NPS unterscheidet insbesondere <b>Heizung</b> und <b>Warmwasser</b>. Beide Zyklustypen sollten bevorzugt jeweils untereinander verglichen werden.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Typ</td><td>Zweck des Zyklus, insbesondere Heizung oder Warmwasser.</td></tr>
<tr><td>Start / Ende</td><td>Zeitpunkte des Beginns und Abschlusses.</td></tr>
<tr><td>Dauer</td><td>Gesamte Laufzeit des Zyklus.</td></tr>
<tr><td>Strom</td><td>Während des Zyklus eingesetzte elektrische Energie.</td></tr>
<tr><td>Wärme</td><td>Während des Zyklus erzeugte thermische Energie.</td></tr>
<tr><td>COP</td><td>Verhältnis von Wärme zu Strom des abgeschlossenen Zyklus.</td></tr>
<tr><td>Ø Frequenz</td><td>Mittlere Verdichterfrequenz während des Zyklus.</td></tr>
<tr><td>Qualität</td><td>NPS-Zyklusbewertung von 0 bis 100 %.</td></tr>
</table>

<h2>Zyklusqualität</h2>
<table>
<tr><th>Qualität</th><th>Bewertung</th></tr>
<tr><td>95–100 %</td><td><span class="good">●</span> hervorragend</td></tr>
<tr><td>85–&lt;95 %</td><td><span class="green">●</span> gut</td></tr>
<tr><td>70–&lt;85 %</td><td><span class="yellow">●</span> normal</td></tr>
<tr><td>50–&lt;70 %</td><td><span class="orange">●</span> auffällig</td></tr>
<tr><td>1–&lt;50 %</td><td><span class="red">●</span> kritisch</td></tr>
<tr><td>0 %</td><td><span class="grey">●</span> Sonderfall / keine reguläre Bewertung</td></tr>
</table>

<h2>Zyklushistorie</h2>
<p>Die Historie zeigt Start, Typ, Dauer, COP, Wärme, Strom und Qualität der letzten abgeschlossenen Zyklen. Besonders sinnvoll ist der Vergleich gleicher Zyklustypen: Heizung mit Heizung, Warmwasser mit Warmwasser.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Zyklusdauer</td><td><code>#42A5F5</code></td></tr>
<tr><td>Zyklusqualität</td><td><code>#66BB6A</code></td></tr>
</table>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Langer Heizzyklus + guter COP + hohe Qualität</td><td>Spricht grundsätzlich für einen gleichmäßigen und effizienten Heizbetrieb.</td></tr>
<tr><td>Kurzer Zyklus + niedrige Qualität</td><td>Kann auf ungünstiges Taktverhalten hinweisen; Wiederholungen beobachten.</td></tr>
<tr><td>Kurzer Warmwasserzyklus + gute Qualität</td><td>Kann vollkommen normal sein.</td></tr>
<tr><td>Mehrere Heizzyklen mit niedriger Qualität</td><td>Verdichter-, Temperatur- und Effizienzdaten derselben Zeiträume untersuchen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Nicht einen einzelnen Zyklus optimieren, sondern Muster beurteilen. Ein einzelner kurzer oder ineffizienter Zyklus kann durch einen besonderen Betriebszustand entstehen.</div>
</div>
`,
                summary: 'Analyse abgeschlossener Verdichterzyklen und deren Qualität.',
                sections: [
                    {
                        title: 'Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['Zyklustyp', 'Heizung oder Warmwasser.'],
                                ['Dauer', 'Dauer des abgeschlossenen Zyklus in Minuten.'],
                                ['COP', 'Energetische Effizienz des einzelnen Zyklus.'],
                                ['Wärme', 'Im Zyklus erzeugte thermische Energie.'],
                                ['Strom', 'Im Zyklus eingesetzte elektrische Energie.'],
                                ['Qualität', 'NPS-Qualitätsscore von 0 bis 100 %.'],
                                ['Historie', 'Rollierende Tabelle der letzten abgeschlossenen Zyklen.']
                            ]
                        }
                    },
                    {
                        title: 'Zyklusqualitäts-Ampel',
                        table: {
                            headers: ['Qualität', 'Bewertung'],
                            rows: [
                                ['1–49 %', 'Rot – kritisch'],
                                ['50–69 %', 'Orange – auffällig'],
                                ['70–84 %', 'Gelb – normal'],
                                ['85–94 %', 'Grün – gut'],
                                ['95–100 %', 'Lime – hervorragend']
                            ]
                        },
                        paragraphs: [
                            'Ein Wert 0 ist als Sonderfall bzw. fehlende oder nicht bewertbare Qualität zu behandeln.'
                        ]
                    }
                ]
            },
            {
                key: 'Events', number: 8, title: 'Ereignisse',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Ereignisse</h1>
<p>Die Detailseite dokumentiert relevante Zustandsänderungen und besondere Vorgänge, die von NPS erkannt werden. Sie hilft dabei, den zeitlichen Ablauf des Anlagenbetriebs nachzuvollziehen und Auffälligkeiten mit anderen NPS-Daten in Verbindung zu bringen.</p>

<h2>Typische Ereignisse</h2>
<p>Beispiele sind Beginn oder Ende eines Heiz- oder Warmwasserzyklus, Verdichterstart oder -stopp, Aktivierung der Zusatzheizung, Enteisungsbeginn oder -ende sowie Warnungen oder Fehler innerhalb der NPS-Verarbeitung.</p>

<h2>Statusanzeigen</h2>
<table>
<tr><th>Anzeige</th><th>Bedeutung</th></tr>
<tr><td>Zyklus aktiv</td><td>Ob aktuell ein erfasster Betriebszyklus läuft.</td></tr>
<tr><td>Verdichter</td><td>Ob der Verdichter momentan aktiv ist.</td></tr>
<tr><td>Zusatzheizung</td><td>Ob aktuell elektrische Zusatzheizung eingesetzt wird.</td></tr>
<tr><td>Enteisung</td><td>Ob momentan ein Enteisungsvorgang läuft.</td></tr>
<tr><td>Aktueller Prozess / Status</td><td>Von NPS erkannter Betriebszustand.</td></tr>
</table>

<h2>Statusfarben</h2>
<table>
<tr><td>Aktiv</td><td><code>#C45A32</code></td></tr>
<tr><td>Inaktiv</td><td><code>#78909C</code></td></tr>
<tr><td>Unbekannt</td><td>Grau</td></tr>
</table>
<p class="small">Diese Farben kennzeichnen Zustände und sind keine Qualitätsampel.</p>

<h2>Kritikalität</h2>
<table>
<tr><th>Kritikalität</th><th>Bedeutung</th></tr>
<tr><td>info</td><td>Informative Meldung über einen normalen Zustand oder Vorgang.</td></tr>
<tr><td>success</td><td>Vorgang wurde erfolgreich bzw. erwartungsgemäß abgeschlossen.</td></tr>
<tr><td>warning</td><td>Auffälligkeit, die beobachtet bzw. geprüft werden sollte.</td></tr>
<tr><td>error</td><td>Fehler oder Vorgang, der eine genauere Untersuchung erfordert.</td></tr>
</table>

<h2>NPS-Ereignis und NIBE-Alarm</h2>
<p>Ein NPS-Ereignis ist nicht automatisch ein NIBE-Alarm. NPS erzeugt eigene Ereignisse zur Dokumentation von Betriebsabläufen und internen Zustandsänderungen. Ein NIBE-Alarm stammt dagegen aus der Wärmepumpensteuerung selbst.</p>

<h2>Typische Interpretation</h2>
<table>
<tr><td>info bei normalem Betriebswechsel</td><td>Reine Betriebsinformation.</td></tr>
<tr><td>success nach Abschluss</td><td>Erwartungsgemäß abgeschlossener Prozess.</td></tr>
<tr><td>warning einmalig</td><td>Ursache und zeitlichen Zusammenhang prüfen.</td></tr>
<tr><td>wiederkehrende warning-Meldungen</td><td>Interessanter als ein einzelner Ausreißer.</td></tr>
<tr><td>error</td><td>Mit Systemstatus, NIBE-Alarmstatus und Messwerten zum selben Zeitpunkt vergleichen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Ereignisse liefern Kontext, keine alleinige Diagnose. Besonders aussagekräftig sind die Reihenfolge mehrerer Ereignisse und die gleichzeitig aufgezeichneten Messwerte.</div>
</div>
`,
                summary: 'Zeitliche Nachverfolgung wichtiger NPS-Ereignisse und deren Kritikalität.',
                sections: [
                    {
                        title: 'Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['Letztes Ereignis', 'Technischer Ereignistyp aus der EventEngine.'],
                                ['Titel / Meldung', 'Lesbare Beschreibung des Ereignisses.'],
                                ['Kritikalität', 'Einordnung des Ereignisses, z. B. Info, Warnung oder Fehler.'],
                                ['Historie', 'Rollierende Tabelle der letzten 50 Ereignisse.'],
                                ['Tageszähler', 'Anzahl von Heizzyklen, Warmwasserzyklen, Abtauungen, Warnungen und Fehlern am aktuellen Tag.']
                            ]
                        }
                    },
                    {
                        title: 'Kritikalität',
                        table: {
                            headers: ['Status', 'Bedeutung'],
                            rows: [
                                ['Info', 'Informatives Ereignis ohne Fehlercharakter.'],
                                ['Success / OK', 'Erfolgreich abgeschlossener oder positiver Zustand.'],
                                ['Warning', 'Hinweis, der geprüft werden sollte.'],
                                ['Error / Critical', 'Fehler bzw. kritisches Ereignis.']
                            ]
                        }
                    }
                ]
            },
            {
                key: 'Defrost', number: 9, title: 'Enteisung',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Enteisung</h1>
<p>Die Detailseite zeigt die von NPS erkannten Abtauvorgänge der Außeneinheit. Sie hilft zu beurteilen, wann und wie häufig enteist wird, wie lange die Vorgänge dauern und wie sich die Anlage während einer Enteisung verhält.</p>

<h2>Warum wird enteist?</h2>
<p>Im Heizbetrieb kann sich unter geeigneten Temperatur- und Feuchtebedingungen Eis am Verdampfer bilden. Diese Vereisung behindert den Wärmeübergang. Die Wärmepumpe muss deshalb regelmäßig einen Enteisungs- bzw. Abtauvorgang durchführen.</p>

<h2>Kennzahlen</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Enteisung aktiv</td><td>Ob aktuell ein Enteisungsvorgang läuft.</td></tr>
<tr><td>Anzahl</td><td>Anzahl der von NPS erkannten Enteisungsvorgänge.</td></tr>
<tr><td>Abgeschlossene Enteisungen</td><td>Anzahl vollständig erkannter bzw. abgeschlossener Vorgänge.</td></tr>
<tr><td>Aktuelle Dauer</td><td>Bisherige Dauer einer momentan laufenden Enteisung.</td></tr>
<tr><td>Letzte Dauer</td><td>Dauer des zuletzt abgeschlossenen Enteisungsvorgangs.</td></tr>
<tr><td>Letzter Start</td><td>Zeitpunkt, zu dem die letzte Enteisung begonnen hat.</td></tr>
</table>

<h2>Keine pauschale Ampel</h2>
<p>NPS besitzt derzeit keine pauschale Qualitätsampel für Anzahl oder Dauer der Enteisungen. Eine starre Regel wie „mehr als x Enteisungen pro Tag = schlecht“ wäre ohne Berücksichtigung von Wetter- und Betriebsbedingungen irreführend.</p>

<h2>Verhalten während einer Enteisung</h2>
<p>Während des Abtauvorgangs können Verdichterfrequenz, Vorlauf, Rücklauf, Wärmeleistung und Live-COP kurzfristig deutlich verändert sein. Solche Werte sollten nicht wie normaler Heizbetrieb bewertet werden.</p>

<h2>Diagrammfarben</h2>
<table>
<tr><td>Enteisung aktiv</td><td><code>#FF8F00</code></td></tr>
<tr><td>Verdichterfrequenz</td><td><code>#26A69A</code></td></tr>
<tr><td>Außentemperatur</td><td><code>#42A5F5</code></td></tr>
</table>

<h2>Typische Interpretation</h2>
<table>
<tr><td>Einzelne Enteisung bei passenden Witterungsbedingungen</td><td>Normaler Betriebsprozess.</td></tr>
<tr><td>Mehrere Enteisungen bei feucht-kühlem Wetter</td><td>Können ebenfalls vollkommen normal sein.</td></tr>
<tr><td>Enteisung aktiv + kurzfristige Veränderung von Vorlauf oder COP</td><td>Während des Abtauvorgangs grundsätzlich plausibel.</td></tr>
<tr><td>Enteisungen werden deutlich häufiger oder länger</td><td>Verlauf genauer untersuchen und mit Außentemperatur sowie Verdichterbetrieb vergleichen.</td></tr>
</table>

<div class="note"><b>Wichtig:</b> Enteisung ist ein notwendiger Bestandteil des normalen Betriebs einer Luft/Wasser-Wärmepumpe. Nicht der einzelne Abtauvorgang ist entscheidend, sondern das Muster aus Häufigkeit, Dauer, Witterungsbedingungen und Anlagenverhalten.</div>
</div>
`,
                summary: 'Erkennung und zeitliche Analyse von Abtauvorgängen der Außeneinheit.',
                sections: [
                    {
                        title: 'Kennzahlen',
                        table: {
                            headers: ['Kennzahl', 'Bedeutung'],
                            rows: [
                                ['Enteisung aktiv', 'Zeigt, ob aktuell ein Abtauvorgang läuft.'],
                                ['Anzahl', 'Kumulierte Anzahl erkannter Abtauvorgänge.'],
                                ['Aktuelle Dauer', 'Laufzeit des aktuellen Abtauvorgangs.'],
                                ['Letzte Dauer', 'Dauer des zuletzt abgeschlossenen Abtauvorgangs.'],
                                ['Letzter Start', 'Zeitpunkt des letzten Abtaustarts.']
                            ]
                        }
                    },
                    {
                        title: 'Bewertung',
                        paragraphs: [
                            'Für Anzahl oder Dauer der Enteisungen ist in NPS bewusst keine feste Effizienzampel definiert. Ein Abtauvorgang ist bei geeigneten Außenbedingungen ein normaler Betriebszustand.',
                            'Die Bewertung sollte im zeitlichen Zusammenhang mit Außentemperatur, Verdichterfrequenz und Häufigkeit der Abtauvorgänge erfolgen.'
                        ]
                    }
                ]
            },
            {
                key: 'HeatingOptimization', number: 10, title: 'Heizungsanalyse',
                html: `
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#121212;color:#E0E0E0;margin:0;padding:0;}
.wrap{padding:18px;line-height:1.6;}
h1{font-size:24px;margin:0 0 14px;}
h2{font-size:18px;margin:22px 0 8px;}
p{margin:8px 0 12px;}
table{width:100%;border-collapse:collapse;margin:10px 0 16px;}
th,td{padding:8px 10px;border-bottom:1px solid #333;vertical-align:top;text-align:left;}
th{font-weight:600;color:#FFF;}
.note{padding:10px 12px;border-left:4px solid #78909C;background:#1b1b1b;margin:14px 0;}
.good{color:lime}.green{color:green}.yellow{color:yellow}.orange{color:orange}.red{color:red}.grey{color:grey}
code{background:#1f1f1f;padding:2px 5px;border-radius:4px;}
.small{font-size:13px;color:#BDBDBD}
</style>

<div class="wrap">
<h1>NPS – Heizungsanalyse</h1>
<p>Die Detailseite „Heizungsanalyse“ visualisiert die Daten des Moduls <code>15_NPS_HeatingCurveAnalyzer</code>. Ziel ist die belastbare Beurteilung, ob Heizkurve, Vorlauf-Sollwert und Raumkomfort zur aktuellen Gebäude- und Witterungssituation passen.</p>

<div class="note"><b>Wichtig:</b> Die Seite ist eine Analyse- und Beobachtungshilfe. Sie verändert keine NIBE-Parameter automatisch. Einzelne Momentwerte sind keine ausreichende Grundlage für eine Heizkurvenänderung.</div>

<h2>1. Anlagenstatus</h2>
<table>
<tr><th>Kennzahl</th><th>Bedeutung</th></tr>
<tr><td>Betriebsart</td><td>Aktueller Anlagenprozess, z. B. Standby, Warmwasser oder Heizen.</td></tr>
<tr><td>Außentemperatur</td><td>Witterungsgröße, auf deren Basis die Heizkurve den Vorlauf-Sollwert bestimmt.</td></tr>
<tr><td>Vorlauf SOLL / IST</td><td>Berechneter Sollwert der NIBE und tatsächlich gemessene Vorlauftemperatur.</td></tr>
<tr><td>Vorlaufabweichung</td><td>Vorlauf IST minus Vorlauf SOLL. Nahe 0 K bedeutet gute Nachführung.</td></tr>
<tr><td>Rücklauf / Spreizung</td><td>Rücklauftemperatur und Differenz zwischen Vorlauf und Rücklauf.</td></tr>
<tr><td>Gradminuten</td><td>NIBE-Regelgröße für den aufgelaufenen Wärmebedarf.</td></tr>
<tr><td>Verdichter / Frequenz</td><td>Zeigt, ob der Verdichter arbeitet und mit welcher Frequenz.</td></tr>
<tr><td>Volumenstrom</td><td>Aktueller Heizwasservolumenstrom in l/min.</td></tr>
<tr><td>Messpunkt gültig</td><td>Ob der aktuelle 5-Minuten-Punkt fachlich für die Heizkurvenanalyse nutzbar ist.</td></tr>
<tr><td>Messpunktqualität</td><td>Qualität des aktuellen Samples in Prozent.</td></tr>
</table>
<p>Ein ungültiger Messpunkt ist nicht automatisch ein Fehler. Außerhalb einer geeigneten Heizphase, während Maintenance, Warmwasserbereitung, Enteisung oder bei anderen Ausschlussbedingungen kann <b>Messpunkt gültig = aus</b> vollkommen normal sein.</p>

<h2>2. Raumkomfort</h2>
<p>Die Raumkomfort-Auswertung betrachtet alle 13 konfigurierten Räume und vergleicht Isttemperatur und Solltemperatur.</p>
<table>
<tr><th>Abweichung</th><th>Bewertung</th></tr>
<tr><td>&lt; -0,5 K</td><td style="color:#42A5F5;">Zu kalt</td></tr>
<tr><td>-0,5 bis +0,5 K</td><td style="color:green;">Komfortbereich</td></tr>
<tr><td>&gt; +0,5 K</td><td style="color:#FF9800;">Zu warm</td></tr>
</table>
<p>„Raumdaten gültig“ beschreibt die technische Verfügbarkeit der Raumdaten. „Für Heizkurve verwertbar“ ist strenger und berücksichtigt zusätzliche Ausschlussgründe wie inaktive Heizperiode, Maintenance, offene Fenster oder aktive Overrides.</p>
<p>Die Raumübersicht zeigt je Raum Istwert, Sollwert, Abweichung, Komfortzustand, Analyse-Gültigkeit und den Ausschlussgrund.</p>

<h2>3. Heizkurvenanalyse – 72 Stunden</h2>
<p>Das 72-h-Fenster ist die Hauptanalyse der Jarvis-Seite. Es glättet kurzfristige Schwankungen und bleibt gleichzeitig zeitnah genug, um Änderungen an der Heizungsregelung nachvollziehen zu können.</p>
<table>
<tr><th>Kennzahl</th><th>Interpretation</th></tr>
<tr><td>Gültige Heizstunden</td><td>Tatsächlich für die Analyse nutzbare Heizzeit.</td></tr>
<tr><td>Datenqualität 72 h</td><td>Qualität der Datenbasis innerhalb des Analysefensters.</td></tr>
<tr><td>Vorlaufabweichung Ø</td><td>Mittlere Nachführung von Vorlauf IST gegenüber SOLL.</td></tr>
<tr><td>Raumabweichung Ø / Median</td><td>Gesamte Komfortlage der verwertbaren Räume.</td></tr>
<tr><td>Anteil zu kalt / Komfort / zu warm</td><td>Verteilung der Raumbeobachtungen im Analysefenster.</td></tr>
<tr><td>Verdichterlaufzeit</td><td>Anteil des Fensters mit Verdichterbetrieb.</td></tr>
<tr><td>Zusatzheizungsanteil</td><td>Anteil des Fensters, der durch Zusatzheizung beeinflusst wurde.</td></tr>
</table>
<p>Zusätzlich zeigt die Tabelle „Analysefenster“ die Fenster 6 h, 24 h, 72 h und 7 Tage. Das 72-h-Fenster ist als Hauptanalyse gekennzeichnet.</p>

<h2>4. Analysehinweise</h2>
<p>„Analysehinweise“ sind aus den Messdaten abgeleitete Indizien. Sie sind keine automatische Stell-Empfehlung.</p>
<table>
<tr><th>Hinweis</th><th>Bedeutung</th></tr>
<tr><td>Gesamttemperatur</td><td>Ob das Haus insgesamt passend, überwiegend zu kalt oder überwiegend zu warm ist.</td></tr>
<tr><td>Vorlauf-Nachführung</td><td>Ob der tatsächliche Vorlauf dauerhaft unter oder über dem Sollwert liegt.</td></tr>
<tr><td>Außentemperaturabhängigkeit</td><td>Ob sich die Raumabweichung systematisch mit der Außentemperatur verändert.</td></tr>
<tr><td>Raumungleichgewicht</td><td>Ob einzelne Räume deutlich anders reagieren als der Rest des Hauses.</td></tr>
<tr><td>Einfluss Zusatzheizung</td><td>Ob Zusatzheizung die betrachtete Datenlage beeinflusst.</td></tr>
<tr><td>Außensensoren auffällig</td><td>Hinweis auf auffällige Differenzen der Außentemperaturquellen.</td></tr>
<tr><td>Datenbasis unzureichend</td><td>Noch keine belastbare Aussage möglich.</td></tr>
</table>

<h2>5. Datenqualität und Analysebereitschaft</h2>
<table>
<tr><th>Status</th><th>Bedeutung</th></tr>
<tr><td class="good">EXCELLENT</td><td>Mindestens 90 % Datenqualität.</td></tr>
<tr><td class="green">GOOD</td><td>Mindestens 75 % Datenqualität.</td></tr>
<tr><td class="orange">LIMITED</td><td>Mindestens 50 % Datenqualität; Aussage nur eingeschränkt belastbar.</td></tr>
<tr><td class="red">INSUFFICIENT</td><td>Unter 50 % oder fachlich nicht ausreichende Datenbasis.</td></tr>
</table>
<p>Pflichtquellen müssen vollständig verfügbar sein. Fehlende optionale Quellen werden als Hinweis behandelt. „Analyse bereit = aus“ bedeutet häufig lediglich, dass noch nicht genügend gültige Heizstunden gesammelt wurden.</p>

<h2>6. Heizkurvenparameter</h2>
<p>Der Bereich zeigt die aktuelle NIBE-Konfiguration, die als Grundlage der Analyse dient: Heizkurve, Heizkurvenverschiebung, Vorlauf Minimum/Maximum, Heizungs-Stopp, Zusatzheizung-Stopp, Filterzeit und weitere Begrenzungen.</p>
<p>Die erweiterte Heizkurve zeigt die Punkte P1 bis P7 sowie die Punktverschiebung. Diese Werte werden ausschließlich angezeigt; NPS verändert sie nicht.</p>

<h2>7. HistoryGraph – Heizkurvenverlauf</h2>
<p>Der 72-h-Heizkurvenverlauf stellt absolute Temperaturen auf einer gemeinsamen °C-Achse dar.</p>
<table>
<tr><th>Kurve</th><th>Farbe</th></tr>
<tr><td>Außentemperatur</td><td><code>#42A5F5</code></td></tr>
<tr><td>Vorlauf SOLL</td><td><code>#FBC02D</code></td></tr>
<tr><td>Vorlauf IST</td><td><code>#EF6C3E</code></td></tr>
<tr><td>Rücklauf</td><td><code>#AB47BC</code></td></tr>
</table>
<p>Der Graph hilft zu erkennen, wie sich der berechnete Sollwert mit der Witterung verändert und wie gut der tatsächliche Vorlauf folgt.</p>

<h2>8. HistoryGraph – Raumkomfort</h2>
<p>Der Raumkomfort-Graph verwendet eine gemeinsame K-Achse für Temperaturabweichungen.</p>
<table>
<tr><th>Kurve</th><th>Farbe</th></tr>
<tr><td>Ø Raumabweichung</td><td><code>#66BB6A</code></td></tr>
<tr><td>Median Raumabweichung</td><td><code>#43A047</code></td></tr>
<tr><td>Abweichung kältester Raum</td><td><code>#42A5F5</code></td></tr>
<tr><td>Abweichung wärmster Raum</td><td><code>#FF9800</code></td></tr>
</table>

<h2>9. HistoryGraph – Regelung / Verdichterbetrieb</h2>
<p>Für die Regelungsbetrachtung werden Verdichterfrequenz und Gradminuten auf getrennten Y-Achsen dargestellt.</p>
<table>
<tr><th>Kurve</th><th>Achse</th><th>Farbe</th></tr>
<tr><td>Verdichterfrequenz</td><td>Hz</td><td><code>#26A69A</code></td></tr>
<tr><td>Gradminuten</td><td>GM</td><td><code>#7E57C2</code></td></tr>
</table>
<p>Der Volumenstrom wird nicht auf dieselbe Achse gelegt, da er mit l/min eine eigene Einheit besitzt.</p>

<h2>10. Vorgehensweise bei der Heizkurvenoptimierung</h2>
<p>Änderungen an der Heizkurve sollten erst nach einer ausreichenden, zusammenhängenden Heizdatenbasis bewertet werden. Entscheidend ist das Muster aus Außentemperatur, Vorlauf-Soll/Ist, Raumabweichungen und Analysehinweisen.</p>
<table>
<tr><th>Beobachtung</th><th>Mögliche Bedeutung</th></tr>
<tr><td>Haus bei allen Außentemperaturen ähnlich zu kalt oder zu warm</td><td>Kann auf eine Parallelverschiebung der Heizkurve hindeuten.</td></tr>
<tr><td>Bei sinkender Außentemperatur zunehmend zu kalt</td><td>Kann auf eine zu flache Heizkurve hindeuten.</td></tr>
<tr><td>Bei sinkender Außentemperatur zunehmend zu warm</td><td>Kann auf eine zu steile Heizkurve hindeuten.</td></tr>
<tr><td>Nur einzelne Räume weichen stark ab</td><td>Zuerst Raumregelung, Hydraulik, Fensterzustände oder Sollwerte prüfen.</td></tr>
<tr><td>Vorlauf IST folgt SOLL dauerhaft schlecht</td><td>Zuerst die Vorlauf-Nachführung bzw. den Anlagenbetrieb prüfen, bevor die Heizkurve bewertet wird.</td></tr>
</table>

<div class="note"><b>Sommerbetrieb:</b> Wenn keine geeignete Heizperiode aktiv ist, können 0 gültige Heizstunden, 0 verwertbare Räume und „Datenbasis unzureichend“ vollständig korrekt sein. Das ist kein Fehler des HeatingCurveAnalyzer.</div>
</div>
`,
                summary: 'Heizkurvenanalyse, Raumkomfort, Datenqualität und Interpretation der Heizungsoptimierung.',
                sections: [
                    {
                        title: 'Grundsatz',
                        paragraphs: [
                            'Die Heizungsanalyse verbindet Anlagenzustand, Raumkomfort, Zeitfensteranalyse und Analysehinweise. Sie ist eine Beobachtungs- und Entscheidungshilfe und verändert keine NIBE-Parameter automatisch.',
                            'Das 72-h-Fenster ist die Hauptanalyse. Änderungen an der Heizkurve sollten erst bei ausreichender Datenqualität und genügend gültigen Heizstunden bewertet werden.'
                        ]
                    },
                    {
                        title: 'Komfortgrenzen',
                        table: {
                            headers: ['Raumabweichung', 'Bewertung'],
                            rows: [
                                ['< -0,5 K', 'Zu kalt'],
                                ['-0,5 bis +0,5 K', 'Komfortbereich'],
                                ['> +0,5 K', 'Zu warm']
                            ]
                        }
                    },
                    {
                        title: 'Datenqualität',
                        table: {
                            headers: ['Status', 'Grenze'],
                            rows: [
                                ['EXCELLENT', '≥ 90 %'],
                                ['GOOD', '≥ 75 %'],
                                ['LIMITED', '≥ 50 %'],
                                ['INSUFFICIENT', '< 50 % oder fachlich unzureichend']
                            ]
                        }
                    }
                ]
            }
        ])
    });

    const SOURCE = Object.freeze({
        TECH_UNREACH: 'alias.0.Keller.Waschküche.Waermepumpe.UNREACH',
        TECH_ALARM_NUMBER: 'alias.0.Keller.Waschküche.Waermepumpe.Alarmnummer',

        // Interne Zusatzheizung VVM S500
        AUX_POWER: 'alias.0.Keller.Waschküche.Waermepumpe.Leistung_interne_Zusatzheizung',
        AUX_MODE: 'alias.0.Keller.Waschküche.Waermepumpe.Betriebsmodus_interne_Zusatzheizung',

        STATE: CONFIG.NPS_ROOT + '.StateMachine.Current.State',
        MODE: CONFIG.NPS_ROOT + '.StateMachine.Current.OperatingMode',
        CURRENT_RUNTIME: CONFIG.NPS_ROOT + '.StateMachine.Current.Runtime',

        TEMP_OUTDOOR: CONFIG.NPS_ROOT + '.TemperatureMonitor.Temperatures.Outdoor',
        TEMP_SUPPLY: CONFIG.NPS_ROOT + '.TemperatureMonitor.Temperatures.Supply',
        TEMP_SUPPLY_TARGET: 'alias.0.Keller.Waschküche.Waermepumpe.Berechneter_Vorlauf_Klimatisierungssystem_1',
        TEMP_RETURN: CONFIG.NPS_ROOT + '.TemperatureMonitor.Temperatures.Return',
        TEMP_SPREAD: CONFIG.NPS_ROOT + '.TemperatureMonitor.Temperatures.Spread',
        TEMP_MEAN: CONFIG.NPS_ROOT + '.TemperatureMonitor.Temperatures.MeanHeatingWater',
        TEMP_LIFT: CONFIG.NPS_ROOT + '.TemperatureMonitor.Temperatures.TemperatureLift',
        TEMP_WARMWATER: 'alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_oben',
        TEMP_WARMWATER_CHARGING: 'alias.0.Keller.Waschküche.Waermepumpe.Brauchwasserbereitung',
        THERMAL_POWER: 'alias.0.Keller.Waschküche.Waermepumpe.Erzeugte_Leistung_Wärme_(EB101)',
        FLOW: CONFIG.NPS_ROOT + '.TemperatureMonitor.Hydraulics.Flow',
        TEMP_VALID: CONFIG.NPS_ROOT + '.TemperatureMonitor.Diagnostics.ValidInput',
        TEMP_WARNING: CONFIG.NPS_ROOT + '.TemperatureMonitor.Diagnostics.Warning',
        TEMP_LAST_UPDATE: CONFIG.NPS_ROOT + '.TemperatureMonitor.System.LastUpdate',

        COMP_FREQUENCY: CONFIG.NPS_ROOT + '.CompressorMonitor.Compressor.Frequency',
        COMP_RUNNING: CONFIG.NPS_ROOT + '.CompressorMonitor.Compressor.Running',
        COMP_RUNTIME: CONFIG.NPS_ROOT + '.CompressorMonitor.Compressor.Runtime',
        COMP_STARTS: CONFIG.NPS_ROOT + '.CompressorMonitor.Compressor.Starts',
        COMP_STATUS: CONFIG.NPS_ROOT + '.CompressorMonitor.Compressor.Status',
        COMP_VALID: CONFIG.NPS_ROOT + '.CompressorMonitor.Diagnostics.ValidInput',
        COMP_WARNING: CONFIG.NPS_ROOT + '.CompressorMonitor.Diagnostics.Warning',
        COMP_LAST_UPDATE: CONFIG.NPS_ROOT + '.CompressorMonitor.System.LastUpdate',

        // ElectricalMeters – aktueller Gesamtzähler und Diagnose
        ELECTRICAL_TOTAL: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Gesamt',
        ELECTRICAL_ESTIMATED: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.GeschaetzterZaehler',
        ELECTRICAL_POWER: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Leistung',
        ELECTRICAL_NIBE_COUNTER: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.NibeGesamt',
        ELECTRICAL_INTEGRATED_ENERGY: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.IntegrierteEnergie',
        ELECTRICAL_OFFSET: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Offset',
        ELECTRICAL_CORRECTION_DELTA: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.KorrekturDelta',
        ELECTRICAL_OFFSET_STATUS: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.OffsetStatus',
        ELECTRICAL_VALID: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Valid',
        ELECTRICAL_STATUS: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Status',
        ELECTRICAL_LAST_POWER_UPDATE: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.LastPowerUpdate',
        ELECTRICAL_LAST_COUNTER_UPDATE: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.LastCounterUpdate',
        ELECTRICAL_LAST_INTEGRATION: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.LastIntegration',
        ELECTRICAL_MAX_OFFSET: CONFIG.NPS_ROOT + '.ElectricalMeters.Diagnostics.MaxOffset',
        ELECTRICAL_LAST_UPDATE: CONFIG.NPS_ROOT + '.ElectricalMeters.System.LastUpdate',

        ELECTRIC_TOTAL: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Gesamt',
        ELECTRIC_HEATING: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Heating',
        ELECTRIC_WARMWATER: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Warmwater',
        ELECTRIC_STANDBY: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Standby',
        ELECTRIC_COOLING: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Cooling',
        ELECTRIC_POOL: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Pool',
        ELECTRIC_UNKNOWN: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Unknown',
        ELECTRIC_ALLOCATED: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.TotalAllocated',
        ENERGY_VALID: CONFIG.NPS_ROOT + '.EnergyAllocation.Diagnostics.ValidInput',
        ENERGY_WARNING: CONFIG.NPS_ROOT + '.EnergyAllocation.Diagnostics.Warning',
        ENERGY_LAST_UPDATE: CONFIG.NPS_ROOT + '.EnergyAllocation.System.LastUpdate',

        HEAT_HEATING_COMP: CONFIG.NPS_ROOT + '.VirtualMeters.Heizung.NurVerdichter',
        HEAT_HEATING_TOTAL: CONFIG.NPS_ROOT + '.VirtualMeters.Heizung.InklusiveZusatzheizung',
        HEAT_WW_COMP: CONFIG.NPS_ROOT + '.VirtualMeters.Brauchwasser.NurVerdichter',
        HEAT_WW_TOTAL: CONFIG.NPS_ROOT + '.VirtualMeters.Brauchwasser.InklusiveZusatzheizung',
        HEAT_VALID: CONFIG.NPS_ROOT + '.VirtualMeters.Qualitaet.Gueltig',


        STAT_DAY_ELECTRIC_TOTAL: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt.day',
        STAT_DAY_ELECTRIC_HEATING: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.EnergyAllocation.Meters.Heating.day',
        STAT_DAY_ELECTRIC_WARMWATER: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.EnergyAllocation.Meters.Warmwater.day',
        STAT_DAY_HEAT_HEATING: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Heizung.InklusiveZusatzheizung.day',
        STAT_DAY_HEAT_WARMWATER: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Brauchwasser.InklusiveZusatzheizung.day',
        STAT_DAY_HEAT_HEATING_COMP: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Heizung.NurVerdichter.day',
        STAT_DAY_HEAT_WARMWATER_COMP: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Brauchwasser.NurVerdichter.day',
        STAT_DAY_COMP_RUNTIME: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.DashboardData.Compressor.Runtime.day',
        STAT_DAY_COMP_STARTS: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.DashboardData.Compressor.Starts.day',
        STAT_SAVE_DAY_COMP_RUNTIME: 'statistics.0.save.sumDelta.0_userdata.0.NPS.DashboardData.Compressor.Runtime.day',
        STAT_SAVE_DAY_COMP_STARTS: 'statistics.0.save.sumDelta.0_userdata.0.NPS.DashboardData.Compressor.Starts.day',

        STAT_SAVE_DAY_ELECTRIC_TOTAL: 'statistics.0.save.sumDelta.0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt.day',
        STAT_SAVE_DAY_ELECTRIC_HEATING: 'statistics.0.save.sumDelta.0_userdata.0.NPS.EnergyAllocation.Meters.Heating.day',
        STAT_SAVE_DAY_ELECTRIC_WARMWATER: 'statistics.0.save.sumDelta.0_userdata.0.NPS.EnergyAllocation.Meters.Warmwater.day',
        STAT_SAVE_DAY_ELECTRIC_ZH_HEATING: 'statistics.0.save.sumDelta.0_userdata.0.NPS.ElectricalMeters.Registerwerte.ZusatzheizungHeizung.day',
        STAT_SAVE_DAY_ELECTRIC_ZH_WARMWATER: 'statistics.0.save.sumDelta.0_userdata.0.NPS.ElectricalMeters.Registerwerte.ZusatzheizungBrauchwasser.day',
        STAT_SAVE_DAY_HEAT_TOTAL: 'statistics.0.save.sumDelta.0_userdata.0.NPS.VirtualMeters.Gesamt.InklusiveZusatzheizung.day',
        STAT_SAVE_DAY_HEAT_HEATING: 'statistics.0.save.sumDelta.0_userdata.0.NPS.VirtualMeters.Heizung.InklusiveZusatzheizung.day',
        STAT_SAVE_DAY_HEAT_WARMWATER: 'statistics.0.save.sumDelta.0_userdata.0.NPS.VirtualMeters.Brauchwasser.InklusiveZusatzheizung.day',
        STAT_SAVE_DAY_HEAT_HEATING_COMP: 'statistics.0.save.sumDelta.0_userdata.0.NPS.VirtualMeters.Heizung.NurVerdichter.day',
        STAT_SAVE_DAY_HEAT_WARMWATER_COMP: 'statistics.0.save.sumDelta.0_userdata.0.NPS.VirtualMeters.Brauchwasser.NurVerdichter.day',

        STAT_YEAR_ELECTRIC_TOTAL: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt.year',
        STAT_YEAR_ELECTRIC_HEATING: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.EnergyAllocation.Meters.Heating.year',
        STAT_YEAR_ELECTRIC_WARMWATER: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.EnergyAllocation.Meters.Warmwater.year',
        STAT_YEAR_HEAT_HEATING: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Heizung.InklusiveZusatzheizung.year',
        STAT_YEAR_HEAT_WARMWATER: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Brauchwasser.InklusiveZusatzheizung.year',
        STAT_YEAR_HEAT_HEATING_COMP: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Heizung.NurVerdichter.year',
        STAT_YEAR_HEAT_WARMWATER_COMP: 'statistics.0.temp.sumDelta.0_userdata.0.NPS.VirtualMeters.Brauchwasser.NurVerdichter.year',

        DEFROST_STATUS: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.Status',
        DEFROST_ACTIVE: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.Active',
        DEFROST_COUNT: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.Count',
        DEFROST_CURRENT_DURATION: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.CurrentDurationMinutes',
        DEFROST_LAST_DURATION: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.LastDurationMinutes',
        DEFROST_TOTAL_DURATION: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.TotalDurationMinutes',
        DEFROST_LAST_START: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.LastStart',
        DEFROST_LAST_END: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.LastEnd',
        DEFROST_VALID: CONFIG.NPS_ROOT + '.DefrostMonitor.Diagnostics.ValidInput',
        DEFROST_WARNING: CONFIG.NPS_ROOT + '.DefrostMonitor.Diagnostics.Warning',
        DEFROST_LAST_UPDATE: CONFIG.NPS_ROOT + '.DefrostMonitor.System.LastUpdate',

        EVENT_SEQUENCE: CONFIG.NPS_ROOT + '.Events.Verdichter.Sequenz',
        EVENT_ID: CONFIG.NPS_ROOT + '.Events.Verdichter.EreignisId',
        EVENT_TYPE: CONFIG.NPS_ROOT + '.Events.Verdichter.Typ',
        EVENT_TITLE: CONFIG.NPS_ROOT + '.Events.Verdichter.Titel',
        EVENT_MESSAGE: CONFIG.NPS_ROOT + '.Events.Verdichter.Nachricht',
        EVENT_CRITICALITY: CONFIG.NPS_ROOT + '.Events.Verdichter.Kritikalitaet',
        EVENT_TIMESTAMP: CONFIG.NPS_ROOT + '.Events.Verdichter.Zeitstempel',
        EVENT_MODE: CONFIG.NPS_ROOT + '.Events.Verdichter.Betriebsart',
        EVENT_RUNTIME: CONFIG.NPS_ROOT + '.Events.Verdichter.Laufzeit',

        RECORDING_ACTIVE: CONFIG.NPS_ROOT + '.CycleRecorder.Recording.Active',
        RECORDING_TYPE: CONFIG.NPS_ROOT + '.CycleRecorder.Recording.Type',
        RECORDING_RUN_ID: CONFIG.NPS_ROOT + '.CycleRecorder.Recording.RunId',
        CYCLE_CURRENT_DURATION: CONFIG.NPS_ROOT + '.StateMachine.Current.Runtime',

        CYCLE_ID: CONFIG.NPS_ROOT + '.CycleAnalyzer.Analysis.Id',
        CYCLE_TYPE: CONFIG.NPS_ROOT + '.CycleAnalyzer.Analysis.Type',
        CYCLE_TYPE_CODE: CONFIG.NPS_ROOT + '.CycleAnalyzer.Analysis.TypeCode',
        CYCLE_START: CONFIG.NPS_ROOT + '.CycleAnalyzer.Analysis.Start',
        CYCLE_END: CONFIG.NPS_ROOT + '.CycleAnalyzer.Analysis.End',
        CYCLE_DURATION: CONFIG.NPS_ROOT + '.CycleAnalyzer.Analysis.DurationSeconds',
        CYCLE_VALID: CONFIG.NPS_ROOT + '.CycleAnalyzer.Analysis.Valid',
        CYCLE_COP: CONFIG.NPS_ROOT + '.CycleAnalyzer.Energy.COP',
        CYCLE_ELECTRIC: CONFIG.NPS_ROOT + '.CycleAnalyzer.Energy.ElectricKWh',
        CYCLE_HEAT: CONFIG.NPS_ROOT + '.CycleAnalyzer.Energy.HeatKWh',
        CYCLE_QUALITY: CONFIG.NPS_ROOT + '.CycleAnalyzer.Quality.Score',
        CYCLE_RATING: CONFIG.NPS_ROOT + '.CycleAnalyzer.Quality.Rating',
        CYCLE_WARNING: CONFIG.NPS_ROOT + '.CycleAnalyzer.Quality.Warning',
        CYCLE_REPORT_JSON: CONFIG.NPS_ROOT + '.CycleAnalyzer.Report.Json',

        // HeatingOptimization / 15_NPS_HeatingCurveAnalyzer
        HEATING_STATUS_ACTIVE: CONFIG.NPS_ROOT + '.HeatingOptimization.Status.Active',
        HEATING_STATUS_VALID: CONFIG.NPS_ROOT + '.HeatingOptimization.Status.Valid',
        HEATING_STATUS_LAST_CALCULATION: CONFIG.NPS_ROOT + '.HeatingOptimization.Status.LastCalculation',
        HEATING_STATUS_SOURCE_CHECK_OK: CONFIG.NPS_ROOT + '.HeatingOptimization.Status.SourceCheckOk',
        HEATING_STATUS_SOURCE_CHECK_JSON: CONFIG.NPS_ROOT + '.HeatingOptimization.Status.SourceCheckJson',
        HEATING_STATUS_DATA_QUALITY_PERCENT: CONFIG.NPS_ROOT + '.HeatingOptimization.Status.DataQualityPercent',
        HEATING_STATUS_DATA_QUALITY_STATE: CONFIG.NPS_ROOT + '.HeatingOptimization.Status.DataQualityState',

        HEATING_CURRENT_OPERATING_PRIORITY: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.OperatingPriority',
        HEATING_CURRENT_OUTDOOR: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.OutdoorTemperature',
        HEATING_CURRENT_FLOW_TARGET: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.FlowTarget',
        HEATING_CURRENT_FLOW_ACTUAL: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.FlowActual',
        HEATING_CURRENT_SUPPLY_DEVIATION: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.SupplyDeviation',
        HEATING_CURRENT_RETURN: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.ReturnTemperature',
        HEATING_CURRENT_DELTA_T: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.DeltaT',
        HEATING_CURRENT_DEGREE_MINUTES: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.DegreeMinutes',
        HEATING_CURRENT_COMPRESSOR_ACTIVE: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.CompressorActive',
        HEATING_CURRENT_COMPRESSOR_FREQUENCY: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.CompressorFrequency',
        HEATING_CURRENT_VOLUME_FLOW: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.VolumeFlow',
        HEATING_CURRENT_ADDITIONAL_HEAT_ACTIVE: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.AdditionalHeatActive',
        HEATING_CURRENT_DEFROST_ACTIVE: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.DefrostActive',
        HEATING_CURRENT_SAMPLE_VALID: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.SampleValid',
        HEATING_CURRENT_SAMPLE_QUALITY: CONFIG.NPS_ROOT + '.HeatingOptimization.Current.SampleQuality',

        HEATING_ROOMS_COUNT: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.Count',
        HEATING_ROOMS_ACTIVE_COUNT: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.ActiveCount',
        HEATING_ROOMS_DATA_VALID_COUNT: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.DataValidCount',
        HEATING_ROOMS_ANALYSIS_VALID_COUNT: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.ValidForHeatingCurveCount',
        HEATING_ROOMS_TOO_COLD_COUNT: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.TooColdCount',
        HEATING_ROOMS_OK_COUNT: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.OKCount',
        HEATING_ROOMS_TOO_WARM_COUNT: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.TooWarmCount',
        HEATING_ROOMS_AVERAGE_DEVIATION: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.AverageDeviation',
        HEATING_ROOMS_MEDIAN_DEVIATION: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.MedianDeviation',
        HEATING_ROOMS_STDDEV: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.DeviationStdDev',
        HEATING_ROOMS_RANGE: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.DeviationRange',
        HEATING_ROOMS_COLDEST: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.ColdestRoom',
        HEATING_ROOMS_COLDEST_DEVIATION: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.ColdestRoomDeviation',
        HEATING_ROOMS_WARMEST: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.WarmestRoom',
        HEATING_ROOMS_WARMEST_DEVIATION: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.WarmestRoomDeviation',
        HEATING_ROOMS_JSON: CONFIG.NPS_ROOT + '.HeatingOptimization.Rooms.Json',

        HEATING_ANALYSIS_6H: CONFIG.NPS_ROOT + '.HeatingOptimization.Analysis.Window6h',
        HEATING_ANALYSIS_24H: CONFIG.NPS_ROOT + '.HeatingOptimization.Analysis.Window24h',
        HEATING_ANALYSIS_72H: CONFIG.NPS_ROOT + '.HeatingOptimization.Analysis.Window72h',
        HEATING_ANALYSIS_7D: CONFIG.NPS_ROOT + '.HeatingOptimization.Analysis.Window7d',
        HEATING_ANALYSIS_EVIDENCE_JSON: CONFIG.NPS_ROOT + '.HeatingOptimization.Analysis.EvidenceJson',
        HEATING_ANALYSIS_CURRENT_CONFIG_HOURS: CONFIG.NPS_ROOT + '.HeatingOptimization.Analysis.CurrentConfigurationValidHeatingHours',

        HEATING_AI_READY: CONFIG.NPS_ROOT + '.HeatingOptimization.AI.Ready',
        HEATING_AI_GENERATED_AT: CONFIG.NPS_ROOT + '.HeatingOptimization.AI.GeneratedAt',

        HEATING_CONFIG_ROOT: CONFIG.NPS_ROOT + '.HeatingOptimization.Configuration'
    });

    const STATISTICS_AREAS = Object.freeze([
        { key: 'StromGesamt', name: 'Elektrische Energie gesamt aktuell', source: CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Gesamt', unit: 'kWh', role: 'value.energy', costs: true },

        // ElectricalMeters – kumulative Registerzähler
        { key: 'StromRegisterGesamt', name: 'Elektrische Energie Register gesamt', source: CONFIG.NPS_ROOT + '.ElectricalMeters.Gesamt', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromRegisterHeizungStandbyUnbekannt', name: 'Elektrische Energie Heizung, Standby und unbekannt', source: CONFIG.NPS_ROOT + '.ElectricalMeters.Registerwerte.HeizungStandbyUnbekannt', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromRegisterBrauchwasser', name: 'Elektrische Energie Brauchwasser laut Stundenregister', source: CONFIG.NPS_ROOT + '.ElectricalMeters.Registerwerte.Brauchwasser', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromRegisterZusatzheizungHeizung', name: 'Elektrische Energie Zusatzheizung Heizung', source: CONFIG.NPS_ROOT + '.ElectricalMeters.Registerwerte.ZusatzheizungHeizung', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromRegisterZusatzheizungBrauchwasser', name: 'Elektrische Energie Zusatzheizung Brauchwasser', source: CONFIG.NPS_ROOT + '.ElectricalMeters.Registerwerte.ZusatzheizungBrauchwasser', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromHeizung', name: 'Elektrische Energie Heizung', source: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Heating', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromWarmwasser', name: 'Elektrische Energie Warmwasser', source: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Warmwater', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromStandby', name: 'Elektrische Energie Standby', source: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Standby', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromKuehlung', name: 'Elektrische Energie Kühlung', source: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Cooling', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromPool', name: 'Elektrische Energie Pool', source: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Pool', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromUnbekannt', name: 'Elektrische Energie unbekannt', source: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Unknown', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'StromZugeordnet', name: 'Elektrische Energie insgesamt zugeordnet', source: CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.TotalAllocated', unit: 'kWh', role: 'value.energy', costs: true },
        { key: 'WaermeHeizungGesamt', name: 'Heizenergie inklusive Zusatzheizung', source: CONFIG.NPS_ROOT + '.VirtualMeters.Heizung.InklusiveZusatzheizung', unit: 'kWh', role: 'value.energy', costs: false },
        { key: 'WaermeHeizungVerdichter', name: 'Heizenergie nur Verdichter', source: CONFIG.NPS_ROOT + '.VirtualMeters.Heizung.NurVerdichter', unit: 'kWh', role: 'value.energy', costs: false },
        { key: 'WaermeWarmwasserGesamt', name: 'Brauchwasserenergie inklusive Zusatzheizung', source: CONFIG.NPS_ROOT + '.VirtualMeters.Brauchwasser.InklusiveZusatzheizung', unit: 'kWh', role: 'value.energy', costs: false },
        { key: 'WaermeWarmwasserVerdichter', name: 'Brauchwasserenergie nur Verdichter', source: CONFIG.NPS_ROOT + '.VirtualMeters.Brauchwasser.NurVerdichter', unit: 'kWh', role: 'value.energy', costs: false },
        { key: 'WaermeGesamtInklusiveZusatzheizung', name: 'Wärmeenergie gesamt inklusive Zusatzheizung', source: CONFIG.NPS_ROOT + '.VirtualMeters.Gesamt.InklusiveZusatzheizung', unit: 'kWh', role: 'value.energy', costs: false },
        { key: 'WaermeGesamtNurVerdichter', name: 'Wärmeenergie gesamt nur Verdichter', source: CONFIG.NPS_ROOT + '.VirtualMeters.Gesamt.NurVerdichter', unit: 'kWh', role: 'value.energy', costs: false },
        { key: 'Verdichterlaufzeit', name: 'Verdichterlaufzeit', source: CONFIG.ROOT + '.Compressor.Runtime', unit: 'min', role: 'value.interval', costs: false },
        { key: 'Verdichterstarts', name: 'Verdichterstarts', source: CONFIG.ROOT + '.Compressor.Starts', unit: '', role: 'value', costs: false },
        { key: 'Abtaudauer', name: 'Abtaudauer', source: CONFIG.NPS_ROOT + '.DefrostMonitor.Defrost.TotalDurationMinutes', unit: 'min', role: 'value.interval', costs: false }
    ]);

    const DERIVED_STATISTICS_AREAS = Object.freeze([
        { key: 'WaermeHeizungZusatzheizung', name: 'Heizenergie nur Zusatzheizung', unit: 'kWh', role: 'value.energy' },
        { key: 'WaermeWarmwasserZusatzheizung', name: 'Brauchwasserenergie nur Zusatzheizung', unit: 'kWh', role: 'value.energy' },
        { key: 'WaermeGesamtZusatzheizung', name: 'Wärmeenergie gesamt nur Zusatzheizung', unit: 'kWh', role: 'value.energy' },
        { key: 'COPGesamt', name: 'COP gesamt', unit: '', role: 'value' },
        { key: 'COPHeizung', name: 'COP Heizung', unit: '', role: 'value' },
        { key: 'COPWarmwasser', name: 'COP Warmwasser', unit: '', role: 'value' },
        { key: 'COPVerdichterGesamt', name: 'COP Verdichterwärme gesamt', unit: '', role: 'value' },
        { key: 'AnteilVerdichter', name: 'Anteil Verdichterwärme', unit: '%', role: 'value' },
        { key: 'AnteilZusatzheizung', name: 'Anteil Zusatzheizungswärme', unit: '%', role: 'value' }
    ]);

    const STATISTICS_PERIODS = Object.freeze([
        { label: 'Laufende Viertelstunde', scope: 'temp', suffix: '15Min' },
        { label: 'Letzte Viertelstunde', scope: 'save', suffix: '15Min' },
        { label: 'Laufende Stunde', scope: 'temp', suffix: 'hour' },
        { label: 'Letzte Stunde', scope: 'save', suffix: 'hour' },
        { label: 'Heute', scope: 'temp', suffix: 'day' },
        { label: 'Gestern', scope: 'save', suffix: 'day' },
        { label: 'Laufende Woche', scope: 'temp', suffix: 'week' },
        { label: 'Letzte Woche', scope: 'save', suffix: 'week' },
        { label: 'Laufender Monat', scope: 'temp', suffix: 'month' },
        { label: 'Letzter Monat', scope: 'save', suffix: 'month' },
        { label: 'Laufendes Quartal', scope: 'temp', suffix: 'quarter' },
        { label: 'Letztes Quartal', scope: 'save', suffix: 'quarter' },
        { label: 'Laufendes Jahr', scope: 'temp', suffix: 'year' },
        { label: 'Letztes Jahr', scope: 'save', suffix: 'year' }
    ]);

    let scheduleHandle = null;
    let debounceTimer = null;
    let running = false;
    let pending = false;
    let updateCounter = 0;
    let errorCounter = 0;
    const targetStates = [];

    function info(message) {
        log('[NPS DashboardData] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS DashboardData] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS DashboardData DEBUG] ' + message, 'info');
        }
    }

    function id(path) {
        return CONFIG.ROOT + '.' + path;
    }

    function exists(anyId) {
        return existsState(anyId) || existsObject(anyId);
    }

    function localIsoFromDate(date) {
        if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';

        function pad(value) {
            return String(value).padStart(2, '0');
        }

        const offsetMinutes = -date.getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const absoluteOffset = Math.abs(offsetMinutes);
        const offsetHours = pad(Math.floor(absoluteOffset / 60));
        const offsetRestMinutes = pad(absoluteOffset % 60);

        return (
            date.getFullYear() + '-' +
            pad(date.getMonth() + 1) + '-' +
            pad(date.getDate()) + 'T' +
            pad(date.getHours()) + ':' +
            pad(date.getMinutes()) + ':' +
            pad(date.getSeconds()) +
            sign + offsetHours + ':' + offsetRestMinutes
        );
    }

    function parseDateValue(value) {
        if (value instanceof Date) {
            return Number.isFinite(value.getTime()) ? value : null;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            const milliseconds = Math.abs(value) < 100000000000 ? value * 1000 : value;
            const numericDate = new Date(milliseconds);
            return Number.isFinite(numericDate.getTime()) ? numericDate : null;
        }

        if (typeof value !== 'string') return null;

        const text = value.trim();
        if (!text) return null;

        if (/^-?\d+(?:\.\d+)?$/.test(text)) {
            return parseDateValue(Number(text));
        }

        const germanMatch = text.match(
            /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,)?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
        );

        if (germanMatch) {
            const localDate = new Date(
                Number(germanMatch[3]),
                Number(germanMatch[2]) - 1,
                Number(germanMatch[1]),
                Number(germanMatch[4]),
                Number(germanMatch[5]),
                Number(germanMatch[6] || 0)
            );
            return Number.isFinite(localDate.getTime()) ? localDate : null;
        }

        const parsed = Date.parse(text);
        return Number.isFinite(parsed) ? new Date(parsed) : null;
    }

    function localIso(value) {
        const date = value === undefined ? new Date() : parseDateValue(value);
        return date ? localIsoFromDate(date) : '';
    }

    function round(value, digits) {
        if (!Number.isFinite(value)) return null;
        const factor = Math.pow(10, digits);
        return Math.round(value * factor) / factor;
    }

    function readStateObject(sourceId) {
        try {
            return existsState(sourceId) ? getState(sourceId) : null;
        } catch (error) {
            return null;
        }
    }

    function readRaw(sourceId) {
        const state = readStateObject(sourceId);
        if (!state || state.val === undefined || state.val === null) return null;
        return state.val;
    }

    function readNumber(sourceId, digits) {
        const value = readRaw(sourceId);
        if (value === null || value === '') return null;
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return digits === undefined ? number : round(number, digits);
    }

    function readBoolean(sourceId) {
        const value = readRaw(sourceId);
        if (value === null) return null;
        if (value === true || value === 1 || value === '1' || value === 'true') return true;
        if (value === false || value === 0 || value === '0' || value === 'false') return false;
        return null;
    }

    function readText(sourceId, fallback) {
        const value = readRaw(sourceId);
        if (value === null) return fallback === undefined ? '' : fallback;
        return String(value);
    }

    function readTimestampMs(sourceId) {
        const state = readStateObject(sourceId);
        if (!state) return null;
        if (Number.isFinite(Number(state.ts))) return Number(state.ts);
        const value = state.val;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function ageSeconds(sourceId) {
        const ts = readTimestampMs(sourceId);
        return ts === null ? null : Math.max(0, Math.round((Date.now() - ts) / 1000));
    }

    function parseJson(text) {
        if (!text || typeof text !== 'string') return null;
        try {
            return JSON.parse(text);
        } catch (error) {
            return null;
        }
    }

    function getPath(object, path) {
        if (!object || typeof object !== 'object') return null;
        const parts = path.split('.');
        let current = object;
        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') return null;
            current = current[part];
        }
        return current === undefined ? null : current;
    }

    function firstNumber(values) {
        for (const value of values) {
            const number = Number(value);
            if (value !== null && value !== '' && Number.isFinite(number)) return number;
        }
        return null;
    }

    function write(path, value) {
        const target = id(path);

        if (!existsState(target)) {
            warn('Zieldatenpunkt fehlt: ' + target);
            return false;
        }

        if (value === undefined || value === null) {
            return true;
        }

        const current = getState(target);
        if (!current || current.val !== value) {
            setState(target, value, true);
        }

        return true;
    }

    function ensureFolder(target, name) {
        if (exists(target)) return;
        setObject(target, {
            type: 'folder',
            common: { name: name },
            native: {}
        });
    }

    function ensureChannel(path, name) {
        const target = id(path);
        if (exists(target)) return;
        setObject(target, {
            type: 'channel',
            common: { name: name },
            native: {}
        });
    }

    function ensureState(path, initialValue, type, role, name, unit) {
        const target = id(path);

        if (!targetStates.includes(target)) {
            targetStates.push(target);
        }

        const common = {
            name: name || path,
            type: type,
            role: role,
            read: true,
            write: false
        };

        if (unit !== undefined) common.unit = unit;

        if (existsState(target)) {
            const object = getObject(target);
            const currentCommon = object && object.common ? object.common : {};
            const metadataChanged = Object.keys(common).some(function (key) {
                return currentCommon[key] !== common[key];
            });

            if (metadataChanged) {
                extendObject(target, { common: common });
            }
            return;
        }

        createState(target, initialValue, common);
    }

    function ensureString(path, name, role) {
        ensureState(path, '', 'string', role || 'text', name);
    }

    function ensureNumber(path, name, unit, role) {
        ensureState(path, 0, 'number', role || (unit === 'kWh' ? 'value.energy' : 'value'), name, unit);
    }

    function ensureBoolean(path, name) {
        ensureState(path, false, 'boolean', 'indicator', name);
    }

    function ensureWritableNumber(path, initialValue, name, unit, role) {
        const target = id(path);
        const common = {
            name: name || path,
            type: 'number',
            role: role || 'value',
            read: true,
            write: true
        };
        if (unit !== undefined) common.unit = unit;

        if (!targetStates.includes(target)) targetStates.push(target);

        if (existsState(target)) {
            extendObject(target, { common: common });
            return;
        }
        createState(target, initialValue, common);
    }

    function createStructure() {
        ensureFolder(CONFIG.ROOT, 'NPS DashboardData Slim');

        [
            ['Overview', 'Übersicht'],
            ['Temperatures', 'Temperaturen'],
            ['Compressor', 'Verdichter'],
            ['Compressor.History', 'Verdichterhistorie'],
            ['Performance', 'Leistung und Effizienz'],
            ['AdditionalHeat', 'Zusatzheizung'],
            ['Energy', 'Energie'],
            ['Energy.History', 'Energiehistorie'],
            ['Electrical', 'Elektrischer Zähler'],
            ['Periods', 'Periodenwerte'],
            ['Periods.Day', 'Tageswerte'],
            ['Configuration', 'Konfiguration'],
            ['Statistics', 'Statistiken'],
            ['Cycles', 'Zyklen'],
            ['Defrost', 'Abtauen'],
            ['Events', 'Ereignisse'],
            ['Events.Today', 'Ereignisse heute'],
            ['System', 'System'],
            ['Help', 'Bedienungsanleitung'],
            ['HeatingOptimization', 'Heizungsoptimierung'],
            ['HeatingOptimization.Status', 'Heizungsoptimierung Status'],
            ['HeatingOptimization.Current', 'Heizungsoptimierung Anlagenstatus'],
            ['HeatingOptimization.Rooms', 'Heizungsoptimierung Raumkomfort'],
            ['HeatingOptimization.Analysis', 'Heizungsoptimierung Analyse 72 h'],
            ['HeatingOptimization.Evidence', 'Heizungsoptimierung Analysehinweise'],
            ['HeatingOptimization.DataQuality', 'Heizungsoptimierung Datenqualität'],
            ['HeatingOptimization.Configuration', 'Heizungsoptimierung Konfiguration'],
            ['HeatingOptimization.Tables', 'Heizungsoptimierung Tabellen']
        ].forEach(function (entry) {
            ensureChannel(entry[0], entry[1]);
        });

        // Overview: 12
        ensureString('Overview.State', 'Anlagenzustand');
        ensureString('Overview.Mode', 'Betriebsart');
        ensureString('Overview.ModeColor', 'Betriebsartenfarbe');
        ensureString('Overview.ModeIcon', 'Betriebsart-Icon');
        ensureString('Overview.Health', 'Anlagenbewertung');
        ensureString('Overview.HealthColor', 'Bewertungsfarbe');
        ensureNumber('Overview.HealthPercent', 'NPS Health', '%', 'value');
        ensureString('Overview.HealthReason', 'Health-Kurzbegründung');
        ensureString('Overview.HealthDetails', 'Health-Berechnungsdetails', 'json');
        ensureString('Overview.HealthTable', 'Health-Tabelle für Jarvis', 'json');
        ensureString('Overview.HealthLastUpdate', 'Health zuletzt berechnet', 'date');
        ensureString('Overview.TechnicalState', 'Technischer Zustand');
        ensureString('Overview.TechnicalColor', 'Technische Zustandsfarbe');
        ensureNumber('Overview.AlarmNumber', 'Alarmnummer');
        ensureBoolean('Overview.AlarmActive', 'Alarm aktiv');
        ensureString('Overview.Notice', 'Hinweis');
        ensureBoolean('Overview.ActiveCycle', 'Zyklus aktiv');
        ensureString('Overview.ActiveCycleType', 'Aktiver Zyklustyp');
        ensureString('Overview.LastUpdate', 'Letzte Aktualisierung', 'date');
        ensureString('Overview.Status', 'NPS-Status');
        ensureString('Overview.Message', 'NPS-Meldung');

        // Temperatures: 10 + QualityColor
        ensureNumber('Temperatures.Outdoor', 'Außentemperatur', '°C', 'value.temperature');
        ensureNumber('Temperatures.SupplyTarget', 'Vorlauf Soll', '°C', 'value.temperature');
        ensureNumber('Temperatures.Supply', 'Vorlauftemperatur', '°C', 'value.temperature');
        ensureNumber('Temperatures.SupplyDeviation', 'Vorlaufabweichung', 'K', 'value.temperature');
        ensureNumber('Temperatures.Return', 'Rücklauftemperatur', '°C', 'value.temperature');
        ensureNumber('Temperatures.DeltaT', 'Spreizung', 'K', 'value.temperature');
        ensureNumber('Temperatures.Flow', 'Volumenstrom', 'l/min', 'value.flow');
        ensureNumber('Temperatures.MeanHeatingWater', 'Mittlere Heizwassertemperatur', '°C', 'value.temperature');
        ensureNumber('Temperatures.TemperatureLift', 'Temperaturhub', 'K', 'value.temperature');
        ensureNumber('Temperatures.Warmwater', 'Warmwasser oben (BT7)', '°C', 'value.temperature');
        ensureNumber('Temperatures.WarmwaterCharging', 'Warmwasserbereitung (BT6)', '°C', 'value.temperature');
        ensureString('Temperatures.QualityColor', 'Qualitätsfarbe');

        // Compressor: Live- und Betriebsdaten
        ensureBoolean('Compressor.Active', 'Verdichter aktiv');
        ensureString('Compressor.Mode', 'Betriebsart');
        ensureNumber('Compressor.Frequency', 'Verdichterfrequenz', 'Hz', 'value.frequency');
        ensureNumber('Compressor.Runtime', 'Verdichterlaufzeit gesamt', 'min', 'value.interval');
        ensureNumber('Compressor.Starts', 'Verdichterstarts gesamt');
        ensureNumber('Compressor.StartsToday', 'Verdichterstarts heute');
        ensureNumber('Compressor.RuntimeToday', 'Verdichterlaufzeit heute', 'min', 'value.interval');
        ensureNumber('Compressor.AverageCycleDurationToday', 'Ø Zyklusdauer heute', 'min', 'value.interval');
        ensureNumber('Compressor.AverageFrequencyToday', 'Ø Verdichterfrequenz heute', 'Hz', 'value.frequency');
        ensureString('Compressor.State', 'Verdichterzustand');
        ensureString('Compressor.Status', 'Verdichterstatus');
        ensureString('Compressor.QualityColor', 'Qualitätsfarbe');

        // Persistente Hilfswerte für den zeitgewichteten Tagesmittelwert.
        ensureString('Compressor.InternalFrequencyDay', 'Intern: Frequenzmittelwert Kalendertag');
        ensureNumber('Compressor.InternalFrequencyWeightedHzSeconds', 'Intern: Frequenzsumme Hz*s', 'Hz*s', 'value');
        ensureNumber('Compressor.InternalFrequencyRunningSeconds', 'Intern: Frequenz-Messzeit', 's', 'value.interval');
        ensureNumber('Compressor.InternalFrequencyLastTimestamp', 'Intern: letzter Frequenz-Zeitstempel', 'ms', 'value');
        ensureNumber('Compressor.InternalFrequencyLastValue', 'Intern: letzter Frequenzwert', 'Hz', 'value.frequency');
        ensureBoolean('Compressor.InternalFrequencyLastActive', 'Intern: letzter Verdichterstatus');

        // Compressor.History: abgeschlossene Tageswerte
        ensureNumber('Compressor.History.StartsPerDay', 'Verdichterstarts pro Tag');
        ensureNumber('Compressor.History.RuntimePerDay', 'Verdichterlaufzeit pro Tag', 'min', 'value.interval');

        // Performance: Live-Leistungswerte
        ensureNumber('Performance.ThermalPower', 'Wärmeleistung', 'kW', 'value.power');
        ensureNumber('Performance.LiveCOP', 'COP aktuell', '', 'value');
        ensureBoolean('Performance.LiveCOPValid', 'COP aktuell gültig');
        ensureString('Performance.PeriodComparisonJson', 'Performance Periodenvergleich', 'json');

        // AdditionalHeat: Livewerte der internen Zusatzheizung
        ensureBoolean('AdditionalHeat.Active', 'Zusatzheizung aktiv');
        ensureNumber('AdditionalHeat.Power', 'Zusatzheizungsleistung', 'kW', 'value.power');
        ensureNumber('AdditionalHeat.Mode', 'Zusatzheizungsmodus', '', 'value');

        // Energy: aktuelle Zähler und Jahreskennzahlen
        ensureNumber('Energy.ElectricTotal', 'Elektrische Energie gesamt', 'kWh', 'value.energy');
        ensureNumber('Energy.ElectricHeating', 'Elektrische Energie Heizung', 'kWh', 'value.energy');
        ensureNumber('Energy.ElectricWarmwater', 'Elektrische Energie Warmwasser', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatHeating', 'Heizwärme gesamt', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatWarmwater', 'Warmwasserwärme gesamt', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatTotal', 'Wärmeenergie gesamt', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatHeatingCompressor', 'Heizwärme nur Verdichter', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatWarmwaterCompressor', 'Warmwasserwärme nur Verdichter', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatTotalCompressor', 'Wärmeenergie gesamt nur Verdichter', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatHeatingZH', 'Heizwärme nur Zusatzheizung', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatWarmwaterZH', 'Warmwasserwärme nur Zusatzheizung', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatTotalZH', 'Wärmeenergie gesamt nur Zusatzheizung', 'kWh', 'value.energy');
        ensureNumber('Energy.HeatShareCompressor', 'Anteil Verdichterwärme', '%', 'value');
        ensureNumber('Energy.HeatShareZH', 'Anteil Zusatzheizungswärme', '%', 'value');
        ensureNumber('Energy.COPTotal', 'COP gesamt laufendes Jahr');
        ensureNumber('Energy.COPHeating', 'COP Heizung laufendes Jahr');
        ensureNumber('Energy.COPWarmwater', 'COP Warmwasser laufendes Jahr');
        ensureNumber('Energy.COPCompressorTotal', 'COP Verdichterwärme gesamt laufendes Jahr');
        ensureNumber('Energy.COPCompressorHeating', 'COP Verdichterwärme Heizung laufendes Jahr');
        ensureNumber('Energy.COPCompressorWarmwater', 'COP Verdichterwärme Warmwasser laufendes Jahr');
        ensureString('Energy.PeriodComparisonJson', 'Energie Periodenvergleich', 'json');

        // Energy.History: abgeschlossene Tageswerte für HistoryGraphs
        ensureNumber('Energy.History.ElectricTotalPerDay', 'Strom gesamt pro Tag', 'kWh', 'value.energy');
        ensureNumber('Energy.History.ElectricHeatingPerDay', 'Strom Heizung pro Tag', 'kWh', 'value.energy');
        ensureNumber('Energy.History.ElectricWarmwaterPerDay', 'Strom Warmwasser pro Tag', 'kWh', 'value.energy');
        ensureNumber('Energy.History.ElectricZHPerDay', 'Strom Zusatzheizung pro Tag', 'kWh', 'value.energy');
        ensureNumber('Energy.History.HeatTotalPerDay', 'Wärme gesamt pro Tag', 'kWh', 'value.energy');
        ensureNumber('Energy.History.HeatHeatingPerDay', 'Wärme Heizung pro Tag', 'kWh', 'value.energy');
        ensureNumber('Energy.History.HeatWarmwaterPerDay', 'Wärme Warmwasser pro Tag', 'kWh', 'value.energy');
        ensureNumber('Energy.History.HeatZHPerDay', 'Wärme Zusatzheizung pro Tag', 'kWh', 'value.energy');
        ensureString('Energy.QualityColor', 'Qualitätsfarbe');

        // Electrical: Live- und Diagnosewerte aus ElectricalMeters
        ensureNumber('Electrical.TotalEnergy', 'Aktueller Gesamtstromzähler', 'kWh', 'value.energy');
        ensureNumber('Electrical.EstimatedEnergy', 'Geschätzter Gesamtstromzähler', 'kWh', 'value.energy');
        ensureNumber('Electrical.CurrentPower', 'Aktuelle elektrische Leistung', 'W', 'value.power');
        ensureNumber('Electrical.NibeCounter', 'Letzter NIBE-Gesamtzählerstand', 'kWh', 'value.energy');
        ensureNumber('Electrical.IntegratedEnergy', 'Integrierte Energie seit NIBE-Aktualisierung', 'kWh', 'value.energy');
        ensureNumber('Electrical.Offset', 'Abweichung NPS zu NIBE', 'kWh', 'value.energy');
        ensureNumber('Electrical.MaxOffset', 'Maximale absolute Zählerabweichung', 'kWh', 'value.energy');
        ensureNumber('Electrical.CorrectionDelta', 'Letztes Korrekturdelta', 'kWh', 'value.energy');
        ensureString('Electrical.OffsetStatus', 'Bewertung der Zählerabweichung');
        ensureString('Electrical.OffsetColor', 'Farbe der Zählerabweichung');
        ensureBoolean('Electrical.Valid', 'Aktueller Zähler gültig');
        ensureString('Electrical.Status', 'Status des aktuellen Zählers');
        ensureString('Electrical.LastPowerUpdate', 'Letzte Leistungsaktualisierung', 'date');
        ensureString('Electrical.LastCounterUpdate', 'Letzte NIBE-Zähleränderung', 'date');
        ensureString('Electrical.LastIntegration', 'Letzte Leistungsintegration', 'date');
        ensureString('Electrical.LastUpdate', 'Letzte Modulaktualisierung', 'date');

        // Periods.Day: 13 (statistics.0, laufender Kalendertag)
        ensureNumber('Periods.Day.ElectricTotal', 'Elektrische Energie gesamt heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.ElectricHeating', 'Elektrische Energie Heizung heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.ElectricWarmwater', 'Elektrische Energie Warmwasser heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.HeatHeating', 'Heizwärme heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.HeatWarmwater', 'Warmwasserwärme heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.HeatTotal', 'Wärmeenergie gesamt heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.HeatCompressor', 'Verdichterwärme heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.COPTotal', 'COP gesamt heute');
        ensureNumber('Periods.Day.ShareCompressor', 'Verdichteranteil heute', '%', 'value');
        ensureNumber('Periods.Day.ShareZH', 'Zusatzheizungsanteil heute', '%', 'value');
        ensureNumber('Periods.Day.HeatZH', 'Zusatzheizungswärme heute', 'kWh', 'value.energy');
        ensureNumber('Periods.Day.COPHeating', 'COP Heizung heute');
        ensureNumber('Periods.Day.COPWarmwater', 'COP Warmwasser heute');
        ensureString('Periods.Day.QualityColor', 'Qualitätsfarbe Tageswerte');

        // Configuration
        ensureWritableNumber(
            'Configuration.ElectricityPrice',
            CONFIG.DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH,
            'Strompreis',
            '€/kWh',
            'value'
        );

        // Statistics: Periodentabelle plus abgeschlossene Langzeitwerte
        STATISTICS_AREAS.forEach(function (area) {
            ensureChannel('Statistics.' + area.key, area.name);
            ensureString('Statistics.' + area.key + '.Json', area.name + ' – Periodentabelle', 'json');
            ensureNumber('Statistics.' + area.key + '.Yesterday', area.name + ' gestern', area.unit, area.role);
            ensureNumber('Statistics.' + area.key + '.LastMonth', area.name + ' letzter Monat', area.unit, area.role);
            ensureNumber('Statistics.' + area.key + '.LastYear', area.name + ' letztes Jahr', area.unit, area.role);
        });

        DERIVED_STATISTICS_AREAS.forEach(function (area) {
            ensureChannel('Statistics.' + area.key, area.name);
            ensureString('Statistics.' + area.key + '.Json', area.name + ' – Periodentabelle', 'json');
            ensureNumber('Statistics.' + area.key + '.Yesterday', area.name + ' gestern', area.unit, area.role);
            ensureNumber('Statistics.' + area.key + '.LastMonth', area.name + ' letzter Monat', area.unit, area.role);
            ensureNumber('Statistics.' + area.key + '.LastYear', area.name + ' letztes Jahr', area.unit, area.role);
        });

        // Cycles: 9
        ensureBoolean('Cycles.Active', 'Zyklus aktiv');
        ensureString('Cycles.Type', 'Zyklustyp');
        ensureNumber('Cycles.Duration', 'Zyklusdauer', 'min', 'value.interval');
        ensureNumber('Cycles.CurrentDuration', 'Aktuelle Zyklusdauer', 'min', 'value.interval');
        ensureNumber('Cycles.COP', 'Zyklus-COP');
        ensureNumber('Cycles.ElectricEnergy', 'Elektrische Zyklusenergie', 'kWh', 'value.energy');
        ensureNumber('Cycles.HeatEnergy', 'Thermische Zyklusenergie', 'kWh', 'value.energy');
        ensureNumber('Cycles.Quality', 'Zyklusqualität', '%', 'value');
        ensureString('Cycles.QualityColor', 'Qualitätsfarbe');
        ensureString('Cycles.LastCycle', 'Letzter Zyklus');
        ensureString('Cycles.History', 'Zyklushistorie – letzte 20 Zyklen', 'json');

        // Defrost: 6
        ensureBoolean('Defrost.Active', 'Abtauung aktiv');
        ensureNumber('Defrost.Count', 'Abtauungen gesamt');
        ensureNumber('Defrost.Duration', 'Aktuelle Abtaudauer', 'min', 'value.interval');
        ensureNumber('Defrost.LastDuration', 'Letzte Abtaudauer', 'min', 'value.interval');
        ensureString('Defrost.LastStart', 'Letzter Abtaustart', 'date');
        ensureString('Defrost.QualityColor', 'Qualitätsfarbe');

        // Events
        ensureString('Events.LastEvent', 'Letzter Ereignistyp');
        ensureString('Events.LastTitle', 'Letzter Ereignistitel');
        ensureString('Events.LastMessage', 'Letzte Ereignismeldung');
        ensureString('Events.Criticality', 'Kritikalität');
        ensureString('Events.Timestamp', 'Ereigniszeitpunkt', 'date');
        ensureNumber('Events.Counter', 'Ereigniszähler');
        ensureString('Events.History', 'Ereignishistorie – letzte 50 Ereignisse', 'json');

        // Events.Today
        ensureString('Events.Today.Date', 'Datum der Tageszähler');
        ensureNumber('Events.Today.HeatingCycles', 'Heizzyklen heute');
        ensureNumber('Events.Today.WarmwaterCycles', 'Warmwasserzyklen heute');
        ensureNumber('Events.Today.Defrosts', 'Abtauungen heute');
        ensureNumber('Events.Today.Warnings', 'Warnungen heute');
        ensureNumber('Events.Today.Errors', 'Fehler heute');

        // System: 8
        ensureString('System.Version', 'Modulversion');
        ensureString('System.Status', 'Modulstatus');
        ensureBoolean('System.DataValid', 'Dashboarddaten gültig');
        ensureString('System.LastUpdate', 'Letzte Aktualisierung', 'date');
        ensureNumber('System.UpdateCounter', 'Anzahl Aktualisierungen');
        ensureNumber('System.ErrorCounter', 'Anzahl Fehler');
        ensureNumber('System.StructureVersion', 'Dashboard-Strukturversion');
        ensureNumber('System.HealthPercent', 'NPS Health', '%', 'value');
        ensureString('System.HealthState', 'NPS Health-Zustand');
        ensureString('System.HealthColor', 'NPS Health-Farbe');
        ensureString('System.HealthMessage', 'NPS Health-Meldung');
        ensureString('System.TechnicalState', 'Technischer Anlagenzustand');
        ensureNumber('System.TechnicalStateCode', 'Technischer Zustands-Code');
        ensureString('System.TechnicalMessage', 'Technische Zustandsmeldung');

        // HeatingOptimization – Präsentationsschnittstelle für Modul 15
        ensureBoolean('HeatingOptimization.Status.Active', 'Modul aktiv');
        ensureBoolean('HeatingOptimization.Status.Valid', 'Modul gültig');
        ensureNumber('HeatingOptimization.Status.DataQualityPercent', 'Datenqualität', '%', 'value');
        ensureString('HeatingOptimization.Status.DataQualityState', 'Qualitätsstatus');
        ensureBoolean('HeatingOptimization.Status.AnalysisReady', 'Analyse bereit');
        ensureString('HeatingOptimization.Status.LastUpdate', 'Dashboard-Aufbereitung zuletzt', 'date');
        ensureString('HeatingOptimization.Status.SourceTimestamp', 'Analyzer zuletzt berechnet', 'date');

        ensureNumber('HeatingOptimization.Current.OperatingPriority', 'Betriebspriorität');
        ensureString('HeatingOptimization.Current.OperatingModeText', 'Betriebsart');
        ensureNumber('HeatingOptimization.Current.OutdoorTemperature', 'Außentemperatur', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Current.FlowTarget', 'Vorlauf SOLL', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Current.FlowActual', 'Vorlauf IST', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Current.SupplyDeviation', 'Vorlaufabweichung', 'K', 'value');
        ensureNumber('HeatingOptimization.Current.ReturnTemperature', 'Rücklauf', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Current.DeltaT', 'Delta-T', 'K', 'value');
        ensureNumber('HeatingOptimization.Current.DegreeMinutes', 'Gradminuten', 'GM', 'value');
        ensureBoolean('HeatingOptimization.Current.CompressorActive', 'Verdichter');
        ensureNumber('HeatingOptimization.Current.CompressorFrequency', 'Verdichterfrequenz', 'Hz', 'value.frequency');
        ensureNumber('HeatingOptimization.Current.VolumeFlow', 'Volumenstrom', 'l/min', 'value.flow');
        ensureBoolean('HeatingOptimization.Current.AdditionalHeatActive', 'Zusatzheizung');
        ensureBoolean('HeatingOptimization.Current.DefrostActive', 'Enteisung');
        ensureBoolean('HeatingOptimization.Current.SampleValid', 'Analysesample');
        ensureNumber('HeatingOptimization.Current.SampleQuality', 'Samplequalität', '%', 'value');

        ensureNumber('HeatingOptimization.Rooms.Count', 'Räume gesamt');
        ensureNumber('HeatingOptimization.Rooms.ActiveCount', 'Räume aktiv');
        ensureNumber('HeatingOptimization.Rooms.DataValidCount', 'Daten gültig');
        ensureNumber('HeatingOptimization.Rooms.ValidForHeatingCurveCount', 'Für Heizkurve verwertbar');
        ensureNumber('HeatingOptimization.Rooms.TooColdCount', 'Zu kalt');
        ensureNumber('HeatingOptimization.Rooms.OKCount', 'Komfortbereich');
        ensureNumber('HeatingOptimization.Rooms.TooWarmCount', 'Zu warm');
        ensureNumber('HeatingOptimization.Rooms.AverageDeviation', 'Ø Raumabweichung', 'K', 'value');
        ensureNumber('HeatingOptimization.Rooms.MedianDeviation', 'Median Raumabweichung', 'K', 'value');
        ensureNumber('HeatingOptimization.Rooms.DeviationStdDev', 'Streuung', 'K', 'value');
        ensureNumber('HeatingOptimization.Rooms.DeviationRange', 'Spannweite', 'K', 'value');
        ensureString('HeatingOptimization.Rooms.ColdestRoom', 'Kältester Raum');
        ensureNumber('HeatingOptimization.Rooms.ColdestRoomDeviation', 'Abweichung kältester Raum', 'K', 'value');
        ensureString('HeatingOptimization.Rooms.WarmestRoom', 'Wärmster Raum');
        ensureNumber('HeatingOptimization.Rooms.WarmestRoomDeviation', 'Abweichung wärmster Raum', 'K', 'value');

        ensureBoolean('HeatingOptimization.Analysis.Valid', 'Analyse gültig');
        ensureNumber('HeatingOptimization.Analysis.ValidHeatingHours', 'Gültige Heizstunden', 'h', 'value.interval');
        ensureNumber('HeatingOptimization.Analysis.DataQualityPercent', 'Datenqualität 72 h', '%', 'value');
        ensureNumber('HeatingOptimization.Analysis.AvgOutdoorTemperature', 'Außentemperatur Ø', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Analysis.AvgFlowTarget', 'Vorlauf SOLL Ø', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Analysis.AvgFlowActual', 'Vorlauf IST Ø', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Analysis.AvgFlowDeviation', 'Vorlaufabweichung Ø', 'K', 'value');
        ensureNumber('HeatingOptimization.Analysis.AvgRoomDeviation', 'Raumabweichung Ø', 'K', 'value');
        ensureNumber('HeatingOptimization.Analysis.MedianRoomDeviation', 'Raumabweichung Median', 'K', 'value');
        ensureNumber('HeatingOptimization.Analysis.TooColdRatio', 'Zu kalt', '%', 'value');
        ensureNumber('HeatingOptimization.Analysis.OKRatio', 'Komfortbereich', '%', 'value');
        ensureNumber('HeatingOptimization.Analysis.TooWarmRatio', 'Zu warm', '%', 'value');
        ensureNumber('HeatingOptimization.Analysis.CompressorRuntimePercent', 'Verdichterlaufzeit', '%', 'value');
        ensureNumber('HeatingOptimization.Analysis.AdditionalHeatRuntimePercent', 'Zusatzheizung', '%', 'value');

        ensureString('HeatingOptimization.Evidence.GlobalTemperatureState', 'Gesamttemperatur');
        ensureString('HeatingOptimization.Evidence.FlowTrackingState', 'Vorlauf-Nachführung');
        ensureString('HeatingOptimization.Evidence.OutdoorDependenceState', 'Außentemperaturabhängigkeit');
        ensureBoolean('HeatingOptimization.Evidence.RoomImbalance', 'Raumungleichgewicht');
        ensureBoolean('HeatingOptimization.Evidence.AdditionalHeatInfluence', 'Einfluss Zusatzheizung');
        ensureBoolean('HeatingOptimization.Evidence.SensorMismatch', 'Außensensoren auffällig');
        ensureBoolean('HeatingOptimization.Evidence.InsufficientData', 'Datenbasis unzureichend');

        ensureBoolean('HeatingOptimization.DataQuality.SourceCheckOk', 'Quellenprüfung');
        ensureNumber('HeatingOptimization.DataQuality.RequiredTotal', 'Pflichtquellen gesamt');
        ensureNumber('HeatingOptimization.DataQuality.RequiredOk', 'Pflichtquellen OK');
        ensureString('HeatingOptimization.DataQuality.RequiredMissing', 'Fehlende Pflichtquellen');
        ensureNumber('HeatingOptimization.DataQuality.OptionalTotal', 'Optionale Quellen gesamt');
        ensureNumber('HeatingOptimization.DataQuality.OptionalOk', 'Optionale Quellen OK');
        ensureString('HeatingOptimization.DataQuality.OptionalMissing', 'Fehlende optionale Quellen');
        ensureNumber('HeatingOptimization.DataQuality.RoomSourcesConfigured', 'Raumquellen konfiguriert');
        ensureNumber('HeatingOptimization.DataQuality.RoomSourcesValid', 'Raumquellen gültig');
        ensureNumber('HeatingOptimization.DataQuality.Percent', 'Globale Datenqualität', '%', 'value');
        ensureString('HeatingOptimization.DataQuality.State', 'Qualitätsstatus');
        ensureNumber('HeatingOptimization.DataQuality.SampleQuality', 'Samplequalität', '%', 'value');
        ensureBoolean('HeatingOptimization.DataQuality.SampleValid', 'Aktueller Messpunkt gültig');
        ensureNumber('HeatingOptimization.DataQuality.ValidHeatingHours', 'Gültige Heizstunden aktuelle Konfiguration', 'h', 'value.interval');
        ensureBoolean('HeatingOptimization.DataQuality.AnalysisReady', 'Analyse bereit');

        ensureNumber('HeatingOptimization.Configuration.HeatingCurve', 'Heizkurve');
        ensureNumber('HeatingOptimization.Configuration.HeatingCurveOffset', 'Heizkurvenverschiebung');
        ensureNumber('HeatingOptimization.Configuration.FlowMin', 'Vorlauf Minimum', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Configuration.FlowMax', 'Vorlauf Maximum', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Configuration.HeatingStartUndertemp', 'Heizungsstart-Untertemperatur', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Configuration.HeatingStopTemperature', 'Heizungs-Stopp', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Configuration.AdditionalHeatStopTemperature', 'Zusatzheizung-Stopp', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Configuration.AutoFilterTime', 'Automatik-Filterzeit', 'h', 'value.interval');
        ensureNumber('HeatingOptimization.Configuration.MaxFlowDifferenceCompressor', 'Max. VL-Differenz Verdichter', 'K', 'value');
        ensureNumber('HeatingOptimization.Configuration.OperatingMode', 'Betriebsmodus');
        ensureString('HeatingOptimization.Configuration.OperatingModeText', 'Betriebsmodus Anzeige');
        ensureBoolean('HeatingOptimization.Configuration.HeatingAutomatic', 'Heizung Automatik');
        ensureString('HeatingOptimization.Configuration.ChangedAt', 'Aktuelle Konfiguration seit', 'date');
        [1,2,3,4,5,6,7].forEach(function (point) {
            ensureNumber(
                'HeatingOptimization.Configuration.CustomCurveP' + point,
                'Eigene Heizkurve P' + point,
                '°C',
                'value.temperature'
            );
        });
        ensureNumber('HeatingOptimization.Configuration.PointOutdoorTemperature', 'Punktverschiebung Außentemperatur', '°C', 'value.temperature');
        ensureNumber('HeatingOptimization.Configuration.PointOffset', 'Punktverschiebung', 'K', 'value');

        ensureString('HeatingOptimization.Tables.RoomsJson', 'Raumübersicht', 'json');
        ensureString('HeatingOptimization.Tables.AnalysisWindowsJson', 'Analysefenster', 'json');
        ensureString('HeatingOptimization.Tables.EvidenceJson', 'Analysehinweise', 'json');
        ensureString('HeatingOptimization.Tables.DataQualityJson', 'Datenqualität / Quellenprüfung', 'json');

        // Help: zentrale HTML-Bedienhilfen und PDF-Metadaten
        ensureString('Help.Manifest', 'Bedienhilfe – Kapitelmanifest', 'json');
        ensureString('Help.DocumentationVersion', 'Bedienhilfe – Dokumentationsversion');
        ensureString('Help.General', 'Bedienhilfe – Allgemein', 'html');
        ensureString('Help.System', 'Bedienhilfe – System', 'html');
        ensureString('Help.Performance', 'Bedienhilfe – Leistung und Effizienz', 'html');
        ensureString('Help.Energy', 'Bedienhilfe – Energie', 'html');
        ensureString('Help.Compressor', 'Bedienhilfe – Verdichter', 'html');
        ensureString('Help.Temperatures', 'Bedienhilfe – Temperaturen', 'html');
        ensureString('Help.Cycles', 'Bedienhilfe – Zyklus', 'html');
        ensureString('Help.Events', 'Bedienhilfe – Ereignisse', 'html');
        ensureString('Help.Defrost', 'Bedienhilfe – Enteisung', 'html');
        ensureString('Help.HeatingOptimization', 'Bedienhilfe – Heizungsanalyse', 'html');
        ensureString('System.Ruecksprung', 'Rücksprung');
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderHelpTable(table) {
        if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) return '';

        const headerHtml = table.headers.map(function (header) {
            return '<th style="text-align:left;padding:7px 8px;border-bottom:1px solid #616161;">' +
                escapeHtml(header) + '</th>';
        }).join('');

        const rowsHtml = table.rows.map(function (row) {
            return '<tr>' + row.map(function (cell) {
                return '<td style="vertical-align:top;padding:7px 8px;border-bottom:1px solid #424242;">' +
                    escapeHtml(cell) + '</td>';
            }).join('') + '</tr>';
        }).join('');

        return '<div style="overflow-x:auto;margin:8px 0 14px;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:0.96em;">' +
            '<thead><tr>' + headerHtml + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
    }

    function renderHelpColorRows(rows) {
        if (!Array.isArray(rows)) return '';
        return '<div style="margin:8px 0 14px;">' + rows.map(function (row) {
            const color = row[0];
            const label = row[1];
            return '<div style="margin:5px 0;">' +
                '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;' +
                'background:' + escapeHtml(color) + ';margin-right:8px;vertical-align:middle;"></span>' +
                '<span>' + escapeHtml(label) + '</span>' +
                '<span style="color:#9E9E9E;margin-left:8px;">(' + escapeHtml(color) + ')</span>' +
                '</div>';
        }).join('') + '</div>';
    }

    function renderHelpChapter(chapter) {
        if (chapter && typeof chapter.html === 'string' && chapter.html.trim() !== '') {
            return chapter.html;
        }

        const sectionsHtml = chapter.sections.map(function (section) {
            const paragraphs = Array.isArray(section.paragraphs)
                ? section.paragraphs.map(function (paragraph) {
                    return '<p style="margin:6px 0 10px;">' + escapeHtml(paragraph) + '</p>';
                }).join('')
                : '';

            return '<section style="margin-top:18px;">' +
                '<div style="font-size:1.08em;font-weight:600;margin-bottom:7px;">' +
                escapeHtml(section.title) + '</div>' +
                paragraphs +
                renderHelpTable(section.table) +
                renderHelpColorRows(section.colorRows) +
                '</section>';
        }).join('');

        return '<div class="nps-help" style="padding:14px;line-height:1.55;text-align:left;color:#E0E0E0;">' +
            '<div style="font-size:1.35em;font-weight:700;margin-bottom:6px;">' +
            escapeHtml(chapter.number + '. ' + chapter.title) + '</div>' +
            '<div style="color:#BDBDBD;margin-bottom:14px;">' + escapeHtml(chapter.summary) + '</div>' +
            sectionsHtml +
            '</div>';
    }

    function buildHelpManifest() {
        return JSON.stringify({
            schemaVersion: 1,
            documentationVersion: HELP_DOCUMENTATION.version,
            title: HELP_DOCUMENTATION.title,
            generatedBy: '10_NPS_DashboardData ' + CONFIG.VERSION,
            chapters: HELP_DOCUMENTATION.chapters.map(function (chapter) {
                return {
                    number: chapter.number,
                    key: chapter.key,
                    title: chapter.title,
                    state: CONFIG.ROOT + '.Help.' + chapter.key
                };
            })
        });
    }

    function publishHelpDocumentation() {
        write('Help.Manifest', buildHelpManifest());
        write('Help.DocumentationVersion', HELP_DOCUMENTATION.version);

        HELP_DOCUMENTATION.chapters.forEach(function (chapter) {
            write('Help.' + chapter.key, renderHelpChapter(chapter));
        });
    }

    function missingTargetStates() {
        return targetStates.filter(function (target) {
            return !existsState(target);
        });
    }

    function waitForTargetStates(callback) {
        const startedAt = Date.now();

        function check() {
            const missing = missingTargetStates();

            if (missing.length === 0) {
                callback(true, []);
                return;
            }

            if ((Date.now() - startedAt) >= CONFIG.STRUCTURE_WAIT_TIMEOUT_MS) {
                callback(false, missing);
                return;
            }

            setTimeout(check, CONFIG.STRUCTURE_WAIT_INTERVAL_MS);
        }

        check();
    }

    function runSelfTest() {
        const missingTargets = missingTargetStates();

        const importantSources = [
            SOURCE.STATE,
            SOURCE.MODE,
            SOURCE.TEMP_OUTDOOR,
            SOURCE.TEMP_SUPPLY_TARGET,
            SOURCE.COMP_FREQUENCY,
            SOURCE.ELECTRICAL_TOTAL
        ];

        const missingSources = importantSources.filter(function (sourceId) {
            return !existsState(sourceId);
        });

        const result = {
            ok: missingTargets.length === 0,
            targetCount: targetStates.length,
            missingTargets: missingTargets,
            missingImportantSources: missingSources
        };

        if (missingTargets.length > 0) {
            write('System.Status', 'SELFTEST_FEHLER');
            write('Overview.Message', 'Fehlende Ziel-States: ' + missingTargets.join(', '));
            return result;
        }

        if (missingSources.length > 0) {
            write('System.Status', 'BEREIT_EINGESCHRÄNKT');
            write('Overview.Message', 'SelfTest OK, wichtige Quellen fehlen: ' + missingSources.join(', '));
            return result;
        }

        write('System.Status', 'BEREIT');
        write('Overview.Message', 'DashboardData SelfTest erfolgreich');
        return result;
    }

    function normalizeMode(modeText, stateText, defrostActive) {
        if (defrostActive === true) return 'DEFROST';

        const text = (String(modeText || '') + ' ' + String(stateText || '')).toLowerCase();

        if (text.includes('warm') || text.includes('brauch')) return 'WARMWATER';
        if (text.includes('heiz')) return 'HEATING';
        if (text.includes('kühl') || text.includes('kuehl') || text.includes('cool')) return 'COOLING';
        if (text.includes('standby') || text.includes('bereit')) return 'STANDBY';
        if (text.includes('aus') || text.includes('off') || text.includes('stopp')) return 'OFF';

        return 'UNKNOWN';
    }

    function modeLabel(key) {
        return {
            HEATING: 'Heizung',
            WARMWATER: 'Warmwasser',
            STANDBY: 'Standby',
            DEFROST: 'Abtauen',
            COOLING: 'Kühlen',
            OFF: 'Aus',
            UNKNOWN: 'Unbekannt'
        }[key] || 'Unbekannt';
    }

    function modeIcon(key) {
        return {
            HEATING: 'mdi:radiator',
            WARMWATER: 'mdi:water-boiler',
            STANDBY: 'mdi:power-standby',
            DEFROST: 'mdi:snowflake-melt',
            COOLING: 'mdi:snowflake',
            OFF: 'mdi:power',
            UNKNOWN: 'mdi:help-circle-outline'
        }[key] || 'mdi:help-circle-outline';
    }

    function qualityFromValidity(valid, age, warningText) {
        if (valid !== true) {
            return {
                label: 'Keine gültigen Daten',
                color: CONFIG.QUALITY_COLORS.INVALID
            };
        }

        if (age !== null && age > CONFIG.MAX_DATA_AGE_SECONDS) {
            return {
                label: 'Daten veraltet',
                color: CONFIG.QUALITY_COLORS.WARNING
            };
        }

        if (warningText) {
            return {
                label: 'Hinweis vorhanden',
                color: CONFIG.QUALITY_COLORS.MEDIUM
            };
        }

        return {
            label: 'Daten plausibel',
            color: CONFIG.QUALITY_COLORS.GOOD
        };
    }

    function qualityColorForScore(score, valid) {
        if (valid !== true || !Number.isFinite(score)) return CONFIG.QUALITY_COLORS.INVALID;
        if (score >= 95) return CONFIG.QUALITY_COLORS.EXCELLENT;
        if (score >= 85) return CONFIG.QUALITY_COLORS.GOOD;
        if (score >= 70) return CONFIG.QUALITY_COLORS.MEDIUM;
        if (score >= 50) return CONFIG.QUALITY_COLORS.WARNING;
        return CONFIG.QUALITY_COLORS.CRITICAL;
    }

    function collectTemperatures() {
        const age = ageSeconds(SOURCE.TEMP_LAST_UPDATE);
        const valid = readBoolean(SOURCE.TEMP_VALID);
        const warningText = readText(SOURCE.TEMP_WARNING, '');
        const quality = qualityFromValidity(valid, age, warningText);
        const supply = readNumber(SOURCE.TEMP_SUPPLY, 1);
        const supplyTarget = readNumber(SOURCE.TEMP_SUPPLY_TARGET, 1);
        const supplyDeviation = (
            Number.isFinite(supply) &&
            Number.isFinite(supplyTarget)
        )
            ? round(supply - supplyTarget, 1)
            : null;

        return {
            outdoor: readNumber(SOURCE.TEMP_OUTDOOR, 1),
            supplyTarget: supplyTarget,
            supply: supply,
            supplyDeviation: supplyDeviation,
            return: readNumber(SOURCE.TEMP_RETURN, 1),
            deltaT: readNumber(SOURCE.TEMP_SPREAD, 1),
            meanHeatingWater: readNumber(SOURCE.TEMP_MEAN, 1),
            temperatureLift: readNumber(SOURCE.TEMP_LIFT, 1),
            warmwater: readNumber(SOURCE.TEMP_WARMWATER, 1),
            warmwaterCharging: readNumber(SOURCE.TEMP_WARMWATER_CHARGING, 1),
            flow: readNumber(SOURCE.FLOW, 1),
            valid: valid === true,
            quality: quality.label,
            qualityColor: quality.color,
            warning: warningText,
            updateAgeSeconds: age
        };
    }

    function collectCompressor() {
        return {
            active: readBoolean(SOURCE.COMP_RUNNING) === true,
            mode: readText(SOURCE.MODE, ''),
            frequency: readNumber(SOURCE.COMP_FREQUENCY, 1),
            starts: readNumber(SOURCE.COMP_STARTS, 0),
            runtime: (function () {
                const hours = readNumber(SOURCE.COMP_RUNTIME);
                return hours === null ? null : round(hours * 60, 1);
            })(),
            currentCycleRuntime: readNumber(SOURCE.CURRENT_RUNTIME, 0),
            state: readText(SOURCE.STATE, ''),
            status: readText(SOURCE.COMP_STATUS, ''),
            valid: readBoolean(SOURCE.COMP_VALID) === true,
            warning: readText(SOURCE.COMP_WARNING, ''),
            updateAgeSeconds: ageSeconds(SOURCE.COMP_LAST_UPDATE)
        };
    }

    function localDayKey(date) {
        const value = date instanceof Date ? date : new Date();
        function pad(number) {
            return String(number).padStart(2, '0');
        }
        return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
    }

    function targetNumber(path, fallback) {
        const state = readStateObject(id(path));
        if (!state || state.val === null || state.val === undefined || state.val === '') return fallback;
        const value = Number(state.val);
        return Number.isFinite(value) ? value : fallback;
    }

    function targetText(path, fallback) {
        const state = readStateObject(id(path));
        if (!state || state.val === null || state.val === undefined) return fallback;
        return String(state.val);
    }

    function targetBoolean(path, fallback) {
        const state = readStateObject(id(path));
        if (!state || state.val === null || state.val === undefined) return fallback;
        return state.val === true || state.val === 1 || state.val === '1' || state.val === 'true';
    }

    function updateDailyFrequencyAverage(compressor) {
        const now = Date.now();
        const today = localDayKey(new Date(now));

        let storedDay = targetText('Compressor.InternalFrequencyDay', '');
        let weighted = targetNumber('Compressor.InternalFrequencyWeightedHzSeconds', 0);
        let runningSeconds = targetNumber('Compressor.InternalFrequencyRunningSeconds', 0);
        let lastTimestamp = targetNumber('Compressor.InternalFrequencyLastTimestamp', 0);
        let lastFrequency = targetNumber('Compressor.InternalFrequencyLastValue', 0);
        let lastActive = targetBoolean('Compressor.InternalFrequencyLastActive', false);

        const currentFrequency = Number.isFinite(compressor.frequency)
            ? compressor.frequency
            : 0;

        const currentDataFresh =
            compressor.valid === true &&
            Number.isFinite(compressor.updateAgeSeconds) &&
            compressor.updateAgeSeconds <= CONFIG.MAX_DATA_AGE_SECONDS;

        const currentActive =
            compressor.active === true &&
            currentFrequency > 0 &&
            currentDataFresh;

        if (storedDay !== today) {
            storedDay = today;
            weighted = 0;
            runningSeconds = 0;
            lastTimestamp = now;
        } else if (lastTimestamp > 0 && now > lastTimestamp) {
            const elapsedSeconds = (now - lastTimestamp) / 1000;

            if (
                elapsedSeconds <= CONFIG.COMP_FREQ_MAX_INTEGRATION_GAP_SECONDS &&
                lastActive &&
                lastFrequency > 0
            ) {
                weighted += lastFrequency * elapsedSeconds;
                runningSeconds += elapsedSeconds;
            }
        }

        write('Compressor.InternalFrequencyDay', storedDay);
        write('Compressor.InternalFrequencyWeightedHzSeconds', round(weighted, 1));
        write('Compressor.InternalFrequencyRunningSeconds', round(runningSeconds, 1));
        write('Compressor.InternalFrequencyLastTimestamp', now);
        write('Compressor.InternalFrequencyLastValue', currentFrequency);
        write('Compressor.InternalFrequencyLastActive', currentActive);

        return runningSeconds > 0 ? round(weighted / runningSeconds, 1) : null;
    }

    function collectCompressorDay(compressor) {
        const startsToday = readNumber(SOURCE.STAT_DAY_COMP_STARTS, 0);
        const runtimeToday = readNumber(SOURCE.STAT_DAY_COMP_RUNTIME, 1);
        const averageFrequencyToday = updateDailyFrequencyAverage(compressor);

        return {
            startsToday: Number.isFinite(startsToday) ? startsToday : 0,
            runtimeToday: Number.isFinite(runtimeToday) ? runtimeToday : 0,
            averageCycleDurationToday:
                Number.isFinite(startsToday) && startsToday > 0 && Number.isFinite(runtimeToday)
                    ? round(runtimeToday / startsToday, 1)
                    : 0,
            averageFrequencyToday: Number.isFinite(averageFrequencyToday)
                ? averageFrequencyToday
                : 0
        };
    }

    function collectCompressorHistory() {
        return {
            startsPerDay: readNumber(SOURCE.STAT_SAVE_DAY_COMP_STARTS, 0),
            runtimePerDay: readNumber(SOURCE.STAT_SAVE_DAY_COMP_RUNTIME, 1)
        };
    }

    function collectEnergyHistory() {
        const electricZHHeating = readNumber(SOURCE.STAT_SAVE_DAY_ELECTRIC_ZH_HEATING, 3);
        const electricZHWarmwater = readNumber(SOURCE.STAT_SAVE_DAY_ELECTRIC_ZH_WARMWATER, 3);

        const heatHeating = readNumber(SOURCE.STAT_SAVE_DAY_HEAT_HEATING, 3);
        const heatWarmwater = readNumber(SOURCE.STAT_SAVE_DAY_HEAT_WARMWATER, 3);
        const heatHeatingCompressor = readNumber(SOURCE.STAT_SAVE_DAY_HEAT_HEATING_COMP, 3);
        const heatWarmwaterCompressor = readNumber(SOURCE.STAT_SAVE_DAY_HEAT_WARMWATER_COMP, 3);

        const heatZHHeating = (
            Number.isFinite(heatHeating) &&
            Number.isFinite(heatHeatingCompressor)
        ) ? Math.max(0, heatHeating - heatHeatingCompressor) : null;

        const heatZHWarmwater = (
            Number.isFinite(heatWarmwater) &&
            Number.isFinite(heatWarmwaterCompressor)
        ) ? Math.max(0, heatWarmwater - heatWarmwaterCompressor) : null;

        return {
            electricTotalPerDay: readNumber(SOURCE.STAT_SAVE_DAY_ELECTRIC_TOTAL, 3),
            electricHeatingPerDay: readNumber(SOURCE.STAT_SAVE_DAY_ELECTRIC_HEATING, 3),
            electricWarmwaterPerDay: readNumber(SOURCE.STAT_SAVE_DAY_ELECTRIC_WARMWATER, 3),
            electricZHPerDay: (
                Number.isFinite(electricZHHeating) &&
                Number.isFinite(electricZHWarmwater)
            ) ? round(electricZHHeating + electricZHWarmwater, 3) : null,
            heatTotalPerDay: readNumber(SOURCE.STAT_SAVE_DAY_HEAT_TOTAL, 3),
            heatHeatingPerDay: heatHeating,
            heatWarmwaterPerDay: heatWarmwater,
            heatZHPerDay: (
                Number.isFinite(heatZHHeating) &&
                Number.isFinite(heatZHWarmwater)
            ) ? round(heatZHHeating + heatZHWarmwater, 3) : null
        };
    }

    function collectAdditionalHeat() {
        const power = readNumber(SOURCE.AUX_POWER, 3);
        const mode = readNumber(SOURCE.AUX_MODE, 0);

        return {
            active: Number.isFinite(power) ? power > 0 : false,
            power: power,
            mode: mode
        };
    }

    function collectEnergy() {
        const energyValid = readBoolean(SOURCE.ENERGY_VALID);
        const heatValid = readBoolean(SOURCE.HEAT_VALID);
        return {
            electricTotal: readNumber(SOURCE.ELECTRIC_TOTAL, 3),
            electricHeating: readNumber(SOURCE.ELECTRIC_HEATING, 3),
            electricWarmwater: readNumber(SOURCE.ELECTRIC_WARMWATER, 3),
            electricStandby: readNumber(SOURCE.ELECTRIC_STANDBY, 3),
            electricCooling: readNumber(SOURCE.ELECTRIC_COOLING, 3),
            electricPool: readNumber(SOURCE.ELECTRIC_POOL, 3),
            electricUnknown: readNumber(SOURCE.ELECTRIC_UNKNOWN, 3),
            electricAllocated: readNumber(SOURCE.ELECTRIC_ALLOCATED, 3),
            heatHeatingCompressor: readNumber(SOURCE.HEAT_HEATING_COMP, 3),
            heatHeatingTotal: readNumber(SOURCE.HEAT_HEATING_TOTAL, 3),
            heatWarmwaterCompressor: readNumber(SOURCE.HEAT_WW_COMP, 3),
            heatWarmwaterTotal: readNumber(SOURCE.HEAT_WW_TOTAL, 3),
            heatTotal: (function () {
                const heating = readNumber(SOURCE.HEAT_HEATING_TOTAL, 3);
                const warmwater = readNumber(SOURCE.HEAT_WW_TOTAL, 3);
                return Number.isFinite(heating) && Number.isFinite(warmwater)
                    ? round(heating + warmwater, 3)
                    : null;
            })(),
            valid: energyValid === true && heatValid === true,
            warning: readText(SOURCE.ENERGY_WARNING, ''),
            updateAgeSeconds: ageSeconds(SOURCE.ENERGY_LAST_UPDATE)
        };
    }

    function electricalOffsetColor(status, valid) {
        if (valid !== true) return CONFIG.QUALITY_COLORS.INVALID;

        const normalized = String(status || '').trim().toUpperCase();
        if (normalized === 'OK') return CONFIG.QUALITY_COLORS.GOOD;
        if (normalized === 'WARNUNG') return CONFIG.QUALITY_COLORS.WARNING;
        if (normalized === 'KRITISCH') return CONFIG.QUALITY_COLORS.CRITICAL;
        return CONFIG.QUALITY_COLORS.INVALID;
    }

    function collectElectrical() {
        const valid = readBoolean(SOURCE.ELECTRICAL_VALID) === true;
        const offsetStatus = readText(SOURCE.ELECTRICAL_OFFSET_STATUS, '');

        return {
            totalEnergy: readNumber(SOURCE.ELECTRICAL_TOTAL, 3),
            estimatedEnergy: readNumber(SOURCE.ELECTRICAL_ESTIMATED, 3),
            currentPower: readNumber(SOURCE.ELECTRICAL_POWER, 1),
            nibeCounter: readNumber(SOURCE.ELECTRICAL_NIBE_COUNTER, 3),
            integratedEnergy: readNumber(SOURCE.ELECTRICAL_INTEGRATED_ENERGY, 6),
            offset: readNumber(SOURCE.ELECTRICAL_OFFSET, 6),
            maxOffset: readNumber(SOURCE.ELECTRICAL_MAX_OFFSET, 6),
            correctionDelta: readNumber(SOURCE.ELECTRICAL_CORRECTION_DELTA, 6),
            offsetStatus: offsetStatus,
            offsetColor: electricalOffsetColor(offsetStatus, valid),
            valid: valid,
            status: readText(SOURCE.ELECTRICAL_STATUS, ''),
            lastPowerUpdate: localIso(readText(SOURCE.ELECTRICAL_LAST_POWER_UPDATE, '')),
            lastCounterUpdate: localIso(readText(SOURCE.ELECTRICAL_LAST_COUNTER_UPDATE, '')),
            lastIntegration: localIso(readText(SOURCE.ELECTRICAL_LAST_INTEGRATION, '')),
            lastUpdate: localIso(readText(SOURCE.ELECTRICAL_LAST_UPDATE, ''))
        };
    }

    function collectDayStatistics() {
        const sourceIds = [
            SOURCE.STAT_DAY_ELECTRIC_TOTAL,
            SOURCE.STAT_DAY_ELECTRIC_HEATING,
            SOURCE.STAT_DAY_ELECTRIC_WARMWATER,
            SOURCE.STAT_DAY_HEAT_HEATING,
            SOURCE.STAT_DAY_HEAT_WARMWATER,
            SOURCE.STAT_DAY_HEAT_HEATING_COMP,
            SOURCE.STAT_DAY_HEAT_WARMWATER_COMP
        ];

        const available = sourceIds.every(function (sourceId) {
            return existsState(sourceId);
        });

        return {
            electricTotal: readNumber(SOURCE.STAT_DAY_ELECTRIC_TOTAL, 3),
            electricHeating: readNumber(SOURCE.STAT_DAY_ELECTRIC_HEATING, 3),
            electricWarmwater: readNumber(SOURCE.STAT_DAY_ELECTRIC_WARMWATER, 3),
            heatHeating: readNumber(SOURCE.STAT_DAY_HEAT_HEATING, 3),
            heatWarmwater: readNumber(SOURCE.STAT_DAY_HEAT_WARMWATER, 3),
            heatHeatingCompressor: readNumber(SOURCE.STAT_DAY_HEAT_HEATING_COMP, 3),
            heatWarmwaterCompressor: readNumber(SOURCE.STAT_DAY_HEAT_WARMWATER_COMP, 3),
            available: available
        };
    }

    function collectYearStatistics() {
        const sourceIds = [
            SOURCE.STAT_YEAR_ELECTRIC_TOTAL,
            SOURCE.STAT_YEAR_ELECTRIC_HEATING,
            SOURCE.STAT_YEAR_ELECTRIC_WARMWATER,
            SOURCE.STAT_YEAR_HEAT_HEATING,
            SOURCE.STAT_YEAR_HEAT_WARMWATER,
            SOURCE.STAT_YEAR_HEAT_HEATING_COMP,
            SOURCE.STAT_YEAR_HEAT_WARMWATER_COMP
        ];

        const available = sourceIds.every(function (sourceId) {
            return existsState(sourceId);
        });

        return {
            electricTotal: readNumber(SOURCE.STAT_YEAR_ELECTRIC_TOTAL, 3),
            electricHeating: readNumber(SOURCE.STAT_YEAR_ELECTRIC_HEATING, 3),
            electricWarmwater: readNumber(SOURCE.STAT_YEAR_ELECTRIC_WARMWATER, 3),
            heatHeating: readNumber(SOURCE.STAT_YEAR_HEAT_HEATING, 3),
            heatWarmwater: readNumber(SOURCE.STAT_YEAR_HEAT_WARMWATER, 3),
            heatHeatingCompressor: readNumber(SOURCE.STAT_YEAR_HEAT_HEATING_COMP, 3),
            heatWarmwaterCompressor: readNumber(SOURCE.STAT_YEAR_HEAT_WARMWATER_COMP, 3),
            available: available
        };
    }

    function statisticsSourceId(area, scope, suffix) {
        return 'statistics.0.' + scope + '.sumDelta.' + area.source + '.' + suffix;
    }

    function readElectricityPrice() {
        const configured = readNumber(id('Configuration.ElectricityPrice'));
        return Number.isFinite(configured) && configured >= 0
            ? configured
            : CONFIG.DEFAULT_ELECTRICITY_PRICE_EUR_PER_KWH;
    }

    function collectStatisticsArea(area, electricityPrice) {
        const rows = STATISTICS_PERIODS.map(function (period) {
            const value = readNumber(statisticsSourceId(area, period.scope, period.suffix), 3);
            const normalized = Number.isFinite(value) ? value : 0;
            return {
                Zeitraum: period.label,
                Wert: normalized,
                Einheit: area.unit || '',
                Kosten: area.costs ? round(normalized * electricityPrice, 2) : null
            };
        });

        return {
            json: JSON.stringify(rows),
            yesterday: readNumber(statisticsSourceId(area, 'save', 'day'), 3),
            lastMonth: readNumber(statisticsSourceId(area, 'save', 'month'), 3),
            lastYear: readNumber(statisticsSourceId(area, 'save', 'year'), 3)
        };
    }

    function periodDelta(source, scope, suffix) {
        return readNumber('statistics.0.' + scope + '.sumDelta.' + source + '.' + suffix, 6);
    }

    function safeDifference(total, part) {
        if (!Number.isFinite(total) || !Number.isFinite(part)) return 0;
        return round(Math.max(0, total - part), 3);
    }

    function safeShare(part, total) {
        if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0.001) return 0;
        return round(Math.max(0, Math.min(100, part / total * 100)), 2);
    }

    function derivedPeriodValue(key, scope, suffix) {
        const electricTotal = periodDelta(CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Gesamt', scope, suffix);
        const electricHeating = periodDelta(CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Heating', scope, suffix);
        const electricWarmwater = periodDelta(CONFIG.NPS_ROOT + '.EnergyAllocation.Meters.Warmwater', scope, suffix);
        const heatingTotal = periodDelta(CONFIG.NPS_ROOT + '.VirtualMeters.Heizung.InklusiveZusatzheizung', scope, suffix);
        const heatingCompressor = periodDelta(CONFIG.NPS_ROOT + '.VirtualMeters.Heizung.NurVerdichter', scope, suffix);
        const warmwaterTotal = periodDelta(CONFIG.NPS_ROOT + '.VirtualMeters.Brauchwasser.InklusiveZusatzheizung', scope, suffix);
        const warmwaterCompressor = periodDelta(CONFIG.NPS_ROOT + '.VirtualMeters.Brauchwasser.NurVerdichter', scope, suffix);

        const totalHeat = (Number.isFinite(heatingTotal) ? heatingTotal : 0) +
            (Number.isFinite(warmwaterTotal) ? warmwaterTotal : 0);
        const compressorHeat = (Number.isFinite(heatingCompressor) ? heatingCompressor : 0) +
            (Number.isFinite(warmwaterCompressor) ? warmwaterCompressor : 0);
        const heatingZH = safeDifference(heatingTotal, heatingCompressor);
        const warmwaterZH = safeDifference(warmwaterTotal, warmwaterCompressor);
        const totalZH = round(heatingZH + warmwaterZH, 3);

        switch (key) {
            case 'WaermeHeizungZusatzheizung': return heatingZH;
            case 'WaermeWarmwasserZusatzheizung': return warmwaterZH;
            case 'WaermeGesamtZusatzheizung': return totalZH;
            case 'COPGesamt': return calculateCop(totalHeat, electricTotal);
            case 'COPHeizung': return calculateCop(heatingTotal, electricHeating);
            case 'COPWarmwasser': return calculateCop(warmwaterTotal, electricWarmwater);
            case 'COPVerdichterGesamt': return calculateCop(compressorHeat, electricTotal);
            case 'AnteilVerdichter': return safeShare(compressorHeat, totalHeat);
            case 'AnteilZusatzheizung': return safeShare(totalZH, totalHeat);
            default: return 0;
        }
    }

    function collectDerivedStatisticsArea(area) {
        const rows = STATISTICS_PERIODS.map(function (period) {
            return {
                Zeitraum: period.label,
                Wert: derivedPeriodValue(area.key, period.scope, period.suffix),
                Einheit: area.unit || '',
                Kosten: null
            };
        });

        return {
            json: JSON.stringify(rows),
            yesterday: derivedPeriodValue(area.key, 'save', 'day'),
            lastMonth: derivedPeriodValue(area.key, 'save', 'month'),
            lastYear: derivedPeriodValue(area.key, 'save', 'year')
        };
    }

    function formatEnergyPeriodComparisonValue(value) {
        const number = Number(value);
        const normalized = Number.isFinite(number) ? number : 0;
        return round(normalized, 1).toFixed(1).replace('.', ',');
    }

    function buildEnergyPeriodComparisonJson() {
        const rows = STATISTICS_PERIODS.map(function (period) {
            const electricTotal = periodDelta(
                CONFIG.NPS_ROOT + '.ElectricalMeters.Aktuell.Gesamt',
                period.scope,
                period.suffix
            );
            const heatHeating = periodDelta(
                CONFIG.NPS_ROOT + '.VirtualMeters.Heizung.InklusiveZusatzheizung',
                period.scope,
                period.suffix
            );
            const heatWarmwater = periodDelta(
                CONFIG.NPS_ROOT + '.VirtualMeters.Brauchwasser.InklusiveZusatzheizung',
                period.scope,
                period.suffix
            );

            const heatTotal = (
                Number.isFinite(heatHeating) || Number.isFinite(heatWarmwater)
            )
                ? (
                    (Number.isFinite(heatHeating) ? heatHeating : 0) +
                    (Number.isFinite(heatWarmwater) ? heatWarmwater : 0)
                )
                : 0;

            return {
                Zeitraum: period.label,
                'Strom gesamt': formatEnergyPeriodComparisonValue(electricTotal),
                'Wärme gesamt': formatEnergyPeriodComparisonValue(heatTotal),
                'Wärme Heizung': formatEnergyPeriodComparisonValue(heatHeating),
                'Wärme Warmwasser': formatEnergyPeriodComparisonValue(heatWarmwater)
            };
        });

        return JSON.stringify(rows);
    }

    function formatPerformanceComparisonValue(metricKey, value) {
        const number = Number(value);
        const normalized = Number.isFinite(number) ? number : 0;

        if (
            metricKey === 'COPGesamt' ||
            metricKey === 'COPHeizung' ||
            metricKey === 'COPWarmwasser'
        ) {
            return round(normalized, 1).toFixed(1).replace('.', ',');
        }

        if (
            metricKey === 'AnteilVerdichter' ||
            metricKey === 'AnteilZusatzheizung'
        ) {
            return Math.round(normalized);
        }

        return normalized;
    }

    function buildPerformancePeriodComparisonJson() {
        const comparisonPeriods = [
            { key: 'Heute', scope: 'temp', suffix: 'day' },
            { key: 'Gestern', scope: 'save', suffix: 'day' },
            { key: 'Woche', scope: 'temp', suffix: 'week' },
            { key: 'Monat', scope: 'temp', suffix: 'month' },
            { key: 'Jahr', scope: 'temp', suffix: 'year' }
        ];

        const metrics = [
            { label: 'COP gesamt', key: 'COPGesamt', unit: '' },
            { label: 'COP Heizung', key: 'COPHeizung', unit: '' },
            { label: 'COP Warmwasser', key: 'COPWarmwasser', unit: '' },
            { label: 'Verdichteranteil', key: 'AnteilVerdichter', unit: '%' },
            { label: 'Zusatzheizungsanteil', key: 'AnteilZusatzheizung', unit: '%' }
        ];

        const rows = metrics.map(function (metric) {
            const row = {
                Kennzahl: metric.label,
                Einheit: metric.unit
            };

            comparisonPeriods.forEach(function (period) {
                row[period.key] = formatPerformanceComparisonValue(
                    metric.key,
                    derivedPeriodValue(
                        metric.key,
                        period.scope,
                        period.suffix
                    )
                );
            });

            return row;
        });

        return JSON.stringify(rows);
    }

    function updateStatisticsOutputs() {
        const electricityPrice = readElectricityPrice();

        STATISTICS_AREAS.forEach(function (area) {
            const values = collectStatisticsArea(area, electricityPrice);
            const prefix = 'Statistics.' + area.key;
            write(prefix + '.Json', values.json);
            write(prefix + '.Yesterday', values.yesterday);
            write(prefix + '.LastMonth', values.lastMonth);
            write(prefix + '.LastYear', values.lastYear);
        });

        DERIVED_STATISTICS_AREAS.forEach(function (area) {
            const values = collectDerivedStatisticsArea(area);
            const prefix = 'Statistics.' + area.key;
            write(prefix + '.Json', values.json);
            write(prefix + '.Yesterday', values.yesterday);
            write(prefix + '.LastMonth', values.lastMonth);
            write(prefix + '.LastYear', values.lastYear);
        });

        write(
            'Performance.PeriodComparisonJson',
            buildPerformancePeriodComparisonJson()
        );
    }

    function collectCycle() {
        const report = parseJson(readText(SOURCE.CYCLE_REPORT_JSON, ''));
        const reportCop = firstNumber([
            getPath(report, 'energy.cop'),
            getPath(report, 'analysis.energy.cop')
        ]);
        const reportElectric = firstNumber([
            getPath(report, 'energy.electricKWh'),
            getPath(report, 'analysis.energy.electricKWh')
        ]);
        const reportHeat = firstNumber([
            getPath(report, 'energy.heatKWh'),
            getPath(report, 'analysis.energy.heatKWh')
        ]);
        const reportQuality = firstNumber([
            getPath(report, 'quality.score'),
            getPath(report, 'analysis.quality.score')
        ]);

        const valid = readBoolean(SOURCE.CYCLE_VALID) === true;
        const quality = firstNumber([readNumber(SOURCE.CYCLE_QUALITY, 1), reportQuality]);
        const cop = firstNumber([readNumber(SOURCE.CYCLE_COP, 2), reportCop]);
        const electric = firstNumber([readNumber(SOURCE.CYCLE_ELECTRIC, 3), reportElectric]);
        const heat = firstNumber([readNumber(SOURCE.CYCLE_HEAT, 3), reportHeat]);

        return {
            active: readBoolean(SOURCE.RECORDING_ACTIVE) === true,
            activeType: readText(SOURCE.RECORDING_TYPE, ''),
            activeRunId: readText(SOURCE.RECORDING_RUN_ID, ''),
            currentDurationMinutes: readNumber(SOURCE.CYCLE_CURRENT_DURATION, 1),
            lastId: readText(SOURCE.CYCLE_ID, getPath(report, 'analysis.id') || ''),
            lastType: readText(SOURCE.CYCLE_TYPE, getPath(report, 'analysis.type') || ''),
            lastTypeCode: readNumber(SOURCE.CYCLE_TYPE_CODE, 0),
            lastStart: localIso(readText(SOURCE.CYCLE_START, getPath(report, 'analysis.start') || '')),
            lastEnd: localIso(readText(SOURCE.CYCLE_END, getPath(report, 'analysis.end') || '')),
            lastDurationMinutes: (function () {
                const seconds = firstNumber([
                    readNumber(SOURCE.CYCLE_DURATION),
                    getPath(report, 'analysis.durationSeconds')
                ]);
                return seconds === null ? null : round(seconds / 60, 1);
            })(),
            lastCOP: cop === null ? null : round(cop, 1),
            lastElectricEnergy: electric,
            lastHeatEnergy: heat,
            lastQuality: quality,
            lastQualityRating: readText(SOURCE.CYCLE_RATING, getPath(report, 'quality.rating') || ''),
            lastQualityColor: qualityColorForScore(quality, valid),
            warning: readText(SOURCE.CYCLE_WARNING, getPath(report, 'quality.warning') || ''),
            valid: valid
        };
    }


    function formatCycleHistoryStart(value) {
        const date = parseDateValue(value);
        if (!date) return '';

        function pad(number) {
            return String(number).padStart(2, '0');
        }

        return (
            pad(date.getDate()) + '.' +
            pad(date.getMonth() + 1) + '.' +
            date.getFullYear() + ' ' +
            pad(date.getHours()) + ':' +
            pad(date.getMinutes())
        );
    }

    function normalizeCycleHistoryType(value) {
        const text = String(value || '').trim().toLowerCase();

        if (text.includes('heiz') || text === 'heating') return 'Heizung';
        if (
            text.includes('warmwasser') ||
            text.includes('brauchwasser') ||
            text === 'warmwater'
        ) {
            return 'Warmwasser';
        }

        return value ? String(value) : 'Unbekannt';
    }

    function readCycleHistory() {
        const state = readStateObject(id('Cycles.History'));
        if (!state || state.val === null || state.val === undefined || state.val === '') {
            return [];
        }

        try {
            const parsed = JSON.parse(String(state.val));
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            warn('Cycles.History enthält ungültiges JSON und wird neu aufgebaut.');
            return [];
        }
    }

    function updateCycleHistory(cycles) {
        if (
            !cycles ||
            cycles.valid !== true ||
            !cycles.lastId ||
            !cycles.lastStart ||
            !cycles.lastEnd
        ) {
            return;
        }

        const entry = {
            Start: formatCycleHistoryStart(cycles.lastStart),
            Typ: normalizeCycleHistoryType(cycles.lastType),
            Dauer: Number.isFinite(cycles.lastDurationMinutes)
                ? Math.round(cycles.lastDurationMinutes)
                : null,
            COP: Number.isFinite(cycles.lastCOP)
                ? round(cycles.lastCOP, 1)
                : null,
            'Wärme': Number.isFinite(cycles.lastHeatEnergy)
                ? round(cycles.lastHeatEnergy, 1)
                : null,
            Strom: Number.isFinite(cycles.lastElectricEnergy)
                ? round(cycles.lastElectricEnergy, 1)
                : null,
            'Qualität': Number.isFinite(cycles.lastQuality)
                ? Math.round(cycles.lastQuality)
                : null
        };

        if (!entry.Start) return;

        const history = readCycleHistory();

        // DashboardData wird auch durch andere Quellen und den 5-Minuten-Watchdog
        // aktualisiert. Deshalb einen bereits vorhandenen Zyklus ersetzen,
        // statt ihn erneut anzulegen.
        const duplicateIndex = history.findIndex(function (item) {
            return (
                item &&
                item.Start === entry.Start &&
                item.Typ === entry.Typ &&
                item.Dauer === entry.Dauer
            );
        });

        if (duplicateIndex >= 0) {
            history.splice(duplicateIndex, 1);
        }

        history.unshift(entry);

        if (history.length > CONFIG.CYCLE_HISTORY_LIMIT) {
            history.length = CONFIG.CYCLE_HISTORY_LIMIT;
        }

        write('Cycles.History', JSON.stringify(history));
    }

    function collectDefrost() {
        return {
            active: readBoolean(SOURCE.DEFROST_ACTIVE) === true,
            status: readNumber(SOURCE.DEFROST_STATUS, 0),
            count: readNumber(SOURCE.DEFROST_COUNT, 0),
            currentDurationMinutes: readNumber(SOURCE.DEFROST_CURRENT_DURATION, 1),
            lastDurationMinutes: readNumber(SOURCE.DEFROST_LAST_DURATION, 1),
            totalDurationMinutes: readNumber(SOURCE.DEFROST_TOTAL_DURATION, 1),
            lastStart: localIso(readText(SOURCE.DEFROST_LAST_START, '')),
            lastEnd: localIso(readText(SOURCE.DEFROST_LAST_END, '')),
            valid: readBoolean(SOURCE.DEFROST_VALID) === true,
            warning: readText(SOURCE.DEFROST_WARNING, ''),
            updateAgeSeconds: ageSeconds(SOURCE.DEFROST_LAST_UPDATE)
        };
    }

    function collectEvents() {
        const sequence = readNumber(SOURCE.EVENT_SEQUENCE, 0);
        const type = readText(SOURCE.EVENT_TYPE, '');
        const title = readText(SOURCE.EVENT_TITLE, '');
        const timestamp = localIso(readText(SOURCE.EVENT_TIMESTAMP, ''));

        return {
            sequence: sequence,
            lastId: readText(SOURCE.EVENT_ID, ''),
            lastType: type,
            lastTitle: title,
            lastMessage: readText(SOURCE.EVENT_MESSAGE, ''),
            lastCriticality: readText(SOURCE.EVENT_CRITICALITY, ''),
            lastTimestamp: timestamp,
            operatingMode: readText(SOURCE.EVENT_MODE, ''),
            runtimeSeconds: readNumber(SOURCE.EVENT_RUNTIME, 0),
            valid: sequence !== null && (type !== '' || title !== '' || timestamp !== '')
        };
    }

    function formatEventHistoryTimestamp(value) {
        const date = parseDateValue(value);
        if (!date) return '';

        function pad(number) {
            return String(number).padStart(2, '0');
        }

        return (
            pad(date.getDate()) + '.' +
            pad(date.getMonth() + 1) + '.' +
            date.getFullYear() + ' ' +
            pad(date.getHours()) + ':' +
            pad(date.getMinutes())
        );
    }

    function normalizeEventCategory(events) {
        const type = String(events.lastType || '').toUpperCase();
        const mode = String(events.operatingMode || '').toLowerCase();

        if (type.includes('ABTAU')) return 'Abtauung';
        if (type.includes('STOERUNG') || type.includes('STÖRUNG')) return 'Störung';
        if (mode.includes('warm') || mode.includes('brauch')) return 'Warmwasser';
        if (mode.includes('heiz')) return 'Heizung';
        if (mode.includes('kühl') || mode.includes('kuehl') || mode.includes('cool')) return 'Kühlung';
        if (mode.includes('pool')) return 'Pool';
        if (mode.includes('standby') || mode.includes('bereit')) return 'Standby';
        if (type.includes('WARMWASSER') || type.includes('BRAUCHWASSER')) return 'Warmwasser';
        if (type.includes('HEIZ')) return 'Heizung';
        if (type.includes('KUEHL') || type.includes('KÜHL')) return 'Kühlung';
        if (type.includes('POOL')) return 'Pool';
        return 'Verdichter';
    }

    function normalizeEventStatus(level) {
        const text = String(level || '').trim().toLowerCase();
        if (text === 'success' || text === 'ok') return 'OK';
        if (text === 'warning' || text === 'warn') return 'Warnung';
        if (text === 'error' || text === 'critical' || text === 'fatal') return 'Fehler';
        if (text === 'info') return 'Info';
        return level ? String(level) : 'Info';
    }

    function eventDetails(events) {
        let details = String(events.lastMessage || '');
        if (
            String(events.lastType || '').toUpperCase() === 'VERDICHTER_GESTOPPT' &&
            Number.isFinite(events.runtimeSeconds) &&
            events.runtimeSeconds > 0
        ) {
            details += (details ? ' · ' : '') + Math.round(events.runtimeSeconds / 60) + ' min';
        }
        return details;
    }

    function readEventHistory() {
        const state = readStateObject(id('Events.History'));
        if (!state || state.val === null || state.val === undefined || state.val === '') return [];

        try {
            const parsed = JSON.parse(String(state.val));
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            warn('Events.History enthält ungültiges JSON und wird neu aufgebaut.');
            return [];
        }
    }

    function resetEventTodayIfNeeded() {
        const today = localDayKey(new Date());
        const stored = targetText('Events.Today.Date', '');

        if (stored === today) return;

        write('Events.Today.Date', today);
        write('Events.Today.HeatingCycles', 0);
        write('Events.Today.WarmwaterCycles', 0);
        write('Events.Today.Defrosts', 0);
        write('Events.Today.Warnings', 0);
        write('Events.Today.Errors', 0);
    }

    function incrementEventToday(path) {
        write(path, targetNumber(path, 0) + 1);
    }

    function updateEventTodayCounters(events) {
        const type = String(events.lastType || '').toUpperCase();
        const level = String(events.lastCriticality || '').toLowerCase();
        const category = normalizeEventCategory(events);

        if (type === 'VERDICHTER_GESTARTET') {
            if (category === 'Heizung') {
                incrementEventToday('Events.Today.HeatingCycles');
            } else if (category === 'Warmwasser') {
                incrementEventToday('Events.Today.WarmwaterCycles');
            }
        }

        if (type === 'ABTAUUNG_GESTARTET') {
            incrementEventToday('Events.Today.Defrosts');
        }

        if (level === 'warning' || level === 'warn') {
            incrementEventToday('Events.Today.Warnings');
        }

        if (level === 'error' || level === 'critical' || level === 'fatal') {
            incrementEventToday('Events.Today.Errors');
        }
    }

    function updateEventHistory(events) {
        resetEventTodayIfNeeded();

        if (!events || events.valid !== true || !Number.isFinite(events.sequence)) return;

        const lastProcessedSequence = targetNumber('Events.Counter', 0);
        if (events.sequence <= lastProcessedSequence) return;

        const entry = {
            Zeitpunkt: formatEventHistoryTimestamp(events.lastTimestamp) || formatEventHistoryTimestamp(new Date()),
            Ereignis: events.lastTitle || events.lastType || events.lastId,
            Kategorie: normalizeEventCategory(events),
            Status: normalizeEventStatus(events.lastCriticality),
            Details: eventDetails(events)
        };

        const history = readEventHistory();
        history.unshift(entry);

        if (history.length > CONFIG.EVENT_HISTORY_LIMIT) {
            history.length = CONFIG.EVENT_HISTORY_LIMIT;
        }

        write('Events.History', JSON.stringify(history));
        updateEventTodayCounters(events);
    }

    function determineTechnicalState() {
        const unreach = readBoolean(SOURCE.TECH_UNREACH);
        const alarmNumber = readNumber(SOURCE.TECH_ALARM_NUMBER, 0);

        if (unreach === true) {
            return {
                state: 'NICHT ERREICHBAR',
                code: 0,
                color: CONFIG.QUALITY_COLORS.WARNING,
                message: 'Die NIBE-Anlage ist über den Adapter nicht erreichbar.'
            };
        }

        if (Number.isFinite(alarmNumber) && alarmNumber > 0) {
            return {
                state: 'STÖRUNG',
                code: 3,
                color: CONFIG.QUALITY_COLORS.CRITICAL,
                message: 'Aktive NIBE-Alarmnummer: ' + alarmNumber
            };
        }

        if (unreach === null && alarmNumber === null) {
            return {
                state: 'UNBEKANNT',
                code: 0,
                color: CONFIG.QUALITY_COLORS.INVALID,
                message: 'Erreichbarkeit und Alarmstatus sind nicht verfügbar.'
            };
        }

        return {
            state: 'BETRIEBSBEREIT',
            code: 1,
            color: CONFIG.QUALITY_COLORS.GOOD,
            message: 'Keine technische Störung erkannt.'
        };
    }

    function determineHealth(temperatures, compressor, energy, defrost, cycles, technical) {
        const stateText = readText(SOURCE.STATE, '');
        const modeText = readText(SOURCE.MODE, '');
        const cycleId = readText(SOURCE.CYCLE_ID, '');

        function ageIsValid(age) {
            return age === null || age <= CONFIG.MAX_DATA_AGE_SECONDS;
        }

        const checks = [
            {
                key: 'technical',
                name: 'Technische Erreichbarkeit',
                weight: 20,
                ok: technical.state !== 'NICHT ERREICHBAR' && technical.state !== 'UNBEKANNT',
                reason: technical.message,
                source: {
                    state: technical.state,
                    code: technical.code
                }
            },
            {
                key: 'temperatures',
                name: 'Temperaturen',
                weight: 15,
                ok: temperatures.valid && ageIsValid(temperatures.updateAgeSeconds),
                reason: !temperatures.valid
                    ? (temperatures.warning || 'TemperatureMonitor meldet ungültige Eingangsdaten.')
                    : 'Temperaturdaten sind älter als ' + CONFIG.MAX_DATA_AGE_SECONDS + ' Sekunden.',
                source: {
                    valid: temperatures.valid,
                    warning: temperatures.warning || '',
                    ageSeconds: temperatures.updateAgeSeconds
                }
            },
            {
                key: 'compressor',
                name: 'Verdichter',
                weight: 15,
                ok: compressor.valid && ageIsValid(compressor.updateAgeSeconds),
                reason: !compressor.valid
                    ? (compressor.warning || 'CompressorMonitor meldet ungültige Eingangsdaten.')
                    : 'Verdichterdaten sind älter als ' + CONFIG.MAX_DATA_AGE_SECONDS + ' Sekunden.',
                source: {
                    valid: compressor.valid,
                    warning: compressor.warning || '',
                    ageSeconds: compressor.updateAgeSeconds
                }
            },
            {
                key: 'energy',
                name: 'Energiezuordnung',
                weight: 20,
                ok: energy.valid,
                reason: energy.warning || 'EnergyAllocation meldet ungültige Eingangsdaten.',
                source: {
                    valid: energy.valid,
                    warning: energy.warning || '',
                    ageSeconds: energy.updateAgeSeconds,
                    ageUsedForHealth: false
                }
            },
            {
                key: 'stateMachine',
                name: 'StateMachine-Zustand',
                weight: 10,
                ok: stateText !== '',
                reason: 'StateMachine.Current.State ist leer oder nicht verfügbar.',
                source: {
                    value: stateText
                }
            },
            {
                key: 'mode',
                name: 'Betriebsart',
                weight: 5,
                ok: modeText !== '',
                reason: 'StateMachine.Current.OperatingMode ist leer oder nicht verfügbar.',
                source: {
                    value: modeText
                }
            },
            {
                key: 'defrost',
                name: 'Abtaumonitor',
                weight: 5,
                ok: defrost.valid,
                reason: defrost.warning || 'DefrostMonitor meldet ungültige Eingangsdaten.',
                source: {
                    valid: defrost.valid,
                    warning: defrost.warning || '',
                    ageSeconds: defrost.updateAgeSeconds
                }
            },
            {
                key: 'cycleRecorder',
                name: 'CycleRecorder',
                weight: 5,
                ok: existsState(SOURCE.RECORDING_ACTIVE),
                reason: 'Datenpunkt CycleRecorder.Recording.Active fehlt.',
                source: {
                    stateExists: existsState(SOURCE.RECORDING_ACTIVE)
                }
            },
            {
                key: 'cycleAnalyzer',
                name: 'CycleAnalyzer',
                weight: 5,
                ok: existsState(SOURCE.CYCLE_VALID) && (cycles.valid || cycleId !== ''),
                reason: !existsState(SOURCE.CYCLE_VALID)
                    ? 'Datenpunkt CycleAnalyzer.Analysis.Valid fehlt.'
                    : 'Es liegt noch keine gültige oder identifizierbare Zyklusanalyse vor.',
                source: {
                    validStateExists: existsState(SOURCE.CYCLE_VALID),
                    valid: cycles.valid,
                    cycleId: cycleId
                }
            }
        ];

        let score = 0;
        const deductions = [];

        checks.forEach(function (check) {
            if (check.ok) {
                score += check.weight;
                return;
            }

            deductions.push({
                key: check.key,
                criterion: check.name,
                deduction: check.weight,
                reason: check.reason,
                source: check.source
            });
        });

        if (technical.state === 'NICHT ERREICHBAR') {
            score = 0;
        }

        score = Math.max(0, Math.min(100, Math.round(score)));

        let state;
        let color;

        if (score >= 98) {
            state = 'EXZELLENT';
            color = CONFIG.QUALITY_COLORS.EXCELLENT;
        } else if (score >= 90) {
            state = 'GUT';
            color = CONFIG.QUALITY_COLORS.GOOD;
        } else if (score >= 80) {
            state = 'WARNUNG';
            color = CONFIG.QUALITY_COLORS.MEDIUM;
        } else if (score >= 60) {
            state = 'KRITISCH';
            color = CONFIG.QUALITY_COLORS.WARNING;
        } else {
            state = 'STÖRUNG';
            color = CONFIG.QUALITY_COLORS.CRITICAL;
        }

        const calculatedAt = localIso();
        const reason = deductions.length === 0
            ? 'Keine Abzüge'
            : deductions.map(function (item) {
                return item.criterion + ' -' + item.deduction + ' %';
            }).join('; ');

        const details = {
            schemaVersion: 1,
            calculatedAt: calculatedAt,
            baseScore: 100,
            score: score,
            totalDeduction: 100 - score,
            state: state,
            reason: reason,
            deductions: deductions,
            checks: checks.map(function (check) {
                return {
                    key: check.key,
                    criterion: check.name,
                    weight: check.weight,
                    passed: check.ok
                };
            })
        };

        function formatHealthDeductionDetails(source) {
            if (!source || typeof source !== 'object') return '–';

            const parts = [];

            if (source.ageSeconds !== null && source.ageSeconds !== undefined) {
                parts.push('Alter: ' + source.ageSeconds + ' s');
            }

            if (source.ageUsedForHealth === false) {
                parts.push('Alter nur Information');
            }

            Object.keys(source).forEach(function (key) {
                if (key === 'ageSeconds' || key === 'ageUsedForHealth') return;

                const value = source[key];

                if (
                    value === null ||
                    value === undefined ||
                    value === '' ||
                    typeof value === 'object'
                ) {
                    return;
                }

                parts.push(key + ': ' + String(value));
            });

            return parts.length > 0 ? parts.join('; ') : '–';
        }

        function formatHealthTableTimestamp(value) {
            const date = parseDateValue(value);
            if (!date) return '';

            function pad(number) {
                return String(number).padStart(2, '0');
            }

            return (
                pad(date.getDate()) + '.' +
                pad(date.getMonth() + 1) + '.' +
                date.getFullYear() + ', ' +
                pad(date.getHours()) + ':' +
                pad(date.getMinutes())
            );
        }

        const healthTableTimestamp = formatHealthTableTimestamp(calculatedAt);

        const table = deductions.length === 0
            ? [{
                Zeitpunkt: healthTableTimestamp,
                Kriterium: 'Keine Abzüge',
                Abzug: '0 %',
                Ursache: 'Alle Health-Prüfungen bestanden',
                Details: '–'
            }]
            : deductions.map(function (deduction) {
                return {
                    Zeitpunkt: healthTableTimestamp,
                    Kriterium: deduction.criterion,
                    Abzug: '-' + deduction.deduction + ' %',
                    Ursache: deduction.reason,
                    Details: formatHealthDeductionDetails(deduction.source)
                };
            });

        return {
            percent: score,
            label: state,
            color: color,
            message: deductions.length === 0
                ? 'Alle überwachten NPS-Bereiche arbeiten fehlerfrei.'
                : 'Eingeschränkt: ' + deductions.map(function (item) {
                    return item.criterion;
                }).join(', '),
            reason: reason,
            details: JSON.stringify(details),
            table: JSON.stringify(table),
            lastUpdate: calculatedAt
        };
    }

    function dashboardValue(value) {
        if (value === undefined || value === null) return null;
        return value;
    }

    function writeMapped(prefix, object, mapping) {
        Object.keys(mapping).forEach(function (key) {
            write(prefix + '.' + mapping[key], dashboardValue(object[key]));
        });
    }

    function calculateCop(heatEnergy, electricEnergy) {
        if (
            !Number.isFinite(heatEnergy) ||
            !Number.isFinite(electricEnergy) ||
            heatEnergy < 0 ||
            electricEnergy <= 0.05
        ) {
            return 0;
        }

        const cop = heatEnergy / electricEnergy;
        if (!Number.isFinite(cop) || cop < 0.1 || cop > 15) return 0;
        return round(cop, 1);
    }

    // ============================================================
    // HeatingOptimization / Modul 15 – reine Präsentationsprojektion
    // ============================================================
    function heatingSource(path) {
        return CONFIG.NPS_ROOT + '.HeatingOptimization.' + path;
    }

    function mapHeatingOperatingPriority(value) {
        const number = Number(value);
        if (number === 10) return 'Standby';
        if (number === 20) return 'Warmwasser';
        if (number === 30) return 'Heizen';
        if (number === 40) return 'Pool';
        if (number === 50 || number === 60) return 'Kühlung';
        return 'Unbekannt';
    }

    function mapHeatingConfigurationOperatingMode(value) {
        if (value === null || value === undefined || value === '') return 'Unbekannt';
        return String(value);
    }

    function parseHeatingJsonSource(sourceId, label) {
        const raw = readRaw(sourceId);

        if (raw === null || raw === undefined || raw === '') {
            return { ok: false, value: null, error: 'EMPTY' };
        }

        if (typeof raw === 'object') {
            return { ok: true, value: raw, error: '' };
        }

        try {
            return { ok: true, value: JSON.parse(String(raw)), error: '' };
        } catch (error) {
            warn(
                'HeatingOptimization: ungültiges JSON in ' +
                label + ' | ' + (error && error.message ? error.message : error)
            );
            return { ok: false, value: null, error: 'INVALID_JSON' };
        }
    }

    function heatingMissingText(items) {
        if (!Array.isArray(items) || items.length === 0) return 'Keine';

        return items.map(function (item) {
            if (!item || typeof item !== 'object') return String(item || '');
            const room = item.room ? String(item.room) + ': ' : '';
            const name = item.name ? String(item.name) : 'Unbekannt';
            return room + name;
        }).filter(function (value) {
            return value !== '';
        }).join(' · ') || 'Keine';
    }

    function heatingExcludeReasonText(reasons) {
        if (!Array.isArray(reasons) || reasons.length === 0) return '';

        const labels = {
            ROOM_INACTIVE: 'Raum inaktiv',
            NO_ACTUAL_TEMPERATURE: 'Temperatur fehlt',
            INVALID_ACTUAL_TEMPERATURE: 'Temperatur ungültig',
            NO_SCHEDULE_TARGET: 'Solltemperatur fehlt',
            INVALID_SCHEDULE_TARGET: 'Solltemperatur ungültig',
            HEATING_PERIOD_INACTIVE: 'Heizperiode inaktiv',
            MAINTENANCE: 'Maintenance',
            WINDOW_OPEN: 'Fenster offen',
            OVERRIDE_ACTIVE: 'Override aktiv'
        };

        return reasons.map(function (reason) {
            return labels[reason] || String(reason);
        }).join(' · ');
    }

    function heatingTableNumber(value, digits) {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        return round(number, digits);
    }

    function heatingFormatNumber(value, digits, unit) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '–';
        const formatted = round(number, digits).toFixed(digits).replace('.', ',');
        return formatted + (unit ? ' ' + unit : '');
    }

    function buildHeatingRoomsTable(roomsResult) {
        if (!roomsResult.ok || !roomsResult.value || !Array.isArray(roomsResult.value.details)) {
            return [];
        }

        return roomsResult.value.details.map(function (room) {
            return {
                room: room && room.name ? String(room.name) : '',
                actual: heatingTableNumber(room ? room.actualTemperature : null, 1),
                target: heatingTableNumber(room ? room.scheduleTarget : null, 1),
                deviation: heatingTableNumber(room ? room.deviation : null, 1),
                comfort: room && room.comfortState ? String(room.comfortState) : '',
                valid: !!(room && room.validForHeatingCurve === true),
                reason: heatingExcludeReasonText(room ? room.excludeReasons : [])
            };
        });
    }

    function readHeatingWindow(windowName) {
        const root = heatingSource('Analysis.' + windowName + '.');

        return {
            valid: readBoolean(root + 'Valid') === true,
            validHeatingHours: readNumber(root + 'ValidHeatingHours', 1),
            dataQualityPercent: readNumber(root + 'DataQualityPercent', 1),
            avgOutdoorTemperature: readNumber(root + 'AvgOutdoorTemperature', 1),
            avgFlowTarget: readNumber(root + 'AvgFlowTarget', 1),
            avgFlowActual: readNumber(root + 'AvgFlowActual', 1),
            avgFlowDeviation: readNumber(root + 'AvgFlowDeviation', 1),
            avgRoomDeviation: readNumber(root + 'AvgRoomDeviation', 1),
            medianRoomDeviation: readNumber(root + 'MedianRoomDeviation', 1),
            tooColdRatio: readNumber(root + 'TooColdRatio', 1),
            okRatio: readNumber(root + 'OKRatio', 1),
            tooWarmRatio: readNumber(root + 'TooWarmRatio', 1),
            compressorRuntimePercent: readNumber(root + 'CompressorRuntimePercent', 1),
            additionalHeatRuntimePercent: readNumber(root + 'AdditionalHeatRuntimePercent', 1)
        };
    }

    function buildHeatingAnalysisWindowsTable(windows) {
        const definitions = [
            ['6 h', 'Window6h'],
            ['24 h', 'Window24h'],
            ['72 h', 'Window72h'],
            ['7 Tage', 'Window7d']
        ];

        return definitions.map(function (definition) {
            const label = definition[0];
            const key = definition[1];
            const value = windows[key];

            return {
                window: label,
                valid: value.valid === true,
                heatingHours: value.validHeatingHours,
                dataQuality: value.dataQualityPercent,
                status:
                    value.valid === true
                        ? (key === 'Window72h' ? 'Hauptanalyse' : 'Bereit')
                        : 'Nicht ausreichend'
            };
        });
    }

    function mapHeatingGlobalTemperatureState(evidence) {
        if (!evidence || evidence.insufficientData === true) {
            return 'Keine belastbare Aussage';
        }

        if (evidence.globalTooCold && evidence.globalTooCold.value === true) {
            return 'Haus überwiegend zu kalt';
        }

        if (evidence.globalTooWarm && evidence.globalTooWarm.value === true) {
            return 'Haus überwiegend zu warm';
        }

        return 'OK';
    }

    function mapHeatingFlowTrackingState(evidence) {
        if (!evidence || evidence.insufficientData === true) {
            return 'Keine belastbare Aussage';
        }

        const flow = evidence.flowTrackingProblem || {};
        if (flow.value !== true) return 'OK';
        if (flow.direction === 'LOW') return 'Vorlauf dauerhaft unter Soll';
        if (flow.direction === 'HIGH') return 'Vorlauf dauerhaft über Soll';
        return 'Auffällig';
    }

    function mapHeatingOutdoorDependenceState(evidence) {
        if (!evidence || evidence.insufficientData === true) {
            return 'Keine belastbare Aussage';
        }

        const outdoor = evidence.outdoorDependentDeviation || {};
        if (outdoor.value !== true) return 'Nicht erkannt';

        if (outdoor.direction === 'COLDER_OUTSIDE_MORE_NEGATIVE') {
            return 'Bei kälterer Außenluft zunehmend zu kalt';
        }

        if (outdoor.direction === 'COLDER_OUTSIDE_MORE_POSITIVE') {
            return 'Bei kälterer Außenluft zunehmend zu warm';
        }

        return 'Erkannt';
    }

    function evidenceConfidence(item) {
        if (!item || typeof item !== 'object') return null;
        const value = Number(item.confidence);
        return Number.isFinite(value) ? round(value, 1) : null;
    }

    function buildHeatingEvidenceTable(evidenceResult) {
        if (!evidenceResult.ok || !evidenceResult.value) return [];

        const evidence = evidenceResult.value;
        const insufficient = evidence.insufficientData === true;

        const outdoor = evidence.outdoorDependentDeviation || {};
        const flow = evidence.flowTrackingProblem || {};
        const sensor = evidence.sensorMismatch || {};

        return [
            {
                analysis: 'Gesamtes Haus zu kalt',
                active: !!(evidence.globalTooCold && evidence.globalTooCold.value === true),
                confidence: evidenceConfidence(evidence.globalTooCold),
                status: insufficient
                    ? 'Keine belastbare Aussage'
                    : (evidence.globalTooCold && evidence.globalTooCold.value === true ? 'Erkannt' : 'Nein')
            },
            {
                analysis: 'Gesamtes Haus zu warm',
                active: !!(evidence.globalTooWarm && evidence.globalTooWarm.value === true),
                confidence: evidenceConfidence(evidence.globalTooWarm),
                status: insufficient
                    ? 'Keine belastbare Aussage'
                    : (evidence.globalTooWarm && evidence.globalTooWarm.value === true ? 'Erkannt' : 'Nein')
            },
            {
                analysis: 'Außentemperaturabhängigkeit',
                active: outdoor.value === true,
                confidence: evidenceConfidence(outdoor),
                status: mapHeatingOutdoorDependenceState(evidence)
            },
            {
                analysis: 'Raumungleichgewicht',
                active: !!(evidence.roomImbalance && evidence.roomImbalance.value === true),
                confidence: evidenceConfidence(evidence.roomImbalance),
                status: insufficient
                    ? 'Keine belastbare Aussage'
                    : (evidence.roomImbalance && evidence.roomImbalance.value === true ? 'Erkannt' : 'Nein')
            },
            {
                analysis: 'Vorlauf-Nachführung',
                active: flow.value === true,
                confidence: evidenceConfidence(flow),
                status: mapHeatingFlowTrackingState(evidence)
            },
            {
                analysis: 'Einfluss Zusatzheizung',
                active: evidence.additionalHeatInfluence === true,
                confidence: null,
                status: insufficient
                    ? 'Keine belastbare Aussage'
                    : (evidence.additionalHeatInfluence === true ? 'Ja' : 'Nein')
            },
            {
                analysis: 'Außensensoren auffällig',
                active: sensor.value === true,
                confidence: null,
                status: sensor.value === true ? 'Auffällig' : 'Nein'
            },
            {
                analysis: 'Datenbasis unzureichend',
                active: insufficient,
                confidence: null,
                status: insufficient ? 'Ja' : 'Nein'
            }
        ];
    }

    function buildHeatingDataQualityTable(data) {
        return [
            {
                criterion: 'Pflichtquellen',
                value: data.requiredOk + ' / ' + data.requiredTotal,
                status: data.requiredOk === data.requiredTotal ? 'OK' : 'FEHLER',
                details: data.requiredMissing
            },
            {
                criterion: 'Optionale Quellen',
                value: data.optionalOk + ' / ' + data.optionalTotal,
                status: data.optionalOk === data.optionalTotal ? 'OK' : 'Hinweis',
                details: data.optionalMissing
            },
            {
                criterion: 'Raumquellen',
                value: data.roomSourcesValid + ' / ' + data.roomSourcesConfigured,
                status: data.roomSourcesValid === data.roomSourcesConfigured ? 'OK' : 'Hinweis',
                details: ''
            },
            {
                criterion: 'Aktuelles Sample',
                value: data.sampleValid ? 'Ja' : 'Nein',
                status: data.sampleValid ? 'Gültig' : 'Nicht verwertbar',
                details: ''
            },
            {
                criterion: 'Samplequalität',
                value: heatingFormatNumber(data.sampleQuality, 0, '%'),
                status: data.sampleValid ? 'OK' : 'Nicht verwertbar',
                details: ''
            },
            {
                criterion: 'Globale Datenqualität',
                value: heatingFormatNumber(data.percent, 0, '%'),
                status: data.state || 'INSUFFICIENT',
                details: ''
            },
            {
                criterion: 'Gültige Heizstunden',
                value: heatingFormatNumber(data.validHeatingHours, 1, 'h'),
                status: Number.isFinite(data.validHeatingHours) && data.validHeatingHours >= 8
                    ? 'OK'
                    : 'Noch nicht ausreichend',
                details: ''
            },
            {
                criterion: 'Analyse bereit',
                value: data.analysisReady ? 'Ja' : 'Nein',
                status: data.analysisReady ? 'READY' : 'NOT READY',
                details: ''
            }
        ];
    }

    function collectHeatingOptimization() {
        const roomsResult = parseHeatingJsonSource(
            SOURCE.HEATING_ROOMS_JSON,
            'Rooms.Json'
        );

        const evidenceResult = parseHeatingJsonSource(
            SOURCE.HEATING_ANALYSIS_EVIDENCE_JSON,
            'Analysis.EvidenceJson'
        );

        const sourceCheckResult = parseHeatingJsonSource(
            SOURCE.HEATING_STATUS_SOURCE_CHECK_JSON,
            'Status.SourceCheckJson'
        );

        const windows = {
            Window6h: readHeatingWindow('Window6h'),
            Window24h: readHeatingWindow('Window24h'),
            Window72h: readHeatingWindow('Window72h'),
            Window7d: readHeatingWindow('Window7d')
        };

        const sourceCheck = sourceCheckResult.ok && sourceCheckResult.value
            ? sourceCheckResult.value
            : {};

        const required = sourceCheck.required || {};
        const optional = sourceCheck.optional || {};
        const sourceRooms = sourceCheck.rooms || {};

        const dataQuality = {
            sourceCheckOk: readBoolean(SOURCE.HEATING_STATUS_SOURCE_CHECK_OK) === true,
            requiredTotal: Number.isFinite(Number(required.total)) ? Number(required.total) : 0,
            requiredOk: Number.isFinite(Number(required.ok)) ? Number(required.ok) : 0,
            requiredMissing: heatingMissingText(required.missing),
            optionalTotal: Number.isFinite(Number(optional.total)) ? Number(optional.total) : 0,
            optionalOk: Number.isFinite(Number(optional.ok)) ? Number(optional.ok) : 0,
            optionalMissing: heatingMissingText(optional.missing),
            roomSourcesConfigured: Number.isFinite(Number(sourceRooms.configured))
                ? Number(sourceRooms.configured)
                : 0,
            roomSourcesValid: Number.isFinite(Number(sourceRooms.valid))
                ? Number(sourceRooms.valid)
                : 0,
            percent: readNumber(SOURCE.HEATING_STATUS_DATA_QUALITY_PERCENT, 1),
            state: readText(SOURCE.HEATING_STATUS_DATA_QUALITY_STATE, 'INSUFFICIENT'),
            sampleQuality: readNumber(SOURCE.HEATING_CURRENT_SAMPLE_QUALITY, 1),
            sampleValid: readBoolean(SOURCE.HEATING_CURRENT_SAMPLE_VALID) === true,
            validHeatingHours: readNumber(SOURCE.HEATING_ANALYSIS_CURRENT_CONFIG_HOURS, 1),
            analysisReady: readBoolean(SOURCE.HEATING_AI_READY) === true
        };

        const evidence = evidenceResult.ok && evidenceResult.value
            ? evidenceResult.value
            : null;

        const configuration = {
            heatingCurve: readNumber(heatingSource('Configuration.HeatingCurve')),
            heatingCurveOffset: readNumber(heatingSource('Configuration.HeatingCurveOffset')),
            flowMin: readNumber(heatingSource('Configuration.FlowMin'), 1),
            flowMax: readNumber(heatingSource('Configuration.FlowMax'), 1),
            heatingStartUndertemp: readNumber(heatingSource('Configuration.HeatingStartUndertemp'), 1),
            heatingStopTemperature: readNumber(heatingSource('Configuration.HeatingStopTemperature'), 1),
            additionalHeatStopTemperature: readNumber(heatingSource('Configuration.AdditionalHeatStopTemperature'), 1),
            autoFilterTime: readNumber(heatingSource('Configuration.AutoFilterTime'), 1),
            maxFlowDifferenceCompressor: readNumber(heatingSource('Configuration.MaxFlowDifferenceCompressor'), 1),
            operatingMode: readNumber(heatingSource('Configuration.OperatingMode')),
            heatingAutomatic: readBoolean(heatingSource('Configuration.HeatingAutomatic')),
            changedAt: localIso(readText(heatingSource('Configuration.ChangedAt'), '')),
            pointOutdoorTemperature: readNumber(heatingSource('Configuration.PointOutdoorTemperature'), 1),
            pointOffset: readNumber(heatingSource('Configuration.PointOffset'), 1),
            customCurve: [1,2,3,4,5,6,7].map(function (point) {
                return readNumber(heatingSource('Configuration.CustomCurveP' + point), 1);
            })
        };

        return {
            status: {
                active: readBoolean(SOURCE.HEATING_STATUS_ACTIVE) === true,
                valid: readBoolean(SOURCE.HEATING_STATUS_VALID) === true,
                dataQualityPercent: readNumber(SOURCE.HEATING_STATUS_DATA_QUALITY_PERCENT, 1),
                dataQualityState: readText(SOURCE.HEATING_STATUS_DATA_QUALITY_STATE, 'INSUFFICIENT'),
                analysisReady: readBoolean(SOURCE.HEATING_AI_READY) === true,
                sourceTimestamp: localIso(readText(SOURCE.HEATING_STATUS_LAST_CALCULATION, ''))
            },
            current: {
                operatingPriority: readNumber(SOURCE.HEATING_CURRENT_OPERATING_PRIORITY, 0),
                outdoorTemperature: readNumber(SOURCE.HEATING_CURRENT_OUTDOOR, 1),
                flowTarget: readNumber(SOURCE.HEATING_CURRENT_FLOW_TARGET, 1),
                flowActual: readNumber(SOURCE.HEATING_CURRENT_FLOW_ACTUAL, 1),
                supplyDeviation: readNumber(SOURCE.HEATING_CURRENT_SUPPLY_DEVIATION, 1),
                returnTemperature: readNumber(SOURCE.HEATING_CURRENT_RETURN, 1),
                deltaT: readNumber(SOURCE.HEATING_CURRENT_DELTA_T, 1),
                degreeMinutes: readNumber(SOURCE.HEATING_CURRENT_DEGREE_MINUTES, 0),
                compressorActive: readBoolean(SOURCE.HEATING_CURRENT_COMPRESSOR_ACTIVE) === true,
                compressorFrequency: readNumber(SOURCE.HEATING_CURRENT_COMPRESSOR_FREQUENCY, 1),
                volumeFlow: readNumber(SOURCE.HEATING_CURRENT_VOLUME_FLOW, 1),
                additionalHeatActive: readBoolean(SOURCE.HEATING_CURRENT_ADDITIONAL_HEAT_ACTIVE) === true,
                defrostActive: readBoolean(SOURCE.HEATING_CURRENT_DEFROST_ACTIVE) === true,
                sampleValid: readBoolean(SOURCE.HEATING_CURRENT_SAMPLE_VALID) === true,
                sampleQuality: readNumber(SOURCE.HEATING_CURRENT_SAMPLE_QUALITY, 1)
            },
            rooms: {
                count: readNumber(SOURCE.HEATING_ROOMS_COUNT, 0),
                activeCount: readNumber(SOURCE.HEATING_ROOMS_ACTIVE_COUNT, 0),
                dataValidCount: readNumber(SOURCE.HEATING_ROOMS_DATA_VALID_COUNT, 0),
                validForHeatingCurveCount: readNumber(SOURCE.HEATING_ROOMS_ANALYSIS_VALID_COUNT, 0),
                tooColdCount: readNumber(SOURCE.HEATING_ROOMS_TOO_COLD_COUNT, 0),
                okCount: readNumber(SOURCE.HEATING_ROOMS_OK_COUNT, 0),
                tooWarmCount: readNumber(SOURCE.HEATING_ROOMS_TOO_WARM_COUNT, 0),
                averageDeviation: readNumber(SOURCE.HEATING_ROOMS_AVERAGE_DEVIATION, 1),
                medianDeviation: readNumber(SOURCE.HEATING_ROOMS_MEDIAN_DEVIATION, 1),
                deviationStdDev: readNumber(SOURCE.HEATING_ROOMS_STDDEV, 1),
                deviationRange: readNumber(SOURCE.HEATING_ROOMS_RANGE, 1),
                coldestRoom: readText(SOURCE.HEATING_ROOMS_COLDEST, ''),
                coldestRoomDeviation: readNumber(SOURCE.HEATING_ROOMS_COLDEST_DEVIATION, 1),
                warmestRoom: readText(SOURCE.HEATING_ROOMS_WARMEST, ''),
                warmestRoomDeviation: readNumber(SOURCE.HEATING_ROOMS_WARMEST_DEVIATION, 1)
            },
            analysis: windows.Window72h,
            evidence: {
                globalTemperatureState: mapHeatingGlobalTemperatureState(evidence),
                flowTrackingState: mapHeatingFlowTrackingState(evidence),
                outdoorDependenceState: mapHeatingOutdoorDependenceState(evidence),
                roomImbalance: !!(evidence && evidence.roomImbalance && evidence.roomImbalance.value === true),
                additionalHeatInfluence: !!(evidence && evidence.additionalHeatInfluence === true),
                sensorMismatch: !!(evidence && evidence.sensorMismatch && evidence.sensorMismatch.value === true),
                insufficientData: !evidence || evidence.insufficientData === true
            },
            dataQuality: dataQuality,
            configuration: configuration,
            tables: {
                rooms: JSON.stringify(buildHeatingRoomsTable(roomsResult)),
                analysisWindows: JSON.stringify(buildHeatingAnalysisWindowsTable(windows)),
                evidence: JSON.stringify(buildHeatingEvidenceTable(evidenceResult)),
                dataQuality: JSON.stringify(buildHeatingDataQualityTable(dataQuality))
            }
        };
    }

    function publishHeatingOptimization(heating) {
        writeMapped('HeatingOptimization.Status', {
            active: heating.status.active,
            valid: heating.status.valid,
            dataQualityPercent: heating.status.dataQualityPercent,
            dataQualityState: heating.status.dataQualityState,
            analysisReady: heating.status.analysisReady,
            lastUpdate: localIso(),
            sourceTimestamp: heating.status.sourceTimestamp
        }, {
            active: 'Active',
            valid: 'Valid',
            dataQualityPercent: 'DataQualityPercent',
            dataQualityState: 'DataQualityState',
            analysisReady: 'AnalysisReady',
            lastUpdate: 'LastUpdate',
            sourceTimestamp: 'SourceTimestamp'
        });

        writeMapped('HeatingOptimization.Current', {
            operatingPriority: heating.current.operatingPriority,
            operatingModeText: mapHeatingOperatingPriority(heating.current.operatingPriority),
            outdoorTemperature: heating.current.outdoorTemperature,
            flowTarget: heating.current.flowTarget,
            flowActual: heating.current.flowActual,
            supplyDeviation: heating.current.supplyDeviation,
            returnTemperature: heating.current.returnTemperature,
            deltaT: heating.current.deltaT,
            degreeMinutes: heating.current.degreeMinutes,
            compressorActive: heating.current.compressorActive,
            compressorFrequency: heating.current.compressorFrequency,
            volumeFlow: heating.current.volumeFlow,
            additionalHeatActive: heating.current.additionalHeatActive,
            defrostActive: heating.current.defrostActive,
            sampleValid: heating.current.sampleValid,
            sampleQuality: heating.current.sampleQuality
        }, {
            operatingPriority: 'OperatingPriority',
            operatingModeText: 'OperatingModeText',
            outdoorTemperature: 'OutdoorTemperature',
            flowTarget: 'FlowTarget',
            flowActual: 'FlowActual',
            supplyDeviation: 'SupplyDeviation',
            returnTemperature: 'ReturnTemperature',
            deltaT: 'DeltaT',
            degreeMinutes: 'DegreeMinutes',
            compressorActive: 'CompressorActive',
            compressorFrequency: 'CompressorFrequency',
            volumeFlow: 'VolumeFlow',
            additionalHeatActive: 'AdditionalHeatActive',
            defrostActive: 'DefrostActive',
            sampleValid: 'SampleValid',
            sampleQuality: 'SampleQuality'
        });

        writeMapped('HeatingOptimization.Rooms', heating.rooms, {
            count: 'Count',
            activeCount: 'ActiveCount',
            dataValidCount: 'DataValidCount',
            validForHeatingCurveCount: 'ValidForHeatingCurveCount',
            tooColdCount: 'TooColdCount',
            okCount: 'OKCount',
            tooWarmCount: 'TooWarmCount',
            averageDeviation: 'AverageDeviation',
            medianDeviation: 'MedianDeviation',
            deviationStdDev: 'DeviationStdDev',
            deviationRange: 'DeviationRange',
            coldestRoom: 'ColdestRoom',
            coldestRoomDeviation: 'ColdestRoomDeviation',
            warmestRoom: 'WarmestRoom',
            warmestRoomDeviation: 'WarmestRoomDeviation'
        });

        writeMapped('HeatingOptimization.Analysis', heating.analysis, {
            valid: 'Valid',
            validHeatingHours: 'ValidHeatingHours',
            dataQualityPercent: 'DataQualityPercent',
            avgOutdoorTemperature: 'AvgOutdoorTemperature',
            avgFlowTarget: 'AvgFlowTarget',
            avgFlowActual: 'AvgFlowActual',
            avgFlowDeviation: 'AvgFlowDeviation',
            avgRoomDeviation: 'AvgRoomDeviation',
            medianRoomDeviation: 'MedianRoomDeviation',
            tooColdRatio: 'TooColdRatio',
            okRatio: 'OKRatio',
            tooWarmRatio: 'TooWarmRatio',
            compressorRuntimePercent: 'CompressorRuntimePercent',
            additionalHeatRuntimePercent: 'AdditionalHeatRuntimePercent'
        });

        writeMapped('HeatingOptimization.Evidence', heating.evidence, {
            globalTemperatureState: 'GlobalTemperatureState',
            flowTrackingState: 'FlowTrackingState',
            outdoorDependenceState: 'OutdoorDependenceState',
            roomImbalance: 'RoomImbalance',
            additionalHeatInfluence: 'AdditionalHeatInfluence',
            sensorMismatch: 'SensorMismatch',
            insufficientData: 'InsufficientData'
        });

        writeMapped('HeatingOptimization.DataQuality', heating.dataQuality, {
            sourceCheckOk: 'SourceCheckOk',
            requiredTotal: 'RequiredTotal',
            requiredOk: 'RequiredOk',
            requiredMissing: 'RequiredMissing',
            optionalTotal: 'OptionalTotal',
            optionalOk: 'OptionalOk',
            optionalMissing: 'OptionalMissing',
            roomSourcesConfigured: 'RoomSourcesConfigured',
            roomSourcesValid: 'RoomSourcesValid',
            percent: 'Percent',
            state: 'State',
            sampleQuality: 'SampleQuality',
            sampleValid: 'SampleValid',
            validHeatingHours: 'ValidHeatingHours',
            analysisReady: 'AnalysisReady'
        });

        const config = heating.configuration;
        writeMapped('HeatingOptimization.Configuration', {
            heatingCurve: config.heatingCurve,
            heatingCurveOffset: config.heatingCurveOffset,
            flowMin: config.flowMin,
            flowMax: config.flowMax,
            heatingStartUndertemp: config.heatingStartUndertemp,
            heatingStopTemperature: config.heatingStopTemperature,
            additionalHeatStopTemperature: config.additionalHeatStopTemperature,
            autoFilterTime: config.autoFilterTime,
            maxFlowDifferenceCompressor: config.maxFlowDifferenceCompressor,
            operatingMode: config.operatingMode,
            operatingModeText: mapHeatingConfigurationOperatingMode(config.operatingMode),
            heatingAutomatic: config.heatingAutomatic,
            changedAt: config.changedAt,
            pointOutdoorTemperature: config.pointOutdoorTemperature,
            pointOffset: config.pointOffset
        }, {
            heatingCurve: 'HeatingCurve',
            heatingCurveOffset: 'HeatingCurveOffset',
            flowMin: 'FlowMin',
            flowMax: 'FlowMax',
            heatingStartUndertemp: 'HeatingStartUndertemp',
            heatingStopTemperature: 'HeatingStopTemperature',
            additionalHeatStopTemperature: 'AdditionalHeatStopTemperature',
            autoFilterTime: 'AutoFilterTime',
            maxFlowDifferenceCompressor: 'MaxFlowDifferenceCompressor',
            operatingMode: 'OperatingMode',
            operatingModeText: 'OperatingModeText',
            heatingAutomatic: 'HeatingAutomatic',
            changedAt: 'ChangedAt',
            pointOutdoorTemperature: 'PointOutdoorTemperature',
            pointOffset: 'PointOffset'
        });

        config.customCurve.forEach(function (value, index) {
            write(
                'HeatingOptimization.Configuration.CustomCurveP' + (index + 1),
                value
            );
        });

        write('HeatingOptimization.Tables.RoomsJson', heating.tables.rooms);
        write('HeatingOptimization.Tables.AnalysisWindowsJson', heating.tables.analysisWindows);
        write('HeatingOptimization.Tables.EvidenceJson', heating.tables.evidence);
        write('HeatingOptimization.Tables.DataQualityJson', heating.tables.dataQuality);
    }

    function updateDashboard(reason) {
        if (running) {
            pending = true;
            return;
        }

        running = true;
        pending = false;

        try {
            const temperatures = collectTemperatures();
            const compressor = collectCompressor();
            const compressorDay = collectCompressorDay(compressor);
            const compressorHistory = collectCompressorHistory();
            const energyHistory = collectEnergyHistory();
            const thermalPower = readNumber(SOURCE.THERMAL_POWER, 2);
            const electricalPowerW = readNumber(SOURCE.ELECTRICAL_POWER, 0);
            const electricalPowerKW = electricalPowerW / 1000;
            const liveCOPValid = thermalPower > 0 && electricalPowerKW > 0.1 && compressor.active;
            const liveCOP = liveCOPValid ? round(thermalPower / electricalPowerKW, 1) : 0;
            const additionalHeat = collectAdditionalHeat();
            const energy = collectEnergy();
            const electrical = collectElectrical();
            const dayStatistics = collectDayStatistics();
            const yearStatistics = collectYearStatistics();
            const cycles = collectCycle();
            const defrost = collectDefrost();
            const events = collectEvents();
            const heatingOptimization = collectHeatingOptimization();

            const rawMode = readText(SOURCE.MODE, '');
            const rawState = readText(SOURCE.STATE, '');
            const modeKey = normalizeMode(rawMode, rawState, defrost.active);
            const technical = determineTechnicalState();
            const alarmNumber = readNumber(SOURCE.TECH_ALARM_NUMBER, 0);
            const alarmActive = Number.isFinite(alarmNumber) && alarmNumber > 0;
            const health = determineHealth(temperatures, compressor, energy, defrost, cycles, technical);
            const activeCycle = cycles.active || compressor.active;

            const compressorQuality = qualityFromValidity(
                compressor.valid,
                compressor.updateAgeSeconds,
                compressor.warning
            );

            const energyQuality = qualityFromValidity(
                energy.valid,
                energy.updateAgeSeconds,
                energy.warning
            );

            const defrostQuality = qualityFromValidity(
                defrost.valid,
                defrost.updateAgeSeconds,
                defrost.warning
            );

            const copHeating = calculateCop(
                yearStatistics.heatHeating,
                yearStatistics.electricHeating
            );

            const copWarmwater = calculateCop(
                yearStatistics.heatWarmwater,
                yearStatistics.electricWarmwater
            );

            const totalHeat = (
                Number.isFinite(yearStatistics.heatHeating) &&
                Number.isFinite(yearStatistics.heatWarmwater)
            )
                ? yearStatistics.heatHeating + yearStatistics.heatWarmwater
                : null;

            const copTotal = calculateCop(
                totalHeat,
                yearStatistics.electricTotal
            );

            const totalCompressorHeatYear = (
                Number.isFinite(yearStatistics.heatHeatingCompressor) &&
                Number.isFinite(yearStatistics.heatWarmwaterCompressor)
            )
                ? yearStatistics.heatHeatingCompressor + yearStatistics.heatWarmwaterCompressor
                : null;

            const copCompressorTotal = calculateCop(
                totalCompressorHeatYear,
                yearStatistics.electricTotal
            );

            const copCompressorHeating = calculateCop(
                yearStatistics.heatHeatingCompressor,
                yearStatistics.electricHeating
            );

            const copCompressorWarmwater = calculateCop(
                yearStatistics.heatWarmwaterCompressor,
                yearStatistics.electricWarmwater
            );

            const heatTotalCompressor = (
                Number.isFinite(energy.heatHeatingCompressor) &&
                Number.isFinite(energy.heatWarmwaterCompressor)
            )
                ? round(energy.heatHeatingCompressor + energy.heatWarmwaterCompressor, 3)
                : null;

            const heatHeatingZH = safeDifference(
                energy.heatHeatingTotal,
                energy.heatHeatingCompressor
            );
            const heatWarmwaterZH = safeDifference(
                energy.heatWarmwaterTotal,
                energy.heatWarmwaterCompressor
            );
            const heatTotalZH = round(heatHeatingZH + heatWarmwaterZH, 3);
            const heatShareCompressor = safeShare(heatTotalCompressor, energy.heatTotal);
            const heatShareZH = safeShare(heatTotalZH, energy.heatTotal);

            const dayTotalHeat = (
                Number.isFinite(dayStatistics.heatHeating) &&
                Number.isFinite(dayStatistics.heatWarmwater)
            )
                ? dayStatistics.heatHeating + dayStatistics.heatWarmwater
                : null;

            const dayCompressorHeat = (
                Number.isFinite(dayStatistics.heatHeatingCompressor) &&
                Number.isFinite(dayStatistics.heatWarmwaterCompressor)
            )
                ? dayStatistics.heatHeatingCompressor + dayStatistics.heatWarmwaterCompressor
                : null;

            const dayHeatZH = (
                Number.isFinite(dayTotalHeat) &&
                Number.isFinite(dayCompressorHeat)
            )
                ? Math.max(0, dayTotalHeat - dayCompressorHeat)
                : null;

            const dayShareCompressor = safeShare(dayCompressorHeat, dayTotalHeat);
            const dayShareZH = safeShare(dayHeatZH, dayTotalHeat);

            const dayCopHeating = calculateCop(
                dayStatistics.heatHeating,
                dayStatistics.electricHeating
            );

            const dayCopWarmwater = calculateCop(
                dayStatistics.heatWarmwater,
                dayStatistics.electricWarmwater
            );

            const dayCopTotal = calculateCop(
                dayTotalHeat,
                dayStatistics.electricTotal
            );

            writeMapped('Overview', {
                state: rawState,
                mode: modeLabel(modeKey),
                modeColor: CONFIG.MODE_COLORS[modeKey],
                modeIcon: modeIcon(modeKey),
                health: health.label,
                healthColor: health.color,
                healthPercent: health.percent,
                healthReason: health.reason,
                healthDetails: health.details,
                healthTable: health.table,
                healthLastUpdate: health.lastUpdate,
                technicalState: technical.state,
                technicalColor: technical.color,
                alarmNumber: alarmNumber,
                alarmActive: alarmActive,
                notice: events.lastTitle || health.message,
                activeCycle: activeCycle,
                activeCycleType: cycles.activeType || modeLabel(modeKey),
                lastUpdate: localIso(),
                status: technical.state,
                message: technical.message
            }, {
                state: 'State',
                mode: 'Mode',
                modeColor: 'ModeColor',
                modeIcon: 'ModeIcon',
                health: 'Health',
                healthColor: 'HealthColor',
                healthPercent: 'HealthPercent',
                healthReason: 'HealthReason',
                healthDetails: 'HealthDetails',
                healthTable: 'HealthTable',
                healthLastUpdate: 'HealthLastUpdate',
                technicalState: 'TechnicalState',
                technicalColor: 'TechnicalColor',
                alarmNumber: 'AlarmNumber',
                alarmActive: 'AlarmActive',
                notice: 'Notice',
                activeCycle: 'ActiveCycle',
                activeCycleType: 'ActiveCycleType',
                lastUpdate: 'LastUpdate',
                status: 'Status',
                message: 'Message'
            });

            writeMapped('Temperatures', temperatures, {
                outdoor: 'Outdoor',
                supplyTarget: 'SupplyTarget',
                supply: 'Supply',
                supplyDeviation: 'SupplyDeviation',
                return: 'Return',
                deltaT: 'DeltaT',
                flow: 'Flow',
                meanHeatingWater: 'MeanHeatingWater',
                temperatureLift: 'TemperatureLift',
                warmwater: 'Warmwater',
                warmwaterCharging: 'WarmwaterCharging',
                qualityColor: 'QualityColor'
            });

            writeMapped('Compressor', {
                active: compressor.active,
                mode: compressor.mode,
                frequency: compressor.frequency,
                runtime: compressor.runtime,
                starts: compressor.starts,
                startsToday: compressorDay.startsToday,
                runtimeToday: compressorDay.runtimeToday,
                averageCycleDurationToday: compressorDay.averageCycleDurationToday,
                averageFrequencyToday: compressorDay.averageFrequencyToday,
                state: compressor.state,
                status: compressor.status,
                qualityColor: compressorQuality.color
            }, {
                active: 'Active',
                mode: 'Mode',
                frequency: 'Frequency',
                runtime: 'Runtime',
                starts: 'Starts',
                startsToday: 'StartsToday',
                runtimeToday: 'RuntimeToday',
                averageCycleDurationToday: 'AverageCycleDurationToday',
                averageFrequencyToday: 'AverageFrequencyToday',
                state: 'State',
                status: 'Status',
                qualityColor: 'QualityColor'
            });

            writeMapped('Compressor.History', {
                startsPerDay: compressorHistory.startsPerDay,
                runtimePerDay: compressorHistory.runtimePerDay
            }, {
                startsPerDay: 'StartsPerDay',
                runtimePerDay: 'RuntimePerDay'
            });

            writeMapped('Energy.History', {
                electricTotalPerDay: energyHistory.electricTotalPerDay,
                electricHeatingPerDay: energyHistory.electricHeatingPerDay,
                electricWarmwaterPerDay: energyHistory.electricWarmwaterPerDay,
                electricZHPerDay: energyHistory.electricZHPerDay,
                heatTotalPerDay: energyHistory.heatTotalPerDay,
                heatHeatingPerDay: energyHistory.heatHeatingPerDay,
                heatWarmwaterPerDay: energyHistory.heatWarmwaterPerDay,
                heatZHPerDay: energyHistory.heatZHPerDay
            }, {
                electricTotalPerDay: 'ElectricTotalPerDay',
                electricHeatingPerDay: 'ElectricHeatingPerDay',
                electricWarmwaterPerDay: 'ElectricWarmwaterPerDay',
                electricZHPerDay: 'ElectricZHPerDay',
                heatTotalPerDay: 'HeatTotalPerDay',
                heatHeatingPerDay: 'HeatHeatingPerDay',
                heatWarmwaterPerDay: 'HeatWarmwaterPerDay',
                heatZHPerDay: 'HeatZHPerDay'
            });

            writeMapped('Performance', {
                thermalPower: thermalPower,
                liveCOP: liveCOP,
                liveCOPValid: liveCOPValid
            }, {
                thermalPower: 'ThermalPower',
                liveCOP: 'LiveCOP',
                liveCOPValid: 'LiveCOPValid'
            });

            writeMapped('AdditionalHeat', additionalHeat, {
                active: 'Active',
                power: 'Power',
                mode: 'Mode'
            });

            writeMapped('Energy', {
                electricTotal: energy.electricTotal,
                electricHeating: energy.electricHeating,
                electricWarmwater: energy.electricWarmwater,
                heatHeating: energy.heatHeatingTotal,
                heatWarmwater: energy.heatWarmwaterTotal,
                heatTotal: energy.heatTotal,
                heatHeatingCompressor: energy.heatHeatingCompressor,
                heatWarmwaterCompressor: energy.heatWarmwaterCompressor,
                heatTotalCompressor: heatTotalCompressor,
                heatHeatingZH: heatHeatingZH,
                heatWarmwaterZH: heatWarmwaterZH,
                heatTotalZH: heatTotalZH,
                heatShareCompressor: heatShareCompressor,
                heatShareZH: heatShareZH,
                copTotal: copTotal,
                copHeating: copHeating,
                copWarmwater: copWarmwater,
                copCompressorTotal: copCompressorTotal,
                copCompressorHeating: copCompressorHeating,
                copCompressorWarmwater: copCompressorWarmwater,
                qualityColor: yearStatistics.available ? energyQuality.color : CONFIG.QUALITY_COLORS.INVALID
            }, {
                electricTotal: 'ElectricTotal',
                electricHeating: 'ElectricHeating',
                electricWarmwater: 'ElectricWarmwater',
                heatHeating: 'HeatHeating',
                heatWarmwater: 'HeatWarmwater',
                heatTotal: 'HeatTotal',
                heatHeatingCompressor: 'HeatHeatingCompressor',
                heatWarmwaterCompressor: 'HeatWarmwaterCompressor',
                heatTotalCompressor: 'HeatTotalCompressor',
                heatHeatingZH: 'HeatHeatingZH',
                heatWarmwaterZH: 'HeatWarmwaterZH',
                heatTotalZH: 'HeatTotalZH',
                heatShareCompressor: 'HeatShareCompressor',
                heatShareZH: 'HeatShareZH',
                copTotal: 'COPTotal',
                copHeating: 'COPHeating',
                copWarmwater: 'COPWarmwater',
                copCompressorTotal: 'COPCompressorTotal',
                copCompressorHeating: 'COPCompressorHeating',
                copCompressorWarmwater: 'COPCompressorWarmwater',
                qualityColor: 'QualityColor'
            });

            writeMapped('Electrical', electrical, {
                totalEnergy: 'TotalEnergy',
                estimatedEnergy: 'EstimatedEnergy',
                currentPower: 'CurrentPower',
                nibeCounter: 'NibeCounter',
                integratedEnergy: 'IntegratedEnergy',
                offset: 'Offset',
                maxOffset: 'MaxOffset',
                correctionDelta: 'CorrectionDelta',
                offsetStatus: 'OffsetStatus',
                offsetColor: 'OffsetColor',
                valid: 'Valid',
                status: 'Status',
                lastPowerUpdate: 'LastPowerUpdate',
                lastCounterUpdate: 'LastCounterUpdate',
                lastIntegration: 'LastIntegration',
                lastUpdate: 'LastUpdate'
            });

            writeMapped('Periods.Day', {
                electricTotal: dayStatistics.electricTotal,
                electricHeating: dayStatistics.electricHeating,
                electricWarmwater: dayStatistics.electricWarmwater,
                heatHeating: dayStatistics.heatHeating,
                heatWarmwater: dayStatistics.heatWarmwater,
                heatTotal: dayTotalHeat,
                heatCompressor: dayCompressorHeat,
                copTotal: dayCopTotal,
                shareCompressor: dayShareCompressor,
                shareZH: dayShareZH,
                heatZH: dayHeatZH,
                copHeating: dayCopHeating,
                copWarmwater: dayCopWarmwater,
                qualityColor: dayStatistics.available
                    ? CONFIG.QUALITY_COLORS.GOOD
                    : CONFIG.QUALITY_COLORS.INVALID
            }, {
                electricTotal: 'ElectricTotal',
                electricHeating: 'ElectricHeating',
                electricWarmwater: 'ElectricWarmwater',
                heatHeating: 'HeatHeating',
                heatWarmwater: 'HeatWarmwater',
                heatTotal: 'HeatTotal',
                heatCompressor: 'HeatCompressor',
                copTotal: 'COPTotal',
                shareCompressor: 'ShareCompressor',
                shareZH: 'ShareZH',
                heatZH: 'HeatZH',
                copHeating: 'COPHeating',
                copWarmwater: 'COPWarmwater',
                qualityColor: 'QualityColor'
            });

            writeMapped('Cycles', {
                active: cycles.active,
                type: cycles.active ? cycles.activeType : cycles.lastType,
                duration: cycles.lastDurationMinutes,
                currentDuration: cycles.currentDurationMinutes,
                cop: cycles.lastCOP,
                electricEnergy: cycles.lastElectricEnergy,
                heatEnergy: cycles.lastHeatEnergy,
                quality: cycles.lastQuality,
                qualityColor: cycles.lastQualityColor,
                lastCycle: cycles.lastEnd || cycles.lastStart
            }, {
                active: 'Active',
                type: 'Type',
                duration: 'Duration',
                currentDuration: 'CurrentDuration',
                cop: 'COP',
                electricEnergy: 'ElectricEnergy',
                heatEnergy: 'HeatEnergy',
                quality: 'Quality',
                qualityColor: 'QualityColor',
                lastCycle: 'LastCycle'
            });

            updateCycleHistory(cycles);

            writeMapped('Defrost', {
                active: defrost.active,
                count: defrost.count,
                duration: defrost.currentDurationMinutes,
                lastDuration: defrost.lastDurationMinutes,
                lastStart: defrost.lastStart,
                qualityColor: defrostQuality.color
            }, {
                active: 'Active',
                count: 'Count',
                duration: 'Duration',
                lastDuration: 'LastDuration',
                lastStart: 'LastStart',
                qualityColor: 'QualityColor'
            });

            updateEventHistory(events);

            writeMapped('Events', {
                lastEvent: events.lastType,
                lastTitle: events.lastTitle,
                lastMessage: events.lastMessage,
                criticality: events.lastCriticality,
                timestamp: events.lastTimestamp,
                counter: events.sequence
            }, {
                lastEvent: 'LastEvent',
                lastTitle: 'LastTitle',
                lastMessage: 'LastMessage',
                criticality: 'Criticality',
                timestamp: 'Timestamp',
                counter: 'Counter'
            });

            write('Energy.PeriodComparisonJson', buildEnergyPeriodComparisonJson());

            updateStatisticsOutputs();

            publishHeatingOptimization(heatingOptimization);

            updateCounter += 1;
            const allValid = temperatures.valid && compressor.valid && energy.valid && defrost.valid;

            writeMapped('System', {
                version: CONFIG.VERSION,
                status: allValid ? 'OK' : 'TEILWEISE',
                dataValid: allValid,
                lastUpdate: localIso(),
                updateCounter: updateCounter,
                errorCounter: errorCounter,
                structureVersion: CONFIG.STRUCTURE_VERSION,
                healthPercent: health.percent,
                healthState: health.label,
                healthColor: health.color,
                healthMessage: health.message,
                technicalState: technical.state,
                technicalStateCode: technical.code,
                technicalMessage: technical.message,
                ruecksprung: '← RÜCKSPRUNG'
            }, {
                version: 'Version',
                status: 'Status',
                dataValid: 'DataValid',
                lastUpdate: 'LastUpdate',
                updateCounter: 'UpdateCounter',
                errorCounter: 'ErrorCounter',
                structureVersion: 'StructureVersion',
                healthPercent: 'HealthPercent',
                healthState: 'HealthState',
                healthColor: 'HealthColor',
                healthMessage: 'HealthMessage',
                technicalState: 'TechnicalState',
                technicalStateCode: 'TechnicalStateCode',
                technicalMessage: 'TechnicalMessage',
                ruecksprung: 'Ruecksprung'
            });

            debug('Aktualisierung abgeschlossen: ' + reason);
        } catch (error) {
            errorCounter += 1;
            write('System.Status', 'FEHLER');
            write('System.ErrorCounter', errorCounter);
            warn('Aktualisierung fehlgeschlagen: ' + error);
        } finally {
            running = false;

            if (pending) {
                setTimeout(function () {
                    updateDashboard('VORGEMERKT');
                }, 250);
            }
        }
    }

    function requestUpdate(reason) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            debounceTimer = null;
            updateDashboard(reason);
        }, CONFIG.EVENT_DEBOUNCE_MS);
    }


    function registerTriggers() {
        const triggers = [
            SOURCE.STATE,
            SOURCE.MODE,
            SOURCE.TEMP_LAST_UPDATE,
            SOURCE.TEMP_SUPPLY_TARGET,
            SOURCE.TEMP_WARMWATER,
            SOURCE.TEMP_WARMWATER_CHARGING,
            SOURCE.THERMAL_POWER,
            SOURCE.COMP_LAST_UPDATE,
            SOURCE.AUX_POWER,
            SOURCE.AUX_MODE,
            SOURCE.ENERGY_LAST_UPDATE,
            SOURCE.ELECTRICAL_TOTAL,
            SOURCE.ELECTRICAL_POWER,
            SOURCE.ELECTRICAL_NIBE_COUNTER,
            SOURCE.ELECTRICAL_OFFSET,
            SOURCE.ELECTRICAL_OFFSET_STATUS,
            SOURCE.ELECTRICAL_VALID,
            SOURCE.ELECTRICAL_LAST_UPDATE,
            SOURCE.DEFROST_ACTIVE,
            SOURCE.DEFROST_COUNT,
            SOURCE.EVENT_SEQUENCE,
            SOURCE.RECORDING_ACTIVE,
            SOURCE.CYCLE_CURRENT_DURATION,
            SOURCE.CYCLE_ID,
            SOURCE.TECH_UNREACH,
            SOURCE.TECH_ALARM_NUMBER,
            SOURCE.STAT_DAY_ELECTRIC_TOTAL,
            SOURCE.STAT_DAY_ELECTRIC_HEATING,
            SOURCE.STAT_DAY_ELECTRIC_WARMWATER,
            SOURCE.STAT_DAY_HEAT_HEATING,
            SOURCE.STAT_DAY_HEAT_WARMWATER,
            SOURCE.STAT_DAY_HEAT_HEATING_COMP,
            SOURCE.STAT_DAY_HEAT_WARMWATER_COMP,
            SOURCE.STAT_DAY_COMP_RUNTIME,
            SOURCE.STAT_DAY_COMP_STARTS,
            SOURCE.STAT_SAVE_DAY_COMP_RUNTIME,
            SOURCE.STAT_SAVE_DAY_COMP_STARTS,
            SOURCE.STAT_SAVE_DAY_ELECTRIC_TOTAL,
            SOURCE.STAT_SAVE_DAY_ELECTRIC_HEATING,
            SOURCE.STAT_SAVE_DAY_ELECTRIC_WARMWATER,
            SOURCE.STAT_SAVE_DAY_ELECTRIC_ZH_HEATING,
            SOURCE.STAT_SAVE_DAY_ELECTRIC_ZH_WARMWATER,
            SOURCE.STAT_SAVE_DAY_HEAT_TOTAL,
            SOURCE.STAT_SAVE_DAY_HEAT_HEATING,
            SOURCE.STAT_SAVE_DAY_HEAT_WARMWATER,
            SOURCE.STAT_SAVE_DAY_HEAT_HEATING_COMP,
            SOURCE.STAT_SAVE_DAY_HEAT_WARMWATER_COMP,
            SOURCE.STAT_YEAR_ELECTRIC_TOTAL,
            SOURCE.STAT_YEAR_ELECTRIC_HEATING,
            SOURCE.STAT_YEAR_ELECTRIC_WARMWATER,
            SOURCE.STAT_YEAR_HEAT_HEATING,
            SOURCE.STAT_YEAR_HEAT_WARMWATER,
            SOURCE.STAT_YEAR_HEAT_HEATING_COMP,
            SOURCE.STAT_YEAR_HEAT_WARMWATER_COMP,
            SOURCE.HEATING_AI_GENERATED_AT,
            SOURCE.HEATING_STATUS_LAST_CALCULATION,
            SOURCE.HEATING_STATUS_SOURCE_CHECK_JSON,
            SOURCE.HEATING_ROOMS_JSON,
            SOURCE.HEATING_ANALYSIS_EVIDENCE_JSON,
            heatingSource('Configuration.ChangedAt'),
            id('Configuration.ElectricityPrice')
        ].filter(function (sourceId, index, all) {
            return existsState(sourceId) && all.indexOf(sourceId) === index;
        });

        if (triggers.length > 0) {
            on({ id: triggers, change: 'ne' }, function () {
                requestUpdate('EREIGNIS');
            });
        }

        info(triggers.length + ' Ereignis-Trigger registriert.');
    }

    function start() {
        createStructure();

        waitForTargetStates(function (ready, missing) {
            if (!ready) {
                errorCounter += 1;
                warn(
                    'Start abgebrochen. Zielstruktur nach ' +
                    CONFIG.STRUCTURE_WAIT_TIMEOUT_MS +
                    ' ms unvollständig: ' +
                    missing.join(', ')
                );

                if (existsState(id('System.Status'))) {
                    setState(id('System.Status'), 'STRUKTUR_FEHLER', true);
                }
                return;
            }

            setTimeout(function () {
                write('System.Version', CONFIG.VERSION);
                write('System.StructureVersion', CONFIG.STRUCTURE_VERSION);
                write('System.Status', 'INITIALISIERUNG');

                const selfTest = runSelfTest();

                if (!selfTest.ok) {
                    errorCounter += 1;
                    write('System.ErrorCounter', errorCounter);
                    warn('SelfTest fehlgeschlagen.');
                    return;
                }

                publishHelpDocumentation();
                registerTriggers();

                scheduleHandle = schedule(CONFIG.UPDATE_CRON, function () {
                    updateDashboard('ZEITPLAN');
                });

                updateDashboard('SCRIPTSTART');
                info('Version ' + CONFIG.VERSION + ' gestartet.');
            }, CONFIG.STATE_CREATE_DELAY_MS);
        });
    }

    onStop(function (callback) {
        try {
            if (scheduleHandle) clearSchedule(scheduleHandle);
            if (debounceTimer) clearTimeout(debounceTimer);

            if (existsState(id('System.Status'))) {
                setState(id('System.Status'), 'GESTOPPT', true);
            }
        } catch (error) {
            warn('Fehler beim Stoppen: ' + error);
        }

        callback();
    }, 2000);

    start();
})();

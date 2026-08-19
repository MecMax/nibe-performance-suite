/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker 
 * -----------------------------------------------------------------------------
 * Modul:               13_NPS_CycleAnalyzer
 * Datei:               13_NPS_CycleAnalyzer.js
 * Version:             2.4.0
 * Build:               2026-07-28
 * Modulstatus:         STABIL
 * Architektur-Schicht: Zyklusanalyse / fachliche Auswertung
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Analysiert den zuletzt vom CycleRecorder abgeschlossenen Lauf. Das Modul
 * validiert das Recorder-JSON, trennt Vorlauf, Hauptlauf und Nachlauf, ermittelt
 * Kennzahlen zu Verdichter, Temperaturen, Leistung, Energie, Ereignissen und
 * Datenqualität und publiziert einen vollständigen CycleReport.
 *
 * Eingänge (nur lesend)
 * ---------------------
 * - 0_userdata.0.NPS.CycleRecorder.LastRun.Json
 * - 0_userdata.0.NPS.CycleRecorder.LastRun.Id als Commit- und Triggersignal
 * - Konfiguration unter 0_userdata.0.NPS.CycleAnalyzer.Configuration.*
 *
 * Ausgänge / Public API
 * ---------------------
 * - 0_userdata.0.NPS.CycleAnalyzer.Analysis.*
 * - 0_userdata.0.NPS.CycleAnalyzer.Compressor.*
 * - 0_userdata.0.NPS.CycleAnalyzer.Temperature.*
 * - 0_userdata.0.NPS.CycleAnalyzer.Power.*
 * - 0_userdata.0.NPS.CycleAnalyzer.Energy.*
 * - 0_userdata.0.NPS.CycleAnalyzer.Events.*
 * - 0_userdata.0.NPS.CycleAnalyzer.Quality.*
 * - 0_userdata.0.NPS.CycleAnalyzer.Report.Text / Report.Json
 * - 0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
 * - 0_userdata.0.NPS.CycleAnalyzer.System.* / Diagnostics.*
 *
 * Trigger und Ablauf
 * ------------------
 * - Optionales Analysieren des vorhandenen letzten Laufs beim Skriptstart
 * - Ereignisgetriggerte Analyse nach Änderung von CycleRecorder.LastRun.Id
 * - Validierung von Schema, Lauf-ID, Zeitstempeln und Samples
 * - Schutz vor Doppelanalyse über Memory.LastProcessedRunId
 * - Serielle Abarbeitung überlappender Anforderungen mit vorgemerktetem Nachlauf
 * - Publikation der Einzelkennzahlen, des Berichts und des vollständigen
 *   CycleReports; erst danach wird die Lauf-ID als verarbeitet markiert
 *
 * Abhängigkeiten
 * ---------------
 * - 98_NPS_CycleRecorder als Quelle abgeschlossener Laufaufzeichnungen
 * - 11_NPS_InfluxAdapter als nachgelagerter Historienkonsument
 * - 14_NPS_PerformanceAnalyzer als nachgelagerter Analyse-Konsument
 * - ioBroker JavaScript-Adapter
 *
 * Architekturregeln
 * -----------------
 * - Keine Aufzeichnung von Rohwerten und keine Historienabfrage
 * - Keine Mehrzyklus- oder Performancebewertung
 * - Single Writer für 0_userdata.0.NPS.CycleAnalyzer
 * - Vollständiger CycleReport ist der stabile Übergabevertrag zur Persistenz
 * - Keine Zusammenlegung mit CycleRecorder, InfluxAdapter oder PerformanceAnalyzer
 *
 * Änderungsverlauf
 * ----------------
 * 2.4.0 | 2026-07-29
 *       | Analyzer-Fallback für thermische Zyklusenergie vollständig auf
 *       | NPS VirtualMeters inklusive Zusatzheizung umgestellt.
 *       | Direkte Alias-Zugriffe auf NIBE-Wärmezähler wurden entfernt.
 *       | Bestehende Public API und CycleReport-Vertrag bleiben erhalten.
 * 2.3.0 | 2026-07-28
 *       | Übernimmt die integrierte elektrische Zyklusenergie sowie die
 *       | typbezogene thermische Zählerdifferenz aus Recorder 2.3.0.
 *       | Neue Diagnosewerte für Zusatzheizung und Integrationsabdeckung.
 *       | Fallback nutzt dieselben neuen Quellen; langsame Gesamtzähler
 *       | werden nicht mehr als primäre COP-Basis verwendet.
 *       | Bestehende Public API bleibt erhalten.
 * 2.2.0 | 2026-07-27
 *       | Einheitliche COP-Bilanz aus Recorder-Summary übernommen.
 *       | Elektrische Energie basiert auf Alias-Gesamtverbrauch,
 *       | thermische Energie auf typabhängigem VirtualMeter inkl. Zusatzheizung.
 *       | Start-, End- und Deltawerte sowie Quellen werden im CycleReport erhalten.
 *       | Fallback-Berechnung nutzt dieselben Hauptlauf-Grenzen und Quellen.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Eingänge, Public API, Trigger,
 *       | Abhängigkeiten und Modulgrenzen dokumentiert.
 *       | MODULE.VERSION auf 1.0.1 angehoben.
 *       | Keine Änderung an Validierung, Kennzahlen, Qualitätsbewertung,
 *       | Bericht, CycleReport oder Triggerlogik.
 * 0.3.0-dev
 *       | Vollständiger CycleReport für Historisierung und InfluxAdapter.
 * 0.2.0-dev
 *       | Typcodes, Laufnummer und persistenter Doppelanalyseschutz.
 ****************************************************************************/

'use strict';

/**
 * NIBE Performance Suite
 * 13_NPS_CycleAnalyzer
 * Version 2.4.0
 *
 * Analysiert automatisch den letzten, vom CycleRecorder abgeschlossenen Lauf.
 * v0.2 ergänzt Influx-taugliche Typcodes, eine Laufnummer und einen persistenten
 * Schutz vor doppelter Auswertung derselben Recorder-Lauf-ID.
 * v0.3 ergänzt einen einzelnen, vollständigen CycleReport-Datenpunkt für die
 * effiziente Historisierung und spätere Abfrage über den NPS InfluxAdapter.
 * Die komplette Datenpunktstruktur wird durch dieses Skript selbst angelegt.
 *
 * Erwartete Quelle:
 *   0_userdata.0.NPS.CycleRecorder.LastRun.Json
 *
 * Trigger:
 *   0_userdata.0.NPS.CycleRecorder.LastRun.Id
 */

const MODULE = Object.freeze({
    NAME: 'NPS CycleAnalyzer',
    VERSION: '2.4.0',
    ROOT: '0_userdata.0.NPS.CycleAnalyzer'
});

const CONFIG = Object.freeze({
    SOURCE_JSON: '0_userdata.0.NPS.CycleRecorder.LastRun.Json',
    SOURCE_ID: '0_userdata.0.NPS.CycleRecorder.LastRun.Id',
    SUPPORTED_SCHEMA_VERSIONS: [2],
    DEFAULTS: Object.freeze({
        ENABLED: true,
        ANALYZE_ON_STARTUP: true,
        MINIMUM_QUALITY_SCORE: 70,
        DEBUG: false
    }),
    MAX_REPORT_JSON_LENGTH: 200000,
    TIMESTAMP_TOLERANCE_FACTOR: 1.75
});

const TYPE_CODES = Object.freeze({
    HEIZUNG: 1,
    WARMWASSER: 2,
    ABTAUUNG: 3
});

let analysisRunning = false;
let rerunRequested = false;

function id(path) {
    return `${MODULE.ROOT}.${path}`;
}

function nowText() {
    return new Date().toLocaleString('de-DE');
}

function round(value, digits = 1) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function asNumber(value) {
    if (isFiniteNumber(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function asBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false' || value === null || value === undefined) return false;
    return Boolean(value);
}

function typeCode(type) {
    const normalized = String(type || '').trim().toUpperCase();
    return TYPE_CODES[normalized] || 0;
}

function parseTimestamp(value) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rest = s % 60;
    if (h > 0) return `${h} h ${m} min ${rest} s`;
    return `${m} min ${rest} s`;
}

function getPath(object, path) {
    return path.split('.').reduce((current, key) =>
        current !== null && current !== undefined ? current[key] : undefined, object);
}

function numericValues(samples, path, predicate = null) {
    const values = [];
    for (const sample of samples) {
        if (predicate && !predicate(sample)) continue;
        const value = asNumber(getPath(sample, path));
        if (value !== null) values.push(value);
    }
    return values;
}

function stats(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return { count: 0, first: null, last: null, min: null, max: null, average: null };
    }
    let sum = 0;
    let min = values[0];
    let max = values[0];
    for (const value of values) {
        sum += value;
        if (value < min) min = value;
        if (value > max) max = value;
    }
    return {
        count: values.length,
        first: values[0],
        last: values[values.length - 1],
        min,
        max,
        average: sum / values.length
    };
}

function countChanges(samples, path) {
    let count = 0;
    let previous;
    let initialized = false;
    for (const sample of samples) {
        const current = getPath(sample, path);
        if (current === undefined || current === null) continue;
        if (initialized && current !== previous) count++;
        previous = current;
        initialized = true;
    }
    return count;
}

function countRisingEdges(samples, path) {
    let count = 0;
    let previous = false;
    let initialized = false;
    for (const sample of samples) {
        const raw = getPath(sample, path);
        if (raw === undefined || raw === null) continue;
        const current = asBoolean(raw);
        if (initialized && !previous && current) count++;
        previous = current;
        initialized = true;
    }
    return count;
}

function uniqueStateSequence(samples, path) {
    const result = [];
    let previous;
    for (const sample of samples) {
        const value = getPath(sample, path);
        if (value === undefined || value === null || value === '') continue;
        if (value !== previous) result.push(String(value));
        previous = value;
    }
    return result;
}

function setObjectIfMissing(path, objectDefinition) {
    return new Promise((resolve, reject) => {
        if (existsObject(path)) {
            resolve(false);
            return;
        }

        setObject(path, objectDefinition, error => {
            if (error) {
                reject(error);
                return;
            }
            resolve(true);
        });
    });
}

async function ensureFolder(path, name) {
    await setObjectIfMissing(path, {
        type: 'folder',
        common: { name },
        native: {}
    });
}

async function ensureChannel(path, name) {
    await setObjectIfMissing(path, {
        type: 'channel',
        common: { name },
        native: {}
    });
}

async function ensureState(path, common, initialValue) {
    const created = await setObjectIfMissing(path, {
        type: 'state',
        common: {
            read: true,
            write: false,
            ...common
        },
        native: {}
    });

    // Bei neu angelegten Datenpunkten existiert noch kein State-Wert.
    // Deshalb nicht sofort getState() aufrufen – ioBroker protokolliert das
    // sonst als "getState ... not found". Der Initialwert wird direkt gesetzt.
    if (created) {
        setState(path, initialValue, true);
        return;
    }

    const state = getState(path);
    if (!state || state.val === null || state.val === undefined) {
        setState(path, initialValue, true);
    }
}

async function createStructure() {
    await ensureFolder(MODULE.ROOT, MODULE.NAME);

    await ensureChannel(id('Configuration'), 'Konfiguration');
    await ensureState(id('Configuration.Enabled'), {
        name: 'Modul aktiviert', type: 'boolean', role: 'switch.enable', write: true
    }, CONFIG.DEFAULTS.ENABLED);
    await ensureState(id('Configuration.AnalyzeOnStartup'), {
        name: 'Beim Skriptstart analysieren', type: 'boolean', role: 'switch.enable', write: true
    }, CONFIG.DEFAULTS.ANALYZE_ON_STARTUP);
    await ensureState(id('Configuration.MinimumQualityScore'), {
        name: 'Minimaler Qualitätswert', type: 'number', role: 'level', unit: '%', min: 0, max: 100, write: true
    }, CONFIG.DEFAULTS.MINIMUM_QUALITY_SCORE);
    await ensureState(id('Configuration.Debug'), {
        name: 'Debug-Ausgaben aktiviert', type: 'boolean', role: 'switch', write: true
    }, CONFIG.DEFAULTS.DEBUG);

    await ensureChannel(id('System'), 'System');
    await ensureState(id('System.Version'), { name: 'Modulversion', type: 'string', role: 'text' }, MODULE.VERSION);
    await ensureState(id('System.Active'), { name: 'Modul aktiv', type: 'boolean', role: 'indicator' }, false);
    await ensureState(id('System.Status'), { name: 'Status', type: 'string', role: 'text' }, 'INITIALISIERUNG');
    await ensureState(id('System.LastStart'), { name: 'Letzter Modulstart', type: 'string', role: 'date' }, '');
    await ensureState(id('System.LastAnalysis'), { name: 'Letzte Analyse', type: 'string', role: 'date' }, '');
    await ensureState(id('System.LastMessage'), { name: 'Letzte Meldung', type: 'string', role: 'text' }, '');

    await ensureChannel(id('Analysis'), 'Analyse');
    await ensureState(id('Analysis.Id'), { name: 'Lauf-ID', type: 'string', role: 'text' }, '');
    await ensureState(id('Analysis.Type'), { name: 'Laufart', type: 'string', role: 'text' }, '');
    await ensureState(id('Analysis.TypeCode'), { name: 'Numerischer Laufart-Code', type: 'number', role: 'value' }, 0);
    await ensureState(id('Analysis.RunNumber'), { name: 'Fortlaufende Analysenummer', type: 'number', role: 'value' }, 0);
    await ensureState(id('Analysis.Start'), { name: 'Zyklusstart', type: 'string', role: 'date' }, '');
    await ensureState(id('Analysis.End'), { name: 'Zyklusende', type: 'string', role: 'date' }, '');
    await ensureState(id('Analysis.DurationSeconds'), { name: 'Zyklusdauer', type: 'number', role: 'value.interval', unit: 's' }, 0);
    await ensureState(id('Analysis.RecordingDurationSeconds'), { name: 'Aufzeichnungsdauer', type: 'number', role: 'value.interval', unit: 's' }, 0);
    await ensureState(id('Analysis.SampleCount'), { name: 'Samples gesamt', type: 'number', role: 'value' }, 0);
    await ensureState(id('Analysis.MainSampleCount'), { name: 'Samples im Hauptlauf', type: 'number', role: 'value' }, 0);
    await ensureState(id('Analysis.PrebufferSampleCount'), { name: 'Samples im Vorlauf', type: 'number', role: 'value' }, 0);
    await ensureState(id('Analysis.PostbufferSampleCount'), { name: 'Samples im Nachlauf', type: 'number', role: 'value' }, 0);
    await ensureState(id('Analysis.Valid'), { name: 'Analyse gültig', type: 'boolean', role: 'indicator' }, false);

    await ensureChannel(id('Compressor'), 'Verdichter');
    await ensureState(id('Compressor.RuntimeSeconds'), { name: 'Verdichterlaufzeit im Zyklus', type: 'number', role: 'value.interval', unit: 's' }, 0);
    await ensureState(id('Compressor.FrequencyMinimum'), { name: 'Minimale Frequenz bei laufendem Verdichter', type: 'number', role: 'value.frequency', unit: 'Hz' }, 0);
    await ensureState(id('Compressor.FrequencyMaximum'), { name: 'Maximale Frequenz', type: 'number', role: 'value.frequency', unit: 'Hz' }, 0);
    await ensureState(id('Compressor.FrequencyAverage'), { name: 'Mittlere Frequenz bei laufendem Verdichter', type: 'number', role: 'value.frequency', unit: 'Hz' }, 0);
    await ensureState(id('Compressor.Starts'), { name: 'Verdichterstarts im Zyklus', type: 'number', role: 'value' }, 0);

    await ensureChannel(id('Temperature'), 'Temperaturen');
    const tempStates = [
        ['OutdoorStart', 'Außentemperatur Start'], ['OutdoorEnd', 'Außentemperatur Ende'],
        ['OutdoorMinimum', 'Außentemperatur Minimum'], ['OutdoorMaximum', 'Außentemperatur Maximum'],
        ['OutdoorAverage', 'Außentemperatur Mittelwert'],
        ['HotWaterTopStart', 'Warmwasser oben Start'], ['HotWaterTopEnd', 'Warmwasser oben Ende'],
        ['HotWaterTopMinimum', 'Warmwasser oben Minimum'], ['HotWaterTopMaximum', 'Warmwasser oben Maximum'],
        ['HotWaterTopRise', 'Warmwasser oben Anstieg'],
        ['HotWaterChargingStart', 'Brauchwasserbereitung Start'], ['HotWaterChargingEnd', 'Brauchwasserbereitung Ende'],
        ['HotWaterChargingMinimum', 'Brauchwasserbereitung Minimum'], ['HotWaterChargingMaximum', 'Brauchwasserbereitung Maximum'],
        ['HotWaterChargingRise', 'Brauchwasserbereitung Anstieg'],
        ['SupplyStart', 'Vorlauf Start'], ['SupplyEnd', 'Vorlauf Ende'], ['SupplyMaximum', 'Vorlauf Maximum'],
        ['ReturnStart', 'Rücklauf Start'], ['ReturnEnd', 'Rücklauf Ende'], ['ReturnMaximum', 'Rücklauf Maximum'],
        ['SpreadMinimum', 'Spreizung Minimum'], ['SpreadMaximum', 'Spreizung Maximum'], ['SpreadAverage', 'Spreizung Mittelwert']
    ];
    for (const [key, name] of tempStates) {
        await ensureState(id(`Temperature.${key}`), {
            name, type: 'number', role: 'value.temperature', unit: key.includes('Spread') || key.includes('Rise') ? 'K' : '°C'
        }, 0);
    }

    await ensureChannel(id('Power'), 'Leistung');
    await ensureState(id('Power.ElectricAverageW'), { name: 'Elektrische Leistung Mittelwert', type: 'number', role: 'value.power', unit: 'W' }, 0);
    await ensureState(id('Power.ElectricMaximumW'), { name: 'Elektrische Leistung Maximum', type: 'number', role: 'value.power', unit: 'W' }, 0);
    await ensureState(id('Power.HeatAverageKW'), { name: 'Wärmeleistung Mittelwert', type: 'number', role: 'value.power', unit: 'kW' }, 0);
    await ensureState(id('Power.HeatMaximumKW'), { name: 'Wärmeleistung Maximum', type: 'number', role: 'value.power', unit: 'kW' }, 0);

    await ensureChannel(id('Energy'), 'Energie');
    await ensureState(id('Energy.ElectricKWh'), { name: 'Elektrische Energie', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.HeatKWh'), { name: 'Wärmeenergie', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.COP'), { name: 'COP', type: 'number', role: 'value' }, 0);
    await ensureState(id('Energy.ElectricIntegratedKWh'), { name: 'Integrierte elektrische Energie', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.AuxiliaryKWh'), { name: 'Energie Zusatzheizung', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.ElectricIntegrationSeconds'), { name: 'Ausgewertete Integrationszeit', type: 'number', role: 'value.interval', unit: 's' }, 0);
    await ensureState(id('Energy.ElectricIntegrationSkippedSeconds'), { name: 'Nicht integrierte Zeit', type: 'number', role: 'value.interval', unit: 's' }, 0);
    await ensureState(id('Energy.EnergyBoundaryValid'), { name: 'Energie-Bilanzgrenzen gültig', type: 'boolean', role: 'indicator' }, false);
    await ensureState(id('Energy.ElectricTotalDeltaKWh'), { name: 'Differenz elektrischer Gesamtzähler', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.AliasConsumptionDeltaKWh'), { name: 'Differenz Alias Gesamtverbrauch', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.AliasProductionDeltaKWh'), { name: 'Differenz Alias Gesamtproduktion', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.ElectricStartKWh'), { name: 'Elektrischer Zählerstand Zyklusstart', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.ElectricEndKWh'), { name: 'Elektrischer Zählerstand Zyklusende', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.HeatStartKWh'), { name: 'Thermischer Zählerstand Zyklusstart', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.HeatEndKWh'), { name: 'Thermischer Zählerstand Zyklusende', type: 'number', role: 'value.energy', unit: 'kWh' }, 0);
    await ensureState(id('Energy.ElectricSource'), { name: 'Quelle elektrische Zyklusenergie', type: 'string', role: 'text' }, '');
    await ensureState(id('Energy.HeatSource'), { name: 'Quelle thermische Zyklusenergie', type: 'string', role: 'text' }, '');
    await ensureState(id('Energy.Boundary'), { name: 'Bilanzgrenzen', type: 'string', role: 'text' }, '');

    await ensureChannel(id('Events'), 'Ereignisse');
    await ensureState(id('Events.DefrostCount'), { name: 'Abtauungen im Zyklus', type: 'number', role: 'value' }, 0);
    await ensureState(id('Events.StateChangeCount'), { name: 'Zustandswechsel im Zyklus', type: 'number', role: 'value' }, 0);
    await ensureState(id('Events.PriorityChangeCount'), { name: 'Prioritätswechsel im Zyklus', type: 'number', role: 'value' }, 0);
    await ensureState(id('Events.StateSequence'), { name: 'Zustandsfolge', type: 'string', role: 'text' }, '');

    await ensureChannel(id('Quality'), 'Datenqualität');
    await ensureState(id('Quality.Score'), { name: 'Qualitätswert', type: 'number', role: 'value', unit: '%', min: 0, max: 100 }, 0);
    await ensureState(id('Quality.Rating'), { name: 'Qualitätsbewertung', type: 'string', role: 'text' }, '');
    await ensureState(id('Quality.Complete'), { name: 'Datensatz vollständig', type: 'boolean', role: 'indicator' }, false);
    await ensureState(id('Quality.ExpectedMainSamples'), { name: 'Erwartete Samples im Hauptlauf', type: 'number', role: 'value' }, 0);
    await ensureState(id('Quality.MissingMainSamples'), { name: 'Fehlende Samples im Hauptlauf', type: 'number', role: 'value' }, 0);
    await ensureState(id('Quality.LargestGapSeconds'), { name: 'Größte Samplelücke', type: 'number', role: 'value.interval', unit: 's' }, 0);
    await ensureState(id('Quality.Warning'), { name: 'Qualitätswarnung', type: 'string', role: 'text' }, '');

    await ensureChannel(id('Report'), 'Bericht');
    await ensureState(id('Report.Text'), { name: 'Analysebericht', type: 'string', role: 'text' }, '');
    await ensureState(id('Report.Json'), { name: 'Aktuelle Analyse als JSON', type: 'string', role: 'json' }, '{}');

    // Dieser Datenpunkt ist die einzige für den InfluxAdapter benötigte Historienquelle.
    // In influxdb.1 bitte mit changesOnly=false historisieren, damit jeder neue Zyklus
    // als vollständiges, in sich geschlossenes JSON-Dokument gespeichert wird.
    await ensureChannel(id('History'), 'Historisierung');
    await ensureState(id('History.CycleReportJson'), {
        name: 'Vollständiger CycleReport für InfluxDB', type: 'string', role: 'json'
    }, '{}');
    await ensureState(id('History.LastArchivedRunNumber'), {
        name: 'Zuletzt bereitgestellte Analysenummer', type: 'number', role: 'value'
    }, 0);
    await ensureState(id('History.LastArchivedAt'), {
        name: 'Zeitpunkt der letzten Bereitstellung', type: 'string', role: 'date'
    }, '');

    await ensureChannel(id('Memory'), 'Persistenter Arbeitsspeicher');
    await ensureState(id('Memory.LastProcessedRunId'), {
        name: 'Zuletzt verarbeitete Lauf-ID', type: 'string', role: 'text'
    }, '');

    await ensureChannel(id('Diagnostics'), 'Diagnose');
    await ensureState(id('Diagnostics.AnalysisCount'), { name: 'Erfolgreiche Analysen', type: 'number', role: 'value' }, 0);
    await ensureState(id('Diagnostics.InvalidCount'), { name: 'Ungültige Analysen', type: 'number', role: 'value' }, 0);
    await ensureState(id('Diagnostics.DuplicateCount'), { name: 'Übersprungene Doppelanalysen', type: 'number', role: 'value' }, 0);
    await ensureState(id('Diagnostics.Warning'), { name: 'Warnung', type: 'string', role: 'text' }, '');
    await ensureState(id('Diagnostics.Trace'), { name: 'Diagnosetrace', type: 'string', role: 'text' }, '');
}

async function readConfig(path, fallback) {
    const state = await getState(id(`Configuration.${path}`));
    return state && state.val !== null && state.val !== undefined ? state.val : fallback;
}

async function debug(message) {
    if (await readConfig('Debug', CONFIG.DEFAULTS.DEBUG)) {
        log(`[${MODULE.NAME}] ${message}`, 'debug');
    }
}

function validateRun(run) {
    const errors = [];
    if (!run || typeof run !== 'object') errors.push('JSON-Wurzel ist kein Objekt');
    if (!run.id || typeof run.id !== 'string') errors.push('id fehlt');
    if (!run.type || typeof run.type !== 'string') errors.push('type fehlt');
    if (!CONFIG.SUPPORTED_SCHEMA_VERSIONS.includes(run.schemaVersion)) {
        errors.push(`Nicht unterstützte schemaVersion: ${run.schemaVersion}`);
    }
    if (parseTimestamp(run.triggerStart) === null) errors.push('triggerStart ungültig');
    if (parseTimestamp(run.triggerEnd) === null) errors.push('triggerEnd ungültig');
    if (!Array.isArray(run.samples) || run.samples.length === 0) errors.push('samples fehlen oder sind leer');
    return errors;
}

function splitSamples(run) {
    const startMs = parseTimestamp(run.triggerStart);
    const endMs = parseTimestamp(run.triggerEnd);
    const normalized = run.samples
        .filter(sample => sample && typeof sample === 'object')
        .map(sample => ({
            ...sample,
            __timestampMs: asNumber(sample.timestampMs) ?? parseTimestamp(sample.timestamp)
        }))
        .filter(sample => sample.__timestampMs !== null)
        .sort((a, b) => a.__timestampMs - b.__timestampMs);

    return {
        all: normalized,
        pre: normalized.filter(sample => sample.__timestampMs < startMs),
        main: normalized.filter(sample => sample.__timestampMs >= startMs && sample.__timestampMs <= endMs),
        post: normalized.filter(sample => sample.__timestampMs > endMs),
        startMs,
        endMs
    };
}

function calculateRuntimeSeconds(samples, nominalIntervalSeconds) {
    if (samples.length === 0) return 0;
    let runtimeMs = 0;
    const maxIntervalMs = nominalIntervalSeconds * 1000 * CONFIG.TIMESTAMP_TOLERANCE_FACTOR;
    for (let index = 0; index < samples.length; index++) {
        if (!asBoolean(getPath(samples[index], 'compressor.running'))) continue;
        let intervalMs = nominalIntervalSeconds * 1000;
        if (index < samples.length - 1) {
            const actual = samples[index + 1].__timestampMs - samples[index].__timestampMs;
            if (actual > 0 && actual <= maxIntervalMs) intervalMs = actual;
        }
        runtimeMs += intervalMs;
    }
    return runtimeMs / 1000;
}

function calculateQuality(run, split) {
    const warnings = [];
    const interval = Math.max(1, asNumber(run.sampleIntervalSeconds) || 10);
    const durationSeconds = Math.max(0, (split.endMs - split.startMs) / 1000);
    const expectedMainSamples = Math.floor(durationSeconds / interval) + 1;
    const missingMainSamples = Math.max(0, expectedMainSamples - split.main.length);

    let largestGapSeconds = 0;
    let irregularGapCount = 0;
    for (let index = 1; index < split.main.length; index++) {
        const gap = (split.main[index].__timestampMs - split.main[index - 1].__timestampMs) / 1000;
        largestGapSeconds = Math.max(largestGapSeconds, gap);
        if (gap > interval * CONFIG.TIMESTAMP_TOLERANCE_FACTOR) irregularGapCount++;
    }

    let score = 100;
    if (expectedMainSamples > 0) {
        score -= Math.min(40, (missingMainSamples / expectedMainSamples) * 100);
    }
    score -= Math.min(20, irregularGapCount * 2);

    const criticalPaths = [
        'compressor.frequencyHz', 'compressor.running',
        'aliases.Outdoor', 'aliases.HotWaterTop', 'aliases.HotWaterCharging',
        'temperatures.supplyC', 'temperatures.returnC', 'temperatures.spreadK'
    ];
    for (const path of criticalPaths) {
        const available = split.main.filter(sample => getPath(sample, path) !== undefined && getPath(sample, path) !== null).length;
        const coverage = split.main.length > 0 ? available / split.main.length : 0;
        if (coverage < 0.98) {
            score -= Math.min(8, (1 - coverage) * 20);
            warnings.push(`${path}: nur ${round(coverage * 100, 1)} % Abdeckung`);
        }
    }

    const recorderMissingSources = getPath(run, 'summary.quality.missingSources');
    if (Array.isArray(recorderMissingSources) && recorderMissingSources.length > 0) {
        score -= Math.min(25, recorderMissingSources.length * 5);
        warnings.push(`Recorder meldet fehlende Quellen: ${recorderMissingSources.join(', ')}`);
    }

    const droppedSamples = asNumber(getPath(run, 'summary.quality.droppedSamples')) || 0;
    if (droppedSamples > 0) {
        score -= Math.min(20, droppedSamples);
        warnings.push(`${droppedSamples} verworfene Samples`);
    }

    if (split.main.length === 0) {
        score = 0;
        warnings.push('Keine Samples im Hauptlauf');
    }

    score = Math.max(0, Math.min(100, round(score, 1)));
    let rating = 'UNGENÜGEND';
    if (score >= 98) rating = 'SEHR GUT';
    else if (score >= 90) rating = 'GUT';
    else if (score >= 70) rating = 'EINGESCHRÄNKT';

    return {
        score,
        rating,
        expectedMainSamples,
        missingMainSamples,
        largestGapSeconds: round(largestGapSeconds, 1),
        complete: score >= 98 && missingMainSamples === 0 && warnings.length === 0,
        warning: warnings.join('; ')
    };
}

function analyze(run) {
    const split = splitSamples(run);
    if (split.main.length === 0) throw new Error('Keine Samples zwischen triggerStart und triggerEnd');

    const interval = Math.max(1, asNumber(run.sampleIntervalSeconds) || 10);
    const runningPredicate = sample =>
        asBoolean(getPath(sample, 'compressor.running')) || (asNumber(getPath(sample, 'compressor.frequencyHz')) || 0) > 0;

    const compressorFrequency = stats(numericValues(split.main, 'compressor.frequencyHz', runningPredicate).filter(value => value > 0));
    const outdoor = stats(numericValues(split.main, 'aliases.Outdoor'));
    const hotWaterTop = stats(numericValues(split.main, 'aliases.HotWaterTop'));
    const hotWaterCharging = stats(numericValues(split.main, 'aliases.HotWaterCharging'));
    const supply = stats(numericValues(split.main, 'temperatures.supplyC'));
    const returnTemp = stats(numericValues(split.main, 'temperatures.returnC'));
    const spread = stats(numericValues(split.main, 'temperatures.spreadK'));
    const electricPower = stats(numericValues(split.main, 'aliases.ElectricPower'));
    const heatPower = stats(numericValues(split.main, 'aliases.HeatPower'));

    const summary = run.summary || {};
    const cycleDurationSeconds = asNumber(getPath(summary, 'cycleDurationSeconds')) ?? ((split.endMs - split.startMs) / 1000);
    const recordingStartMs = parseTimestamp(run.recordingStart);
    const recordingEndMs = parseTimestamp(run.recordingEnd);
    const recordingDurationSeconds = asNumber(getPath(summary, 'recordingDurationSeconds')) ??
        (recordingStartMs !== null && recordingEndMs !== null ? (recordingEndMs - recordingStartMs) / 1000 : 0);

    const quality = calculateQuality(run, split);
    const stateSequence = uniqueStateSequence(split.main, 'stateMachine.current');

    const result = {
        analyzerVersion: MODULE.VERSION,
        analyzedAt: new Date().toISOString(),
        source: {
            schemaVersion: run.schemaVersion,
            recorderVersion: run.recorderVersion || '',
            id: run.id,
            type: run.type
        },
        analysis: {
            id: run.id,
            type: run.type,
            typeCode: typeCode(run.type),
            start: run.triggerStart,
            end: run.triggerEnd,
            durationSeconds: round(cycleDurationSeconds, 0),
            recordingDurationSeconds: round(recordingDurationSeconds, 0),
            sampleCount: split.all.length,
            mainSampleCount: split.main.length,
            prebufferSampleCount: split.pre.length,
            postbufferSampleCount: split.post.length,
            valid: quality.score >= 1
        },
        compressor: {
            runtimeSeconds: round(calculateRuntimeSeconds(split.main, interval), 0),
            frequencyMinimumHz: round(compressorFrequency.min, 1),
            frequencyMaximumHz: round(compressorFrequency.max, 1),
            frequencyAverageHz: round(compressorFrequency.average, 1),
            starts: countRisingEdges(split.main, 'compressor.running')
        },
        temperature: {
            outdoorStartC: round(outdoor.first, 1), outdoorEndC: round(outdoor.last, 1),
            outdoorMinimumC: round(outdoor.min, 1), outdoorMaximumC: round(outdoor.max, 1), outdoorAverageC: round(outdoor.average, 1),
            hotWaterTopStartC: round(hotWaterTop.first, 1), hotWaterTopEndC: round(hotWaterTop.last, 1),
            hotWaterTopMinimumC: round(hotWaterTop.min, 1), hotWaterTopMaximumC: round(hotWaterTop.max, 1),
            hotWaterTopRiseK: hotWaterTop.first !== null && hotWaterTop.last !== null ? round(hotWaterTop.last - hotWaterTop.first, 1) : null,
            hotWaterChargingStartC: round(hotWaterCharging.first, 1), hotWaterChargingEndC: round(hotWaterCharging.last, 1),
            hotWaterChargingMinimumC: round(hotWaterCharging.min, 1), hotWaterChargingMaximumC: round(hotWaterCharging.max, 1),
            hotWaterChargingRiseK: hotWaterCharging.first !== null && hotWaterCharging.last !== null ? round(hotWaterCharging.last - hotWaterCharging.first, 1) : null,
            supplyStartC: round(supply.first, 1), supplyEndC: round(supply.last, 1), supplyMaximumC: round(supply.max, 1),
            returnStartC: round(returnTemp.first, 1), returnEndC: round(returnTemp.last, 1), returnMaximumC: round(returnTemp.max, 1),
            spreadMinimumK: round(spread.min, 1), spreadMaximumK: round(spread.max, 1), spreadAverageK: round(spread.average, 1)
        },
        power: {
            electricAverageW: round(asNumber(getPath(summary, 'power.electricMeanW')) ?? electricPower.average, 1),
            electricMaximumW: round(asNumber(getPath(summary, 'power.electricMaxW')) ?? electricPower.max, 1),
            heatAverageKW: round(asNumber(getPath(summary, 'power.heatMeanKW')) ?? heatPower.average, 2),
            heatMaximumKW: round(asNumber(getPath(summary, 'power.heatMaxKW')) ?? heatPower.max, 2)
        },
        energy: {
            electricStartKWh: round(asNumber(getPath(summary, 'energy.electricStartKWh')), 3),
            electricEndKWh: round(asNumber(getPath(summary, 'energy.electricEndKWh')), 3),
            electricKWh: round(asNumber(getPath(summary, 'energy.electricKWh')), 3),
            heatStartKWh: round(asNumber(getPath(summary, 'energy.heatStartKWh')), 3),
            heatEndKWh: round(asNumber(getPath(summary, 'energy.heatEndKWh')), 3),
            heatKWh: round(asNumber(getPath(summary, 'energy.heatKWh')), 3),
            cop: round(asNumber(getPath(summary, 'energy.cop')), 2),
            electricIntegratedKWh: round(asNumber(getPath(summary, 'energy.electricIntegratedKWh')), 4),
            auxiliaryKWh: round(asNumber(getPath(summary, 'energy.auxiliaryKWh')), 4),
            electricIntegrationSeconds: round(asNumber(getPath(summary, 'energy.electricIntegrationSeconds')), 1),
            electricIntegrationSkippedSeconds: round(asNumber(getPath(summary, 'energy.electricIntegrationSkippedSeconds')), 1),
            energyBoundaryValid: asBoolean(getPath(summary, 'quality.energyBoundaryValid')),
            electricSource: String(getPath(summary, 'energy.source.electric') || ''),
            heatSource: String(getPath(summary, 'energy.source.heat') || ''),
            boundary: String(getPath(summary, 'energy.source.boundary') || ''),
            electricTotalDeltaKWh: round(asNumber(getPath(summary, 'energy.electricTotalDeltaKWh')), 3),
            aliasConsumptionDeltaKWh: round(asNumber(getPath(summary, 'energy.aliasConsumptionDeltaKWh')), 3),
            aliasProductionDeltaKWh: round(asNumber(getPath(summary, 'energy.aliasProductionDeltaKWh')), 3)
        },
        events: {
            defrostCount: countRisingEdges(split.main, 'aliases.Defrost'),
            stateChangeCount: countChanges(split.main, 'stateMachine.current'),
            priorityChangeCount: countChanges(split.main, 'aliases.Priority'),
            stateSequence
        },
        quality
    };

    // Fallback für ältere oder unvollständige Recorder-Summaries:
    // elektrische Leistung trapezförmig integrieren und Wärme aus dem
    // typbezogenen NIBE-Zähler bilden. Langsame Gesamtzähler dienen nicht
    // mehr als primäre COP-Basis.
    if (result.energy.electricKWh === null) {
        const ordered = split.main.slice().sort((a, b) => a.__timestampMs - b.__timestampMs);
        let wattSeconds = 0;
        let integratedSeconds = 0;
        let skippedSeconds = 0;
        const maxGapSeconds = interval * CONFIG.TIMESTAMP_TOLERANCE_FACTOR;

        for (let index = 1; index < ordered.length; index++) {
            const previous = ordered[index - 1];
            const current = ordered[index];
            const deltaSeconds = (current.__timestampMs - previous.__timestampMs) / 1000;
            if (!(deltaSeconds > 0)) continue;
            if (deltaSeconds > maxGapSeconds) {
                skippedSeconds += deltaSeconds;
                continue;
            }

            const previousW = asNumber(getPath(previous, 'aliases.ElectricPower'));
            const currentW = asNumber(getPath(current, 'aliases.ElectricPower'));
            if (previousW === null || currentW === null || previousW < 0 || currentW < 0) {
                skippedSeconds += deltaSeconds;
                continue;
            }

            wattSeconds += ((previousW + currentW) / 2) * deltaSeconds;
            integratedSeconds += deltaSeconds;
        }

        if (integratedSeconds > 0) {
            result.energy.electricIntegratedKWh = round(wattSeconds / 3600000, 4);
            result.energy.electricKWh = result.energy.electricIntegratedKWh;
            result.energy.electricIntegrationSeconds = round(integratedSeconds, 1);
            result.energy.electricIntegrationSkippedSeconds = round(skippedSeconds, 1);
            result.energy.electricSource = 'aliases.ElectricPower (Analyzer-Fallback, trapezförmig)';
            result.energy.boundary = 'triggerStart..triggerEnd';
        }
    }

    if (result.energy.heatKWh === null) {
        const isHeating = String(run.type || '').toUpperCase() === 'HEIZUNG';
        const heatPath = isHeating
            ? 'energy.heatHeatingTotalKWh'
            : 'energy.heatWarmwaterTotalKWh';
        const values = numericValues(split.main, heatPath);
        if (values.length >= 2) {
            result.energy.heatStartKWh = round(values[0], 3);
            result.energy.heatEndKWh = round(values[values.length - 1], 3);
            const delta = values[values.length - 1] - values[0];
            result.energy.heatKWh = delta >= 0 ? round(delta, 3) : null;
            result.energy.heatSource = isHeating
                ? '0_userdata.0.NPS.VirtualMeters.Heizung.InklusiveZusatzheizung'
                : '0_userdata.0.NPS.VirtualMeters.Brauchwasser.InklusiveZusatzheizung';
            result.energy.boundary = 'triggerStart..triggerEnd';
        }
    }

    if (result.energy.cop === null && result.energy.electricKWh > 0.05 && result.energy.heatKWh !== null) {
        result.energy.cop = round(result.energy.heatKWh / result.energy.electricKWh, 2);
    }

    result.energy.energyBoundaryValid =
        result.energy.electricKWh !== null &&
        result.energy.heatKWh !== null &&
        (result.energy.electricIntegrationSkippedSeconds || 0) <= interval * CONFIG.TIMESTAMP_TOLERANCE_FACTOR;

    return result;
}

function numberText(value, digits = 1, suffix = '') {
    if (!Number.isFinite(value)) return 'n/a';
    return `${value.toFixed(digits).replace('.', ',')}${suffix}`;
}

function createTextReport(result) {
    return [
        'NIBE Performance Suite – CycleAnalyzer',
        '=========================================',
        `Lauf: ${result.analysis.id}`,
        `Typ: ${result.analysis.type} (Code ${result.analysis.typeCode})`,
        `Analysenummer: ${result.analysis.runNumber}`,
        `Start: ${result.analysis.start}`,
        `Ende: ${result.analysis.end}`,
        `Dauer: ${formatDuration(result.analysis.durationSeconds)}`,
        '',
        'Daten',
        `Samples: ${result.analysis.mainSampleCount} Hauptlauf / ${result.analysis.sampleCount} gesamt`,
        `Qualität: ${numberText(result.quality.score, 1, ' %')} – ${result.quality.rating}`,
        `Warnung: ${result.quality.warning || 'keine'}`,
        '',
        'Verdichter',
        `Laufzeit: ${formatDuration(result.compressor.runtimeSeconds)}`,
        `Frequenz min/mittel/max: ${numberText(result.compressor.frequencyMinimumHz, 1, ' Hz')} / ${numberText(result.compressor.frequencyAverageHz, 1, ' Hz')} / ${numberText(result.compressor.frequencyMaximumHz, 1, ' Hz')}`,
        `Starts im Zyklus: ${result.compressor.starts}`,
        '',
        'Warmwasser und Temperaturen',
        `Warmwasser oben: ${numberText(result.temperature.hotWaterTopStartC, 1, ' °C')} → ${numberText(result.temperature.hotWaterTopEndC, 1, ' °C')} (Δ ${numberText(result.temperature.hotWaterTopRiseK, 1, ' K')})`,
        `Brauchwasserbereitung: ${numberText(result.temperature.hotWaterChargingStartC, 1, ' °C')} → ${numberText(result.temperature.hotWaterChargingEndC, 1, ' °C')} (Δ ${numberText(result.temperature.hotWaterChargingRiseK, 1, ' K')})`,
        `Außentemperatur Mittel: ${numberText(result.temperature.outdoorAverageC, 1, ' °C')}`,
        `Spreizung min/mittel/max: ${numberText(result.temperature.spreadMinimumK, 1, ' K')} / ${numberText(result.temperature.spreadAverageK, 1, ' K')} / ${numberText(result.temperature.spreadMaximumK, 1, ' K')}`,
        '',
        'Energie und Leistung',
        `Strom: ${numberText(result.energy.electricKWh, 3, ' kWh')}`,
        `davon integriert: ${numberText(result.energy.electricIntegratedKWh, 3, ' kWh')}`,
        `Zusatzheizung: ${numberText(result.energy.auxiliaryKWh, 3, ' kWh')}`,
        `Integrationslücke: ${numberText(result.energy.electricIntegrationSkippedSeconds, 1, ' s')}`,
        `Wärme: ${numberText(result.energy.heatKWh, 3, ' kWh')}`,
        `COP: ${numberText(result.energy.cop, 2)}`,
        `Elektrische Leistung mittel/max: ${numberText(result.power.electricAverageW, 1, ' W')} / ${numberText(result.power.electricMaximumW, 1, ' W')}`,
        `Wärmeleistung mittel/max: ${numberText(result.power.heatAverageKW, 2, ' kW')} / ${numberText(result.power.heatMaximumKW, 2, ' kW')}`,
        '',
        'Ereignisse',
        `Abtauungen: ${result.events.defrostCount}`,
        `Zustandswechsel: ${result.events.stateChangeCount}`,
        `Prioritätswechsel: ${result.events.priorityChangeCount}`,
        `Zustandsfolge: ${result.events.stateSequence.join(' → ') || 'n/a'}`
    ].join('\n');
}

async function writeResult(result) {
    const t = result.temperature;
    const values = {
        'Analysis.Id': result.analysis.id,
        'Analysis.Type': result.analysis.type,
        'Analysis.TypeCode': result.analysis.typeCode,
        'Analysis.RunNumber': result.analysis.runNumber,
        'Analysis.Start': result.analysis.start,
        'Analysis.End': result.analysis.end,
        'Analysis.DurationSeconds': result.analysis.durationSeconds,
        'Analysis.RecordingDurationSeconds': result.analysis.recordingDurationSeconds,
        'Analysis.SampleCount': result.analysis.sampleCount,
        'Analysis.MainSampleCount': result.analysis.mainSampleCount,
        'Analysis.PrebufferSampleCount': result.analysis.prebufferSampleCount,
        'Analysis.PostbufferSampleCount': result.analysis.postbufferSampleCount,
        'Analysis.Valid': result.analysis.valid,
        'Compressor.RuntimeSeconds': result.compressor.runtimeSeconds,
        'Compressor.FrequencyMinimum': result.compressor.frequencyMinimumHz ?? 0,
        'Compressor.FrequencyMaximum': result.compressor.frequencyMaximumHz ?? 0,
        'Compressor.FrequencyAverage': result.compressor.frequencyAverageHz ?? 0,
        'Compressor.Starts': result.compressor.starts,
        'Temperature.OutdoorStart': t.outdoorStartC ?? 0,
        'Temperature.OutdoorEnd': t.outdoorEndC ?? 0,
        'Temperature.OutdoorMinimum': t.outdoorMinimumC ?? 0,
        'Temperature.OutdoorMaximum': t.outdoorMaximumC ?? 0,
        'Temperature.OutdoorAverage': t.outdoorAverageC ?? 0,
        'Temperature.HotWaterTopStart': t.hotWaterTopStartC ?? 0,
        'Temperature.HotWaterTopEnd': t.hotWaterTopEndC ?? 0,
        'Temperature.HotWaterTopMinimum': t.hotWaterTopMinimumC ?? 0,
        'Temperature.HotWaterTopMaximum': t.hotWaterTopMaximumC ?? 0,
        'Temperature.HotWaterTopRise': t.hotWaterTopRiseK ?? 0,
        'Temperature.HotWaterChargingStart': t.hotWaterChargingStartC ?? 0,
        'Temperature.HotWaterChargingEnd': t.hotWaterChargingEndC ?? 0,
        'Temperature.HotWaterChargingMinimum': t.hotWaterChargingMinimumC ?? 0,
        'Temperature.HotWaterChargingMaximum': t.hotWaterChargingMaximumC ?? 0,
        'Temperature.HotWaterChargingRise': t.hotWaterChargingRiseK ?? 0,
        'Temperature.SupplyStart': t.supplyStartC ?? 0,
        'Temperature.SupplyEnd': t.supplyEndC ?? 0,
        'Temperature.SupplyMaximum': t.supplyMaximumC ?? 0,
        'Temperature.ReturnStart': t.returnStartC ?? 0,
        'Temperature.ReturnEnd': t.returnEndC ?? 0,
        'Temperature.ReturnMaximum': t.returnMaximumC ?? 0,
        'Temperature.SpreadMinimum': t.spreadMinimumK ?? 0,
        'Temperature.SpreadMaximum': t.spreadMaximumK ?? 0,
        'Temperature.SpreadAverage': t.spreadAverageK ?? 0,
        'Power.ElectricAverageW': result.power.electricAverageW ?? 0,
        'Power.ElectricMaximumW': result.power.electricMaximumW ?? 0,
        'Power.HeatAverageKW': result.power.heatAverageKW ?? 0,
        'Power.HeatMaximumKW': result.power.heatMaximumKW ?? 0,
        'Energy.ElectricKWh': result.energy.electricKWh ?? 0,
        'Energy.HeatKWh': result.energy.heatKWh ?? 0,
        'Energy.COP': result.energy.cop ?? 0,
        'Energy.ElectricIntegratedKWh': result.energy.electricIntegratedKWh ?? 0,
        'Energy.AuxiliaryKWh': result.energy.auxiliaryKWh ?? 0,
        'Energy.ElectricIntegrationSeconds': result.energy.electricIntegrationSeconds ?? 0,
        'Energy.ElectricIntegrationSkippedSeconds': result.energy.electricIntegrationSkippedSeconds ?? 0,
        'Energy.EnergyBoundaryValid': result.energy.energyBoundaryValid,
        'Energy.ElectricTotalDeltaKWh': result.energy.electricTotalDeltaKWh ?? 0,
        'Energy.AliasConsumptionDeltaKWh': result.energy.aliasConsumptionDeltaKWh ?? 0,
        'Energy.AliasProductionDeltaKWh': result.energy.aliasProductionDeltaKWh ?? 0,
        'Energy.ElectricStartKWh': result.energy.electricStartKWh ?? 0,
        'Energy.ElectricEndKWh': result.energy.electricEndKWh ?? 0,
        'Energy.HeatStartKWh': result.energy.heatStartKWh ?? 0,
        'Energy.HeatEndKWh': result.energy.heatEndKWh ?? 0,
        'Energy.ElectricSource': result.energy.electricSource || '',
        'Energy.HeatSource': result.energy.heatSource || '',
        'Energy.Boundary': result.energy.boundary || '',
        'Events.DefrostCount': result.events.defrostCount,
        'Events.StateChangeCount': result.events.stateChangeCount,
        'Events.PriorityChangeCount': result.events.priorityChangeCount,
        'Events.StateSequence': result.events.stateSequence.join(' -> '),
        'Quality.Score': result.quality.score,
        'Quality.Rating': result.quality.rating,
        'Quality.Complete': result.quality.complete,
        'Quality.ExpectedMainSamples': result.quality.expectedMainSamples,
        'Quality.MissingMainSamples': result.quality.missingMainSamples,
        'Quality.LargestGapSeconds': result.quality.largestGapSeconds,
        'Quality.Warning': result.quality.warning,
        'Report.Text': createTextReport(result)
    };

    let resultJson = JSON.stringify(result);
    if (resultJson.length > CONFIG.MAX_REPORT_JSON_LENGTH) {
        resultJson = JSON.stringify({ error: 'Analyse-JSON überschreitet Größenlimit', id: result.analysis.id });
    }
    values['Report.Json'] = resultJson;

    // Der CycleReport wird bewusst erst nach der vollständig aufgebauten Analyse
    // geschrieben. Durch analyzedAt und runNumber ist jeder Wert eindeutig und löst
    // auch bei inhaltlich ähnlichen Zyklen einen neuen Historieneintrag aus.
    values['History.CycleReportJson'] = resultJson;
    values['History.LastArchivedRunNumber'] = result.analysis.runNumber;
    values['History.LastArchivedAt'] = result.analyzedAt;

    for (const [path, value] of Object.entries(values)) {
        await setState(id(path), value, true);
    }
}

async function increment(path) {
    const state = await getState(id(path));
    const value = state && Number.isFinite(Number(state.val)) ? Number(state.val) : 0;
    await setState(id(path), value + 1, true);
}

function readNumber(path, fallback = 0) {
    const state = getState(id(path));
    const value = state ? Number(state.val) : NaN;
    return Number.isFinite(value) ? value : fallback;
}

function readText(path, fallback = '') {
    const state = getState(id(path));
    return state && state.val !== null && state.val !== undefined ? String(state.val) : fallback;
}

async function migratePersistentState() {
    const lastProcessed = readText('Memory.LastProcessedRunId');
    const existingAnalysisId = readText('Analysis.Id');
    const existingRunNumber = readNumber('Analysis.RunNumber', 0);

    // Upgrade von v0.1: Ein bereits ausgewerteter Lauf wird als verarbeitet markiert,
    // damit der Skriptstart nicht sofort einen doppelten Influx-Eintrag erzeugt.
    if (!lastProcessed && existingAnalysisId) {
        await setState(id('Memory.LastProcessedRunId'), existingAnalysisId, true);
        if (existingRunNumber < 1) {
            await setState(id('Analysis.RunNumber'), 1, true);
        }
        await debug(`Migration: vorhandener Lauf ${existingAnalysisId} als verarbeitet übernommen`);
    }
}

async function setSystem(status, message) {
    await setState(id('System.Status'), status, true);
    await setState(id('System.LastMessage'), message, true);
}

async function performAnalysis(reason) {
    if (analysisRunning) {
        rerunRequested = true;
        await debug(`Analyse läuft bereits; erneute Ausführung vorgemerkt (${reason})`);
        return;
    }

    analysisRunning = true;
    try {
        const enabled = asBoolean(await readConfig('Enabled', CONFIG.DEFAULTS.ENABLED));
        if (!enabled) {
            await setSystem('DEAKTIVIERT', 'CycleAnalyzer ist deaktiviert');
            return;
        }

        await setSystem('ANALYSE', `Analyse gestartet (${reason})`);
        await setState(id('Diagnostics.Warning'), '', true);

        const source = await getState(CONFIG.SOURCE_JSON);
        if (!source || typeof source.val !== 'string' || source.val.trim() === '') {
            throw new Error(`Quelle fehlt oder ist leer: ${CONFIG.SOURCE_JSON}`);
        }

        let run;
        try {
            run = JSON.parse(source.val);
        } catch (error) {
            throw new Error(`CycleRecorder-JSON ist ungültig: ${error.message}`);
        }

        const validationErrors = validateRun(run);
        if (validationErrors.length > 0) {
            throw new Error(validationErrors.join('; '));
        }

        const lastProcessedRunId = readText('Memory.LastProcessedRunId');
        if (lastProcessedRunId && lastProcessedRunId === run.id) {
            await increment('Diagnostics.DuplicateCount');
            await setState(id('Diagnostics.Trace'), [
                nowText(),
                `Reason=${reason}`,
                `RunId=${run.id}`,
                'Ergebnis=ÜBERSPRUNGEN',
                'Grund=Lauf-ID wurde bereits verarbeitet'
            ].join('\n'), true);
            await setSystem('BEREIT', `Lauf ${run.id} bereits verarbeitet – keine erneute Analyse`);
            await debug(`Doppelanalyse verhindert: ${run.id}`);
            return;
        }

        const result = analyze(run);
        result.analysis.runNumber = readNumber('Analysis.RunNumber', 0) + 1;
        const minimumQuality = Number(await readConfig('MinimumQualityScore', CONFIG.DEFAULTS.MINIMUM_QUALITY_SCORE));
        if (result.quality.score < minimumQuality) {
            result.analysis.valid = false;
            result.quality.warning = [
                result.quality.warning,
                `Qualitätswert ${result.quality.score} liegt unter Mindestwert ${minimumQuality}`
            ].filter(Boolean).join('; ');
        }

        await writeResult(result);
        // Erst nach vollständig geschriebenem Ergebnis als verarbeitet markieren.
        await setState(id('Memory.LastProcessedRunId'), result.analysis.id, true);
        await increment('Diagnostics.AnalysisCount');
        await setState(id('System.LastAnalysis'), nowText(), true);
        await setState(id('Diagnostics.Trace'), [
            nowText(),
            `Reason=${reason}`,
            `RunId=${result.analysis.id}`,
            `Type=${result.analysis.type}`,
            `TypeCode=${result.analysis.typeCode}`,
            `RunNumber=${result.analysis.runNumber}`,
            `Duration=${result.analysis.durationSeconds}s`,
            `MainSamples=${result.analysis.mainSampleCount}`,
            `CompressorRuntime=${result.compressor.runtimeSeconds}s`,
            `Frequency=${result.compressor.frequencyMinimumHz}/${result.compressor.frequencyAverageHz}/${result.compressor.frequencyMaximumHz} Hz`,
            `Electric=${result.energy.electricKWh} kWh`,
            `ElectricIntegrated=${result.energy.electricIntegratedKWh} kWh`,
            `Auxiliary=${result.energy.auxiliaryKWh} kWh`,
            `IntegrationGap=${result.energy.electricIntegrationSkippedSeconds}s`,
            `Heat=${result.energy.heatKWh} kWh`,
            `COP=${result.energy.cop}`,
            `Quality=${result.quality.score}% (${result.quality.rating})`,
            `CycleReport=History.CycleReportJson`
        ].join('\n'), true);

        await setSystem(result.analysis.valid ? 'BEREIT' : 'WARNUNG',
            result.analysis.valid ? `Lauf ${result.analysis.id} erfolgreich analysiert` : `Lauf ${result.analysis.id} nur eingeschränkt auswertbar`);

        log(`[${MODULE.NAME}] Lauf ${result.analysis.id} analysiert: COP=${result.energy.cop}, Qualität=${result.quality.score}%`, 'info');
    } catch (error) {
        await increment('Diagnostics.InvalidCount');
        await setState(id('Analysis.Valid'), false, true);
        await setState(id('Diagnostics.Warning'), error.message, true);
        await setState(id('Diagnostics.Trace'), `${nowText()}\nFehler=${error.stack || error.message}`, true);
        await setSystem('FEHLER', error.message);
        log(`[${MODULE.NAME}] ${error.stack || error.message}`, 'error');
    } finally {
        analysisRunning = false;
        if (rerunRequested) {
            rerunRequested = false;
            setTimeout(() => performAnalysis('NACHLAUF'), 250);
        }
    }
}

async function main() {
    try {
        await createStructure();
        await migratePersistentState();
        await setState(id('System.Version'), MODULE.VERSION, true);
        await setState(id('System.Active'), true, true);
        await setState(id('System.LastStart'), nowText(), true);
        await setSystem('BEREIT', 'CycleAnalyzer initialisiert');

        const sourceObject = await getObject(CONFIG.SOURCE_JSON);
        if (!sourceObject) {
            await setState(id('Diagnostics.Warning'), `Quell-Datenpunkt fehlt: ${CONFIG.SOURCE_JSON}`, true);
            await setSystem('WARTET', 'CycleRecorder-Quelle noch nicht vorhanden');
        }

        on({ id: CONFIG.SOURCE_ID, change: 'ne' }, () => {
            setTimeout(() => performAnalysis('NEUER LAUF'), 500);
        });

        on({ id: id('Configuration.Enabled'), change: 'ne' }, async obj => {
            if (obj && obj.state && asBoolean(obj.state.val)) {
                await setState(id('System.Active'), true, true);
                await performAnalysis('AKTIVIERT');
            } else {
                await setState(id('System.Active'), false, true);
                await setSystem('DEAKTIVIERT', 'CycleAnalyzer deaktiviert');
            }
        });

        const analyzeOnStartup = asBoolean(await readConfig('AnalyzeOnStartup', CONFIG.DEFAULTS.ANALYZE_ON_STARTUP));
        const enabled = asBoolean(await readConfig('Enabled', CONFIG.DEFAULTS.ENABLED));
        if (enabled && analyzeOnStartup) {
            await performAnalysis('SKRIPTSTART');
        }
    } catch (error) {
        log(`[${MODULE.NAME}] Start fehlgeschlagen: ${error.stack || error.message}`, 'error');
        try {
            await setState(id('System.Active'), false, true);
            await setSystem('FEHLER', `Start fehlgeschlagen: ${error.message}`);
        } catch (_) {
            // Datenpunktstruktur konnte möglicherweise nicht vollständig angelegt werden.
        }
    }
}

onStop(async callback => {
    try {
        await setState(id('System.Active'), false, true);
        await setSystem('GESTOPPT', 'CycleAnalyzer gestoppt');
    } catch (error) {
        log(`[${MODULE.NAME}] Fehler beim Stoppen: ${error.message}`, 'warn');
    } finally {
        callback();
    }
}, 2000);

main();
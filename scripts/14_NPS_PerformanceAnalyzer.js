/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               14_NPS_PerformanceAnalyzer
 * Datei:               14_NPS_PerformanceAnalyzer.js
 * Version:             1.0.2
 * Build:               2026-07-30
 * Modulstatus:         STABIL
 * Architektur-Schicht: Mehrzyklus- und Performanceanalyse
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Verdichtet die vom InfluxAdapter bereitgestellten vollständigen CycleReports
 * zu Gesamt-, Heizungs-, Warmwasser- und Abtaustatistiken. Das Modul berechnet
 * Verteilungen, Betriebsanteile und kompakte Dashboarddaten, ohne direkt auf
 * InfluxDB, ElectricalMeters, VirtualMeters oder NIBE-Register zuzugreifen.
 *
 * Elektrische Energie, thermische Energie und COP werden ausschließlich aus
 * den bereits abgeschlossenen CycleReports übernommen. Die fachlich korrekte
 * Herkunft dieser Werte wird in den vorgelagerten Modulen sichergestellt.
 *
 * Eingänge (nur lesend)
 * ---------------------
 * - 0_userdata.0.NPS.InfluxAdapter.History.AllCyclesJson
 * - Konfiguration unter 0_userdata.0.NPS.PerformanceAnalyzer.Configuration.*
 * - Manueller Befehl 0_userdata.0.NPS.PerformanceAnalyzer.Command.Analyze
 *
 * Ausgänge / Public API
 * ---------------------
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Result.*
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Statistics.OverallJson
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Statistics.HeatingJson
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Statistics.WarmwaterJson
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Statistics.DefrostJson
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Statistics.DistributionsJson
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Statistics.OperatingSharesJson
 * - 0_userdata.0.NPS.PerformanceAnalyzer.Statistics.DashboardJson
 * - 0_userdata.0.NPS.PerformanceAnalyzer.System.* / Diagnostics.*
 *
 * Trigger und Ablauf
 * ------------------
 * - Optionale Analyse beim Skriptstart
 * - Optionale Analyse bei Änderung von InfluxAdapter.History.AllCyclesJson
 * - Manueller Trigger über Command.Analyze
 * - Auswahl gültiger oder optional aller strukturell lesbaren CycleReports
 * - Typtrennung, deskriptive Statistik, Histogramme und Betriebsanteile
 * - Serielle Abarbeitung überlappender Analyseanforderungen
 *
 * Abhängigkeiten
 * ---------------
 * - 11_NPS_InfluxAdapter als alleinige Historienquelle
 * - CycleReport-Vertrag des 13_NPS_CycleAnalyzer
 * - ioBroker JavaScript-Adapter
 *
 * Architekturregeln
 * -----------------
 * - Kein direkter Zugriff auf InfluxDB und keine Historisierung
 * - Kein direkter Zugriff auf ElectricalMeters, VirtualMeters oder NIBE-Aliase
 * - Elektrische und thermische Energie ausschließlich aus CycleReports
 * - Keine Veränderung oder Rekonstruktion einzelner CycleReports
 * - Keine Einzelzyklusanalyse und keine Anlagensteuerung
 * - Single Writer für 0_userdata.0.NPS.PerformanceAnalyzer
 * - Keine Zusammenlegung mit CycleAnalyzer, InfluxAdapter oder DashboardData
 *
 * Änderungsverlauf
 * ----------------
 * 1.0.2 | 2026-07-30
 *       | Architektur dokumentarisch präzisiert:
 *       | keine direkten Zugriffe auf ElectricalMeters, VirtualMeters oder
 *       | NIBE-Register. Energie und COP stammen ausschließlich aus den vom
 *       | InfluxAdapter bereitgestellten CycleReports.
 *       | Interne veraltete Versionsangabe entfernt.
 *       | Keine Änderung an Analyse-, Statistik- oder Triggerlogik.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Eingänge, Public API, Trigger,
 *       | Abhängigkeiten und Modulgrenzen dokumentiert.
 *       | MODULE.VERSION auf 1.0.1 angehoben.
 *       | Keine Änderung an Filterung, Statistik, Verteilungen,
 *       | Betriebsanteilen, Dashboarddaten oder Triggerlogik.
 * 0.2.0-dev
 *       | Erweiterte Statistik-, Verteilungs- und Betriebsanalyse.
 ****************************************************************************/

'use strict';

/**
 * NIBE Performance Suite
 * 14_NPS_PerformanceAnalyzer
 *
 * Erstellt erweiterte Statistik-, Verteilungs- und Betriebsanalysen aus den
 * vom InfluxAdapter bereitgestellten vollständigen CycleReports.
 *
 * Quelle:
 *   0_userdata.0.NPS.InfluxAdapter.History.AllCyclesJson
 *
 * Das Modul greift weder direkt auf InfluxDB noch auf elektrische oder
 * thermische Zähler zu. Es schreibt keine Historie und verändert keine
 * CycleReports. Eine leere Historie ist ein gültiger Zustand.
 */

const MODULE = Object.freeze({
    NAME: 'NPS PerformanceAnalyzer',
    VERSION: '1.0.2',
    ROOT: '0_userdata.0.NPS.PerformanceAnalyzer'
});

const SOURCE = Object.freeze({
    ALL_CYCLES_JSON: '0_userdata.0.NPS.InfluxAdapter.History.AllCyclesJson'
});

const DEFAULTS = Object.freeze({
    ENABLED: true,
    ANALYZE_ON_STARTUP: true,
    ANALYZE_ON_HISTORY_CHANGE: true,
    INCLUDE_INVALID_CYCLES: false,
    DEBUG: false
});

const TYPE_CODES = Object.freeze({
    HEATING: 1,
    WARMWATER: 2,
    DEFROST: 3
});

let analysisRunning = false;
let analysisPending = false;
const subscriptions = [];

function id(path) {
    return `${MODULE.ROOT}.${path}`;
}

function nowText() {
    return new Date().toLocaleString('de-DE');
}

function round(value, digits = 2) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function asNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function asBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return null;
}

function getPath(object, path) {
    return path.split('.').reduce((current, key) =>
        current !== null && current !== undefined ? current[key] : undefined, object);
}

function firstValue(object, paths) {
    for (const path of paths) {
        const value = getPath(object, path);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
}

function firstNumber(object, paths) {
    for (const path of paths) {
        const value = asNumber(getPath(object, path));
        if (value !== null) return value;
    }
    return null;
}

function parseTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string' || value.trim() === '') return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function cycleTimestamp(cycle) {
    const candidates = [
        firstValue(cycle, ['analysis.end', 'Analysis.End']),
        firstValue(cycle, ['analysis.start', 'Analysis.Start']),
        firstValue(cycle, ['analyzedAt', 'timestamp'])
    ];
    for (const candidate of candidates) {
        const parsed = parseTimestamp(candidate);
        if (parsed !== null) return parsed;
    }
    return null;
}

function cycleTypeCode(cycle) {
    const direct = firstNumber(cycle, ['analysis.typeCode', 'Analysis.TypeCode', 'typeCode']);
    if (direct !== null) return Math.round(direct);

    const type = String(firstValue(cycle, ['analysis.type', 'Analysis.Type', 'type']) || '')
        .trim().toUpperCase();
    if (['HEIZUNG', 'HEIZEN', 'HEATING'].includes(type)) return TYPE_CODES.HEATING;
    if (['WARMWASSER', 'BRAUCHWASSER', 'WARMWATER', 'HOTWATER'].includes(type)) return TYPE_CODES.WARMWATER;
    if (['ABTAUUNG', 'ABTAUEN', 'DEFROST'].includes(type)) return TYPE_CODES.DEFROST;
    return 0;
}

function cycleValid(cycle) {
    const raw = firstValue(cycle, ['analysis.valid', 'Analysis.Valid', 'valid']);
    if (raw === null) return true;
    const parsed = asBoolean(raw);
    return parsed === null ? true : parsed;
}

function setObjectIfMissing(path, definition) {
    return new Promise((resolve, reject) => {
        if (existsObject(path)) {
            resolve(false);
            return;
        }
        setObject(path, definition, error => {
            if (error) reject(error);
            else resolve(true);
        });
    });
}

async function ensureFolder(path, name) {
    await setObjectIfMissing(path, { type: 'folder', common: { name }, native: {} });
}

async function ensureChannel(path, name) {
    await setObjectIfMissing(path, { type: 'channel', common: { name }, native: {} });
}

async function ensureState(path, initialValue, common) {
    const created = await setObjectIfMissing(path, {
        type: 'state',
        common: {
            read: true,
            write: false,
            ...common,
            def: initialValue
        },
        native: {}
    });

    if (created) {
        await setStateAsync(path, initialValue, true);
        return;
    }

    const state = getState(path);
    if (!state || state.val === null || state.val === undefined) {
        await setStateAsync(path, initialValue, true);
    }
}

async function createStructure() {
    await ensureFolder(MODULE.ROOT, MODULE.NAME);

    await ensureChannel(id('Command'), 'Befehle');
    await ensureState(id('Command.Analyze'), false, {
        name: 'Performanceanalyse ausführen', type: 'boolean', role: 'button', write: true
    });

    await ensureChannel(id('Configuration'), 'Konfiguration');
    await ensureState(id('Configuration.Enabled'), DEFAULTS.ENABLED, {
        name: 'Modul aktiviert', type: 'boolean', role: 'switch.enable', write: true
    });
    await ensureState(id('Configuration.AnalyzeOnStartup'), DEFAULTS.ANALYZE_ON_STARTUP, {
        name: 'Beim Skriptstart analysieren', type: 'boolean', role: 'switch.enable', write: true
    });
    await ensureState(id('Configuration.AnalyzeOnHistoryChange'), DEFAULTS.ANALYZE_ON_HISTORY_CHANGE, {
        name: 'Bei Historienänderung analysieren', type: 'boolean', role: 'switch.enable', write: true
    });
    await ensureState(id('Configuration.IncludeInvalidCycles'), DEFAULTS.INCLUDE_INVALID_CYCLES, {
        name: 'Ungültige Zyklen einbeziehen', type: 'boolean', role: 'switch.enable', write: true
    });
    await ensureState(id('Configuration.Debug'), DEFAULTS.DEBUG, {
        name: 'Debug-Ausgaben aktiviert', type: 'boolean', role: 'switch', write: true
    });

    await ensureChannel(id('Input'), 'Eingang');
    await ensureState(id('Input.SourceId'), SOURCE.ALL_CYCLES_JSON, {
        name: 'Quell-Datenpunkt', type: 'string', role: 'text'
    });

    await ensureChannel(id('Result'), 'Ergebnis');
    const resultStates = [
        ['CycleCount', 'Anzahl analysierter Zyklen'],
        ['HeatingCycleCount', 'Anzahl Heizzyklen'],
        ['WarmwaterCycleCount', 'Anzahl Warmwasserzyklen'],
        ['DefrostCycleCount', 'Anzahl Abtauzyklen']
    ];
    for (const [key, name] of resultStates) {
        await ensureState(id(`Result.${key}`), 0, { name, type: 'number', role: 'value' });
    }
    await ensureState(id('Result.AverageDurationMinutes'), 0, {
        name: 'Mittlere Zyklusdauer', type: 'number', role: 'value.interval', unit: 'min'
    });
    await ensureState(id('Result.AverageElectricalEnergyKWh'), 0, {
        name: 'Mittlere elektrische Energie', type: 'number', role: 'value.energy', unit: 'kWh'
    });
    await ensureState(id('Result.AverageThermalEnergyKWh'), 0, {
        name: 'Mittlere thermische Energie', type: 'number', role: 'value.energy', unit: 'kWh'
    });
    await ensureState(id('Result.AverageCOP'), 0, {
        name: 'Mittlerer COP', type: 'number', role: 'value'
    });
    await ensureState(id('Result.AverageCompressorFrequencyHz'), 0, {
        name: 'Mittlere Verdichterfrequenz', type: 'number', role: 'value.frequency', unit: 'Hz'
    });
    await ensureState(id('Result.AverageOutdoorTemperatureC'), 0, {
        name: 'Mittlere Außentemperatur', type: 'number', role: 'value.temperature', unit: '°C'
    });
    await ensureState(id('Result.MedianCOP'), 0, {
        name: 'Median COP', type: 'number', role: 'value'
    });
    await ensureState(id('Result.COPStandardDeviation'), 0, {
        name: 'Standardabweichung COP', type: 'number', role: 'value'
    });
    await ensureState(id('Result.AverageQualityScore'), 0, {
        name: 'Mittlerer Qualitätsindex', type: 'number', role: 'value', unit: '%'
    });
    await ensureState(id('Result.TotalElectricalEnergyKWh'), 0, {
        name: 'Elektrische Gesamtenergie', type: 'number', role: 'value.energy', unit: 'kWh'
    });
    await ensureState(id('Result.TotalThermalEnergyKWh'), 0, {
        name: 'Thermische Gesamtenergie', type: 'number', role: 'value.energy', unit: 'kWh'
    });
    await ensureState(id('Result.OldestTimestamp'), '', {
        name: 'Ältester analysierter Zyklus', type: 'string', role: 'date'
    });
    await ensureState(id('Result.NewestTimestamp'), '', {
        name: 'Neuester analysierter Zyklus', type: 'string', role: 'date'
    });

    await ensureChannel(id('Statistics'), 'Statistiken');
    await ensureState(id('Statistics.OverallJson'), '{}', {
        name: 'Gesamtstatistik als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('Statistics.HeatingJson'), '{}', {
        name: 'Heizstatistik als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('Statistics.WarmwaterJson'), '{}', {
        name: 'Warmwasserstatistik als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('Statistics.DefrostJson'), '{}', {
        name: 'Abtaustatistik als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('Statistics.DistributionsJson'), '{}', {
        name: 'Verteilungen als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('Statistics.OperatingSharesJson'), '{}', {
        name: 'Betriebsanteile als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('Statistics.DashboardJson'), '{}', {
        name: 'Dashboarddaten als JSON', type: 'string', role: 'json'
    });

    await ensureChannel(id('Diagnostics'), 'Diagnose');
    const diagnosticStates = [
        ['InputCycleCount', 'Eingelesene Zyklen'],
        ['ValidCycleCount', 'Gültige Zyklen'],
        ['InvalidCycleCount', 'Ungültige Zyklen'],
        ['MissingValueCount', 'Fehlende Kennwerte'],
        ['LastDurationMs', 'Dauer der letzten Analyse']
    ];
    for (const [key, name] of diagnosticStates) {
        await ensureState(id(`Diagnostics.${key}`), 0, {
            name, type: 'number', role: key === 'LastDurationMs' ? 'value.interval' : 'value',
            ...(key === 'LastDurationMs' ? { unit: 'ms' } : {})
        });
    }
    await ensureState(id('Diagnostics.Warning'), '', {
        name: 'Warnung', type: 'string', role: 'text'
    });
    await ensureState(id('Diagnostics.Trace'), '', {
        name: 'Diagnosetrace', type: 'string', role: 'text'
    });

    await ensureChannel(id('System'), 'System');
    await ensureState(id('System.Version'), MODULE.VERSION, {
        name: 'Modulversion', type: 'string', role: 'text'
    });
    await ensureState(id('System.Active'), false, {
        name: 'Modul aktiv', type: 'boolean', role: 'indicator'
    });
    await ensureState(id('System.Status'), 'INITIALISIERUNG', {
        name: 'Status', type: 'string', role: 'text'
    });
    await ensureState(id('System.LastStart'), '', {
        name: 'Letzter Modulstart', type: 'string', role: 'date'
    });
    await ensureState(id('System.LastAnalysis'), '', {
        name: 'Letzte Analyse', type: 'string', role: 'date'
    });
    await ensureState(id('System.LastMessage'), '', {
        name: 'Letzte Meldung', type: 'string', role: 'text'
    });
}

function stateValue(path, fallback) {
    const state = getState(id(path));
    return state && state.val !== null && state.val !== undefined ? state.val : fallback;
}

function readConfig() {
    return {
        enabled: stateValue('Configuration.Enabled', DEFAULTS.ENABLED) === true,
        analyzeOnStartup: stateValue('Configuration.AnalyzeOnStartup', DEFAULTS.ANALYZE_ON_STARTUP) === true,
        analyzeOnHistoryChange: stateValue('Configuration.AnalyzeOnHistoryChange', DEFAULTS.ANALYZE_ON_HISTORY_CHANGE) === true,
        includeInvalidCycles: stateValue('Configuration.IncludeInvalidCycles', DEFAULTS.INCLUDE_INVALID_CYCLES) === true,
        debug: stateValue('Configuration.Debug', DEFAULTS.DEBUG) === true
    };
}

function debug(message) {
    if (readConfig().debug) log(`[${MODULE.NAME}] ${message}`, 'info');
}

function parseInput() {
    if (!existsState(SOURCE.ALL_CYCLES_JSON)) {
        throw new Error(`Quelle nicht vorhanden: ${SOURCE.ALL_CYCLES_JSON}`);
    }

    const state = getState(SOURCE.ALL_CYCLES_JSON);
    const raw = state ? state.val : null;
    if (raw === null || raw === undefined || raw === '') return [];

    let parsed = raw;
    if (typeof raw === 'string') {
        parsed = JSON.parse(raw);
    }
    if (!Array.isArray(parsed)) {
        throw new Error('AllCyclesJson enthält kein JSON-Array');
    }
    return parsed;
}

function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}

function average(values) {
    return values.length ? sum(values) / values.length : null;
}

function percentile(sortedValues, percentileValue) {
    if (!sortedValues.length) return null;
    if (sortedValues.length === 1) return sortedValues[0];
    const position = (sortedValues.length - 1) * percentileValue;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sortedValues[lower];
    const weight = position - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function describe(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const count = sorted.length;
    if (!count) {
        return {
            count: 0, average: null, median: null, minimum: null, maximum: null,
            sum: null, variance: null, standardDeviation: null, range: null,
            percentiles: { p10: null, p25: null, p50: null, p75: null, p90: null }
        };
    }

    const total = sum(sorted);
    const mean = total / count;
    const variance = sum(sorted.map(value => (value - mean) ** 2)) / count;
    const minimum = sorted[0];
    const maximum = sorted[count - 1];
    const p50 = percentile(sorted, 0.50);

    return {
        count,
        average: round(mean, 3),
        median: round(p50, 3),
        minimum: round(minimum, 3),
        maximum: round(maximum, 3),
        sum: round(total, 3),
        variance: round(variance, 3),
        standardDeviation: round(Math.sqrt(variance), 3),
        range: round(maximum - minimum, 3),
        percentiles: {
            p10: round(percentile(sorted, 0.10), 3),
            p25: round(percentile(sorted, 0.25), 3),
            p50: round(p50, 3),
            p75: round(percentile(sorted, 0.75), 3),
            p90: round(percentile(sorted, 0.90), 3)
        }
    };
}

function metric(cycle, name) {
    const paths = {
        durationSeconds: ['analysis.durationSeconds', 'Analysis.DurationSeconds', 'durationSeconds'],
        electricalKWh: ['energy.electricKWh', 'Energy.ElectricKWh', 'energy.electricalKWh'],
        thermalKWh: ['energy.heatKWh', 'Energy.HeatKWh', 'energy.thermalKWh'],
        cop: ['energy.cop', 'Energy.COP', 'cop'],
        electricAverageW: ['power.electricAverageW', 'Power.ElectricAverageW'],
        heatAverageKW: ['power.heatAverageKW', 'Power.HeatAverageKW'],
        compressorFrequencyHz: ['compressor.frequencyAverageHz', 'compressor.frequencyAverage', 'Compressor.FrequencyAverage'],
        outdoorTemperatureC: ['temperature.outdoorAverageC', 'temperature.outdoorAverage', 'Temperature.OutdoorAverage'],
        compressorRuntimeSeconds: ['compressor.runtimeSeconds', 'Compressor.RuntimeSeconds'],
        compressorStarts: ['compressor.starts', 'Compressor.Starts'],
        defrostCount: ['events.defrostCount', 'Events.DefrostCount'],
        qualityScore: ['quality.score', 'Quality.Score']
    };
    return firstNumber(cycle, paths[name] || []);
}

function createHistogram(values, bins) {
    const result = {};
    for (const bin of bins) result[bin.label] = 0;
    for (const value of values) {
        const bin = bins.find(item =>
            (item.min === null || value >= item.min) &&
            (item.max === null || value < item.max));
        if (bin) result[bin.label]++;
    }
    return { sampleCount: values.length, bins: result };
}

function buildDistributions(fields) {
    return {
        cop: createHistogram(fields.cop, [
            { label: '<2', min: null, max: 2 }, { label: '2-3', min: 2, max: 3 },
            { label: '3-4', min: 3, max: 4 }, { label: '4-5', min: 4, max: 5 },
            { label: '>=5', min: 5, max: null }
        ]),
        durationMinutes: createHistogram(fields.durationMinutes, [
            { label: '<15', min: null, max: 15 }, { label: '15-30', min: 15, max: 30 },
            { label: '30-60', min: 30, max: 60 }, { label: '60-120', min: 60, max: 120 },
            { label: '>=120', min: 120, max: null }
        ]),
        compressorFrequencyHz: createHistogram(fields.compressorFrequencyHz, [
            { label: '<30', min: null, max: 30 }, { label: '30-45', min: 30, max: 45 },
            { label: '45-60', min: 45, max: 60 }, { label: '60-75', min: 60, max: 75 },
            { label: '>=75', min: 75, max: null }
        ]),
        outdoorTemperatureC: createHistogram(fields.outdoorTemperatureC, [
            { label: '<-10', min: null, max: -10 }, { label: '-10--5', min: -10, max: -5 },
            { label: '-5-0', min: -5, max: 0 }, { label: '0-5', min: 0, max: 5 },
            { label: '5-10', min: 5, max: 10 }, { label: '10-15', min: 10, max: 15 },
            { label: '>=15', min: 15, max: null }
        ]),
        electricalPowerKW: createHistogram(fields.electricalPowerKW, [
            { label: '<0.5', min: null, max: 0.5 }, { label: '0.5-1', min: 0.5, max: 1 },
            { label: '1-1.5', min: 1, max: 1.5 }, { label: '1.5-2', min: 1.5, max: 2 },
            { label: '>=2', min: 2, max: null }
        ]),
        thermalPowerKW: createHistogram(fields.thermalPowerKW, [
            { label: '<2', min: null, max: 2 }, { label: '2-4', min: 2, max: 4 },
            { label: '4-6', min: 4, max: 6 }, { label: '6-8', min: 6, max: 8 },
            { label: '>=8', min: 8, max: null }
        ]),
        qualityScore: createHistogram(fields.qualityScore, [
            { label: '<50', min: null, max: 50 }, { label: '50-70', min: 50, max: 70 },
            { label: '70-85', min: 70, max: 85 }, { label: '85-95', min: 85, max: 95 },
            { label: '95-100', min: 95, max: 100.000001 }
        ])
    };
}

function buildStatistics(cycles, typeName) {
    const fields = {
        durationMinutes: [], electricalEnergyKWh: [], thermalEnergyKWh: [], cop: [],
        electricalPowerKW: [], thermalPowerKW: [], compressorFrequencyHz: [],
        outdoorTemperatureC: [], compressorRuntimeMinutes: [], compressorStarts: [],
        defrostCount: [], qualityScore: []
    };

    let missingValueCount = 0;
    const missingByMetric = {};
    const timestamps = [];

    for (const cycle of cycles) {
        const timestamp = cycleTimestamp(cycle);
        if (timestamp !== null) timestamps.push(timestamp);

        const mappings = [
            { target: 'durationMinutes', value: metric(cycle, 'durationSeconds'), transform: value => value / 60 },
            { target: 'electricalEnergyKWh', value: metric(cycle, 'electricalKWh') },
            { target: 'thermalEnergyKWh', value: metric(cycle, 'thermalKWh') },
            { target: 'cop', value: metric(cycle, 'cop') },
            { target: 'electricalPowerKW', value: metric(cycle, 'electricAverageW'), transform: value => value / 1000 },
            { target: 'thermalPowerKW', value: metric(cycle, 'heatAverageKW') },
            { target: 'compressorFrequencyHz', value: metric(cycle, 'compressorFrequencyHz') },
            { target: 'outdoorTemperatureC', value: metric(cycle, 'outdoorTemperatureC') },
            { target: 'compressorRuntimeMinutes', value: metric(cycle, 'compressorRuntimeSeconds'), transform: value => value / 60 },
            { target: 'compressorStarts', value: metric(cycle, 'compressorStarts') },
            { target: 'defrostCount', value: metric(cycle, 'defrostCount') },
            { target: 'qualityScore', value: metric(cycle, 'qualityScore') }
        ];

        for (const item of mappings) {
            if (item.value === null) {
                missingValueCount++;
                missingByMetric[item.target] = (missingByMetric[item.target] || 0) + 1;
                continue;
            }
            const transform = typeof item.transform === 'function' ? item.transform : value => value;
            fields[item.target].push(transform(item.value));
        }
    }

    const metrics = {};
    for (const [name, values] of Object.entries(fields)) metrics[name] = describe(values);

    timestamps.sort((a, b) => a - b);
    return {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        type: typeName,
        cycleCount: cycles.length,
        oldestTimestamp: timestamps.length ? new Date(timestamps[0]).toISOString() : '',
        newestTimestamp: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : '',
        missingValueCount,
        missingByMetric,
        metrics,
        distributions: buildDistributions(fields)
    };
}

function safeShare(part, total) {
    return total > 0 ? round(part / total * 100, 2) : 0;
}

function buildOperatingShares(overall, heating, warmwater, defrost) {
    const totalCycles = overall.cycleCount;
    const totalDuration = overall.metrics.durationMinutes.sum || 0;
    const totalElectrical = overall.metrics.electricalEnergyKWh.sum || 0;
    const totalThermal = overall.metrics.thermalEnergyKWh.sum || 0;
    const totalStarts = overall.metrics.compressorStarts.sum || 0;

    function shareFor(statistics) {
        return {
            cycleCount: statistics.cycleCount,
            cycleSharePercent: safeShare(statistics.cycleCount, totalCycles),
            runtimeMinutes: statistics.metrics.durationMinutes.sum || 0,
            runtimeSharePercent: safeShare(statistics.metrics.durationMinutes.sum || 0, totalDuration),
            electricalEnergyKWh: statistics.metrics.electricalEnergyKWh.sum || 0,
            electricalEnergySharePercent: safeShare(statistics.metrics.electricalEnergyKWh.sum || 0, totalElectrical),
            thermalEnergyKWh: statistics.metrics.thermalEnergyKWh.sum || 0,
            thermalEnergySharePercent: safeShare(statistics.metrics.thermalEnergyKWh.sum || 0, totalThermal),
            compressorStarts: statistics.metrics.compressorStarts.sum || 0,
            compressorStartSharePercent: safeShare(statistics.metrics.compressorStarts.sum || 0, totalStarts),
            averageCOP: statistics.metrics.cop.average,
            averageDurationMinutes: statistics.metrics.durationMinutes.average,
            averageOutdoorTemperatureC: statistics.metrics.outdoorTemperatureC.average
        };
    }

    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        overall: {
            cycleCount: totalCycles, runtimeMinutes: round(totalDuration, 3),
            electricalEnergyKWh: round(totalElectrical, 3), thermalEnergyKWh: round(totalThermal, 3),
            compressorStarts: round(totalStarts, 3)
        },
        heating: shareFor(heating),
        warmwater: shareFor(warmwater),
        defrost: shareFor(defrost)
    };
}

function buildDashboard(overall, heating, warmwater, defrost, operatingShares) {
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        summary: {
            cycleCount: overall.cycleCount,
            heatingCycleCount: heating.cycleCount,
            warmwaterCycleCount: warmwater.cycleCount,
            defrostCycleCount: defrost.cycleCount,
            averageCOP: overall.metrics.cop.average,
            medianCOP: overall.metrics.cop.median,
            copStandardDeviation: overall.metrics.cop.standardDeviation,
            averageDurationMinutes: overall.metrics.durationMinutes.average,
            totalElectricalEnergyKWh: overall.metrics.electricalEnergyKWh.sum,
            totalThermalEnergyKWh: overall.metrics.thermalEnergyKWh.sum,
            averageCompressorFrequencyHz: overall.metrics.compressorFrequencyHz.average,
            averageOutdoorTemperatureC: overall.metrics.outdoorTemperatureC.average,
            averageQualityScore: overall.metrics.qualityScore.average,
            oldestTimestamp: overall.oldestTimestamp,
            newestTimestamp: overall.newestTimestamp
        },
        operatingShares,
        distributions: overall.distributions,
        statistics: { overall, heating, warmwater, defrost }
    };
}

async function writeResults(overall, heating, warmwater, defrost, operatingShares, dashboard, diagnostics, durationMs) {
    const m = overall.metrics;
    await Promise.all([
        setStateAsync(id('Result.CycleCount'), overall.cycleCount, true),
        setStateAsync(id('Result.HeatingCycleCount'), heating.cycleCount, true),
        setStateAsync(id('Result.WarmwaterCycleCount'), warmwater.cycleCount, true),
        setStateAsync(id('Result.DefrostCycleCount'), defrost.cycleCount, true),
        setStateAsync(id('Result.AverageDurationMinutes'), m.durationMinutes.average ?? 0, true),
        setStateAsync(id('Result.AverageElectricalEnergyKWh'), m.electricalEnergyKWh.average ?? 0, true),
        setStateAsync(id('Result.AverageThermalEnergyKWh'), m.thermalEnergyKWh.average ?? 0, true),
        setStateAsync(id('Result.AverageCOP'), m.cop.average ?? 0, true),
        setStateAsync(id('Result.AverageCompressorFrequencyHz'), m.compressorFrequencyHz.average ?? 0, true),
        setStateAsync(id('Result.AverageOutdoorTemperatureC'), m.outdoorTemperatureC.average ?? 0, true),
        setStateAsync(id('Result.MedianCOP'), m.cop.median ?? 0, true),
        setStateAsync(id('Result.COPStandardDeviation'), m.cop.standardDeviation ?? 0, true),
        setStateAsync(id('Result.AverageQualityScore'), m.qualityScore.average ?? 0, true),
        setStateAsync(id('Result.TotalElectricalEnergyKWh'), m.electricalEnergyKWh.sum ?? 0, true),
        setStateAsync(id('Result.TotalThermalEnergyKWh'), m.thermalEnergyKWh.sum ?? 0, true),
        setStateAsync(id('Result.OldestTimestamp'), overall.oldestTimestamp, true),
        setStateAsync(id('Result.NewestTimestamp'), overall.newestTimestamp, true),
        setStateAsync(id('Statistics.OverallJson'), JSON.stringify(overall), true),
        setStateAsync(id('Statistics.HeatingJson'), JSON.stringify(heating), true),
        setStateAsync(id('Statistics.WarmwaterJson'), JSON.stringify(warmwater), true),
        setStateAsync(id('Statistics.DefrostJson'), JSON.stringify(defrost), true),
        setStateAsync(id('Statistics.DistributionsJson'), JSON.stringify(overall.distributions), true),
        setStateAsync(id('Statistics.OperatingSharesJson'), JSON.stringify(operatingShares), true),
        setStateAsync(id('Statistics.DashboardJson'), JSON.stringify(dashboard), true),
        setStateAsync(id('Diagnostics.InputCycleCount'), diagnostics.inputCount, true),
        setStateAsync(id('Diagnostics.ValidCycleCount'), diagnostics.validCount, true),
        setStateAsync(id('Diagnostics.InvalidCycleCount'), diagnostics.invalidCount, true),
        setStateAsync(id('Diagnostics.MissingValueCount'), overall.missingValueCount, true),
        setStateAsync(id('Diagnostics.LastDurationMs'), durationMs, true),
        setStateAsync(id('Diagnostics.Warning'), diagnostics.warning, true),
        setStateAsync(id('System.LastAnalysis'), nowText(), true),
        setStateAsync(id('System.LastMessage'), `${overall.cycleCount} Zyklus/Zyklen analysiert`, true),
        setStateAsync(id('System.Status'), 'BEREIT', true)
    ]);

    const trace = [
        nowText(),
        `Source=${SOURCE.ALL_CYCLES_JSON}`,
        `Input=${diagnostics.inputCount}`,
        `Included=${overall.cycleCount}`,
        `Valid=${diagnostics.validCount}`,
        `Invalid=${diagnostics.invalidCount}`,
        `Heating=${heating.cycleCount}`,
        `Warmwater=${warmwater.cycleCount}`,
        `Defrost=${defrost.cycleCount}`,
        `MissingValues=${overall.missingValueCount}`,
        `DurationMs=${durationMs}`,
        `Oldest=${overall.oldestTimestamp || '-'}`,
        `Newest=${overall.newestTimestamp || '-'}`
    ].join('\n');
    await setStateAsync(id('Diagnostics.Trace'), trace, true);
}

async function performAnalysis(reason = 'manuell') {
    if (analysisRunning) {
        analysisPending = true;
        debug(`Analyse vorgemerkt (${reason})`);
        return;
    }

    analysisRunning = true;
    const started = Date.now();

    try {
        const config = readConfig();
        if (!config.enabled) {
            await setStateAsync(id('System.Active'), false, true);
            await setStateAsync(id('System.Status'), 'DEAKTIVIERT', true);
            await setStateAsync(id('System.LastMessage'), 'Modul ist deaktiviert', true);
            return;
        }

        await setStateAsync(id('System.Active'), true, true);
        await setStateAsync(id('System.Status'), 'ANALYSE', true);
        await setStateAsync(id('Diagnostics.Warning'), '', true);

        const input = parseInput();
        const valid = input.filter(cycle => cycle && typeof cycle === 'object' && !Array.isArray(cycle) && cycleValid(cycle));
        const invalid = input.filter(cycle => !cycle || typeof cycle !== 'object' || Array.isArray(cycle) || !cycleValid(cycle));
        const included = config.includeInvalidCycles
            ? input.filter(cycle => cycle && typeof cycle === 'object' && !Array.isArray(cycle))
            : valid;

        const heatingCycles = included.filter(cycle => cycleTypeCode(cycle) === TYPE_CODES.HEATING);
        const warmwaterCycles = included.filter(cycle => cycleTypeCode(cycle) === TYPE_CODES.WARMWATER);
        const defrostCycles = included.filter(cycle => cycleTypeCode(cycle) === TYPE_CODES.DEFROST);

        const overall = buildStatistics(included, 'ALL');
        const heating = buildStatistics(heatingCycles, 'HEATING');
        const warmwater = buildStatistics(warmwaterCycles, 'WARMWATER');
        const defrost = buildStatistics(defrostCycles, 'DEFROST');
        const operatingShares = buildOperatingShares(overall, heating, warmwater, defrost);
        const dashboard = buildDashboard(overall, heating, warmwater, defrost, operatingShares);

        const warningParts = [];
        if (invalid.length > 0 && !config.includeInvalidCycles) {
            warningParts.push(`${invalid.length} ungültige Zyklen ausgeschlossen`);
        }
        const unknownTypes = included.filter(cycle => cycleTypeCode(cycle) === 0).length;
        if (unknownTypes > 0) warningParts.push(`${unknownTypes} Zyklen mit unbekannter Art`);

        await writeResults(overall, heating, warmwater, defrost, operatingShares, dashboard, {
            inputCount: input.length,
            validCount: valid.length,
            invalidCount: invalid.length,
            warning: warningParts.join('; ')
        }, Date.now() - started);

        debug(`Analyse abgeschlossen (${reason}), Zyklen=${included.length}`);
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        log(`[${MODULE.NAME}] ${message}`, 'error');
        await setStateAsync(id('System.Status'), 'FEHLER', true);
        await setStateAsync(id('System.LastMessage'), message, true);
        await setStateAsync(id('Diagnostics.Warning'), message, true);
        await setStateAsync(id('Diagnostics.LastDurationMs'), Date.now() - started, true);
    } finally {
        analysisRunning = false;
        if (analysisPending) {
            analysisPending = false;
            setTimeout(() => performAnalysis('vorgemerkt'), 100);
        }
    }
}

function registerSubscriptions() {
    subscriptions.push(on({ id: id('Command.Analyze'), change: 'ne' }, async obj => {
        if (!obj || !obj.state || obj.state.val !== true) return;
        await setStateAsync(id('Command.Analyze'), false, true);
        await performAnalysis('Befehl');
    }));

    subscriptions.push(on({ id: SOURCE.ALL_CYCLES_JSON, change: 'ne' }, () => {
        if (readConfig().analyzeOnHistoryChange) performAnalysis('Historienänderung');
    }));

    subscriptions.push(on({ id: id('Configuration.Enabled'), change: 'ne' }, obj => {
        const enabled = Boolean(obj && obj.state && obj.state.val);
        setState(id('System.Active'), enabled, true);
        setState(id('System.Status'), enabled ? 'BEREIT' : 'DEAKTIVIERT', true);
        if (enabled) performAnalysis('Aktivierung');
    }));
}

async function start() {
    try {
        await createStructure();
        await Promise.all([
            setStateAsync(id('System.Version'), MODULE.VERSION, true),
            setStateAsync(id('System.LastStart'), nowText(), true),
            setStateAsync(id('Input.SourceId'), SOURCE.ALL_CYCLES_JSON, true)
        ]);

        registerSubscriptions();

        const config = readConfig();
        await setStateAsync(id('System.Active'), config.enabled, true);
        await setStateAsync(id('System.Status'), config.enabled ? 'BEREIT' : 'DEAKTIVIERT', true);
        await setStateAsync(id('System.LastMessage'), 'Modul gestartet', true);

        log(`[${MODULE.NAME}] Version ${MODULE.VERSION} gestartet`, 'info');
        if (config.enabled && config.analyzeOnStartup) {
            setTimeout(() => performAnalysis('Skriptstart'), 500);
        }
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        log(`[${MODULE.NAME}] Startfehler: ${message}`, 'error');
    }
}

onStop(() => {
    for (const subscription of subscriptions) {
        try { unsubscribe(subscription); } catch (_) { /* ignore */ }
    }
    if (existsState(id('System.Active'))) setState(id('System.Active'), false, true);
}, 1000);

start();
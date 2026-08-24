/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               11_NPS_InfluxAdapter
 * Datei:               11_NPS_InfluxAdapter.js
 * Version:             1.1.0-rc.1
 * Build:               2026-08-23
 * Modulstatus:         STABIL
 * Architektur-Schicht: Persistenzzugriff / Historienadapter
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Liest vollständige CycleReports aus der InfluxDB-Historie und stellt sie
 * dem PerformanceAnalyzer als normierte, typisierte JSON-Arrays bereit. Die
 * Historie wird nicht aus Einzelmesswerten rekonstruiert, sondern aus den vom
 * CycleAnalyzer publizierten vollständigen CycleReport-Dokumenten geladen.
 *
 * Zusätzlich verwaltet das Modul ab 1.1.0-rc.1 die für Jarvis-HistoryGraphs
 * vorgesehenen DashboardData-Historienzuordnungen in einem konservativen
 * SAFE_ADD_ONLY-Verfahren:
 * - bestehende aktive Historien werden niemals verändert,
 * - bei aktiver Historie auf der jeweils anderen InfluxDB-Instanz wird nichts
 *   automatisch hinzugefügt,
 * - Doppelaktivierungen werden erkannt und nur diagnostiziert,
 * - fehlende Historien können explizit über Command.ApplyHistoryConfig ergänzt werden.
 *
 * Elektrische Energie, thermische Energie, Leistung und COP werden weder
 * gelesen noch neu berechnet. Diese Werte sind bereits Bestandteil der
 * CycleReports und stammen aus den vorgelagerten NPS-Modulen.
 *
 * Eingänge (nur lesend)
 * ---------------------
 * - 0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson
 * - Konfiguration unter 0_userdata.0.NPS.InfluxAdapter.Configuration.*
 * - Historienabfrage über die konfigurierte InfluxDB-Instanz (Standard influxdb.1)
 *
 * Ausgänge / Public API
 * ---------------------
 * - 0_userdata.0.NPS.InfluxAdapter.History.AllCyclesJson
 * - 0_userdata.0.NPS.InfluxAdapter.History.HeatingCyclesJson
 * - 0_userdata.0.NPS.InfluxAdapter.History.WarmwaterCyclesJson
 * - 0_userdata.0.NPS.InfluxAdapter.History.DefrostCyclesJson
 * - 0_userdata.0.NPS.InfluxAdapter.History.LastCycleJson
 * - 0_userdata.0.NPS.InfluxAdapter.Result.*
 * - 0_userdata.0.NPS.InfluxAdapter.System.*
 * - 0_userdata.0.NPS.InfluxAdapter.Diagnostics.*
 *
 * Trigger und Ablauf
 * ------------------
 * - Optionales Laden beim Skriptstart
 * - Manueller Refresh über Command.Refresh
 * - Automatischer Refresh fünf Sekunden nach einem neuen CycleReport
 * - Genau eine Influx-Historienabfrage je Aktualisierung
 * - Validierung, Filterung ungültiger Zyklen, Deduplizierung und Typtrennung
 * - Parallel eintreffende Refresh-Anforderungen werden seriell nachgezogen
 *
 * Abhängigkeiten
 * ---------------
 * - 13_NPS_CycleAnalyzer als Erzeuger vollständiger CycleReports
 * - ioBroker InfluxDB-Adapter mit getHistory-Schnittstelle
 * - 14_NPS_PerformanceAnalyzer als nachgelagerter Konsument
 * - ioBroker JavaScript-Adapter
 *
 * Architekturregeln
 * -----------------
 * - Keine Rekonstruktion oder fachliche Neuberechnung von Zyklen
 * - Kein direkter Zugriff auf ElectricalMeters, VirtualMeters oder NIBE-Aliase
 * - Keine Änderung der CycleReports; nur Validierung und Historienmetadaten
 * - Single Writer für 0_userdata.0.NPS.InfluxAdapter
 * - Persistenzzugriff bleibt vom CycleAnalyzer und PerformanceAnalyzer getrennt
 * - Keine Zusammenlegung mit Analyse- oder Aufzeichnungsmodulen
 *
 * Änderungsverlauf
 * ----------------
 * 1.1.0-rc.1 | 2026-08-23
 *            | Sichere Verwaltung der Jarvis-HistoryGraph-Persistenz ergänzt.
 *            | 28 DashboardData-Datenpunkte werden einer Zielinstanz und einem
 *            | History-Profil zugeordnet.
 *            | SAFE_ADD_ONLY: aktive bestehende History-Konfigurationen werden
 *            | nicht verändert; bei aktiver anderer Influx-Instanz wird nichts
 *            | automatisch zugeschaltet.
 *            | Doppelhistorien influxdb.0/influxdb.1 werden erkannt und gemeldet.
 *            | Neue Befehle: AuditHistoryConfig und ApplyHistoryConfig.
 *            | CycleReportJson/influxdb.1 bleibt unverändert geschützt.
 * 1.0.4 | 2026-08-22
 *       | Architekturtrennung influxdb.0 / influxdb.1 ausdrücklich dokumentiert.
 *       | influxdb.1 bleibt die Standardinstanz für die persistierten
 *       | CycleAnalyzer-CycleReports und damit für den InfluxAdapter.
 *       | Die zwischenzeitliche Umstellung auf influxdb.0 wird verworfen.
 *       | Keine Änderung an Historienabfrage, Validierung, Deduplizierung,
 *       | Typtrennung oder Refresh-Logik.
 * 1.0.2 | 2026-07-30
 *       | Architektur dokumentarisch präzisiert:
 *       | keine direkten Zugriffe auf ElectricalMeters, VirtualMeters oder
 *       | NIBE-Aliase. Energie-, Leistungs- und COP-Werte werden unverändert
 *       | aus den vollständigen CycleReports übernommen.
 *       | Keine Änderung an Historienabfrage, Validierung, Deduplizierung,
 *       | Typtrennung oder Refresh-Logik.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Eingänge, Public API, Trigger,
 *       | Abhängigkeiten und Modulgrenzen dokumentiert.
 *       | MODULE.VERSION auf 1.0.1 angehoben.
 *       | Keine Änderung an Historienabfrage, Validierung, Deduplizierung,
 *       | Typtrennung, Datenformaten oder Aktualisierungslogik.
 * 1.0.0-dev
 *       | Entwicklungsstand der produktiven Historienadapter-Architektur.
 ****************************************************************************/

'use strict';

const MODULE = Object.freeze({
    NAME: 'NPS InfluxAdapter',
    VERSION: '1.1.0-rc.1',
    ROOT: '0_userdata.0.NPS.InfluxAdapter'
});

const SOURCE = Object.freeze({
    CYCLE_REPORT: '0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson'
});

const DEFAULTS = Object.freeze({
    ENABLED: true,
    INFLUX_INSTANCE: 'influxdb.1',
    NUMBER_OF_CYCLES: 200,
    LOOKBACK_DAYS: 365,
    QUERY_TIMEOUT_SECONDS: 30,
    LOAD_ON_STARTUP: true,
    INCLUDE_INVALID_CYCLES: false,
    DEBUG: false
});


/*
 * Jarvis HistoryGraph Persistenz
 * ------------------------------
 * Ziel:
 * - genau eine InfluxDB-Instanz je verwaltetem DashboardData-Datenpunkt,
 * - bestehende aktive Historien niemals automatisch verändern,
 * - keine automatische Migration zwischen influxdb.0 und influxdb.1,
 * - fehlende Historien nur nach explizitem Apply-Befehl ergänzen.
 *
 * Profile:
 * A = abgeschlossene Tages-/Langzeitwerte, influxdb.0
 * B = kontinuierliche Mess-/Sollwerte, influxdb.1, Relog alle 300 s
 * C = dynamische Betriebswerte, influxdb.1, Blockzeit 60 s
 * D = Ereignis-/Zykluswerte, influxdb.1, keine Blockzeit
 */
const HISTORY_POLICY = Object.freeze({
    MODE: 'SAFE_ADD_ONLY',
    LONGTERM_INSTANCE: 'influxdb.0',
    LIVE_INSTANCE: 'influxdb.1',
    APPLY_ON_STARTUP: false
});

function historySettings(profile) {
    const base = {
        enabled: true,
        storageType: '',
        aliasId: '',
        debounceTime: 0,
        debounce: 0,
        blockTime: 0,
        changesOnly: true,
        changesRelogInterval: 0,
        changesMinDelta: 0,
        ignoreBelowNumber: '',
        disableSkippedValueLogging: false,
        enableDebugLogs: false
    };

    if (profile === 'B') {
        // Lang konstant bleibende Linien (z. B. Vorlauf Soll) sicher sichtbar halten.
        return Object.freeze({ ...base, changesRelogInterval: 300 });
    }

    if (profile === 'C') {
        // Dynamische Messwerte begrenzen, ohne fünf Minuten Auflösung zu verlieren.
        return Object.freeze({ ...base, blockTime: 60000 });
    }

    return Object.freeze(base);
}

const HISTORY_PROFILES = Object.freeze({
    A: historySettings('A'),
    B: historySettings('B'),
    C: historySettings('C'),
    D: historySettings('D')
});

function historyItem(path, instance, profile) {
    return Object.freeze({
        id: `0_userdata.0.NPS.DashboardData.${path}`,
        instance,
        profile
    });
}

const HISTORY_TARGETS = Object.freeze([
    // Profil A – Tages-/Langzeitwerte -> influxdb.0
    historyItem('Statistics.AnteilVerdichter.Yesterday', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Statistics.AnteilZusatzheizung.Yesterday', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Statistics.COPGesamt.Yesterday', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Statistics.COPHeizung.Yesterday', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Statistics.COPWarmwasser.Yesterday', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),

    historyItem('Energy.History.ElectricTotalPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Energy.History.ElectricHeatingPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Energy.History.ElectricWarmwaterPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Energy.History.ElectricZHPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Energy.History.HeatTotalPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Energy.History.HeatHeatingPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Energy.History.HeatWarmwaterPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Energy.History.HeatZHPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),

    historyItem('Compressor.History.StartsPerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),
    historyItem('Compressor.History.RuntimePerDay', HISTORY_POLICY.LONGTERM_INSTANCE, 'A'),

    // Profil B – kontinuierliche Mess-/Sollwerte -> influxdb.1
    // Änderungen sofort; bei unverändertem Wert spätestens alle 300 s erneut speichern.
    historyItem('Temperatures.Outdoor', HISTORY_POLICY.LIVE_INSTANCE, 'B'),
    historyItem('Temperatures.SupplyTarget', HISTORY_POLICY.LIVE_INSTANCE, 'B'),
    historyItem('Temperatures.Supply', HISTORY_POLICY.LIVE_INSTANCE, 'B'),
    historyItem('Temperatures.Return', HISTORY_POLICY.LIVE_INSTANCE, 'B'),
    historyItem('Temperatures.Warmwater', HISTORY_POLICY.LIVE_INSTANCE, 'B'),
    historyItem('Temperatures.WarmwaterCharging', HISTORY_POLICY.LIVE_INSTANCE, 'B'),

    // Profil C – dynamische Betriebswerte -> influxdb.1
    historyItem('Temperatures.DeltaT', HISTORY_POLICY.LIVE_INSTANCE, 'C'),
    historyItem('Temperatures.Flow', HISTORY_POLICY.LIVE_INSTANCE, 'C'),
    historyItem('Compressor.Frequency', HISTORY_POLICY.LIVE_INSTANCE, 'C'),

    // Profil D – Ereignis-/Zykluswerte -> influxdb.1
    historyItem('Defrost.Active', HISTORY_POLICY.LIVE_INSTANCE, 'D'),
    historyItem('Cycles.COP', HISTORY_POLICY.LIVE_INSTANCE, 'D'),
    historyItem('Cycles.Duration', HISTORY_POLICY.LIVE_INSTANCE, 'D'),
    historyItem('Cycles.Quality', HISTORY_POLICY.LIVE_INSTANCE, 'D')
]);

// Diese Quelle ist für den vorhandenen InfluxAdapter fachlich fest an influxdb.1 gebunden.
// Sie wird ausschließlich geprüft, niemals durch die neue History-Verwaltung verändert.
const HISTORY_PROTECTED = Object.freeze([
    Object.freeze({
        id: SOURCE.CYCLE_REPORT,
        expectedInstance: HISTORY_POLICY.LIVE_INSTANCE,
        reason: 'CycleReport-Quelle des InfluxAdapters'
    })
]);

const TYPE_CODES = Object.freeze({
    HEIZUNG: 1,
    WARMWASSER: 2,
    ABTAUUNG: 3
});

let refreshRunning = false;
let refreshPending = false;
const subscriptions = [];

function id(path) {
    return `${MODULE.ROOT}.${path}`;
}

function nowText() {
    return new Date().toLocaleString('de-DE');
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

    await ensureChannel(id('Configuration'), 'Konfiguration');
    await ensureState(id('Configuration.Enabled'), DEFAULTS.ENABLED, {
        name: 'Modul aktiviert', type: 'boolean', role: 'switch.enable', write: true
    });
    await ensureState(id('Configuration.InfluxInstance'), DEFAULTS.INFLUX_INSTANCE, {
        name: 'InfluxDB-Instanz', type: 'string', role: 'text', write: true
    });
    await ensureState(id('Configuration.NumberOfCycles'), DEFAULTS.NUMBER_OF_CYCLES, {
        name: 'Maximale Anzahl Zyklen', type: 'number', role: 'level', min: 1, max: 5000, write: true
    });
    await ensureState(id('Configuration.LookbackDays'), DEFAULTS.LOOKBACK_DAYS, {
        name: 'Rückblick', type: 'number', role: 'value.interval', unit: 'd', min: 1, max: 3650, write: true
    });
    await ensureState(id('Configuration.QueryTimeoutSeconds'), DEFAULTS.QUERY_TIMEOUT_SECONDS, {
        name: 'Abfrage-Timeout', type: 'number', role: 'value.interval', unit: 's', min: 5, max: 300, write: true
    });
    await ensureState(id('Configuration.LoadOnStartup'), DEFAULTS.LOAD_ON_STARTUP, {
        name: 'Beim Skriptstart laden', type: 'boolean', role: 'switch.enable', write: true
    });
    await ensureState(id('Configuration.IncludeInvalidCycles'), DEFAULTS.INCLUDE_INVALID_CYCLES, {
        name: 'Ungültige Zyklen einbeziehen', type: 'boolean', role: 'switch.enable', write: true
    });
    await ensureState(id('Configuration.Debug'), DEFAULTS.DEBUG, {
        name: 'Debug-Ausgaben aktiviert', type: 'boolean', role: 'switch', write: true
    });

    await ensureChannel(id('Command'), 'Befehle');
    await ensureState(id('Command.Refresh'), false, {
        name: 'Historie neu laden', type: 'boolean', role: 'button', write: true
    });
    await ensureState(id('Command.AuditHistoryConfig'), false, {
        name: 'History-Konfiguration prüfen', type: 'boolean', role: 'button', write: true
    });
    await ensureState(id('Command.ApplyHistoryConfig'), false, {
        name: 'Fehlende History-Konfiguration ergänzen', type: 'boolean', role: 'button', write: true
    });

    await ensureChannel(id('HistoryConfig'), 'Jarvis-HistoryGraph-Konfiguration');
    await ensureState(id('HistoryConfig.Mode'), HISTORY_POLICY.MODE, {
        name: 'History-Verwaltungsmodus', type: 'string', role: 'text'
    });
    await ensureState(id('HistoryConfig.ManagedCount'), HISTORY_TARGETS.length, {
        name: 'Verwaltete Datenpunkte', type: 'number', role: 'value'
    });
    await ensureState(id('HistoryConfig.PreservedCount'), 0, {
        name: 'Bestehende aktive Historien unverändert', type: 'number', role: 'value'
    });
    await ensureState(id('HistoryConfig.MissingCount'), 0, {
        name: 'Fehlende History-Konfigurationen', type: 'number', role: 'value'
    });
    await ensureState(id('HistoryConfig.ConflictCount'), 0, {
        name: 'Konflikte mit anderer Influx-Instanz', type: 'number', role: 'value'
    });
    await ensureState(id('HistoryConfig.DuplicateCount'), 0, {
        name: 'Doppelhistorien influxdb.0/influxdb.1', type: 'number', role: 'value'
    });
    await ensureState(id('HistoryConfig.MissingObjectCount'), 0, {
        name: 'Fehlende Datenpunktobjekte', type: 'number', role: 'value'
    });
    await ensureState(id('HistoryConfig.AppliedCount'), 0, {
        name: 'Neu ergänzte History-Konfigurationen', type: 'number', role: 'value'
    });
    await ensureState(id('HistoryConfig.LastAudit'), '', {
        name: 'Letzte History-Prüfung', type: 'string', role: 'date'
    });
    await ensureState(id('HistoryConfig.Status'), 'UNGEPRÜFT', {
        name: 'History-Konfigurationsstatus', type: 'string', role: 'text'
    });
    await ensureState(id('HistoryConfig.ReportJson'), '[]', {
        name: 'History-Konfigurationsreport', type: 'string', role: 'json'
    });

    await ensureChannel(id('History'), 'Historische Zyklen');
    await ensureState(id('History.AllCyclesJson'), '[]', {
        name: 'Alle Zyklen als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('History.HeatingCyclesJson'), '[]', {
        name: 'Heizzyklen als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('History.WarmwaterCyclesJson'), '[]', {
        name: 'Warmwasserzyklen als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('History.DefrostCyclesJson'), '[]', {
        name: 'Abtauzyklen als JSON', type: 'string', role: 'json'
    });
    await ensureState(id('History.LastCycleJson'), '{}', {
        name: 'Letzter Zyklus als JSON', type: 'string', role: 'json'
    });

    await ensureChannel(id('Result'), 'Ergebnis');
    await ensureState(id('Result.CycleCount'), 0, {
        name: 'Anzahl Zyklen', type: 'number', role: 'value'
    });
    await ensureState(id('Result.HeatingCycleCount'), 0, {
        name: 'Anzahl Heizzyklen', type: 'number', role: 'value'
    });
    await ensureState(id('Result.WarmwaterCycleCount'), 0, {
        name: 'Anzahl Warmwasserzyklen', type: 'number', role: 'value'
    });
    await ensureState(id('Result.DefrostCycleCount'), 0, {
        name: 'Anzahl Abtauzyklen', type: 'number', role: 'value'
    });
    await ensureState(id('Result.OldestTimestamp'), '', {
        name: 'Ältester Zyklus', type: 'string', role: 'date'
    });
    await ensureState(id('Result.NewestTimestamp'), '', {
        name: 'Neuester Zyklus', type: 'string', role: 'date'
    });

    await ensureChannel(id('Diagnostics'), 'Diagnose');
    await ensureState(id('Diagnostics.QueryCount'), 0, {
        name: 'Influx-Abfragen', type: 'number', role: 'value'
    });
    await ensureState(id('Diagnostics.HistoryEntryCount'), 0, {
        name: 'Gelesene Historieneinträge', type: 'number', role: 'value'
    });
    await ensureState(id('Diagnostics.ParsedCycleCount'), 0, {
        name: 'Erfolgreich gelesene Reports', type: 'number', role: 'value'
    });
    await ensureState(id('Diagnostics.InvalidJsonCount'), 0, {
        name: 'Ungültige JSON-Einträge', type: 'number', role: 'value'
    });
    await ensureState(id('Diagnostics.DuplicateCount'), 0, {
        name: 'Entfernte Dubletten', type: 'number', role: 'value'
    });
    await ensureState(id('Diagnostics.RejectedCycleCount'), 0, {
        name: 'Verworfene Zyklen', type: 'number', role: 'value'
    });
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
    await ensureState(id('System.LastRefresh'), '', {
        name: 'Letzte Aktualisierung', type: 'string', role: 'date'
    });
    await ensureState(id('System.LastMessage'), '', {
        name: 'Letzte Meldung', type: 'string', role: 'text'
    });
}

function stateValue(path, fallback) {
    const state = getState(id(path));
    return state && state.val !== null && state.val !== undefined ? state.val : fallback;
}

function clampInteger(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

function readConfig() {
    const influxInstance = String(stateValue('Configuration.InfluxInstance', DEFAULTS.INFLUX_INSTANCE)).trim();
    return {
        enabled: stateValue('Configuration.Enabled', DEFAULTS.ENABLED) === true,
        influxInstance: influxInstance || DEFAULTS.INFLUX_INSTANCE,
        numberOfCycles: clampInteger(stateValue('Configuration.NumberOfCycles', DEFAULTS.NUMBER_OF_CYCLES), DEFAULTS.NUMBER_OF_CYCLES, 1, 5000),
        lookbackDays: clampInteger(stateValue('Configuration.LookbackDays', DEFAULTS.LOOKBACK_DAYS), DEFAULTS.LOOKBACK_DAYS, 1, 3650),
        queryTimeoutSeconds: clampInteger(stateValue('Configuration.QueryTimeoutSeconds', DEFAULTS.QUERY_TIMEOUT_SECONDS), DEFAULTS.QUERY_TIMEOUT_SECONDS, 5, 300),
        loadOnStartup: stateValue('Configuration.LoadOnStartup', DEFAULTS.LOAD_ON_STARTUP) === true,
        includeInvalidCycles: stateValue('Configuration.IncludeInvalidCycles', DEFAULTS.INCLUDE_INVALID_CYCLES) === true,
        debug: stateValue('Configuration.Debug', DEFAULTS.DEBUG) === true
    };
}

function logDebug(message) {
    if (readConfig().debug) log(`[${MODULE.NAME}] ${message}`, 'info');
}


function isHistoryEnabled(custom, instance) {
    return !!(
        custom &&
        custom[instance] &&
        custom[instance].enabled === true
    );
}

function otherInfluxInstance(instance) {
    return instance === HISTORY_POLICY.LONGTERM_INSTANCE
        ? HISTORY_POLICY.LIVE_INSTANCE
        : HISTORY_POLICY.LONGTERM_INSTANCE;
}

function relevantHistorySettings(settings) {
    if (!settings || typeof settings !== 'object') return {};
    return {
        enabled: settings.enabled === true,
        changesOnly: settings.changesOnly === true,
        debounceTime: Number(settings.debounceTime || settings.debounce || 0),
        blockTime: Number(settings.blockTime || 0),
        changesRelogInterval: Number(settings.changesRelogInterval || 0),
        changesMinDelta: Number(settings.changesMinDelta || 0),
        ignoreBelowNumber: settings.ignoreBelowNumber === undefined ? '' : settings.ignoreBelowNumber,
        disableSkippedValueLogging: settings.disableSkippedValueLogging === true,
        storageType: settings.storageType || '',
        aliasId: settings.aliasId || ''
    };
}

function differsFromProfile(existing, desired) {
    const actual = relevantHistorySettings(existing);
    const expected = relevantHistorySettings(desired);
    return Object.keys(expected).some(key => actual[key] !== expected[key]);
}

function extendObjectPromise(path, extension) {
    return new Promise((resolve, reject) => {
        extendObject(path, extension, error => {
            if (error) reject(error);
            else resolve();
        });
    });
}

async function auditHistoryConfig(applyMissing) {
    const report = [];
    let preservedCount = 0;
    let missingCount = 0;
    let conflictCount = 0;
    let duplicateCount = 0;
    let missingObjectCount = 0;
    let appliedCount = 0;

    for (const target of HISTORY_TARGETS) {
        const obj = getObject(target.id);
        if (!obj || obj.type !== 'state') {
            missingObjectCount++;
            report.push({
                id: target.id,
                target: target.instance,
                profile: target.profile,
                status: 'OBJECT_MISSING',
                changed: false
            });
            continue;
        }

        const custom = obj.common && obj.common.custom ? obj.common.custom : {};
        const targetEnabled = isHistoryEnabled(custom, target.instance);
        const otherInstance = otherInfluxInstance(target.instance);
        const otherEnabled = isHistoryEnabled(custom, otherInstance);

        if (targetEnabled && otherEnabled) {
            duplicateCount++;
            conflictCount++;
            report.push({
                id: target.id,
                target: target.instance,
                profile: target.profile,
                status: 'DUPLICATE_ACTIVE',
                changed: false,
                note: `${target.instance} und ${otherInstance} sind aktiv; SAFE_ADD_ONLY verändert nichts.`
            });
            continue;
        }

        if (targetEnabled) {
            preservedCount++;
            const differs = differsFromProfile(custom[target.instance], HISTORY_PROFILES[target.profile]);
            report.push({
                id: target.id,
                target: target.instance,
                profile: target.profile,
                status: differs ? 'PRESERVED_ACTIVE_DIFFERENT_SETTINGS' : 'PRESERVED_ACTIVE',
                changed: false,
                existing: relevantHistorySettings(custom[target.instance])
            });
            continue;
        }

        if (otherEnabled) {
            conflictCount++;
            report.push({
                id: target.id,
                target: target.instance,
                profile: target.profile,
                status: 'OTHER_INSTANCE_ACTIVE',
                changed: false,
                activeInstance: otherInstance,
                note: 'Keine zweite History aktiviert; bestehende aktive History bleibt unverändert.'
            });
            continue;
        }

        missingCount++;

        if (!applyMissing) {
            report.push({
                id: target.id,
                target: target.instance,
                profile: target.profile,
                status: 'MISSING',
                changed: false
            });
            continue;
        }

        const currentTargetSettings =
            custom[target.instance] && typeof custom[target.instance] === 'object'
                ? custom[target.instance]
                : {};

        // Nur der bislang inaktive Zielblock wird ergänzt/aktiviert.
        // Alle anderen custom-Konfigurationen (statistics, andere Adapter, deaktivierte
        // Influx-Instanz usw.) bleiben vollständig erhalten.
        const mergedTargetSettings = {
            ...currentTargetSettings,
            ...HISTORY_PROFILES[target.profile],
            enabled: true
        };

        const mergedCustom = {
            ...custom,
            [target.instance]: mergedTargetSettings
        };

        await extendObjectPromise(target.id, {
            common: {
                custom: mergedCustom
            }
        });

        appliedCount++;
        report.push({
            id: target.id,
            target: target.instance,
            profile: target.profile,
            status: 'APPLIED_MISSING',
            changed: true,
            applied: relevantHistorySettings(mergedTargetSettings)
        });
    }

    // Geschützte Quellen nur prüfen, niemals verändern.
    for (const protectedItem of HISTORY_PROTECTED) {
        const obj = getObject(protectedItem.id);
        if (!obj || obj.type !== 'state') {
            report.push({
                id: protectedItem.id,
                target: protectedItem.expectedInstance,
                status: 'PROTECTED_OBJECT_MISSING',
                changed: false,
                note: protectedItem.reason
            });
            continue;
        }

        const custom = obj.common && obj.common.custom ? obj.common.custom : {};
        const expectedEnabled = isHistoryEnabled(custom, protectedItem.expectedInstance);
        const otherInstance = otherInfluxInstance(protectedItem.expectedInstance);
        const otherEnabled = isHistoryEnabled(custom, otherInstance);

        if (expectedEnabled && otherEnabled) {
            duplicateCount++;
            conflictCount++;
            report.push({
                id: protectedItem.id,
                target: protectedItem.expectedInstance,
                status: 'PROTECTED_DUPLICATE_ACTIVE',
                changed: false,
                note: `${protectedItem.reason}; beide Influx-Instanzen aktiv, keine automatische Änderung.`
            });
        } else {
            report.push({
                id: protectedItem.id,
                target: protectedItem.expectedInstance,
                status: expectedEnabled ? 'PROTECTED_OK' : 'PROTECTED_EXPECTED_INSTANCE_NOT_ACTIVE',
                changed: false,
                note: protectedItem.reason
            });
        }
    }

    const status =
        duplicateCount > 0 ? 'DOPPELHISTORIE_GEFUNDEN' :
        conflictCount > 0 ? 'KONFLIKTE_GEFUNDEN' :
        missingObjectCount > 0 ? 'DATENPUNKTE_FEHLEN' :
        missingCount > appliedCount ? 'HISTORY_FEHLT' :
        'OK';

    await setStateAsync(id('HistoryConfig.Mode'), HISTORY_POLICY.MODE, true);
    await setStateAsync(id('HistoryConfig.ManagedCount'), HISTORY_TARGETS.length, true);
    await setStateAsync(id('HistoryConfig.PreservedCount'), preservedCount, true);
    await setStateAsync(id('HistoryConfig.MissingCount'), missingCount, true);
    await setStateAsync(id('HistoryConfig.ConflictCount'), conflictCount, true);
    await setStateAsync(id('HistoryConfig.DuplicateCount'), duplicateCount, true);
    await setStateAsync(id('HistoryConfig.MissingObjectCount'), missingObjectCount, true);
    await setStateAsync(id('HistoryConfig.AppliedCount'), appliedCount, true);
    await setStateAsync(id('HistoryConfig.LastAudit'), nowText(), true);
    await setStateAsync(id('HistoryConfig.Status'), status, true);
    await setStateAsync(id('HistoryConfig.ReportJson'), JSON.stringify(report), true);

    log(
        `[${MODULE.NAME}] HistoryConfig ${applyMissing ? 'APPLY' : 'AUDIT'}: ` +
        `${HISTORY_TARGETS.length} verwaltet | ${preservedCount} unverändert | ` +
        `${missingCount} fehlend | ${appliedCount} ergänzt | ` +
        `${conflictCount} Konflikt(e) | ${duplicateCount} Doppelhistorie(n) | ` +
        `${missingObjectCount} Objekt(e) fehlen.`,
        duplicateCount > 0 || conflictCount > 0 ? 'warn' : 'info'
    );

    return {
        status,
        preservedCount,
        missingCount,
        conflictCount,
        duplicateCount,
        missingObjectCount,
        appliedCount,
        report
    };
}

function normalizeHistoryResponse(response) {
    if (!response) return [];
    if (response.error) throw new Error(String(response.error));

    const raw = Array.isArray(response)
        ? response
        : Array.isArray(response.result)
            ? response.result
            : [];

    return raw
        .map(entry => ({
            ts: Number(entry.ts !== undefined ? entry.ts : entry.time),
            val: entry.val
        }))
        .filter(entry => Number.isFinite(entry.ts))
        .sort((a, b) => a.ts - b.ts);
}

function queryHistory(instance, sourceId, options, timeoutSeconds) {
    return new Promise((resolve, reject) => {
        let completed = false;
        const timer = setTimeout(() => {
            if (completed) return;
            completed = true;
            reject(new Error(`Timeout bei Historienabfrage von ${sourceId}`));
        }, timeoutSeconds * 1000);

        sendTo(instance, 'getHistory', { id: sourceId, options }, response => {
            if (completed) return;
            completed = true;
            clearTimeout(timer);
            try {
                resolve(normalizeHistoryResponse(response));
            } catch (error) {
                reject(error);
            }
        });
    });
}

function parseTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function reportTimestamp(report, historyTimestamp) {
    const candidates = [
        report && report.analysis && report.analysis.end,
        report && report.analysis && report.analysis.start,
        report && report.analyzedAt
    ];
    for (const candidate of candidates) {
        const parsed = parseTimestamp(candidate);
        if (parsed !== null) return parsed;
    }
    return historyTimestamp;
}

function reportKey(report, historyTimestamp) {
    const analysis = report && report.analysis ? report.analysis : {};
    if (analysis.id !== undefined && analysis.id !== null && String(analysis.id).trim() !== '') {
        return `id:${String(analysis.id)}`;
    }
    if (Number.isFinite(Number(analysis.runNumber))) {
        return `run:${Number(analysis.runNumber)}|end:${String(analysis.end || '')}`;
    }
    return `ts:${historyTimestamp}`;
}

function validateReport(report) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
        return 'Report ist kein Objekt';
    }
    if (!report.analysis || typeof report.analysis !== 'object') {
        return 'analysis fehlt';
    }
    if (!Number.isFinite(Number(report.analysis.runNumber))) {
        return 'analysis.runNumber fehlt';
    }
    if (!Number.isFinite(Number(report.analysis.typeCode))) {
        return 'analysis.typeCode fehlt';
    }
    return '';
}

function parseHistoryEntries(entries, config) {
    const unique = new Map();
    let invalidJsonCount = 0;
    let rejectedCycleCount = 0;
    let duplicateCount = 0;

    for (const entry of entries) {
        let report;
        try {
            if (typeof entry.val === 'string') {
                const text = entry.val.trim();
                if (!text || text === '{}' || text === 'null') {
                    rejectedCycleCount++;
                    continue;
                }
                report = JSON.parse(text);
            } else if (entry.val && typeof entry.val === 'object') {
                report = entry.val;
            } else {
                invalidJsonCount++;
                continue;
            }
        } catch (error) {
            invalidJsonCount++;
            continue;
        }

        const validationError = validateReport(report);
        if (validationError) {
            rejectedCycleCount++;
            continue;
        }

        if (!config.includeInvalidCycles && report.analysis.valid === false) {
            rejectedCycleCount++;
            continue;
        }

        const timestamp = reportTimestamp(report, entry.ts);
        const enriched = {
            ...report,
            history: {
                ...(report.history && typeof report.history === 'object' ? report.history : {}),
                timestamp,
                timestampIso: new Date(timestamp).toISOString(),
                sourceTimestamp: entry.ts,
                sourceTimestampIso: new Date(entry.ts).toISOString()
            }
        };

        const key = reportKey(report, entry.ts);
        const previous = unique.get(key);
        if (previous) {
            duplicateCount++;
            if (entry.ts >= previous.history.sourceTimestamp) unique.set(key, enriched);
        } else {
            unique.set(key, enriched);
        }
    }

    const cycles = Array.from(unique.values())
        .sort((a, b) => a.history.timestamp - b.history.timestamp)
        .slice(-config.numberOfCycles);

    return {
        cycles,
        parsedCycleCount: cycles.length,
        invalidJsonCount,
        duplicateCount,
        rejectedCycleCount
    };
}

async function loadCycles(config) {
    const end = Date.now();
    const start = end - config.lookbackDays * 24 * 60 * 60 * 1000;
    const entries = await queryHistory(
        config.influxInstance,
        SOURCE.CYCLE_REPORT,
        {
            start,
            end,
            aggregate: 'none',
            addId: false,
            count: config.numberOfCycles * 3,
            returnNewestEntries: true
        },
        config.queryTimeoutSeconds
    );

    const parsed = parseHistoryEntries(entries, config);
    return {
        ...parsed,
        queryCount: 1,
        historyEntryCount: entries.length
    };
}

async function writeResults(result) {
    const cycles = result.cycles;
    const heating = cycles.filter(cycle => Number(cycle.analysis.typeCode) === TYPE_CODES.HEIZUNG);
    const warmwater = cycles.filter(cycle => Number(cycle.analysis.typeCode) === TYPE_CODES.WARMWASSER);
    const defrost = cycles.filter(cycle => Number(cycle.analysis.typeCode) === TYPE_CODES.ABTAUUNG);
    const last = cycles.length ? cycles[cycles.length - 1] : {};

    await setStateAsync(id('History.AllCyclesJson'), JSON.stringify(cycles), true);
    await setStateAsync(id('History.HeatingCyclesJson'), JSON.stringify(heating), true);
    await setStateAsync(id('History.WarmwaterCyclesJson'), JSON.stringify(warmwater), true);
    await setStateAsync(id('History.DefrostCyclesJson'), JSON.stringify(defrost), true);
    await setStateAsync(id('History.LastCycleJson'), JSON.stringify(last), true);

    await setStateAsync(id('Result.CycleCount'), cycles.length, true);
    await setStateAsync(id('Result.HeatingCycleCount'), heating.length, true);
    await setStateAsync(id('Result.WarmwaterCycleCount'), warmwater.length, true);
    await setStateAsync(id('Result.DefrostCycleCount'), defrost.length, true);
    await setStateAsync(id('Result.OldestTimestamp'), cycles.length ? cycles[0].history.timestampIso : '', true);
    await setStateAsync(id('Result.NewestTimestamp'), cycles.length ? cycles[cycles.length - 1].history.timestampIso : '', true);

    await setStateAsync(id('Diagnostics.QueryCount'), result.queryCount, true);
    await setStateAsync(id('Diagnostics.HistoryEntryCount'), result.historyEntryCount, true);
    await setStateAsync(id('Diagnostics.ParsedCycleCount'), result.parsedCycleCount, true);
    await setStateAsync(id('Diagnostics.InvalidJsonCount'), result.invalidJsonCount, true);
    await setStateAsync(id('Diagnostics.DuplicateCount'), result.duplicateCount, true);
    await setStateAsync(id('Diagnostics.RejectedCycleCount'), result.rejectedCycleCount, true);

    const warnings = [];
    if (result.invalidJsonCount > 0) warnings.push(`${result.invalidJsonCount} ungültige JSON-Einträge`);
    if (result.duplicateCount > 0) warnings.push(`${result.duplicateCount} Dublette(n) entfernt`);
    if (result.rejectedCycleCount > 0) warnings.push(`${result.rejectedCycleCount} Zyklus/Zyklen verworfen`);
    await setStateAsync(id('Diagnostics.Warning'), warnings.join('; '), true);

    const trace = [
        nowText(),
        `Source=${SOURCE.CYCLE_REPORT}`,
        `Queries=${result.queryCount}`,
        `HistoryEntries=${result.historyEntryCount}`,
        `Cycles=${cycles.length}`,
        `Heating=${heating.length}`,
        `Warmwater=${warmwater.length}`,
        `Defrost=${defrost.length}`,
        `InvalidJson=${result.invalidJsonCount}`,
        `Duplicates=${result.duplicateCount}`,
        `Rejected=${result.rejectedCycleCount}`,
        `Oldest=${cycles.length ? cycles[0].history.timestampIso : '-'}`,
        `Newest=${cycles.length ? cycles[cycles.length - 1].history.timestampIso : '-'}`
    ].join('\n');
    await setStateAsync(id('Diagnostics.Trace'), trace, true);
}

async function refresh(reason) {
    if (refreshRunning) {
        refreshPending = true;
        logDebug(`Aktualisierung läuft; weiterer Lauf vorgemerkt (${reason}).`);
        return;
    }

    refreshRunning = true;
    const config = readConfig();

    try {
        if (!config.enabled) {
            await setStateAsync(id('System.Active'), false, true);
            await setStateAsync(id('System.Status'), 'DEAKTIVIERT', true);
            await setStateAsync(id('System.LastMessage'), 'Modul ist deaktiviert', true);
            return;
        }

        await setStateAsync(id('System.Active'), true, true);
        await setStateAsync(id('System.Status'), 'LÄDT', true);
        await setStateAsync(id('System.LastMessage'), `CycleReports werden geladen (${reason})`, true);
        await setStateAsync(id('Diagnostics.Warning'), '', true);

        logDebug(`Lade bis zu ${config.numberOfCycles} CycleReports aus ${config.influxInstance}.`);
        const result = await loadCycles(config);
        await writeResults(result);

        await setStateAsync(id('System.LastRefresh'), nowText(), true);
        await setStateAsync(id('System.Status'), 'BEREIT', true);
        await setStateAsync(id('System.LastMessage'), `${result.cycles.length} CycleReport(s) geladen`, true);
        log(`[${MODULE.NAME}] ${result.cycles.length} CycleReport(s) mit einer Influx-Abfrage geladen.`, 'info');
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        await setStateAsync(id('System.Status'), 'FEHLER', true);
        await setStateAsync(id('System.LastMessage'), message, true);
        await setStateAsync(id('Diagnostics.Warning'), message, true);
        log(`[${MODULE.NAME}] Aktualisierung fehlgeschlagen: ${message}`, 'error');
    } finally {
        refreshRunning = false;
        await setStateAsync(id('Command.Refresh'), false, true);

        if (refreshPending) {
            refreshPending = false;
            setTimeout(() => refresh('VORGEMERKTER LAUF'), 1000);
        }
    }
}

function subscribeEvents() {
    subscriptions.push(on({ id: id('Command.Refresh'), change: 'ne' }, obj => {
        if (obj && obj.state && obj.state.val === true) refresh('MANUELL');
    }));

    subscriptions.push(on({ id: id('Command.AuditHistoryConfig'), change: 'ne' }, obj => {
        if (!obj || !obj.state || obj.state.val !== true) return;
        auditHistoryConfig(false)
            .catch(error => log(`[${MODULE.NAME}] History-Audit fehlgeschlagen: ${error && error.message ? error.message : error}`, 'error'))
            .finally(() => setState(id('Command.AuditHistoryConfig'), false, true));
    }));

    subscriptions.push(on({ id: id('Command.ApplyHistoryConfig'), change: 'ne' }, obj => {
        if (!obj || !obj.state || obj.state.val !== true) return;
        auditHistoryConfig(true)
            .catch(error => log(`[${MODULE.NAME}] History-Apply fehlgeschlagen: ${error && error.message ? error.message : error}`, 'error'))
            .finally(() => setState(id('Command.ApplyHistoryConfig'), false, true));
    }));

    subscriptions.push(on({ id: SOURCE.CYCLE_REPORT, change: 'ne' }, obj => {
        if (!obj || !obj.state || obj.state.ack !== true) return;
        // Kurze Verzögerung, damit der neue JSON-Wert sicher in InfluxDB gespeichert ist.
        setTimeout(() => refresh('NEUER CYCLE-REPORT'), 5000);
    }));

    subscriptions.push(on({ id: id('Configuration.Enabled'), change: 'ne' }, obj => {
        if (obj && obj.state && obj.state.val === true) refresh('AKTIVIERT');
        else {
            setState(id('System.Active'), false, true);
            setState(id('System.Status'), 'DEAKTIVIERT', true);
            setState(id('System.LastMessage'), 'Modul ist deaktiviert', true);
        }
    }));
}

async function start() {
    await createStructure();
    await setStateAsync(id('System.Version'), MODULE.VERSION, true);
    await setStateAsync(id('System.LastStart'), nowText(), true);
    await setStateAsync(id('System.Active'), true, true);
    await setStateAsync(id('System.Status'), 'BEREIT', true);
    await setStateAsync(id('System.LastMessage'), 'Modul gestartet', true);

    subscribeEvents();

    // Beim Start wird ausschließlich geprüft. Es wird nichts automatisch verändert.
    await auditHistoryConfig(false);
    if (HISTORY_POLICY.APPLY_ON_STARTUP) {
        await auditHistoryConfig(true);
    }

    const config = readConfig();
    if (!config.enabled) {
        await setStateAsync(id('System.Active'), false, true);
        await setStateAsync(id('System.Status'), 'DEAKTIVIERT', true);
        await setStateAsync(id('System.LastMessage'), 'Modul ist deaktiviert', true);
        return;
    }

    log(`[${MODULE.NAME}] Version ${MODULE.VERSION} gestartet.`, 'info');
    if (config.loadOnStartup) setTimeout(() => refresh('SKRIPTSTART'), 3000);
}

onStop(() => {
    try {
        for (const subscription of subscriptions) unsubscribe(subscription);
    } catch (error) {
        // ioBroker entfernt Registrierungen beim Skriptstopp zusätzlich selbst.
    }
    setState(id('System.Active'), false, true);
    setState(id('System.Status'), 'GESTOPPT', true);
    setState(id('System.LastMessage'), 'Modul gestoppt', true);
}, 1000);

start().catch(error => {
    log(`[${MODULE.NAME}] Startfehler: ${error && error.message ? error.message : error}`, 'error');
});

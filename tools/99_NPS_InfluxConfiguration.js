/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               99_NPS_InfluxConfiguration
 * Datei:               99_NPS_InfluxConfiguration.js
 * Version:             1.0.1
 * Build:               2026-07-20
 * Modulstatus:         STABIL
 * Architektur-Schicht: Infrastruktur / Historisierungskonfiguration
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Konfiguriert die vollständige Historisierungsabdeckung der vom
 * 13_NPS_CycleAnalyzer erzeugten Datenpunkte für influxdb.1. Fachliche
 * Kennzahlen und der vollständige CycleReport werden aktiviert; Konfiguration,
 * System-, Diagnose-, Speicher- und reine Text-/Berichtsdaten werden gezielt
 * deaktiviert. influxdb.0 bleibt unverändert.
 *
 * Eingänge (nur lesend)
 * ---------------------
 * - Objektstruktur unter 0_userdata.0.NPS.CycleAnalyzer.*
 * - Vorhandene Custom-Konfigurationen der ioBroker-Datenpunkte
 *
 * Ausgänge / Public API
 * ---------------------
 * - common.custom["influxdb.1"] der aufgelisteten CycleAnalyzer-States
 * - Konsolenprotokoll mit Aktivierungs-, Deaktivierungs- und Fehlerstatistik
 * - Keine eigenen Datenpunkte und keine dauerhafte Laufzeitaktivität
 *
 * Historisierungsvertrag
 * ----------------------
 * - History.CycleReportJson ist zwingend aktiviert und bildet die einzige
 *   vollständige Historienquelle für 11_NPS_InfluxAdapter.
 * - changesOnly=false stellt sicher, dass jeder abgeschlossene Zyklus als
 *   vollständiges JSON-Dokument archiviert wird.
 * - Alle 84 vom CycleAnalyzer angelegten States sind explizit klassifiziert:
 *   57 aktiviert und 27 deaktiviert; kein State bleibt unberücksichtigt.
 *
 * Abhängigkeiten
 * ---------------
 * - 13_NPS_CycleAnalyzer 1.0.1 (Datenpunktstruktur und CycleReport-Vertrag)
 * - 11_NPS_InfluxAdapter 1.0.1 (liest History.CycleReportJson)
 * - Installierte InfluxDB-Instanz influxdb.1
 * - ioBroker JavaScript-Adapter
 *
 * Architekturregeln
 * -----------------
 * - Keine Erzeugung, Berechnung oder Veränderung fachlicher Messwerte
 * - Keine direkte InfluxDB-Abfrage und keine Analysefunktion
 * - Bestehende Custom-Konfigurationen anderer Adapter bleiben erhalten
 * - Wiederholte Ausführung ist idempotent
 * - Nicht vorhandene Datenpunkte werden protokolliert und übersprungen
 *
 * Änderungsverlauf
 * ----------------
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert und Modulvertrag dokumentiert.
 *       | VERSION auf 1.0.1 angehoben.
 *       | History.CycleReportJson als zwingenden Logging-Datenpunkt ergänzt.
 *       | History.LastArchivedRunNumber und History.LastArchivedAt explizit
 *       | als nicht zu historisierende Metadaten aufgenommen.
 *       | Vollständigkeitsprüfung gegen alle 84 CycleAnalyzer-States: 57
 *       | aktiviert, 27 deaktiviert, keine Lücke und keine Doppelklassifikation.
 * 0.1.1-dev
 *       | Idempotente Konfiguration von influxdb.1 für CycleAnalyzer-States.
 ****************************************************************************/

'use strict';

const SCRIPT_NAME = 'NPS InfluxConfiguration';
const VERSION = '1.0.1';
const ROOT = '0_userdata.0.NPS.CycleAnalyzer.';
const INFLUX_INSTANCE = 'influxdb.1';

// Exakte Feldstruktur der beim Benutzer installierten influxdb.1-Instanz.
const ENABLED_PROFILE = {
    enabled: true,
    storageType: '',
    aliasId: '',
    debounceTime: 0,
    blockTime: 0,
    changesOnly: false,
    changesRelogInterval: 0,
    changesMinDelta: 0,
    ignoreBelowNumber: '',
    disableSkippedValueLogging: false,
    enableDebugLogs: false,
    debounce: 1000
};

// Nur enabled wird erzwungen; vorhandene übrige Influx-Felder bleiben erhalten.
const DISABLED_PROFILE = {
    enabled: false
};

const ENABLED_STATES = [
    // Analyse
    'Analysis.TypeCode',
    'Analysis.RunNumber',
    'Analysis.DurationSeconds',
    'Analysis.RecordingDurationSeconds',
    'Analysis.SampleCount',
    'Analysis.MainSampleCount',
    'Analysis.PrebufferSampleCount',
    'Analysis.PostbufferSampleCount',
    'Analysis.Valid',

    // Historienquelle für 11_NPS_InfluxAdapter
    'History.CycleReportJson',

    // Verdichter
    'Compressor.RuntimeSeconds',
    'Compressor.FrequencyMinimum',
    'Compressor.FrequencyAverage',
    'Compressor.FrequencyMaximum',
    'Compressor.Starts',

    // Temperaturen
    'Temperature.OutdoorStart',
    'Temperature.OutdoorEnd',
    'Temperature.OutdoorMinimum',
    'Temperature.OutdoorMaximum',
    'Temperature.OutdoorAverage',
    'Temperature.HotWaterTopStart',
    'Temperature.HotWaterTopEnd',
    'Temperature.HotWaterTopMinimum',
    'Temperature.HotWaterTopMaximum',
    'Temperature.HotWaterTopRise',
    'Temperature.HotWaterChargingStart',
    'Temperature.HotWaterChargingEnd',
    'Temperature.HotWaterChargingMinimum',
    'Temperature.HotWaterChargingMaximum',
    'Temperature.HotWaterChargingRise',
    'Temperature.SupplyStart',
    'Temperature.SupplyEnd',
    'Temperature.SupplyMaximum',
    'Temperature.ReturnStart',
    'Temperature.ReturnEnd',
    'Temperature.ReturnMaximum',
    'Temperature.SpreadMinimum',
    'Temperature.SpreadAverage',
    'Temperature.SpreadMaximum',

    // Leistung
    'Power.ElectricAverageW',
    'Power.ElectricMaximumW',
    'Power.HeatAverageKW',
    'Power.HeatMaximumKW',

    // Energie
    'Energy.ElectricKWh',
    'Energy.HeatKWh',
    'Energy.COP',
    'Energy.ElectricTotalDeltaKWh',
    'Energy.AliasConsumptionDeltaKWh',
    'Energy.AliasProductionDeltaKWh',

    // Ereignisse
    'Events.DefrostCount',
    'Events.StateChangeCount',
    'Events.PriorityChangeCount',

    // Qualität
    'Quality.Score',
    'Quality.Complete',
    'Quality.ExpectedMainSamples',
    'Quality.MissingMainSamples',
    'Quality.LargestGapSeconds'
];

const DISABLED_STATES = [
    // Konfiguration
    'Configuration.AnalyzeOnStartup',
    'Configuration.Debug',
    'Configuration.Enabled',
    'Configuration.MinimumQualityScore',

    // System
    'System.Active',
    'System.LastAnalysis',
    'System.LastMessage',
    'System.LastStart',
    'System.Status',
    'System.Version',

    // Analyse: Text und Zeitstempel
    'Analysis.Id',
    'Analysis.Type',
    'Analysis.Start',
    'Analysis.End',

    // Ereignisse: Text
    'Events.StateSequence',

    // Qualität: Text
    'Quality.Rating',
    'Quality.Warning',

    // Diagnose
    'Diagnostics.AnalysisCount',
    'Diagnostics.InvalidCount',
    'Diagnostics.DuplicateCount',
    'Diagnostics.Trace',
    'Diagnostics.Warning',

    // Historien-Metadaten (keine Nutzdaten-Historie)
    'History.LastArchivedRunNumber',
    'History.LastArchivedAt',

    // Interner Speicher
    'Memory.LastProcessedRunId',

    // Berichte
    'Report.Json',
    'Report.Text'
];

const stats = {
    checked: 0,
    enabled: 0,
    disabled: 0,
    unchanged: 0,
    missing: 0,
    errors: 0
};

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    const keys = Object.keys(value).sort();
    return '{' + keys.map(function (key) {
        return JSON.stringify(key) + ':' + stableStringify(value[key]);
    }).join(',') + '}';
}

function configureState(relativeId, profile, targetEnabled) {
    const id = ROOT + relativeId;
    stats.checked += 1;

    try {
        const obj = /** @type {any} */ (getObject(id));
        if (!obj || obj.type !== 'state') {
            stats.missing += 1;
            log('FEHLT: ' + id, 'warn');
            return;
        }

        if (!obj.common || typeof obj.common !== 'object') {
            stats.errors += 1;
            log('FEHLER: Objekt ohne common-Bereich: ' + id, 'error');
            return;
        }
        obj.common.custom = obj.common.custom || {};

        const previous = obj.common.custom[INFLUX_INSTANCE] || {};
        const next = Object.assign({}, previous, profile);

        if (stableStringify(previous) === stableStringify(next)) {
            stats.unchanged += 1;
            log('OK unverändert: ' + id, 'debug');
            return;
        }

        obj.common.custom[INFLUX_INSTANCE] = next;
        setObject(id, obj);

        if (targetEnabled) {
            stats.enabled += 1;
            log('AKTIVIERT: ' + id, 'info');
        } else {
            stats.disabled += 1;
            log('DEAKTIVIERT: ' + id, 'info');
        }
    } catch (error) {
        stats.errors += 1;
        log('FEHLER bei ' + id + ': ' + error, 'error');
    }
}

function printSummary() {
    log('==================================================', 'info');
    log(SCRIPT_NAME + ' v' + VERSION, 'info');
    log('Influx-Instanz: ' + INFLUX_INSTANCE, 'info');
    log('Geprüft:       ' + stats.checked, 'info');
    log('Aktiviert:     ' + stats.enabled, 'info');
    log('Deaktiviert:   ' + stats.disabled, 'info');
    log('Unverändert:   ' + stats.unchanged, 'info');
    log('Nicht gefunden:' + stats.missing, stats.missing > 0 ? 'warn' : 'info');
    log('Fehler:        ' + stats.errors, stats.errors > 0 ? 'error' : 'info');
    log('influxdb.0 wurde nicht verändert.', 'info');
    log('==================================================', 'info');
}

function main() {
    log(SCRIPT_NAME + ' v' + VERSION + ' gestartet.', 'info');

    ENABLED_STATES.forEach(function (relativeId) {
        configureState(relativeId, ENABLED_PROFILE, true);
    });

    DISABLED_STATES.forEach(function (relativeId) {
        configureState(relativeId, DISABLED_PROFILE, false);
    });

    printSummary();
}

main();
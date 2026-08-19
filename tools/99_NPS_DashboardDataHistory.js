/**
 * ============================================================================
 * NIBE Performance Suite (NPS)
 * 99_NPS_DashboardDataHistory
 * Version: 1.0.0
 * ============================================================================
 *
 * Zweck:
 *   Konfiguriert die Kurzzeit- und Langzeitarchivierung ausgewählter
 *   Datenpunkte unter:
 *
 *     0_userdata.0.NPS.DashboardData
 *
 * Architekturregel:
 *   DashboardData ist die stabile öffentliche Schnittstelle für Live-Anzeigen
 *   und historische Auswertungen. Vorhandene DashboardData-Datenpunkte werden
 *   durch dieses Skript weder erzeugt, geändert, verschoben noch gelöscht.
 *
 * Archive:
 *   - Kurzzeit: hohe Auflösung, typischerweise InfluxDB mit 3 Monaten Retention
 *   - Langzeit: reduzierte Datenmenge, typischerweise dauerhaft
 *
 * WICHTIG:
 *   Die Retention wird im InfluxDB-Adapter/Bucket festgelegt, nicht hier.
 *
 * Verhalten:
 *   - prüft alle vorgesehenen Datenpunkte
 *   - aktiviert Historie über enableHistory
 *   - löscht oder deaktiviert keine vorhandenen Historieneinstellungen
 *   - kann beliebig oft ausgeführt werden
 *   - meldet fehlende Datenpunkte nur als Warnung
 *
 * Voraussetzungen:
 *   - 10_NPS_DashboardData v4.0.1 oder kompatibel
 *   - ioBroker InfluxDB-Adapter
 *
 * Changelog:
 *   1.0.0
 *   - Erstfassung
 *   - Trennung Kurzzeit-/Langzeitarchiv
 *   - stabile DashboardData-API als einzige Historienquelle
 * ============================================================================
 */

'use strict';

// ============================================================================
// KONFIGURATION
// ============================================================================

const CONFIG = {
    ROOT: '0_userdata.0.NPS.DashboardData',

    // Adapterinstanzen bitte bei Bedarf anpassen.
    SHORT_TERM_INSTANCE: 'influxdb.1',
    LONG_TERM_INSTANCE: 'influxdb.0',

    ENABLE_SHORT_TERM: true,
    ENABLE_LONG_TERM: true,

    // true = nur anzeigen, nichts an InfluxDB senden
    DRY_RUN: false,

    DEBUG: false,

    // Zeit zwischen einzelnen Adapteraufrufen, um Lastspitzen zu vermeiden.
    COMMAND_DELAY_MS: 150
};

// ============================================================================
// HISTORIENKLASSEN
// ============================================================================
//
// Kurzzeit:
//   Detailanalyse mit feiner Auflösung.
//
// Langzeit:
//   Jahresvergleiche, Effizienzentwicklung und Anlagenbeobachtung.
//
// options:
//   changesOnly          = nur Wertänderungen speichern
//   debounce             = Entprellzeit in ms
//   changesRelogInterval = spätestens nach x Sekunden erneut speichern
//   changesMinDelta      = Mindeständerung numerischer Werte
//
// Bei Zählern wird changesMinDelta bewusst nicht gesetzt.
// ============================================================================

const SHORT_TERM = [
    // Übersicht / Betriebszustand
    state('Overview.Mode',              change(0, 0)),
    state('Overview.State',             change(0, 0)),
    state('Overview.ActiveCycle',       change(0, 0)),
    state('Overview.ActiveCycleType',   change(0, 0)),

    // Temperaturen / Hydraulik
    state('Temperatures.Outdoor',       numeric(0.1, 10, 300)),
    state('Temperatures.Supply',        numeric(0.1, 10, 300)),
    state('Temperatures.Return',        numeric(0.1, 10, 300)),
    state('Temperatures.DeltaT',        numeric(0.1, 10, 300)),
    state('Temperatures.MeanHeatingWater', numeric(0.1, 10, 300)),
    state('Temperatures.TemperatureLift',  numeric(0.1, 10, 300)),
    state('Temperatures.Flow',          numeric(0.2, 10, 300)),

    // Verdichter
    state('Compressor.Active',          change(0, 0)),
    state('Compressor.Frequency',       numeric(1, 5, 300)),
    state('Compressor.Runtime',         counter()),
    state('Compressor.Starts',          counter()),
    state('Compressor.State',           change(0, 0)),

    // Energie / COP
    state('Energy.ElectricTotal',       counter()),
    state('Energy.ElectricHeating',     counter()),
    state('Energy.ElectricWarmwater',   counter()),
    state('Energy.HeatHeating',         counter()),
    state('Energy.HeatWarmwater',       counter()),
    state('Energy.COPHeating',          numeric(0.05, 10, 300)),
    state('Energy.COPWarmwater',        numeric(0.05, 10, 300)),

    // Zyklen
    state('Cycles.Active',              change(0, 0)),
    state('Cycles.Type',                change(0, 0)),
    state('Cycles.COP',                 numeric(0.05, 0, 0)),
    state('Cycles.Duration',            numeric(1, 0, 0)),
    state('Cycles.ElectricEnergy',      numeric(0.01, 0, 0)),
    state('Cycles.HeatEnergy',          numeric(0.01, 0, 0)),
    state('Cycles.Quality',             numeric(1, 0, 0)),
    state('Cycles.LastCycle',           change(0, 0)),

    // Abtauung
    state('Defrost.Active',             change(0, 0)),
    state('Defrost.Duration',           numeric(0.1, 10, 60)),
    state('Defrost.LastDuration',       numeric(0.1, 0, 0)),
    state('Defrost.Count',              counter()),
    state('Defrost.LastStart',          change(0, 0)),

    // Ereigniszähler – keine Meldungstexte
    state('Events.Counter',             counter()),
    state('Events.LastEvent',           change(0, 0)),
    state('Events.Criticality',         change(0, 0)),
    state('Events.Timestamp',           change(0, 0))
];

const LONG_TERM = [
    // Betriebsart als Zeitleiste
    state('Overview.Mode',              change(0, 0)),

    // Temperaturen / Hydraulik, reduziert
    state('Temperatures.Outdoor',       numeric(0.3, 60, 900)),
    state('Temperatures.Supply',        numeric(0.3, 60, 900)),
    state('Temperatures.Return',        numeric(0.3, 60, 900)),
    state('Temperatures.DeltaT',        numeric(0.3, 60, 900)),
    state('Temperatures.MeanHeatingWater', numeric(0.3, 60, 900)),
    state('Temperatures.TemperatureLift',  numeric(0.3, 60, 900)),
    state('Temperatures.Flow',          numeric(1.0, 60, 900)),

    // Verdichter
    state('Compressor.Active',          change(0, 0)),
    state('Compressor.Frequency',       numeric(5, 60, 900)),
    state('Compressor.Runtime',         counter()),
    state('Compressor.Starts',          counter()),

    // Energie und COP
    state('Energy.ElectricTotal',       counter()),
    state('Energy.ElectricHeating',     counter()),
    state('Energy.ElectricWarmwater',   counter()),
    state('Energy.HeatHeating',         counter()),
    state('Energy.HeatWarmwater',       counter()),
    state('Energy.COPHeating',          numeric(0.2, 60, 900)),
    state('Energy.COPWarmwater',        numeric(0.2, 60, 900)),

    // Abgeschlossene Zykluskennzahlen
    state('Cycles.Type',                change(0, 0)),
    state('Cycles.COP',                 numeric(0.1, 0, 0)),
    state('Cycles.Duration',            numeric(1, 0, 0)),
    state('Cycles.ElectricEnergy',      numeric(0.01, 0, 0)),
    state('Cycles.HeatEnergy',          numeric(0.01, 0, 0)),
    state('Cycles.Quality',             numeric(1, 0, 0)),
    state('Cycles.LastCycle',           change(0, 0)),

    // Abtauung
    state('Defrost.Active',             change(0, 0)),
    state('Defrost.LastDuration',       numeric(0.1, 0, 0)),
    state('Defrost.Count',              counter()),
    state('Defrost.LastStart',          change(0, 0)),

    // Ereignisindikatoren, ohne Freitext
    state('Events.Counter',             counter()),
    state('Events.LastEvent',           change(0, 0)),
    state('Events.Criticality',         change(0, 0)),
    state('Events.Timestamp',           change(0, 0))
];

// ============================================================================
// OPTION-HILFSFUNKTIONEN
// ============================================================================

function state(relativeId, options) {
    return { relativeId, options };
}

function numeric(minDelta, debounceSeconds, relogSeconds) {
    const options = {
        changesOnly: true,
        debounce: Math.max(0, debounceSeconds * 1000),
        changesMinDelta: minDelta
    };

    if (relogSeconds > 0) {
        options.changesRelogInterval = relogSeconds;
    }

    return options;
}

function change(debounceSeconds, relogSeconds) {
    const options = {
        changesOnly: true,
        debounce: Math.max(0, debounceSeconds * 1000)
    };

    if (relogSeconds > 0) {
        options.changesRelogInterval = relogSeconds;
    }

    return options;
}

function counter() {
    return {
        changesOnly: true,
        debounce: 0
    };
}

// ============================================================================
// LOGGING
// ============================================================================

function info(message) {
    log('[NPS DashboardDataHistory] ' + message, 'info');
}

function warn(message) {
    log('[NPS DashboardDataHistory] ' + message, 'warn');
}

function error(message) {
    log('[NPS DashboardDataHistory] ' + message, 'error');
}

function debug(message) {
    if (CONFIG.DEBUG) {
        log('[NPS DashboardDataHistory DEBUG] ' + message, 'info');
    }
}

// ============================================================================
// ADAPTERKOMMUNIKATION
// ============================================================================

function fullId(relativeId) {
    return CONFIG.ROOT + '.' + relativeId;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function adapterExists(instance) {
    return existsObject('system.adapter.' + instance);
}

function enableHistory(instance, id, options) {
    return new Promise(resolve => {
        if (CONFIG.DRY_RUN) {
            info('[DRY-RUN] ' + instance + ' <- ' + id + ' ' + JSON.stringify(options));
            resolve({ ok: true, dryRun: true });
            return;
        }

        sendTo(instance, 'enableHistory', { id, options }, result => {
            if (result && result.error) {
                resolve({ ok: false, error: String(result.error) });
                return;
            }

            resolve({ ok: true, result });
        });
    });
}

// ============================================================================
// KONFIGURATION EINER ARCHIVKLASSE
// ============================================================================

async function configureArchive(label, instance, entries) {
    const result = {
        label,
        instance,
        configured: 0,
        missing: 0,
        failed: 0
    };

    info(label + ': Prüfung für ' + instance + ' gestartet.');

    if (!adapterExists(instance)) {
        error(label + ': Adapterinstanz nicht gefunden: ' + instance);
        result.failed = entries.length;
        return result;
    }

    for (const entry of entries) {
        const id = fullId(entry.relativeId);

        if (!existsState(id)) {
            warn(label + ': Datenpunkt fehlt: ' + id);
            result.missing++;
            continue;
        }

        debug(label + ': aktiviere ' + id);

        const response = await enableHistory(instance, id, entry.options);

        if (response.ok) {
            result.configured++;
        } else {
            error(label + ': Konfiguration fehlgeschlagen für ' + id +
                ': ' + response.error);
            result.failed++;
        }

        await delay(CONFIG.COMMAND_DELAY_MS);
    }

    info(label + ': abgeschlossen – konfiguriert=' + result.configured +
        ', fehlend=' + result.missing +
        ', Fehler=' + result.failed + '.');

    return result;
}

// ============================================================================
// START
// ============================================================================

async function main() {
    info('Start Version 1.0.0' + (CONFIG.DRY_RUN ? ' [DRY-RUN]' : ''));

    if (!existsObject(CONFIG.ROOT)) {
        error('DashboardData-Wurzel fehlt: ' + CONFIG.ROOT);
        error('Zuerst 10_NPS_DashboardData starten.');
        return;
    }

    const results = [];

    if (CONFIG.ENABLE_SHORT_TERM) {
        results.push(await configureArchive(
            'Kurzzeitarchiv',
            CONFIG.SHORT_TERM_INSTANCE,
            SHORT_TERM
        ));
    } else {
        info('Kurzzeitarchiv ist in CONFIG deaktiviert.');
    }

    if (CONFIG.ENABLE_LONG_TERM) {
        results.push(await configureArchive(
            'Langzeitarchiv',
            CONFIG.LONG_TERM_INSTANCE,
            LONG_TERM
        ));
    } else {
        info('Langzeitarchiv ist in CONFIG deaktiviert.');
    }

    const totals = results.reduce((sum, item) => {
        sum.configured += item.configured;
        sum.missing += item.missing;
        sum.failed += item.failed;
        return sum;
    }, { configured: 0, missing: 0, failed: 0 });

    info('Gesamtergebnis: konfiguriert=' + totals.configured +
        ', fehlend=' + totals.missing +
        ', Fehler=' + totals.failed + '.');

    if (totals.failed === 0) {
        info('Historienkonfiguration erfolgreich abgeschlossen.');
    } else {
        warn('Historienkonfiguration mit Fehlern abgeschlossen.');
    }

    info('Hinweis: Die Aufbewahrungsdauer wird in den InfluxDB-Instanzen bzw. Buckets eingestellt.');
}

main().catch(err => {
    error('Unerwarteter Fehler: ' + (err && err.stack ? err.stack : err));
});
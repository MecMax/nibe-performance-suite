/**
 * NIBE Performance Suite (NPS)
 * DashboardData – InfluxDB-Konfiguration
 * Version 1.0.0
 *
 * Zweck:
 * - aktiviert die empfohlenen neuen DashboardData-Datenpunkte
 * - Langzeitwerte -> influxdb.0
 * - Kurzzeit-/Livewerte -> influxdb.1
 * - verändert keine anderen bereits vorhandenen Historieneinstellungen
 * - deaktiviert keine Datenpunkte
 *
 * Grundlage: DashboardData v4.4.0 / Masterliste V1.2
 */

'use strict';

const SCRIPT = 'NPS DashboardData InfluxConfiguration';
const VERSION = '1.0.0';

const CONFIG = Object.freeze({
    APPLY_CHANGES: true,     // false = nur prüfen und protokollieren
    DEBUG: false,
    INFLUX_LONG: 'influxdb.0',
    INFLUX_SHORT: 'influxdb.1',
    ROOT: '0_userdata.0.NPS.DashboardData',
    REQUEST_TIMEOUT_MS: 15000,
    PAUSE_BETWEEN_REQUESTS_MS: 150
});

const dp = relative => `${CONFIG.ROOT}.${relative}`;

/*
 * influxdb.0 – langfristige, abgeschlossene Tageswerte
 *
 * changesRelogInterval = 86400 s sorgt dafür, dass auch bei identischen
 * Tageswerten regelmäßig ein Messpunkt erhalten bleibt.
 */
const LONG_TERM = [
    'Statistics.StromGesamt.Yesterday',
    'Statistics.StromHeizung.Yesterday',
    'Statistics.StromWarmwasser.Yesterday',
    'Statistics.StromStandby.Yesterday',
    'Statistics.StromKuehlung.Yesterday',
    'Statistics.StromPool.Yesterday',
    'Statistics.StromUnbekannt.Yesterday',
    'Statistics.StromZugeordnet.Yesterday',
    'Statistics.WaermeHeizungGesamt.Yesterday',
    'Statistics.WaermeHeizungVerdichter.Yesterday',
    'Statistics.WaermeWarmwasserGesamt.Yesterday',
    'Statistics.WaermeWarmwasserVerdichter.Yesterday',
    'Statistics.Verdichterlaufzeit.Yesterday',
    'Statistics.Verdichterstarts.Yesterday',
    'Statistics.Abtaudauer.Yesterday'
].map(dp);

/*
 * influxdb.1 – laufende Tageswerte und Live-COP
 */
const SHORT_TERM_ENERGY = [
    'Periods.Day.ElectricTotal',
    'Periods.Day.ElectricHeating',
    'Periods.Day.ElectricWarmwater',
    'Periods.Day.HeatHeating',
    'Periods.Day.HeatWarmwater'
].map(dp);

const SHORT_TERM_COP = [
    'Energy.COPTotal',
    'Periods.Day.COPTotal',
    'Periods.Day.COPHeating',
    'Periods.Day.COPWarmwater'
].map(dp);

const OPTIONS = Object.freeze({
    LONG_TERM: {
        changesOnly: true,
        debounce: 0,
        blockTime: 0,
        changesRelogInterval: 86400,
        changesMinDelta: 0,
        aliasId: ''
    },
    SHORT_ENERGY: {
        changesOnly: true,
        debounce: 1000,
        blockTime: 1000,
        changesRelogInterval: 600,
        changesMinDelta: 0.01,
        aliasId: ''
    },
    SHORT_COP: {
        changesOnly: true,
        debounce: 1000,
        blockTime: 1000,
        changesRelogInterval: 300,
        changesMinDelta: 0.05,
        aliasId: ''
    }
});

function logDebug(message) {
    if (CONFIG.DEBUG) log(`[${SCRIPT}] ${message}`, 'debug');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function objectExists(id) {
    try {
        return !!getObject(id);
    } catch (error) {
        return false;
    }
}

function instanceExists(instance) {
    return objectExists(`system.adapter.${instance}`);
}

function sendToPromise(instance, command, payload) {
    return new Promise((resolve, reject) => {
        let completed = false;

        const timer = setTimeout(() => {
            if (completed) return;
            completed = true;
            reject(new Error(`Zeitüberschreitung bei ${instance}/${command}`));
        }, CONFIG.REQUEST_TIMEOUT_MS);

        sendTo(instance, command, payload, result => {
            if (completed) return;
            completed = true;
            clearTimeout(timer);

            if (!result) {
                reject(new Error(`Keine Antwort von ${instance}/${command}`));
                return;
            }

            if (result.error) {
                reject(new Error(String(result.error)));
                return;
            }

            resolve(result);
        });
    });
}

async function enableHistory(instance, id, options) {
    if (!objectExists(id)) {
        return { id, status: 'FEHLT', message: 'Datenpunkt existiert nicht' };
    }

    if (!CONFIG.APPLY_CHANGES) {
        return { id, status: 'SIMULATION', message: `${instance} würde aktiviert` };
    }

    try {
        await sendToPromise(instance, 'enableHistory', { id, options });
        return { id, status: 'OK', message: `${instance} aktiviert/aktualisiert` };
    } catch (error) {
        return { id, status: 'FEHLER', message: error.message };
    }
}

async function processGroup(instance, ids, options, title) {
    const results = [];

    log(`[${SCRIPT}] ${title}: ${ids.length} Datenpunkte`, 'info');

    for (const id of ids) {
        const result = await enableHistory(instance, id, options);
        results.push(result);

        const level = result.status === 'FEHLER' ? 'error'
            : result.status === 'FEHLT' ? 'warn'
                : 'info';

        log(`[${SCRIPT}] ${result.status}: ${id} – ${result.message}`, level);
        logDebug(`Optionen: ${JSON.stringify(options)}`);
        await sleep(CONFIG.PAUSE_BETWEEN_REQUESTS_MS);
    }

    return results;
}

function summarize(results) {
    return results.reduce((sum, item) => {
        sum[item.status] = (sum[item.status] || 0) + 1;
        return sum;
    }, {});
}

async function main() {
    log(`[${SCRIPT}] Start v${VERSION}; Modus=${CONFIG.APPLY_CHANGES ? 'ANWENDEN' : 'SIMULATION'}`, 'info');

    const missingInstances = [CONFIG.INFLUX_LONG, CONFIG.INFLUX_SHORT]
        .filter(instance => !instanceExists(instance));

    if (missingInstances.length > 0) {
        log(`[${SCRIPT}] Abbruch: Instanz(en) nicht gefunden: ${missingInstances.join(', ')}`, 'error');
        return;
    }

    const allResults = [];

    allResults.push(...await processGroup(
        CONFIG.INFLUX_LONG,
        LONG_TERM,
        OPTIONS.LONG_TERM,
        'Langzeitarchiv influxdb.0'
    ));

    allResults.push(...await processGroup(
        CONFIG.INFLUX_SHORT,
        SHORT_TERM_ENERGY,
        OPTIONS.SHORT_ENERGY,
        'Kurzzeitarchiv Energie influxdb.1'
    ));

    allResults.push(...await processGroup(
        CONFIG.INFLUX_SHORT,
        SHORT_TERM_COP,
        OPTIONS.SHORT_COP,
        'Kurzzeitarchiv COP influxdb.1'
    ));

    const summary = summarize(allResults);
    log(`[${SCRIPT}] Abschluss: ${JSON.stringify(summary)}`, 'info');

    const failed = (summary.FEHLER || 0) + (summary.FEHLT || 0);
    if (failed === 0) {
        log(`[${SCRIPT}] Konfiguration vollständig erfolgreich. Das Skript kann jetzt gestoppt werden.`, 'info');
    } else {
        log(`[${SCRIPT}] Konfiguration mit ${failed} Auffälligkeit(en) abgeschlossen.`, 'warn');
    }
}

main().catch(error => {
    log(`[${SCRIPT}] Unerwarteter Fehler: ${error.stack || error.message || error}`, 'error');
});
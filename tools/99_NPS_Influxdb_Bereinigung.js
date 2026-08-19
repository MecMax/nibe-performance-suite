/**
 * NIBE Performance Suite (NPS)
 * DashboardData – Bereinigung doppelter InfluxDB-Zuweisungen
 * Version 1.0.0
 *
 * Zweck:
 * - entfernt bei 34 fest definierten DashboardData-Datenpunkten
 *   ausschließlich die Historisierung in influxdb.0
 * - lässt influxdb.1 und alle übrigen Adapter-/Historieneinstellungen unverändert
 * - prüft vor und nach der Änderung die Objektkonfiguration
 * - löscht keine bereits in InfluxDB gespeicherten Messwerte
 *
 * Zielarchitektur:
 * - influxdb.0 = abgeschlossene langfristige Tageswerte
 * - influxdb.1 = Live-, Kurzzeit-, Zyklus- und Diagnosewerte
 *
 * Anwendung:
 * 1. Zuerst mit APPLY_CHANGES = false starten und Log prüfen.
 * 2. Danach APPLY_CHANGES = true setzen und erneut starten.
 * 3. Nach erfolgreichem Lauf Skript stoppen.
 */

'use strict';

const SCRIPT = 'NPS DashboardData Influx-Doppelzuweisung Bereinigung';
const VERSION = '1.0.0';

const CONFIG = Object.freeze({
    APPLY_CHANGES: true, // zuerst false; nach Prüfung auf true setzen
    DEBUG: false,
    INFLUX_LONG: 'influxdb.0',
    INFLUX_SHORT: 'influxdb.1',
    ROOT: '0_userdata.0.NPS.DashboardData',
    REQUEST_TIMEOUT_MS: 15000,
    PAUSE_BETWEEN_REQUESTS_MS: 150
});

const dp = relative => `${CONFIG.ROOT}.${relative}`;

/*
 * Diese 34 Datenpunkte sollen nur in influxdb.1 verbleiben.
 * Bei ihnen wird ausschließlich influxdb.0 deaktiviert.
 */
const REMOVE_FROM_INFLUX_0 = [
    // Verdichter
    'Compressor.Active',
    'Compressor.Frequency',
    'Compressor.Runtime',
    'Compressor.Starts',

    // Zyklen
    'Cycles.COP',
    'Cycles.Duration',
    'Cycles.ElectricEnergy',
    'Cycles.HeatEnergy',
    'Cycles.LastCycle',
    'Cycles.Quality',
    'Cycles.Type',

    // Abtauung
    'Defrost.Active',
    'Defrost.Count',
    'Defrost.LastDuration',
    'Defrost.LastStart',

    // Energie und COP
    'Energy.COPHeating',
    'Energy.COPWarmwater',
    'Energy.ElectricHeating',
    'Energy.ElectricTotal',
    'Energy.ElectricWarmwater',
    'Energy.HeatHeating',
    'Energy.HeatWarmwater',

    // Ereignisse
    'Events.Counter',
    'Events.Criticality',
    'Events.LastEvent',
    'Events.Timestamp',

    // Übersicht
    'Overview.Mode',

    // Temperaturen
    'Temperatures.DeltaT',
    'Temperatures.Flow',
    'Temperatures.MeanHeatingWater',
    'Temperatures.Outdoor',
    'Temperatures.Return',
    'Temperatures.Supply',
    'Temperatures.TemperatureLift'
].map(dp);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function debug(message) {
    if (CONFIG.DEBUG) {
        log(`[${SCRIPT}] ${message}`, 'debug');
    }
}

function getObjectSafe(id) {
    try {
        return getObject(id);
    } catch (error) {
        return null;
    }
}

function objectExists(id) {
    return !!getObjectSafe(id);
}

function instanceExists(instance) {
    return objectExists(`system.adapter.${instance}`);
}

function getHistoryStatus(id, instance) {
    const obj = getObjectSafe(id);
    const config = obj?.common?.custom?.[instance];

    if (!obj) return 'DATENPUNKT_FEHLT';
    if (!config) return 'NICHT_ZUGEWIESEN';
    return config.enabled === true ? 'AKTIV' : 'INAKTIV';
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

async function disableLongHistory(id) {
    const beforeLong = getHistoryStatus(id, CONFIG.INFLUX_LONG);
    const beforeShort = getHistoryStatus(id, CONFIG.INFLUX_SHORT);

    if (beforeLong === 'DATENPUNKT_FEHLT') {
        return {
            id,
            status: 'FEHLT',
            beforeLong,
            beforeShort,
            afterLong: beforeLong,
            afterShort: beforeShort,
            message: 'Datenpunkt existiert nicht'
        };
    }

    if (beforeLong !== 'AKTIV') {
        return {
            id,
            status: 'BEREITS_OK',
            beforeLong,
            beforeShort,
            afterLong: beforeLong,
            afterShort: beforeShort,
            message: 'influxdb.0 ist bereits nicht aktiv'
        };
    }

    if (!CONFIG.APPLY_CHANGES) {
        return {
            id,
            status: 'SIMULATION',
            beforeLong,
            beforeShort,
            afterLong: 'WÜRDE_DEAKTIVIERT',
            afterShort: beforeShort,
            message: 'influxdb.0 würde deaktiviert; influxdb.1 bleibt unverändert'
        };
    }

    try {
        await sendToPromise(CONFIG.INFLUX_LONG, 'disableHistory', { id });
        await sleep(300);

        const afterLong = getHistoryStatus(id, CONFIG.INFLUX_LONG);
        const afterShort = getHistoryStatus(id, CONFIG.INFLUX_SHORT);

        if (afterLong === 'AKTIV') {
            return {
                id,
                status: 'FEHLER',
                beforeLong,
                beforeShort,
                afterLong,
                afterShort,
                message: 'influxdb.0 ist nach disableHistory weiterhin aktiv'
            };
        }

        const warning = afterShort !== 'AKTIV'
            ? `; Achtung: influxdb.1 ist ${afterShort}`
            : '';

        return {
            id,
            status: afterShort === 'AKTIV' ? 'OK' : 'OK_MIT_WARNUNG',
            beforeLong,
            beforeShort,
            afterLong,
            afterShort,
            message: `influxdb.0 deaktiviert${warning}`
        };
    } catch (error) {
        return {
            id,
            status: 'FEHLER',
            beforeLong,
            beforeShort,
            afterLong: getHistoryStatus(id, CONFIG.INFLUX_LONG),
            afterShort: getHistoryStatus(id, CONFIG.INFLUX_SHORT),
            message: error.message
        };
    }
}

function summarize(results) {
    return results.reduce((sum, item) => {
        sum[item.status] = (sum[item.status] || 0) + 1;
        return sum;
    }, {});
}

async function main() {
    log(
        `[${SCRIPT}] Start v${VERSION}; Modus=${CONFIG.APPLY_CHANGES ? 'ANWENDEN' : 'SIMULATION'}`,
        'info'
    );

    if (!instanceExists(CONFIG.INFLUX_LONG)) {
        log(`[${SCRIPT}] Abbruch: ${CONFIG.INFLUX_LONG} wurde nicht gefunden.`, 'error');
        return;
    }

    if (!instanceExists(CONFIG.INFLUX_SHORT)) {
        log(
            `[${SCRIPT}] Warnung: ${CONFIG.INFLUX_SHORT} wurde nicht gefunden. ` +
            `Die Langzeitzuweisungen werden nicht verändert.`,
            'error'
        );
        return;
    }

    if (REMOVE_FROM_INFLUX_0.length !== 34) {
        log(
            `[${SCRIPT}] Sicherheitsabbruch: Erwartet werden 34 Datenpunkte, ` +
            `gefunden wurden ${REMOVE_FROM_INFLUX_0.length}.`,
            'error'
        );
        return;
    }

    const results = [];

    for (const id of REMOVE_FROM_INFLUX_0) {
        const result = await disableLongHistory(id);
        results.push(result);

        const level =
            result.status === 'FEHLER' ? 'error' :
            result.status === 'FEHLT' || result.status === 'OK_MIT_WARNUNG' ? 'warn' :
            'info';

        log(
            `[${SCRIPT}] ${result.status}: ${id} – ${result.message} ` +
            `(vorher: influxdb.0=${result.beforeLong}, influxdb.1=${result.beforeShort}; ` +
            `nachher: influxdb.0=${result.afterLong}, influxdb.1=${result.afterShort})`,
            level
        );

        debug(JSON.stringify(result));
        await sleep(CONFIG.PAUSE_BETWEEN_REQUESTS_MS);
    }

    const summary = summarize(results);
    log(`[${SCRIPT}] Abschluss: ${JSON.stringify(summary)}`, 'info');

    const errors = (summary.FEHLER || 0) + (summary.FEHLT || 0);
    const warnings = summary.OK_MIT_WARNUNG || 0;

    if (!CONFIG.APPLY_CHANGES) {
        log(
            `[${SCRIPT}] Simulation beendet. Wenn die Liste korrekt ist, ` +
            `APPLY_CHANGES auf true setzen und erneut starten.`,
            'info'
        );
    } else if (errors === 0 && warnings === 0) {
        log(
            `[${SCRIPT}] Bereinigung vollständig erfolgreich. ` +
            `Alle bearbeiteten Datenpunkte sind aus influxdb.0 entfernt ` +
            `und bleiben in influxdb.1 aktiv. Das Skript kann gestoppt werden.`,
            'info'
        );
    } else {
        log(
            `[${SCRIPT}] Bereinigung mit ${errors} Fehler(n) und ` +
            `${warnings} Warnung(en) abgeschlossen. Bitte Log prüfen.`,
            'warn'
        );
    }
}

main().catch(error => {
    log(
        `[${SCRIPT}] Unerwarteter Fehler: ${error.stack || error.message || error}`,
        'error'
    );
});
/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * Datei:   99_NPS_EventLogger.js
 * Version: 0.1.0
 * Build:   2026-07-22
 * Gerät:   NIBE S2125-12 + VVM S500
 * Lizenz:  MIT
 *
 * Zweck
 * -----
 * Temporärer, unabhängiger Ereignislogger zur Untersuchung der zeitlichen
 * Reihenfolge von Gesamtverbrauch, Betriebspriorität und Verdichterfrequenz.
 *
 * Das Skript verändert keine NPS-Berechnungen und keine Eingangsdaten.
 ****************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '0.1.0',
        DEBUG: false,
        LOG_TO_CONSOLE: true,
        ROOT: '0_userdata.0.NPS.Diagnostics.EventLogger',
        MAX_LINES: 500,
        MAX_CHARACTERS: 60000,
        STATE_CREATE_DELAY_MS: 1000,
        INPUT: {
            TOTAL_ELECTRICITY: 'alias.0.Keller.Waschküche.Waermepumpe.Gesamtverbrauch',
            PRIORITY: 'alias.0.Keller.Waschküche.Waermepumpe.prio',
            COMPRESSOR_FREQUENCY: 'alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)'
        }
    };

    let subscriptions = [];
    let started = false;

    function id(path) {
        return CONFIG.ROOT + '.' + path;
    }

    function exists(objectId) {
        return existsState(objectId) || existsObject(objectId);
    }

    function nowLocal() {
        const d = new Date();
        const pad = (v, n) => String(v).padStart(n, '0');
        return pad(d.getDate(), 2) + '.' + pad(d.getMonth() + 1, 2) + '.' + d.getFullYear() + ' ' +
            pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + '.' +
            pad(d.getMilliseconds(), 3);
    }

    function info(message) {
        log('[NPS EventLogger] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS EventLogger] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS EventLogger DEBUG] ' + message, 'info');
        }
    }

    function readValue(objectId) {
        const state = getState(objectId);
        return (!state || state.val === undefined || state.val === null) ? null : state.val;
    }

    function readNumber(objectId) {
        const value = readValue(objectId);
        if (value === null || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function write(path, value) {
        const objectId = id(path);
        if (!existsState(objectId)) {
            warn('Zieldatenpunkt fehlt: ' + objectId);
            return;
        }
        const current = getState(objectId);
        if (!current || current.val !== value) {
            setState(objectId, value, true);
        }
    }

    function ensureFolder(objectId, name) {
        if (exists(objectId)) return;
        setObject(objectId, {
            type: 'folder',
            common: { name: name },
            native: {}
        });
    }

    function ensureState(path, initialValue, type, role, name, writeable) {
        const objectId = id(path);
        if (exists(objectId)) return;
        createState(objectId, initialValue, true, {
            name: name,
            type: type,
            role: role,
            read: true,
            write: writeable === true
        });
    }

    function createObjects() {
        ensureFolder(CONFIG.ROOT, 'NPS Event Logger');
        ensureState('Active', false, 'boolean', 'indicator', 'EventLogger aktiv', false);
        ensureState('Version', '', 'string', 'text', 'EventLogger-Version', false);
        ensureState('LastStart', '', 'string', 'date', 'Letzter Start', false);
        ensureState('LastEvent', '', 'string', 'text', 'Letztes Ereignis', false);
        ensureState('EventCount', 0, 'number', 'value', 'Anzahl protokollierter Ereignisse', false);
        ensureState('Log', '', 'string', 'text', 'Ereignisprotokoll', false);
        ensureState('Clear', false, 'boolean', 'button', 'Ereignisprotokoll löschen', true);
        ensureState('Status', '', 'string', 'text', 'Status', false);
    }

    function formatValue(value, digits) {
        if (value === null || value === undefined) return 'n/a';
        const number = Number(value);
        if (Number.isFinite(number)) {
            return digits === undefined ? String(number) : number.toFixed(digits);
        }
        return String(value);
    }

    function priorityText(priority) {
        switch (Number(priority)) {
            case 10: return 'Standby';
            case 20: return 'Warmwasser';
            case 30: return 'Heizung';
            case 40: return 'Pool';
            case 50:
            case 60: return 'Kühlung';
            default: return 'Unbekannt';
        }
    }

    function buildSnapshot() {
        const total = readNumber(CONFIG.INPUT.TOTAL_ELECTRICITY);
        const priority = readNumber(CONFIG.INPUT.PRIORITY);
        const frequency = readNumber(CONFIG.INPUT.COMPRESSOR_FREQUENCY);
        return 'Gesamt=' + formatValue(total, 3) + ' kWh' +
            ' | Prio=' + formatValue(priority) + ' (' + priorityText(priority) + ')' +
            ' | Verdichter=' + formatValue(frequency, 1) + ' Hz';
    }

    function trimLog(lines) {
        while (lines.length > CONFIG.MAX_LINES) lines.shift();
        let text = lines.join('\n');
        while (text.length > CONFIG.MAX_CHARACTERS && lines.length > 1) {
            lines.shift();
            text = lines.join('\n');
        }
        return text;
    }

    function appendLine(line) {
        const currentLog = String(readValue(id('Log')) || '');
        const lines = currentLog ? currentLog.split('\n') : [];
        lines.push(line);
        write('Log', trimLog(lines));
        write('LastEvent', line);
        write('EventCount', (readNumber(id('EventCount')) || 0) + 1);
        if (CONFIG.LOG_TO_CONSOLE) info(line);
    }

    function logEvent(sourceName, oldValue, newValue, eventState) {
        const eventTs = eventState && Number.isFinite(Number(eventState.ts)) ? Number(eventState.ts) : Date.now();
        const delay = Math.max(0, Date.now() - eventTs);
        appendLine(
            nowLocal() +
            ' | EVENT=' + sourceName +
            ' | alt=' + formatValue(oldValue) +
            ' | neu=' + formatValue(newValue) +
            ' | EventDelay=' + delay + ' ms' +
            ' | ' + buildSnapshot()
        );
    }

    function registerInput(name, objectId) {
        if (!exists(objectId)) {
            warn('Eingang fehlt: ' + objectId);
            appendLine(nowLocal() + ' | FEHLER=' + name + ' | Eingang fehlt: ' + objectId);
            return;
        }
        const handle = on({ id: objectId, change: 'ne' }, function (event) {
            try {
                logEvent(
                    name,
                    event.oldState ? event.oldState.val : null,
                    event.state ? event.state.val : null,
                    event.state
                );
            } catch (error) {
                warn('Fehler bei Ereignis ' + name + ': ' + error.message);
            }
        });
        subscriptions.push(handle);
        debug('Subscription registriert: ' + objectId);
    }

    function registerClearButton() {
        const handle = on({ id: id('Clear'), change: 'ne' }, function (event) {
            if (!event.state || event.state.val !== true) return;
            write('Log', '');
            write('LastEvent', '');
            write('EventCount', 0);
            write('Clear', false);
            appendLine(nowLocal() + ' | SYSTEM=Log manuell gelöscht | ' + buildSnapshot());
        });
        subscriptions.push(handle);
    }

    function start() {
        createObjects();
        setTimeout(function () {
            write('Version', CONFIG.VERSION);
            write('Active', true);
            write('LastStart', nowLocal());
            write('Status', 'AKTIV');
            appendLine(nowLocal() + ' | SYSTEM=EventLogger gestartet | ' + buildSnapshot());

            registerInput('Gesamtverbrauch', CONFIG.INPUT.TOTAL_ELECTRICITY);
            registerInput('Priorität', CONFIG.INPUT.PRIORITY);
            registerInput('Verdichterfrequenz', CONFIG.INPUT.COMPRESSOR_FREQUENCY);
            registerClearButton();

            started = true;
            info('Version ' + CONFIG.VERSION + ' gestartet');
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
        subscriptions.forEach(function (handle) {
            try { unsubscribe(handle); } catch (error) { debug('Subscription konnte nicht entfernt werden'); }
        });
        subscriptions = [];

        if (started && existsState(id('Active'))) {
            write('Active', false);
            write('Status', 'GESTOPPT');
            appendLine(nowLocal() + ' | SYSTEM=EventLogger gestoppt | ' + buildSnapshot());
        }
    }, 1000);

    start();
})();
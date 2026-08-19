/******************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               04_NPS_CompressorMonitor
 * Datei:               04_NPS_CompressorMonitor.js
 * Version:             1.0.2
 * Build:               2026-08-18
 * Modulstatus:         STABIL
 * Architektur-Schicht: Datenerfassung / Normalisierung
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Liest grundlegende Verdichterdaten, plausibilisiert sie und stellt normierte
 * Mess- und Statuswerte für nachfolgende NPS-Module bereit.
 *
 * Verarbeitete Werte:
 * - aktuelle Verdichterfrequenz
 * - kumulative Verdichterstarts
 * - Verdichterstatus
 * - kumulative Verdichterlaufzeit
 * - abgeleiteter Laufstatus
 *
 * Das Modul berechnet bewusst keine Taktlängen, Starts pro Zeitraum,
 * Modulationsgrade, Effizienzkennzahlen, COP- oder JAZ-Werte.
 *
 * Öffentliche Schnittstelle (Public API)
 * --------------------------------------
 * 0_userdata.0.NPS.CompressorMonitor.Compressor.Frequency
 * 0_userdata.0.NPS.CompressorMonitor.Compressor.Starts
 * 0_userdata.0.NPS.CompressorMonitor.Compressor.Status
 * 0_userdata.0.NPS.CompressorMonitor.Compressor.Runtime
 * 0_userdata.0.NPS.CompressorMonitor.Compressor.Running
 *
 * Gemeinsame NPS-Ausgänge
 * -----------------------
 *
 * Eingänge (Alias, nur lesend)
 * ---------------------------
 * alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)
 * alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Anzahl_Starts
 * alias.0.Keller.Waschküche.Waermepumpe.Verdichterstatus
 * alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Gesamtbetriebszeit_(EB101-EP14)
 *
 * Interne Modulbereiche
 * ---------------------
 * 0_userdata.0.NPS.CompressorMonitor.System.*
 * 0_userdata.0.NPS.CompressorMonitor.Diagnostics.*
 *
 * Trigger
 * -------
 * - Startaktualisierung nach erfolgreicher Initialisierung
 * - Zeitgesteuerte Aktualisierung jede Minute
 *
 * Abhängigkeiten
 * ---------------
 * - ioBroker JavaScript-Adapter
 * - Vorhandene und lesbare Alias-Eingänge
 *
 * Konfiguration
 * -------------
 * CONFIG.DEBUG                  Diagnoseausgaben aktivieren
 * CONFIG.UPDATE_CRON            Aktualisierungsintervall
 * CONFIG.STATE_CREATE_DELAY_MS  Wartezeit nach Objekterzeugung
 * CONFIG.ROUND_DIGITS           Anzahl der Nachkommastellen
 * CONFIG.INPUT                  Alias-Zuordnung der Verdichterwerte
 *
 * Architekturregeln
 * -----------------
 * - Eigenständiges Fachmodul; keine Zusammenlegung mit anderen NPS-Modulen
 * - Single Writer für alle States unter NPS.CompressorMonitor
 * - Gemeinsame Current-Verdichterwerte werden ausschließlich hier synchronisiert
 * - Ungültige Eingänge überschreiben keine zuletzt gültigen Verdichterwerte
 * - Höhere Takt- und Effizienzanalysen bleiben nachgelagerten Modulen vorbehalten
 *
 * Änderungsverlauf
 * ----------------
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Schnittstellen, Trigger,
 *       | Abhängigkeiten und Modulbereiche dokumentiert.
 *       | Keine Änderung der Programmlogik oder Datenpunktstruktur.
 * 1.0.0 | 2026-07-14
 *       | Produktive Erstversion.
 ******************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '1.0.2',
        DEBUG: false,

        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.CompressorMonitor',

        UPDATE_CRON: '* * * * *',
        STATE_CREATE_DELAY_MS: 1000,
        ROUND_DIGITS: 1,

        INPUT: {
            FREQUENCY:
                'alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)',

            STARTS:
                'alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Anzahl_Starts',

            STATUS:
                'alias.0.Keller.Waschküche.Waermepumpe.Verdichterstatus',

            RUNTIME:
                'alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Gesamtbetriebszeit_(EB101-EP14)'
        }
    };

    let started = false;
    let scheduleHandle = null;

    function info(message) {
        log('[NPS CompressorMonitor] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS CompressorMonitor] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS CompressorMonitor DEBUG] ' + message, 'info');
        }
    }

    function dp(path) {
        return CONFIG.ROOT + '.' + path;
    }

    function exists(id) {
        return existsState(id) || existsObject(id);
    }

    function nowString() {
        return new Date().toLocaleString('de-DE');
    }

    function roundValue(value) {
        if (
            value === null ||
            value === undefined ||
            !Number.isFinite(Number(value))
        ) {
            return null;
        }

        const factor = Math.pow(10, CONFIG.ROUND_DIGITS);
        return Math.round(Number(value) * factor) / factor;
    }

    function readRaw(id) {
        const currentState = getState(id);

        if (
            !currentState ||
            currentState.val === undefined ||
            currentState.val === null
        ) {
            return null;
        }

        return currentState.val;
    }

    function readNumber(id) {
        const value = readRaw(id);

        if (value === null || value === '') {
            return null;
        }

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function readText(id) {
        const value = readRaw(id);

        if (value === null || value === '') {
            return null;
        }

        return String(value);
    }

    function writeId(id, value) {
        if (!existsState(id)) {
            warn('Zieldatenpunkt fehlt, Schreiben übersprungen: ' + id);
            return false;
        }

        const currentState = getState(id);

        if (!currentState || currentState.val !== value) {
            setState(id, value, true);
        }

        return true;
    }

    function write(path, value) {
        return writeId(dp(path), value);
    }

    function writeTrace(lines) {
        write(
            'Diagnostics.Trace',
            nowString() + '\n' + lines.join('\n')
        );
    }

    function ensureFolder(id, name) {
        if (exists(id)) {
            return;
        }

        setObject(id, {
            type: 'folder',
            common: {
                name: name
            },
            native: {}
        });
    }

    function ensureChannel(id, name) {
        if (exists(id)) {
            return;
        }

        setObject(id, {
            type: 'channel',
            common: {
                name: name
            },
            native: {}
        });
    }

    function ensureState(path, initialValue, type, role, name, unit) {
        const id = dp(path);

        if (exists(id)) {
            return;
        }

        const common = {
            name: name || path,
            type: type,
            role: role,
            read: true,
            write: false
        };

        if (unit !== undefined) {
            common.unit = unit;
        }

        createState(id, initialValue, true, common);
    }

    function ensureNumber(path, name, unit, role) {
        ensureState(
            path,
            0,
            'number',
            role || 'value',
            name,
            unit
        );
    }

    function ensureString(path, name, role) {
        ensureState(
            path,
            '',
            'string',
            role || 'text',
            name
        );
    }

    function ensureBoolean(path, name) {
        ensureState(
            path,
            false,
            'boolean',
            'indicator',
            name
        );
    }

    function createAllObjects() {
        ensureFolder(CONFIG.ROOT, 'NPS CompressorMonitor');

        ensureChannel(dp('Compressor'), 'Verdichter');
        ensureChannel(dp('System'), 'System');
        ensureChannel(dp('Diagnostics'), 'Diagnose');

        ensureNumber(
            'Compressor.Frequency',
            'Aktuelle Verdichterfrequenz',
            'Hz',
            'value.frequency'
        );

        ensureNumber(
            'Compressor.Starts',
            'Verdichterstarts gesamt'
        );

        ensureString(
            'Compressor.Status',
            'Verdichterstatus'
        );

        ensureNumber(
            'Compressor.Runtime',
            'Verdichterlaufzeit gesamt',
            'h',
            'value.interval'
        );

        ensureBoolean(
            'Compressor.Running',
            'Verdichter läuft'
        );

        ensureString('System.Version', 'Modulversion');
        ensureBoolean('System.Active', 'Modul aktiv');
        ensureString(
            'System.LastStart',
            'Letzter Modulstart',
            'date'
        );
        ensureString(
            'System.LastUpdate',
            'Letzte Aktualisierung',
            'date'
        );
        ensureString('System.Status', 'Status');
        ensureString('System.LastMessage', 'Letzte Meldung');

        ensureBoolean(
            'Diagnostics.ValidInput',
            'Eingangsdaten gültig'
        );
        ensureNumber(
            'Diagnostics.InvalidUpdates',
            'Ungültige Aktualisierungen'
        );
        ensureString('Diagnostics.Warning', 'Warnung');
        ensureString('Diagnostics.Trace', 'Diagnosetrace');
    }

    function increment(path) {
        const current = readNumber(dp(path));
        write(path, (current === null ? 0 : current) + 1);
    }


    function checkInputObjects() {
        const missing = [];

        Object.keys(CONFIG.INPUT).forEach(function (key) {
            const id = CONFIG.INPUT[key];

            if (!exists(id)) {
                missing.push(key + ': ' + id);
            }
        });

        if (missing.length > 0) {
            write('Diagnostics.ValidInput', false);
            write(
                'Diagnostics.Warning',
                'Fehlende Eingänge: ' + missing.join(' | ')
            );
            write('System.Status', 'FEHLER');
            write(
                'System.LastMessage',
                'Mindestens ein Eingangsdatenpunkt fehlt'
            );

            missing.forEach(warn);
            return false;
        }

        write('Diagnostics.ValidInput', true);
        write('Diagnostics.Warning', '');
        return true;
    }

    function collectValues() {
        return {
            frequency: readNumber(CONFIG.INPUT.FREQUENCY),
            starts: readNumber(CONFIG.INPUT.STARTS),
            status: readText(CONFIG.INPUT.STATUS),
            runtime: readNumber(CONFIG.INPUT.RUNTIME)
        };
    }

    function validateValues(values) {
        const invalid = [];

        if (values.frequency === null) {
            invalid.push('frequency');
        }

        if (values.starts === null) {
            invalid.push('starts');
        }

        if (values.status === null) {
            invalid.push('status');
        }

        if (values.runtime === null) {
            invalid.push('runtime');
        }

        if (invalid.length > 0) {
            return {
                valid: false,
                warning:
                    'Nicht lesbare Werte: ' +
                    invalid.join(', ')
            };
        }

        const implausible = [];

        if (values.frequency < 0 || values.frequency > 150) {
            implausible.push('frequency');
        }

        if (values.starts < 0) {
            implausible.push('starts');
        }

        if (values.runtime < 0) {
            implausible.push('runtime');
        }

        return {
            valid: implausible.length === 0,
            warning:
                implausible.length > 0
                    ? 'Werte außerhalb Plausibilitätsbereich: ' +
                      implausible.join(', ')
                    : ''
        };
    }

    function determineRunning(frequency, status) {
        if (frequency > 0) {
            return true;
        }

        const normalized = String(status).trim().toLowerCase();

        if (
            normalized === '1' ||
            normalized === 'true' ||
            normalized === 'on' ||
            normalized === 'running' ||
            normalized === 'läuft' ||
            normalized === 'laeuft'
        ) {
            return true;
        }

        return false;
    }

    function updateCompressorMonitor() {
        const trace = ['Aktualisierung gestartet'];
        const values = collectValues();
        const validation = validateValues(values);

        if (!validation.valid) {
            increment('Diagnostics.InvalidUpdates');

            write('Diagnostics.ValidInput', false);
            write('Diagnostics.Warning', validation.warning);
            write('System.Status', 'WARTET');
            write(
                'System.LastMessage',
                'Verdichterwerte ungültig oder unvollständig'
            );

            trace.push('Abbruch: ' + validation.warning);
            writeTrace(trace);
            return;
        }

        const frequency = roundValue(values.frequency);
        const starts = Math.round(values.starts);
        const runtime = roundValue(values.runtime);
        const status = values.status;
        const running = determineRunning(frequency, status);

        write('Compressor.Frequency', frequency);
        write('Compressor.Starts', starts);
        write('Compressor.Status', status);
        write('Compressor.Runtime', runtime);
        write('Compressor.Running', running);

        write('Diagnostics.ValidInput', true);
        write('Diagnostics.Warning', '');
        write('System.LastUpdate', nowString());
        write('System.Status', 'BEREIT');
        write(
            'System.LastMessage',
            'Verdichterwerte aktualisiert'
        );

        trace.push('Frequency=' + frequency + ' Hz');
        trace.push('Starts=' + starts);
        trace.push('Status=' + status);
        trace.push('Runtime=' + runtime + ' h');
        trace.push('Running=' + running);
        trace.push('Aktualisierung erfolgreich');

        writeTrace(trace);

        debug(
            'Werte aktualisiert: ' +
            JSON.stringify({
                frequency: frequency,
                starts: starts,
                status: status,
                runtime: runtime,
                running: running
            })
        );
    }

    function start() {
        createAllObjects();

        setTimeout(function () {
            write('System.Version', CONFIG.VERSION);
            write('System.Active', true);
            write('System.LastStart', nowString());
            write('System.Status', 'STARTET');
            write(
                'System.LastMessage',
                'Initialisierung läuft'
            );

            if (!checkInputObjects()) {
                write('System.Active', false);
                return;
            }

            updateCompressorMonitor();

            scheduleHandle = schedule(
                CONFIG.UPDATE_CRON,
                updateCompressorMonitor
            );

            started = true;
            info('Version ' + CONFIG.VERSION + ' gestartet');
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
        if (scheduleHandle !== null) {
            clearSchedule(scheduleHandle);
            scheduleHandle = null;
        }

        if (started && existsState(dp('System.Active'))) {
            write('System.Active', false);
            write('System.Status', 'GESTOPPT');
            write(
                'System.LastMessage',
                'Modul wurde beendet'
            );
        }
    }, 1000);

    start();
})();
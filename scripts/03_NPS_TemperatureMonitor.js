/******************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               03_NPS_TemperatureMonitor
 * Datei:               03_NPS_TemperatureMonitor.js
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
 * Liest grundlegende Temperatur- und Hydraulikwerte, plausibilisiert sie und
 * stellt normierte Mess- und Hilfswerte für nachfolgende NPS-Module bereit.
 *
 * Berechnete Hilfswerte:
 * - Spreizung = Vorlauf - Rücklauf
 * - mittlere Heizwassertemperatur = (Vorlauf + Rücklauf) / 2
 * - Temperaturhub = Vorlauf - Außenluft
 *
 * Das Modul berechnet bewusst keine Energie-, COP-, JAZ- oder
 * Optimierungskennzahlen.
 *
 * Öffentliche Schnittstelle (Public API)
 * --------------------------------------
 * 0_userdata.0.NPS.TemperatureMonitor.Temperatures.Outdoor
 * 0_userdata.0.NPS.TemperatureMonitor.Temperatures.Supply
 * 0_userdata.0.NPS.TemperatureMonitor.Temperatures.Return
 * 0_userdata.0.NPS.TemperatureMonitor.Temperatures.Spread
 * 0_userdata.0.NPS.TemperatureMonitor.Temperatures.MeanHeatingWater
 * 0_userdata.0.NPS.TemperatureMonitor.Temperatures.TemperatureLift
 * 0_userdata.0.NPS.TemperatureMonitor.Hydraulics.Flow
 *
 * Gemeinsame NPS-Ausgänge
 * -----------------------
 *
 * Eingänge (Alias, nur lesend)
 * ---------------------------
 * alias.0.Keller.Waschküche.Waermepumpe.Außenlufttemperatur_(EB101-BT28)
 * alias.0.Keller.Waschküche.Waermepumpe.Vorlauf
 * alias.0.Keller.Waschküche.Waermepumpe.Ruecklauf
 * alias.0.Keller.Waschküche.Waermepumpe.Volumenstrommesser_(BF1)
 *
 * Interne Modulbereiche
 * ---------------------
 * 0_userdata.0.NPS.TemperatureMonitor.System.*
 * 0_userdata.0.NPS.TemperatureMonitor.Diagnostics.*
 *
 * Trigger
 * -------
 * - Startaktualisierung nach erfolgreicher Initialisierung
 * - Zeitgesteuerte Aktualisierung jede Minute
 *
 * Abhängigkeiten
 * ---------------
 * - ioBroker JavaScript-Adapter
 * - Vorhandene und numerisch lesbare Alias-Eingänge
 *
 * Konfiguration
 * -------------
 * CONFIG.DEBUG                  Diagnoseausgaben aktivieren
 * CONFIG.UPDATE_CRON            Aktualisierungsintervall
 * CONFIG.STATE_CREATE_DELAY_MS  Wartezeit nach Objekterzeugung
 * CONFIG.ROUND_DIGITS           Anzahl der Nachkommastellen
 * CONFIG.INPUT                  Alias-Zuordnung der Messwerte
 *
 * Architekturregeln
 * -----------------
 * - Eigenständiges Fachmodul; keine Zusammenlegung mit anderen NPS-Modulen
 * - Single Writer für alle States unter NPS.TemperatureMonitor
 * - Gemeinsame Current-Heizungswerte werden ausschließlich hier synchronisiert
 * - Ungültige Eingänge überschreiben keine zuletzt gültigen Messwerte
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
        ROOT: '0_userdata.0.NPS.TemperatureMonitor',

        UPDATE_CRON: '* * * * *',
        STATE_CREATE_DELAY_MS: 1000,
        ROUND_DIGITS: 1,

        INPUT: {
            OUTDOOR:
                'alias.0.Keller.Waschküche.Waermepumpe.Außenlufttemperatur_(EB101-BT28)',

            SUPPLY:
                'alias.0.Keller.Waschküche.Waermepumpe.Vorlauf',

            RETURN:
                'alias.0.Keller.Waschküche.Waermepumpe.Ruecklauf',

            FLOW:
                'alias.0.Keller.Waschküche.Waermepumpe.Volumenstrommesser_(BF1)'
        }
    };

    let started = false;
    let scheduleHandle = null;

    function info(message) {
        log('[NPS TemperatureMonitor] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS TemperatureMonitor] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS TemperatureMonitor DEBUG] ' + message, 'info');
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

    function readNumber(id) {
        const currentState = getState(id);

        if (
            !currentState ||
            currentState.val === undefined ||
            currentState.val === null ||
            currentState.val === ''
        ) {
            return null;
        }

        const value = Number(currentState.val);
        return Number.isFinite(value) ? value : null;
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
        ensureFolder(CONFIG.ROOT, 'NPS TemperatureMonitor');

        ensureChannel(dp('Temperatures'), 'Temperaturen');
        ensureChannel(dp('Hydraulics'), 'Hydraulik');
        ensureChannel(dp('System'), 'System');
        ensureChannel(dp('Diagnostics'), 'Diagnose');

        ensureNumber(
            'Temperatures.Outdoor',
            'Außenlufttemperatur BT28',
            '°C',
            'value.temperature'
        );

        ensureNumber(
            'Temperatures.Supply',
            'Vorlauftemperatur',
            '°C',
            'value.temperature'
        );

        ensureNumber(
            'Temperatures.Return',
            'Rücklauftemperatur',
            '°C',
            'value.temperature'
        );

        ensureNumber(
            'Temperatures.Spread',
            'Spreizung Vorlauf-Rücklauf',
            'K',
            'value.temperature'
        );

        ensureNumber(
            'Temperatures.MeanHeatingWater',
            'Mittlere Heizwassertemperatur',
            '°C',
            'value.temperature'
        );

        ensureNumber(
            'Temperatures.TemperatureLift',
            'Temperaturhub Vorlauf-Außenluft',
            'K',
            'value.temperature'
        );

        ensureNumber(
            'Hydraulics.Flow',
            'Volumenstrom',
            'l/min',
            'value.flow'
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
            outdoor: readNumber(CONFIG.INPUT.OUTDOOR),
            supply: readNumber(CONFIG.INPUT.SUPPLY),
            returnTemperature: readNumber(CONFIG.INPUT.RETURN),
            flow: readNumber(CONFIG.INPUT.FLOW)
        };
    }

    function validateValues(values) {
        const invalid = [];

        Object.keys(values).forEach(function (key) {
            if (values[key] === null) {
                invalid.push(key);
            }
        });

        if (invalid.length > 0) {
            return {
                valid: false,
                warning:
                    'Nicht lesbare Werte: ' +
                    invalid.join(', ')
            };
        }

        const physicallyInvalid = [];

        if (values.outdoor < -60 || values.outdoor > 70) {
            physicallyInvalid.push('outdoor');
        }

        if (values.supply < -20 || values.supply > 100) {
            physicallyInvalid.push('supply');
        }

        if (
            values.returnTemperature < -20 ||
            values.returnTemperature > 100
        ) {
            physicallyInvalid.push('returnTemperature');
        }

        if (values.flow < 0 || values.flow > 300) {
            physicallyInvalid.push('flow');
        }

        return {
            valid: physicallyInvalid.length === 0,
            warning:
                physicallyInvalid.length > 0
                    ? 'Werte außerhalb Plausibilitätsbereich: ' +
                      physicallyInvalid.join(', ')
                    : ''
        };
    }


    function updateTemperatureMonitor() {
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
                'Temperatur- oder Hydraulikwerte ungültig'
            );

            trace.push('Abbruch: ' + validation.warning);
            writeTrace(trace);
            return;
        }

        const outdoor = roundValue(values.outdoor);
        const supply = roundValue(values.supply);
        const returnTemperature =
            roundValue(values.returnTemperature);
        const flow = roundValue(values.flow);

        const spread =
            roundValue(values.supply - values.returnTemperature);

        const meanHeatingWater = roundValue(
            (values.supply + values.returnTemperature) / 2
        );

        const temperatureLift = roundValue(
            values.supply - values.outdoor
        );

        write('Temperatures.Outdoor', outdoor);
        write('Temperatures.Supply', supply);
        write('Temperatures.Return', returnTemperature);
        write('Temperatures.Spread', spread);
        write(
            'Temperatures.MeanHeatingWater',
            meanHeatingWater
        );
        write(
            'Temperatures.TemperatureLift',
            temperatureLift
        );
        write('Hydraulics.Flow', flow);

        write('Diagnostics.ValidInput', true);
        write('Diagnostics.Warning', '');
        write('System.LastUpdate', nowString());
        write('System.Status', 'BEREIT');
        write(
            'System.LastMessage',
            'Temperatur- und Hydraulikwerte aktualisiert'
        );

        trace.push('Outdoor=' + outdoor + ' °C');
        trace.push('Supply=' + supply + ' °C');
        trace.push('Return=' + returnTemperature + ' °C');
        trace.push('Spread=' + spread + ' K');
        trace.push(
            'MeanHeatingWater=' +
            meanHeatingWater +
            ' °C'
        );
        trace.push(
            'TemperatureLift=' +
            temperatureLift +
            ' K'
        );
        trace.push('Flow=' + flow + ' l/min');
        trace.push('Aktualisierung erfolgreich');

        writeTrace(trace);

        debug(
            'Werte aktualisiert: ' +
            JSON.stringify({
                outdoor: outdoor,
                supply: supply,
                returnTemperature: returnTemperature,
                spread: spread,
                meanHeatingWater: meanHeatingWater,
                temperatureLift: temperatureLift,
                flow: flow
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

            updateTemperatureMonitor();

            scheduleHandle = schedule(
                CONFIG.UPDATE_CRON,
                updateTemperatureMonitor
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
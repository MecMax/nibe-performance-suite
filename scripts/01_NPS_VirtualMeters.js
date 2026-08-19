/******************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               01_NPS_VirtualMeters
 * Datei:               01_NPS_VirtualMeters.js
 * Version:             1.2.1
 * Build:               2026-08-18
 * Modulstatus:         STABIL
 * Architektur-Schicht: Datenerfassung / Normalisierung
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Übernimmt vier kumulative NIBE-Wärmemengenzähler aus dem Alias-Datenraum
 * und stellt sie als normierte NPS-Messwerte bereit.
 *
 * Das Modul führt bewusst keine Delta-, COP-, JAZ- oder Zeitraumrechnung aus.
 * Es erzeugt und verwaltet seinen Objektbaum unter NPS.VirtualMeters selbst.
 *
 * Öffentliche Schnittstelle (Public API)
 * --------------------------------------
 * 0_userdata.0.NPS.VirtualMeters.Heizung.NurVerdichter
 * 0_userdata.0.NPS.VirtualMeters.Heizung.InklusiveZusatzheizung
 * 0_userdata.0.NPS.VirtualMeters.Brauchwasser.NurVerdichter
 * 0_userdata.0.NPS.VirtualMeters.Brauchwasser.InklusiveZusatzheizung
 * 0_userdata.0.NPS.VirtualMeters.Gesamt.NurVerdichter
 * 0_userdata.0.NPS.VirtualMeters.Gesamt.InklusiveZusatzheizung
 *
 * Eingänge (Alias, nur lesend)
 * ---------------------------
 * alias.0.Keller.Waschküche.Waermepumpe.Heizung_nur_Verdichter
 * alias.0.Keller.Waschküche.Waermepumpe.Heizung_einschl_interner_ZH
 * alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_nur_Verdichter
 * alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_einschl_interner_ZH
 *
 * Interne Modulbereiche
 * ---------------------
 * 0_userdata.0.NPS.VirtualMeters.Qualitaet.*
 * 0_userdata.0.NPS.VirtualMeters.System.*
 * 0_userdata.0.NPS.VirtualMeters.Diagnose.*
 *
 * Trigger
 * -------
 * - Startaktualisierung nach erfolgreicher Initialisierung
 * - Änderungen der vier Alias-Eingänge (entprellt)
 * - Watchdog-Aktualisierung alle fünf Minuten
 *
 * Abhängigkeiten
 * ---------------
 * - ioBroker JavaScript-Adapter
 * - Vorhandene und numerisch lesbare Alias-Eingänge
 *
 * Konfiguration
 * -------------
 * CONFIG.DEBUG                  Diagnoseausgaben aktivieren
 * CONFIG.STATE_CREATE_DELAY_MS  Wartezeit nach Objekterzeugung
 * CONFIG.DEBOUNCE_MS            Entprellzeit der Eingangstrigger
 * CONFIG.WATCHDOG_CRON          Regelmäßige Kontrollaktualisierung
 * CONFIG.INPUT                  Alias-Zuordnung der Wärmemengenzähler
 *
 * Architekturregeln
 * -----------------
 * - Eigenständiges Fachmodul; keine Zusammenlegung mit anderen NPS-Modulen
 * - Single Writer für alle States unter NPS.VirtualMeters
 * - Kommunikation mit Folgemodulen ausschließlich über NPS-Datenpunkte
 * - Ungültige Eingänge überschreiben keine zuletzt gültigen Messwerte
 *

 * Architekturregel AR-004
 * ------------------------
 * Dieses Modul ist der Single Point of Truth für alle Wärmemengenzähler.
 * Alle Folgemodule verwenden ausschließlich
 * 0_userdata.0.NPS.VirtualMeters.*
 * Direkte Zugriffe auf Alias- oder Modbus-Wärmezähler sind außerhalb
 * dieses Moduls nicht zulässig.
 *
 * Änderungsverlauf
 * ----------------
 * 1.2.0 | 2026-07-30
 *       | Zwei kumulative Gesamtwärmemengenzähler ergänzt:
 *       | Gesamt.NurVerdichter und Gesamt.InklusiveZusatzheizung.
 *       | Die Werte werden aus Heizung + Brauchwasser gebildet.
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
        VERSION: '1.2.1',
        DEBUG: false,

        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.VirtualMeters',

        STATE_CREATE_DELAY_MS: 1000,
        DEBOUNCE_MS: 250,
        WATCHDOG_CRON: '*/5 * * * *',

        INPUT: {
            HEIZUNG_VERDICHTER:
                'alias.0.Keller.Waschküche.Waermepumpe.Heizung_nur_Verdichter',

            HEIZUNG_INKL_ZUSATZ:
                'alias.0.Keller.Waschküche.Waermepumpe.Heizung_einschl_interner_ZH',

            BRAUCHWASSER_VERDICHTER:
                'alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_nur_Verdichter',

            BRAUCHWASSER_INKL_ZUSATZ:
                'alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_einschl_interner_ZH'
        }
    };

    const OUTPUT = {
        HEIZUNG_VERDICHTER:
            CONFIG.ROOT + '.Heizung.NurVerdichter',

        HEIZUNG_INKL_ZUSATZ:
            CONFIG.ROOT + '.Heizung.InklusiveZusatzheizung',

        BRAUCHWASSER_VERDICHTER:
            CONFIG.ROOT + '.Brauchwasser.NurVerdichter',

        BRAUCHWASSER_INKL_ZUSATZ:
            CONFIG.ROOT + '.Brauchwasser.InklusiveZusatzheizung',

        GESAMT_VERDICHTER:
            CONFIG.ROOT + '.Gesamt.NurVerdichter',

        GESAMT_INKL_ZUSATZ:
            CONFIG.ROOT + '.Gesamt.InklusiveZusatzheizung',

        QUALITY_VALID:
            CONFIG.ROOT + '.Qualitaet.Gueltig',

        QUALITY_COMPLETE:
            CONFIG.ROOT + '.Qualitaet.Vollstaendig',

        QUALITY_LAST_VALID:
            CONFIG.ROOT + '.Qualitaet.LetzterGueltigerWert',

        SYSTEM_VERSION:
            CONFIG.ROOT + '.System.Version',

        SYSTEM_ACTIVE:
            CONFIG.ROOT + '.System.Aktiv',

        SYSTEM_STATUS:
            CONFIG.ROOT + '.System.Status',

        SYSTEM_LAST_START:
            CONFIG.ROOT + '.System.LetzterStart',

        SYSTEM_LAST_UPDATE:
            CONFIG.ROOT + '.System.LetzteAktualisierung',

        SYSTEM_LAST_MESSAGE:
            CONFIG.ROOT + '.System.LetzteMeldung',

        SYSTEM_HEARTBEAT:
            CONFIG.ROOT + '.System.Heartbeat',

        SYSTEM_STATISTICS_READY:
            CONFIG.ROOT + '.System.StatisticsReady',

        DIAG_UPDATE_COUNT:
            CONFIG.ROOT + '.Diagnose.Aktualisierungen',

        DIAG_INVALID_COUNT:
            CONFIG.ROOT + '.Diagnose.UngueltigeAktualisierungen',

        DIAG_LAST_WARNING:
            CONFIG.ROOT + '.Diagnose.LetzteWarnung',

        DIAG_TRACE:
            CONFIG.ROOT + '.Diagnose.Trace'
    };

    let debounceTimer = null;
    let updateRunning = false;
    let updatePending = false;
    let started = false;

    function info(message) {
        log('[NPS VirtualMeters] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS VirtualMeters] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS VirtualMeters DEBUG] ' + message, 'info');
        }
    }

    function exists(id) {
        return existsState(id) || existsObject(id);
    }

    function timestamp() {
        return new Date().toISOString();
    }

    function readNumber(id) {
        const currentState = getState(id);

        if (
            !currentState ||
            currentState.val === undefined ||
            currentState.val === null ||
            currentState.val === ''
        ) {
            return {
                valid: false,
                value: null
            };
        }

        const value = Number(currentState.val);

        return {
            valid: Number.isFinite(value) && value >= 0,
            value: Number.isFinite(value) && value >= 0 ? value : null
        };
    }

    function readStoredNumber(id) {
        const result = readNumber(id);
        return result.valid ? result.value : 0;
    }

    function write(id, value) {
        if (!exists(id)) {
            warn('Ausgangsdatenpunkt fehlt: ' + id);
            return false;
        }

        const current = getState(id);

        if (!current || current.val !== value) {
            setState(id, value, true);
        }

        return true;
    }

    function increment(id) {
        write(id, readStoredNumber(id) + 1);
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

    function ensureState(id, initialValue, common) {
        if (exists(id)) {
            return;
        }

        createState(id, initialValue, true, common);
    }

    function ensureNumber(id, name, unit) {
        const common = {
            name: name,
            type: 'number',
            role: unit === 'kWh' ? 'value.energy' : 'value',
            read: true,
            write: false
        };

        if (unit) {
            common.unit = unit;
        }

        ensureState(id, 0, common);
    }

    function ensureString(id, name, role) {
        ensureState(id, '', {
            name: name,
            type: 'string',
            role: role || 'text',
            read: true,
            write: false
        });
    }

    function ensureBoolean(id, name, role) {
        ensureState(id, false, {
            name: name,
            type: 'boolean',
            role: role || 'indicator',
            read: true,
            write: false
        });
    }

    function createAllObjects() {
        ensureFolder(CONFIG.ROOT, 'NPS VirtualMeters');

        ensureChannel(CONFIG.ROOT + '.System', 'System');
        ensureChannel(CONFIG.ROOT + '.Heizung', 'Heizung');
        ensureChannel(CONFIG.ROOT + '.Brauchwasser', 'Brauchwasser');
        ensureChannel(CONFIG.ROOT + '.Gesamt', 'Gesamterzeugung');
        ensureChannel(CONFIG.ROOT + '.Qualitaet', 'Datenqualität');
        ensureChannel(CONFIG.ROOT + '.Diagnose', 'Diagnose');

        ensureNumber(
            OUTPUT.HEIZUNG_VERDICHTER,
            'Heizenergie nur Verdichter',
            'kWh'
        );

        ensureNumber(
            OUTPUT.HEIZUNG_INKL_ZUSATZ,
            'Heizenergie inklusive interner Zusatzheizung',
            'kWh'
        );

        ensureNumber(
            OUTPUT.BRAUCHWASSER_VERDICHTER,
            'Brauchwasserenergie nur Verdichter',
            'kWh'
        );

        ensureNumber(
            OUTPUT.BRAUCHWASSER_INKL_ZUSATZ,
            'Brauchwasserenergie inklusive interner Zusatzheizung',
            'kWh'
        );

        ensureNumber(
            OUTPUT.GESAMT_VERDICHTER,
            'Gesamterzeugung nur Verdichter',
            'kWh'
        );

        ensureNumber(
            OUTPUT.GESAMT_INKL_ZUSATZ,
            'Gesamterzeugung inklusive interner Zusatzheizung',
            'kWh'
        );

        ensureBoolean(OUTPUT.QUALITY_VALID, 'Eingangswerte gültig');
        ensureBoolean(OUTPUT.QUALITY_COMPLETE, 'Datensatz vollständig');
        ensureString(
            OUTPUT.QUALITY_LAST_VALID,
            'Letzter gültiger Datensatz',
            'date'
        );

        ensureString(OUTPUT.SYSTEM_VERSION, 'Modulversion');
        ensureBoolean(OUTPUT.SYSTEM_ACTIVE, 'Modul aktiv');
        ensureString(OUTPUT.SYSTEM_STATUS, 'Modulstatus');
        ensureString(
            OUTPUT.SYSTEM_LAST_START,
            'Letzter Modulstart',
            'date'
        );
        ensureString(
            OUTPUT.SYSTEM_LAST_UPDATE,
            'Letzte Aktualisierung',
            'date'
        );
        ensureString(OUTPUT.SYSTEM_LAST_MESSAGE, 'Letzte Meldung');
        ensureString(OUTPUT.SYSTEM_HEARTBEAT, 'Heartbeat', 'date');
        ensureBoolean(OUTPUT.SYSTEM_STATISTICS_READY, 'Statistics bereit');

        ensureNumber(OUTPUT.DIAG_UPDATE_COUNT, 'Anzahl Aktualisierungen');
        ensureNumber(
            OUTPUT.DIAG_INVALID_COUNT,
            'Anzahl ungültiger Aktualisierungen'
        );
        ensureString(OUTPUT.DIAG_LAST_WARNING, 'Letzte Warnung');
        ensureString(OUTPUT.DIAG_TRACE, 'Diagnosetrace');
    }


    function validateInputs() {
        const missing = [];

        Object.keys(CONFIG.INPUT).forEach(function (key) {
            const id = CONFIG.INPUT[key];

            if (!exists(id)) {
                missing.push(key + ': ' + id);
            }
        });

        if (missing.length > 0) {
            write(OUTPUT.QUALITY_VALID, false);
            write(OUTPUT.QUALITY_COMPLETE, false);
            write(OUTPUT.SYSTEM_STATUS, 'FEHLER');
            write(
                OUTPUT.SYSTEM_LAST_MESSAGE,
                'Mindestens ein Eingangsdatenpunkt fehlt'
            );
            write(
                OUTPUT.DIAG_LAST_WARNING,
                'Fehlende Eingänge: ' + missing.join(' | ')
            );

            missing.forEach(warn);
            return false;
        }

        return true;
    }

    function collectValues() {
        return {
            heatingCompressor:
                readNumber(CONFIG.INPUT.HEIZUNG_VERDICHTER),

            heatingIncludingAuxiliary:
                readNumber(CONFIG.INPUT.HEIZUNG_INKL_ZUSATZ),

            warmwaterCompressor:
                readNumber(CONFIG.INPUT.BRAUCHWASSER_VERDICHTER),

            warmwaterIncludingAuxiliary:
                readNumber(CONFIG.INPUT.BRAUCHWASSER_INKL_ZUSATZ)
        };
    }

    function validateValues(values) {
        const invalid = [];

        Object.keys(values).forEach(function (key) {
            if (!values[key].valid) {
                invalid.push(key);
            }
        });

        if (invalid.length > 0) {
            return {
                valid: false,
                warning:
                    'Nicht lesbare oder negative Werte: ' +
                    invalid.join(', ')
            };
        }

        if (
            values.heatingIncludingAuxiliary.value <
            values.heatingCompressor.value
        ) {
            invalid.push(
                'Heizung: inklusive Zusatzheizung < nur Verdichter'
            );
        }

        if (
            values.warmwaterIncludingAuxiliary.value <
            values.warmwaterCompressor.value
        ) {
            invalid.push(
                'Brauchwasser: inklusive Zusatzheizung < nur Verdichter'
            );
        }

        return {
            valid: invalid.length === 0,
            warning: invalid.join(' | ')
        };
    }

    function performUpdate() {
        if (updateRunning) {
            updatePending = true;
            return;
        }

        updateRunning = true;

        try {
            const values = collectValues();
            const validation = validateValues(values);
            const trace = ['Aktualisierung: ' + timestamp()];

            if (!validation.valid) {
                increment(OUTPUT.DIAG_INVALID_COUNT);

                write(OUTPUT.QUALITY_VALID, false);
                write(OUTPUT.QUALITY_COMPLETE, false);
                write(OUTPUT.SYSTEM_STATUS, 'WARTET');
                write(
                    OUTPUT.SYSTEM_LAST_MESSAGE,
                    'Wärmemengenzähler nicht vollständig gültig'
                );
                write(OUTPUT.DIAG_LAST_WARNING, validation.warning);

                trace.push('Abbruch: ' + validation.warning);
                write(OUTPUT.DIAG_TRACE, trace.join('\n'));
                return;
            }

            write(
                OUTPUT.HEIZUNG_VERDICHTER,
                values.heatingCompressor.value
            );
            write(
                OUTPUT.HEIZUNG_INKL_ZUSATZ,
                values.heatingIncludingAuxiliary.value
            );
            write(
                OUTPUT.BRAUCHWASSER_VERDICHTER,
                values.warmwaterCompressor.value
            );
            write(
                OUTPUT.BRAUCHWASSER_INKL_ZUSATZ,
                values.warmwaterIncludingAuxiliary.value
            );

            const totalCompressor =
                values.heatingCompressor.value +
                values.warmwaterCompressor.value;

            const totalIncludingAuxiliary =
                values.heatingIncludingAuxiliary.value +
                values.warmwaterIncludingAuxiliary.value;

            write(OUTPUT.GESAMT_VERDICHTER, totalCompressor);
            write(OUTPUT.GESAMT_INKL_ZUSATZ, totalIncludingAuxiliary);

            increment(OUTPUT.DIAG_UPDATE_COUNT);

            const now = timestamp();

            write(OUTPUT.QUALITY_VALID, true);
            write(OUTPUT.QUALITY_COMPLETE, true);
            write(OUTPUT.QUALITY_LAST_VALID, now);
            write(OUTPUT.SYSTEM_LAST_UPDATE, now);
            write(OUTPUT.SYSTEM_HEARTBEAT, now);
            write(OUTPUT.SYSTEM_STATISTICS_READY, true);
            write(OUTPUT.SYSTEM_STATUS, 'BEREIT');
            write(
                OUTPUT.SYSTEM_LAST_MESSAGE,
                'Virtuelle Wärmemengenzähler aktualisiert'
            );
            write(OUTPUT.DIAG_LAST_WARNING, '');

            trace.push(
                'Heizung.NurVerdichter=' +
                values.heatingCompressor.value
            );
            trace.push(
                'Heizung.InklusiveZusatzheizung=' +
                values.heatingIncludingAuxiliary.value
            );
            trace.push(
                'Brauchwasser.NurVerdichter=' +
                values.warmwaterCompressor.value
            );
            trace.push(
                'Brauchwasser.InklusiveZusatzheizung=' +
                values.warmwaterIncludingAuxiliary.value
            );
            trace.push('Gesamt.NurVerdichter=' + totalCompressor);
            trace.push(
                'Gesamt.InklusiveZusatzheizung=' +
                totalIncludingAuxiliary
            );
            trace.push('Aktualisierung erfolgreich');

            write(OUTPUT.DIAG_TRACE, trace.join('\n'));

            debug(
                'Wärmemengenzähler aktualisiert: ' +
                JSON.stringify(values)
            );
        } catch (error) {
            increment(OUTPUT.DIAG_INVALID_COUNT);
            write(OUTPUT.QUALITY_VALID, false);
            write(OUTPUT.QUALITY_COMPLETE, false);
            write(OUTPUT.SYSTEM_STATUS, 'FEHLER');
            write(
                OUTPUT.SYSTEM_LAST_MESSAGE,
                'Interner Verarbeitungsfehler'
            );
            write(
                OUTPUT.DIAG_LAST_WARNING,
                error && error.message ? error.message : String(error)
            );

            warn(
                'Fehler bei Aktualisierung: ' +
                (error && error.stack ? error.stack : error)
            );
        } finally {
            updateRunning = false;

            if (updatePending) {
                updatePending = false;
                setTimeout(performUpdate, 0);
            }
        }
    }

    function requestUpdate() {
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(function () {
            debounceTimer = null;
            performUpdate();
        }, CONFIG.DEBOUNCE_MS);
    }

    function registerTriggers() {
        Object.keys(CONFIG.INPUT).forEach(function (key) {
            on(
                {
                    id: CONFIG.INPUT[key],
                    change: 'ne'
                },
                requestUpdate
            );
        });
    }

    function start() {
        createAllObjects();

        setTimeout(function () {
            write(OUTPUT.SYSTEM_VERSION, CONFIG.VERSION);
            write(OUTPUT.SYSTEM_ACTIVE, true);
            write(OUTPUT.SYSTEM_LAST_START, timestamp());
            write(OUTPUT.SYSTEM_HEARTBEAT, timestamp());
            write(OUTPUT.SYSTEM_STATUS, 'STARTET');
            write(
                OUTPUT.SYSTEM_LAST_MESSAGE,
                'Initialisierung läuft'
            );

            if (!validateInputs()) {
                write(OUTPUT.SYSTEM_ACTIVE, false);
                return;
            }

            registerTriggers();
            schedule(CONFIG.WATCHDOG_CRON, performUpdate);
            performUpdate();

            started = true;
            info('Version ' + CONFIG.VERSION + ' gestartet');
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
        if (!started && !exists(OUTPUT.SYSTEM_ACTIVE)) {
            return;
        }

        write(OUTPUT.SYSTEM_ACTIVE, false);
        write(OUTPUT.SYSTEM_STATUS, 'GESTOPPT');
        write(
            OUTPUT.SYSTEM_LAST_MESSAGE,
            'Modul wurde beendet'
        );
    }, 1000);

    start();
})();
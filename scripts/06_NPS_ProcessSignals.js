/******************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               06_NPS_ProcessSignals
 * Datei:               06_NPS_ProcessSignals.js
 * Version:             1.1.1
 * Build:               2026-08-18
 * Modulstatus:         STABIL
 * Architektur-Schicht: Signalaufbereitung / Prozessabstraktion
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Liest verifizierte Alias-Datenpunkte der Wärmepumpe und bildet daraus
 * standardisierte, fachlich benannte Prozesssignale für nachgelagerte Module.
 * Zusätzlich werden einfache Plausibilitätsindikatoren bereitgestellt.
 *
 * Das Modul erzeugt bewusst keine Zustandsmaschine, keine Ereignisse, keine
 * Zyklusauswertung und keine langfristigen Statistiken.
 *
 * Öffentliche Schnittstelle (Public API)
 * --------------------------------------
 * 0_userdata.0.NPS.ProcessSignals.Verdichter.*
 * 0_userdata.0.NPS.ProcessSignals.Betriebsart.*
 * 0_userdata.0.NPS.ProcessSignals.Plausibilitaet.*
 *
 * Eingänge (Alias, nur lesend)
 * ---------------------------
 * Pflichtsignale:
 * alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)
 * alias.0.Keller.Waschküche.Waermepumpe.prio
 * alias.0.Keller.Waschküche.Waermepumpe.Enteisung
 * alias.0.Keller.Waschküche.Waermepumpe.Strom_(EB101-EP14)
 *
 * Optionale Signale:
 * alias.0.Keller.Waschküche.Waermepumpe.Status_Verdichter_Bedarf
 * alias.0.Keller.Waschküche.Waermepumpe.Status_Verdichter_Erwärmer
 *
 * Fehlende optionale Signale erzeugen keine Störung. Die zugehörigen
 * veröffentlichten ProcessSignals-Datenpunkte bleiben aus Gründen der
 * Strukturstabilität erhalten und werden dann mit false belegt.
 *
 * Signalbildung
 * -------------
 * - Verdichter läuft ab einer Frequenz von mindestens 1 Hz.
 * - Enteisungswerte 1 oder 2 gelten als aktive Abtauung.
 * - Prioritäten 10/20/30/40/60 entsprechen Standby, Brauchwasser, Heizung,
 *   Pool und Kühlung.
 * - SignaleGueltig bewertet ausschließlich die erforderlichen Kernsignale:
 *   Verdichterfrequenz, Priorität, Abtauung und Leistung.
 * - Ein separater Verdichterstatus wird bei der S-Serie nicht verwendet.
 *   Verdichterlauf und Stillstand werden ausschließlich aus der Frequenz
 *   abgeleitet.
 * - Verdichterbedarf und Verdichter-Erwärmer sind optionale Zusatzsignale.
 * - Bedarf-bezogene Plausibilitätsprüfungen werden nur ausgeführt, wenn ein
 *   gültiges Bedarfssignal vorhanden ist.
 * - Der Stromwert besitzt einen separaten Gültigkeitsindikator.
 *
 * Trigger
 * -------
 * - Einmalige Auswertung nach erfolgreicher Initialisierung
 * - Ereignisgesteuerte Auswertung bei jeder Änderung eines Alias-Eingangs
 *
 * Abhängigkeiten
 * ---------------
 * - ioBroker JavaScript-Adapter
 * - Vorhandene Pflicht-Alias-Eingänge laut CONFIG.REQUIRED_INPUT_KEYS
 * - Optionale Alias-Eingänge laut CONFIG.OPTIONAL_INPUT_KEYS
 *
 * Architekturregeln
 * -----------------
 * - Eigenständiges Fachmodul; keine Zusammenlegung mit StateMachine/EventEngine
 * - Single Writer für alle States unter NPS.ProcessSignals
 * - Ausschließlich Signalaufbereitung und momentane Plausibilitätsprüfung
 * - Keine Speicherung fachlicher Zustandsverläufe oder Ereignishistorien
 * - Nachgelagerte Module lesen ausschließlich die veröffentlichte Public API
 *
 * Änderungsverlauf
 * ----------------
 * 1.1.0 | 2026-07-26
 *       | Nicht verifizierten Alias Verdichterstatus aus Eingängen und
 *       | Gültigkeitslogik entfernt. Verdichterlauf wird für die S-Serie
 *       | ausschließlich aus der Verdichterfrequenz abgeleitet.
 *       | Bestehende Legacy-Ausgänge Eingangswerte.Verdichterstatus und
 *       | Verdichter.StatuswertGueltig bleiben strukturstabil erhalten,
 *       | werden aber mit 0 beziehungsweise false belegt.
 * 1.0.2 | 2026-07-25
 *       | Verdichterbedarf und Verdichter-Erwärmer als optionale Eingänge
 *       | eingestuft. Fehlende optionale Aliase verursachen keine Störung.
 *       | SignaleGueltig basiert auf Frequenz, Status, Priorität,
 *       | Abtauung und Leistung. Datenpunktstruktur unverändert.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Public API, Signaldefinitionen,
 *       | Trigger, Abhängigkeiten und Modulgrenzen dokumentiert.
 *       | Keine Änderung der Programmlogik oder Datenpunktstruktur.
 * 1.0.0 | 2026-07-14
 *       | Produktive Erstversion.
 ****************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '1.1.1',
        DEBUG: false,

        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.ProcessSignals',
        STATE_CREATE_DELAY_MS: 1000,

        THRESHOLDS: {
            VERDICHTER_LAEUFT_AB_HZ: 1
        },

        PRIORITIES: {
            STANDBY: 10,
            BRAUCHWASSER: 20,
            HEIZUNG: 30,
            POOL: 40,
            KUEHLUNG: 60
        },

        INPUT: {
            VERDICHTERFREQUENZ:
                'alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)',

            VERDICHTERBEDARF:
                'alias.0.Keller.Waschküche.Waermepumpe.Status_Verdichter_Bedarf',

            VERDICHTER_ERWAERMER:
                'alias.0.Keller.Waschküche.Waermepumpe.Status_Verdichter_Erwärmer',

            PRIORITAET:
                'alias.0.Keller.Waschküche.Waermepumpe.prio',

            ABTAUUNG:
                'alias.0.Keller.Waschküche.Waermepumpe.Enteisung',

            VERDICHTERSTROM:
                'alias.0.Keller.Waschküche.Waermepumpe.Strom_(EB101-EP14)'
        },

        REQUIRED_INPUT_KEYS: [
            'VERDICHTERFREQUENZ',
            'PRIORITAET',
            'ABTAUUNG',
            'VERDICHTERSTROM'
        ],

        OPTIONAL_INPUT_KEYS: [
            'VERDICHTERBEDARF',
            'VERDICHTER_ERWAERMER'
        ]
    };

    const O = {
        SYSTEM_VERSION: CONFIG.ROOT + '.System.Version',
        SYSTEM_ACTIVE: CONFIG.ROOT + '.System.Aktiv',
        SYSTEM_STATUS: CONFIG.ROOT + '.System.Status',
        SYSTEM_LAST_UPDATE: CONFIG.ROOT + '.System.LetzteAktualisierung',
        SYSTEM_LAST_MESSAGE: CONFIG.ROOT + '.System.LetzteMeldung',

        INPUT_FREQUENCY: CONFIG.ROOT + '.Eingangswerte.Verdichterfrequenz',
        INPUT_STATUS: CONFIG.ROOT + '.Eingangswerte.Verdichterstatus',
        INPUT_DEMAND: CONFIG.ROOT + '.Eingangswerte.Verdichterbedarf',
        INPUT_HEATER: CONFIG.ROOT + '.Eingangswerte.VerdichterErwaermer',
        INPUT_PRIORITY: CONFIG.ROOT + '.Eingangswerte.Prioritaet',
        INPUT_DEFROST: CONFIG.ROOT + '.Eingangswerte.Abtauung',
        INPUT_POWER: CONFIG.ROOT + '.Eingangswerte.Verdichterstrom',

        COMPRESSOR_RUNNING: CONFIG.ROOT + '.Verdichter.Laeuft',
        COMPRESSOR_STOPPED: CONFIG.ROOT + '.Verdichter.Steht',
        COMPRESSOR_DEMAND: CONFIG.ROOT + '.Verdichter.BedarfAktiv',
        COMPRESSOR_HEATER: CONFIG.ROOT + '.Verdichter.ErwaermerAktiv',
        DEFROST_ACTIVE: CONFIG.ROOT + '.Verdichter.AbtauungAktiv',
        STATUS_VALID: CONFIG.ROOT + '.Verdichter.StatuswertGueltig',
        POWER_VALID: CONFIG.ROOT + '.Verdichter.StromwertGueltig',

        PRIORITY_STANDBY: CONFIG.ROOT + '.Betriebsart.Standby',
        PRIORITY_HOTWATER: CONFIG.ROOT + '.Betriebsart.Brauchwasser',
        PRIORITY_HEATING: CONFIG.ROOT + '.Betriebsart.Heizung',
        PRIORITY_POOL: CONFIG.ROOT + '.Betriebsart.Pool',
        PRIORITY_COOLING: CONFIG.ROOT + '.Betriebsart.Kuehlung',
        PRIORITY_KNOWN: CONFIG.ROOT + '.Betriebsart.Bekannt',

        SIGNALS_VALID: CONFIG.ROOT + '.Plausibilitaet.SignaleGueltig',
        DEMAND_WHILE_STOPPED: CONFIG.ROOT + '.Plausibilitaet.BedarfBeiStillstand',
        RUNNING_WITHOUT_DEMAND: CONFIG.ROOT + '.Plausibilitaet.LaufOhneBedarf',
        DEFROST_WITHOUT_RUNNING:
            CONFIG.ROOT + '.Plausibilitaet.AbtauungOhneVerdichterlauf',
        RUNNING_WITH_UNKNOWN_PRIORITY:
            CONFIG.ROOT + '.Plausibilitaet.VerdichterlaufOhneBekanntePrioritaet'
    };

    let started = false;

    function info(message) {
        log('[NPS ProcessSignals] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS ProcessSignals] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS ProcessSignals DEBUG] ' + message, 'info');
        }
    }

    function exists(id) {
        return existsState(id) || existsObject(id);
    }

    function timestamp() {
        return new Date().toLocaleString('de-DE');
    }

    function ensureFolder(id, name) {
        if (exists(id)) return;
        setObject(id, {
            type: 'folder',
            common: { name: name },
            native: {}
        });
    }

    function ensureChannel(id, name) {
        if (exists(id)) return;
        setObject(id, {
            type: 'channel',
            common: { name: name },
            native: {}
        });
    }

    function ensureState(id, initialValue, common) {
        if (exists(id)) return;
        createState(id, initialValue, common);
    }

    function ensureNumber(id, name, unit, role) {
        const common = {
            name: name,
            type: 'number',
            role: role || 'value',
            read: true,
            write: false
        };
        if (unit !== undefined) common.unit = unit;
        ensureState(id, 0, common);
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

    function ensureString(id, name, role) {
        ensureState(id, '', {
            name: name,
            type: 'string',
            role: role || 'text',
            read: true,
            write: false
        });
    }

    function createAllObjects() {
        ensureFolder(CONFIG.ROOT, 'NPS ProcessSignals');

        ensureChannel(CONFIG.ROOT + '.System', 'System');
        ensureChannel(CONFIG.ROOT + '.Eingangswerte', 'Eingangswerte');
        ensureChannel(CONFIG.ROOT + '.Verdichter', 'Verdichter');
        ensureChannel(CONFIG.ROOT + '.Betriebsart', 'Betriebsart');
        ensureChannel(CONFIG.ROOT + '.Plausibilitaet', 'Plausibilität');

        ensureString(O.SYSTEM_VERSION, 'Modulversion');
        ensureBoolean(O.SYSTEM_ACTIVE, 'Modul aktiv');
        ensureString(O.SYSTEM_STATUS, 'Modulstatus');
        ensureString(O.SYSTEM_LAST_UPDATE, 'Letzte Aktualisierung', 'date');
        ensureString(O.SYSTEM_LAST_MESSAGE, 'Letzte Meldung');

        ensureNumber(
            O.INPUT_FREQUENCY,
            'Eingangswert Verdichterfrequenz',
            'Hz',
            'value.frequency'
        );
        ensureNumber(O.INPUT_STATUS, 'Legacy-Eingangswert Verdichterstatus (nicht verwendet)');
        ensureBoolean(O.INPUT_DEMAND, 'Eingangswert Verdichterbedarf');
        ensureBoolean(O.INPUT_HEATER, 'Eingangswert Verdichter-Erwärmer');
        ensureNumber(O.INPUT_PRIORITY, 'Eingangswert Betriebspriorität');
        ensureBoolean(O.INPUT_DEFROST, 'Eingangswert Abtauung');
        ensureNumber(
            O.INPUT_POWER,
            'Eingangswert Verdichterstrom/Leistung',
            'kW',
            'value.power'
        );

        ensureBoolean(O.COMPRESSOR_RUNNING, 'Verdichter läuft', 'indicator.running');
        ensureBoolean(O.COMPRESSOR_STOPPED, 'Verdichter steht');
        ensureBoolean(O.COMPRESSOR_DEMAND, 'Verdichterbedarf aktiv');
        ensureBoolean(O.COMPRESSOR_HEATER, 'Verdichter-Erwärmer aktiv');
        ensureBoolean(O.DEFROST_ACTIVE, 'Abtauung aktiv');
        ensureBoolean(O.STATUS_VALID, 'Legacy-Verdichterstatuswert gültig (nicht verwendet)');
        ensureBoolean(O.POWER_VALID, 'Verdichterstromwert gültig');

        ensureBoolean(O.PRIORITY_STANDBY, 'Priorität Standby aktiv');
        ensureBoolean(O.PRIORITY_HOTWATER, 'Priorität Brauchwasser aktiv');
        ensureBoolean(O.PRIORITY_HEATING, 'Priorität Heizung aktiv');
        ensureBoolean(O.PRIORITY_POOL, 'Priorität Pool aktiv');
        ensureBoolean(O.PRIORITY_COOLING, 'Priorität Kühlung aktiv');
        ensureBoolean(O.PRIORITY_KNOWN, 'Betriebspriorität bekannt');

        ensureBoolean(O.SIGNALS_VALID, 'Alle erforderlichen Prozesssignale gültig');
        ensureBoolean(O.DEMAND_WHILE_STOPPED, 'Verdichterbedarf bei Stillstand');
        ensureBoolean(O.RUNNING_WITHOUT_DEMAND, 'Verdichterlauf ohne Bedarf');
        ensureBoolean(
            O.DEFROST_WITHOUT_RUNNING,
            'Abtauung bei stillstehendem Verdichter'
        );
        ensureBoolean(
            O.RUNNING_WITH_UNKNOWN_PRIORITY,
            'Verdichterlauf ohne bekannte Priorität'
        );
    }

    function readRaw(id) {
        if (!existsState(id)) {
            return { valid: false, value: null };
        }

        const state = getState(id);
        if (!state || state.val === undefined || state.val === null) {
            return { valid: false, value: null };
        }
        return { valid: true, value: state.val };
    }

    function readNumber(id) {
        const raw = readRaw(id);
        if (!raw.valid || raw.value === '') {
            return { valid: false, value: null };
        }

        const value = Number(raw.value);
        return {
            valid: Number.isFinite(value),
            value: Number.isFinite(value) ? value : null
        };
    }

    function readBoolean(id) {
        const raw = readRaw(id);
        if (!raw.valid) return { valid: false, value: null };

        const value = raw.value;

        if (
            value === true ||
            value === 1 ||
            value === '1' ||
            value === 'true'
        ) {
            return { valid: true, value: true };
        }

        if (
            value === false ||
            value === 0 ||
            value === '0' ||
            value === 'false'
        ) {
            return { valid: true, value: false };
        }

        return { valid: false, value: null };
    }

    function write(id, value) {
        if (!existsState(id)) {
            warn('Ausgangsdatenpunkt fehlt: ' + id);
            return false;
        }

        const state = getState(id);
        if (!state || state.val !== value) {
            setState(id, value, true);
        }
        return true;
    }


    function validateInputs() {
        const missingRequired = [];

        CONFIG.REQUIRED_INPUT_KEYS.forEach(function (key) {
            const id = CONFIG.INPUT[key];

            if (!existsState(id)) {
                missingRequired.push(key + ': ' + id);
            }
        });

        if (missingRequired.length > 0) {
            missingRequired.forEach(function (entry) {
                warn('Pflichteingang fehlt: ' + entry);
            });

            write(O.SYSTEM_ACTIVE, false);
            write(O.SYSTEM_STATUS, 'FEHLER');
            write(
                O.SYSTEM_LAST_MESSAGE,
                'Mindestens ein erforderlicher Eingangsdatenpunkt fehlt'
            );
            return false;
        }

        CONFIG.OPTIONAL_INPUT_KEYS.forEach(function (key) {
            const id = CONFIG.INPUT[key];

            if (!existsState(id)) {
                debug('Optionaler Eingang nicht vorhanden: ' + key + ': ' + id);
            }
        });

        return true;
    }

    function evaluate() {
        const frequency = readNumber(CONFIG.INPUT.VERDICHTERFREQUENZ);
        const demand = readBoolean(CONFIG.INPUT.VERDICHTERBEDARF);
        const heater = readBoolean(CONFIG.INPUT.VERDICHTER_ERWAERMER);
        const priority = readNumber(CONFIG.INPUT.PRIORITAET);
        const defrostRaw = readNumber(CONFIG.INPUT.ABTAUUNG);
        const power = readNumber(CONFIG.INPUT.VERDICHTERSTROM);

        const defrost = {
            valid: defrostRaw.valid,
            value: defrostRaw.valid
                ? defrostRaw.value === 1 || defrostRaw.value === 2
                : null
        };

        const essentialInputsValid =
            frequency.valid &&
            priority.valid &&
            defrost.valid &&
            power.valid;

        const compressorRunning =
            frequency.valid &&
            frequency.value >= CONFIG.THRESHOLDS.VERDICHTER_LAEUFT_AB_HZ;

        const compressorStopped =
            frequency.valid &&
            !compressorRunning;

        const priorityStandby =
            priority.valid &&
            priority.value === CONFIG.PRIORITIES.STANDBY;
        const priorityHotwater =
            priority.valid &&
            priority.value === CONFIG.PRIORITIES.BRAUCHWASSER;
        const priorityHeating =
            priority.valid &&
            priority.value === CONFIG.PRIORITIES.HEIZUNG;
        const priorityPool =
            priority.valid &&
            priority.value === CONFIG.PRIORITIES.POOL;
        const priorityCooling =
            priority.valid &&
            priority.value === CONFIG.PRIORITIES.KUEHLUNG;

        const priorityKnown =
            priorityStandby ||
            priorityHotwater ||
            priorityHeating ||
            priorityPool ||
            priorityCooling;

        const demandWhileStopped =
            essentialInputsValid &&
            demand.valid &&
            demand.value &&
            compressorStopped;

        const runningWithoutDemand =
            essentialInputsValid &&
            demand.valid &&
            compressorRunning &&
            !demand.value;

        const defrostWithoutRunning =
            essentialInputsValid &&
            defrost.value &&
            compressorStopped;

        const runningWithUnknownPriority =
            essentialInputsValid &&
            compressorRunning &&
            !priorityKnown;

        write(O.INPUT_FREQUENCY, frequency.valid ? frequency.value : 0);
        write(O.INPUT_STATUS, 0);
        write(O.INPUT_DEMAND, demand.valid ? demand.value : false);
        write(O.INPUT_HEATER, heater.valid ? heater.value : false);
        write(O.INPUT_PRIORITY, priority.valid ? priority.value : 0);
        write(O.INPUT_DEFROST, defrost.valid ? defrost.value : false);
        write(O.INPUT_POWER, power.valid ? power.value : 0);

        write(O.COMPRESSOR_RUNNING, compressorRunning);
        write(O.COMPRESSOR_STOPPED, compressorStopped);
        write(O.COMPRESSOR_DEMAND, demand.valid ? demand.value : false);
        write(O.COMPRESSOR_HEATER, heater.valid ? heater.value : false);
        write(O.DEFROST_ACTIVE, defrost.valid ? defrost.value : false);
        write(O.STATUS_VALID, false);
        write(O.POWER_VALID, power.valid);

        write(O.PRIORITY_STANDBY, priorityStandby);
        write(O.PRIORITY_HOTWATER, priorityHotwater);
        write(O.PRIORITY_HEATING, priorityHeating);
        write(O.PRIORITY_POOL, priorityPool);
        write(O.PRIORITY_COOLING, priorityCooling);
        write(O.PRIORITY_KNOWN, priorityKnown);

        write(O.SIGNALS_VALID, essentialInputsValid);
        write(O.DEMAND_WHILE_STOPPED, demandWhileStopped);
        write(O.RUNNING_WITHOUT_DEMAND, runningWithoutDemand);
        write(O.DEFROST_WITHOUT_RUNNING, defrostWithoutRunning);
        write(O.RUNNING_WITH_UNKNOWN_PRIORITY, runningWithUnknownPriority);

        write(O.SYSTEM_VERSION, CONFIG.VERSION);
        write(O.SYSTEM_LAST_UPDATE, timestamp());

        if (essentialInputsValid) {
            write(O.SYSTEM_STATUS, 'OK');
            write(
                O.SYSTEM_LAST_MESSAGE,
                'Prozesssignale gültig'
            );
        } else {
            write(O.SYSTEM_STATUS, 'STÖRUNG');
            write(
                O.SYSTEM_LAST_MESSAGE,
                'Mindestens ein erforderlicher Eingangswert ist ungültig'
            );
        }

        debug(
            'Läuft=' + compressorRunning +
            ', Bedarf=' +
            (demand.valid ? demand.value : 'optional/nicht verfügbar') +
            ', Erwärmer=' +
            (heater.valid ? heater.value : 'optional/nicht verfügbar') +
            ', Abtauung=' + (defrost.valid ? defrost.value : 'ungültig') +
            ', Priorität=' + (priority.valid ? priority.value : 'ungültig')
        );
    }

    function registerTriggers() {
        CONFIG.REQUIRED_INPUT_KEYS.forEach(function (key) {
            on(
                {
                    id: CONFIG.INPUT[key],
                    change: 'ne'
                },
                evaluate
            );
        });

        CONFIG.OPTIONAL_INPUT_KEYS.forEach(function (key) {
            const id = CONFIG.INPUT[key];

            if (existsState(id)) {
                on(
                    {
                        id: id,
                        change: 'ne'
                    },
                    evaluate
                );
            }
        });
    }

    function start() {
        createAllObjects();

        setTimeout(function () {
            write(O.SYSTEM_VERSION, CONFIG.VERSION);
            write(O.SYSTEM_ACTIVE, true);
            write(O.SYSTEM_STATUS, 'STARTET');
            write(O.SYSTEM_LAST_MESSAGE, 'Initialisierung läuft');

            if (!validateInputs()) return;

            registerTriggers();
            evaluate();

            started = true;
            info('Version ' + CONFIG.VERSION + ' gestartet');
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
        if (started && existsState(O.SYSTEM_ACTIVE)) {
            write(O.SYSTEM_ACTIVE, false);
            write(O.SYSTEM_STATUS, 'GESTOPPT');
            write(O.SYSTEM_LAST_MESSAGE, 'Modul wurde beendet');
        }
    }, 1000);

    start();
})();
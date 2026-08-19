/******************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               07_NPS_StateMachine
 * Datei:               07_NPS_StateMachine.js
 * Version:             1.2.0
 * Build:               2026-08-18
 * Modulstatus:         STABIL
 * Architektur-Schicht: Zustandsmodell / Prozesszustand
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Bildet aus den standardisierten ProcessSignals einen tabellengesteuerten,
 * persistenten fachlichen Verdichterzustand. Das Modul verwaltet Start- und
 * Stoppzeit sowie die Laufzeit des aktuellen Verdichtertakts.
 *
 * Das Modul kennt keine Modbus-Register und keine Alias-Datenpunkte. Es erzeugt
 * keine Ereignishistorie, Benachrichtigungen oder Langzeitstatistiken.
 *
 * Öffentliche Schnittstelle (Public API)
 * --------------------------------------
 *
 * Eingänge (nur lesend)
 * ---------------------
 * 0_userdata.0.NPS.ProcessSignals.Verdichter.*
 * 0_userdata.0.NPS.ProcessSignals.Betriebsart.*
 * 0_userdata.0.NPS.ProcessSignals.Plausibilitaet.SignaleGueltig
 *
 * Zustände
 * --------
 * STILLSTAND, VORWÄRMUNG, STARTANFORDERUNG, ANLAUF, HEIZBETRIEB,
 * BRAUCHWASSERBETRIEB, POOLBETRIEB, KÜHLBETRIEB, ABTAUUNG, AUSLAUF, STÖRUNG
 *
 * Trigger
 * -------
 * - Ereignisgesteuerte Auswertung bei Änderung eines ProcessSignals
 * - Zyklische Auswertung alle 10 Sekunden für zeitabhängige Übergänge
 * - Einmalige Auswertung nach erfolgreicher Initialisierung
 *
 * Abhängigkeiten
 * ---------------
 * - 06_NPS_ProcessSignals.js, exakt Version 1.1.1
 * - ioBroker JavaScript-Adapter
 *
 * Architekturregeln
 * -----------------
 * - Liest ausschließlich die Public API von ProcessSignals
 * - Single Writer für StateMachine.Current.*
 * - Persistiert nur den für Wiederanlauf erforderlichen Automatenkontext
 * - EventEngine und Analyse-Module konsumieren die veröffentlichten Zustände
 * - Keine Zusammenlegung mit ProcessSignals oder EventEngine
 *
 * Änderungsverlauf
 * ----------------
 * 1.1.2 | 2026-08-08
 *       | Betriebsart wird vor dem Zustandswechsel veröffentlicht. Dadurch
 *       | liest die EventEngine beim Ereignis VERDICHTER_GESTARTET bereits
 *       | die zum Zyklusstart gültige Betriebsart (z. B. BRAUCHWASSER).
 * 1.1.1 | 2026-07-30
 *       | Korrektur der Zyklusende-Erkennung: Der Übergang von AUSLAUF
 *       | nach STILLSTAND wird nach Ablauf der Auslaufzeit allein durch
 *       | den tatsächlich stehenden Verdichter ausgelöst. Ein weiterhin
 *       | anliegender Bedarf verhindert das Zyklusende nicht mehr.
 *       | Ein neuer Bedarf wird anschließend aus STILLSTAND regulär als
 *       | STARTANFORDERUNG bzw. ANLAUF verarbeitet.
 * 1.1.0 | 2026-07-26
 *       | Abhängigkeit auf ProcessSignals 1.1.0 aktualisiert.
 *       | Die StateMachine bleibt alleinige fachliche Quelle für
 *       | StateMachine.Current.State und OperatingMode.
 *       | Rohwerte eines nicht verifizierten Verdichterstatusregisters
 *       | werden nicht verwendet.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Public API, Zustandsmodell,
 *       | Trigger, Abhängigkeiten und Modulgrenzen dokumentiert.
 *       | Abhängigkeit auf ProcessSignals 1.0.1 synchronisiert.
 *       | Keine Änderung der Zustands- oder Übergangslogik.
 * 1.0.0 | 2026-07-14
 *       | Produktive Erstversion.
 * *
 * Korrektur 2026-08-18
 * - Public API nach Restore des persistenten StateMachine-Zustands sofort initialisiert.
*****************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '1.2.0',
        REQUIRED_PROCESS_SIGNALS_VERSION: '1.1.1',
        DEBUG: false,

        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.StateMachine',
        ROOT_SIGNALS: '0_userdata.0.NPS.ProcessSignals',

        ANLAUF_DAUER_SEKUNDEN: 120,
        AUSLAUF_DAUER_SEKUNDEN: 60,
        AKTUALISIERUNG_SEKUNDEN: 10,
        STATE_CREATE_DELAY_MS: 1000
    };

    const INPUT = {
        VERDICHTER_LAEUFT:
            CONFIG.ROOT_SIGNALS + '.Verdichter.Laeuft',

        VERDICHTER_STEHT:
            CONFIG.ROOT_SIGNALS + '.Verdichter.Steht',

        BEDARF_AKTIV:
            CONFIG.ROOT_SIGNALS + '.Verdichter.BedarfAktiv',

        ERWAERMER_AKTIV:
            CONFIG.ROOT_SIGNALS + '.Verdichter.ErwaermerAktiv',

        ABTAUUNG_AKTIV:
            CONFIG.ROOT_SIGNALS + '.Verdichter.AbtauungAktiv',

        PRIORITAET_STANDBY:
            CONFIG.ROOT_SIGNALS + '.Betriebsart.Standby',

        PRIORITAET_BRAUCHWASSER:
            CONFIG.ROOT_SIGNALS + '.Betriebsart.Brauchwasser',

        PRIORITAET_HEIZUNG:
            CONFIG.ROOT_SIGNALS + '.Betriebsart.Heizung',

        PRIORITAET_POOL:
            CONFIG.ROOT_SIGNALS + '.Betriebsart.Pool',

        PRIORITAET_KUEHLUNG:
            CONFIG.ROOT_SIGNALS + '.Betriebsart.Kuehlung',

        PRIORITAET_BEKANNT:
            CONFIG.ROOT_SIGNALS + '.Betriebsart.Bekannt',

        SIGNALE_GUELTIG:
            CONFIG.ROOT_SIGNALS + '.Plausibilitaet.SignaleGueltig'
    };

    const OUTPUT = {
        ZUSTAND:
            CONFIG.ROOT + '.Current.State',

        BETRIEBSART:
            CONFIG.ROOT + '.Current.OperatingMode',

        STARTZEIT:
            CONFIG.ROOT + '.Current.StartTime',

        STOPPZEIT:
            CONFIG.ROOT + '.Current.StopTime',

        LAUFZEIT:
            CONFIG.ROOT + '.Current.Runtime'
    };

    const STATES = Object.freeze({
        STILLSTAND: 'STILLSTAND',
        VORWAERMUNG: 'VORWÄRMUNG',
        STARTANFORDERUNG: 'STARTANFORDERUNG',
        ANLAUF: 'ANLAUF',
        HEIZBETRIEB: 'HEIZBETRIEB',
        BRAUCHWASSERBETRIEB: 'BRAUCHWASSERBETRIEB',
        POOLBETRIEB: 'POOLBETRIEB',
        KUEHLBETRIEB: 'KÜHLBETRIEB',
        ABTAUUNG: 'ABTAUUNG',
        AUSLAUF: 'AUSLAUF',
        STOERUNG: 'STÖRUNG'
    });

    const RUNNING_STATES = [
        STATES.ANLAUF,
        STATES.HEIZBETRIEB,
        STATES.BRAUCHWASSERBETRIEB,
        STATES.POOLBETRIEB,
        STATES.KUEHLBETRIEB,
        STATES.ABTAUUNG
    ];

    const memory = {
        currentState: null,
        stateSinceMs: null,
        cycleStartMs: null,
        cycleStopMs: null
    };

    let started = false;
    let scheduleHandle = null;

    function info(message) {
        log('[NPS StateMachine] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS StateMachine] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS StateMachine DEBUG] ' + message, 'info');
        }
    }

    function dp(path) {
        return CONFIG.ROOT + '.' + path;
    }

    function exists(id) {
        return existsState(id) || existsObject(id);
    }

    function nowText() {
        return new Date().toLocaleString('de-DE');
    }

    function readBoolean(id) {
        const state = getState(id);

        if (!state || state.val === undefined || state.val === null) {
            return null;
        }

        if (
            state.val === true ||
            state.val === 1 ||
            state.val === '1' ||
            state.val === 'true'
        ) {
            return true;
        }

        if (
            state.val === false ||
            state.val === 0 ||
            state.val === '0' ||
            state.val === 'false'
        ) {
            return false;
        }

        return null;
    }

    function readNumber(id) {
        const state = getState(id);

        if (
            !state ||
            state.val === undefined ||
            state.val === null ||
            state.val === ''
        ) {
            return null;
        }

        const value = Number(state.val);
        return Number.isFinite(value) ? value : null;
    }

    function writeId(id, value) {
        if (!existsState(id)) {
            warn('Ausgangsdatenpunkt fehlt: ' + id);
            return false;
        }

        const current = getState(id);

        if (!current || current.val !== value) {
            setState(id, value, true);
        }

        return true;
    }

    function write(path, value) {
        return writeId(dp(path), value);
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

    function ensureState(path, initialValue, type, role, name, unit) {
        const id = dp(path);

        if (exists(id)) return;

        const common = {
            name: name,
            type: type,
            role: role,
            read: true,
            write: false
        };

        if (unit !== undefined) {
            common.unit = unit;
        }

        createState(id, initialValue, common);
    }

    function ensureString(path, name, role) {
        ensureState(path, '', 'string', role || 'text', name);
    }

    function ensureBoolean(path, name) {
        ensureState(path, false, 'boolean', 'indicator', name);
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

    function createAllObjects() {
        ensureFolder(CONFIG.ROOT, 'NPS StateMachine');

        ensureChannel(dp('System'), 'System');
        ensureChannel(dp('Memory'), 'Persistenter Arbeitsspeicher');
        ensureChannel(dp('Diagnostics'), 'Diagnose');
        ensureChannel(dp('Current'), 'Aktueller Prozesszustand');

        ensureString('System.Version', 'Modulversion');
        ensureBoolean('System.Active', 'Modul aktiv');
        ensureString('System.Status', 'Modulstatus');
        ensureString('System.LastStart', 'Letzter Modulstart', 'date');
        ensureString('System.LastUpdate', 'Letzte Aktualisierung', 'date');
        ensureString('System.LastMessage', 'Letzte Meldung');

        ensureString('Current.State', 'Aktueller Anlagenzustand');
        ensureString('Current.OperatingMode', 'Aktuelle Betriebsart');
        ensureString('Current.StartTime', 'Startzeit des aktuellen Verdichtertakts', 'date');
        ensureString('Current.StopTime', 'Stoppzeit des letzten Verdichtertakts', 'date');
        ensureNumber('Current.Runtime', 'Laufzeit des aktuellen Verdichtertakts', 's', 'value.interval');

        ensureString('Memory.CurrentState', 'Aktueller gespeicherter Zustand');
        ensureNumber(
            'Memory.StateSinceMs',
            'Zustand aktiv seit Unix-Zeit',
            'ms',
            'value.time'
        );
        ensureNumber(
            'Memory.CycleStartMs',
            'Aktueller Taktstart als Unix-Zeit',
            'ms',
            'value.time'
        );
        ensureNumber(
            'Memory.CycleStopMs',
            'Letzter Taktstopp als Unix-Zeit',
            'ms',
            'value.time'
        );

        ensureString('Diagnostics.PreviousState', 'Vorheriger Zustand');
        ensureString('Diagnostics.LastTransition', 'Letzter Zustandswechsel');
        ensureNumber('Diagnostics.TransitionCount', 'Anzahl Zustandswechsel');
        ensureBoolean('Diagnostics.SignalsReadable', 'Signale lesbar');
        ensureString('Diagnostics.Warning', 'Warnung');
        ensureString('Diagnostics.Trace', 'Diagnosetrace');
    }

    function formatDateTime(timestampMs) {
        return new Date(timestampMs).toLocaleString('de-DE');
    }

    function isRunningState(state) {
        return RUNNING_STATES.includes(state);
    }

    function secondsInCurrentState(nowMs) {
        if (memory.stateSinceMs === null) {
            return 0;
        }

        return Math.floor((nowMs - memory.stateSinceMs) / 1000);
    }

    function readSignals() {
        return {
            verdichterLaeuft: readBoolean(INPUT.VERDICHTER_LAEUFT),
            verdichterSteht: readBoolean(INPUT.VERDICHTER_STEHT),
            bedarfAktiv: readBoolean(INPUT.BEDARF_AKTIV),
            erwaermerAktiv: readBoolean(INPUT.ERWAERMER_AKTIV),
            abtauungAktiv: readBoolean(INPUT.ABTAUUNG_AKTIV),
            prioritaetStandby: readBoolean(INPUT.PRIORITAET_STANDBY),
            prioritaetBrauchwasser: readBoolean(INPUT.PRIORITAET_BRAUCHWASSER),
            prioritaetHeizung: readBoolean(INPUT.PRIORITAET_HEIZUNG),
            prioritaetPool: readBoolean(INPUT.PRIORITAET_POOL),
            prioritaetKuehlung: readBoolean(INPUT.PRIORITAET_KUEHLUNG),
            prioritaetBekannt: readBoolean(INPUT.PRIORITAET_BEKANNT),
            signaleGueltig: readBoolean(INPUT.SIGNALE_GUELTIG)
        };
    }

    function allRequiredSignalsReadable(signal) {
        return (
            signal.verdichterLaeuft !== null &&
            signal.verdichterSteht !== null &&
            signal.bedarfAktiv !== null &&
            signal.erwaermerAktiv !== null &&
            signal.abtauungAktiv !== null &&
            signal.prioritaetBekannt !== null &&
            signal.signaleGueltig !== null
        );
    }

    function getOperatingState(signal) {
        if (signal.prioritaetBrauchwasser === true) {
            return STATES.BRAUCHWASSERBETRIEB;
        }

        if (signal.prioritaetHeizung === true) {
            return STATES.HEIZBETRIEB;
        }

        if (signal.prioritaetPool === true) {
            return STATES.POOLBETRIEB;
        }

        if (signal.prioritaetKuehlung === true) {
            return STATES.KUEHLBETRIEB;
        }

        return STATES.ANLAUF;
    }

    function getOperatingMode(signal) {
        if (signal.abtauungAktiv === true) return 'ABTAUUNG';
        if (signal.prioritaetBrauchwasser === true) return 'BRAUCHWASSER';
        if (signal.prioritaetHeizung === true) return 'HEIZUNG';
        if (signal.prioritaetPool === true) return 'POOL';
        if (signal.prioritaetKuehlung === true) return 'KÜHLUNG';
        if (signal.prioritaetStandby === true) return 'STANDBY';
        return 'UNBEKANNT';
    }

    const TRANSITIONS = [
        {
            from: '*',
            to: STATES.STOERUNG,
            when: function (signal) {
                return (
                    !allRequiredSignalsReadable(signal) ||
                    signal.signaleGueltig !== true
                );
            }
        },
        {
            from: '*',
            to: STATES.ABTAUUNG,
            when: function (signal) {
                return (
                    signal.abtauungAktiv === true &&
                    signal.verdichterLaeuft === true
                );
            }
        },
        {
            from: STATES.STILLSTAND,
            to: STATES.VORWAERMUNG,
            when: function (signal) {
                return signal.erwaermerAktiv === true;
            }
        },
        {
            from: STATES.STILLSTAND,
            to: STATES.STARTANFORDERUNG,
            when: function (signal) {
                return (
                    signal.bedarfAktiv === true &&
                    signal.verdichterSteht === true
                );
            }
        },
        {
            from: STATES.STILLSTAND,
            to: STATES.ANLAUF,
            when: function (signal) {
                return signal.verdichterLaeuft === true;
            }
        },
        {
            from: STATES.VORWAERMUNG,
            to: STATES.STARTANFORDERUNG,
            when: function (signal) {
                return signal.bedarfAktiv === true;
            }
        },
        {
            from: STATES.VORWAERMUNG,
            to: STATES.STILLSTAND,
            when: function (signal) {
                return (
                    signal.erwaermerAktiv === false &&
                    signal.bedarfAktiv === false &&
                    signal.verdichterSteht === true
                );
            }
        },
        {
            from: STATES.STARTANFORDERUNG,
            to: STATES.ANLAUF,
            when: function (signal) {
                return signal.verdichterLaeuft === true;
            }
        },
        {
            from: STATES.STARTANFORDERUNG,
            to: STATES.VORWAERMUNG,
            when: function (signal) {
                return (
                    signal.bedarfAktiv === false &&
                    signal.erwaermerAktiv === true
                );
            }
        },
        {
            from: STATES.STARTANFORDERUNG,
            to: STATES.STILLSTAND,
            when: function (signal) {
                return (
                    signal.bedarfAktiv === false &&
                    signal.erwaermerAktiv === false &&
                    signal.verdichterSteht === true
                );
            }
        },
        {
            from: STATES.ANLAUF,
            to: 'BETRIEBSZUSTAND',
            when: function (signal, nowMs) {
                return (
                    signal.verdichterLaeuft === true &&
                    secondsInCurrentState(nowMs) >=
                        CONFIG.ANLAUF_DAUER_SEKUNDEN
                );
            }
        },
        {
            from: STATES.ANLAUF,
            to: STATES.AUSLAUF,
            when: function (signal) {
                return signal.verdichterSteht === true;
            }
        },
        {
            from: STATES.HEIZBETRIEB,
            to: 'BETRIEBSZUSTAND',
            when: function (signal) {
                return (
                    signal.verdichterLaeuft === true &&
                    signal.prioritaetHeizung !== true
                );
            }
        },
        {
            from: STATES.BRAUCHWASSERBETRIEB,
            to: 'BETRIEBSZUSTAND',
            when: function (signal) {
                return (
                    signal.verdichterLaeuft === true &&
                    signal.prioritaetBrauchwasser !== true
                );
            }
        },
        {
            from: STATES.POOLBETRIEB,
            to: 'BETRIEBSZUSTAND',
            when: function (signal) {
                return (
                    signal.verdichterLaeuft === true &&
                    signal.prioritaetPool !== true
                );
            }
        },
        {
            from: STATES.KUEHLBETRIEB,
            to: 'BETRIEBSZUSTAND',
            when: function (signal) {
                return (
                    signal.verdichterLaeuft === true &&
                    signal.prioritaetKuehlung !== true
                );
            }
        },
        {
            from: STATES.HEIZBETRIEB,
            to: STATES.AUSLAUF,
            when: function (signal) {
                return signal.verdichterSteht === true;
            }
        },
        {
            from: STATES.BRAUCHWASSERBETRIEB,
            to: STATES.AUSLAUF,
            when: function (signal) {
                return signal.verdichterSteht === true;
            }
        },
        {
            from: STATES.POOLBETRIEB,
            to: STATES.AUSLAUF,
            when: function (signal) {
                return signal.verdichterSteht === true;
            }
        },
        {
            from: STATES.KUEHLBETRIEB,
            to: STATES.AUSLAUF,
            when: function (signal) {
                return signal.verdichterSteht === true;
            }
        },
        {
            from: STATES.ABTAUUNG,
            to: 'BETRIEBSZUSTAND',
            when: function (signal) {
                return (
                    signal.abtauungAktiv === false &&
                    signal.verdichterLaeuft === true
                );
            }
        },
        {
            from: STATES.ABTAUUNG,
            to: STATES.AUSLAUF,
            when: function (signal) {
                return (
                    signal.abtauungAktiv === false &&
                    signal.verdichterSteht === true
                );
            }
        },
        {
            from: STATES.AUSLAUF,
            to: STATES.STILLSTAND,
            when: function (signal, nowMs) {
                /*
                 * Das physische Zyklusende ist erreicht, sobald der
                 * Verdichter tatsächlich steht und die definierte
                 * Auslaufzeit abgelaufen ist.
                 *
                 * Ein weiterhin anliegender Bedarf darf diesen Übergang
                 * nicht blockieren. Andernfalls würden weder ein sauberer
                 * Taktabschluss noch das Ereignis VERDICHTER_GESTOPPT
                 * entstehen. Ein neuer Bedarf wird in der folgenden
                 * Auswertung aus STILLSTAND weiterverarbeitet.
                 */
                return (
                    signal.verdichterSteht === true &&
                    secondsInCurrentState(nowMs) >=
                        CONFIG.AUSLAUF_DAUER_SEKUNDEN
                );
            }
        },
        {
            from: STATES.AUSLAUF,
            to: STATES.STARTANFORDERUNG,
            when: function (signal) {
                return (
                    signal.verdichterSteht === true &&
                    signal.bedarfAktiv === true
                );
            }
        },
        {
            from: STATES.AUSLAUF,
            to: STATES.ANLAUF,
            when: function (signal) {
                return signal.verdichterLaeuft === true;
            }
        },
        {
            from: STATES.STOERUNG,
            to: 'INITIAL',
            when: function (signal) {
                return (
                    allRequiredSignalsReadable(signal) &&
                    signal.signaleGueltig === true
                );
            }
        }
    ];

    function resolveTarget(target, signal) {
        if (target === 'BETRIEBSZUSTAND') {
            return getOperatingState(signal);
        }

        if (target === 'INITIAL') {
            return determineInitialState(signal);
        }

        return target;
    }

    function determineInitialState(signal) {
        if (
            !allRequiredSignalsReadable(signal) ||
            signal.signaleGueltig !== true
        ) {
            return STATES.STOERUNG;
        }

        if (
            signal.abtauungAktiv === true &&
            signal.verdichterLaeuft === true
        ) {
            return STATES.ABTAUUNG;
        }

        if (signal.verdichterLaeuft === true) {
            return getOperatingState(signal);
        }

        if (
            signal.bedarfAktiv === true &&
            signal.verdichterSteht === true
        ) {
            return STATES.STARTANFORDERUNG;
        }

        if (signal.erwaermerAktiv === true) {
            return STATES.VORWAERMUNG;
        }

        return STATES.STILLSTAND;
    }

    function findNextState(signal, nowMs) {
        for (let index = 0; index < TRANSITIONS.length; index++) {
            const transition = TRANSITIONS[index];

            if (
                transition.from !== '*' &&
                transition.from !== memory.currentState
            ) {
                continue;
            }

            if (transition.when(signal, nowMs)) {
                return resolveTarget(transition.to, signal);
            }
        }

        return memory.currentState;
    }

    function restoreMemory() {
        const storedState = getState(dp('Memory.CurrentState'));
        const storedStateSinceMs = readNumber(dp('Memory.StateSinceMs'));
        const storedCycleStartMs = readNumber(dp('Memory.CycleStartMs'));
        const storedCycleStopMs = readNumber(dp('Memory.CycleStopMs'));

        if (
            storedState &&
            typeof storedState.val === 'string' &&
            Object.values(STATES).includes(storedState.val)
        ) {
            memory.currentState = storedState.val;
        }

        memory.stateSinceMs =
            storedStateSinceMs && storedStateSinceMs > 0
                ? storedStateSinceMs
                : null;

        memory.cycleStartMs =
            storedCycleStartMs && storedCycleStartMs > 0
                ? storedCycleStartMs
                : null;

        memory.cycleStopMs =
            storedCycleStopMs && storedCycleStopMs > 0
                ? storedCycleStopMs
                : null;
    }

    function publishRestoredCurrent(nowMs) {
        /*
         * Nach einem Script-Neustart wird der persistierte Zustand aus
         * Memory.* wiederhergestellt. Da changeState() bei unverändertem
         * Zustand bewusst nichts schreibt, muss die Public API hier einmal
         * explizit initialisiert werden.
         */
        writeId(
            OUTPUT.ZUSTAND,
            memory.currentState || ''
        );

        writeId(
            OUTPUT.STARTZEIT,
            memory.cycleStartMs !== null
                ? formatDateTime(memory.cycleStartMs)
                : ''
        );

        writeId(
            OUTPUT.STOPPZEIT,
            memory.cycleStopMs !== null
                ? formatDateTime(memory.cycleStopMs)
                : ''
        );

        if (
            memory.cycleStartMs !== null &&
            isRunningState(memory.currentState)
        ) {
            writeId(
                OUTPUT.LAUFZEIT,
                Math.max(
                    0,
                    Math.floor((nowMs - memory.cycleStartMs) / 1000)
                )
            );
        } else {
            writeId(OUTPUT.LAUFZEIT, 0);
        }
    }

    function persistMemory() {
        write('Memory.CurrentState', memory.currentState || '');
        write('Memory.StateSinceMs', memory.stateSinceMs || 0);
        write('Memory.CycleStartMs', memory.cycleStartMs || 0);
        write('Memory.CycleStopMs', memory.cycleStopMs || 0);
    }

    function incrementTransitionCount() {
        const current = readNumber(dp('Diagnostics.TransitionCount'));
        write(
            'Diagnostics.TransitionCount',
            (current === null ? 0 : current) + 1
        );
    }

    function changeState(nextState, nowMs) {
        const previousState = memory.currentState;

        if (previousState === nextState) {
            return;
        }

        const wasRunning = isRunningState(previousState);
        const isRunning = isRunningState(nextState);

        memory.currentState = nextState;
        memory.stateSinceMs = nowMs;

        if (!wasRunning && isRunning) {
            memory.cycleStartMs = nowMs;
            memory.cycleStopMs = null;

            writeId(OUTPUT.STARTZEIT, formatDateTime(nowMs));
            writeId(OUTPUT.LAUFZEIT, 0);
        }

        if (wasRunning && !isRunning) {
            memory.cycleStopMs = nowMs;
            writeId(OUTPUT.STOPPZEIT, formatDateTime(nowMs));
        }

        writeId(OUTPUT.ZUSTAND, nextState);
        write('Diagnostics.PreviousState', previousState || '');
        write(
            'Diagnostics.LastTransition',
            (previousState || 'NICHT_INITIALISIERT') +
            ' -> ' +
            nextState +
            ' @ ' +
            formatDateTime(nowMs)
        );
        incrementTransitionCount();
        persistMemory();

        debug(
            'Zustandswechsel: ' +
            (previousState || 'NICHT_INITIALISIERT') +
            ' -> ' +
            nextState
        );
    }

    function updateRuntime(nowMs) {
        if (
            memory.cycleStartMs !== null &&
            isRunningState(memory.currentState)
        ) {
            writeId(
                OUTPUT.LAUFZEIT,
                Math.floor((nowMs - memory.cycleStartMs) / 1000)
            );
        }
    }

    function writeTrace(signal, operatingMode) {
        write(
            'Diagnostics.Trace',
            nowText() +
            '\nZustand=' + memory.currentState +
            '\nBetriebsart=' + operatingMode +
            '\nLäuft=' + signal.verdichterLaeuft +
            '\nSteht=' + signal.verdichterSteht +
            '\nBedarf=' + signal.bedarfAktiv +
            '\nErwärmer=' + signal.erwaermerAktiv +
            '\nAbtauung=' + signal.abtauungAktiv +
            '\nSignale gültig=' + signal.signaleGueltig
        );
    }

    function evaluate() {
        const nowMs = Date.now();
        const signal = readSignals();
        const readable = allRequiredSignalsReadable(signal);

        write('Diagnostics.SignalsReadable', readable);

        /*
         * Betriebsart vor dem Zustandswechsel veröffentlichen.
         * Die EventEngine reagiert unmittelbar auf OUTPUT.ZUSTAND.
         * Dadurch steht ihr beim Ereignis bereits die aktuelle
         * Betriebsart des neuen Zyklus zur Verfügung.
         */
        const operatingMode = getOperatingMode(signal);
        writeId(OUTPUT.BETRIEBSART, operatingMode);

        if (memory.currentState === null) {
            changeState(
                determineInitialState(signal),
                nowMs
            );
        } else {
            changeState(
                findNextState(signal, nowMs),
                nowMs
            );
        }
        updateRuntime(nowMs);
        persistMemory();

        write('System.LastUpdate', nowText());

        if (memory.currentState === STATES.STOERUNG) {
            write('System.Status', 'STÖRUNG');
            write(
                'System.LastMessage',
                'Prozesssignale sind ungültig oder widersprüchlich'
            );
            write(
                'Diagnostics.Warning',
                'Zustandsmaschine befindet sich im Zustand STÖRUNG'
            );
        } else {
            write('System.Status', 'BEREIT');
            write(
                'System.LastMessage',
                'Zustand ' +
                memory.currentState +
                ', Betriebsart ' +
                operatingMode
            );
            write('Diagnostics.Warning', '');
        }

        writeTrace(signal, operatingMode);
    }


    function validateDependencies() {
        const processSignalsVersionId =
            CONFIG.ROOT_SIGNALS + '.System.Version';

        if (!existsState(processSignalsVersionId)) {
            warn(
                'Start abgebrochen. 06_NPS_ProcessSignals v' +
                CONFIG.REQUIRED_PROCESS_SIGNALS_VERSION +
                ' fehlt.'
            );
            return false;
        }

        const processSignalsVersion =
            String(getState(processSignalsVersionId).val || '');

        if (
            processSignalsVersion !==
            CONFIG.REQUIRED_PROCESS_SIGNALS_VERSION
        ) {
            warn(
                'ProcessSignals-Version ist ' +
                processSignalsVersion +
                ', erwartet wird ' +
                CONFIG.REQUIRED_PROCESS_SIGNALS_VERSION +
                '.'
            );
            return false;
        }

        const missing = [];
        Object.keys(INPUT).forEach(function (key) {
            if (!existsState(INPUT[key])) {
                missing.push('Eingang ' + key + ': ' + INPUT[key]);
            }
        });

        if (missing.length > 0) {
            missing.forEach(warn);
            return false;
        }

        return true;
    }

    function registerTriggers() {
        Object.keys(INPUT).forEach(function (key) {
            on(
                {
                    id: INPUT[key],
                    change: 'ne'
                },
                evaluate
            );
        });
    }

    function start() {
        createAllObjects();

        setTimeout(function () {
            if (!validateDependencies()) {
                write('System.Active', false);
                write('System.Status', 'STÖRUNG');
                write('System.LastMessage', 'Abhängigkeiten nicht erfüllt');
                return;
            }

            write('System.Version', CONFIG.VERSION);
            write('System.Active', true);
            write('System.Status', 'STARTET');
            write('System.LastStart', nowText());
            write('System.LastMessage', 'Initialisierung läuft');

            restoreMemory();
            publishRestoredCurrent(Date.now());
            registerTriggers();

            scheduleHandle = schedule(
                '*/' +
                CONFIG.AKTUALISIERUNG_SEKUNDEN +
                ' * * * * *',
                evaluate
            );

            evaluate();

            started = true;
            info('Version ' + CONFIG.VERSION + ' gestartet');
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
        if (scheduleHandle !== null) {
            clearSchedule(scheduleHandle);
            scheduleHandle = null;
        }

        persistMemory();

        if (started && existsState(dp('System.Active'))) {
            write('System.Active', false);
            write('System.Status', 'GESTOPPT');
            write('System.LastMessage', 'Modul wurde beendet');
        }
    }, 1000);

    start();
})();
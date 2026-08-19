/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               08_NPS_EventEngine
 * Datei:               08_NPS_EventEngine.js
 * Version:             1.2.0
 * Build:               2026-08-18
 * Modulstatus:         STABIL
 * Architektur-Schicht: Ereignismodell / Event-Publishing
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Übersetzt tatsächliche Zustandswechsel der StateMachine in standardisierte,
 * strukturierte NPS-Ereignisse. Das Modul veröffentlicht den jeweils letzten
 * Ereignisdatensatz und signalisiert dessen Vollständigkeit über eine zuletzt
 * geschriebene, monoton steigende Sequenznummer.
 *
 * Das Modul berechnet keine Betriebsstatistiken, versendet keine Meldungen und
 * führt keine Ereignishistorie. Nachgelagerte Module konsumieren ausschließlich
 * die Public API unter NPS.Events.
 *
 * Öffentliche Schnittstelle (Public API)
 * --------------------------------------
 * 0_userdata.0.NPS.Events.Verdichter.Sequenz
 * 0_userdata.0.NPS.Events.Verdichter.EreignisId
 * 0_userdata.0.NPS.Events.Verdichter.Typ
 * 0_userdata.0.NPS.Events.Verdichter.Titel
 * 0_userdata.0.NPS.Events.Verdichter.Nachricht
 * 0_userdata.0.NPS.Events.Verdichter.Kritikalitaet
 * 0_userdata.0.NPS.Events.Verdichter.Zeitstempel
 * 0_userdata.0.NPS.Events.Verdichter.ZustandVorher
 * 0_userdata.0.NPS.Events.Verdichter.ZustandAktuell
 * 0_userdata.0.NPS.Events.Verdichter.Betriebsart
 * 0_userdata.0.NPS.Events.Verdichter.Startzeit
 * 0_userdata.0.NPS.Events.Verdichter.Stoppzeit
 * 0_userdata.0.NPS.Events.Verdichter.Laufzeit
 * 0_userdata.0.NPS.Events.Verdichter.Nutzdaten
 *
 * Eingänge (nur lesend)
 * ---------------------
 *
 * Trigger und Publikationsvertrag
 * --------------------------------
 * - Ein reales change: ne auf StateMachine.Current.State erzeugt ein Ereignis.
 * - Beim Modulstart wird bewusst kein rückwirkendes Ereignis erzeugt.
 * - Sämtliche Ereignisfelder und Diagnosedaten werden zuerst geschrieben.
 * - Verdichter.Sequenz wird als Commit-/Trigger-Signal absichtlich zuletzt erhöht.
 *
 * Abhängigkeiten
 * ---------------
 * - 07_NPS_StateMachine.js, exakt Version 1.2.0
 * - ioBroker JavaScript-Adapter
 *
 * Architekturregeln
 * -----------------
 * - Liest ausschließlich die Public API der StateMachine unter NPS.StateMachine.Current
 * - Single Writer für den vollständigen Bereich NPS.Events
 * - Keine Zustandsentscheidung, Statistik, Historisierung oder Benachrichtigung
 * - Sequenznummer ist die verbindliche Synchronisationsgrenze für Konsumenten
 * - Keine Zusammenlegung mit StateMachine oder NotificationBridge
 *
 * Änderungsverlauf
 * ----------------
 * 1.1.2 | 2026-08-08
 *       | Robuste Zustandsauswertung ergänzt.
 *       | Numerische/ungültige Zwischenwerte der StateMachine-Public-API
 *       | werden ignoriert und nicht mehr als Zustandswechsel bewertet.
 *       | Die EventEngine merkt sich den letzten gültigen semantischen
 *       | Verdichterzustand und bildet Übergänge ausschließlich zwischen
 *       | gültigen NPS-Zuständen.
 *       | Dadurch werden z. B. 20/40/60 nicht mehr zwischen ANLAUF und
 *       | BRAUCHWASSERBETRIEB geschoben und echte Zyklusereignisse bleiben erhalten.
 * 1.1.1 | 2026-08-08
 *       | Abhängigkeit auf StateMachine 1.1.2 aktualisiert. Damit wird beim
 *       | Zyklusstart die bereits vor dem Zustandswechsel veröffentlichte
 *       | Betriebsart zuverlässig in das Ereignis übernommen.
 * 1.1.0 | 2026-07-26
 *       | Abhängigkeit auf StateMachine 1.1.0 aktualisiert.
 *       | Zustandsereignisse werden zusätzlich gegen den verbindlichen
 *       | StateMachine-Zustandskatalog validiert. Numerische Rohwerte wie
 *       | 20 werden nicht als Verdichterzustand veröffentlicht.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Public API, Ereigniskatalog,
 *       | Trigger, Publikationsvertrag, Abhängigkeiten und Modulgrenzen
 *       | dokumentiert. Abhängigkeit auf StateMachine 1.0.1 synchronisiert.
 *       | Keine Änderung der Ereignisdefinitionen oder Publikationslogik.
 * 1.0.0 | 2026-07-14
 *       | Produktive Erstversion.
 ****************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '1.2.0',
        REQUIRED_STATE_MACHINE_VERSION: '1.2.0',
        DEBUG: false,

        ROOT_STATE_MACHINE: '0_userdata.0.NPS.StateMachine',
        ROOT_EVENTS: '0_userdata.0.NPS.Events',

        DOMAIN: 'nibe',
        SOURCE: '08_NPS_EventEngine',
        STATE_CREATE_DELAY_MS: 1000
    };

    const INPUT = {
        ZUSTAND:
            CONFIG.ROOT_STATE_MACHINE + '.Current.State',

        BETRIEBSART:
            CONFIG.ROOT_STATE_MACHINE + '.Current.OperatingMode',

        STARTZEIT:
            CONFIG.ROOT_STATE_MACHINE + '.Current.StartTime',

        STOPPZEIT:
            CONFIG.ROOT_STATE_MACHINE + '.Current.StopTime',

        LAUFZEIT:
            CONFIG.ROOT_STATE_MACHINE + '.Current.Runtime'
    };

    const OUTPUT = {
        SYSTEM_VERSION:
            CONFIG.ROOT_EVENTS + '.System.Version',

        SYSTEM_ACTIVE:
            CONFIG.ROOT_EVENTS + '.System.Aktiv',

        SYSTEM_STATUS:
            CONFIG.ROOT_EVENTS + '.System.Status',

        SYSTEM_LAST_START:
            CONFIG.ROOT_EVENTS + '.System.LetzterStart',

        SYSTEM_LAST_UPDATE:
            CONFIG.ROOT_EVENTS + '.System.LetzteAktualisierung',

        SYSTEM_LAST_MESSAGE:
            CONFIG.ROOT_EVENTS + '.System.LetzteMeldung',

        SEQUENZ:
            CONFIG.ROOT_EVENTS + '.Verdichter.Sequenz',

        EREIGNIS_ID:
            CONFIG.ROOT_EVENTS + '.Verdichter.EreignisId',

        TYP:
            CONFIG.ROOT_EVENTS + '.Verdichter.Typ',

        TITEL:
            CONFIG.ROOT_EVENTS + '.Verdichter.Titel',

        NACHRICHT:
            CONFIG.ROOT_EVENTS + '.Verdichter.Nachricht',

        KRITIKALITAET:
            CONFIG.ROOT_EVENTS + '.Verdichter.Kritikalitaet',

        ZEITSTEMPEL:
            CONFIG.ROOT_EVENTS + '.Verdichter.Zeitstempel',

        ZUSTAND_VORHER:
            CONFIG.ROOT_EVENTS + '.Verdichter.ZustandVorher',

        ZUSTAND_AKTUELL:
            CONFIG.ROOT_EVENTS + '.Verdichter.ZustandAktuell',

        BETRIEBSART:
            CONFIG.ROOT_EVENTS + '.Verdichter.Betriebsart',

        STARTZEIT:
            CONFIG.ROOT_EVENTS + '.Verdichter.Startzeit',

        STOPPZEIT:
            CONFIG.ROOT_EVENTS + '.Verdichter.Stoppzeit',

        LAUFZEIT:
            CONFIG.ROOT_EVENTS + '.Verdichter.Laufzeit',

        NUTZDATEN:
            CONFIG.ROOT_EVENTS + '.Verdichter.Nutzdaten',

        DIAG_EVENT_COUNT:
            CONFIG.ROOT_EVENTS + '.Diagnostics.EventCount',

        DIAG_LAST_TYPE:
            CONFIG.ROOT_EVENTS + '.Diagnostics.LastEventType',

        DIAG_WARNING:
            CONFIG.ROOT_EVENTS + '.Diagnostics.Warning'
    };

    const RUNNING_STATES = [
        'ANLAUF',
        'HEIZBETRIEB',
        'BRAUCHWASSERBETRIEB',
        'POOLBETRIEB',
        'KÜHLBETRIEB',
        'ABTAUUNG'
    ];

    const VALID_STATES = [
        'STILLSTAND',
        'VORWÄRMUNG',
        'STARTANFORDERUNG',
        'ANLAUF',
        'HEIZBETRIEB',
        'BRAUCHWASSERBETRIEB',
        'POOLBETRIEB',
        'KÜHLBETRIEB',
        'ABTAUUNG',
        'AUSLAUF',
        'STÖRUNG'
    ];

    let started = false;
    let lastValidState = '';

    function info(message) {
        log('[NPS EventEngine] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS EventEngine] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS EventEngine DEBUG] ' + message, 'info');
        }
    }

    function exists(id) {
        return existsState(id) || existsObject(id);
    }

    function read(id, fallback) {
        const state = getState(id);

        if (
            !state ||
            state.val === undefined ||
            state.val === null
        ) {
            return fallback;
        }

        return state.val;
    }

    function write(id, value) {
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

    function nowText() {
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

    function ensureString(id, name, role) {
        ensureState(id, '', {
            name: name,
            type: 'string',
            role: role || 'text',
            read: true,
            write: false
        });
    }

    function ensureBoolean(id, name) {
        ensureState(id, false, {
            name: name,
            type: 'boolean',
            role: 'indicator',
            read: true,
            write: false
        });
    }

    function ensureNumber(id, name, unit, role) {
        const common = {
            name: name,
            type: 'number',
            role: role || 'value',
            read: true,
            write: false
        };

        if (unit !== undefined) {
            common.unit = unit;
        }

        ensureState(id, 0, common);
    }

    function createAllObjects() {
        ensureFolder(CONFIG.ROOT_EVENTS, 'NPS Events');

        ensureChannel(CONFIG.ROOT_EVENTS + '.System', 'System');
        ensureChannel(CONFIG.ROOT_EVENTS + '.Verdichter', 'Verdichterereignisse');
        ensureChannel(CONFIG.ROOT_EVENTS + '.Diagnostics', 'Diagnose');

        ensureString(OUTPUT.SYSTEM_VERSION, 'Modulversion');
        ensureBoolean(OUTPUT.SYSTEM_ACTIVE, 'Modul aktiv');
        ensureString(OUTPUT.SYSTEM_STATUS, 'Modulstatus');
        ensureString(OUTPUT.SYSTEM_LAST_START, 'Letzter Modulstart', 'date');
        ensureString(OUTPUT.SYSTEM_LAST_UPDATE, 'Letzte Aktualisierung', 'date');
        ensureString(OUTPUT.SYSTEM_LAST_MESSAGE, 'Letzte Meldung');

        ensureNumber(OUTPUT.SEQUENZ, 'Fortlaufende Ereignisnummer');
        ensureString(OUTPUT.EREIGNIS_ID, 'Eindeutige Ereignis-ID');
        ensureString(OUTPUT.TYP, 'Ereignistyp');
        ensureString(OUTPUT.TITEL, 'Ereignistitel');
        ensureString(OUTPUT.NACHRICHT, 'Ereignisnachricht');
        ensureString(OUTPUT.KRITIKALITAET, 'Kritikalität');
        ensureString(OUTPUT.ZEITSTEMPEL, 'Zeitstempel', 'date');
        ensureString(OUTPUT.ZUSTAND_VORHER, 'Zustand vorher');
        ensureString(OUTPUT.ZUSTAND_AKTUELL, 'Zustand aktuell');
        ensureString(OUTPUT.BETRIEBSART, 'Betriebsart');
        ensureString(OUTPUT.STARTZEIT, 'Startzeit', 'date');
        ensureString(OUTPUT.STOPPZEIT, 'Stoppzeit', 'date');
        ensureNumber(
            OUTPUT.LAUFZEIT,
            'Laufzeit',
            's',
            'value.interval'
        );
        ensureString(OUTPUT.NUTZDATEN, 'Strukturierte Ereignisnutzdaten', 'json');

        ensureNumber(OUTPUT.DIAG_EVENT_COUNT, 'Anzahl veröffentlichter Ereignisse');
        ensureString(OUTPUT.DIAG_LAST_TYPE, 'Letzter Ereignistyp');
        ensureString(OUTPUT.DIAG_WARNING, 'Warnung');
    }

    function isRunningState(state) {
        return RUNNING_STATES.includes(state);
    }

    function eventDefinition(previousState, currentState) {
        if (currentState === 'STÖRUNG') {
            return {
                eventId: 'NPS-VERDICHTER-9001',
                type: 'VERDICHTER_STOERUNG',
                title: 'Verdichterzustand gestört',
                message:
                    'Die Zustandsmaschine hat einen ungültigen oder ' +
                    'widersprüchlichen Verdichterzustand erkannt.',
                level: 'error'
            };
        }

        if (
            previousState === 'STÖRUNG' &&
            currentState !== 'STÖRUNG'
        ) {
            return {
                eventId: 'NPS-VERDICHTER-9002',
                type: 'VERDICHTER_STOERUNG_BEENDET',
                title: 'Verdichterzustand wieder gültig',
                message:
                    'Die Prozesssignale sind wieder gültig und die ' +
                    'Zustandsmaschine arbeitet wieder regulär.',
                level: 'success'
            };
        }

        if (currentState === 'VORWÄRMUNG') {
            return {
                eventId: 'NPS-VERDICHTER-1101',
                type: 'VORWAERMUNG_GESTARTET',
                title: 'Verdichter-Vorwärmung gestartet',
                message: 'Der Verdichter-Erwärmer ist aktiv.',
                level: 'info'
            };
        }

        if (currentState === 'STARTANFORDERUNG') {
            return {
                eventId: 'NPS-VERDICHTER-1102',
                type: 'STARTANFORDERUNG_AKTIV',
                title: 'Verdichterstart angefordert',
                message:
                    'Ein Verdichterbedarf liegt an; der Verdichter läuft noch nicht.',
                level: 'info'
            };
        }

        if (
            currentState === 'ANLAUF' &&
            !isRunningState(previousState)
        ) {
            return {
                eventId: 'NPS-VERDICHTER-1001',
                type: 'VERDICHTER_GESTARTET',
                title: 'Verdichter gestartet',
                message: 'Der Verdichter ist angelaufen.',
                level: 'info'
            };
        }

        if (
            currentState === 'HEIZBETRIEB' &&
            previousState !== 'HEIZBETRIEB'
        ) {
            return {
                eventId: 'NPS-VERDICHTER-1201',
                type: 'HEIZBETRIEB_GESTARTET',
                title: 'Heizbetrieb gestartet',
                message: 'Der Verdichter arbeitet jetzt im Heizbetrieb.',
                level: 'info'
            };
        }

        if (
            currentState === 'BRAUCHWASSERBETRIEB' &&
            previousState !== 'BRAUCHWASSERBETRIEB'
        ) {
            return {
                eventId: 'NPS-VERDICHTER-1301',
                type: 'BRAUCHWASSERBETRIEB_GESTARTET',
                title: 'Brauchwasserbetrieb gestartet',
                message:
                    'Der Verdichter arbeitet jetzt in der Brauchwasserbereitung.',
                level: 'info'
            };
        }

        if (
            currentState === 'POOLBETRIEB' &&
            previousState !== 'POOLBETRIEB'
        ) {
            return {
                eventId: 'NPS-VERDICHTER-1501',
                type: 'POOLBETRIEB_GESTARTET',
                title: 'Poolbetrieb gestartet',
                message: 'Der Verdichter arbeitet jetzt im Poolbetrieb.',
                level: 'info'
            };
        }

        if (
            currentState === 'KÜHLBETRIEB' &&
            previousState !== 'KÜHLBETRIEB'
        ) {
            return {
                eventId: 'NPS-VERDICHTER-1601',
                type: 'KUEHLBETRIEB_GESTARTET',
                title: 'Kühlbetrieb gestartet',
                message: 'Der Verdichter arbeitet jetzt im Kühlbetrieb.',
                level: 'info'
            };
        }

        if (currentState === 'ABTAUUNG') {
            return {
                eventId: 'NPS-VERDICHTER-1401',
                type: 'ABTAUUNG_GESTARTET',
                title: 'Abtauung gestartet',
                message:
                    'Die Außeneinheit hat einen Abtauvorgang begonnen.',
                level: 'info'
            };
        }

        if (
            previousState === 'ABTAUUNG' &&
            currentState !== 'ABTAUUNG'
        ) {
            return {
                eventId: 'NPS-VERDICHTER-1402',
                type: 'ABTAUUNG_BEENDET',
                title: 'Abtauung beendet',
                message:
                    'Der Abtauvorgang wurde beendet. Die Anlage ist in den regulären Betrieb zurückgekehrt.',
                level: 'success'
            };
        }

        if (currentState === 'AUSLAUF') {
            return {
                eventId: 'NPS-VERDICHTER-1002',
                type: 'VERDICHTER_AUSLAUF',
                title: 'Verdichter wird gestoppt',
                message: 'Der Verdichter befindet sich im Auslauf.',
                level: 'info'
            };
        }

        if (
            currentState === 'STILLSTAND' &&
            previousState === 'AUSLAUF'
        ) {
            return {
                eventId: 'NPS-VERDICHTER-1003',
                type: 'VERDICHTER_GESTOPPT',
                title: 'Verdichter gestoppt',
                message: 'Der Verdichtertakt ist beendet.',
                level: 'success'
            };
        }

        return {
            eventId: 'NPS-VERDICHTER-1900',
            type: 'ZUSTANDSWECHSEL',
            title: 'Verdichterzustand geändert',
            message:
                'Der Verdichterzustand wechselte von "' +
                previousState +
                '" nach "' +
                currentState +
                '".',
            level: 'info'
        };
    }

    function publishEvent(previousState, currentState) {
        const definition = eventDefinition(previousState, currentState);

        const timestamp = nowText();
        const operatingMode = String(read(INPUT.BETRIEBSART, 'UNBEKANNT'));
        const startTime = String(read(INPUT.STARTZEIT, ''));
        const stopTime = String(read(INPUT.STOPPZEIT, ''));
        const runtime = Number(read(INPUT.LAUFZEIT, 0)) || 0;

        const currentSequence = Number(read(OUTPUT.SEQUENZ, 0)) || 0;
        const nextSequence = currentSequence + 1;

        const payload = {
            eventId: definition.eventId,
            domain: CONFIG.DOMAIN,
            type: definition.type,
            source: CONFIG.SOURCE,
            level: definition.level,
            title: definition.title,
            message: definition.message,
            timestamp: timestamp,
            sequence: nextSequence,
            data: {
                previousState: previousState,
                currentState: currentState,
                operatingMode: operatingMode,
                startTime: startTime,
                stopTime: stopTime,
                runtimeSeconds: runtime
            }
        };

        write(OUTPUT.EREIGNIS_ID, definition.eventId);
        write(OUTPUT.TYP, definition.type);
        write(OUTPUT.TITEL, definition.title);
        write(OUTPUT.NACHRICHT, definition.message);
        write(OUTPUT.KRITIKALITAET, definition.level);
        write(OUTPUT.ZEITSTEMPEL, timestamp);
        write(OUTPUT.ZUSTAND_VORHER, previousState);
        write(OUTPUT.ZUSTAND_AKTUELL, currentState);
        write(OUTPUT.BETRIEBSART, operatingMode);
        write(OUTPUT.STARTZEIT, startTime);
        write(OUTPUT.STOPPZEIT, stopTime);
        write(OUTPUT.LAUFZEIT, runtime);
        write(OUTPUT.NUTZDATEN, JSON.stringify(payload));

        write(OUTPUT.SYSTEM_LAST_UPDATE, timestamp);
        write(
            OUTPUT.SYSTEM_LAST_MESSAGE,
            definition.type + ': ' + previousState + ' -> ' + currentState
        );
        write(OUTPUT.DIAG_LAST_TYPE, definition.type);
        write(
            OUTPUT.DIAG_EVENT_COUNT,
            (Number(read(OUTPUT.DIAG_EVENT_COUNT, 0)) || 0) + 1
        );
        write(OUTPUT.DIAG_WARNING, '');

        /*
         * Sequenz absichtlich zuletzt schreiben:
         * Nachfolgende Module dürfen diese Änderung als Ereignistrigger nutzen.
         */
        write(OUTPUT.SEQUENZ, nextSequence);

        debug(
            'Ereignis ' +
            definition.eventId +
            ' veröffentlicht: ' +
            previousState +
            ' -> ' +
            currentState
        );
    }

    function handleStateChange(object) {
        const currentState =
            object &&
            object.state &&
            object.state.val !== undefined &&
            object.state.val !== null
                ? String(object.state.val)
                : '';

        if (!currentState) {
            return;
        }

        /*
         * Die StateMachine-Public-API darf für die EventEngine nur
         * semantische NPS-Zustände liefern. In der Praxis können jedoch
         * kurzzeitig numerische Roh-/Zwischenwerte (z. B. 20, 40, 60)
         * auftreten. Diese werden hier bewusst vollständig ignoriert.
         *
         * Wichtig: Wir verwenden NICHT object.oldState als fachlichen
         * Vorgänger, weil oldState ebenfalls ein solcher Rohwert sein kann.
         * Stattdessen merken wir uns den letzten gültigen NPS-Zustand.
         */
        if (!VALID_STATES.includes(currentState)) {
            debug(
                'Ungültiger Zwischenwert ignoriert: ' +
                currentState
            );
            return;
        }

        if (!lastValidState) {
            lastValidState = currentState;
            debug(
                'Gültiger Basiszustand übernommen: ' +
                currentState
            );
            return;
        }

        if (lastValidState === currentState) {
            return;
        }

        const previousState = lastValidState;

        /*
         * Den gültigen Zustand vor der Publikation fortschreiben, damit
         * auch bei unmittelbar folgenden Änderungen die Zustandskette
         * konsistent bleibt.
         */
        lastValidState = currentState;

        publishEvent(previousState, currentState);
    }


    function validateDependencies() {
        const stateMachineVersionId =
            CONFIG.ROOT_STATE_MACHINE + '.System.Version';

        if (!existsState(stateMachineVersionId)) {
            warn(
                'Start abgebrochen. 07_NPS_StateMachine v' +
                CONFIG.REQUIRED_STATE_MACHINE_VERSION +
                ' fehlt.'
            );
            return false;
        }

        const stateMachineVersion =
            String(getState(stateMachineVersionId).val || '');

        if (stateMachineVersion !== CONFIG.REQUIRED_STATE_MACHINE_VERSION) {
            warn(
                'StateMachine-Version ist ' +
                stateMachineVersion +
                ', erwartet wird ' +
                CONFIG.REQUIRED_STATE_MACHINE_VERSION +
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

    function start() {
        createAllObjects();

        setTimeout(function () {
            if (!validateDependencies()) {
                write(OUTPUT.SYSTEM_ACTIVE, false);
                write(OUTPUT.SYSTEM_STATUS, 'STÖRUNG');
                write(OUTPUT.SYSTEM_LAST_MESSAGE, 'Abhängigkeiten nicht erfüllt');
                return;
            }

            write(OUTPUT.SYSTEM_VERSION, CONFIG.VERSION);
            write(OUTPUT.SYSTEM_ACTIVE, true);
            write(OUTPUT.SYSTEM_STATUS, 'BEREIT');
            write(OUTPUT.SYSTEM_LAST_START, nowText());
            write(OUTPUT.SYSTEM_LAST_UPDATE, nowText());
            write(
                OUTPUT.SYSTEM_LAST_MESSAGE,
                'Ereignis-Engine gestartet; aktueller Zustand wurde als Basis übernommen'
            );
            write(OUTPUT.DIAG_WARNING, '');

            const initialState = String(read(INPUT.ZUSTAND, ''));

            if (VALID_STATES.includes(initialState)) {
                lastValidState = initialState;
                debug(
                    'Initialer gültiger Basiszustand übernommen: ' +
                    initialState
                );
            } else {
                lastValidState = '';
                debug(
                    'Initialer Zustand ist kein gültiger NPS-Zustand und wird ignoriert: ' +
                    initialState
                );
            }

            on(
                {
                    id: INPUT.ZUSTAND,
                    change: 'ne'
                },
                handleStateChange
            );

            started = true;
            info('Version ' + CONFIG.VERSION + ' gestartet');

            /*
             * Beim Start wird bewusst kein Ereignis erzeugt.
             * Erst ein realer Zustandswechsel löst ein Ereignis aus.
             */
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
        if (started && existsState(OUTPUT.SYSTEM_ACTIVE)) {
            write(OUTPUT.SYSTEM_ACTIVE, false);
            write(OUTPUT.SYSTEM_STATUS, 'GESTOPPT');
            write(OUTPUT.SYSTEM_LAST_MESSAGE, 'Modul wurde beendet');
        }
    }, 1000);

    start();
})();
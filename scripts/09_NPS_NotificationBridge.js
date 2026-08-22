/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               09_NPS_NotificationBridge
 * Datei:               09_NPS_NotificationBridge.js
 * Version:             1.2.3
 * Build:               2026-08-22
 * Modulstatus:         STABIL / BEOBACHTEN
 * Architektur-Schicht: Integrationsschicht / Benachrichtigungs-Bridge
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Übersetzt standardisierte NPS-Ereignisse sowie zwei direkte technische
 * NIBE-Signale in das Nachrichtenformat des zentralen NotificationCenters.
 * Die Bridge veröffentlicht ausschließlich auf dessen EventBus und übernimmt
 * selbst weder Kanalzustellung noch Darstellung oder Nachrichtenhistorie.
 *
 * Eingänge (nur lesend)
 * ---------------------
 * - 0_userdata.0.NPS.Events.Verdichter.*
 * - alias.0.Keller.Waschküche.Waermepumpe.UNREACH
 * - alias.0.Keller.Waschküche.Waermepumpe.Alarmnummer
 *
 * Ausgang
 * -------
 * - 0_userdata.0.NotificationCenter.Events.Publish
 *
 * Interne Public-Diagnose
 * -----------------------
 * - 0_userdata.0.NPS.NotificationBridge.System.*
 * - 0_userdata.0.NPS.NotificationBridge.Diagnostics.*
 * - 0_userdata.0.NPS.NotificationBridge.Statistics.*
 * - 0_userdata.0.NPS.NotificationBridge.Memory.*
 *
 * Trigger und Ablauf
 * ------------------
 * - Eine neue EventEngine-Sequenz wird ausgewertet. Benachrichtigungen werden
 *   ausschließlich beim tatsächlichen Verdichter-/Zyklusstart und beim
 *   vollständigen Zyklusende auf dem NotificationCenter-Bus veröffentlicht.
 * - Alle NPS-Meldungen werden ausschließlich an matrix-org.0 geroutet.
 *   JARVIS wird vom NPS nicht als Benachrichtigungskanal verwendet.
 * - Änderungen von UNREACH erzeugen Online-/Offline-Ereignisse.
 * - Änderungen der Alarmnummer erzeugen Alarm aktiv/beendet/geändert.
 * - Beim Start wird die vorhandene Sequenz als verarbeitet markiert; alte
 *   NPS-Ereignisse werden dadurch nicht erneut gesendet.
 *
 * Abhängigkeiten
 * ---------------
 * - 08_NPS_EventEngine.js, exakt Version 1.2.1
 * - 00_NotificationCenter.js, Version 1.0.0 oder neuer
 * - ioBroker JavaScript-Adapter
 *
 * Architekturregeln
 * -----------------
 * - Keine fachliche Zustands- oder Ereignisentscheidung für Verdichterabläufe
 * - Keine direkte Matrix-, JARVIS-, Mail- oder Telegram-Zustellung
 * - NotificationCenter.EventBus ist die einzige externe Publikationsschnittstelle
 * - Single Writer für NPS.NotificationBridge
 * - Keine Zusammenlegung mit EventEngine oder NotificationCenter
 *
 * Änderungsverlauf
 * ----------------
 * 1.2.3 | 2026-08-22
 *       | Abhängigkeit auf 08_NPS_EventEngine v1.2.1 aktualisiert.
 *       | Keine Änderung der Routing-, Publikations- oder Benachrichtigungslogik.
 * 1.2.1 | 2026-07-29
 *       | Korrektur: JARVIS-Benachrichtigungen bleiben aktiviert.
 *       | Matrix-Versand bleibt ausschließlich auf matrix-org.0 begrenzt.
 * 1.2.0 | 2026-07-29
 *       | Matrix-Routing auf matrix-org.0 begrenzt.
 *       | NPS-Routing auf matrix-org.0 vereinheitlicht.
 *       | JARVIS-Benachrichtigungen für NPS vollständig deaktiviert.
 *       | NotificationCenter bleibt unverändert mehrkanalfähig.
 * 1.1.1 | 2026-07-28
 *       | Allgemeine Weiterleitung der EventEngine-Ereignisse entfernt.
 *       | Es werden nur noch eigene Meldungen für Zyklusstart und Zyklusende
 *       | an Matrix und JARVIS erzeugt; keine Blacklist-Konfiguration.
 * 1.1.0 | 2026-07-28
 *       | NPS-Routing auf Zyklusstart und Zyklusende begrenzt.
 *       | Startmeldung enthält die Betriebsart; Endemeldung zusätzlich die
 *       | Laufzeit. Zwischenzustände wie Anforderung, Betriebsartwechsel,
 *       | Abtauung und Auslauf werden nicht mehr benachrichtigt.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; Eingänge, Ausgang, Trigger,
 *       | Diagnose, Abhängigkeiten und Modulgrenzen dokumentiert.
 *       | Abhängigkeit auf EventEngine 1.0.1 synchronisiert.
 *       | Keine Änderung der Routing- oder Publikationslogik.
 * 1.0.0 | 2026-07-14
 *       | Produktive Erstversion.
 ****************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '1.2.3',
        REQUIRED_EVENT_ENGINE_VERSION: '1.2.1',
        DEBUG: false,

        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.NotificationBridge',
        ROOT_EVENTS: '0_userdata.0.NPS.Events',

        EVENT_BUS:
            '0_userdata.0.NotificationCenter.Events.Publish',

        STATE_CREATE_DELAY_MS: 1000,

        INPUT: {
            EVENT_SEQUENCE:
                '0_userdata.0.NPS.Events.Verdichter.Sequenz',

            EVENT_ID:
                '0_userdata.0.NPS.Events.Verdichter.EreignisId',

            EVENT_TYPE:
                '0_userdata.0.NPS.Events.Verdichter.Typ',

            EVENT_TITLE:
                '0_userdata.0.NPS.Events.Verdichter.Titel',

            EVENT_MESSAGE:
                '0_userdata.0.NPS.Events.Verdichter.Nachricht',

            EVENT_LEVEL:
                '0_userdata.0.NPS.Events.Verdichter.Kritikalitaet',

            EVENT_TIMESTAMP:
                '0_userdata.0.NPS.Events.Verdichter.Zeitstempel',

            EVENT_PAYLOAD:
                '0_userdata.0.NPS.Events.Verdichter.Nutzdaten',

            UNREACH:
                'alias.0.Keller.Waschküche.Waermepumpe.UNREACH',

            ALARM_NUMBER:
                'alias.0.Keller.Waschküche.Waermepumpe.Alarmnummer'
        },

        ROUTING: {
            NPS_EVENTS: {
                ENABLED: true,
                MATRIX: [0],
                JARVIS: true
            },

            UNREACH: {
                ENABLED: true,
                MATRIX: [0],
                JARVIS: true
            },

            ALARM: {
                ENABLED: true,
                MATRIX: [0],
                JARVIS: true
            }
        }
    };

    let started = false;

    function info(message) {
        log('[NPS NotificationBridge] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS NotificationBridge] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS NotificationBridge DEBUG] ' + message, 'info');
        }
    }

    function dp(path) {
        return CONFIG.ROOT + '.' + path;
    }

    function exists(id) {
        return existsState(id) || existsObject(id);
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function nowString() {
        return new Date().toLocaleString('de-DE');
    }

    function createEventUid() {
        return Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function readRaw(id) {
        const state = getState(id);

        if (
            !state ||
            state.val === undefined ||
            state.val === null
        ) {
            return null;
        }

        return state.val;
    }

    function readNumber(id) {
        const value = readRaw(id);

        if (value === null || value === '') {
            return null;
        }

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function readText(id, fallback) {
        const value = readRaw(id);

        if (value === null || value === '') {
            return fallback || '';
        }

        return String(value);
    }

    function write(path, value) {
        const id = dp(path);

        if (!existsState(id)) {
            warn('Zieldatenpunkt fehlt: ' + id);
            return false;
        }

        const current = getState(id);

        if (!current || current.val !== value) {
            setState(id, value, true);
        }

        return true;
    }

    function increment(path) {
        const current = readNumber(dp(path));
        write(path, (current === null ? 0 : current) + 1);
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

    function ensureState(path, initialValue, type, role, name) {
        const id = dp(path);

        if (exists(id)) return;

        createState(id, initialValue, true, {
            name: name || path,
            type: type,
            role: role,
            read: true,
            write: false
        });
    }

    function ensureString(path, name, role) {
        ensureState(path, '', 'string', role || 'text', name);
    }

    function ensureNumber(path, name) {
        ensureState(path, 0, 'number', 'value', name);
    }

    function ensureBoolean(path, name) {
        ensureState(path, false, 'boolean', 'indicator', name);
    }

    function createAllObjects() {
        ensureFolder(CONFIG.ROOT, 'NPS NotificationBridge');

        ensureChannel(dp('System'), 'System');
        ensureChannel(dp('Diagnostics'), 'Diagnose');
        ensureChannel(dp('Statistics'), 'Statistik');
        ensureChannel(dp('Memory'), 'Arbeitsspeicher');

        ensureString('System.Version', 'Modulversion');
        ensureBoolean('System.Active', 'Modul aktiv');
        ensureString('System.LastStart', 'Letzter Modulstart', 'date');
        ensureString('System.LastPublish', 'Letzte Veröffentlichung', 'date');
        ensureString('System.Status', 'Status');
        ensureString('System.LastMessage', 'Letzte Meldung');

        ensureBoolean('Diagnostics.ValidInput', 'Eingänge gültig');
        ensureBoolean('Diagnostics.EventBusAvailable', 'EventBus verfügbar');
        ensureString('Diagnostics.Warning', 'Warnung');
        ensureString('Diagnostics.Trace', 'Diagnosetrace');

        ensureNumber('Statistics.PublishedCount', 'Veröffentlichte Ereignisse');
        ensureNumber('Statistics.SuppressedCount', 'Unterdrückte Ereignisse');
        ensureNumber('Statistics.ErrorCount', 'Fehlerhafte Veröffentlichungen');

        ensureNumber('Memory.LastSequence', 'Zuletzt verarbeitete Sequenz');
        ensureString('Memory.LastEventId', 'Letzte Ereignis-ID');
        ensureString('Memory.LastEventType', 'Letzter Ereignistyp');
        ensureString('Memory.LastEventValue', 'Letzter Ereigniswert');
    }

    function ensureEventBus() {
        if (exists(CONFIG.EVENT_BUS)) {
            return true;
        }

        createState(CONFIG.EVENT_BUS, '', true, {
            name: 'NotificationCenter EventBus',
            type: 'string',
            role: 'text',
            read: true,
            write: true
        });

        return exists(CONFIG.EVENT_BUS);
    }

    function normalizeBoolean(value) {
        if (
            value === true ||
            value === 1 ||
            value === '1' ||
            value === 'true'
        ) {
            return true;
        }

        if (
            value === false ||
            value === 0 ||
            value === '0' ||
            value === 'false'
        ) {
            return false;
        }

        return null;
    }

    function publishEvent(event, routing) {
        if (!routing.ENABLED) {
            increment('Statistics.SuppressedCount');
            write('System.Status', 'BEREIT');
            write(
                'System.LastMessage',
                event.eventId + ' ist deaktiviert'
            );
            return false;
        }

        if (!exists(CONFIG.EVENT_BUS)) {
            increment('Statistics.ErrorCount');
            write('Diagnostics.EventBusAvailable', false);
            write(
                'Diagnostics.Warning',
                'NotificationCenter EventBus fehlt'
            );
            write('System.Status', 'FEHLER');
            write(
                'System.LastMessage',
                'Ereignis konnte nicht veröffentlicht werden'
            );

            warn('EventBus fehlt: ' + CONFIG.EVENT_BUS);
            return false;
        }

        const payload = {
            eventUid: createEventUid(),
            eventId: event.eventId,
            domain: event.domain || 'nibe',
            type: event.type,
            source: event.source || '09_NPS_NotificationBridge',
            level: event.level || 'info',
            title: event.title,
            message: event.message,
            timestamp: event.timestamp || nowIso(),
            emoji: event.emoji || '',
            jarvisIcon:
                event.jarvisIcon || 'material-symbols:heat-pump',
            channels: {
                matrix: routing.MATRIX,
                jarvis: routing.JARVIS
            },
            data: event.data || {}
        };

        setState(
            CONFIG.EVENT_BUS,
            JSON.stringify(payload),
            false
        );

        increment('Statistics.PublishedCount');
        write('System.LastPublish', nowString());
        write('System.Status', 'BEREIT');
        write(
            'System.LastMessage',
            payload.eventId + ': ' + payload.title
        );

        write('Memory.LastEventId', payload.eventId);
        write('Memory.LastEventType', payload.type);
        write('Memory.LastEventValue', payload.message);

        write('Diagnostics.EventBusAvailable', true);
        write('Diagnostics.Warning', '');
        write(
            'Diagnostics.Trace',
            nowString() +
            '\nEventUid=' + payload.eventUid +
            '\nEventId=' + payload.eventId +
            '\nType=' + payload.type +
            '\nLevel=' + payload.level +
            '\nMatrix=' + payload.channels.matrix +
            '\nJARVIS=' + payload.channels.jarvis
        );

        debug(payload.eventId + ': ' + payload.message);
        return true;
    }

    function parseJson(raw, fallback) {
        if (!raw) return fallback;

        try {
            return JSON.parse(String(raw));
        } catch (error) {
            return fallback;
        }
    }


    function formatDuration(seconds) {
        const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;

        if (hours > 0) {
            return (
                hours + ' h ' +
                String(minutes).padStart(2, '0') + ' min'
            );
        }

        return (
            minutes + ' min ' +
            String(remainingSeconds).padStart(2, '0') + ' s'
        );
    }

    function normalizeOperatingMode(value) {
        const mode = String(value || 'UNBEKANNT').trim();

        switch (mode) {
            case 'HEIZEN':
            case 'HEIZBETRIEB':
                return 'Heizung';
            case 'BRAUCHWASSER':
            case 'BRAUCHWASSERBETRIEB':
                return 'Brauchwasser';
            case 'KUEHLUNG':
            case 'KÜHLUNG':
            case 'KÜHLBETRIEB':
                return 'Kühlung';
            case 'POOL':
            case 'POOLBETRIEB':
                return 'Pool';
            default:
                return mode;
        }
    }

    function buildCycleNotification(eventType, timestamp, payload) {
        const data = payload.data || payload || {};
        const operatingMode = normalizeOperatingMode(data.operatingMode);

        if (eventType === 'VERDICHTER_GESTARTET') {
            return {
                eventId: 'NPS-ZYKLUS-START',
                domain: 'nibe',
                type: 'cycle.started',
                source: '09_NPS_NotificationBridge',
                level: 'info',
                title: 'Wärmepumpenzyklus gestartet',
                message:
                    'Ein neuer Wärmepumpenzyklus wurde gestartet.\n\n' +
                    'Betriebsart: ' + operatingMode + '\n' +
                    'Start: ' + timestamp,
                timestamp: timestamp,
                emoji: '▶️',
                jarvisIcon: 'mdi:play-circle',
                data: data
            };
        }

        if (eventType === 'VERDICHTER_GESTOPPT') {
            return {
                eventId: 'NPS-ZYKLUS-ENDE',
                domain: 'nibe',
                type: 'cycle.ended',
                source: '09_NPS_NotificationBridge',
                level: 'success',
                title: 'Wärmepumpenzyklus beendet',
                message:
                    'Der Wärmepumpenzyklus wurde beendet.\n\n' +
                    'Betriebsart: ' + operatingMode + '\n' +
                    'Laufzeit: ' + formatDuration(data.runtimeSeconds) + '\n' +
                    'Ende: ' + timestamp,
                timestamp: timestamp,
                emoji: '⏹️',
                jarvisIcon: 'mdi:stop-circle',
                data: data
            };
        }

        return null;
    }

    function handleNpsEvent() {
        const sequence = readNumber(CONFIG.INPUT.EVENT_SEQUENCE);

        if (sequence === null) {
            increment('Statistics.ErrorCount');
            write(
                'Diagnostics.Warning',
                'Ereignissequenz nicht lesbar'
            );
            return;
        }

        const lastSequence =
            readNumber(dp('Memory.LastSequence')) || 0;

        if (sequence <= lastSequence) {
            return;
        }

        const eventId =
            readText(CONFIG.INPUT.EVENT_ID, 'NPS-UNKNOWN');

        const eventType =
            readText(CONFIG.INPUT.EVENT_TYPE, 'unknown');

        const timestamp =
            readText(CONFIG.INPUT.EVENT_TIMESTAMP, nowIso());

        const rawPayload =
            readText(CONFIG.INPUT.EVENT_PAYLOAD, '{}');

        const parsedPayload = parseJson(rawPayload, {});

        const cycleNotification = buildCycleNotification(
            eventType,
            timestamp,
            parsedPayload
        );

        if (!cycleNotification) {
            increment('Statistics.SuppressedCount');
            write('Memory.LastSequence', sequence);
            write('Memory.LastEventId', eventId);
            write('Memory.LastEventType', eventType);
            write(
                'System.LastMessage',
                eventType + ' ohne Benachrichtigung verarbeitet'
            );
            debug('Kein Zyklusstart oder Zyklusende: ' + eventType);
            return;
        }

        publishEvent(
            cycleNotification,
            CONFIG.ROUTING.NPS_EVENTS
        );

        write('Memory.LastSequence', sequence);
    }

    function handleUnreachChange(oldValue, newValue) {
        const oldBoolean = normalizeBoolean(oldValue);
        const newBoolean = normalizeBoolean(newValue);

        if (oldBoolean === null || newBoolean === null) {
            increment('Statistics.SuppressedCount');
            write(
                'Diagnostics.Warning',
                'Ungültiger UNREACH-Wert'
            );
            return;
        }

        if (newBoolean) {
            publishEvent(
                {
                    eventId: 'NIBE-1002',
                    type: 'system.offline',
                    level: 'error',
                    title: 'Wärmepumpe OFFLINE',
                    message:
                        'Die Kommunikation zur NIBE wurde unterbrochen.\n\n' +
                        'Bitte Modbus, Netzwerk und Spannungsversorgung prüfen.',
                    emoji: '🔴',
                    jarvisIcon: 'mdi:wifi-off',
                    data: {
                        unreachable: true,
                        previousValue: oldBoolean
                    }
                },
                CONFIG.ROUTING.UNREACH
            );
        } else {
            publishEvent(
                {
                    eventId: 'NIBE-1001',
                    type: 'system.online',
                    level: 'success',
                    title: 'Wärmepumpe ONLINE',
                    message:
                        'Die Kommunikation zur NIBE wurde wiederhergestellt.',
                    emoji: '🟢',
                    jarvisIcon: 'mdi:wifi-check',
                    data: {
                        unreachable: false,
                        previousValue: oldBoolean
                    }
                },
                CONFIG.ROUTING.UNREACH
            );
        }
    }

    function handleAlarmChange(oldValue, newValue) {
        const oldNumber = Number(oldValue);
        const newNumber = Number(newValue);

        if (
            !Number.isFinite(oldNumber) ||
            !Number.isFinite(newNumber)
        ) {
            increment('Statistics.SuppressedCount');
            write(
                'Diagnostics.Warning',
                'Ungültige Alarmnummer'
            );
            return;
        }

        if (newNumber === 0 && oldNumber !== 0) {
            publishEvent(
                {
                    eventId: 'NIBE-3002',
                    type: 'alarm.cleared',
                    level: 'success',
                    title: 'NIBE-Alarm beendet',
                    message:
                        'Es liegt kein NIBE-Alarm mehr an.\n\n' +
                        'Vorherige Alarmnummer: ' + oldNumber,
                    emoji: '✅',
                    jarvisIcon: 'mdi:check-circle',
                    data: {
                        oldAlarmNumber: oldNumber,
                        newAlarmNumber: newNumber
                    }
                },
                CONFIG.ROUTING.ALARM
            );
            return;
        }

        if (oldNumber === 0 && newNumber !== 0) {
            publishEvent(
                {
                    eventId: 'NIBE-3001',
                    type: 'alarm.active',
                    level: 'error',
                    title: 'NIBE-Alarm erkannt',
                    message:
                        'Alarmnummer: ' + newNumber + '\n\n' +
                        'Bitte Anzeige der VVM S500 und Installateurhandbuch prüfen.',
                    emoji: '🚨',
                    jarvisIcon: 'mdi:alert-octagon',
                    data: {
                        oldAlarmNumber: oldNumber,
                        newAlarmNumber: newNumber
                    }
                },
                CONFIG.ROUTING.ALARM
            );
            return;
        }

        if (oldNumber !== newNumber) {
            publishEvent(
                {
                    eventId: 'NIBE-3003',
                    type: 'alarm.changed',
                    level: 'error',
                    title: 'NIBE-Alarm geändert',
                    message:
                        'Alarmnummer geändert:\n\n' +
                        oldNumber + ' ➡️ ' + newNumber,
                    emoji: '🚨',
                    jarvisIcon: 'mdi:alert-octagon',
                    data: {
                        oldAlarmNumber: oldNumber,
                        newAlarmNumber: newNumber
                    }
                },
                CONFIG.ROUTING.ALARM
            );
        }
    }


    function registerTriggers() {
        on(
            {
                id: CONFIG.INPUT.EVENT_SEQUENCE,
                change: 'ne'
            },
            handleNpsEvent
        );

        on(
            {
                id: CONFIG.INPUT.UNREACH,
                change: 'ne'
            },
            function (object) {
                handleUnreachChange(
                    object && object.oldState
                        ? object.oldState.val
                        : null,
                    object && object.state
                        ? object.state.val
                        : null
                );
            }
        );

        on(
            {
                id: CONFIG.INPUT.ALARM_NUMBER,
                change: 'ne'
            },
            function (object) {
                handleAlarmChange(
                    object && object.oldState
                        ? object.oldState.val
                        : null,
                    object && object.state
                        ? object.state.val
                        : null
                );
            }
        );
    }

    function validateDependencies() {
        const eventEngineVersionId =
            CONFIG.ROOT_EVENTS + '.System.Version';

        if (!existsState(eventEngineVersionId)) {
            warn(
                'Start abgebrochen. 08_NPS_EventEngine v' +
                CONFIG.REQUIRED_EVENT_ENGINE_VERSION +
                ' fehlt.'
            );
            return false;
        }

        const eventEngineVersion =
            String(getState(eventEngineVersionId).val || '');

        if (eventEngineVersion !== CONFIG.REQUIRED_EVENT_ENGINE_VERSION) {
            warn(
                'EventEngine-Version ist ' +
                eventEngineVersion +
                ', erwartet wird ' +
                CONFIG.REQUIRED_EVENT_ENGINE_VERSION +
                '.'
            );
            return false;
        }

        const missing = [];
        [
            CONFIG.INPUT.EVENT_SEQUENCE,
            CONFIG.INPUT.EVENT_ID,
            CONFIG.INPUT.EVENT_TYPE,
            CONFIG.INPUT.EVENT_TITLE,
            CONFIG.INPUT.EVENT_MESSAGE,
            CONFIG.INPUT.EVENT_LEVEL,
            CONFIG.INPUT.EVENT_TIMESTAMP,
            CONFIG.INPUT.EVENT_PAYLOAD,
            CONFIG.INPUT.UNREACH,
            CONFIG.INPUT.ALARM_NUMBER
        ].forEach(function (id) {
            if (!exists(id)) missing.push(id);
        });

        if (missing.length > 0) {
            missing.forEach(function (id) { warn('Eingang fehlt: ' + id); });
            return false;
        }
        return true;
    }

    function start() {
        if (!validateDependencies()) {
            return;
        }

        createAllObjects();
        ensureEventBus();

        setTimeout(function () {
            write('System.Version', CONFIG.VERSION);
            write('System.Active', true);
            write('System.LastStart', nowString());
            write('System.Status', 'STARTET');
            write(
                'System.LastMessage',
                'Initialisierung läuft'
            );

            const eventBusAvailable =
                exists(CONFIG.EVENT_BUS);

            write(
                'Diagnostics.EventBusAvailable',
                eventBusAvailable
            );

            if (!eventBusAvailable) {
                write('System.Active', false);
                write('System.Status', 'FEHLER');
                write(
                    'System.LastMessage',
                    'NotificationCenter EventBus fehlt'
                );
                return;
            }

            registerTriggers();

            /*
             * Bestehende Sequenz als verarbeitet markieren.
             * Dadurch wird beim Start kein altes NPS-Ereignis erneut gesendet.
             */
            write(
                'Memory.LastSequence',
                readNumber(CONFIG.INPUT.EVENT_SEQUENCE) || 0
            );

            write('Diagnostics.ValidInput', true);
            write('Diagnostics.Warning', '');
            write('System.Status', 'BEREIT');
            write(
                'System.LastMessage',
                'NotificationBridge bereit'
            );

            started = true;
            info('Version ' + CONFIG.VERSION + ' gestartet');
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
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
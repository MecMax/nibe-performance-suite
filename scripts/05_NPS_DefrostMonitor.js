/******************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               05_NPS_DefrostMonitor
 * Datei:               05_NPS_DefrostMonitor.js
 * Version:             1.1.2
 * Build:               2026-08-18
 * Modulstatus:         STABIL
 * Architektur-Schicht: Ereigniserkennung / Betriebsüberwachung
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Überwacht den Enteisungsstatus der Wärmepumpe und erkennt Beginn, laufende
 * Dauer sowie Ende einer Enteisung. Persistente Zustände sichern die Erkennung
 * auch über einen Neustart des Skripts hinweg.
 *
 * Zusätzlich ab Version 1.1.0:
 * - Zeit seit Ende der letzten Enteisung
 * - Anzahl abgeschlossener Enteisungen
 * - mittlere Enteisungsdauer
 * - letzter und mittlerer Abstand zwischen Enteisungen
 * - JSON-Historie der letzten 20 abgeschlossenen Enteisungen
 * - Momentaufnahme von BT28 und Verdichterfrequenz beim Enteisungsbeginn
 *
 * Das Modul berechnet bewusst keine Energieverluste, Effizienzkennzahlen,
 * COP-, JAZ- oder wirtschaftlichen Bewertungen.
 *
 * Öffentliche Schnittstelle (Public API)
 * --------------------------------------
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.Status
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.Active
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.Count
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.CompletedCount
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.CurrentDurationMinutes
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.LastDurationMinutes
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.TotalDurationMinutes
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.LastStart
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.LastEnd
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.TimeSinceLastDefrostMinutes
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.LastIntervalMinutes
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.AverageDurationMinutes
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.AverageIntervalMinutes
 * 0_userdata.0.NPS.DefrostMonitor.Defrost.History
 *
 * Primärer Eingang
 * ----------------
 * alias.0.Keller.Waschküche.Waermepumpe.Enteisung
 *
 * Zusätzliche NPS-Quellen für die Historie
 * ----------------------------------------
 * 0_userdata.0.NPS.TemperatureMonitor.Temperatures.Outdoor
 * 0_userdata.0.NPS.CompressorMonitor.Compressor.Frequency
 *
 * Interpretation des Eingangs
 * ---------------------------
 * Status 1 oder 2 = Enteisung aktiv
 * alle anderen numerischen Werte = Enteisung nicht aktiv
 *
 * Historie
 * --------
 * JSON-Array mit maximal 20 abgeschlossenen Enteisungen, neuester Eintrag
 * zuerst. Felder:
 * Start, End, DurationMin, OutdoorTempC, CompressorFrequencyHz, IntervalMin
 *
 * Architekturregeln
 * -----------------
 * - Single Writer für alle States unter NPS.DefrostMonitor
 * - Keine zusätzlichen direkten Modbus-Lesewege
 * - BT28 und Verdichterfrequenz werden aus vorgelagerten NPS-Modulen gelesen
 * - Ungültiger Enteisungseingang verändert keine Zähler oder Dauern
 * - Fehlende optionale Historienquellen verhindern die Enteisungserkennung nicht
 * - Energie- und Effizienzbewertung bleibt nachgelagerten Modulen vorbehalten
 *
 * Änderungsverlauf
 * ----------------
 * 1.1.1 | 2026-08-12
 *       | Initialisierungs-Race-Condition behoben: readRaw() prüft jetzt
 *       | existsState(), bevor getState() aufgerufen wird.
 * 1.1.0 | 2026-08-12
 *       | Abtauhistorie (20 Einträge), abgeschlossene Vorgänge,
 *       | Zeit seit letzter Enteisung, letzter/mittlerer Abstand und
 *       | mittlere Dauer ergänzt. BT28 und Verdichterfrequenz werden beim
 *       | Enteisungsbeginn aus TemperatureMonitor/CompressorMonitor übernommen.
 *       | Migration bestehender 1.0.x-Zähler ohne Rücksetzen.
 * 1.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert; keine Logikänderung.
 * 1.0.0 | 2026-07-14
 *       | Produktive Erstversion.
 ******************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '1.1.2',
        DEBUG: false,

        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.DefrostMonitor',

        UPDATE_CRON: '* * * * *',
        STATE_CREATE_DELAY_MS: 1000,
        HISTORY_LIMIT: 20,

        INPUT: {
            DEFROST:
                'alias.0.Keller.Waschküche.Waermepumpe.Enteisung',

            OUTDOOR:
                '0_userdata.0.NPS.TemperatureMonitor.Temperatures.Outdoor',

            COMPRESSOR_FREQUENCY:
                '0_userdata.0.NPS.CompressorMonitor.Compressor.Frequency'
        }
    };

    let started = false;
    let scheduleHandle = null;

    function info(message) {
        log('[NPS DefrostMonitor] ' + message, 'info');
    }

    function warn(message) {
        log('[NPS DefrostMonitor] ' + message, 'warn');
    }

    function debug(message) {
        if (CONFIG.DEBUG) {
            log('[NPS DefrostMonitor DEBUG] ' + message, 'info');
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

    function formatDateTime(ms) {
        if (!ms || !Number.isFinite(Number(ms))) {
            return '';
        }

        const d = new Date(Number(ms));

        const pad = function (v) {
            return String(v).padStart(2, '0');
        };

        return (
            pad(d.getDate()) + '.' +
            pad(d.getMonth() + 1) + '.' +
            d.getFullYear() + ' ' +
            pad(d.getHours()) + ':' +
            pad(d.getMinutes())
        );
    }

    function parseGermanDateTime(value) {
        if (!value || typeof value !== 'string') {
            return 0;
        }

        // Unterstützt u.a. "19.7.2026, 14:45:00" und "19.07.2026 14:45".
        const match = value.match(
            /(\d{1,2})\.(\d{1,2})\.(\d{4})[,]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
        );

        if (!match) {
            return 0;
        }

        const ms = new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1]),
            Number(match[4]),
            Number(match[5]),
            Number(match[6] || 0)
        ).getTime();

        return Number.isFinite(ms) ? ms : 0;
    }

    function round1(value) {
        if (!Number.isFinite(Number(value))) {
            return 0;
        }

        return Math.round(Number(value) * 10) / 10;
    }

    function readRaw(id) {
        // createState() arbeitet asynchron. Beim ersten Skriptstart können
        // neu angelegte States deshalb für wenige Millisekunden noch fehlen.
        // Ohne diese Prüfung würde getState() unnötige ioBroker-Warnungen
        // "not found" erzeugen.
        if (!existsState(id)) {
            return null;
        }

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

    function readBoolean(id) {
        const value = readRaw(id);

        return (
            value === true ||
            value === 1 ||
            value === 'true'
        );
    }

    function readString(id) {
        const value = readRaw(id);
        return value === null ? '' : String(value);
    }

    function readOptionalNumber(id) {
        if (!existsState(id)) {
            return null;
        }

        return readNumber(id);
    }

    function write(path, value) {
        const id = dp(path);

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

    function writeTrace(lines) {
        write(
            'Diagnostics.Trace',
            nowString() + '\n' + lines.join('\n')
        );
    }

    function minutesBetween(startMs, endMs) {
        if (!startMs || !endMs || endMs < startMs) {
            return 0;
        }

        return round1((endMs - startMs) / 60000);
    }

    function isDefrostActive(status) {
        return status === 1 || status === 2;
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
        ensureFolder(CONFIG.ROOT, 'NPS DefrostMonitor');

        ensureChannel(dp('Defrost'), 'Enteisung');
        ensureChannel(dp('Memory'), 'Persistenter Arbeitsspeicher');
        ensureChannel(dp('System'), 'System');
        ensureChannel(dp('Diagnostics'), 'Diagnose');

        ensureNumber('Defrost.Status', 'Enteisungsstatus');
        ensureBoolean('Defrost.Active', 'Enteisung aktiv');
        ensureNumber('Defrost.Count', 'Anzahl Enteisungen');
        ensureNumber('Defrost.CompletedCount', 'Abgeschlossene Enteisungen');

        ensureNumber(
            'Defrost.CurrentDurationMinutes',
            'Aktuelle Enteisungsdauer',
            'min',
            'value.interval'
        );

        ensureNumber(
            'Defrost.TotalDurationMinutes',
            'Gesamte Enteisungsdauer',
            'min',
            'value.interval'
        );

        ensureNumber(
            'Defrost.LastDurationMinutes',
            'Letzte Enteisungsdauer',
            'min',
            'value.interval'
        );

        ensureString('Defrost.LastStart', 'Letzter Enteisungsbeginn', 'date');
        ensureString('Defrost.LastEnd', 'Letztes Enteisungsende', 'date');

        ensureNumber(
            'Defrost.TimeSinceLastDefrostMinutes',
            'Zeit seit letzter Enteisung',
            'min',
            'value.interval'
        );

        ensureNumber(
            'Defrost.LastIntervalMinutes',
            'Letzter Abstand zwischen Enteisungen',
            'min',
            'value.interval'
        );

        ensureNumber(
            'Defrost.AverageDurationMinutes',
            'Mittlere Enteisungsdauer',
            'min',
            'value.interval'
        );

        ensureNumber(
            'Defrost.AverageIntervalMinutes',
            'Mittlerer Abstand zwischen Enteisungen',
            'min',
            'value.interval'
        );

        ensureString(
            'Defrost.History',
            'Historie der letzten 20 Enteisungen',
            'json'
        );

        ensureBoolean('Memory.Initialized', 'Arbeitsspeicher initialisiert');
        ensureNumber(
            'Memory.ActiveSinceMs',
            'Enteisungsbeginn als Unix-Zeit',
            'ms',
            'value.time'
        );
        ensureBoolean('Memory.WasActive', 'Enteisung war aktiv');

        ensureNumber(
            'Memory.LastEndMs',
            'Letztes Enteisungsende als Unix-Zeit',
            'ms',
            'value.time'
        );

        ensureNumber(
            'Memory.CurrentIntervalMinutes',
            'Abstand vor aktueller Enteisung',
            'min',
            'value.interval'
        );

        ensureNumber(
            'Memory.TotalIntervalMinutes',
            'Kumulierte auswertbare Abstände',
            'min',
            'value.interval'
        );

        ensureNumber(
            'Memory.IntervalCount',
            'Anzahl auswertbarer Abstände'
        );

        ensureNumber(
            'Memory.StartOutdoorTempC',
            'Außentemperatur bei Enteisungsbeginn',
            '°C',
            'value.temperature'
        );

        ensureNumber(
            'Memory.StartCompressorFrequencyHz',
            'Verdichterfrequenz bei Enteisungsbeginn',
            'Hz',
            'value.frequency'
        );

        ensureString('System.Version', 'Modulversion');
        ensureBoolean('System.Active', 'Modul aktiv');
        ensureString('System.LastStart', 'Letzter Modulstart', 'date');
        ensureString('System.LastUpdate', 'Letzte Aktualisierung', 'date');
        ensureString('System.Status', 'Status');
        ensureString('System.LastMessage', 'Letzte Meldung');

        ensureBoolean('Diagnostics.ValidInput', 'Eingangsdaten gültig');
        ensureNumber('Diagnostics.InvalidUpdates', 'Ungültige Aktualisierungen');
        ensureString('Diagnostics.Warning', 'Warnung');
        ensureString('Diagnostics.Trace', 'Diagnosetrace');
    }

    function increment(path) {
        const current = readNumber(dp(path));
        write(path, (current === null ? 0 : current) + 1);
    }

    function readHistory() {
        const raw = readString(dp('Defrost.History'));

        if (!raw) {
            return [];
        }

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            warn('Defrost.History ist kein gültiges JSON und wird neu aufgebaut.');
            return [];
        }
    }

    function addHistoryEntry(entry) {
        const history = readHistory();

        history.unshift(entry);

        if (history.length > CONFIG.HISTORY_LIMIT) {
            history.length = CONFIG.HISTORY_LIMIT;
        }

        write('Defrost.History', JSON.stringify(history));
    }

    function updateAverages() {
        const completedCount =
            readNumber(dp('Defrost.CompletedCount')) || 0;

        const totalDuration =
            readNumber(dp('Defrost.TotalDurationMinutes')) || 0;

        const intervalCount =
            readNumber(dp('Memory.IntervalCount')) || 0;

        const totalInterval =
            readNumber(dp('Memory.TotalIntervalMinutes')) || 0;

        write(
            'Defrost.AverageDurationMinutes',
            completedCount > 0
                ? round1(totalDuration / completedCount)
                : 0
        );

        write(
            'Defrost.AverageIntervalMinutes',
            intervalCount > 0
                ? round1(totalInterval / intervalCount)
                : 0
        );
    }

    function migrateTo111() {
        const oldVersion = readString(dp('System.Version'));

        if (oldVersion === CONFIG.VERSION) {
            return;
        }

        const count = readNumber(dp('Defrost.Count')) || 0;
        const active = readBoolean(dp('Defrost.Active'));

        // 1.0.x zählte beim Beginn. Im inaktiven Zustand sind damit alle
        // bisherigen Vorgänge abgeschlossen; bei aktiver Enteisung einer weniger.
        const completed = Math.max(0, count - (active ? 1 : 0));

        if ((readNumber(dp('Defrost.CompletedCount')) || 0) === 0) {
            write('Defrost.CompletedCount', completed);
        }

        let lastEndMs = readNumber(dp('Memory.LastEndMs')) || 0;

        if (!lastEndMs) {
            lastEndMs = parseGermanDateTime(
                readString(dp('Defrost.LastEnd'))
            );

            if (lastEndMs) {
                write('Memory.LastEndMs', lastEndMs);
            }
        }

        if (!readString(dp('Defrost.History'))) {
            write('Defrost.History', '[]');
        }

        updateAverages();

        info(
            'Migration auf v1.1.1: Count=' + count +
            ', CompletedCount=' +
            (readNumber(dp('Defrost.CompletedCount')) || 0)
        );
    }


    function checkInputObject() {
        const id = CONFIG.INPUT.DEFROST;

        if (!exists(id)) {
            write('Diagnostics.ValidInput', false);
            write('Diagnostics.Warning', 'Fehlender Eingang: ' + id);
            write('System.Status', 'FEHLER');
            write('System.LastMessage', 'Enteisungsdatenpunkt fehlt');

            warn('Fehlender Eingangsdatenpunkt: ' + id);
            return false;
        }

        write('Diagnostics.ValidInput', true);
        write('Diagnostics.Warning', '');
        return true;
    }

    function captureStartContext(nowMs) {
        const lastEndMs =
            readNumber(dp('Memory.LastEndMs')) || 0;

        const interval =
            lastEndMs > 0
                ? minutesBetween(lastEndMs, nowMs)
                : 0;

        const outdoor =
            readOptionalNumber(CONFIG.INPUT.OUTDOOR);

        const frequency =
            readOptionalNumber(CONFIG.INPUT.COMPRESSOR_FREQUENCY);

        write('Memory.CurrentIntervalMinutes', interval);
        write(
            'Memory.StartOutdoorTempC',
            outdoor === null ? 0 : round1(outdoor)
        );
        write(
            'Memory.StartCompressorFrequencyHz',
            frequency === null ? 0 : round1(frequency)
        );

        return {
            interval: interval,
            outdoor: outdoor,
            frequency: frequency
        };
    }

    function handleDefrostStart(nowMs, trace, initialStart) {
        const context = captureStartContext(nowMs);

        write('Memory.WasActive', true);
        write('Memory.ActiveSinceMs', nowMs);
        write('Defrost.LastStart', nowString());
        write('Defrost.CurrentDurationMinutes', 0);
        increment('Defrost.Count');

        if (context.interval > 0) {
            write('Defrost.LastIntervalMinutes', context.interval);

            const totalInterval =
                (readNumber(dp('Memory.TotalIntervalMinutes')) || 0) +
                context.interval;

            write(
                'Memory.TotalIntervalMinutes',
                round1(totalInterval)
            );
            increment('Memory.IntervalCount');
        }

        updateAverages();

        trace.push(
            initialStart
                ? 'Initialisierung während aktiver Enteisung'
                : 'Enteisungsbeginn erkannt'
        );

        trace.push(
            'BT28=' +
            (context.outdoor === null ? 'n/a' : round1(context.outdoor)) +
            ' °C'
        );

        trace.push(
            'Frequency=' +
            (context.frequency === null ? 'n/a' : round1(context.frequency)) +
            ' Hz'
        );

        if (context.interval > 0) {
            trace.push(
                'Abstand seit letzter Enteisung=' +
                context.interval +
                ' min'
            );
        }
    }

    function handleDefrostEnd(activeSinceMs, nowMs, trace) {
        const lastDuration =
            minutesBetween(activeSinceMs, nowMs);

        const totalDuration =
            (readNumber(dp('Defrost.TotalDurationMinutes')) || 0) +
            lastDuration;

        const interval =
            readNumber(dp('Memory.CurrentIntervalMinutes')) || 0;

        const outdoor =
            readNumber(dp('Memory.StartOutdoorTempC')) || 0;

        const frequency =
            readNumber(dp('Memory.StartCompressorFrequencyHz')) || 0;

        write('Memory.WasActive', false);
        write('Memory.ActiveSinceMs', 0);
        write('Memory.LastEndMs', nowMs);

        write('Defrost.CurrentDurationMinutes', 0);
        write('Defrost.LastDurationMinutes', lastDuration);
        write(
            'Defrost.TotalDurationMinutes',
            round1(totalDuration)
        );
        write('Defrost.LastEnd', nowString());
        write('Defrost.TimeSinceLastDefrostMinutes', 0);

        increment('Defrost.CompletedCount');

        addHistoryEntry({
            Start: formatDateTime(activeSinceMs),
            End: formatDateTime(nowMs),
            DurationMin: lastDuration,
            OutdoorTempC: outdoor,
            CompressorFrequencyHz: frequency,
            IntervalMin: interval
        });

        updateAverages();

        trace.push('Enteisungsende erkannt');
        trace.push('Letzte Dauer=' + lastDuration + ' min');
        trace.push(
            'History=' +
            readHistory().length +
            '/' +
            CONFIG.HISTORY_LIMIT
        );
    }

    function updateTimeSinceLastDefrost(nowMs, active) {
        if (active) {
            write('Defrost.TimeSinceLastDefrostMinutes', 0);
            return;
        }

        const lastEndMs =
            readNumber(dp('Memory.LastEndMs')) || 0;

        write(
            'Defrost.TimeSinceLastDefrostMinutes',
            lastEndMs > 0
                ? minutesBetween(lastEndMs, nowMs)
                : 0
        );
    }

    function updateDefrostMonitor() {
        const trace = ['Aktualisierung gestartet'];
        const status = readNumber(CONFIG.INPUT.DEFROST);

        if (status === null) {
            increment('Diagnostics.InvalidUpdates');

            write('Diagnostics.ValidInput', false);
            write(
                'Diagnostics.Warning',
                'Enteisungsstatus nicht lesbar'
            );
            write('System.Status', 'WARTET');
            write(
                'System.LastMessage',
                'Enteisungsstatus nicht lesbar'
            );

            trace.push('Abbruch: Status nicht lesbar');
            writeTrace(trace);
            return;
        }

        const active = isDefrostActive(status);
        const nowMs = Date.now();

        const initialized =
            readBoolean(dp('Memory.Initialized'));

        const wasActive =
            readBoolean(dp('Memory.WasActive'));

        let activeSinceMs =
            readNumber(dp('Memory.ActiveSinceMs')) || 0;

        write('Defrost.Status', status);
        write('Defrost.Active', active);
        write('Diagnostics.ValidInput', true);
        write('Diagnostics.Warning', '');

        trace.push('Status=' + status);
        trace.push('Active=' + active);
        trace.push('WasActive=' + wasActive);

        if (!initialized) {
            write('Memory.Initialized', true);

            if (active) {
                handleDefrostStart(
                    nowMs,
                    trace,
                    true
                );
            } else {
                write('Memory.WasActive', false);
                write('Memory.ActiveSinceMs', 0);
                trace.push('Initialisierung ohne aktive Enteisung');
            }
        } else if (!wasActive && active) {
            handleDefrostStart(
                nowMs,
                trace,
                false
            );
        } else if (wasActive && active) {
            // Fallback für inkonsistente Altzustände.
            if (!activeSinceMs) {
                activeSinceMs = nowMs;
                write('Memory.ActiveSinceMs', activeSinceMs);
                trace.push(
                    'Warnung: ActiveSinceMs fehlte und wurde neu gesetzt'
                );
            }

            const currentDuration =
                minutesBetween(activeSinceMs, nowMs);

            write(
                'Defrost.CurrentDurationMinutes',
                currentDuration
            );

            trace.push(
                'Enteisung läuft seit ' +
                currentDuration +
                ' min'
            );
        } else if (wasActive && !active) {
            handleDefrostEnd(
                activeSinceMs,
                nowMs,
                trace
            );
        } else {
            write('Memory.WasActive', false);
            write('Memory.ActiveSinceMs', 0);
            write('Defrost.CurrentDurationMinutes', 0);

            trace.push('Keine Enteisung aktiv');
        }

        updateTimeSinceLastDefrost(nowMs, active);
        updateAverages();

        write('System.LastUpdate', nowString());
        write('System.Status', 'BEREIT');
        write(
            'System.LastMessage',
            active
                ? 'Enteisung aktiv'
                : 'Keine Enteisung aktiv'
        );

        trace.push(
            'Completed=' +
            (readNumber(dp('Defrost.CompletedCount')) || 0)
        );
        trace.push(
            'Ø Dauer=' +
            (readNumber(dp('Defrost.AverageDurationMinutes')) || 0) +
            ' min'
        );
        trace.push(
            'Ø Abstand=' +
            (readNumber(dp('Defrost.AverageIntervalMinutes')) || 0) +
            ' min'
        );
        trace.push('Aktualisierung erfolgreich');

        writeTrace(trace);

        debug(
            'Status=' +
            status +
            ', active=' +
            active +
            ', count=' +
            (readNumber(dp('Defrost.Count')) || 0)
        );
    }

    function start() {
        createAllObjects();

        setTimeout(function () {
            migrateTo111();

            write('System.Version', CONFIG.VERSION);
            write('System.Active', true);
            write('System.LastStart', nowString());
            write('System.Status', 'STARTET');
            write(
                'System.LastMessage',
                'Initialisierung läuft'
            );

            if (!checkInputObject()) {
                write('System.Active', false);
                return;
            }

            updateDefrostMonitor();

            scheduleHandle = schedule(
                CONFIG.UPDATE_CRON,
                updateDefrostMonitor
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
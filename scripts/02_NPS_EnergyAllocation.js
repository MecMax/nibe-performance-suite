/******************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * Datei:   02_NPS_EnergyAllocation.js
 * Version: 1.2.1
 * Build:   2026-08-18
 * Gerät:   NIBE S2125-12 + VVM S500
 * Lizenz:  MIT
 *
 * ============================================================================
 * Modulübersicht
 * ============================================================================
 *
 * Dieses Modul verteilt den kumulativen elektrischen Gesamtverbrauch der
 * Wärmepumpe auf virtuelle elektrische Energiezähler für die einzelnen
 * Betriebsarten.
 *
 * Im Gegensatz zu Version 1.0.x erfolgt die Zuordnung nicht mehr ausschließlich
 * anhand der aktuellen Betriebspriorität, sondern auf Basis einer
 * ereignisgesteuerten Zyklusverwaltung.
 *
 * Hintergrund:
 * Die NIBE S-Serie aktualisiert den elektrischen Gesamtverbrauchszähler
 * zeitverzögert. Der Verbrauch eines Verdichtertaktes wird häufig erst mehrere
 * Minuten nach dem Verdichterstopp in den Gesamtzähler übernommen.
 *
 * Dadurch konnte die Energie in Version 1.0.x fälschlicherweise dem
 * Standbybetrieb zugeordnet werden.
 *
 * Version 1.1.0 löst dieses Problem durch eine zyklusbasierte
 * Energiezuordnung mit Nachlaufüberwachung.
 *
 * ============================================================================
 * Abhängigkeiten
 * ============================================================================
 *
 * Erforderlich:
 * Empfohlene Module:
 *   04_NPS_CompressorMonitor.js
 *   07_NPS_StateMachine.js
 *
 * ============================================================================
 * Aufgaben
 * ============================================================================
 *
 * • Überwachung des aktuellen monotonen NPS-Gesamtstromzählers
 * • Erkennung von Verdichterstarts
 * • Erkennung von Verdichterstopps
 * • Verwaltung aktiver Energiezyklen
 * • Nachlaufüberwachung nach Verdichterstopp
 * • Zuordnung aller Verbrauchsdeltas zum aktiven Zyklus
 * • Führung virtueller Energiezähler
 * • Bereitstellung gemeinsamer Current-Energiedatenpunkte
 * • Diagnose und Fehlererkennung
 *
 * ============================================================================
 * Eingänge
 * ============================================================================
 *
 * 0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt
 *   Aktueller monotoner elektrischer Gesamtverbrauch.
 *
 * alias.0.Keller.Waschküche.Waermepumpe.prio
 *   Aktuelle Betriebspriorität.
 *
 * alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)
 *   Verdichterfrequenz zur Zykluserkennung.
 *
 * ============================================================================
 * Virtuelle Energiezähler
 * ============================================================================
 *
 * Heating
 * Warmwater
 * Standby
 * Pool
 * Cooling
 * Unknown
 * TotalAllocated
 *
 * ============================================================================
 * Zustandsmodell
 * ============================================================================
 *
 * BEREIT
 *   │
 *   ├── Verdichterstart
 *   ▼
 * ZYKLUS_AKTIV
 *   │
 *   ├── Verbrauchsdelta → aktive Kategorie
 *   │
 *   └── Verdichterstopp
 *         ▼
 * NACHLAUF
 *   │
 *   ├── Verbrauchsdelta → letzter Zyklus
 *   │
 *   └── Nachlauf beendet
 *         ▼
 * BEREIT
 *
 * ============================================================================
 * Version 1.1.0
 * ============================================================================
 *
 * Neu:
 * ✓ Ereignisgesteuerte Energiezuordnung
 * ✓ Zyklusverwaltung
 * ✓ Nachlauf nach Verdichterstopp
 * ✓ Robuste Behandlung verzögerter NIBE-Zähleraktualisierungen
 * ✓ Erweiterte Diagnosedaten
 * ✓ Verbesserte Wartbarkeit durch modulare interne Logik
 *
 * ============================================================================
 * Version 1.2.0
 * ============================================================================
 *
 * Geändert:
 * ✓ Elektrischer Gesamtverbrauch wird aus dem aktuellen, monotonen NPS-Zähler
 *   0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt bezogen.
 * ✓ Die verzögerte direkte NIBE-Gesamtverbrauchsquelle wird nicht mehr direkt
 *   verwendet. Eingang ist der von ElectricalMeters bereitgestellte
 *   monotone Gesamtstromzähler.
 * ✓ Die Wärmeerzeugung bleibt unverändert Aufgabe von NPS VirtualMeters.
 *
 ******************************************************************************/

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '1.2.1',
        DEBUG: false,
        NPS_ROOT: '0_userdata.0.NPS',
        ROOT: '0_userdata.0.NPS.EnergyAllocation',
        STATE_CREATE_DELAY_MS: 1000,
        ROUND_DIGITS: 3,
        POST_RUN_WINDOW_MINUTES: 10,
        COMPRESSOR_ON_THRESHOLD_HZ: 0.1,
        WATCHDOG_CRON: '*/1 * * * *',
        INPUT: {
            TOTAL_ELECTRICITY: '0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt',
            PRIORITY: 'alias.0.Keller.Waschküche.Waermepumpe.prio',
            COMPRESSOR_FREQUENCY: 'alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)'
        }
    };

    const CYCLE_STATE = {
        READY: 'BEREIT',
        ACTIVE: 'ZYKLUS_AKTIV',
        POST_RUN: 'NACHLAUF'
    };

    let started = false;
    let watchdogHandle = null;
    const subscriptions = [];

    function info(message) { log('[NPS EnergyAllocation] ' + message, 'info'); }
    function warn(message) { log('[NPS EnergyAllocation] ' + message, 'warn'); }
    function debug(message) {
        if (CONFIG.DEBUG) log('[NPS EnergyAllocation DEBUG] ' + message, 'info');
    }

    function dp(path) { return CONFIG.ROOT + '.' + path; }
    function exists(id) { return existsState(id) || existsObject(id); }
    function nowString() { return new Date().toLocaleString('de-DE'); }
    function nowMs() { return Date.now(); }

    function roundValue(value) {
        const factor = Math.pow(10, CONFIG.ROUND_DIGITS);
        return Math.round(Number(value) * factor) / factor;
    }

    function readNumber(id) {
        const s = getState(id);
        if (!s || s.val === undefined || s.val === null || s.val === '') return null;
        const v = Number(s.val);
        return Number.isFinite(v) ? v : null;
    }

    function readString(id) {
        const s = getState(id);
        return (!s || s.val === undefined || s.val === null) ? '' : String(s.val);
    }

    function readBoolean(id) {
        const s = getState(id);
        if (!s || s.val === undefined || s.val === null) return false;
        return s.val === true || s.val === 1 || s.val === 'true';
    }

    function writeId(id, value) {
        if (!existsState(id)) {
            warn('Zieldatenpunkt fehlt, Schreiben übersprungen: ' + id);
            return false;
        }
        const s = getState(id);
        if (!s || s.val !== value) setState(id, value, true);
        return true;
    }

    function write(path, value) { return writeId(dp(path), value); }

    function addTo(path, delta) {
        const current = readNumber(dp(path));
        const updated = roundValue((current === null ? 0 : current) + delta);
        write(path, updated);
        return updated;
    }

    function increment(path) {
        const current = readNumber(dp(path));
        write(path, (current === null ? 0 : current) + 1);
    }

    function writeTrace(lines) {
        write('Diagnostics.Trace', nowString() + '\n' + lines.join('\n'));
    }

    function ensureFolder(id, name) {
        if (!exists(id)) setObject(id, { type: 'folder', common: { name }, native: {} });
    }

    function ensureChannel(id, name) {
        if (!exists(id)) setObject(id, { type: 'channel', common: { name }, native: {} });
    }

    function ensureState(path, initialValue, type, role, name, unit) {
        const id = dp(path);
        if (exists(id)) return;
        const common = { name: name || path, type, role, read: true, write: false };
        if (unit !== undefined) common.unit = unit;
        createState(id, initialValue, true, common);
    }

    function ensureNumber(path, name, unit, role) {
        ensureState(path, 0, 'number', role || (unit === 'kWh' ? 'value.energy' : 'value'), name, unit);
    }

    function ensureString(path, name, role) {
        ensureState(path, '', 'string', role || 'text', name);
    }

    function ensureBoolean(path, name) {
        ensureState(path, false, 'boolean', 'indicator', name);
    }

    function createAllObjects() {
        ensureFolder(CONFIG.ROOT, 'NPS Energy Allocation');
        ensureChannel(dp('Meters'), 'Virtuelle elektrische Energiezähler');
        ensureChannel(dp('Memory'), 'Persistenter Arbeitsspeicher');
        ensureChannel(dp('System'), 'System');
        ensureChannel(dp('Diagnostics'), 'Diagnose');

        ensureNumber('Meters.Heating', 'Elektrische Energie Heizung', 'kWh');
        ensureNumber('Meters.Warmwater', 'Elektrische Energie Brauchwasser', 'kWh');
        ensureNumber('Meters.Standby', 'Elektrische Energie Standby', 'kWh');
        ensureNumber('Meters.Pool', 'Elektrische Energie Pool', 'kWh');
        ensureNumber('Meters.Cooling', 'Elektrische Energie Kühlung', 'kWh');
        ensureNumber('Meters.Unknown', 'Elektrische Energie unbekannt', 'kWh');
        ensureNumber('Meters.TotalAllocated', 'Elektrische Energie insgesamt zugeordnet', 'kWh');

        ensureBoolean('Memory.Initialized', 'Arbeitsspeicher initialisiert');
        ensureNumber('Memory.LastTotalElectricity', 'Letzter elektrischer Gesamtzähler', 'kWh');
        ensureNumber('Memory.LastPriority', 'Letzte Betriebspriorität');
        ensureNumber('Memory.LastCompressorFrequency', 'Letzte Verdichterfrequenz', 'Hz');
        ensureString('Memory.CycleState', 'Persistenter Zykluszustand');
        ensureString('Memory.CycleCategory', 'Persistente Zykluskategorie');
        ensureNumber('Memory.CycleStartMs', 'Startzeit des Zyklus', 'ms');
        ensureNumber('Memory.CompressorStopMs', 'Zeitpunkt Verdichterstopp', 'ms');
        ensureNumber('Memory.PostRunUntilMs', 'Nachlauf gültig bis', 'ms');

        ensureString('System.Version', 'Modulversion');
        ensureBoolean('System.Active', 'Modul aktiv');
        ensureString('System.LastStart', 'Letzter Modulstart', 'date');
        ensureString('System.LastUpdate', 'Letzte Aktualisierung', 'date');
        ensureString('System.Status', 'Status');
        ensureString('System.LastMessage', 'Letzte Meldung');

        ensureBoolean('Diagnostics.ValidInput', 'Eingangsdaten gültig');
        ensureNumber('Diagnostics.LastDelta', 'Letztes Stromdelta', 'kWh');
        ensureString('Diagnostics.LastAssignedCategory', 'Letzte Zuordnung');
        ensureString('Diagnostics.LastAllocationReason', 'Grund der letzten Zuordnung');
        ensureString('Diagnostics.CycleState', 'Aktueller Zykluszustand');
        ensureString('Diagnostics.ActiveCategory', 'Aktive Zykluskategorie');
        ensureNumber('Diagnostics.PostRunRemainingSeconds', 'Verbleibender Nachlauf', 's');
        ensureNumber('Diagnostics.DelayedAllocations', 'Zuordnungen im Nachlauf');
        ensureNumber('Diagnostics.CounterResets', 'Erkannte Zählerresets');
        ensureNumber('Diagnostics.PriorityChanges', 'Erkannte Prioritätswechsel');
        ensureString('Diagnostics.Warning', 'Warnung');
        ensureString('Diagnostics.Trace', 'Diagnosetrace');
    }


    function checkInputObjects() {
        const missing = [];
        Object.keys(CONFIG.INPUT).forEach(key => {
            const id = CONFIG.INPUT[key];
            if (!exists(id)) missing.push(key + ': ' + id);
        });

        if (missing.length > 0) {
            write('Diagnostics.ValidInput', false);
            write('Diagnostics.Warning', 'Fehlende Eingänge: ' + missing.join(' | '));
            write('System.Status', 'FEHLER');
            write('System.LastMessage', 'Mindestens ein Eingangsdatenpunkt fehlt');
            missing.forEach(warn);
            return false;
        }

        write('Diagnostics.ValidInput', true);
        write('Diagnostics.Warning', '');
        return true;
    }

    function categoryForPriority(priority) {
        switch (Number(priority)) {
            case 10: return 'Standby';
            case 20: return 'Warmwater';
            case 30: return 'Heating';
            case 40: return 'Pool';
            case 50:
            case 60: return 'Cooling';
            default: return 'Unknown';
        }
    }

    function isCompressorRunning(frequency) {
        return Number(frequency) > CONFIG.COMPRESSOR_ON_THRESHOLD_HZ;
    }


    function setCycleState(state, category) {
        write('Memory.CycleState', state);
        write('Diagnostics.CycleState', state);
        if (category !== undefined) {
            write('Memory.CycleCategory', category);
            write('Diagnostics.ActiveCategory', category);
        }
    }

    function openCycle(priority, reason) {
        const category = categoryForPriority(priority);
        const timestamp = nowMs();
        write('Memory.CycleStartMs', timestamp);
        write('Memory.CompressorStopMs', 0);
        write('Memory.PostRunUntilMs', 0);
        setCycleState(CYCLE_STATE.ACTIVE, category);
        write('System.Status', 'AKTIV');
        write('System.LastMessage', 'Energiezyklus geöffnet: ' + category);
        write('Diagnostics.LastAllocationReason', reason || 'Verdichterstart');
        debug('Zyklus geöffnet: ' + category);
    }

    function enterPostRun(reason) {
        const timestamp = nowMs();
        const postRunUntil = timestamp + CONFIG.POST_RUN_WINDOW_MINUTES * 60 * 1000;
        const category = readString(dp('Memory.CycleCategory')) || 'Unknown';
        write('Memory.CompressorStopMs', timestamp);
        write('Memory.PostRunUntilMs', postRunUntil);
        setCycleState(CYCLE_STATE.POST_RUN, category);
        write('System.Status', 'NACHLAUF');
        write('System.LastMessage', 'Nachlauf für ' + category + ' bis ' +
            new Date(postRunUntil).toLocaleString('de-DE'));
        write('Diagnostics.LastAllocationReason', reason || 'Verdichterstopp');
        debug('Nachlauf gestartet: ' + category);
    }

    function closeCycle(reason) {
        setCycleState(CYCLE_STATE.READY, '');
        write('Memory.CycleStartMs', 0);
        write('Memory.CompressorStopMs', 0);
        write('Memory.PostRunUntilMs', 0);
        write('Diagnostics.PostRunRemainingSeconds', 0);
        write('System.Status', 'BEREIT');
        write('System.LastMessage', 'Energiezyklus geschlossen');
        write('Diagnostics.LastAllocationReason', reason || 'Nachlauf beendet');
        debug('Zyklus geschlossen');
    }

    function postRunIsValid() {
        const until = readNumber(dp('Memory.PostRunUntilMs'));
        return until !== null && until > nowMs();
    }

    function determineAllocationCategory(currentPriority) {
        const cycleState = readString(dp('Memory.CycleState'));
        const cycleCategory = readString(dp('Memory.CycleCategory'));

        if (cycleState === CYCLE_STATE.ACTIVE && cycleCategory) {
            return { category: cycleCategory, reason: 'Aktiver Verdichterzyklus' };
        }

        if (cycleState === CYCLE_STATE.POST_RUN && cycleCategory && postRunIsValid()) {
            return {
                category: cycleCategory,
                reason: 'Verzögerte Zähleraktualisierung im Nachlauf'
            };
        }

        return {
            category: categoryForPriority(currentPriority),
            reason: 'Aktueller Betriebszustand außerhalb eines Verdichterzyklus'
        };
    }

    function allocateDelta(delta, category, reason) {
        addTo('Meters.' + category, delta);
        addTo('Meters.TotalAllocated', delta);
        write('Diagnostics.LastDelta', roundValue(delta));
        write('Diagnostics.LastAssignedCategory', category);
        write('Diagnostics.LastAllocationReason', reason);
        if (reason === 'Verzögerte Zähleraktualisierung im Nachlauf') {
            increment('Diagnostics.DelayedAllocations');
        }
    }

    function initializeMemory() {
        const total = readNumber(CONFIG.INPUT.TOTAL_ELECTRICITY);
        const priority = readNumber(CONFIG.INPUT.PRIORITY);
        const frequency = readNumber(CONFIG.INPUT.COMPRESSOR_FREQUENCY);
        if (total === null || priority === null || frequency === null) return false;

        write('Memory.LastTotalElectricity', total);
        write('Memory.LastPriority', priority);
        write('Memory.LastCompressorFrequency', frequency);

        const cycleState = readString(dp('Memory.CycleState'));
        if (!cycleState) {
            if (isCompressorRunning(frequency)) {
                openCycle(priority, 'Initialisierung bei laufendem Verdichter');
            } else {
                setCycleState(CYCLE_STATE.READY, '');
            }
        }

        write('Memory.Initialized', true);
        write('Diagnostics.LastDelta', 0);
        write('Diagnostics.LastAssignedCategory', 'None');
        write('Diagnostics.Warning', '');
        write('System.Status', 'BEREIT');
        write('System.LastMessage', 'Arbeitsspeicher initialisiert');
        return true;
    }

    function handlePriorityChange(obj) {
        const previous = Number(obj.oldState ? obj.oldState.val : NaN);
        const current = Number(obj.state ? obj.state.val : NaN);
        if (!Number.isFinite(current)) return;

        write('Memory.LastPriority', current);
        increment('Diagnostics.PriorityChanges');
        write('System.LastUpdate', nowString());
        writeTrace([
            'Prioritätswechsel',
            'vorher=' + previous,
            'aktuell=' + current,
            'Zykluszustand=' + readString(dp('Memory.CycleState')),
            'Zykluskategorie=' + readString(dp('Memory.CycleCategory'))
        ]);
    }

    function handleCompressorChange(obj) {
        const previous = Number(obj.oldState ? obj.oldState.val : NaN);
        const current = Number(obj.state ? obj.state.val : NaN);
        if (!Number.isFinite(current)) return;

        const wasRunning = Number.isFinite(previous) && isCompressorRunning(previous);
        const running = isCompressorRunning(current);

        write('Memory.LastCompressorFrequency', current);
        write('System.LastUpdate', nowString());

        if (!wasRunning && running) {
            const priority = readNumber(CONFIG.INPUT.PRIORITY);
            openCycle(priority === null ? 0 : priority, 'Verdichterstart erkannt');
        } else if (wasRunning && !running) {
            const state = readString(dp('Memory.CycleState'));
            if (state === CYCLE_STATE.ACTIVE) enterPostRun('Verdichterstopp erkannt');
        }

        writeTrace([
            'Verdichterfrequenz geändert',
            'vorher=' + previous,
            'aktuell=' + current,
            'Zykluszustand=' + readString(dp('Memory.CycleState')),
            'Zykluskategorie=' + readString(dp('Memory.CycleCategory'))
        ]);
    }

    function handleEnergyChange(obj) {
        const current = Number(obj.state ? obj.state.val : NaN);

        if (!Number.isFinite(current) || current < 0) {
            write('Diagnostics.ValidInput', false);
            write('Diagnostics.Warning', 'Ungültiger Gesamtverbrauchswert');
            return;
        }

        const last = readNumber(dp('Memory.LastTotalElectricity'));
        if (last === null) {
            write('Memory.LastTotalElectricity', current);
            return;
        }

        const delta = roundValue(current - last);
        write('Memory.LastTotalElectricity', current);
        write('System.LastUpdate', nowString());

        if (delta < 0) {
            increment('Diagnostics.CounterResets');
            write('Diagnostics.LastDelta', delta);
            write('Diagnostics.LastAssignedCategory', 'CounterReset');
            write('Diagnostics.Warning', 'Gesamtzählerreset erkannt; kein Delta verteilt');
            write('System.Status', 'WARNUNG');
            write('System.LastMessage', 'Zählerreset erkannt');
            warn('Zählerreset erkannt: vorher=' + last + ', aktuell=' + current);
            return;
        }

        if (delta === 0) return;

        const priority = readNumber(CONFIG.INPUT.PRIORITY);
        const allocation = determineAllocationCategory(priority === null ? 0 : priority);

        allocateDelta(delta, allocation.category, allocation.reason);

        write('Diagnostics.ValidInput', true);
        write('Diagnostics.Warning', '');
        write('System.Status', 'BEREIT');
        write('System.LastMessage', 'Elektrisches Delta ' + delta + ' kWh zu ' +
            allocation.category + ' zugeordnet');

        writeTrace([
            'Elektrisches Delta erkannt',
            'Gesamtzähler vorher=' + last,
            'Gesamtzähler aktuell=' + current,
            'Delta=' + delta,
            'Kategorie=' + allocation.category,
            'Grund=' + allocation.reason,
            'Zykluszustand=' + readString(dp('Memory.CycleState'))
        ]);
    }

    function watchdog() {
        const state = readString(dp('Memory.CycleState'));

        if (state === CYCLE_STATE.POST_RUN) {
            const until = readNumber(dp('Memory.PostRunUntilMs'));
            const remaining = until === null ? 0 :
                Math.max(0, Math.ceil((until - nowMs()) / 1000));

            write('Diagnostics.PostRunRemainingSeconds', remaining);
            if (remaining <= 0) closeCycle('Nachlaufzeit abgelaufen');
        } else {
            write('Diagnostics.PostRunRemainingSeconds', 0);
        }

    }

    function recoverState() {
        const initialized = readBoolean(dp('Memory.Initialized'));
        if (!initialized) return initializeMemory();

        const total = readNumber(CONFIG.INPUT.TOTAL_ELECTRICITY);
        const priority = readNumber(CONFIG.INPUT.PRIORITY);
        const frequency = readNumber(CONFIG.INPUT.COMPRESSOR_FREQUENCY);
        if (total === null || priority === null || frequency === null) return false;

        // Beim Neustart wird der aktuelle Gesamtzähler als neue Basis übernommen.
        // So wird kein während des Skriptstillstands entstandenes Delta falsch verteilt.
        write('Memory.LastTotalElectricity', total);
        write('Memory.LastPriority', priority);
        write('Memory.LastCompressorFrequency', frequency);

        const state = readString(dp('Memory.CycleState'));

        if (isCompressorRunning(frequency)) {
            if (state !== CYCLE_STATE.ACTIVE) {
                openCycle(priority, 'Recovery bei laufendem Verdichter');
            }
        } else if (state === CYCLE_STATE.ACTIVE) {
            enterPostRun('Recovery: Verdichter nicht mehr aktiv');
        } else if (state === CYCLE_STATE.POST_RUN && !postRunIsValid()) {
            closeCycle('Recovery: Nachlauf abgelaufen');
        } else if (!state) {
            setCycleState(CYCLE_STATE.READY, '');
        }

        return true;
    }

    function registerSubscriptions() {
        subscriptions.push(on(
            { id: CONFIG.INPUT.TOTAL_ELECTRICITY, change: 'ne' },
            handleEnergyChange
        ));
        subscriptions.push(on(
            { id: CONFIG.INPUT.PRIORITY, change: 'ne' },
            handlePriorityChange
        ));
        subscriptions.push(on(
            { id: CONFIG.INPUT.COMPRESSOR_FREQUENCY, change: 'ne' },
            handleCompressorChange
        ));
    }

    function start() {
        createAllObjects();

        setTimeout(function () {
            write('System.Version', CONFIG.VERSION);
            write('System.Active', true);
            write('System.LastStart', nowString());
            write('System.Status', 'STARTET');
            write('System.LastMessage', 'Initialisierung läuft');

            if (!checkInputObjects()) {
                write('System.Active', false);
                return;
            }

            if (!recoverState()) {
                write('System.Status', 'WARTET');
                write('System.LastMessage', 'Eingangswerte nicht vollständig lesbar');
                write('Diagnostics.ValidInput', false);
                return;
            }

            registerSubscriptions();
            watchdogHandle = schedule(CONFIG.WATCHDOG_CRON, watchdog);

            started = true;
            write('Diagnostics.ValidInput', true);
            write('System.Status', 'BEREIT');
            write('System.LastMessage', 'Ereignisgesteuerte Energiezuordnung aktiv');

            info('Version ' + CONFIG.VERSION + ' gestartet');
        }, CONFIG.STATE_CREATE_DELAY_MS);
    }

    onStop(function () {
        subscriptions.forEach(function (subscription) {
            try { unsubscribe(subscription); } catch (error) {}
        });

        if (watchdogHandle !== null) {
            clearSchedule(watchdogHandle);
            watchdogHandle = null;
        }

        if (started && existsState(dp('System.Active'))) {
            write('System.Active', false);
            write('System.Status', 'GESTOPPT');
            write('System.LastMessage', 'Modul wurde beendet');
        }
    }, 1000);

    start();
})();
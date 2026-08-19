/****************************************************************************
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               12_NPS_ElectricalMeters
 * Datei:               12_NPS_ElectricalMeters.js
 * Version:             1.1.1
 * Build:               2026-07-30
 * Modulstatus:         BEOBACHTUNG
 * Architektur-Schicht: Energieerfassung / elektrische Zähler
 *
 * Korrektur 1.0.2
 * ---------------
 * Der NIBE-Stundenwert "Energieverbrauch für Heizung" enthält nach aktueller
 * Kenntnis:
 *
 *   Heizung + Standby + unbekannte/nicht zugeordnete Verbräuche
 *
 * Er wird deshalb ausdrücklich NICHT als reine Heizenergie bezeichnet.
 * Es werden außerdem keine Verdichterzähler aus der Differenz von Gesamt- und
 * Zusatzheizungswerten gebildet.
 *
 * Aufgabe
 * -------
 * Das Modul übernimmt die vier nachlaufenden NIBE-Stundenwerte unverändert in
 * kumulative NPS-Zähler.
 *
 * Ein Wert, der in der aktuellen Stunde bereitgestellt wird, gehört immer zur
 * unmittelbar vorherigen abgeschlossenen Stunde.
 *
 * Das bestehende Zyklusmodell wird nicht verändert.
 *
 * Eingänge
 * --------
 * 1. Heizung + Standby + unbekannt, letzte Stunde
 * 2. Brauchwasser, letzte Stunde
 * 3. Zusatzheizung Heizung, letzte Stunde
 * 4. Zusatzheizung Brauchwasser, letzte Stunde
 *
 * Öffentliche NPS-Zähler
 * ----------------------
 * 0_userdata.0.NPS.ElectricalMeters.Registerwerte.HeizungStandbyUnbekannt
 * 0_userdata.0.NPS.ElectricalMeters.Registerwerte.Brauchwasser
 * 0_userdata.0.NPS.ElectricalMeters.Registerwerte.ZusatzheizungHeizung
 * 0_userdata.0.NPS.ElectricalMeters.Registerwerte.ZusatzheizungBrauchwasser
 * 0_userdata.0.NPS.ElectricalMeters.Gesamt
 *
 * Gesamt ist ausschließlich:
 *
 *   HeizungStandbyUnbekannt + Brauchwasser
 *
 * Keine fachliche Aufteilung in:
 * - reine Heizung
 * - Standby
 * - unbekannt
 * - Verdichter
 *
 * Diese Aufteilung ist mit den vorhandenen NIBE-Stundenregistern nicht
 * belastbar möglich.
 *
 * Erweiterung 1.1.0
 * -----------------
 * Zusätzlich wird ein aktueller, streng monoton steigender Gesamtstromzähler
 * aufgebaut. Zwischen Aktualisierungen des NIBE-Gesamtzählers wird die
 * elektrische Momentanleistung integriert. Der NIBE-Gesamtzähler darf den
 * veröffentlichten NPS-Zähler nur erhöhen, niemals vermindern. Abweichungen
 * werden als Offset und Qualitätsstatus sichtbar gemacht.
 *
 * Änderung 1.1.1
 * ---------------
 * - Aktuell.LetzteKorrektur wird durch Aktuell.KorrekturDelta ersetzt.
 * - Aktuell.GeschaetzterZaehler zeigt NibeGesamt + IntegrierteEnergie.
 ****************************************************************************/

'use strict';

(function () {
    const SCRIPT_NAME = 'NPS ElectricalMeters';
    const VERSION = '1.1.1';

    const NPS_ROOT = '0_userdata.0.NPS';
    const ROOT = NPS_ROOT + '.ElectricalMeters';

    const DEBUG = false;
    const CHECK_CRON = '* * * * *';
    /*
     * Fester Lesezeitpunkt nach Stundenbeginn. Eine reine Prüfung auf
     * State-Änderungen ist ungeeignet, weil identische Stundenwerte gültig sind
     * und dann möglicherweise kein neuer Zeitstempel sichtbar wird.
     */
    const READ_DELAY_MINUTES = 10;
    const SOURCE_UNIT_MODE = 'auto';
    const FALLBACK_SOURCE_UNIT = 'kWh';
    const ROUND_DIGITS = 6;

    // Aktueller Zähler: Integration und Plausibilitätsgrenzen
    const MAX_POWER_GAP_MINUTES = 5;
    const OFFSET_WARNING_KWH = 0.5;
    const OFFSET_CRITICAL_KWH = 2.0;
    const MAX_REASONABLE_POWER_W = 30000;

    const INPUT = Object.freeze({
        HEATING_STANDBY_UNKNOWN:
            'alias.0.Keller.Waschküche.Waermepumpe.' +
            'Energieprotokoll_Energieverbrauch_für_Heizung_in_der_letzten_Stunde',

        WARMWATER:
            'alias.0.Keller.Waschküche.Waermepumpe.' +
            'Energieprotokoll_Energieverbrauch_für_Brauchwasser_in_der_letzten_Stunde',

        AUX_HEATING:
            'alias.0.Keller.Waschküche.Waermepumpe.' +
            'Energieprotokoll_Energieverbrauch_der_Zusatzheizung_für_Heizung_in_der_letzten_Stunde',

        AUX_WARMWATER:
            'alias.0.Keller.Waschküche.Waermepumpe.' +
            'Energieprotokoll_Energieverbrauch_der_Zusatzheizung_für_Brauchwasser_in_der_letzten_Stunde',

        ELECTRIC_POWER:
            'alias.0.Keller.Waschküche.Waermepumpe.' +
            'Energieprotokoll___Tatsächlicher_Energieverbrauch',

        TOTAL_CONSUMPTION:
            'alias.0.Keller.Waschküche.Waermepumpe.Gesamtverbrauch'
    });

    let processing = false;
    let rerunRequested = false;

    function id(path) {
        return ROOT + (path ? '.' + path : '');
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function logInfo(message) {
        log('[' + SCRIPT_NAME + '] ' + message, 'info');
    }

    function logWarn(message) {
        log('[' + SCRIPT_NAME + '] ' + message, 'warn');
    }

    function logError(message) {
        log('[' + SCRIPT_NAME + '] ' + message, 'error');
    }

    function logDebug(message) {
        if (DEBUG) {
            log('[' + SCRIPT_NAME + '] ' + message, 'debug');
        }
    }

    function round(value, digits) {
        const factor = Math.pow(10, digits);
        return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    function finiteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function getStateSafe(stateId) {
        try {
            return getState(stateId);
        } catch (error) {
            return null;
        }
    }

    function getObjectSafe(objectId) {
        try {
            return getObject(objectId);
        } catch (error) {
            return null;
        }
    }

    function readStoredNumber(path, fallback) {
        const state = getStateSafe(id(path));
        const value = state ? finiteNumber(state.val) : null;
        return value === null ? fallback : value;
    }

    function readStoredString(path, fallback) {
        const state = getStateSafe(id(path));
        if (!state || state.val === null || state.val === undefined) {
            return fallback;
        }
        return String(state.val);
    }

    function write(path, value) {
        const stateId = id(path);
        if (!existsState(stateId)) {
            logWarn('Ausgabedatenpunkt fehlt: ' + stateId);
            return;
        }
        setState(stateId, value, true);
    }

    async function ensureFolder(objectId, name) {
        if (!existsObject(objectId)) {
            await setObjectAsync(objectId, {
                type: 'folder',
                common: { name: name },
                native: {}
            });
        }
    }

    async function ensureChannel(objectId, name) {
        if (!existsObject(objectId)) {
            await setObjectAsync(objectId, {
                type: 'channel',
                common: { name: name },
                native: {}
            });
        }
    }

    async function ensureState(path, initialValue, common) {
        const stateId = id(path);

        if (!existsObject(stateId)) {
            await setObjectAsync(stateId, {
                type: 'state',
                common: Object.assign({
                    name: path,
                    type: typeof initialValue,
                    role: 'state',
                    read: true,
                    write: false,
                    def: initialValue
                }, common || {}),
                native: {}
            });
        }

        /*
         * setObjectAsync muss abgeschlossen sein, bevor setStateAsync erfolgt.
         * Dadurch entstehen beim ersten Start keine "State not found"-Warnungen.
         */
        if (!existsState(stateId)) {
            await setStateAsync(stateId, initialValue, true);
        }
    }

    async function ensureNumber(path, name, unit, role) {
        await ensureState(path, 0, {
            name: name,
            type: 'number',
            role: role || 'value.energy',
            unit: unit || 'kWh',
            read: true,
            write: false
        });
    }

    async function ensureString(path, name, role) {
        await ensureState(path, '', {
            name: name,
            type: 'string',
            role: role || 'text',
            read: true,
            write: false
        });
    }

    async function ensureBoolean(path, name, role) {
        await ensureState(path, false, {
            name: name,
            type: 'boolean',
            role: role || 'indicator',
            read: true,
            write: false
        });
    }

    async function migrateLegacyCorrectionState() {
        const legacyId = id('Aktuell.LetzteKorrektur');
        const targetId = id('Aktuell.KorrekturDelta');

        if (!existsState(legacyId) || !existsState(targetId)) {
            return;
        }

        const legacyState = getStateSafe(legacyId);
        const targetState = getStateSafe(targetId);
        const legacyValue = legacyState ? finiteNumber(legacyState.val) : null;
        const targetValue = targetState ? finiteNumber(targetState.val) : null;

        if (legacyValue !== null && (targetValue === null || targetValue === 0)) {
            await setStateAsync(targetId, legacyValue, true);
            logInfo('Altwert aus Aktuell.LetzteKorrektur nach Aktuell.KorrekturDelta übernommen.');
        }
    }

    async function createStructure() {
        await ensureFolder(ROOT, 'NPS ElectricalMeters');

        await ensureChannel(id('Registerwerte'), 'Kumulative NIBE-Stundenregister');
        await ensureNumber(
            'Registerwerte.HeizungStandbyUnbekannt',
            'Elektrische Energie Heizung, Standby und unbekannt',
            'kWh'
        );
        await ensureNumber(
            'Registerwerte.Brauchwasser',
            'Elektrische Energie Brauchwasser',
            'kWh'
        );
        await ensureNumber(
            'Registerwerte.ZusatzheizungHeizung',
            'Elektrische Energie Zusatzheizung Heizung',
            'kWh'
        );
        await ensureNumber(
            'Registerwerte.ZusatzheizungBrauchwasser',
            'Elektrische Energie Zusatzheizung Brauchwasser',
            'kWh'
        );

        await ensureNumber(
            'Gesamt',
            'Elektrische Energie Heizung, Standby, unbekannt und Brauchwasser',
            'kWh'
        );

        await ensureChannel(id('Aktuell'), 'Aktueller elektrischer Gesamtverbrauch');
        await ensureNumber('Aktuell.Leistung', 'Aktuelle elektrische Leistung', 'W', 'value.power');
        await ensureNumber('Aktuell.NibeGesamt', 'Letzter NIBE-Gesamtzählerstand', 'kWh');
        await ensureNumber(
            'Aktuell.Gesamt',
            'Aktueller monotoner elektrischer Gesamtverbrauch',
            'kWh'
        );
        await ensureNumber(
            'Aktuell.IntegrierteEnergie',
            'Seit der letzten NIBE-Zähleränderung integrierte Energie',
            'kWh'
        );
        await ensureNumber(
            'Aktuell.GeschaetzterZaehler',
            'Durch Leistungsintegration geschätzter Gesamtstromzähler',
            'kWh'
        );
        await ensureNumber('Aktuell.Offset', 'Abweichung NPS zu NIBE', 'kWh');
        await ensureNumber(
            'Aktuell.KorrekturDelta',
            'Korrekturdelta der letzten NIBE-Synchronisation',
            'kWh'
        );
        await ensureString('Aktuell.OffsetStatus', 'Bewertung der Zählerabweichung', 'text');
        await ensureBoolean('Aktuell.Valid', 'Aktueller Zähler gültig');
        await ensureString('Aktuell.Status', 'Status des aktuellen Zählers', 'text');
        await ensureString('Aktuell.LastPowerUpdate', 'Letzte Leistungsaktualisierung', 'date');
        await ensureString('Aktuell.LastCounterUpdate', 'Letzte Änderung des NIBE-Zählers', 'date');
        await ensureString('Aktuell.LastIntegration', 'Letzte erfolgreiche Integration', 'date');

        await ensureChannel(id('Hourly'), 'Zuletzt verarbeitete Stunde');
        await ensureNumber(
            'Hourly.HeizungStandbyUnbekannt',
            'Letzte Stunde Heizung, Standby und unbekannt',
            'kWh'
        );
        await ensureNumber('Hourly.Brauchwasser', 'Letzte Stunde Brauchwasser', 'kWh');
        await ensureNumber(
            'Hourly.ZusatzheizungHeizung',
            'Letzte Stunde Zusatzheizung Heizung',
            'kWh'
        );
        await ensureNumber(
            'Hourly.ZusatzheizungBrauchwasser',
            'Letzte Stunde Zusatzheizung Brauchwasser',
            'kWh'
        );
        await ensureNumber(
            'Hourly.Gesamt',
            'Letzte Stunde Heizung, Standby, unbekannt und Brauchwasser',
            'kWh'
        );
        await ensureString('Hourly.PeriodStart', 'Beginn der zuletzt verarbeiteten Stunde', 'date');
        await ensureString('Hourly.PeriodEnd', 'Ende der zuletzt verarbeiteten Stunde', 'date');
        await ensureString('Hourly.ProcessedAt', 'Verarbeitungszeitpunkt', 'date');

        await ensureChannel(id('Memory'), 'Persistenter Verarbeitungsspeicher');
        await ensureString('Memory.LastProcessedPeriod', 'Zuletzt verarbeiteter Periodenschlüssel', 'text');
        await ensureString('Memory.FirstProcessedPeriod', 'Erste verarbeitete Stunde', 'text');
        await ensureNumber('Memory.ProcessedHours', 'Anzahl verarbeiteter Stunden', '');
        await ensureNumber('Memory.MissingHoursDetected', 'Erkannte fehlende Stunden', '');
        await ensureNumber('Memory.LastPowerW', 'Letzter integrierter Leistungswert', 'W', 'value.power');
        await ensureNumber('Memory.LastPowerTimestamp', 'Zeitstempel des letzten Leistungswerts', 'ms', 'value.time');
        await ensureNumber('Memory.LastNibeCounter', 'Letzter erkannter NIBE-Zählerstand', 'kWh');

        await ensureChannel(id('Diagnostics'), 'Diagnose');
        await ensureString('Diagnostics.LastCheck', 'Letzte Prüfung', 'date');
        await ensureString('Diagnostics.LastMessage', 'Letzte Diagnosemeldung', 'text');
        await ensureString('Diagnostics.WaitingForPeriod', 'Aktuell erwartete Stunde', 'text');
        await ensureBoolean('Diagnostics.SourcesReady', 'Alle Quellen aktualisiert');
        await ensureNumber('Diagnostics.MinutesAfterHour', 'Minuten seit Stundenbeginn', 'min', 'value.interval');
        await ensureNumber('Diagnostics.InvalidValueCount', 'Anzahl ungültiger Werte', '');
        await ensureString('Diagnostics.LastInputJson', 'Zuletzt gelesene Eingangswerte', 'json');
        await ensureNumber('Diagnostics.MaxOffset', 'Maximal beobachtete absolute Abweichung', 'kWh');
        await ensureNumber('Diagnostics.PowerGapCount', 'Anzahl verworfener Integrationslücken', '');
        await ensureNumber('Diagnostics.InvalidPowerCount', 'Anzahl ungültiger Leistungswerte', '');
        await ensureString('Diagnostics.LastCurrentMeterMessage', 'Letzte Meldung aktueller Zähler', 'text');

        await ensureChannel(id('System'), 'System');
        await ensureString('System.Version', 'Modulversion', 'text');
        await ensureString('System.Status', 'Modulstatus', 'text');
        await ensureString('System.LastStart', 'Letzter Modulstart', 'date');
        await ensureString('System.LastUpdate', 'Letzte erfolgreiche Verarbeitung', 'date');
        await ensureString('System.Heartbeat', 'Heartbeat', 'date');
        await ensureString('System.LastError', 'Letzter Fehler', 'text');
        await migrateLegacyCorrectionState();
    }

    function sourceUnit(sourceId) {
        if (SOURCE_UNIT_MODE !== 'auto') {
            return SOURCE_UNIT_MODE;
        }

        const object = getObjectSafe(sourceId);

        /*
         * ioBroker typisiert object.common als Vereinigung verschiedener
         * Common-Typen. Nicht jeder dieser Typen deklariert die Eigenschaft
         * "unit", obwohl sie bei State-Objekten vorhanden sein kann.
         * Der lokale Any-Cast beseitigt ausschließlich diese Editorwarnung;
         * die Laufzeitprüfung bleibt vollständig erhalten.
         */
        const common = object && object.common
            ? /** @type {any} */ (object.common)
            : null;
        const unit = common && common.unit !== undefined && common.unit !== null
            ? String(common.unit).trim()
            : '';

        return unit || FALLBACK_SOURCE_UNIT;
    }

    function convertToKWh(rawValue, unit) {
        const value = finiteNumber(rawValue);
        if (value === null) {
            return null;
        }

        const normalized = String(unit || '').toLowerCase().replace(/\s/g, '');

        if (normalized === 'wh') {
            return value / 1000;
        }

        if (normalized === 'mwh') {
            return value * 1000;
        }

        return value;
    }

    function convertPowerToW(rawValue, unit) {
        const value = finiteNumber(rawValue);
        if (value === null) {
            return null;
        }

        const normalized = String(unit || '').toLowerCase().replace(/\s/g, '');
        if (normalized === 'kw') {
            return value * 1000;
        }
        if (normalized === 'mw') {
            return value * 1000000;
        }
        return value;
    }

    function offsetStatus(offsetKWh) {
        const absolute = Math.abs(offsetKWh);
        if (absolute > OFFSET_CRITICAL_KWH) {
            return 'KRITISCH';
        }
        if (absolute > OFFSET_WARNING_KWH) {
            return 'WARNUNG';
        }
        return 'OK';
    }

    function updateOffsetDiagnostics(published, nibe) {
        if (!Number.isFinite(published) || !Number.isFinite(nibe)) {
            return;
        }

        const offset = round(published - nibe, ROUND_DIGITS);
        const status = offsetStatus(offset);
        const maximum = Math.max(
            readStoredNumber('Diagnostics.MaxOffset', 0),
            Math.abs(offset)
        );

        write('Aktuell.Offset', offset);
        write('Aktuell.OffsetStatus', status);
        write('Diagnostics.MaxOffset', round(maximum, ROUND_DIGITS));

        if (status === 'KRITISCH') {
            write('Aktuell.Status', 'KRITISCH – große Abweichung zum NIBE-Zähler');
        } else if (status === 'WARNUNG') {
            write('Aktuell.Status', 'WARNUNG – Abweichung zum NIBE-Zähler');
        } else {
            write('Aktuell.Status', 'OK');
        }
    }

    function publishMonotonic(candidate, reason) {
        const previous = readStoredNumber('Aktuell.Gesamt', 0);
        const validCandidate = finiteNumber(candidate);
        if (validCandidate === null || validCandidate < 0) {
            return previous;
        }

        const published = round(Math.max(previous, validCandidate), ROUND_DIGITS);
        if (published > previous || previous === 0) {
            write('Aktuell.Gesamt', published);
        }
        logDebug('Monotoner Zähler ' + reason + ': ' + previous + ' -> ' + published);
        return published;
    }

    function processPowerValue(reason) {
        const state = getStateSafe(INPUT.ELECTRIC_POWER);
        const unit = sourceUnit(INPUT.ELECTRIC_POWER);
        if (!state) {
            write('Aktuell.Valid', false);
            write('Aktuell.Status', 'WARNUNG – Leistungsquelle fehlt');
            return;
        }

        const powerW = convertPowerToW(state.val, unit);
        const timestamp = finiteNumber(state.ts) || Date.now();
        if (powerW === null || powerW < 0 || powerW > MAX_REASONABLE_POWER_W) {
            write(
                'Diagnostics.InvalidPowerCount',
                readStoredNumber('Diagnostics.InvalidPowerCount', 0) + 1
            );
            write('Aktuell.Valid', false);
            write('Aktuell.Status', 'WARNUNG – ungültiger Leistungswert');
            write('Diagnostics.LastCurrentMeterMessage', 'Ungültige Leistung: ' + state.val + ' ' + unit);
            return;
        }

        write('Aktuell.Leistung', round(powerW, 1));
        write('Aktuell.LastPowerUpdate', new Date(timestamp).toISOString());

        const lastPowerW = readStoredNumber('Memory.LastPowerW', powerW);
        const lastTimestamp = readStoredNumber('Memory.LastPowerTimestamp', 0);

        if (lastTimestamp <= 0 || timestamp <= lastTimestamp) {
            write('Memory.LastPowerW', powerW);
            write('Memory.LastPowerTimestamp', timestamp);
            write('Aktuell.Valid', true);
            write('Diagnostics.LastCurrentMeterMessage', 'Leistungsintegration initialisiert: ' + reason);
            return;
        }

        const gapMinutes = (timestamp - lastTimestamp) / 60000;
        if (gapMinutes > MAX_POWER_GAP_MINUTES) {
            write(
                'Diagnostics.PowerGapCount',
                readStoredNumber('Diagnostics.PowerGapCount', 0) + 1
            );
            write('Memory.LastPowerW', powerW);
            write('Memory.LastPowerTimestamp', timestamp);
            write('Aktuell.Valid', false);
            write('Aktuell.Status', 'WARNUNG – Integrationslücke');
            write(
                'Diagnostics.LastCurrentMeterMessage',
                'Leistungslücke von ' + round(gapMinutes, 1) + ' min; keine Schätzung'
            );
            return;
        }

        const hours = (timestamp - lastTimestamp) / 3600000;
        const deltaKWh = round(((lastPowerW + powerW) / 2 / 1000) * hours, ROUND_DIGITS);
        const current = readStoredNumber('Aktuell.Gesamt', 0);
        const published = publishMonotonic(current + Math.max(0, deltaKWh), 'Leistungsintegration');

        const integratedEnergy = round(
            readStoredNumber('Aktuell.IntegrierteEnergie', 0) + Math.max(0, deltaKWh),
            ROUND_DIGITS
        );
        write('Aktuell.IntegrierteEnergie', integratedEnergy);

        const nibeBasis = readStoredNumber('Aktuell.NibeGesamt', 0);
        const estimatedCounter = nibeBasis > 0
            ? round(nibeBasis + integratedEnergy, ROUND_DIGITS)
            : published;
        write('Aktuell.GeschaetzterZaehler', estimatedCounter);
        write('Aktuell.LastIntegration', nowIso());
        write('Memory.LastPowerW', powerW);
        write('Memory.LastPowerTimestamp', timestamp);
        write('Aktuell.Valid', true);

        const nibe = readStoredNumber('Aktuell.NibeGesamt', 0);
        if (nibe > 0) {
            updateOffsetDiagnostics(published, nibe);
        }

        write(
            'Diagnostics.LastCurrentMeterMessage',
            'Integriert ' + deltaKWh + ' kWh aus ' + round(gapMinutes, 2) + ' min (' + reason + ')'
        );
    }

    function processNibeCounter(reason) {
        const state = getStateSafe(INPUT.TOTAL_CONSUMPTION);
        const unit = sourceUnit(INPUT.TOTAL_CONSUMPTION);
        if (!state) {
            write('Aktuell.Valid', false);
            write('Aktuell.Status', 'WARNUNG – NIBE-Gesamtzähler fehlt');
            return;
        }

        const nibe = convertToKWh(state.val, unit);
        if (nibe === null || nibe <= 0) {
            write('Aktuell.Valid', false);
            write('Aktuell.Status', 'WARNUNG – ungültiger NIBE-Gesamtzähler');
            write('Diagnostics.LastCurrentMeterMessage', 'Ungültiger NIBE-Zähler: ' + state.val + ' ' + unit);
            return;
        }

        const normalized = round(nibe, ROUND_DIGITS);
        const previousRaw = readStoredNumber('Memory.LastNibeCounter', 0);
        const previousPublished = readStoredNumber('Aktuell.Gesamt', 0);

        write('Aktuell.NibeGesamt', normalized);

        if (previousRaw !== normalized) {
            write('Aktuell.LastCounterUpdate', new Date(finiteNumber(state.ts) || Date.now()).toISOString());
            write('Memory.LastNibeCounter', normalized);
            write('Aktuell.IntegrierteEnergie', 0);
        }

        const integratedEnergy = readStoredNumber('Aktuell.IntegrierteEnergie', 0);
        const estimatedCounter = round(normalized + integratedEnergy, ROUND_DIGITS);
        write('Aktuell.GeschaetzterZaehler', estimatedCounter);

        const published = publishMonotonic(normalized, 'NIBE-Verankerung');
        const correction = round(published - previousPublished, ROUND_DIGITS);
        write('Aktuell.KorrekturDelta', correction);
        updateOffsetDiagnostics(published, normalized);
        write('Aktuell.Valid', true);
        write(
            'Diagnostics.LastCurrentMeterMessage',
            'NIBE-Zähler ' + normalized + ' kWh übernommen; Veröffentlichung ' + published +
            ' kWh; Korrektur ' + correction + ' kWh (' + reason + ')'
        );
    }

    function processCurrentMeters(reason) {
        processNibeCounter(reason);
        processPowerValue(reason);
    }

    function localHourStart(date) {
        const d = new Date(date.getTime());
        d.setMinutes(0, 0, 0);
        return d;
    }

    function periodKey(date) {
        const pad = value => String(value).padStart(2, '0');
        return date.getFullYear() + '-' +
            pad(date.getMonth() + 1) + '-' +
            pad(date.getDate()) + 'T' +
            pad(date.getHours()) + ':00';
    }

    function parsePeriodKey(key) {
        const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00$/.exec(String(key || ''));
        if (!match) {
            return null;
        }

        const date = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            0, 0, 0
        );

        return Number.isFinite(date.getTime()) ? date : null;
    }

    function expectedPeriod() {
        const currentHourStart = localHourStart(new Date());
        const start = new Date(currentHourStart.getTime() - 3600000);

        return {
            currentHourStart: currentHourStart,
            start: start,
            end: currentHourStart,
            key: periodKey(start)
        };
    }

    function calculateMissingHours(lastKey, currentKey) {
        const last = parsePeriodKey(lastKey);
        const current = parsePeriodKey(currentKey);

        if (!last || !current) {
            return 0;
        }

        const distance = Math.round((current.getTime() - last.getTime()) / 3600000);
        return Math.max(0, distance - 1);
    }

    function readSource(name, sourceId, currentHourStartMs) {
        const state = getStateSafe(sourceId);
        const unit = sourceUnit(sourceId);

        if (!state) {
            return {
                name: name,
                id: sourceId,
                valid: false,
                ready: false,
                reason: 'State nicht vorhanden',
                raw: null,
                kWh: null,
                unit: unit,
                ts: null
            };
        }

        const kWh = convertToKWh(state.val, unit);
        const ts = finiteNumber(state.ts);

        return {
            name: name,
            id: sourceId,
            valid: kWh !== null && kWh >= 0,
            ready: kWh !== null && kWh >= 0,
            reason: kWh === null
                ? 'Wert nicht numerisch'
                : (kWh < 0 ? 'Wert negativ' : ''),
            raw: state.val,
            kWh: kWh === null ? null : round(kWh, ROUND_DIGITS),
            unit: unit,
            ts: ts
        };
    }

    function collectInputs(period) {
        return {
            heatingStandbyUnknown: readSource(
                'Heizung, Standby und unbekannt',
                INPUT.HEATING_STANDBY_UNKNOWN,
                period.currentHourStart.getTime()
            ),
            warmwater: readSource(
                'Brauchwasser',
                INPUT.WARMWATER,
                period.currentHourStart.getTime()
            ),
            auxHeating: readSource(
                'Zusatzheizung Heizung',
                INPUT.AUX_HEATING,
                period.currentHourStart.getTime()
            ),
            auxWarmwater: readSource(
                'Zusatzheizung Brauchwasser',
                INPUT.AUX_WARMWATER,
                period.currentHourStart.getTime()
            )
        };
    }

    function inputList(inputs) {
        return [
            inputs.heatingStandbyUnknown,
            inputs.warmwater,
            inputs.auxHeating,
            inputs.auxWarmwater
        ];
    }

    function addCounter(path, delta) {
        const current = readStoredNumber(path, 0);
        const next = round(current + delta, ROUND_DIGITS);
        write(path, next);
        return next;
    }

    function processExpectedHour(reason) {
        if (processing) {
            rerunRequested = true;
            return;
        }

        processing = true;

        try {
            const period = expectedPeriod();
            const lastProcessed = readStoredString('Memory.LastProcessedPeriod', '');

            write('Diagnostics.LastCheck', nowIso());
            write('Diagnostics.WaitingForPeriod', period.key);
            write('System.Heartbeat', nowIso());

            if (lastProcessed === period.key) {
                write('Diagnostics.SourcesReady', true);
                write('Diagnostics.LastMessage', 'Stunde bereits verarbeitet: ' + period.key);
                write('System.Status', 'OK – warte auf nächste Stunde');
                return;
            }

            const minutesAfterHour =
                (Date.now() - period.currentHourStart.getTime()) / 60000;

            if (minutesAfterHour < READ_DELAY_MINUTES) {
                const message =
                    'Warte bis Minute ' + READ_DELAY_MINUTES +
                    ' auf die NIBE-Stundenwerte für ' + period.key;

                write('Diagnostics.SourcesReady', false);
                write('Diagnostics.MinutesAfterHour', round(minutesAfterHour, 1));
                write('Diagnostics.LastMessage', message);
                write('System.Status', 'WARTE – Stundenbeginn');
                logDebug(message);
                return;
            }

            const inputs = collectInputs(period);
            const list = inputList(inputs);

            write('Diagnostics.LastInputJson', JSON.stringify({
                checkedAt: nowIso(),
                expectedPeriod: period.key,
                sources: list
            }));

            const invalid = list.filter(item => !item.valid);
            if (invalid.length > 0) {
                write('Diagnostics.SourcesReady', false);
                write(
                    'Diagnostics.InvalidValueCount',
                    readStoredNumber('Diagnostics.InvalidValueCount', 0) + invalid.length
                );

                const message = 'Ungültige Eingangswerte: ' +
                    invalid.map(item => item.name + ' (' + item.reason + ')').join(', ');

                write('Diagnostics.LastMessage', message);
                write('System.Status', 'WARNUNG – ungültige Eingangswerte');
                logWarn(message);
                return;
            }

            write('Diagnostics.SourcesReady', true);
            write('Diagnostics.MinutesAfterHour', round(minutesAfterHour, 1));

            const heatingStandbyUnknown = inputs.heatingStandbyUnknown.kWh;
            const warmwater = inputs.warmwater.kWh;
            const auxHeating = inputs.auxHeating.kWh;
            const auxWarmwater = inputs.auxWarmwater.kWh;
            const total = round(heatingStandbyUnknown + warmwater, ROUND_DIGITS);

            addCounter('Registerwerte.HeizungStandbyUnbekannt', heatingStandbyUnknown);
            addCounter('Registerwerte.Brauchwasser', warmwater);
            addCounter('Registerwerte.ZusatzheizungHeizung', auxHeating);
            addCounter('Registerwerte.ZusatzheizungBrauchwasser', auxWarmwater);
            addCounter('Gesamt', total);

            write('Hourly.HeizungStandbyUnbekannt', heatingStandbyUnknown);
            write('Hourly.Brauchwasser', warmwater);
            write('Hourly.ZusatzheizungHeizung', auxHeating);
            write('Hourly.ZusatzheizungBrauchwasser', auxWarmwater);
            write('Hourly.Gesamt', total);
            write('Hourly.PeriodStart', period.start.toISOString());
            write('Hourly.PeriodEnd', period.end.toISOString());
            write('Hourly.ProcessedAt', nowIso());

            const missingHours = calculateMissingHours(lastProcessed, period.key);
            if (missingHours > 0) {
                write(
                    'Memory.MissingHoursDetected',
                    readStoredNumber('Memory.MissingHoursDetected', 0) + missingHours
                );
                logWarn(
                    'Zwischen ' + lastProcessed + ' und ' + period.key +
                    ' wurden ' + missingHours + ' nicht verarbeitete Stunde(n) erkannt. ' +
                    'Es erfolgt keine Schätzung.'
                );
            }

            if (!readStoredString('Memory.FirstProcessedPeriod', '')) {
                write('Memory.FirstProcessedPeriod', period.key);
            }

            write('Memory.LastProcessedPeriod', period.key);
            write(
                'Memory.ProcessedHours',
                readStoredNumber('Memory.ProcessedHours', 0) + 1
            );

            const message =
                'Stunde ' + period.key + ' verarbeitet: ' +
                'Heizung/Standby/Unbekannt=' + heatingStandbyUnknown + ' kWh, ' +
                'Brauchwasser=' + warmwater + ' kWh, ' +
                'ZH Heizung=' + auxHeating + ' kWh, ' +
                'ZH Brauchwasser=' + auxWarmwater + ' kWh';

            write('Diagnostics.LastMessage', message);
            write('System.LastUpdate', nowIso());
            write('System.Status', 'OK');
            write('System.LastError', '');

            logInfo(message);
        } catch (error) {
            const message = error && error.stack ? error.stack : String(error);
            write('System.Status', 'FEHLER');
            write('System.LastError', message);
            write('Diagnostics.LastMessage', message);
            logError(message);
        } finally {
            processing = false;

            if (rerunRequested) {
                rerunRequested = false;
                setTimeout(function () {
                    processExpectedHour('nachgeholte Anforderung');
                }, 250);
            }
        }
    }

    function subscribeSources() {
        [
            'HEATING_STANDBY_UNKNOWN',
            'WARMWATER',
            'AUX_HEATING',
            'AUX_WARMWATER'
        ].forEach(key => {
            on({ id: INPUT[key], change: 'any' }, function () {
                setTimeout(function () {
                    processExpectedHour('Quellenänderung ' + key);
                }, 1500);
            });
        });

        on({ id: INPUT.ELECTRIC_POWER, change: 'any' }, function () {
            processPowerValue('Leistungsänderung');
        });

        on({ id: INPUT.TOTAL_CONSUMPTION, change: 'any' }, function () {
            processNibeCounter('Zähleränderung');
        });
    }

    function checkInputs() {
        const missing = Object.keys(INPUT).filter(key => !existsState(INPUT[key]));

        if (missing.length === 0) {
            return true;
        }

        missing.forEach(key => {
            logWarn('Eingang fehlt: ' + key + ' → ' + INPUT[key]);
        });

        return false;
    }

    function start() {
        /*
         * Subscriptions und Schedule werden synchron registriert. Nur die
         * Objekterzeugung bleibt asynchron.
         */
        subscribeSources();

        schedule(CHECK_CRON, function () {
            processExpectedHour('Minutenprüfung');
            processCurrentMeters('Minutenprüfung');
        });

        createStructure().then(function () {
            write('System.Version', VERSION);
            write('System.LastStart', nowIso());
            write('System.Heartbeat', nowIso());
            write('System.Status', 'START');
            write('System.LastError', '');

            if (!checkInputs()) {
                write('System.Status', 'WARNUNG – Eingänge fehlen');
                write(
                    'Diagnostics.LastMessage',
                    'Mindestens ein konfigurierter Alias-Datenpunkt fehlt.'
                );
            }

            setTimeout(function () {
                processExpectedHour('Skriptstart');
                processCurrentMeters('Skriptstart');
            }, 2500);

            logInfo(
                'Version ' + VERSION +
                ' gestartet. Verarbeitung ab Minute ' +
                READ_DELAY_MINUTES +
                '; identische Stundenwerte sind zulässig; aktueller Zähler monoton.'
            );
        }).catch(function (error) {
            const message = error && error.stack ? error.stack : String(error);
            logError('Startfehler: ' + message);
        });
    }

    start();
})();
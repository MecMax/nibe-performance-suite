/****************************************************************************
 * Version 2.5.2 | 2026-08-19
 * - Bugfix: Alias für Zusatzheizungsleistung auf
 *   `Leistung_interne_Zusatzheizung` korrigiert.
 * - Modbus-Zuordnung: 1027 / 31027, Einheit kW.
 * NIBE Performance Suite (NPS) für ioBroker
 * -----------------------------------------------------------------------------
 * Modul:               98_NPS_CycleRecorder 
 * Datei:               98_NPS_CycleRecorder.js
 * Version:             2.5.2
 * Build:               2026-08-19
 * Modulstatus:         STABIL
 * Architektur-Schicht: Laufzeitaufzeichnung / Rohdaten-Persistenz
 * Coding Standard:     NPS-CS-1.0
 * Gerät:               NIBE S2125-12 + VVM S500
 * Lizenz:              MIT
 *
 * Aufgabe
 * -------
 * Zeichnet vollständige Warmwasserzyklen mit Vorlaufpuffer, Hauptzyklus und
 * Nachlauf auf. Nach Abschluss veröffentlicht das Modul einen vollständigen
 * Rohdatensatz einschließlich Messreihen und kompakter Zusammenfassung für
 * die nachgelagerte Einzelzyklusanalyse.
 *
 * Eingänge (nur lesend)
 * ---------------------
 * - Öffentliche Prozesssignale aus 06_NPS_ProcessSignals
 * - Zustands- und Diagnosedaten aus 07_NPS_StateMachine
 * - Verdichterdaten aus 04_NPS_CompressorMonitor
 * - Temperatur-, Energie- und virtuelle Zählerwerte der NPS
 * - Elektrische Leistung und aktueller Gesamtzähler aus 12_NPS_ElectricalMeters
 * - Ergänzende Anlagen-Aliase nur für noch nicht zentral veröffentlichte Messgrößen
 *
 * Ausgänge / Public API
 * ---------------------
 * - 0_userdata.0.NPS.CycleRecorder.System.*
 * - 0_userdata.0.NPS.CycleRecorder.Recording.*
 * - 0_userdata.0.NPS.CycleRecorder.LastRun.*
 * - 0_userdata.0.NPS.CycleRecorder.Diagnostics.*
 * - Optionaler JSON-Dateiexport unter NPS/Recorder
 *
 * Trigger und Ablauf
 * ------------------
 * - Permanentes Sampling im konfigurierten Intervall
 * - Ringpuffer für den Vorlauf
 * - Start bei erkanntem Warmwasserbetrieb
 * - Ende nach Zyklusende und vollständigem Nachlauf
 * - LastRun.Id wird als Commit-Signal zuletzt geschrieben
 *
 * V1-Baseline-Abhängigkeiten (Stand 2026-08-19)
 * ----------------------------------------------
 * - 01_NPS_VirtualMeters 1.2.1
 * - 02_NPS_EnergyAllocation 1.2.1
 * - 03_NPS_TemperatureMonitor 1.0.2
 * - 04_NPS_CompressorMonitor 1.0.2
 * - 06_NPS_ProcessSignals 1.1.1
 * - 07_NPS_StateMachine 1.2.0
 * - 08_NPS_EventEngine 1.2.0
 * - 09_NPS_NotificationBridge 1.2.2
 * - 12_NPS_ElectricalMeters 1.1.1
 * - ioBroker JavaScript-Adapter
 *
 * Die Versionsangaben dokumentieren den getesteten NPS-V1-Baseline-Stand.
 * Sie sind keine zusätzliche Laufzeitprüfung des CycleRecorders.
 *
 * Architekturregeln
 * -----------------
 * - Keine Zustandsentscheidung und keine fachliche Zyklusanalyse
 * - Keine Rekonstruktion historischer Zyklen
 * - Single Writer für 0_userdata.0.NPS.CycleRecorder
 * - Recorder-Schema 2 bleibt der Datenvertrag zum CycleAnalyzer
 * - LastRun.Id ist das abschließende Commit-Signal
 * - Elektrische Leistung und Gesamtenergie ausschließlich aus ElectricalMeters
 * - Thermische Zähler ausschließlich aus VirtualMeters
 * - Direkter Wärmeleistungs-Alias bleibt vorerst reiner Diagnosewert
 *
 * Änderungsverlauf
 * ----------------
 * 2.5.0 | 2026-07-30
 *       | Elektrische Momentanleistung wird ausschließlich aus
 *       | NPS.ElectricalMeters.Aktuell.Leistung gelesen.
 *       | Elektrischer Gesamtzähler wird ausschließlich aus
 *       | NPS.ElectricalMeters.Aktuell.Gesamt gelesen.
 *       | Direkte Alias-Zugriffe auf elektrische Leistung und
 *       | Gesamtverbrauch wurden entfernt.
 *       | Wärmeleistung bleibt bis zur Erweiterung von VirtualMeters ein
 *       | nicht bilanzrelevanter Diagnose-Alias.
 * 2.4.0 | 2026-07-29
 *       | Thermische Zyklusenergie wird ausschließlich aus den typbezogenen
 *       | NPS VirtualMeters inklusive Zusatzheizung gebildet.
 *       | Direkte Alias-Zugriffe auf die NIBE-Wärmezähler wurden entfernt.
 *       | Diagnose-Samples und Datenvertrag Schema 2 bleiben kompatibel.
 * 2.3.0 | 2026-07-28
 *       | Elektrische Zyklusenergie wird innerhalb triggerStart..triggerEnd
 *       | aus der Momentanleistung trapezförmig integriert.
 *       | Zusatzheizungsleistung wird separat integriert und abhängig von
 *       | ELECTRIC_POWER_INCLUDES_AUXILIARY zur Gesamtenergie addiert.
 *       | Thermische Zyklusenergie stammte aus den typbezogenen NIBE-Zählern
 *       | Brauchwasser_nur_Verdichter bzw. Heizung_nur_Verdichter.
 *       | Langsame Gesamtzähler bleiben ausschließlich Diagnosewerte.
 *       | Datenvertrag Schema 2 und LastRun-API bleiben kompatibel.
 * 2.2.0 | 2026-07-27
 *       | COP-Bilanzierung vereinheitlicht.
 *       | Elektrische Zyklusenergie wird aus dem Alias-Gesamtverbrauch
 *       | ausschließlich zwischen triggerStart und triggerEnd gebildet.
 *       | Thermische Zyklusenergie wird typabhängig aus den VirtualMeters
 *       | inklusive Zusatzheizung im selben Bilanzzeitraum gebildet.
 *       | Vor- und Nachlauf bleiben reine Diagnosebereiche.
 *       | Start-, End- und Deltawerte werden im Summary nachvollziehbar gespeichert.
 * 2.0.1 | 2026-07-20
 *       | Header auf NPS-CS-1.0 erweitert und Schnittstellen dokumentiert.
 *       | CONFIG.VERSION auf 2.0.1 angehoben.
 *       | LastRun.Id wird nun nach allen Nutzdaten als Commit-Signal geschrieben.
 *       | Keine Änderung an Sampling, Zykluserkennung, Puffern, Messwerten,
 *       | Zusammenfassung oder Dateiexport.
 * 2.0.0 | 2026-07-15
 *       | Produktive Neufassung auf Basis der realen Alias- und NPS-Exporte.
 ****************************************************************************/

(async () => {

const CONFIG = {
    VERSION: '2.5.2',
    ROOT: '0_userdata.0.NPS.CycleRecorder',
    SAMPLE_SECONDS: 10,
    PREBUFFER_MINUTES: 15,
    POSTBUFFER_MINUTES: 15,
    FILE_EXPORT_ENABLED: true,
    FILE_ADAPTER: '0_userdata.0',
    FILE_DIRECTORY: 'NPS/Recorder',

    // Elektrische Zyklusenergie wird aus der Momentanleistung integriert.
    // Einheit der Quelle ElectricPower: W.
    ELECTRIC_POWER_UNIT: 'W',

    // Einheit von Leistung_interne_Zusatzheizung. Bei NIBE üblicherweise kW.
    AUXILIARY_POWER_UNIT: 'kW',

    // false: ElectricPower enthält die Zusatzheizung nicht; Zusatzleistung addieren.
    // true:  ElectricPower enthält bereits die Zusatzheizung; nicht doppelt addieren.
    ELECTRIC_POWER_INCLUDES_AUXILIARY: false,

    DEBUG: false,
};

const ALIAS_IDS = {
    Priority: 'alias.0.Keller.Waschküche.Waermepumpe.prio',
    CompressorFrequency: 'alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)',
    CompressorStatus: 'alias.0.Keller.Waschküche.Waermepumpe.Verdichterstatus',
    Supply: 'alias.0.Keller.Waschküche.Waermepumpe.Kondensatorfühler_Vorlauf_(EB101-BT12)',
    Return: 'alias.0.Keller.Waschküche.Waermepumpe.Ruecklauf',
    Outdoor: 'alias.0.Keller.Waschküche.Waermepumpe.Aussentemperatur',
    HotWaterTop: 'alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_oben',
    HotWaterCharging: 'alias.0.Keller.Waschküche.Waermepumpe.Brauchwasserbereitung',
    Defrost: 'alias.0.Keller.Waschküche.Waermepumpe.Enteisung',
    TotalProduction: 'alias.0.Keller.Waschküche.Waermepumpe.Gesamtproduktion',
    HeatPower: 'alias.0.Keller.Waschküche.Waermepumpe.Erzeugte_Leistung_Wärme_(EB101)',
    AuxiliaryPower: 'alias.0.Keller.Waschküche.Waermepumpe.Leistung_interne_Zusatzheizung',
};

const NPS_IDS = {
    ProcessWarmwater: '0_userdata.0.NPS.ProcessSignals.Betriebsart.Brauchwasser',
    ProcessHeating: '0_userdata.0.NPS.ProcessSignals.Betriebsart.Heizung',
    ProcessStandby: '0_userdata.0.NPS.ProcessSignals.Betriebsart.Standby',
    ProcessCompressorRunning: '0_userdata.0.NPS.ProcessSignals.Verdichter.Laeuft',
    StateCurrent: '0_userdata.0.NPS.StateMachine.Current.State',
    StatePrevious: '0_userdata.0.NPS.StateMachine.Diagnostics.PreviousState',
    StateTransition: '0_userdata.0.NPS.StateMachine.Diagnostics.LastTransition',
    StateTransitionCount: '0_userdata.0.NPS.StateMachine.Diagnostics.TransitionCount',
    CompressorFrequency: '0_userdata.0.NPS.CompressorMonitor.Compressor.Frequency',
    CompressorRunning: '0_userdata.0.NPS.CompressorMonitor.Compressor.Running',
    CompressorStatus: '0_userdata.0.NPS.CompressorMonitor.Compressor.Status',
    CompressorStarts: '0_userdata.0.NPS.CompressorMonitor.Compressor.Starts',
    CompressorRuntime: '0_userdata.0.NPS.CompressorMonitor.Compressor.Runtime',
    Supply: '0_userdata.0.NPS.TemperatureMonitor.Temperatures.Supply',
    Return: '0_userdata.0.NPS.TemperatureMonitor.Temperatures.Return',
    Spread: '0_userdata.0.NPS.TemperatureMonitor.Temperatures.Spread',
    ElectricPower: '0_userdata.0.NPS.ElectricalMeters.Aktuell.Leistung',
    ElectricTotal: '0_userdata.0.NPS.ElectricalMeters.Aktuell.Gesamt',
    ElectricWarmwater: '0_userdata.0.NPS.EnergyAllocation.Meters.Warmwater',
    ElectricHeating: '0_userdata.0.NPS.EnergyAllocation.Meters.Heating',
    ElectricStandby: '0_userdata.0.NPS.EnergyAllocation.Meters.Standby',
    ElectricUnknown: '0_userdata.0.NPS.EnergyAllocation.Meters.Unknown',
    ElectricAllocated: '0_userdata.0.NPS.EnergyAllocation.Meters.TotalAllocated',
    HeatWarmwater: '0_userdata.0.NPS.VirtualMeters.Brauchwasser.NurVerdichter',
    HeatWarmwaterTotal: '0_userdata.0.NPS.VirtualMeters.Brauchwasser.InklusiveZusatzheizung',
    HeatHeating: '0_userdata.0.NPS.VirtualMeters.Heizung.NurVerdichter',
    HeatHeatingTotal: '0_userdata.0.NPS.VirtualMeters.Heizung.InklusiveZusatzheizung',
    EventSequence: '0_userdata.0.NPS.Events.Verdichter.Sequenz',
    EventType: '0_userdata.0.NPS.Events.Verdichter.Typ',
    EventTitle: '0_userdata.0.NPS.Events.Verdichter.Titel',
    EventTimestamp: '0_userdata.0.NPS.Events.Verdichter.Zeitstempel',
    PublishedCount: '0_userdata.0.NPS.NotificationBridge.Statistics.PublishedCount',
};

const TARGET = {
    SYSTEM_VERSION: `${CONFIG.ROOT}.System.Version`,
    SYSTEM_ACTIVE: `${CONFIG.ROOT}.System.Active`,
    SYSTEM_STATUS: `${CONFIG.ROOT}.System.Status`,
    SYSTEM_LAST_MESSAGE: `${CONFIG.ROOT}.System.LastMessage`,
    SYSTEM_LAST_START: `${CONFIG.ROOT}.System.LastStart`,
    SYSTEM_LAST_UPDATE: `${CONFIG.ROOT}.System.LastUpdate`,

    RECORDING_ACTIVE: `${CONFIG.ROOT}.Recording.Active`,
    RECORDING_PHASE: `${CONFIG.ROOT}.Recording.Phase`,
    RECORDING_TYPE: `${CONFIG.ROOT}.Recording.Type`,
    RECORDING_START: `${CONFIG.ROOT}.Recording.Start`,
    RECORDING_END: `${CONFIG.ROOT}.Recording.End`,
    RECORDING_SAMPLES: `${CONFIG.ROOT}.Recording.SampleCount`,

    LAST_RUN_ID: `${CONFIG.ROOT}.LastRun.Id`,
    LAST_RUN_TYPE: `${CONFIG.ROOT}.LastRun.Type`,
    LAST_RUN_START: `${CONFIG.ROOT}.LastRun.Start`,
    LAST_RUN_END: `${CONFIG.ROOT}.LastRun.End`,
    LAST_RUN_DURATION: `${CONFIG.ROOT}.LastRun.DurationSeconds`,
    LAST_RUN_SAMPLES: `${CONFIG.ROOT}.LastRun.SampleCount`,
    LAST_RUN_COP: `${CONFIG.ROOT}.LastRun.COP`,
    LAST_RUN_EL: `${CONFIG.ROOT}.LastRun.ElectricEnergyKWh`,
    LAST_RUN_HEAT: `${CONFIG.ROOT}.LastRun.HeatEnergyKWh`,
    LAST_RUN_JSON: `${CONFIG.ROOT}.LastRun.Json`,
    LAST_RUN_FILE: `${CONFIG.ROOT}.LastRun.File`,

    DIAG_WARNING: `${CONFIG.ROOT}.Diagnostics.Warning`,
    DIAG_TRACE: `${CONFIG.ROOT}.Diagnostics.Trace`,
    DIAG_DROPPED: `${CONFIG.ROOT}.Diagnostics.DroppedSamples`,
    DIAG_RUN_COUNT: `${CONFIG.ROOT}.Diagnostics.RunCount`,
    DIAG_MISSING: `${CONFIG.ROOT}.Diagnostics.MissingSources`,
};

const prebuffer = [];
const missingSources = new Set();
let activeRun = null;
let postBufferUntil = 0;
let droppedSamples = 0;
let runCount = 0;

function nowText() {
    return new Date().toLocaleString('de-DE');
}

function debug(message) {
    if (CONFIG.DEBUG) log(`[NPS CycleRecorder] ${message}`, 'info');
}

function safeState(id) {
    if (!id) return null;
    try {
        if (!existsState(id)) {
            missingSources.add(id);
            return null;
        }
        const state = getState(id);
        return state && state.val !== null && state.val !== undefined ? state.val : null;
    } catch (error) {
        missingSources.add(id);
        return null;
    }
}

function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function boolOrNull(value) {
    return value === true || value === false ? value : null;
}

function round(value, decimals = 3) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function difference(endValue, startValue) {
    const end = numberOrNull(endValue);
    const start = numberOrNull(startValue);
    if (end === null || start === null) return null;
    const delta = end - start;
    return delta >= 0 ? round(delta, 3) : null;
}

function sanitizeFilePart(value) {
    return String(value).replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function writeState(id, value) {
    setState(id, value, true);
}

async function ensureObject(id, type, name) {
    const existing = existsObject(id) ? getObject(id) : null;
    if (existing) {
        if (existing.type !== type) {
            throw new Error(`Objekttyp-Konflikt bei ${id}: vorhanden=${existing.type}, erwartet=${type}`);
        }
        return;
    }
    await setObjectAsync(id, { type, common: { name }, native: {} });
}

async function ensureState(id, initialValue, common) {
    const existing = existsObject(id) ? getObject(id) : null;
    if (existing) {
        if (existing.type !== 'state') {
            throw new Error(`Objekttyp-Konflikt bei ${id}: vorhanden=${existing.type}, erwartet=state`);
        }
        return;
    }
    await createStateAsync(id, initialValue, {
        name: common.name,
        type: common.type,
        role: common.role,
        read: true,
        write: false,
        unit: common.unit,
    });
}

async function createObjects() {
    await ensureObject(CONFIG.ROOT, 'folder', 'NPS CycleRecorder');
    await ensureObject(`${CONFIG.ROOT}.System`, 'channel', 'System');
    await ensureObject(`${CONFIG.ROOT}.Recording`, 'channel', 'Aufzeichnung');
    await ensureObject(`${CONFIG.ROOT}.LastRun`, 'channel', 'Letzter Lauf');
    await ensureObject(`${CONFIG.ROOT}.Diagnostics`, 'channel', 'Diagnose');

    const definitions = [
        [TARGET.SYSTEM_VERSION, CONFIG.VERSION, { name: 'Modulversion', type: 'string', role: 'text' }],
        [TARGET.SYSTEM_ACTIVE, true, { name: 'Modul aktiv', type: 'boolean', role: 'indicator' }],
        [TARGET.SYSTEM_STATUS, 'INITIALISIERUNG', { name: 'Status', type: 'string', role: 'text' }],
        [TARGET.SYSTEM_LAST_MESSAGE, '', { name: 'Letzte Meldung', type: 'string', role: 'text' }],
        [TARGET.SYSTEM_LAST_START, '', { name: 'Letzter Modulstart', type: 'string', role: 'date' }],
        [TARGET.SYSTEM_LAST_UPDATE, '', { name: 'Letzte Aktualisierung', type: 'string', role: 'date' }],

        [TARGET.RECORDING_ACTIVE, false, { name: 'Aufzeichnung aktiv', type: 'boolean', role: 'indicator' }],
        [TARGET.RECORDING_PHASE, 'PUFFER', { name: 'Aufzeichnungsphase', type: 'string', role: 'text' }],
        [TARGET.RECORDING_TYPE, '', { name: 'Zyklustyp', type: 'string', role: 'text' }],
        [TARGET.RECORDING_START, '', { name: 'Aufzeichnungsstart', type: 'string', role: 'date' }],
        [TARGET.RECORDING_END, '', { name: 'Aufzeichnungsende', type: 'string', role: 'date' }],
        [TARGET.RECORDING_SAMPLES, 0, { name: 'Aktuelle Anzahl Samples', type: 'number', role: 'value' }],

        [TARGET.LAST_RUN_ID, '', { name: 'ID des letzten Laufs', type: 'string', role: 'text' }],
        [TARGET.LAST_RUN_TYPE, '', { name: 'Typ des letzten Laufs', type: 'string', role: 'text' }],
        [TARGET.LAST_RUN_START, '', { name: 'Start des letzten Laufs', type: 'string', role: 'date' }],
        [TARGET.LAST_RUN_END, '', { name: 'Ende des letzten Laufs', type: 'string', role: 'date' }],
        [TARGET.LAST_RUN_DURATION, 0, { name: 'Laufzeit des letzten Laufs', type: 'number', role: 'value.interval', unit: 's' }],
        [TARGET.LAST_RUN_SAMPLES, 0, { name: 'Samples des letzten Laufs', type: 'number', role: 'value' }],
        [TARGET.LAST_RUN_COP, 0, { name: 'COP des letzten Laufs', type: 'number', role: 'value' }],
        [TARGET.LAST_RUN_EL, 0, { name: 'Elektrische Energie des letzten Laufs', type: 'number', role: 'value.energy', unit: 'kWh' }],
        [TARGET.LAST_RUN_HEAT, 0, { name: 'Wärmeenergie des letzten Laufs', type: 'number', role: 'value.energy', unit: 'kWh' }],
        [TARGET.LAST_RUN_JSON, '', { name: 'Letzter Lauf als JSON', type: 'string', role: 'json' }],
        [TARGET.LAST_RUN_FILE, '', { name: 'Datei des letzten Laufs', type: 'string', role: 'text' }],

        [TARGET.DIAG_WARNING, '', { name: 'Warnung', type: 'string', role: 'text' }],
        [TARGET.DIAG_TRACE, '', { name: 'Diagnosetrace', type: 'string', role: 'text' }],
        [TARGET.DIAG_DROPPED, 0, { name: 'Verworfene Samples', type: 'number', role: 'value' }],
        [TARGET.DIAG_RUN_COUNT, 0, { name: 'Anzahl abgeschlossener Läufe', type: 'number', role: 'value' }],
        [TARGET.DIAG_MISSING, '', { name: 'Fehlende Quellen', type: 'string', role: 'json' }],
    ];

    for (const [id, initial, common] of definitions) {
        await ensureState(id, initial, common);
    }
}

function createSample() {
    const timestampMs = Date.now();
    return {
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs,
        process: {
            warmwater: boolOrNull(safeState(NPS_IDS.ProcessWarmwater)),
            heating: boolOrNull(safeState(NPS_IDS.ProcessHeating)),
            standby: boolOrNull(safeState(NPS_IDS.ProcessStandby)),
            compressorRunning: boolOrNull(safeState(NPS_IDS.ProcessCompressorRunning)),
        },
        stateMachine: {
            current: safeState(NPS_IDS.StateCurrent),
            previous: safeState(NPS_IDS.StatePrevious),
            lastTransition: safeState(NPS_IDS.StateTransition),
            transitionCount: numberOrNull(safeState(NPS_IDS.StateTransitionCount)),
        },
        compressor: {
            frequencyHz: numberOrNull(safeState(NPS_IDS.CompressorFrequency)),
            running: boolOrNull(safeState(NPS_IDS.CompressorRunning)),
            status: safeState(NPS_IDS.CompressorStatus),
            starts: numberOrNull(safeState(NPS_IDS.CompressorStarts)),
            runtimeHours: numberOrNull(safeState(NPS_IDS.CompressorRuntime)),
        },
        temperatures: {
            supplyC: numberOrNull(safeState(NPS_IDS.Supply)),
            returnC: numberOrNull(safeState(NPS_IDS.Return)),
            spreadK: numberOrNull(safeState(NPS_IDS.Spread)),
        },
        energy: {
            electricPowerW: numberOrNull(safeState(NPS_IDS.ElectricPower)),
            electricTotalKWh: numberOrNull(safeState(NPS_IDS.ElectricTotal)),
            electricWarmwaterKWh: numberOrNull(safeState(NPS_IDS.ElectricWarmwater)),
            electricHeatingKWh: numberOrNull(safeState(NPS_IDS.ElectricHeating)),
            electricStandbyKWh: numberOrNull(safeState(NPS_IDS.ElectricStandby)),
            electricUnknownKWh: numberOrNull(safeState(NPS_IDS.ElectricUnknown)),
            electricAllocatedKWh: numberOrNull(safeState(NPS_IDS.ElectricAllocated)),
            heatWarmwaterKWh: numberOrNull(safeState(NPS_IDS.HeatWarmwater)),
            heatWarmwaterTotalKWh: numberOrNull(safeState(NPS_IDS.HeatWarmwaterTotal)),
            heatHeatingKWh: numberOrNull(safeState(NPS_IDS.HeatHeating)),
            heatHeatingTotalKWh: numberOrNull(safeState(NPS_IDS.HeatHeatingTotal)),
        },
        event: {
            sequence: numberOrNull(safeState(NPS_IDS.EventSequence)),
            type: safeState(NPS_IDS.EventType),
            title: safeState(NPS_IDS.EventTitle),
            timestamp: safeState(NPS_IDS.EventTimestamp),
        },
        notification: {
            publishedCount: numberOrNull(safeState(NPS_IDS.PublishedCount)),
        },
        aliases: Object.fromEntries(
            Object.entries(ALIAS_IDS).map(([name, id]) => [name, safeState(id)])
        ),
    };
}

function detectCycleType(sample) {
    if (sample.process.warmwater === true) return 'WARMWASSER';
    return null;
}

function isCycleStillActive(sample) {
    return sample.process.warmwater === true || sample.process.compressorRunning === true;
}

function addToPrebuffer(sample) {
    prebuffer.push(sample);
    const oldestAllowed = Date.now() - CONFIG.PREBUFFER_MINUTES * 60 * 1000;
    while (prebuffer.length && prebuffer[0].timestampMs < oldestAllowed) prebuffer.shift();
}

function beginRun(type, triggerSample) {
    const idTimestamp = triggerSample.timestamp.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    activeRun = {
        schemaVersion: 2,
        recorderVersion: CONFIG.VERSION,
        id: `NPS_${type}_${idTimestamp}`,
        type,
        triggerStart: triggerSample.timestamp,
        triggerEnd: null,
        recordingStart: prebuffer.length ? prebuffer[0].timestamp : triggerSample.timestamp,
        recordingEnd: null,
        sampleIntervalSeconds: CONFIG.SAMPLE_SECONDS,
        prebufferMinutes: CONFIG.PREBUFFER_MINUTES,
        postbufferMinutes: CONFIG.POSTBUFFER_MINUTES,
        samples: [...prebuffer],
    };
    postBufferUntil = 0;
    writeState(TARGET.RECORDING_ACTIVE, true);
    writeState(TARGET.RECORDING_PHASE, 'ZYKLUS');
    writeState(TARGET.RECORDING_TYPE, type);
    writeState(TARGET.RECORDING_START, activeRun.recordingStart);
    writeState(TARGET.RECORDING_END, '');
    writeState(TARGET.RECORDING_SAMPLES, activeRun.samples.length);
    writeState(TARGET.SYSTEM_LAST_MESSAGE, `${type}-Aufzeichnung gestartet`);
}

function appendSample(sample) {
    if (!activeRun) return;
    try {
        activeRun.samples.push(sample);
        writeState(TARGET.RECORDING_SAMPLES, activeRun.samples.length);
    } catch (error) {
        droppedSamples += 1;
        writeState(TARGET.DIAG_DROPPED, droppedSamples);
        writeState(TARGET.DIAG_WARNING, `Sample konnte nicht gespeichert werden: ${error.message}`);
    }
}

function beginPostbuffer(sample) {
    if (!activeRun || postBufferUntil > 0) return;
    activeRun.triggerEnd = sample.timestamp;
    postBufferUntil = Date.now() + CONFIG.POSTBUFFER_MINUTES * 60 * 1000;
    writeState(TARGET.RECORDING_PHASE, 'NACHLAUF');
    writeState(TARGET.SYSTEM_LAST_MESSAGE, `${activeRun.type}-Zyklus beendet; Nachlauf aktiv`);
}

function findBoundarySamples(run) {
    const startMs = Date.parse(run.triggerStart);
    const endMs = Date.parse(run.triggerEnd || run.recordingEnd);

    const ordered = (run.samples || [])
        .filter(sample => sample && Number.isFinite(Number(sample.timestampMs)))
        .slice()
        .sort((a, b) => Number(a.timestampMs) - Number(b.timestampMs));

    const startSample = ordered.find(sample => Number(sample.timestampMs) >= startMs) || null;

    let endSample = null;
    for (const sample of ordered) {
        if (Number(sample.timestampMs) <= endMs) endSample = sample;
        else break;
    }

    return { startSample, endSample };
}

function cycleHeatEnergyKey(runType) {
    return String(runType || '').toUpperCase() === 'HEIZUNG'
        ? 'heatHeatingTotalKWh'
        : 'heatWarmwaterTotalKWh';
}

function cycleHeatSourceId(runType) {
    return String(runType || '').toUpperCase() === 'HEIZUNG'
        ? NPS_IDS.HeatHeatingTotal
        : NPS_IDS.HeatWarmwaterTotal;
}

function powerToW(value, unit) {
    const numeric = numberOrNull(value);
    if (numeric === null || numeric < 0) return null;
    return String(unit || '').toLowerCase() === 'kw' ? numeric * 1000 : numeric;
}

/**
 * Integriert eine Leistungsmessreihe trapezförmig innerhalb der fachlichen
 * Zyklusgrenzen. Lücken größer als 1,75 Sampleintervalle werden nicht
 * hochgerechnet, sondern als fehlende Integrationszeit ausgewiesen.
 */
function integratePower(samples, valueSelector, unit, startMs, endMs) {
    const ordered = (samples || [])
        .filter(sample =>
            sample &&
            Number.isFinite(Number(sample.timestampMs)) &&
            Number(sample.timestampMs) >= startMs &&
            Number(sample.timestampMs) <= endMs
        )
        .slice()
        .sort((a, b) => Number(a.timestampMs) - Number(b.timestampMs));

    let wattSeconds = 0;
    let integratedSeconds = 0;
    let skippedSeconds = 0;
    let validIntervals = 0;
    const maximumGapSeconds = CONFIG.SAMPLE_SECONDS * 1.75;

    for (let index = 1; index < ordered.length; index++) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        const deltaSeconds = (Number(current.timestampMs) - Number(previous.timestampMs)) / 1000;

        if (!(deltaSeconds > 0)) continue;
        if (deltaSeconds > maximumGapSeconds) {
            skippedSeconds += deltaSeconds;
            continue;
        }

        const previousW = powerToW(valueSelector(previous), unit);
        const currentW = powerToW(valueSelector(current), unit);
        if (previousW === null || currentW === null) {
            skippedSeconds += deltaSeconds;
            continue;
        }

        wattSeconds += ((previousW + currentW) / 2) * deltaSeconds;
        integratedSeconds += deltaSeconds;
        validIntervals += 1;
    }

    return {
        energyKWh: validIntervals > 0 ? round(wattSeconds / 3600000, 4) : null,
        integratedSeconds: round(integratedSeconds, 1),
        skippedSeconds: round(skippedSeconds, 1),
        sampleCount: ordered.length,
        validIntervals,
    };
}

function calculateSummary(run) {
    const samples = run.samples;
    const first = samples[0] || null;
    const last = samples[samples.length - 1] || null;

    const boundaries = findBoundarySamples(run);
    const cycleStart = boundaries.startSample;
    const cycleEnd = boundaries.endSample;
    const heatEnergyKey = cycleHeatEnergyKey(run.type);

    const triggerStartMs = Date.parse(run.triggerStart);
    const triggerEndMs = Date.parse(run.triggerEnd || run.recordingEnd);

    const electricIntegration = Number.isFinite(triggerStartMs) && Number.isFinite(triggerEndMs)
        ? integratePower(
            samples,
            sample => sample && sample.energy ? sample.energy.electricPowerW : null,
            CONFIG.ELECTRIC_POWER_UNIT,
            triggerStartMs,
            triggerEndMs
        )
        : { energyKWh: null, integratedSeconds: 0, skippedSeconds: 0, sampleCount: 0, validIntervals: 0 };

    const auxiliaryIntegration = Number.isFinite(triggerStartMs) && Number.isFinite(triggerEndMs)
        ? integratePower(
            samples,
            sample => sample && sample.aliases ? sample.aliases.AuxiliaryPower : null,
            CONFIG.AUXILIARY_POWER_UNIT,
            triggerStartMs,
            triggerEndMs
        )
        : { energyKWh: null, integratedSeconds: 0, skippedSeconds: 0, sampleCount: 0, validIntervals: 0 };

    const electricIntegratedKWh = electricIntegration.energyKWh;
    const auxiliaryKWh = auxiliaryIntegration.energyKWh;
    const electricKWh = electricIntegratedKWh === null
        ? null
        : round(
            electricIntegratedKWh +
            (!CONFIG.ELECTRIC_POWER_INCLUDES_AUXILIARY && auxiliaryKWh !== null ? auxiliaryKWh : 0),
            4
        );

    const heatStart = cycleStart ? numberOrNull(cycleStart.energy[heatEnergyKey]) : null;
    const heatEnd = cycleEnd ? numberOrNull(cycleEnd.energy[heatEnergyKey]) : null;
    const heatDelta = difference(heatEnd, heatStart);

    const cop = electricKWh !== null && electricKWh > 0.05 && heatDelta !== null
        ? round(heatDelta / electricKWh, 2)
        : null;

    const frequencies = samples.map(s => s.compressor.frequencyHz).filter(v => Number.isFinite(v) && v > 0);
    const hotWaterTemps = samples.map(s => numberOrNull(s.aliases.HotWaterTop)).filter(Number.isFinite);
    const electricPowers = samples
        .map(s => powerToW(s.energy && s.energy.electricPowerW, CONFIG.ELECTRIC_POWER_UNIT))
        .filter(Number.isFinite);
    const auxiliaryPowers = samples.map(s => powerToW(s.aliases.AuxiliaryPower, CONFIG.AUXILIARY_POWER_UNIT)).filter(Number.isFinite);
    const heatPowers = samples.map(s => numberOrNull(s.aliases.HeatPower)).filter(Number.isFinite);

    return {
        cycleDurationSeconds:
            Number.isFinite(triggerStartMs) && Number.isFinite(triggerEndMs)
                ? Math.max(0, Math.round((triggerEndMs - triggerStartMs) / 1000))
                : null,
        recordingDurationSeconds:
            first && last ? Math.max(0, Math.round((last.timestampMs - first.timestampMs) / 1000)) : null,
        sampleCount: samples.length,
        energy: {
            source: {
                electric: NPS_IDS.ElectricPower,
                auxiliary: ALIAS_IDS.AuxiliaryPower,
                heat: cycleHeatSourceId(run.type),
                methodElectric: 'trapezoidal-power-integration',
                methodHeat: 'counter-delta',
                electricPowerIncludesAuxiliary: CONFIG.ELECTRIC_POWER_INCLUDES_AUXILIARY,
                boundary: 'triggerStart..triggerEnd'
            },

            // Bestehende Felder bleiben für den Analyzer erhalten.
            // Bei einer Integration existiert kein fachlicher kWh-Zählerstand.
            electricStartKWh: null,
            electricEndKWh: null,
            electricKWh,
            heatStartKWh: heatStart,
            heatEndKWh: heatEnd,
            heatKWh: heatDelta,
            cop,

            // Neue Diagnosefelder.
            electricIntegratedKWh,
            auxiliaryKWh,
            electricIntegrationSeconds: electricIntegration.integratedSeconds,
            electricIntegrationSkippedSeconds: electricIntegration.skippedSeconds,
            electricIntegrationSampleCount: electricIntegration.sampleCount,
            electricIntegrationValidIntervals: electricIntegration.validIntervals,
            auxiliaryIntegrationSeconds: auxiliaryIntegration.integratedSeconds,
            auxiliaryIntegrationSkippedSeconds: auxiliaryIntegration.skippedSeconds,

            // Kumulative Zähler bleiben ausschließlich Vergleichswerte.
            electricTotalDeltaKWh: cycleStart && cycleEnd
                ? difference(cycleEnd.energy.electricTotalKWh, cycleStart.energy.electricTotalKWh)
                : null,
            aliasProductionDeltaKWh: cycleStart && cycleEnd
                ? difference(cycleEnd.aliases.TotalProduction, cycleStart.aliases.TotalProduction)
                : null,
        },
        compressor: {
            minFrequencyHz: frequencies.length ? Math.min(...frequencies) : null,
            maxFrequencyHz: frequencies.length ? Math.max(...frequencies) : null,
            meanFrequencyHz: frequencies.length
                ? round(frequencies.reduce((a, b) => a + b, 0) / frequencies.length, 1)
                : null,
        },
        hotWater: {
            startC: hotWaterTemps.length ? hotWaterTemps[0] : null,
            endC: hotWaterTemps.length ? hotWaterTemps[hotWaterTemps.length - 1] : null,
            minC: hotWaterTemps.length ? Math.min(...hotWaterTemps) : null,
            maxC: hotWaterTemps.length ? Math.max(...hotWaterTemps) : null,
        },
        power: {
            electricMeanW: electricPowers.length
                ? round(electricPowers.reduce((a, b) => a + b, 0) / electricPowers.length, 1)
                : null,
            electricMaxW: electricPowers.length ? Math.max(...electricPowers) : null,
            auxiliaryMeanW: auxiliaryPowers.length
                ? round(auxiliaryPowers.reduce((a, b) => a + b, 0) / auxiliaryPowers.length, 1)
                : null,
            auxiliaryMaxW: auxiliaryPowers.length ? Math.max(...auxiliaryPowers) : null,
            heatMeanKW: heatPowers.length
                ? round(heatPowers.reduce((a, b) => a + b, 0) / heatPowers.length, 2)
                : null,
            heatMaxKW: heatPowers.length ? Math.max(...heatPowers) : null,
        },
        quality: {
            droppedSamples,
            missingSources: [...missingSources],
            expectedSampleIntervalSeconds: CONFIG.SAMPLE_SECONDS,
            energyBoundaryValid:
                electricKWh !== null &&
                heatDelta !== null &&
                electricIntegration.skippedSeconds <= CONFIG.SAMPLE_SECONDS * 1.75,
        },
    };
}

function completeRun(finalSample) {
    if (!activeRun) return;
    activeRun.recordingEnd = finalSample.timestamp;
    activeRun.summary = calculateSummary(activeRun);

    const completedRun = activeRun;
    activeRun = null;
    postBufferUntil = 0;
    runCount += 1;

    const json = JSON.stringify(completedRun);
    const filename = `${sanitizeFilePart(completedRun.id)}.json`;
    const filePath = `${CONFIG.FILE_DIRECTORY}/${filename}`;

    writeState(TARGET.RECORDING_ACTIVE, false);
    writeState(TARGET.RECORDING_PHASE, 'PUFFER');
    writeState(TARGET.RECORDING_TYPE, '');
    writeState(TARGET.RECORDING_END, completedRun.recordingEnd);
    writeState(TARGET.RECORDING_SAMPLES, 0);

    writeState(TARGET.LAST_RUN_TYPE, completedRun.type);
    writeState(TARGET.LAST_RUN_START, completedRun.triggerStart);
    writeState(TARGET.LAST_RUN_END, completedRun.triggerEnd || completedRun.recordingEnd);
    writeState(TARGET.LAST_RUN_DURATION, completedRun.summary.cycleDurationSeconds || 0);
    writeState(TARGET.LAST_RUN_SAMPLES, completedRun.summary.sampleCount);
    writeState(TARGET.LAST_RUN_COP, completedRun.summary.energy.cop || 0);
    writeState(TARGET.LAST_RUN_EL, completedRun.summary.energy.electricKWh || 0);
    writeState(TARGET.LAST_RUN_HEAT, completedRun.summary.energy.heatKWh || 0);
    writeState(TARGET.LAST_RUN_JSON, json);
    writeState(TARGET.LAST_RUN_FILE, CONFIG.FILE_EXPORT_ENABLED ? filePath : '');

    // Commit-Signal: Erst nach vollständig geschriebenen LastRun-Nutzdaten publizieren.
    writeState(TARGET.LAST_RUN_ID, completedRun.id);

    writeState(TARGET.DIAG_RUN_COUNT, runCount);
    writeState(TARGET.DIAG_MISSING, JSON.stringify([...missingSources]));

    const trace = [
        nowText(),
        `RunId=${completedRun.id}`,
        `Type=${completedRun.type}`,
        `Zyklusdauer=${completedRun.summary.cycleDurationSeconds}s`,
        `Samples=${completedRun.summary.sampleCount}`,
        `Strom=${completedRun.summary.energy.electricKWh} kWh`,
        `Strom integriert=${completedRun.summary.energy.electricIntegratedKWh} kWh`,
        `Zusatzheizung=${completedRun.summary.energy.auxiliaryKWh} kWh`,
        `Wärme=${completedRun.summary.energy.heatKWh} kWh`,
        `Integrationslücke=${completedRun.summary.energy.electricIntegrationSkippedSeconds}s`,
        `COP=${completedRun.summary.energy.cop}`,
        `FehlendeQuellen=${missingSources.size}`,
        `Datei=${CONFIG.FILE_EXPORT_ENABLED ? filePath : 'deaktiviert'}`,
    ].join('\n');

    writeState(TARGET.DIAG_TRACE, trace);
    writeState(TARGET.SYSTEM_LAST_MESSAGE, `${completedRun.type}-Aufzeichnung abgeschlossen`);
    writeState(TARGET.SYSTEM_LAST_UPDATE, nowText());

    if (CONFIG.FILE_EXPORT_ENABLED) {
        try {
            writeFile(CONFIG.FILE_ADAPTER, filePath, json, error => {
                if (error) {
                    const message = `Dateiexport fehlgeschlagen: ${error}`;
                    writeState(TARGET.DIAG_WARNING, message);
                    log(`[NPS CycleRecorder] ${message}`, 'warn');
                } else {
                    debug(`Datei geschrieben: ${filePath}`);
                }
            });
        } catch (error) {
            const message = `Dateiexport nicht verfügbar: ${error.message}`;
            writeState(TARGET.DIAG_WARNING, message);
            log(`[NPS CycleRecorder] ${message}`, 'warn');
        }
    }

    prebuffer.length = 0;
    addToPrebuffer(finalSample);
}

function sampleTick() {
    const sample = createSample();
    writeState(TARGET.SYSTEM_LAST_UPDATE, nowText());

    if (!activeRun) {
        addToPrebuffer(sample);
        const type = detectCycleType(sample);
        if (type) {
            beginRun(type, sample);
            appendSample(sample);
        }
        return;
    }

    appendSample(sample);

    if (postBufferUntil === 0) {
        if (!isCycleStillActive(sample)) beginPostbuffer(sample);
        return;
    }

    if (Date.now() >= postBufferUntil) completeRun(sample);
}

function validateConfiguration() {
    if (CONFIG.SAMPLE_SECONDS < 5) throw new Error('SAMPLE_SECONDS darf nicht kleiner als 5 sein.');
    if (CONFIG.PREBUFFER_MINUTES < 0 || CONFIG.POSTBUFFER_MINUTES < 0) {
        throw new Error('Pufferzeiten dürfen nicht negativ sein.');
    }
}

async function startRecorder() {
    await createObjects();
    validateConfiguration();

    writeState(TARGET.SYSTEM_VERSION, CONFIG.VERSION);
    writeState(TARGET.SYSTEM_ACTIVE, true);
    writeState(TARGET.SYSTEM_STATUS, 'BEREIT');
    writeState(TARGET.SYSTEM_LAST_START, nowText());
    writeState(TARGET.SYSTEM_LAST_UPDATE, nowText());
    writeState(
        TARGET.SYSTEM_LAST_MESSAGE,
        `Recorder bereit; ${CONFIG.PREBUFFER_MINUTES} min Vorlauf, ` +
        `${CONFIG.POSTBUFFER_MINUTES} min Nachlauf`
    );
    writeState(TARGET.RECORDING_ACTIVE, false);
    writeState(TARGET.RECORDING_PHASE, 'PUFFER');
    writeState(TARGET.DIAG_WARNING, '');
    writeState(TARGET.DIAG_MISSING, JSON.stringify([]));

    sampleTick();
    setInterval(sampleTick, CONFIG.SAMPLE_SECONDS * 1000);

    log(`[NPS CycleRecorder] Version ${CONFIG.VERSION} gestartet`, 'info');
}

startRecorder().catch(error => {
    log(`[NPS CycleRecorder] Start fehlgeschlagen: ${error.stack || error}`, 'error');
    try {
        writeState(TARGET.SYSTEM_ACTIVE, false);
        writeState(TARGET.SYSTEM_STATUS, 'FEHLER');
        writeState(TARGET.SYSTEM_LAST_MESSAGE, String(error.message || error));
        writeState(TARGET.DIAG_WARNING, String(error.stack || error));
    } catch (_) {
        // Keine weitere Aktion möglich.
    }
});

})();
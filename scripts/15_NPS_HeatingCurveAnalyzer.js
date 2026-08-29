/*
 * ============================================================
 * NIBE Performance Suite (NPS)
 * ============================================================
 * Modul:   15_NPS_HeatingCurveAnalyzer
 * Version: 0.2.0
 *
 * Zweck:
 *   Heizungsoptimierung / Heizkurvenanalyse
 *
 * NPS-Version:
 *   Ziel: 1.1
 *
 * Status:
 *   RELEASE – v0.2.0 / NPS 1.1
 *
 * Sicherheit:
 *   - nur lesender Zugriff auf Anlagenquellen
 *   - keine Änderung von NIBE-Parametern
 *   - keine externe KI-Kommunikation
 *   - kein direkter MQTT-Zugriff
 *
 * Entwicklungsstand v0.2.0-alpha.1 / T9.1:
 *   - Basis: unveränderter freigegebener Stand v0.1.1
 *   - NPS-AI-AnalysisPayload Schema 1.1
 *   - eindeutige Schema-Kennung
 *   - primäres Analysefenster 72 h explizit im Payload
 *   - statischer Anlagenkontext system.plant
 *   - T9.1: previousOptimization als reserviertes Schemafeld eingeführt
 *   - T9.3: previousOptimization aus AI.Optimization.LastRecord
 *   - T9.3: nur schema-kompatible NPS-AI-OptimizationRecord-v1.0-Objekte werden übernommen
 *   - T9.4: Recommendation-State-Struktur eingeführt
 *   - T9.4: RecommendationPayload ist manuell beschreibbarer Eingabepunkt
 *   - T9.4: noch kein Parser, keine Validierung und keine ChangeAllowed-Logik
 *   - T9.5: RecommendationPayload-Parser aktiv
 *   - T9.5: InputPayload wird bei Änderung und nach Neustart eingelesen
 *   - T9.5: reine JSON-/Feldabbildung; keine semantische Validierung
 *   - T9.5: ChangeAllowed bleibt immer false
 *   - T9.6: RecommendationPayload-Validator aktiv
 *   - T9.6: Schema, Pflichtfelder, Enums und CHANGE_PARAMETER-Regeln werden geprüft
 *   - T9.6: Recommendation.Valid / ValidationState / ValidationErrorsJson werden gesetzt
 *   - T9.6: ChangeAllowed bleibt weiterhin immer false (T9.7)
 *   - T9.7: ChangeAllowed-Sicherheitsentscheidung aktiv
 *   - T9.7: Freigabe nur bei gültiger CHANGE_PARAMETER-Empfehlung und ohne Hard-Blocker
 *   - T9.7: AI.Ready, Evidence, Konfigurationssignatur und aktueller Parameterwert werden geprüft
 *   - T9.7: Steilheitsänderungen benötigen mindestens 2 gültige Outdoor-Bins
 *   - T9.7: keine automatische NIBE-Änderung; der Benutzer entscheidet weiterhin manuell
 *   - T9.8: NPS-AI-OptimizationRecord v1.0 aktiv
 *   - T9.8: bei freigegebener Empfehlung wird ein PendingRecord als Vorher-Snapshot gesichert
 *   - T9.8: eine passende manuelle NIBE-Änderung wird automatisch als LastRecord dokumentiert
 *   - T9.8: Observation startet mit der erkannten manuellen Änderung; Evaluation bleibt NOT_EVALUATED (T9.9)
 *   - T9.8: keine automatische NIBE-Änderung und keine automatische Bewertung
 *   - T9.9: abgeschlossene Beobachtungszyklen werden deterministisch bewertet
 *   - T9.10: interner Startup-Integritätstest der AI-Optimierungskette
 *   - T9.9: Vergleich von absoluter 72h-Median-Raumabweichung und 72h-OK-Anteil
 *   - T9.9: Ergebnis IMPROVED / UNCHANGED / WORSENED / INCONCLUSIVE
 *   - T9.9: Bewertung nur nach Ablauf der Observation und bei belastbarer Nachher-Datenbasis
 *   - keine Änderung an Mess-, Analyse-, Evidence- oder AI.Ready-Logik
 *   - T9.2: OutdoorBins um Raum-Komfortanteile erweitert
 *   - tooColdRatioPercent / okRatioPercent / tooWarmRatioPercent
 *
 * Laufzeitverhalten v0.2.0-alpha.2:
 *   - dauerhaft laufendes Script
 *   - Status.Active = true, sobald der Scheduler aktiv ist
 * ============================================================
 */

'use strict';

// ============================================================
// Debug ein-/ausschalten true/false
// ============================================================
const DEBUG = false;

// ============================================================
// Modulkonfiguration
// ============================================================
const MODULE_NAME = 'HeatingCurveAnalyzer';
const VERSION = '0.2.0';
const LOG_PREFIX = `[NPS ${MODULE_NAME}]`;
const ROOT = '0_userdata.0.NPS.HeatingOptimization';

const COMFORT_BAND_K = 0.5;
const MIN_VALID_ROOM_RATIO = 0.50;
const MIN_VALID_ROOMS = 3;

const SAMPLE_INTERVAL_MINUTES = 5;
const SAMPLE_INTERVAL_MS = SAMPLE_INTERVAL_MINUTES * 60 * 1000;
const MAX_BUFFER_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const SNAPSHOT_WARN_MS = 15000;
const SNAPSHOT_ERROR_MS = 60000;

const BUFFER_VERSION = '1.0';

const MIN_ROOM_ANALYSIS_HOURS = 6;
const PERSISTENT_ROOM_RATIO = 60;
const MIN_BIN_VALID_HOURS = 3;

const MIN_VALID_HEATING_HOURS = {
    Window6h: 2,
    Window24h: 4,
    Window72h: 8,
    Window7d: 12
};

const WINDOW_HOURS = {
    Window6h: 6,
    Window24h: 24,
    Window72h: 72,
    Window7d: 168
};


const EVIDENCE_LIMITS = {
    GLOBAL_RATIO_PERCENT: 60,
    GLOBAL_MEDIAN_K: 0.5,

    ROOM_STDDEV_K: 0.7,
    ROOM_RANGE_K: 2.0,

    FLOW_TRACKING_K: 2.0,
    OUTDOOR_DEPENDENCE_K: 0.7,

    ADDITIONAL_HEAT_RUNTIME_PERCENT: 10,
    SENSOR_MISMATCH_K: 3.0,

    MIN_DATA_QUALITY_PERCENT: 60,
    AI_READY_DATA_QUALITY_PERCENT: 75
};

// T9.9 - konservative Schwellen fuer den Vorher-/Nachher-Vergleich.
// Kleine Bewegungen innerhalb dieser Totbaender werden als UNCHANGED gewertet.
const OPTIMIZATION_EVALUATION_LIMITS = Object.freeze({
    MEDIAN_ABS_DEVIATION_CHANGE_K: 0.2,
    OK_RATIO_CHANGE_PERCENT_POINTS: 5
});


// T9.1 - standardisierte, anbieterunabhaengige AI-Schnittstelle.
const PAYLOAD_SCHEMA = 'NPS-AI-AnalysisPayload';
const PAYLOAD_VERSION = '1.1';
const PRIMARY_ANALYSIS_PERIOD_HOURS = 72;

const PLANT_INFO = Object.freeze({
    manufacturer: 'NIBE',
    outdoorUnit: 'S2125-12',
    indoorUnit: 'VVM S500',
    systemType: 'air_water_heatpump',
    heatDistribution: 'radiators',
    heatingCircuits: 1
});

const MAX_AI_PAYLOAD_BYTES = 65536;

// v0.1.1 / T3 - für Influx vorgesehene 5-Minuten-Zeitreihen.
// Diese States werden bei jedem echten 5-Minuten-Sample geschrieben,
// auch wenn sich ihr Wert gegenüber dem vorherigen Sample nicht geändert hat.
const INFLUX_STATES = new Set([
    // Configuration
    'Configuration.HeatingCurve',
    'Configuration.HeatingCurveOffset',
    'Configuration.FlowMin',
    'Configuration.FlowMax',
    'Configuration.HeatingStopTemperature',
    'Configuration.AdditionalHeatStopTemperature',

    // Current
    'Current.OutdoorTemperature',
    'Current.OutdoorTemperatureBT28',
    'Current.OutdoorSensorDifference',
    'Current.FlowTarget',
    'Current.FlowActual',
    'Current.ReturnTemperature',
    'Current.SupplyDeviation',
    'Current.DeltaT',
    'Current.DegreeMinutes',
    'Current.CompressorFrequency',
    'Current.CompressorActive',
    'Current.OperatingPriority',
    'Current.VolumeFlow',
    'Current.DefrostActive',
    'Current.AdditionalHeatPower',
    'Current.AdditionalHeatActive',
    'Current.HeatPower',
    'Current.ElectricalPower',
    'Current.SampleValid',
    'Current.SampleQuality',

    // Rooms
    'Rooms.ActiveCount',
    'Rooms.DataValidCount',
    'Rooms.ValidForHeatingCurveCount',
    'Rooms.TooColdCount',
    'Rooms.OKCount',
    'Rooms.TooWarmCount',
    'Rooms.AverageDeviation',
    'Rooms.MedianDeviation',
    'Rooms.MinimumDeviation',
    'Rooms.MaximumDeviation',
    'Rooms.DeviationStdDev',
    'Rooms.DeviationRange',
    'Rooms.ColdestRoomDeviation',
    'Rooms.WarmestRoomDeviation',

    // Status
    'Status.DataQualityPercent'
]);

// Technische Plausibilitätsgrenzen
const LIMITS = {
    outdoorTemperature: { min: -40, max: 50 },
    flowTarget:         { min: 5,   max: 80 },
    flowActual:         { min: 5,   max: 80 },
    returnTemperature:  { min: 5,   max: 80 },
    degreeMinutes:      { min: -3000, max: 3000 },
    compressorFrequency:{ min: 0,   max: 150 },
    volumeFlow:         { min: 0,   max: 100 },
    roomTemperature:    { min: 5,   max: 35 },
    scheduleTarget:     { min: 5,   max: 30 }
};

// ============================================================
// NIBE-Konfiguration
// ============================================================
const NIBE_CONFIG = {
    heatingCurve: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Heizkurve',
    heatingCurveOffset: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Heizkurvenverschiebung',
    flowMin: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Vorlauf_Min',
    flowMax: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Vorlauf_Max',
    customCurveP1: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Eigene_Heizkurve_P1',
    customCurveP2: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Eigene_Heizkurve_P2',
    customCurveP3: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Eigene_Heizkurve_P3',
    customCurveP4: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Eigene_Heizkurve_P4',
    customCurveP5: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Eigene_Heizkurve_P5',
    customCurveP6: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Eigene_Heizkurve_P6',
    customCurveP7: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Eigene_Heizkurve_P7',
    pointOutdoorTemperature: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Punktverschiebung_Aussentemperatur',
    pointOffset: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Punktverschiebung',
    heatingStartUndertemp: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Heizung_Start_Untertemperatur',
    heatingStopTemperature: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Heizung_Stopptemperatur',
    additionalHeatStopTemperature: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Zusatzheizung_Stopptemperatur',
    autoFilterTime: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Automatikmodus_Filterzeit',
    maxFlowDifferenceCompressor: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Max_Differenz_Vorlauf_Verdichter',
    operatingMode: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Betriebsmodus',
    heatingAutomatic: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Heizung_Automatik'
};

// ============================================================
// NIBE-Betriebsdaten
// ============================================================
const NIBE_OPERATING = {
    outdoorTemperature: 'alias.0.Keller.Waschküche.Waermepumpe.Aussentemperatur',
    outdoorTemperatureBT28: 'alias.0.Keller.Waschküche.Waermepumpe.Außenlufttemperatur_(EB101-BT28)',
    flowTarget: 'alias.0.Keller.Waschküche.Waermepumpe.Berechneter_Vorlauf_Klimatisierungssystem_1',
    flowActual: 'alias.0.Keller.Waschküche.Waermepumpe.Vorlauf',
    returnTemperature: 'alias.0.Keller.Waschküche.Waermepumpe.Ruecklauf',
    degreeMinutes: 'alias.0.Keller.Waschküche.Waermepumpe.Heizungsregelung.Gradminuten',
    compressorFrequency: 'alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)',
    compressorStatus: 'alias.0.Keller.Waschküche.Waermepumpe.Verdichterstatus',
    compressorDemand: 'alias.0.Keller.Waschküche.Waermepumpe.Status_Verdichter_Bedarf',
    operatingPriority: 'alias.0.Keller.Waschküche.Waermepumpe.prio',
    volumeFlow: 'alias.0.Keller.Waschküche.Waermepumpe.Volumenstrommesser_(BF1)',
    defrostActive: 'alias.0.Keller.Waschküche.Waermepumpe.Enteisung',
    additionalHeatPower: 'alias.0.Keller.Waschküche.Waermepumpe.Leistung_interne_Zusatzheizung',
    additionalHeatMode: 'alias.0.Keller.Waschküche.Waermepumpe.Betriebsmodus_interne_Zusatzheizung',
    heatPower: 'alias.0.Keller.Waschküche.Waermepumpe.Erzeugte_Leistung_Wärme_(EB101)',
    electricalPower: 'alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll___Tatsächlicher_Energieverbrauch',
    compressorStartsTotal: 'alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Anzahl_Starts',
    compressorRuntimeTotal: 'alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Gesamtbetriebszeit_(EB101-EP14)'
};

// ============================================================
// heatingcontrol-Instanzen
// ============================================================
const HC_INSTANCES = {
    0: {
        name: 'Wohnung EG + Keller + Treppenhaus',
        heatingPeriodActive: 'heatingcontrol.0.HeatingPeriodActive',
        maintenanceActive: 'heatingcontrol.0.MaintenanceActive'
    },
    1: {
        name: 'Wohnung OG + Dachgeschoss',
        heatingPeriodActive: 'heatingcontrol.1.HeatingPeriodActive',
        maintenanceActive: 'heatingcontrol.1.MaintenanceActive'
    }
};

function getHcRoomSources(instance, room) {
    const base = `heatingcontrol.${instance}.Rooms.${room}`;
    return {
        scheduleTarget: `${base}.CurrentTimePeriodTemperature`,
        effectiveTarget: `${base}.CurrentTarget`,
        state: `${base}.State`,
        windowOpen: `${base}.WindowIsOpen`,
        active: `${base}.isActive`,
        overrideTemperature: `${base}.TemperaturOverride`,
        overrideRemainingMinutes: `${base}.TemperaturOverrideRemainingTime`
    };
}

// ============================================================
// Räume
// ============================================================
const ROOMS = [
    { id:'EG_Kueche', name:'EG Küche', hcInstance:0, hcRoom:'EG Küche',
      roomSensor:'alias.0.Erdgeschoss.Küche.Thermometer.ACTUAL',
      thermostats:[{id:'HKO',name:'Heizkörper',actual:'alias.0.Erdgeschoss.Küche.Heizkörper.ACTUAL',setpoint:'alias.0.Erdgeschoss.Küche.Heizkörper.current_heating_setpoint'}] },

    { id:'EG_Wohnzimmer', name:'EG Wohnzimmer', hcInstance:0, hcRoom:'EG Wohnzimmer',
      roomSensor:'alias.0.Erdgeschoss.Wohnzimmer.Thermometer.ACTUAL',
      thermostats:[
        {id:'HKS',name:'Heizkörper Süd',actual:'alias.0.Erdgeschoss.Wohnzimmer.Heizkörper_Süd.ACTUAL',setpoint:'alias.0.Erdgeschoss.Wohnzimmer.Heizkörper_Süd.current_heating_setpoint'},
        {id:'HKO',name:'Heizkörper Ost',actual:'alias.0.Erdgeschoss.Wohnzimmer.Heizkörper_Ost.ACTUAL',setpoint:'alias.0.Erdgeschoss.Wohnzimmer.Heizkörper_Ost.current_heating_setpoint'}
      ] },

    { id:'EG_Badezimmer', name:'EG Badezimmer', hcInstance:0, hcRoom:'EG Badezimmer',
      roomSensor:'alias.0.Erdgeschoss.Badezimmer.Thermometer.ACTUAL',
      thermostats:[{id:'HKN',name:'Heizkörper',actual:'alias.0.Erdgeschoss.Badezimmer.Heizkörper.ACTUAL',setpoint:'alias.0.Erdgeschoss.Badezimmer.Heizkörper.current_heating_setpoint'}] },

    { id:'EG_Toilette', name:'EG Toilette', hcInstance:0, hcRoom:'EG Toilette', roomSensor:null,
      thermostats:[{id:'HKN',name:'Heizkörper',actual:'alias.0.Erdgeschoss.Toilette.Heizkörper.ACTUAL',setpoint:'alias.0.Erdgeschoss.Toilette.Heizkörper.current_heating_setpoint'}] },

    { id:'EG_Kinderzimmer', name:'EG Kinderzimmer', hcInstance:0, hcRoom:'EG Kinderzimmer', roomSensor:null,
      thermostats:[{id:'HKS',name:'Heizkörper',actual:'alias.0.Erdgeschoss.Kinderzimmer.Heizkörper.ACTUAL',setpoint:'alias.0.Erdgeschoss.Kinderzimmer.Heizkörper.current_heating_setpoint'}] },

    { id:'EG_Schlafzimmer', name:'EG Schlafzimmer', hcInstance:0, hcRoom:'EG Schlafzimmer',
      roomSensor:'alias.0.Erdgeschoss.Schlafzimmer.Thermometer.ACTUAL',
      thermostats:[{id:'HKS',name:'Heizkörper',actual:'alias.0.Erdgeschoss.Schlafzimmer.Heizkörper.ACTUAL',setpoint:'alias.0.Erdgeschoss.Schlafzimmer.Heizkörper.current_heating_setpoint'}] },

    { id:'TH_Erdgeschoss', name:'TH Erdgeschoss', hcInstance:0, hcRoom:'TH Erdgeschoss', roomSensor:null,
      thermostats:[{id:'HKS',name:'Heizkörper Eingang',actual:'alias.0.Treppenhaus.Eingang.Heizkörper.ACTUAL',setpoint:'alias.0.Treppenhaus.Eingang.Heizkörper.current_heating_setpoint'}] },

    { id:'OG_Kueche', name:'OG Küche', hcInstance:1, hcRoom:'OG Küche', roomSensor:null,
      thermostats:[{id:'HKN',name:'Heizkörper',actual:'alias.0.Obergeschoss.Küche.Heizkörper.ACTUAL',setpoint:'alias.0.Obergeschoss.Küche.Heizkörper.current_heating_setpoint'}] },

    { id:'OG_Wohnzimmer', name:'OG Wohnzimmer', hcInstance:1, hcRoom:'OG Wohnzimmer', roomSensor:null,
      thermostats:[
        {id:'HKS',name:'Heizkörper Süd',actual:'alias.0.Obergeschoss.Wohnzimmer.Heizkörper_Süd.ACTUAL',setpoint:'alias.0.Obergeschoss.Wohnzimmer.Heizkörper_Süd.current_heating_setpoint'},
        {id:'HKO',name:'Heizkörper Ost',actual:'alias.0.Obergeschoss.Wohnzimmer.Heizkörper_Ost.ACTUAL',setpoint:'alias.0.Obergeschoss.Wohnzimmer.Heizkörper_Ost.current_heating_setpoint'}
      ] },

    { id:'OG_Badezimmer', name:'OG Badezimmer', hcInstance:1, hcRoom:'OG Badezimmer', roomSensor:null,
      thermostats:[{id:'HKN',name:'Heizkörper',actual:'alias.0.Obergeschoss.Badezimmer.Heizkörper.ACTUAL',setpoint:'alias.0.Obergeschoss.Badezimmer.Heizkörper.current_heating_setpoint'}] },

    { id:'OG_Kinderzimmer', name:'OG Kinderzimmer', hcInstance:1, hcRoom:'OG Kinderzimmer', roomSensor:null,
      thermostats:[{id:'HKS',name:'Heizkörper',actual:'alias.0.Obergeschoss.Kinderzimmer.Heizkörper.ACTUAL',setpoint:'alias.0.Obergeschoss.Kinderzimmer.Heizkörper.current_heating_setpoint'}] },

    { id:'OG_Schlafzimmer', name:'OG Schlafzimmer', hcInstance:1, hcRoom:'OG Schlafzimmer', roomSensor:null,
      thermostats:[{id:'HKS',name:'Heizkörper',actual:'alias.0.Obergeschoss.Schlafzimmer.Heizkörper.ACTUAL',setpoint:'alias.0.Obergeschoss.Schlafzimmer.Heizkörper.current_heating_setpoint'}] },

    { id:'DG_Werkstatt', name:'DG Werkstatt', hcInstance:1, hcRoom:'DG Werkstatt', roomSensor:null,
      thermostats:[
        {id:'HKS',name:'Heizkörper Süd',actual:'alias.0.Dachgeschoss.Werkstatt.Heizkörper_Süd.ACTUAL',setpoint:'alias.0.Dachgeschoss.Werkstatt.Heizkörper_Süd.current_heating_setpoint'},
        {id:'HKN',name:'Heizkörper Nord',actual:'alias.0.Dachgeschoss.Werkstatt.Heizkörper_Nord.ACTUAL',setpoint:'alias.0.Dachgeschoss.Werkstatt.Heizkörper_Nord.current_heating_setpoint'}
      ] }
];

// ============================================================
// DP-Definitionen Beta.1a
// ============================================================

/**
 * @typedef {Object} DpDefinition
 * @property {string} id
 * @property {string} type
 * @property {string} role
 * @property {string|number|boolean} def
 * @property {string=} unit
 * @property {boolean=} write
 */

/** @type {DpDefinition[]} */
const DP_DEFINITIONS = [
    // Status
    {id:'Status.Version',type:'string',role:'info.version',def:VERSION},
    {id:'Status.Active',type:'boolean',role:'indicator.working',def:false},
    {id:'Status.Valid',type:'boolean',role:'indicator',def:false},
    {id:'Status.LastCalculation',type:'string',role:'date',def:''},
    {id:'Status.LastSample',type:'string',role:'date',def:''},
    {id:'Status.SourceCheckOk',type:'boolean',role:'indicator',def:false},
    {id:'Status.SourceCheckJson',type:'string',role:'json',def:'{}'},
    {id:'Status.DataQualityPercent',type:'number',role:'value',unit:'%',def:0},
    {id:'Status.DataQualityState',type:'string',role:'text',def:'INSUFFICIENT'},
    {id:'Status.ErrorCount',type:'number',role:'value',def:0},
    {id:'Status.LastError',type:'string',role:'text',def:''},

    // Configuration
    {id:'Configuration.HeatingCurve',type:'number',role:'value',def:0},
    {id:'Configuration.HeatingCurveOffset',type:'number',role:'value',def:0},
    {id:'Configuration.FlowMin',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Configuration.FlowMax',type:'number',role:'value.temperature',unit:'°C',def:0},
    ...[1,2,3,4,5,6,7].map(p => ({id:`Configuration.CustomCurveP${p}`,type:'number',role:'value.temperature',unit:'°C',def:0})),
    {id:'Configuration.PointOutdoorTemperature',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Configuration.PointOffset',type:'number',role:'value',unit:'K',def:0},
    {id:'Configuration.HeatingStartUndertemp',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Configuration.HeatingStopTemperature',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Configuration.AdditionalHeatStopTemperature',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Configuration.AutoFilterTime',type:'number',role:'value.interval',unit:'h',def:0},
    {id:'Configuration.MaxFlowDifferenceCompressor',type:'number',role:'value',unit:'K',def:0},
    {id:'Configuration.OperatingMode',type:'number',role:'value',def:0},
    {id:'Configuration.HeatingAutomatic',type:'boolean',role:'indicator',def:false},
    {id:'Configuration.ConfigurationSignature',type:'string',role:'text',def:''},
    {id:'Configuration.ChangedAt',type:'string',role:'date',def:''},
    {id:'Configuration.Json',type:'string',role:'json',def:'{}'},

    // Current
    {id:'Current.OutdoorTemperature',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Current.OutdoorTemperatureBT28',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Current.OutdoorSensorDifference',type:'number',role:'value',unit:'K',def:0},
    {id:'Current.FlowTarget',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Current.FlowActual',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Current.ReturnTemperature',type:'number',role:'value.temperature',unit:'°C',def:0},
    {id:'Current.SupplyDeviation',type:'number',role:'value',unit:'K',def:0},
    {id:'Current.DeltaT',type:'number',role:'value',unit:'K',def:0},
    {id:'Current.DegreeMinutes',type:'number',role:'value',unit:'GM',def:0},
    {id:'Current.CompressorFrequency',type:'number',role:'value.frequency',unit:'Hz',def:0},
    {id:'Current.CompressorActive',type:'boolean',role:'indicator.working',def:false},
    {id:'Current.CompressorStatus',type:'number',role:'value',def:0},
    {id:'Current.CompressorDemand',type:'number',role:'value',def:0},
    {id:'Current.OperatingPriority',type:'number',role:'value',def:0},
    {id:'Current.VolumeFlow',type:'number',role:'value',unit:'l/min',def:0},
    {id:'Current.DefrostActive',type:'boolean',role:'indicator',def:false},
    {id:'Current.AdditionalHeatPower',type:'number',role:'value.power',unit:'kW',def:0},
    {id:'Current.AdditionalHeatActive',type:'boolean',role:'indicator.working',def:false},
    {id:'Current.HeatPower',type:'number',role:'value.power',unit:'kW',def:0},
    {id:'Current.ElectricalPower',type:'number',role:'value.power',unit:'W',def:0},
    {id:'Current.SampleValid',type:'boolean',role:'indicator',def:false},
    {id:'Current.SampleQuality',type:'number',role:'value',unit:'%',def:0},
    {id:'Current.ExcludeReasonsJson',type:'string',role:'json',def:'[]'},

    // Rooms
    {id:'Rooms.Count',type:'number',role:'value',def:0},
    {id:'Rooms.ActiveCount',type:'number',role:'value',def:0},
    {id:'Rooms.DataValidCount',type:'number',role:'value',def:0},
    {id:'Rooms.ValidForHeatingCurveCount',type:'number',role:'value',def:0},
    {id:'Rooms.TooColdCount',type:'number',role:'value',def:0},
    {id:'Rooms.OKCount',type:'number',role:'value',def:0},
    {id:'Rooms.TooWarmCount',type:'number',role:'value',def:0},
    {id:'Rooms.AverageDeviation',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.MedianDeviation',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.MinimumDeviation',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.MaximumDeviation',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.DeviationStdDev',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.DeviationRange',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.ColdestRoom',type:'string',role:'text',def:''},
    {id:'Rooms.ColdestRoomDeviation',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.WarmestRoom',type:'string',role:'text',def:''},
    {id:'Rooms.WarmestRoomDeviation',type:'number',role:'value',unit:'K',def:0},
    {id:'Rooms.Json',type:'string',role:'json',def:'{}'},

    // Analysis - globale States
    {id:'Analysis.OutdoorBinsJson',type:'string',role:'json',def:'{}'},
    {id:'Analysis.PersistentColdRoomsJson',type:'string',role:'json',def:'[]'},
    {id:'Analysis.PersistentWarmRoomsJson',type:'string',role:'json',def:'[]'},
    {id:'Analysis.EvidenceJson',type:'string',role:'json',def:'{}'},
    {id:'Analysis.CurrentConfigurationSampleCount',type:'number',role:'value',def:0},
    {id:'Analysis.CurrentConfigurationValidHeatingHours',type:'number',role:'value.interval',unit:'h',def:0},

    // AI - RC.1
    {id:'AI.AnalysisPayload',type:'string',role:'json',def:'{}'},
    {id:'AI.PayloadVersion',type:'string',role:'info.version',def:PAYLOAD_VERSION},
    {id:'AI.GeneratedAt',type:'string',role:'date',def:''},
    {id:'AI.Ready',type:'boolean',role:'indicator',def:false},
    {id:'AI.Optimization.LastRecord',type:'string',role:'json',def:'null'},
    {id:'AI.Optimization.PendingRecord',type:'string',role:'json',def:'null'},
    {id:'AI.Optimization.Status',type:'string',role:'text',def:'IDLE'},

    // AI Recommendation - T9.4
    // InputPayload ist der einzige bewusst beschreibbare State.
    // Parser/Validator/ChangeAllowed werden erst in T9.5-T9.7 aktiv.
    {id:'AI.Recommendation.InputPayload',type:'string',role:'json',def:'{}',write:true},
    {id:'AI.Recommendation.ReceivedAt',type:'string',role:'date',def:''},
    {id:'AI.Recommendation.Schema',type:'string',role:'text',def:''},
    {id:'AI.Recommendation.SchemaVersion',type:'string',role:'info.version',def:''},
    {id:'AI.Recommendation.AnalysisGeneratedAt',type:'string',role:'date',def:''},
    {id:'AI.Recommendation.AnalysisSchemaVersion',type:'string',role:'info.version',def:''},
    {id:'AI.Recommendation.ConfigurationSignature',type:'string',role:'text',def:''},
    {id:'AI.Recommendation.AnalysisValid',type:'boolean',role:'indicator',def:false},
    {id:'AI.Recommendation.ConfidencePercent',type:'number',role:'value',unit:'%',def:0},
    {id:'AI.Recommendation.OverallState',type:'string',role:'text',def:''},
    {id:'AI.Recommendation.PrimaryFinding',type:'string',role:'text',def:''},
    {id:'AI.Recommendation.Action',type:'string',role:'text',def:''},
    {id:'AI.Recommendation.Parameter',type:'string',role:'text',def:''},
    {id:'AI.Recommendation.CurrentValue',type:'number',role:'value',def:0},
    {id:'AI.Recommendation.RecommendedValue',type:'number',role:'value',def:0},
    {id:'AI.Recommendation.Change',type:'number',role:'value',def:0},
    {id:'AI.Recommendation.SecondaryRecommendationJson',type:'string',role:'json',def:'null'},
    {id:'AI.Recommendation.ReasonCodesJson',type:'string',role:'json',def:'[]'},
    {id:'AI.Recommendation.Explanation',type:'string',role:'text',def:''},
    {id:'AI.Recommendation.ObservationHours',type:'number',role:'value.interval',unit:'h',def:0},
    {id:'AI.Recommendation.Valid',type:'boolean',role:'indicator',def:false},
    {id:'AI.Recommendation.ValidationState',type:'string',role:'text',def:'NOT_VALIDATED'},
    {id:'AI.Recommendation.ValidationErrorsJson',type:'string',role:'json',def:'[]'},
    {id:'AI.Recommendation.ChangeAllowed',type:'boolean',role:'indicator',def:false},

    // Internal
    {id:'Internal.SampleBufferJson',type:'string',role:'json',def:'[]'},
    {id:'Internal.SampleCount',type:'number',role:'value',def:0},
    {id:'Internal.BufferVersion',type:'string',role:'info.version',def:BUFFER_VERSION},
    {id:'Internal.LastSampleTimestamp',type:'string',role:'date',def:''},
    {id:'Internal.LastConfigSignature',type:'string',role:'text',def:''}
];

// Analysefenster - identische Struktur
const WINDOW_DEFINITIONS = [
    ['ValidSampleCount','number','value',null,0],
    ['ValidHeatingHours','number','value.interval','h',0],

    ['AvgOutdoorTemperature','number','value.temperature','°C',0],
    ['MinOutdoorTemperature','number','value.temperature','°C',0],
    ['MaxOutdoorTemperature','number','value.temperature','°C',0],

    ['AvgFlowTarget','number','value.temperature','°C',0],
    ['AvgFlowActual','number','value.temperature','°C',0],
    ['AvgFlowDeviation','number','value','K',0],
    ['AvgReturnTemperature','number','value.temperature','°C',0],
    ['AvgDeltaT','number','value','K',0],

    ['AvgDegreeMinutes','number','value','GM',0],
    ['MinDegreeMinutes','number','value','GM',0],
    ['MaxDegreeMinutes','number','value','GM',0],

    ['AvgCompressorFrequency','number','value.frequency','Hz',0],
    ['CompressorRuntimePercent','number','value','%',0],
    ['AdditionalHeatRuntimePercent','number','value','%',0],

    ['AvgRoomDeviation','number','value','K',0],
    ['MedianRoomDeviation','number','value','K',0],
    ['MinRoomDeviation','number','value','K',0],
    ['MaxRoomDeviation','number','value','K',0],
    ['DeviationStdDev','number','value','K',0],
    ['DeviationRange','number','value','K',0],

    ['TooColdRatio','number','value','%',0],
    ['OKRatio','number','value','%',0],
    ['TooWarmRatio','number','value','%',0],

    ['DataQualityPercent','number','value','%',0],
    ['Valid','boolean','indicator',null,false],
    ['Json','string','json',null,'{}']
];

for (const windowId of Object.keys(WINDOW_HOURS)) {
    for (const [suffix,_type,role,unit,def] of WINDOW_DEFINITIONS) {
        /** @type {DpDefinition} */
        const item = {
            id: `Analysis.${windowId}.${String(suffix)}`,
            type:
                String(suffix) === 'Valid'
                    ? 'boolean'
                    : String(suffix) === 'Json'
                        ? 'string'
                        : 'number',
            role: String(role),
            def:
                typeof def === 'string' ||
                typeof def === 'number' ||
                typeof def === 'boolean'
                    ? def
                    : ''
        };

        if (unit !== null) item.unit = String(unit);

        DP_DEFINITIONS.push(item);
    }
}

// ============================================================
// Hilfsfunktionen
// ============================================================
function isoNow() {
    return new Date().toISOString();
}

function debugLog(message) {
    if (DEBUG) log(`${LOG_PREFIX} ${message}`, 'info');
}

function readRaw(id) {
    const state = getState(id);
    return state ? state.val : null;
}

function readNumber(id) {
    const state = getState(id);
    if (!state) return null;
    const value = Number(state.val);
    return Number.isFinite(value) ? value : null;
}

function readBoolean(id) {
    const state = getState(id);
    if (!state) return null;

    const value = state.val;

    if (
        value === true || value === 1 || value === '1' ||
        value === 'true' || value === 'TRUE' ||
        value === 'on' || value === 'ON'
    ) return true;

    if (
        value === false || value === 0 || value === '0' ||
        value === 'false' || value === 'FALSE' ||
        value === 'off' || value === 'OFF'
    ) return false;

    return null;
}

function readString(id) {
    const state = getState(id);
    if (!state || state.val === null || state.val === undefined) return null;
    return String(state.val);
}

function sourceExists(id) {
    try {
        return !!getObject(id);
    } catch (e) {
        return false;
    }
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isPlausible(value, limit) {
    return isFiniteNumber(value) && value >= limit.min && value <= limit.max;
}

function validNumbers(values) {
    return values.filter(v => isFiniteNumber(v));
}

function average(values) {
    const list = validNumbers(values);
    if (list.length === 0) return null;
    return list.reduce((sum, v) => sum + v, 0) / list.length;
}

function median(values) {
    const list = validNumbers(values).sort((a, b) => a - b);
    if (list.length === 0) return null;

    const mid = Math.floor(list.length / 2);

    return list.length % 2
        ? list[mid]
        : (list[mid - 1] + list[mid]) / 2;
}

function minimum(values) {
    const list = validNumbers(values);
    return list.length ? Math.min(...list) : null;
}

function maximum(values) {
    const list = validNumbers(values);
    return list.length ? Math.max(...list) : null;
}

function stdDev(values) {
    const list = validNumbers(values);
    if (list.length === 0) return null;

    const mean = average(list);
    const variance = list.reduce(
        (sum, value) => sum + Math.pow(value - mean, 2),
        0
    ) / list.length;

    return Math.sqrt(variance);
}

function classifyComfort(deviation) {
    if (!isFiniteNumber(deviation)) return null;
    if (deviation < -COMFORT_BAND_K) return 'TOO_COLD';
    if (deviation > COMFORT_BAND_K) return 'TOO_WARM';
    return 'OK';
}

function valuesEqual(a, b) {
    if (a === b) return true;
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return false;
}

async function writeState(relativeId, value, forceWrite = false) {
    if (value === null || value === undefined) return;

    const fullId = `${ROOT}.${relativeId}`;
    const old = getState(fullId)?.val;

    const forceInfluxWrite =
        forceInfluxSampleWrites &&
        INFLUX_STATES.has(relativeId);

    if (forceWrite || forceInfluxWrite || !valuesEqual(old, value)) {
        await setStateAsync(fullId, value, true);
    }
}

// ============================================================
// DP-Struktur
// ============================================================
async function ensureDatapoints() {
    let created = 0;
    let existing = 0;
    let normalized = 0;

    // T9.3/T9.4: Zusätzliche AI-Hierarchieebenen werden vor ihren
    // States explizit angelegt. Bestehende Objekte werden nicht umtypisiert.
    const aiChannels = [
        ['Optimization', `${ROOT}.AI.Optimization`],
        ['Recommendation', `${ROOT}.AI.Recommendation`]
    ];

    for (const [name, channelId] of aiChannels) {
        const channel = await getObjectAsync(channelId);

        if (!channel) {
            await extendObjectAsync(channelId, {
                type: 'channel',
                common: {
                    name: name
                },
                native: {}
            });
        }
    }

    for (const def of DP_DEFINITIONS) {
        const id = `${ROOT}.${def.id}`;

        const common = {
            name: def.id.split('.').pop(),
            type: /** @type {'number'|'string'|'boolean'} */ (def.type),
            role: def.role,
            read: true,
            write: def.write === true,
            def: def.def
        };

        if (def.unit !== undefined) {
            common.unit = def.unit;
        }

        const obj = await getObjectAsync(id);

        if (obj) {
            existing++;

            // Alpha.2 wurde beim ersten Lauf mit einer falschen
            // createStateAsync-Signatur erzeugt. Daher normalisieren wir
            // bestehende Analyzer-States einmalig auf die definierten
            // common-Eigenschaften.
            const currentCommon = /** @type {any} */ (obj.common || {});
            const needsNormalize =
                currentCommon.type !== common.type ||
                currentCommon.role !== common.role ||
                currentCommon.read !== true ||
                currentCommon.write !== common.write ||
                (def.unit !== undefined && currentCommon.unit !== def.unit) ||
                (
                    def.id === 'AI.PayloadVersion' &&
                    currentCommon.def !== common.def
                );

            if (needsNormalize) {
                await extendObjectAsync(id, {
                    common: common
                });
                normalized++;
            }

            continue;
        }

        // ioBroker JavaScript API:
        // createStateAsync(name, initialValue, forceCreation, common, native)
        await createStateAsync(
            id,
            def.def,
            false,
            common,
            {}
        );

        created++;
    }

    log(
        `${LOG_PREFIX} DP-Struktur: ${created} neu | ${existing} bereits vorhanden | ${normalized} normalisiert`,
        'info'
    );
}

// ============================================================
// Source Check
// ============================================================
function buildSourceList() {
    const required = [];
    const optional = [];

    for (const [name, id] of Object.entries(NIBE_CONFIG)) {
        required.push({group:'NIBE_CONFIG', name, id});
    }

    const requiredOperating = [
        'outdoorTemperature',
        'flowTarget',
        'flowActual',
        'returnTemperature',
        'degreeMinutes',
        'compressorFrequency',
        'operatingPriority',
        'volumeFlow',
        'defrostActive'
    ];

    for (const [name, id] of Object.entries(NIBE_OPERATING)) {
        (requiredOperating.includes(name) ? required : optional)
            .push({group:'NIBE_OPERATING', name, id});
    }

    for (const [instance, cfg] of Object.entries(HC_INSTANCES)) {
        required.push({
            group:'HEATINGCONTROL',
            name:`instance${instance}.HeatingPeriodActive`,
            id:cfg.heatingPeriodActive
        });

        required.push({
            group:'HEATINGCONTROL',
            name:`instance${instance}.MaintenanceActive`,
            id:cfg.maintenanceActive
        });
    }

    for (const room of ROOMS) {
        const hc = getHcRoomSources(room.hcInstance, room.hcRoom);

        for (const [name, id] of Object.entries(hc)) {
            required.push({group:'ROOM', room:room.id, name, id});
        }

        if (room.roomSensor) {
            required.push({
                group:'ROOM_SENSOR',
                room:room.id,
                name:'roomSensor',
                id:room.roomSensor
            });
        }

        for (const thermostat of room.thermostats) {
            required.push({
                group:'THERMOSTAT',
                room:room.id,
                name:`${thermostat.id}.actual`,
                id:thermostat.actual
            });

            required.push({
                group:'THERMOSTAT',
                room:room.id,
                name:`${thermostat.id}.setpoint`,
                id:thermostat.setpoint
            });
        }
    }

    return {required, optional};
}

function checkSource(item) {
    if (!sourceExists(item.id)) {
        return {...item, ok:false, reason:'OBJECT_NOT_FOUND'};
    }

    const state = getState(item.id);

    if (!state) {
        return {...item, ok:false, reason:'STATE_NOT_READABLE'};
    }

    return {...item, ok:true};
}

function runSourceCheck() {
    const sources = buildSourceList();

    const requiredResults = sources.required.map(checkSource);
    const optionalResults = sources.optional.map(checkSource);

    const requiredMissing = requiredResults.filter(x => !x.ok);
    const optionalMissing = optionalResults.filter(x => !x.ok);

    const roomsWithErrors = new Set(
        requiredMissing.filter(x => x.room).map(x => x.room)
    );

    return {
        generatedAt: isoNow(),

        required: {
            total: requiredResults.length,
            ok: requiredResults.length - requiredMissing.length,
            missing: requiredMissing.map(x => ({
                group:x.group,
                room:x.room || null,
                name:x.name,
                reason:x.reason
            }))
        },

        optional: {
            total: optionalResults.length,
            ok: optionalResults.length - optionalMissing.length,
            missing: optionalMissing.map(x => ({
                group:x.group,
                name:x.name,
                reason:x.reason
            }))
        },

        rooms: {
            configured: ROOMS.length,
            valid: ROOMS.length - roomsWithErrors.size,
            invalid: [...roomsWithErrors]
        },

        ok: requiredMissing.length === 0
    };
}

// ============================================================
// NIBE-Konfiguration
// ============================================================
function readConfiguration() {
    return {
        heatingCurve: readNumber(NIBE_CONFIG.heatingCurve),
        heatingCurveOffset: readNumber(NIBE_CONFIG.heatingCurveOffset),
        flowMin: readNumber(NIBE_CONFIG.flowMin),
        flowMax: readNumber(NIBE_CONFIG.flowMax),
        customCurveP1: readNumber(NIBE_CONFIG.customCurveP1),
        customCurveP2: readNumber(NIBE_CONFIG.customCurveP2),
        customCurveP3: readNumber(NIBE_CONFIG.customCurveP3),
        customCurveP4: readNumber(NIBE_CONFIG.customCurveP4),
        customCurveP5: readNumber(NIBE_CONFIG.customCurveP5),
        customCurveP6: readNumber(NIBE_CONFIG.customCurveP6),
        customCurveP7: readNumber(NIBE_CONFIG.customCurveP7),
        pointOutdoorTemperature: readNumber(NIBE_CONFIG.pointOutdoorTemperature),
        pointOffset: readNumber(NIBE_CONFIG.pointOffset),
        heatingStartUndertemp: readNumber(NIBE_CONFIG.heatingStartUndertemp),
        heatingStopTemperature: readNumber(NIBE_CONFIG.heatingStopTemperature),
        additionalHeatStopTemperature: readNumber(NIBE_CONFIG.additionalHeatStopTemperature),
        autoFilterTime: readNumber(NIBE_CONFIG.autoFilterTime),
        maxFlowDifferenceCompressor: readNumber(NIBE_CONFIG.maxFlowDifferenceCompressor),
        operatingMode: readNumber(NIBE_CONFIG.operatingMode),
        heatingAutomatic: readBoolean(NIBE_CONFIG.heatingAutomatic)
    };
}

function buildConfigurationSignature(config) {
    const fields = [
        ['curve',config.heatingCurve],
        ['offset',config.heatingCurveOffset],
        ['min',config.flowMin],
        ['max',config.flowMax],
        ['p1',config.customCurveP1],
        ['p2',config.customCurveP2],
        ['p3',config.customCurveP3],
        ['p4',config.customCurveP4],
        ['p5',config.customCurveP5],
        ['p6',config.customCurveP6],
        ['p7',config.customCurveP7],
        ['pointOutdoor',config.pointOutdoorTemperature],
        ['pointOffset',config.pointOffset],
        ['startUndertemp',config.heatingStartUndertemp],
        ['heatStop',config.heatingStopTemperature],
        ['zhStop',config.additionalHeatStopTemperature],
        ['filter',config.autoFilterTime],
        ['maxFlowDiff',config.maxFlowDifferenceCompressor],
        ['mode',config.operatingMode],
        ['auto',config.heatingAutomatic]
    ];

    return fields
        .map(([key,value]) => `${key}=${value === null ? 'null' : value}`)
        .join('|');
}

async function writeConfiguration(config, signature) {
    const previousSignature =
        getState(`${ROOT}.Configuration.ConfigurationSignature`)?.val || '';

    const values = {
        'Configuration.HeatingCurve': config.heatingCurve,
        'Configuration.HeatingCurveOffset': config.heatingCurveOffset,
        'Configuration.FlowMin': config.flowMin,
        'Configuration.FlowMax': config.flowMax,
        'Configuration.CustomCurveP1': config.customCurveP1,
        'Configuration.CustomCurveP2': config.customCurveP2,
        'Configuration.CustomCurveP3': config.customCurveP3,
        'Configuration.CustomCurveP4': config.customCurveP4,
        'Configuration.CustomCurveP5': config.customCurveP5,
        'Configuration.CustomCurveP6': config.customCurveP6,
        'Configuration.CustomCurveP7': config.customCurveP7,
        'Configuration.PointOutdoorTemperature': config.pointOutdoorTemperature,
        'Configuration.PointOffset': config.pointOffset,
        'Configuration.HeatingStartUndertemp': config.heatingStartUndertemp,
        'Configuration.HeatingStopTemperature': config.heatingStopTemperature,
        'Configuration.AdditionalHeatStopTemperature': config.additionalHeatStopTemperature,
        'Configuration.AutoFilterTime': config.autoFilterTime,
        'Configuration.MaxFlowDifferenceCompressor': config.maxFlowDifferenceCompressor,
        'Configuration.OperatingMode': config.operatingMode,
        'Configuration.HeatingAutomatic': config.heatingAutomatic,
        'Configuration.ConfigurationSignature': signature,
        'Configuration.Json': JSON.stringify({...config, signature})
    };

    for (const [relativeId, value] of Object.entries(values)) {
        await writeState(relativeId, value);
    }

    if (previousSignature !== signature) {
        await writeState('Configuration.ChangedAt', isoNow());

        if (previousSignature) {
            log(
                `${LOG_PREFIX} NIBE-Konfiguration geändert | neue ConfigurationSignature`,
                'info'
            );
        }
    }
}

// ============================================================
// NIBE-Current
// ============================================================
function readNibeCurrent() {
    const current = {
        outdoorTemperature: readNumber(NIBE_OPERATING.outdoorTemperature),
        outdoorTemperatureBT28: readNumber(NIBE_OPERATING.outdoorTemperatureBT28),
        flowTarget: readNumber(NIBE_OPERATING.flowTarget),
        flowActual: readNumber(NIBE_OPERATING.flowActual),
        returnTemperature: readNumber(NIBE_OPERATING.returnTemperature),
        degreeMinutes: readNumber(NIBE_OPERATING.degreeMinutes),
        compressorFrequency: readNumber(NIBE_OPERATING.compressorFrequency),
        compressorStatus: readNumber(NIBE_OPERATING.compressorStatus),
        compressorDemand: readNumber(NIBE_OPERATING.compressorDemand),
        operatingPriority: readNumber(NIBE_OPERATING.operatingPriority),
        volumeFlow: readNumber(NIBE_OPERATING.volumeFlow),
        defrostActive: readBoolean(NIBE_OPERATING.defrostActive),
        additionalHeatPower: readNumber(NIBE_OPERATING.additionalHeatPower),
        additionalHeatMode: readNumber(NIBE_OPERATING.additionalHeatMode),
        heatPower: readNumber(NIBE_OPERATING.heatPower),
        electricalPower: readNumber(NIBE_OPERATING.electricalPower)
    };

    current.outdoorSensorDifference =
        isFiniteNumber(current.outdoorTemperature) &&
        isFiniteNumber(current.outdoorTemperatureBT28)
            ? current.outdoorTemperature - current.outdoorTemperatureBT28
            : null;

    current.supplyDeviation =
        isFiniteNumber(current.flowActual) &&
        isFiniteNumber(current.flowTarget)
            ? current.flowActual - current.flowTarget
            : null;

    current.deltaT =
        isFiniteNumber(current.flowActual) &&
        isFiniteNumber(current.returnTemperature)
            ? current.flowActual - current.returnTemperature
            : null;

    current.compressorActive =
        isFiniteNumber(current.compressorFrequency)
            ? current.compressorFrequency >= 1
            : false;

    current.additionalHeatActive =
        isFiniteNumber(current.additionalHeatPower)
            ? current.additionalHeatPower > 0
            : (
                isFiniteNumber(current.additionalHeatMode)
                    ? current.additionalHeatMode > 0
                    : false
            );

    return current;
}

function validateNibeCurrent(current) {
    const reasons = [];

    const requiredPlausible =
        isPlausible(current.outdoorTemperature, LIMITS.outdoorTemperature) &&
        isPlausible(current.flowTarget, LIMITS.flowTarget) &&
        isPlausible(current.flowActual, LIMITS.flowActual) &&
        isPlausible(current.returnTemperature, LIMITS.returnTemperature) &&
        isPlausible(current.degreeMinutes, LIMITS.degreeMinutes) &&
        isPlausible(current.compressorFrequency, LIMITS.compressorFrequency) &&
        isPlausible(current.volumeFlow, LIMITS.volumeFlow);

    if (!requiredPlausible) {
        reasons.push('INVALID_NIBE_DATA');
    }

    if (current.operatingPriority !== 30) {
        reasons.push('NIBE_NOT_HEATING');
    }

    if (!current.compressorActive) {
        reasons.push('COMPRESSOR_INACTIVE');
    }

    if (current.defrostActive === true) {
        reasons.push('DEFROST_ACTIVE');
    }

    if (!isFiniteNumber(current.volumeFlow) || current.volumeFlow <= 0) {
        reasons.push('NO_VOLUME_FLOW');
    }

    return {
        valid:
            requiredPlausible &&
            current.operatingPriority === 30 &&
            current.compressorActive &&
            current.defrostActive === false &&
            current.volumeFlow > 0,
        reasons
    };
}

// ============================================================
// heatingcontrol-Instanzstatus
// ============================================================
function readHeatingControlStatus() {
    const result = {};

    for (const [instance, cfg] of Object.entries(HC_INSTANCES)) {
        const heatingPeriodActive = readBoolean(cfg.heatingPeriodActive);
        const maintenanceActive = readBoolean(cfg.maintenanceActive);

        result[instance] = {
            name: cfg.name,
            heatingPeriodActive,
            maintenanceActive,
            valid:
                heatingPeriodActive === true &&
                maintenanceActive === false
        };
    }

    return result;
}

// ============================================================
// Raum-Auswertung
// ============================================================
function evaluateRoom(room, hcStatus) {
    const hc = getHcRoomSources(room.hcInstance, room.hcRoom);
    const instanceStatus = hcStatus[String(room.hcInstance)];

    const scheduleTarget = readNumber(hc.scheduleTarget);
    const effectiveTarget = readNumber(hc.effectiveTarget);
    const roomState = readString(hc.state);
    const windowOpen = readBoolean(hc.windowOpen);
    const roomActive = readBoolean(hc.active);
    const overrideTemperature = readNumber(hc.overrideTemperature);
    const overrideRemainingMinutes = readNumber(hc.overrideRemainingMinutes);

    const thermostatDetails = room.thermostats.map(t => ({
        id: t.id,
        name: t.name,
        temperature: readNumber(t.actual),
        setpoint: readNumber(t.setpoint)
    }));

    const validThermostatTemperatures =
        thermostatDetails
            .map(t => t.temperature)
            .filter(v => isPlausible(v, LIMITS.roomTemperature));

    let actualTemperature = null;
    let temperatureSource = null;

    if (room.roomSensor) {
        const roomSensorTemperature = readNumber(room.roomSensor);

        if (isPlausible(roomSensorTemperature, LIMITS.roomTemperature)) {
            actualTemperature = roomSensorTemperature;
            temperatureSource = 'roomSensor';
        }
    }

    if (!isFiniteNumber(actualTemperature)) {
        if (validThermostatTemperatures.length === 1) {
            actualTemperature = validThermostatTemperatures[0];
            temperatureSource = 'thermostat';
        } else if (validThermostatTemperatures.length > 1) {
            actualTemperature = average(validThermostatTemperatures);
            temperatureSource = 'thermostatMean';
        }
    }

    const actualValid =
        isPlausible(actualTemperature, LIMITS.roomTemperature);

    const scheduleValid =
        isPlausible(scheduleTarget, LIMITS.scheduleTarget);

    const deviation =
        actualValid && scheduleValid
            ? actualTemperature - scheduleTarget
            : null;

    const comfortState = classifyComfort(deviation);

    const overrideActive =
        (isFiniteNumber(overrideTemperature) && overrideTemperature !== 0) ||
        (isFiniteNumber(overrideRemainingMinutes) && overrideRemainingMinutes > 0);

    const dataExcludeReasons = [];

    if (roomActive !== true) {
        dataExcludeReasons.push('ROOM_INACTIVE');
    }

    if (!isFiniteNumber(actualTemperature)) {
        dataExcludeReasons.push('NO_ACTUAL_TEMPERATURE');
    } else if (!actualValid) {
        dataExcludeReasons.push('INVALID_ACTUAL_TEMPERATURE');
    }

    if (!isFiniteNumber(scheduleTarget)) {
        dataExcludeReasons.push('NO_SCHEDULE_TARGET');
    } else if (!scheduleValid) {
        dataExcludeReasons.push('INVALID_SCHEDULE_TARGET');
    }

    const dataValid =
        roomActive === true &&
        actualValid &&
        scheduleValid;

    const analysisExcludeReasons = [...dataExcludeReasons];

    if (instanceStatus?.heatingPeriodActive !== true) {
        analysisExcludeReasons.push('HEATING_PERIOD_INACTIVE');
    }

    if (instanceStatus?.maintenanceActive === true) {
        analysisExcludeReasons.push('MAINTENANCE');
    }

    if (windowOpen === true) {
        analysisExcludeReasons.push('WINDOW_OPEN');
    }

    if (overrideActive) {
        analysisExcludeReasons.push('OVERRIDE_ACTIVE');
    }

    const validForHeatingCurve =
        dataValid &&
        instanceStatus?.valid === true &&
        windowOpen === false &&
        !overrideActive;

    return {
        id: room.id,
        name: room.name,
        hcInstance: room.hcInstance,

        actualTemperature,
        temperatureSource,

        scheduleTarget,
        effectiveTarget,
        deviation,
        comfortState,

        windowOpen,
        roomState,
        roomActive,

        overrideActive,
        overrideTemperature,
        overrideRemainingMinutes,

        dataValid,
        validForHeatingCurve,
        excludeReasons: analysisExcludeReasons,

        thermostats: thermostatDetails
    };
}

function evaluateRooms(hcStatus) {
    const details = ROOMS.map(room => evaluateRoom(room, hcStatus));

    const activeRooms =
        details.filter(r => r.roomActive === true);

    const dataValidRooms =
        details.filter(r => r.dataValid);

    const validRooms =
        details.filter(r => r.validForHeatingCurve);

    const deviations =
        validRooms
            .map(r => r.deviation)
            .filter(isFiniteNumber);

    const tooColdRooms =
        validRooms.filter(r => r.comfortState === 'TOO_COLD');

    const okRooms =
        validRooms.filter(r => r.comfortState === 'OK');

    const tooWarmRooms =
        validRooms.filter(r => r.comfortState === 'TOO_WARM');

    let coldestRoom = null;
    let warmestRoom = null;

    for (const room of validRooms) {
        if (!isFiniteNumber(room.deviation)) continue;

        if (!coldestRoom || room.deviation < coldestRoom.deviation) {
            coldestRoom = room;
        }

        if (!warmestRoom || room.deviation > warmestRoom.deviation) {
            warmestRoom = room;
        }
    }

    const minDeviation = minimum(deviations);
    const maxDeviation = maximum(deviations);

    return {
        details,

        summary: {
            count: details.length,
            activeCount: activeRooms.length,
            dataValidCount: dataValidRooms.length,
            validForHeatingCurveCount: validRooms.length,

            tooColdCount: tooColdRooms.length,
            okCount: okRooms.length,
            tooWarmCount: tooWarmRooms.length,

            averageDeviation: average(deviations),
            medianDeviation: median(deviations),
            minimumDeviation: minDeviation,
            maximumDeviation: maxDeviation,
            deviationStdDev: stdDev(deviations),

            deviationRange:
                isFiniteNumber(minDeviation) &&
                isFiniteNumber(maxDeviation)
                    ? maxDeviation - minDeviation
                    : null,

            coldestRoom:
                coldestRoom ? coldestRoom.name : '',

            coldestRoomDeviation:
                coldestRoom ? coldestRoom.deviation : null,

            warmestRoom:
                warmestRoom ? warmestRoom.name : '',

            warmestRoomDeviation:
                warmestRoom ? warmestRoom.deviation : null
        }
    };
}

// ============================================================
// Current SampleValid / SampleQuality
// ============================================================
function evaluateCurrentSample(nibe, nibeValidation, rooms, hcStatus) {
    const reasons = [...nibeValidation.reasons];

    const anyHeatingControlValid =
        Object.values(hcStatus).some(status => status.valid === true);

    if (!anyHeatingControlValid) {
        reasons.push('NO_HEATING_PERIOD_ACTIVE');
    }

    const activeCount = rooms.summary.activeCount;
    const validCount = rooms.summary.validForHeatingCurveCount;

    const validRatio =
        activeCount > 0
            ? validCount / activeCount
            : 0;

    if (validCount < MIN_VALID_ROOMS) {
        reasons.push('INSUFFICIENT_VALID_ROOMS');
    }

    if (validRatio < MIN_VALID_ROOM_RATIO) {
        reasons.push('VALID_ROOM_RATIO_TOO_LOW');
    }

    const sampleValid =
        nibeValidation.valid &&
        anyHeatingControlValid &&
        validCount >= MIN_VALID_ROOMS &&
        validRatio >= MIN_VALID_ROOM_RATIO;

    // T4 v0.1 SampleQuality
    let quality = 0;

    // 40 Punkte: NIBE-Pflichtdaten
    if (
        isPlausible(nibe.outdoorTemperature, LIMITS.outdoorTemperature) &&
        isPlausible(nibe.flowTarget, LIMITS.flowTarget) &&
        isPlausible(nibe.flowActual, LIMITS.flowActual) &&
        isPlausible(nibe.returnTemperature, LIMITS.returnTemperature) &&
        isPlausible(nibe.degreeMinutes, LIMITS.degreeMinutes) &&
        isPlausible(nibe.compressorFrequency, LIMITS.compressorFrequency) &&
        isPlausible(nibe.volumeFlow, LIMITS.volumeFlow)
    ) {
        quality += 40;
    }

    // 40 Punkte: Anteil gültiger Räume
    quality += Math.round(
        Math.min(1, Math.max(0, validRatio)) * 40
    );

    // 10 Punkte: keine Zusatzheizung
    if (!nibe.additionalHeatActive) {
        quality += 10;
    }

    // 5 Punkte: BT1 / BT28 plausibel
    if (
        isFiniteNumber(nibe.outdoorSensorDifference) &&
        Math.abs(nibe.outdoorSensorDifference) < 3
    ) {
        quality += 5;
    }

    // 5 Punkte: keine sonstigen Warnungen aus Pflichtdaten
    if (
        nibeValidation.reasons.length === 0 &&
        rooms.summary.dataValidCount === rooms.summary.activeCount
    ) {
        quality += 5;
    }

    quality = Math.max(0, Math.min(100, quality));

    return {
        valid: sampleValid,
        quality,
        reasons: [...new Set(reasons)]
    };
}

// ============================================================
// Outputs
// ============================================================
async function writeCurrent(nibe, sampleEvaluation, forceInfluxWrite = false) {
    const values = {
        'Current.OutdoorTemperature': nibe.outdoorTemperature,
        'Current.OutdoorTemperatureBT28': nibe.outdoorTemperatureBT28,
        'Current.OutdoorSensorDifference': nibe.outdoorSensorDifference,
        'Current.FlowTarget': nibe.flowTarget,
        'Current.FlowActual': nibe.flowActual,
        'Current.ReturnTemperature': nibe.returnTemperature,
        'Current.SupplyDeviation': nibe.supplyDeviation,
        'Current.DeltaT': nibe.deltaT,
        'Current.DegreeMinutes': nibe.degreeMinutes,
        'Current.CompressorFrequency': nibe.compressorFrequency,
        'Current.CompressorActive': nibe.compressorActive,
        'Current.CompressorStatus': nibe.compressorStatus,
        'Current.CompressorDemand': nibe.compressorDemand,
        'Current.OperatingPriority': nibe.operatingPriority,
        'Current.VolumeFlow': nibe.volumeFlow,
        'Current.DefrostActive': nibe.defrostActive,
        'Current.AdditionalHeatPower': nibe.additionalHeatPower,
        'Current.AdditionalHeatActive': nibe.additionalHeatActive,
        'Current.HeatPower': nibe.heatPower,
        'Current.ElectricalPower': nibe.electricalPower,
        'Current.SampleValid': sampleEvaluation.valid,
        'Current.SampleQuality': sampleEvaluation.quality,
        'Current.ExcludeReasonsJson': JSON.stringify(sampleEvaluation.reasons)
    };

    for (const [relativeId, value] of Object.entries(values)) {
        await writeState(
            relativeId,
            value,
            forceInfluxWrite && INFLUX_STATES.has(relativeId)
        );
    }
}

async function writeRooms(roomEvaluation, forceInfluxWrite = false) {
    const s = roomEvaluation.summary;

    const values = {
        'Rooms.Count': s.count,
        'Rooms.ActiveCount': s.activeCount,
        'Rooms.DataValidCount': s.dataValidCount,
        'Rooms.ValidForHeatingCurveCount': s.validForHeatingCurveCount,
        'Rooms.TooColdCount': s.tooColdCount,
        'Rooms.OKCount': s.okCount,
        'Rooms.TooWarmCount': s.tooWarmCount,
        'Rooms.AverageDeviation': s.averageDeviation,
        'Rooms.MedianDeviation': s.medianDeviation,
        'Rooms.MinimumDeviation': s.minimumDeviation,
        'Rooms.MaximumDeviation': s.maximumDeviation,
        'Rooms.DeviationStdDev': s.deviationStdDev,
        'Rooms.DeviationRange': s.deviationRange,
        'Rooms.ColdestRoom': s.coldestRoom,
        'Rooms.ColdestRoomDeviation': s.coldestRoomDeviation,
        'Rooms.WarmestRoom': s.warmestRoom,
        'Rooms.WarmestRoomDeviation': s.warmestRoomDeviation,
        'Rooms.Json': JSON.stringify({
            summary: s,
            details: roomEvaluation.details
        })
    };

    for (const [relativeId, value] of Object.entries(values)) {
        await writeState(
            relativeId,
            value,
            forceInfluxWrite && INFLUX_STATES.has(relativeId)
        );
    }
}


// ============================================================
// T9.8 - OptimizationRecord v1.0
// ============================================================
const OPTIMIZATION_RECORD_SCHEMA = 'NPS-AI-OptimizationRecord';
const OPTIMIZATION_RECORD_SCHEMA_VERSION = '1.0';

function optimizationReadJsonState(relativeId) {
    const raw = getState(`${ROOT}.${relativeId}`)?.val;

    if (
        raw === null ||
        raw === undefined ||
        raw === '' ||
        raw === 'null' ||
        raw === '{}'
    ) {
        return null;
    }

    try {
        const parsed = JSON.parse(String(raw));
        return recommendationIsObject(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function optimizationAnalysisSnapshot() {
    const payload = optimizationReadJsonState('AI.AnalysisPayload');

    if (!payload) return null;

    return {
        generatedAt: recommendationString(payload.generatedAt, ''),
        ready: payload.ready === true,
        configurationSignature:
            recommendationString(payload.configuration?.signature, ''),
        analysis72h:
            recommendationIsObject(payload.analysis?.['72h'])
                ? payload.analysis['72h']
                : null,
        evidence:
            recommendationIsObject(payload.evidence)
                ? payload.evidence
                : null,
        dataQuality:
            recommendationIsObject(payload.dataQuality)
                ? payload.dataQuality
                : null
    };
}

function optimizationRecordId(receivedAt, parameter) {
    const stamp = recommendationIsNonEmptyString(receivedAt)
        ? receivedAt
        : new Date().toISOString();

    return `${stamp}|${parameter || 'unknown'}`;
}

function buildPendingOptimizationRecord(payload, context = {}) {
    const recommendation = payload.recommendation;
    const assessment = payload.assessment;
    const receivedAt = recommendationString(
        context.receivedAt,
        recommendationString(
            getState(`${ROOT}.AI.Recommendation.ReceivedAt`)?.val,
            new Date().toISOString()
        )
    );

    const observationHours =
        recommendationNumber(
            payload.observation?.recommendedObservationHours,
            RECOMMENDATION_STANDARD_OBSERVATION_HOURS
        );

    return {
        schema: OPTIMIZATION_RECORD_SCHEMA,
        schemaVersion: OPTIMIZATION_RECORD_SCHEMA_VERSION,
        recordId: optimizationRecordId(
            receivedAt,
            recommendation.parameter
        ),
        recordState: 'PENDING_MANUAL_CHANGE',
        createdAt: recommendationString(context.createdAt, new Date().toISOString()),
        source: {
            recommendationReceivedAt: receivedAt,
            analysisGeneratedAt: recommendationString(
                payload.analysisReference?.analysisGeneratedAt,
                ''
            ),
            analysisSchemaVersion: recommendationString(
                payload.analysisReference?.analysisSchemaVersion,
                ''
            )
        },
        recommendation: {
            confidence: recommendationNumber(payload.confidence, 0),
            overallState: recommendationString(
                assessment?.overallState,
                ''
            ),
            primaryFinding: recommendationString(
                assessment?.primaryFinding,
                ''
            ),
            reasonCodes: Array.isArray(payload.reasonCodes)
                ? payload.reasonCodes.slice()
                : [],
            explanation: recommendationString(payload.explanation, '')
        },
        change: {
            parameter: recommendationString(recommendation.parameter, ''),
            beforeValue: recommendationNumber(recommendation.currentValue, 0),
            recommendedValue: recommendationNumber(
                recommendation.recommendedValue,
                0
            ),
            change: recommendationNumber(recommendation.change, 0),
            afterValue: null,
            beforeConfigurationSignature: recommendationString(
                payload.analysisReference?.configurationSignature,
                ''
            ),
            afterConfigurationSignature: null,
            appliedAt: null
        },
        observation: {
            recommendedHours: observationHours,
            startedAt: null,
            evaluateAfter: null
        },
        before: context.beforeSnapshot ?? optimizationAnalysisSnapshot(),
        after: null,
        evaluation: {
            status: 'NOT_EVALUATED',
            evaluatedAt: null,
            reasonCodes: [],
            summary: ''
        }
    };
}

async function capturePendingOptimizationRecord(payload) {
    if (
        !recommendationIsObject(payload) ||
        !recommendationIsObject(payload.recommendation) ||
        payload.recommendation.action !== 'CHANGE_PARAMETER'
    ) {
        return null;
    }

    const candidate = buildPendingOptimizationRecord(payload);
    const existing = optimizationReadJsonState(
        'AI.Optimization.PendingRecord'
    );

    if (
        existing?.schema === OPTIMIZATION_RECORD_SCHEMA &&
        existing?.schemaVersion === OPTIMIZATION_RECORD_SCHEMA_VERSION &&
        existing?.recordId === candidate.recordId &&
        existing?.change?.beforeConfigurationSignature ===
            candidate.change.beforeConfigurationSignature
    ) {
        return existing;
    }

    await setStateAsync(
        `${ROOT}.AI.Optimization.PendingRecord`,
        JSON.stringify(candidate),
        true
    );
    await setStateAsync(
        `${ROOT}.AI.Optimization.Status`,
        'WAITING_FOR_MANUAL_CHANGE',
        true
    );

    log(
        `${LOG_PREFIX} OptimizationRecord: PendingRecord angelegt | ` +
        `Parameter=${candidate.change.parameter} | ` +
        `${candidate.change.beforeValue} -> ${candidate.change.recommendedValue}`,
        'info'
    );

    return candidate;
}

function optimizationCurrentParameterValue(config, parameter) {
    if (parameter === 'heatingCurve') {
        return recommendationIsFiniteNumber(Number(config?.heatingCurve))
            ? Number(config.heatingCurve)
            : null;
    }

    if (parameter === 'heatingCurveOffset') {
        return recommendationIsFiniteNumber(Number(config?.heatingCurveOffset))
            ? Number(config.heatingCurveOffset)
            : null;
    }

    return null;
}

function buildObservingOptimizationRecord(
    pending,
    {appliedAt, currentValue, signature}
) {
    const observationHours = recommendationNumber(
        pending.observation?.recommendedHours,
        RECOMMENDATION_STANDARD_OBSERVATION_HOURS
    );
    const evaluateAfter = new Date(
        Date.parse(appliedAt) + observationHours * 60 * 60 * 1000
    ).toISOString();

    return {
        ...pending,
        recordState: 'OBSERVING',
        change: {
            ...pending.change,
            afterValue: currentValue,
            afterConfigurationSignature: signature,
            appliedAt
        },
        observation: {
            recommendedHours: observationHours,
            startedAt: appliedAt,
            evaluateAfter
        },
        after: null,
        evaluation: {
            status: 'NOT_EVALUATED',
            evaluatedAt: null,
            reasonCodes: [],
            summary: ''
        }
    };
}

async function finalizePendingOptimizationRecord({timestamp, config, signature}) {
    const pending = optimizationReadJsonState(
        'AI.Optimization.PendingRecord'
    );

    if (!pending) return null;

    if (
        pending.schema !== OPTIMIZATION_RECORD_SCHEMA ||
        pending.schemaVersion !== OPTIMIZATION_RECORD_SCHEMA_VERSION ||
        !recommendationIsObject(pending.change)
    ) {
        await setStateAsync(
            `${ROOT}.AI.Optimization.Status`,
            'PENDING_RECORD_INVALID',
            true
        );
        return null;
    }

    const beforeSignature = recommendationString(
        pending.change.beforeConfigurationSignature,
        ''
    );

    if (
        !recommendationIsNonEmptyString(signature) ||
        signature === beforeSignature
    ) {
        return null;
    }

    const currentValue = optimizationCurrentParameterValue(
        config,
        pending.change.parameter
    );
    const recommendedValue = pending.change.recommendedValue;

    if (
        currentValue === null ||
        !recommendationIsFiniteNumber(recommendedValue) ||
        Math.abs(currentValue - recommendedValue) > 0.000001
    ) {
        await setStateAsync(
            `${ROOT}.AI.Optimization.PendingRecord`,
            'null',
            true
        );
        await setStateAsync(
            `${ROOT}.AI.Optimization.Status`,
            'CONFIGURATION_CHANGED_UNEXPECTEDLY',
            true
        );

        log(
            `${LOG_PREFIX} OptimizationRecord: PendingRecord verworfen | ` +
            `Konfiguration geändert, Zielwert nicht bestätigt`,
            'warn'
        );
        return null;
    }

    const appliedAt = recommendationIsNonEmptyString(timestamp)
        ? timestamp
        : new Date().toISOString();
    const record = buildObservingOptimizationRecord(
        pending,
        { appliedAt, currentValue, signature }
    );
    const observationHours = record.observation.recommendedHours;

    await setStateAsync(
        `${ROOT}.AI.Optimization.LastRecord`,
        JSON.stringify(record),
        true
    );
    await setStateAsync(
        `${ROOT}.AI.Optimization.PendingRecord`,
        'null',
        true
    );
    await setStateAsync(
        `${ROOT}.AI.Optimization.Status`,
        'OBSERVING',
        true
    );

    log(
        `${LOG_PREFIX} OptimizationRecord: manuelle Änderung dokumentiert | ` +
        `Parameter=${record.change.parameter} | ` +
        `${record.change.beforeValue} -> ${record.change.afterValue} | ` +
        `Beobachtung=${observationHours} h`,
        'info'
    );

    return record;
}

// ============================================================
// T9.9 - OptimizationRecord Evaluation
// ============================================================
function optimizationEvaluationMetrics(snapshot) {
    const analysis72h = snapshot?.analysis72h;
    const rooms = analysis72h?.rooms;

    if (
        !recommendationIsObject(snapshot) ||
        !recommendationIsObject(analysis72h) ||
        !recommendationIsObject(rooms)
    ) {
        return null;
    }

    const medianDeviationRaw = rooms.medianDeviationK;
    const okRatioRaw = rooms.okRatioPercent;

    if (
        !recommendationIsFiniteNumber(medianDeviationRaw) ||
        !recommendationIsFiniteNumber(okRatioRaw)
    ) {
        return null;
    }

    return {
        medianRoomDeviationK: roundNumber(medianDeviationRaw, 1),
        absoluteMedianRoomDeviationK: roundNumber(Math.abs(medianDeviationRaw), 1),
        okRatioPercent: roundNumber(okRatioRaw, 1)
    };
}

function classifyOptimizationEvaluation(beforeSnapshot, afterSnapshot) {
    const before = optimizationEvaluationMetrics(beforeSnapshot);
    const after = optimizationEvaluationMetrics(afterSnapshot);

    if (!before || !after) {
        return {
            status: 'INCONCLUSIVE',
            reasonCodes: ['EVALUATION_METRICS_MISSING'],
            summary: 'Vorher-/Nachher-Metriken fuer die Bewertung fehlen.',
            metrics: null
        };
    }

    const absoluteDeviationImprovementK = roundNumber(
        before.absoluteMedianRoomDeviationK -
            after.absoluteMedianRoomDeviationK,
        1
    );
    const okRatioChangePercentPoints = roundNumber(
        after.okRatioPercent - before.okRatioPercent,
        1
    );

    const deviationLimit =
        OPTIMIZATION_EVALUATION_LIMITS.MEDIAN_ABS_DEVIATION_CHANGE_K;
    const okRatioLimit =
        OPTIMIZATION_EVALUATION_LIMITS.OK_RATIO_CHANGE_PERCENT_POINTS;

    const deviationDirection =
        absoluteDeviationImprovementK >= deviationLimit
            ? 1
            : absoluteDeviationImprovementK <= -deviationLimit
                ? -1
                : 0;

    const okRatioDirection =
        okRatioChangePercentPoints >= okRatioLimit
            ? 1
            : okRatioChangePercentPoints <= -okRatioLimit
                ? -1
                : 0;

    let status;
    let reasonCodes;
    let summary;

    if (
        (deviationDirection > 0 || okRatioDirection > 0) &&
        deviationDirection >= 0 &&
        okRatioDirection >= 0
    ) {
        status = 'IMPROVED';
        reasonCodes = ['COMFORT_METRICS_IMPROVED'];
        summary = 'Die Komfortkennzahlen haben sich nach der Aenderung verbessert.';
    } else if (
        (deviationDirection < 0 || okRatioDirection < 0) &&
        deviationDirection <= 0 &&
        okRatioDirection <= 0
    ) {
        status = 'WORSENED';
        reasonCodes = ['COMFORT_METRICS_WORSENED'];
        summary = 'Die Komfortkennzahlen haben sich nach der Aenderung verschlechtert.';
    } else if (
        deviationDirection === 0 &&
        okRatioDirection === 0
    ) {
        status = 'UNCHANGED';
        reasonCodes = ['NO_SIGNIFICANT_CHANGE'];
        summary = 'Es ist keine ausreichend grosse Aenderung der Komfortkennzahlen erkennbar.';
    } else {
        status = 'INCONCLUSIVE';
        reasonCodes = ['EVALUATION_METRICS_CONFLICT'];
        summary = 'Die Vorher-/Nachher-Kennzahlen zeigen kein eindeutiges gemeinsames Ergebnis.';
    }

    return {
        status,
        reasonCodes,
        summary,
        metrics: {
            before,
            after,
            absoluteMedianDeviationImprovementK: absoluteDeviationImprovementK,
            okRatioChangePercentPoints
        }
    };
}

function optimizationEvaluationPreconditionErrors(record, afterSnapshot, signature) {
    const reasons = [];

    if (!recommendationIsObject(record?.before)) {
        reasons.push('BEFORE_SNAPSHOT_MISSING');
    } else {
        if (record.before.ready !== true) {
            reasons.push('BEFORE_ANALYSIS_NOT_READY');
        }
        if (record.before.analysis72h?.valid !== true) {
            reasons.push('BEFORE_72H_ANALYSIS_INVALID');
        }
    }

    if (!recommendationIsObject(afterSnapshot)) {
        reasons.push('AFTER_SNAPSHOT_MISSING');
    } else {
        if (afterSnapshot.ready !== true) {
            reasons.push('AFTER_ANALYSIS_NOT_READY');
        }
        if (afterSnapshot.analysis72h?.valid !== true) {
            reasons.push('AFTER_72H_ANALYSIS_INVALID');
        }
    }

    const expectedSignature = recommendationString(
        record?.change?.afterConfigurationSignature,
        ''
    );
    if (
        !recommendationIsNonEmptyString(signature) ||
        !recommendationIsNonEmptyString(expectedSignature) ||
        signature !== expectedSignature
    ) {
        reasons.push('CONFIGURATION_CHANGED_DURING_OBSERVATION');
    }

    return reasons;
}

async function evaluateLastOptimizationRecord({timestamp, signature}) {
    const record = optimizationReadJsonState(
        'AI.Optimization.LastRecord'
    );

    if (!record) return null;

    if (
        record.schema !== OPTIMIZATION_RECORD_SCHEMA ||
        record.schemaVersion !== OPTIMIZATION_RECORD_SCHEMA_VERSION ||
        record.recordState !== 'OBSERVING' ||
        record.evaluation?.status !== 'NOT_EVALUATED'
    ) {
        return null;
    }

    const evaluateAfter = Date.parse(
        recommendationString(record.observation?.evaluateAfter, '')
    );
    const nowMs =
        recommendationIsFiniteNumber(Number(timestamp))
            ? Number(timestamp)
            : Date.now();

    if (!Number.isFinite(evaluateAfter) || nowMs < evaluateAfter) {
        return null;
    }

    const afterSnapshot = optimizationAnalysisSnapshot();
    const preconditionErrors =
        optimizationEvaluationPreconditionErrors(
            record,
            afterSnapshot,
            signature
        );

    const evaluatedAt = new Date(nowMs).toISOString();
    let result;

    if (preconditionErrors.length > 0) {
        result = {
            status: 'INCONCLUSIVE',
            reasonCodes: preconditionErrors,
            summary: 'Die Beobachtungsphase ist beendet, aber die Datenbasis erlaubt keine belastbare Bewertung.',
            metrics: null
        };
    } else {
        result = classifyOptimizationEvaluation(
            record.before,
            afterSnapshot
        );
    }

    const evaluatedRecord = {
        ...record,
        recordState: 'EVALUATED',
        after: afterSnapshot,
        evaluation: {
            status: result.status,
            evaluatedAt,
            reasonCodes: result.reasonCodes,
            summary: result.summary,
            metrics: result.metrics
        }
    };

    await setStateAsync(
        `${ROOT}.AI.Optimization.LastRecord`,
        JSON.stringify(evaluatedRecord),
        true
    );
    await setStateAsync(
        `${ROOT}.AI.Optimization.Status`,
        'EVALUATED',
        true
    );

    log(
        `${LOG_PREFIX} OptimizationRecord: Bewertung abgeschlossen | ` +
        `Ergebnis=${result.status}` +
        `${result.reasonCodes.length > 0 ? ` | ${result.reasonCodes.join(',')}` : ''}`,
        result.status === 'WORSENED' || result.status === 'INCONCLUSIVE'
            ? 'warn'
            : 'info'
    );

    return evaluatedRecord;
}

// ============================================================
// T9.5 - RecommendationPayload Parser
// ============================================================
let recommendationSubscription = null;

function recommendationString(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}

function recommendationNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function recommendationBoolean(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function recommendationJson(value, fallback) {
    if (value === undefined) return fallback;

    try {
        return JSON.stringify(value);
    } catch (_) {
        return fallback;
    }
}

function recommendationConfidencePercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

    // Standardschema verwendet 0.0 ... 1.0. Werte außerhalb dieses
    // Bereichs werden vom Parser nicht fachlich bewertet; T9.6 validiert sie.
    const percent = value >= 0 && value <= 1
        ? value * 100
        : value;

    return Math.round(percent * 10) / 10;
}


// ============================================================
// T9.6 - RecommendationPayload Validator
// ============================================================
const RECOMMENDATION_SCHEMA = 'NPS-AI-RecommendationPayload';
const RECOMMENDATION_SCHEMA_VERSION = '1.0';
const RECOMMENDATION_ANALYSIS_SCHEMA_VERSION = '1.1';
const RECOMMENDATION_MIN_CHANGE_CONFIDENCE = 0.75;
const RECOMMENDATION_STANDARD_OBSERVATION_HOURS = 72;

const RECOMMENDATION_ACTIONS = new Set([
    'NO_CHANGE',
    'CHANGE_PARAMETER',
    'INVESTIGATE',
    'INSUFFICIENT_DATA'
]);

const RECOMMENDATION_OVERALL_STATES = new Set([
    'SYSTEM_OK',
    'OPTIMIZATION_RECOMMENDED',
    'INVESTIGATION_REQUIRED',
    'INSUFFICIENT_DATA',
    'INCONCLUSIVE'
]);

const RECOMMENDATION_PRIMARY_FINDINGS = new Set([
    'SYSTEM_OK',
    'HEATING_CURVE_TOO_HIGH',
    'HEATING_CURVE_TOO_LOW',
    'HEATING_CURVE_TOO_STEEP',
    'HEATING_CURVE_TOO_FLAT',
    'CURVE_OFFSET_TOO_HIGH',
    'CURVE_OFFSET_TOO_LOW',
    'FLOW_TRACKING_PROBLEM',
    'ROOM_IMBALANCE',
    'SENSOR_PROBLEM',
    'ADDITIONAL_HEAT_INFLUENCE',
    'INSUFFICIENT_DATA',
    'INCONCLUSIVE'
]);

const RECOMMENDATION_CHANGE_PARAMETERS = new Set([
    'heatingCurve',
    'heatingCurveOffset'
]);

function recommendationIsObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function recommendationIsFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function recommendationIsNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function recommendationAddError(errors, code) {
    if (!errors.includes(code)) errors.push(code);
}

function validateRecommendationPayload(payload) {
    const errors = [];

    if (payload.schema !== RECOMMENDATION_SCHEMA) {
        recommendationAddError(errors, 'INVALID_SCHEMA');
    }

    if (payload.schemaVersion !== RECOMMENDATION_SCHEMA_VERSION) {
        recommendationAddError(errors, 'INVALID_SCHEMA_VERSION');
    }

    const analysisReference = payload.analysisReference;
    if (!recommendationIsObject(analysisReference)) {
        recommendationAddError(errors, 'ANALYSIS_REFERENCE_MISSING');
    } else {
        if (!recommendationIsNonEmptyString(analysisReference.analysisGeneratedAt)) {
            recommendationAddError(errors, 'ANALYSIS_GENERATED_AT_MISSING');
        } else if (!Number.isFinite(Date.parse(analysisReference.analysisGeneratedAt))) {
            recommendationAddError(errors, 'ANALYSIS_GENERATED_AT_INVALID');
        }

        if (analysisReference.analysisSchemaVersion !== RECOMMENDATION_ANALYSIS_SCHEMA_VERSION) {
            recommendationAddError(errors, 'ANALYSIS_SCHEMA_VERSION_INVALID');
        }

        if (!recommendationIsNonEmptyString(analysisReference.configurationSignature)) {
            recommendationAddError(errors, 'CONFIGURATION_SIGNATURE_MISSING');
        }
    }

    if (typeof payload.analysisValid !== 'boolean') {
        recommendationAddError(errors, 'ANALYSIS_VALID_INVALID');
    }

    if (!recommendationIsFiniteNumber(payload.confidence)) {
        recommendationAddError(errors, 'CONFIDENCE_INVALID');
    } else if (payload.confidence < 0 || payload.confidence > 1) {
        recommendationAddError(errors, 'CONFIDENCE_OUT_OF_RANGE');
    }

    const assessment = payload.assessment;
    if (!recommendationIsObject(assessment)) {
        recommendationAddError(errors, 'ASSESSMENT_MISSING');
    } else {
        if (!RECOMMENDATION_OVERALL_STATES.has(assessment.overallState)) {
            recommendationAddError(errors, 'OVERALL_STATE_INVALID');
        }
        if (!RECOMMENDATION_PRIMARY_FINDINGS.has(assessment.primaryFinding)) {
            recommendationAddError(errors, 'PRIMARY_FINDING_INVALID');
        }
    }

    const recommendation = payload.recommendation;
    if (!recommendationIsObject(recommendation)) {
        recommendationAddError(errors, 'RECOMMENDATION_MISSING');
    } else {
        if (!RECOMMENDATION_ACTIONS.has(recommendation.action)) {
            recommendationAddError(errors, 'ACTION_INVALID');
        }

        if (recommendation.action === 'CHANGE_PARAMETER') {
            if (!RECOMMENDATION_CHANGE_PARAMETERS.has(recommendation.parameter)) {
                recommendationAddError(errors, 'PARAMETER_INVALID');
            }

            if (!recommendationIsFiniteNumber(recommendation.currentValue)) {
                recommendationAddError(errors, 'CURRENT_VALUE_INVALID');
            }
            if (!recommendationIsFiniteNumber(recommendation.recommendedValue)) {
                recommendationAddError(errors, 'RECOMMENDED_VALUE_INVALID');
            }
            if (!recommendationIsFiniteNumber(recommendation.change)) {
                recommendationAddError(errors, 'CHANGE_INVALID');
            }

            if (
                recommendationIsFiniteNumber(recommendation.currentValue) &&
                recommendationIsFiniteNumber(recommendation.recommendedValue) &&
                recommendationIsFiniteNumber(recommendation.change)
            ) {
                const expectedChange =
                    recommendation.recommendedValue - recommendation.currentValue;

                if (Math.abs(expectedChange - recommendation.change) > 0.000001) {
                    recommendationAddError(errors, 'CHANGE_INCONSISTENT');
                }

                if (recommendation.change === 0) {
                    recommendationAddError(errors, 'CHANGE_ZERO');
                }

                // Für beide aktuell freigegebenen Parameter gilt pro
                // Optimierungszyklus maximal ein Schritt bzw. 1 K.
                if (Math.abs(recommendation.change) > 1) {
                    recommendationAddError(errors, 'CHANGE_LIMIT_EXCEEDED');
                }
            }

            if (
                recommendationIsFiniteNumber(payload.confidence) &&
                payload.confidence < RECOMMENDATION_MIN_CHANGE_CONFIDENCE
            ) {
                recommendationAddError(errors, 'CONFIDENCE_TOO_LOW_FOR_CHANGE');
            }

            const observationHours =
                recommendationIsObject(payload.observation)
                    ? payload.observation.recommendedObservationHours
                    : undefined;

            if (!recommendationIsFiniteNumber(observationHours)) {
                recommendationAddError(errors, 'OBSERVATION_HOURS_INVALID');
            } else if (observationHours !== RECOMMENDATION_STANDARD_OBSERVATION_HOURS) {
                recommendationAddError(errors, 'OBSERVATION_HOURS_NOT_STANDARD');
            }
        }
    }

    if (
        payload.secondaryRecommendation !== null &&
        payload.secondaryRecommendation !== undefined &&
        !recommendationIsObject(payload.secondaryRecommendation)
    ) {
        recommendationAddError(errors, 'SECONDARY_RECOMMENDATION_INVALID');
    }

    if (!Array.isArray(payload.reasonCodes)) {
        recommendationAddError(errors, 'REASON_CODES_INVALID');
    } else if (payload.reasonCodes.some(code => typeof code !== 'string')) {
        recommendationAddError(errors, 'REASON_CODE_INVALID');
    }

    if (typeof payload.explanation !== 'string') {
        recommendationAddError(errors, 'EXPLANATION_INVALID');
    }

    if (!recommendationIsObject(payload.observation)) {
        recommendationAddError(errors, 'OBSERVATION_MISSING');
    } else if (
        !recommendationIsFiniteNumber(payload.observation.recommendedObservationHours) ||
        payload.observation.recommendedObservationHours <= 0
    ) {
        recommendationAddError(errors, 'OBSERVATION_HOURS_INVALID');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function readRecommendationEvidenceState() {
    const raw = getState(`${ROOT}.Analysis.EvidenceJson`)?.val;

    if (!raw) return null;

    try {
        const parsed = JSON.parse(String(raw));
        return recommendationIsObject(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function recommendationCurrentParameterValue(parameter) {
    if (parameter === 'heatingCurve') {
        const value = getState(`${ROOT}.Configuration.HeatingCurve`)?.val;
        return recommendationIsFiniteNumber(Number(value))
            ? Number(value)
            : null;
    }

    if (parameter === 'heatingCurveOffset') {
        const value = getState(`${ROOT}.Configuration.HeatingCurveOffset`)?.val;
        return recommendationIsFiniteNumber(Number(value))
            ? Number(value)
            : null;
    }

    return null;
}

function evaluateRecommendationChangeAllowed(
    payload,
    validation,
    context = null
) {
    const blockers = [];

    if (!validation?.valid) {
        recommendationAddError(blockers, 'RECOMMENDATION_INVALID');
    }

    const recommendation =
        recommendationIsObject(payload?.recommendation)
            ? payload.recommendation
            : {};

    const assessment =
        recommendationIsObject(payload?.assessment)
            ? payload.assessment
            : {};

    if (recommendation.action !== 'CHANGE_PARAMETER') {
        recommendationAddError(blockers, 'ACTION_NOT_CHANGE_PARAMETER');
    }

    if (payload?.analysisValid !== true) {
        recommendationAddError(blockers, 'ANALYSIS_NOT_VALID');
    }

    const aiReady = context
        ? context.aiReady === true
        : getState(`${ROOT}.AI.Ready`)?.val === true;

    if (!aiReady) {
        recommendationAddError(blockers, 'AI_NOT_READY');
    }

    const evidence = context
        ? context.evidence ?? null
        : readRecommendationEvidenceState();

    if (!evidence) {
        recommendationAddError(blockers, 'EVIDENCE_UNAVAILABLE');
    } else {
        if (evidence.insufficientData === true) {
            recommendationAddError(blockers, 'INSUFFICIENT_DATA');
        }

        if (evidence.sensorMismatch?.value === true) {
            recommendationAddError(blockers, 'SENSOR_MISMATCH');
        }

        if (evidence.flowTrackingProblem?.value === true) {
            recommendationAddError(blockers, 'FLOW_TRACKING_PROBLEM');
        }

        if (evidence.additionalHeatInfluence === true) {
            recommendationAddError(blockers, 'ADDITIONAL_HEAT_INFLUENCE');
        }

        // Eine Steilheitskorrektur benötigt Daten aus mindestens zwei
        // belastbaren Außentemperaturbereichen. Drei oder mehr sind
        // wünschenswert, zwei sind der definierte Mindestwert.
        if (
            recommendation.action === 'CHANGE_PARAMETER' &&
            recommendation.parameter === 'heatingCurve' &&
            (
                assessment.primaryFinding === 'HEATING_CURVE_TOO_STEEP' ||
                assessment.primaryFinding === 'HEATING_CURVE_TOO_FLAT'
            )
        ) {
            const validBinCount =
                evidence.outdoorDependentDeviation?.validBinCount;

            if (
                !recommendationIsFiniteNumber(validBinCount) ||
                validBinCount < 2
            ) {
                recommendationAddError(
                    blockers,
                    'INSUFFICIENT_OUTDOOR_BINS_FOR_SLOPE_CHANGE'
                );
            }
        }
    }

    // Findings, die zunächst Untersuchung statt Parameteränderung verlangen.
    if (
        recommendation.action === 'CHANGE_PARAMETER' &&
        [
            'FLOW_TRACKING_PROBLEM',
            'ROOM_IMBALANCE',
            'SENSOR_PROBLEM',
            'ADDITIONAL_HEAT_INFLUENCE',
            'INSUFFICIENT_DATA',
            'INCONCLUSIVE'
        ].includes(assessment.primaryFinding)
    ) {
        recommendationAddError(blockers, 'FINDING_REQUIRES_INVESTIGATION');
    }

    const recommendationSignature =
        payload?.analysisReference?.configurationSignature;

    const currentSignature = context
        ? context.currentSignature
        : getState(`${ROOT}.Configuration.ConfigurationSignature`)?.val;

    if (
        !recommendationIsNonEmptyString(recommendationSignature) ||
        !recommendationIsNonEmptyString(currentSignature) ||
        recommendationSignature !== currentSignature
    ) {
        recommendationAddError(blockers, 'CONFIGURATION_SIGNATURE_MISMATCH');
    }

    if (recommendation.action === 'CHANGE_PARAMETER') {
        const currentParameterValue = context
            ? context.currentParameterValue
            : recommendationCurrentParameterValue(recommendation.parameter);

        if (currentParameterValue === null) {
            recommendationAddError(blockers, 'CURRENT_PARAMETER_UNAVAILABLE');
        } else if (
            !recommendationIsFiniteNumber(recommendation.currentValue) ||
            Math.abs(
                currentParameterValue - recommendation.currentValue
            ) > 0.000001
        ) {
            recommendationAddError(blockers, 'CURRENT_VALUE_MISMATCH');
        }
    }

    return {
        allowed: blockers.length === 0,
        blockers
    };
}

async function applyRecommendationChangeAllowed(
    payload,
    validation,
    options = {}
) {
    const decision =
        evaluateRecommendationChangeAllowed(payload, validation);

    await setStateAsync(
        `${ROOT}.AI.Recommendation.ChangeAllowed`,
        decision.allowed,
        true
    );

    // T9.8: Nur eine tatsächlich freigegebene Empfehlung darf als
    // Kandidat für eine spätere manuelle Änderung vorgemerkt werden.
    if (decision.allowed) {
        await capturePendingOptimizationRecord(payload);
    }

    if (options.logDecision === true) {
        log(
            `${LOG_PREFIX} Recommendation-ChangeAllowed: ` +
            `${decision.allowed ? 'ALLOWED' : 'BLOCKED'} | ` +
            `Blocker=${decision.blockers.length}` +
            `${decision.blockers.length > 0 ? ` | ${decision.blockers.join(',')}` : ''}`,
            decision.allowed ? 'info' : 'info'
        );
    }

    return decision;
}

async function refreshRecommendationChangeAllowed(options = {}) {
    const raw =
        getState(`${ROOT}.AI.Recommendation.InputPayload`)?.val;

    const text = String(raw ?? '').trim();

    if (text === '' || text === '{}') {
        await setStateAsync(
            `${ROOT}.AI.Recommendation.ChangeAllowed`,
            false,
            true
        );
        return {
            allowed: false,
            blockers: ['NO_RECOMMENDATION']
        };
    }

    let payload;

    try {
        payload = JSON.parse(text);
    } catch (_) {
        await setStateAsync(
            `${ROOT}.AI.Recommendation.ChangeAllowed`,
            false,
            true
        );
        return {
            allowed: false,
            blockers: ['INVALID_JSON']
        };
    }

    if (!recommendationIsObject(payload)) {
        await setStateAsync(
            `${ROOT}.AI.Recommendation.ChangeAllowed`,
            false,
            true
        );
        return {
            allowed: false,
            blockers: ['PAYLOAD_NOT_OBJECT']
        };
    }

    const validation = validateRecommendationPayload(payload);

    return await applyRecommendationChangeAllowed(
        payload,
        validation,
        options
    );
}

async function writeRecommendationFields(values) {
    for (const [relativeId, value] of Object.entries(values)) {
        await setStateAsync(
            `${ROOT}.AI.Recommendation.${relativeId}`,
            value,
            true
        );
    }
}

async function resetRecommendationParsedFields(
    validationState,
    errors = []
) {
    await writeRecommendationFields({
        'Schema': '',
        'SchemaVersion': '',
        'AnalysisGeneratedAt': '',
        'AnalysisSchemaVersion': '',
        'ConfigurationSignature': '',
        'AnalysisValid': false,
        'ConfidencePercent': 0,
        'OverallState': '',
        'PrimaryFinding': '',
        'Action': '',
        'Parameter': '',
        'CurrentValue': 0,
        'RecommendedValue': 0,
        'Change': 0,
        'SecondaryRecommendationJson': 'null',
        'ReasonCodesJson': '[]',
        'Explanation': '',
        'ObservationHours': 0,
        'Valid': false,
        'ValidationState': validationState,
        'ValidationErrorsJson': JSON.stringify(errors),
        'ChangeAllowed': false
    });
}

async function parseRecommendationPayload(raw, options = {}) {
    const receivedAt = isoNow();
    const text = String(raw ?? '').trim();

    // T9.8 FIX1: Leerer/default Recommendation-Slot ist ein normaler Zustand,
    // keine fehlerhafte KI-Antwort. Dadurch wird '{}' weder beim Start noch bei
    // einem bewussten Zurücksetzen als INVALID validiert.
    if (text === '' || text === '{}') {
        await resetRecommendationParsedFields(
            'NOT_VALIDATED',
            []
        );

        // Bei einem bewussten Laufzeit-Reset gehört kein alter Empfangszeitpunkt
        // mehr zur Recommendation. Beim Start wird nur ein ggf. veralteter
        // Validierungszustand bereinigt.
        if (options.startup !== true) {
            await setStateAsync(
                `${ROOT}.AI.Recommendation.ReceivedAt`,
                '',
                true
            );

            log(
                `${LOG_PREFIX} Recommendation-Parser: leer | Recommendation zurückgesetzt`,
                'info'
            );
        }

        return {
            parsed: false,
            skipped: true,
            reason: 'EMPTY_INPUT'
        };
    }

    await setStateAsync(
        `${ROOT}.AI.Recommendation.ReceivedAt`,
        receivedAt,
        true
    );

    let payload;

    try {
        payload = JSON.parse(text);
    } catch (_) {
        await resetRecommendationParsedFields(
            'PARSE_ERROR',
            ['INVALID_JSON']
        );

        log(
            `${LOG_PREFIX} Recommendation-Parser: ungültiges JSON`,
            'warn'
        );

        return {
            parsed: false,
            skipped: false,
            reason: 'INVALID_JSON'
        };
    }

    if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload)
    ) {
        await resetRecommendationParsedFields(
            'PARSE_ERROR',
            ['PAYLOAD_NOT_OBJECT']
        );

        log(
            `${LOG_PREFIX} Recommendation-Parser: JSON-Wurzel ist kein Objekt`,
            'warn'
        );

        return {
            parsed: false,
            skipped: false,
            reason: 'PAYLOAD_NOT_OBJECT'
        };
    }

    const analysisReference =
        payload.analysisReference &&
        typeof payload.analysisReference === 'object' &&
        !Array.isArray(payload.analysisReference)
            ? payload.analysisReference
            : {};

    const assessment =
        payload.assessment &&
        typeof payload.assessment === 'object' &&
        !Array.isArray(payload.assessment)
            ? payload.assessment
            : {};

    const recommendation =
        payload.recommendation &&
        typeof payload.recommendation === 'object' &&
        !Array.isArray(payload.recommendation)
            ? payload.recommendation
            : {};

    const observation =
        payload.observation &&
        typeof payload.observation === 'object' &&
        !Array.isArray(payload.observation)
            ? payload.observation
            : {};

    await writeRecommendationFields({
        'Schema': recommendationString(payload.schema),
        'SchemaVersion': recommendationString(payload.schemaVersion),
        'AnalysisGeneratedAt': recommendationString(
            analysisReference.analysisGeneratedAt
        ),
        'AnalysisSchemaVersion': recommendationString(
            analysisReference.analysisSchemaVersion
        ),
        'ConfigurationSignature': recommendationString(
            analysisReference.configurationSignature
        ),
        'AnalysisValid': recommendationBoolean(payload.analysisValid),
        'ConfidencePercent': recommendationConfidencePercent(
            payload.confidence
        ),
        'OverallState': recommendationString(assessment.overallState),
        'PrimaryFinding': recommendationString(assessment.primaryFinding),
        'Action': recommendationString(recommendation.action),
        'Parameter': recommendationString(recommendation.parameter),
        'CurrentValue': recommendationNumber(recommendation.currentValue),
        'RecommendedValue': recommendationNumber(
            recommendation.recommendedValue
        ),
        'Change': recommendationNumber(recommendation.change),
        'SecondaryRecommendationJson': recommendationJson(
            payload.secondaryRecommendation,
            'null'
        ),
        'ReasonCodesJson': recommendationJson(
            payload.reasonCodes,
            '[]'
        ),
        'Explanation': recommendationString(payload.explanation),
        'ObservationHours': recommendationNumber(
            observation.recommendedObservationHours
        ),

        // T9.6 setzt Valid/ValidationState nach fachlicher Prüfung.
        // T9.7 entscheidet ausschließlich über ChangeAllowed.
        'Valid': false,
        'ValidationState': 'PARSED_NOT_VALIDATED',
        'ValidationErrorsJson': '[]',
        'ChangeAllowed': false
    });

    log(
        `${LOG_PREFIX} Recommendation-Parser: JSON eingelesen | ` +
        `Schema=${recommendationString(payload.schema) || '-'} | ` +
        `Version=${recommendationString(payload.schemaVersion) || '-'} | ` +
        `Action=${recommendationString(recommendation.action) || '-'}`,
        'info'
    );

    const validation = validateRecommendationPayload(payload);

    await writeRecommendationFields({
        'Valid': validation.valid,
        'ValidationState': validation.valid ? 'VALID' : 'INVALID',
        'ValidationErrorsJson': JSON.stringify(validation.errors),

        // Vor der T9.7-Sicherheitsentscheidung immer fail-safe zurücksetzen.
        'ChangeAllowed': false
    });

    log(
        `${LOG_PREFIX} Recommendation-Validator: ` +
        `${validation.valid ? 'VALID' : 'INVALID'} | ` +
        `Fehler=${validation.errors.length}` +
        `${validation.errors.length > 0 ? ` | ${validation.errors.join(',')}` : ''}`,
        validation.valid ? 'info' : 'warn'
    );

    const changeDecision =
        await applyRecommendationChangeAllowed(
            payload,
            validation,
            { logDecision: true }
        );

    return {
        parsed: true,
        skipped: false,
        reason: null,
        valid: validation.valid,
        validationErrors: validation.errors,
        changeAllowed: changeDecision.allowed,
        changeBlockers: changeDecision.blockers
    };
}

async function parseExistingRecommendationPayload() {
    const raw =
        getState(`${ROOT}.AI.Recommendation.InputPayload`)?.val;

    if (raw === null || raw === undefined) return;

    await parseRecommendationPayload(raw, {
        startup: true
    });
}

function installRecommendationParser() {
    recommendationSubscription = on(
        {
            id: `${ROOT}.AI.Recommendation.InputPayload`,
            change: 'ne'
        },
        obj => {
            parseRecommendationPayload(obj?.state?.val, {
                startup: false
            }).catch(err => {
                recordError(
                    'RECOMMENDATION_PARSE_FAILED',
                    err
                );
            });
        }
    );

    return !!recommendationSubscription;
}

// ============================================================
// Beta.1 - Ringbuffer / Persistenz
// ============================================================
let sampleBuffer = [];
let sampleRunning = false;
let schedulerHandle = null;
let lastSourceCheck = null;
let forceInfluxSampleWrites = false;

function normalizeSampleTimestamp(ts = Date.now()) {
    return Math.floor(ts / SAMPLE_INTERVAL_MS) * SAMPLE_INTERVAL_MS;
}

function trimBuffer(buffer, now = Date.now()) {
    const cutoff = now - MAX_BUFFER_AGE_MS;

    const byTimestamp = new Map();

    for (const sample of buffer) {
        if (!sample || !Number.isFinite(sample.ts)) continue;
        if (sample.ts < cutoff) continue;

        // letzter Datensatz mit identischem Timestamp gewinnt
        byTimestamp.set(sample.ts, sample);
    }

    return [...byTimestamp.values()]
        .sort((a, b) => a.ts - b.ts);
}

function validateLoadedSample(sample) {
    return !!(
        sample &&
        Number.isFinite(sample.ts) &&
        typeof sample.configSignature === 'string' &&
        typeof sample.valid === 'boolean' &&
        sample.nibe &&
        typeof sample.nibe === 'object' &&
        sample.rooms &&
        typeof sample.rooms === 'object'
    );
}

function loadBuffer() {
    const storedVersion =
        getState(`${ROOT}.Internal.BufferVersion`)?.val;

    if (
        storedVersion &&
        String(storedVersion) !== BUFFER_VERSION
    ) {
        log(
            `${LOG_PREFIX} BufferVersion ${storedVersion} inkompatibel zu ${BUFFER_VERSION} | starte mit leerem Buffer`,
            'warn'
        );
        return [];
    }

    const raw =
        getState(`${ROOT}.Internal.SampleBufferJson`)?.val;

    if (!raw || raw === '[]') return [];

    try {
        const parsed = JSON.parse(String(raw));

        if (!Array.isArray(parsed)) {
            throw new Error('BUFFER_NOT_ARRAY');
        }

        const valid = parsed.filter(validateLoadedSample);
        const dropped = parsed.length - valid.length;

        if (dropped > 0) {
            log(
                `${LOG_PREFIX} Buffer: ${dropped} ungültige Samples verworfen`,
                'warn'
            );
        }

        return trimBuffer(valid);

    } catch (err) {
        log(
            `${LOG_PREFIX} Buffer konnte nicht geladen werden | ${err.message || err}`,
            'error'
        );
        return [];
    }
}

async function persistBuffer() {
    sampleBuffer = trimBuffer(sampleBuffer);

    await setStateAsync(
        `${ROOT}.Internal.SampleBufferJson`,
        JSON.stringify(sampleBuffer),
        true
    );

    await setStateAsync(
        `${ROOT}.Internal.SampleCount`,
        sampleBuffer.length,
        true
    );

    await setStateAsync(
        `${ROOT}.Internal.BufferVersion`,
        BUFFER_VERSION,
        true
    );

    const lastTs =
        sampleBuffer.length
            ? sampleBuffer[sampleBuffer.length - 1].ts
            : null;

    await setStateAsync(
        `${ROOT}.Internal.LastSampleTimestamp`,
        lastTs ? new Date(lastTs).toISOString() : '',
        true
    );
}

function buildBufferSample(
    ts,
    signature,
    nibe,
    roomEvaluation,
    sampleEvaluation
) {
    const validRooms =
        roomEvaluation.details
            .filter(room => room.validForHeatingCurve)
            .map(room => room.id);

    const deviations = {};

    for (const room of roomEvaluation.details) {
        if (
            room.validForHeatingCurve &&
            isFiniteNumber(room.deviation)
        ) {
            deviations[room.id] = room.deviation;
        }
    }

    return {
        ts,
        configSignature: signature,
        valid: sampleEvaluation.valid,
        quality: sampleEvaluation.quality,

        nibe: {
            outdoor: nibe.outdoorTemperature,
            outdoorBT28: nibe.outdoorTemperatureBT28,
            outdoorSensorDifference: nibe.outdoorSensorDifference,
            flowTarget: nibe.flowTarget,
            flowActual: nibe.flowActual,
            returnTemp: nibe.returnTemperature,
            supplyDeviation: nibe.supplyDeviation,
            deltaT: nibe.deltaT,
            degreeMinutes: nibe.degreeMinutes,
            compressorFrequency: nibe.compressorFrequency,
            compressorActive: nibe.compressorActive,
            volumeFlow: nibe.volumeFlow,
            defrostActive: nibe.defrostActive,
            additionalHeatActive: nibe.additionalHeatActive
        },

        rooms: {
            activeCount: roomEvaluation.summary.activeCount,
            validCount: roomEvaluation.summary.validForHeatingCurveCount,
            tooColdCount: roomEvaluation.summary.tooColdCount,
            okCount: roomEvaluation.summary.okCount,
            tooWarmCount: roomEvaluation.summary.tooWarmCount,
            averageDeviation: roomEvaluation.summary.averageDeviation,
            medianDeviation: roomEvaluation.summary.medianDeviation,
            minDeviation: roomEvaluation.summary.minimumDeviation,
            maxDeviation: roomEvaluation.summary.maximumDeviation,
            stdDev: roomEvaluation.summary.deviationStdDev,
            range: roomEvaluation.summary.deviationRange,
            deviations,
            validRooms
        },

        excludeReasons: sampleEvaluation.reasons
    };
}

function addSampleToBuffer(sample) {
    if (
        sampleBuffer.some(existing => existing.ts === sample.ts)
    ) {
        return false;
    }

    sampleBuffer.push(sample);
    sampleBuffer = trimBuffer(sampleBuffer);
    return true;
}

// ============================================================
// Beta.1 - Aggregationsfunktionen
// ============================================================
function getWindowSamples(nowTs, hours, signature) {
    const start = nowTs - hours * 60 * 60 * 1000;

    return sampleBuffer.filter(sample =>
        sample.ts >= start &&
        sample.ts <= nowTs &&
        sample.configSignature === signature
    );
}

function aggregateWindow(windowId, nowTs, signature) {
    const allSamples =
        getWindowSamples(
            nowTs,
            WINDOW_HOURS[windowId],
            signature
        );

    const validSamples =
        allSamples.filter(sample => sample.valid === true);

    const validSampleCount = validSamples.length;
    const validHeatingHours =
        validSampleCount * SAMPLE_INTERVAL_MINUTES / 60;

    const roomObservationCount =
        validSamples.reduce(
            (sum, sample) => sum + (sample.rooms.validCount || 0),
            0
        );

    const totalTooCold =
        validSamples.reduce(
            (sum, sample) => sum + (sample.rooms.tooColdCount || 0),
            0
        );

    const totalOK =
        validSamples.reduce(
            (sum, sample) => sum + (sample.rooms.okCount || 0),
            0
        );

    const totalTooWarm =
        validSamples.reduce(
            (sum, sample) => sum + (sample.rooms.tooWarmCount || 0),
            0
        );

    const compressorSamples =
        allSamples.filter(sample => sample.nibe.compressorActive === true).length;

    const additionalHeatSamples =
        allSamples.filter(sample => sample.nibe.additionalHeatActive === true).length;

    const expectedSamples =
        Math.max(
            1,
            Math.round(WINDOW_HOURS[windowId] * 60 / SAMPLE_INTERVAL_MINUTES)
        );

    const coveragePercent =
        Math.min(100, allSamples.length / expectedSamples * 100);

    const avgRoomCoverage =
        average(
            allSamples.map(sample =>
                sample.rooms.activeCount > 0
                    ? sample.rooms.validCount / sample.rooms.activeCount * 100
                    : 0
            )
        ) ?? 0;

    // T5: technische Fensterqualität, noch nicht T6-DataQuality
    const heatingBasisPercent =
        Math.min(
            100,
            validHeatingHours /
            MIN_VALID_HEATING_HOURS[windowId] *
            100
        );

    const dataQualityPercent =
        Math.max(
            0,
            Math.min(
                100,
                coveragePercent * 0.50 +
                heatingBasisPercent * 0.30 +
                avgRoomCoverage * 0.20
            )
        );

    const result = {
        valid:
            validHeatingHours >=
            MIN_VALID_HEATING_HOURS[windowId],

        validSampleCount,
        validHeatingHours,

        avgOutdoorTemperature:
            average(validSamples.map(s => s.nibe.outdoor)),
        minOutdoorTemperature:
            minimum(validSamples.map(s => s.nibe.outdoor)),
        maxOutdoorTemperature:
            maximum(validSamples.map(s => s.nibe.outdoor)),

        avgFlowTarget:
            average(validSamples.map(s => s.nibe.flowTarget)),
        avgFlowActual:
            average(validSamples.map(s => s.nibe.flowActual)),
        avgFlowDeviation:
            average(validSamples.map(s => s.nibe.supplyDeviation)),
        avgReturnTemperature:
            average(validSamples.map(s => s.nibe.returnTemp)),
        avgDeltaT:
            average(validSamples.map(s => s.nibe.deltaT)),

        avgDegreeMinutes:
            average(validSamples.map(s => s.nibe.degreeMinutes)),
        minDegreeMinutes:
            minimum(validSamples.map(s => s.nibe.degreeMinutes)),
        maxDegreeMinutes:
            maximum(validSamples.map(s => s.nibe.degreeMinutes)),

        avgCompressorFrequency:
            average(validSamples.map(s => s.nibe.compressorFrequency)),

        compressorRuntimePercent:
            allSamples.length
                ? compressorSamples / allSamples.length * 100
                : 0,

        additionalHeatRuntimePercent:
            allSamples.length
                ? additionalHeatSamples / allSamples.length * 100
                : 0,

        avgRoomDeviation:
            average(validSamples.map(s => s.rooms.averageDeviation)),
        medianRoomDeviation:
            median(validSamples.map(s => s.rooms.medianDeviation)),
        minRoomDeviation:
            minimum(validSamples.map(s => s.rooms.minDeviation)),
        maxRoomDeviation:
            maximum(validSamples.map(s => s.rooms.maxDeviation)),
        deviationStdDev:
            average(validSamples.map(s => s.rooms.stdDev)),
        deviationRange:
            average(validSamples.map(s => s.rooms.range)),

        tooColdRatio:
            roomObservationCount
                ? totalTooCold / roomObservationCount * 100
                : 0,

        okRatio:
            roomObservationCount
                ? totalOK / roomObservationCount * 100
                : 0,

        tooWarmRatio:
            roomObservationCount
                ? totalTooWarm / roomObservationCount * 100
                : 0,

        dataQualityPercent,
        allSampleCount: allSamples.length,
        coveragePercent,
        roomCoveragePercent: avgRoomCoverage
    };

    return result;
}

function buildRoomHistory(nowTs, signature, hours = 72) {
    const samples =
        getWindowSamples(nowTs, hours, signature);

    const histories = {};

    for (const room of ROOMS) {
        histories[room.id] = {
            id: room.id,
            name: room.name,
            deviations: []
        };
    }

    for (const sample of samples) {
        if (!sample.rooms || !Array.isArray(sample.rooms.validRooms)) {
            continue;
        }

        for (const roomId of sample.rooms.validRooms) {
            const deviation = sample.rooms.deviations?.[roomId];

            if (
                histories[roomId] &&
                isFiniteNumber(deviation)
            ) {
                histories[roomId].deviations.push(deviation);
            }
        }
    }

    const result = [];

    for (const history of Object.values(histories)) {
        const values = history.deviations;
        const sampleCount = values.length;

        if (!sampleCount) continue;

        const tooColdCount =
            values.filter(v => v < -COMFORT_BAND_K).length;

        const okCount =
            values.filter(v =>
                v >= -COMFORT_BAND_K &&
                v <= COMFORT_BAND_K
            ).length;

        const tooWarmCount =
            values.filter(v => v > COMFORT_BAND_K).length;

        result.push({
            id: history.id,
            name: history.name,
            sampleCount,
            validHours:
                sampleCount * SAMPLE_INTERVAL_MINUTES / 60,

            averageDeviation: average(values),
            medianDeviation: median(values),
            minDeviation: minimum(values),
            maxDeviation: maximum(values),

            tooColdRatio:
                sampleCount ? tooColdCount / sampleCount * 100 : 0,

            okRatio:
                sampleCount ? okCount / sampleCount * 100 : 0,

            tooWarmRatio:
                sampleCount ? tooWarmCount / sampleCount * 100 : 0
        });
    }

    return result;
}

function buildPersistentRoomLists(nowTs, signature) {
    const histories =
        buildRoomHistory(nowTs, signature, 72);

    const cold = histories.filter(room =>
        room.validHours >= MIN_ROOM_ANALYSIS_HOURS &&
        isFiniteNumber(room.averageDeviation) &&
        room.averageDeviation < -COMFORT_BAND_K &&
        room.tooColdRatio >= PERSISTENT_ROOM_RATIO
    );

    const warm = histories.filter(room =>
        room.validHours >= MIN_ROOM_ANALYSIS_HOURS &&
        isFiniteNumber(room.averageDeviation) &&
        room.averageDeviation > COMFORT_BAND_K &&
        room.tooWarmRatio >= PERSISTENT_ROOM_RATIO
    );

    return {cold, warm};
}

function getOutdoorBin(temp) {
    if (!isFiniteNumber(temp)) return null;
    if (temp > 10) return 'GT_10';
    if (temp > 5) return '5_TO_10';
    if (temp > 0) return '0_TO_5';
    if (temp > -5) return 'MINUS5_TO_0';
    return 'LT_MINUS5';
}

function buildOutdoorBins(nowTs, signature) {
    const samples =
        getWindowSamples(nowTs, 168, signature)
            .filter(sample => sample.valid === true);

    const bins = {
        GT_10: [],
        '5_TO_10': [],
        '0_TO_5': [],
        MINUS5_TO_0: [],
        LT_MINUS5: []
    };

    for (const sample of samples) {
        const bin = getOutdoorBin(sample.nibe.outdoor);
        if (bin) bins[bin].push(sample);
    }

    const result = {};

    for (const [name, items] of Object.entries(bins)) {
        const sampleCount = items.length;
        const validHeatingHours =
            sampleCount * SAMPLE_INTERVAL_MINUTES / 60;

        // T9.2: Komfortanteile basieren auf allen gültigen
        // Raumbeobachtungen der gültigen Heizsamples dieses Bins.
        const roomObservationCount =
            items.reduce(
                (sum, sample) =>
                    sum + (sample.rooms.validCount || 0),
                0
            );

        const totalTooCold =
            items.reduce(
                (sum, sample) =>
                    sum + (sample.rooms.tooColdCount || 0),
                0
            );

        const totalOK =
            items.reduce(
                (sum, sample) =>
                    sum + (sample.rooms.okCount || 0),
                0
            );

        const totalTooWarm =
            items.reduce(
                (sum, sample) =>
                    sum + (sample.rooms.tooWarmCount || 0),
                0
            );

        result[name] = {
            valid: validHeatingHours >= MIN_BIN_VALID_HOURS,
            sampleCount,
            validHeatingHours,

            averageOutdoorTemperature:
                average(items.map(s => s.nibe.outdoor)),

            averageRoomDeviation:
                average(items.map(s => s.rooms.averageDeviation)),

            medianRoomDeviation:
                median(items.map(s => s.rooms.medianDeviation)),

            averageFlowTarget:
                average(items.map(s => s.nibe.flowTarget)),

            averageFlowActual:
                average(items.map(s => s.nibe.flowActual)),

            averageFlowDeviation:
                average(items.map(s => s.nibe.supplyDeviation)),

            averageDegreeMinutes:
                average(items.map(s => s.nibe.degreeMinutes)),

            tooColdRatio:
                roomObservationCount
                    ? totalTooCold / roomObservationCount * 100
                    : 0,

            okRatio:
                roomObservationCount
                    ? totalOK / roomObservationCount * 100
                    : 0,

            tooWarmRatio:
                roomObservationCount
                    ? totalTooWarm / roomObservationCount * 100
                    : 0
        };
    }

    return {
        version: '1.0',
        generatedAt: isoNow(),
        bins: result
    };
}

async function writeAnalysisWindow(windowId, result) {
    const values = {
        [`Analysis.${windowId}.ValidSampleCount`]:
            result.validSampleCount,

        [`Analysis.${windowId}.ValidHeatingHours`]:
            result.validHeatingHours,

        [`Analysis.${windowId}.AvgOutdoorTemperature`]:
            result.avgOutdoorTemperature,

        [`Analysis.${windowId}.MinOutdoorTemperature`]:
            result.minOutdoorTemperature,

        [`Analysis.${windowId}.MaxOutdoorTemperature`]:
            result.maxOutdoorTemperature,

        [`Analysis.${windowId}.AvgFlowTarget`]:
            result.avgFlowTarget,

        [`Analysis.${windowId}.AvgFlowActual`]:
            result.avgFlowActual,

        [`Analysis.${windowId}.AvgFlowDeviation`]:
            result.avgFlowDeviation,

        [`Analysis.${windowId}.AvgReturnTemperature`]:
            result.avgReturnTemperature,

        [`Analysis.${windowId}.AvgDeltaT`]:
            result.avgDeltaT,

        [`Analysis.${windowId}.AvgDegreeMinutes`]:
            result.avgDegreeMinutes,

        [`Analysis.${windowId}.MinDegreeMinutes`]:
            result.minDegreeMinutes,

        [`Analysis.${windowId}.MaxDegreeMinutes`]:
            result.maxDegreeMinutes,

        [`Analysis.${windowId}.AvgCompressorFrequency`]:
            result.avgCompressorFrequency,

        [`Analysis.${windowId}.CompressorRuntimePercent`]:
            result.compressorRuntimePercent,

        [`Analysis.${windowId}.AdditionalHeatRuntimePercent`]:
            result.additionalHeatRuntimePercent,

        [`Analysis.${windowId}.AvgRoomDeviation`]:
            result.avgRoomDeviation,

        [`Analysis.${windowId}.MedianRoomDeviation`]:
            result.medianRoomDeviation,

        [`Analysis.${windowId}.MinRoomDeviation`]:
            result.minRoomDeviation,

        [`Analysis.${windowId}.MaxRoomDeviation`]:
            result.maxRoomDeviation,

        [`Analysis.${windowId}.DeviationStdDev`]:
            result.deviationStdDev,

        [`Analysis.${windowId}.DeviationRange`]:
            result.deviationRange,

        [`Analysis.${windowId}.TooColdRatio`]:
            result.tooColdRatio,

        [`Analysis.${windowId}.OKRatio`]:
            result.okRatio,

        [`Analysis.${windowId}.TooWarmRatio`]:
            result.tooWarmRatio,

        [`Analysis.${windowId}.DataQualityPercent`]:
            result.dataQualityPercent,

        [`Analysis.${windowId}.Valid`]:
            result.valid,

        [`Analysis.${windowId}.Json`]:
            JSON.stringify(result)
    };

    for (const [id, value] of Object.entries(values)) {
        await writeState(id, value);
    }
}

async function calculateAndWriteAllAggregations(
    nowTs,
    signature
) {
    const windowResults = {};

    for (const windowId of Object.keys(WINDOW_HOURS)) {
        const result =
            aggregateWindow(windowId, nowTs, signature);

        windowResults[windowId] = result;
        await writeAnalysisWindow(windowId, result);
    }

    const outdoorBins =
        buildOutdoorBins(nowTs, signature);

    const persistentRooms =
        buildPersistentRoomLists(nowTs, signature);

    const currentConfigSamples =
        sampleBuffer.filter(
            sample =>
                sample.configSignature === signature
        );

    const currentConfigValidSamples =
        currentConfigSamples.filter(
            sample => sample.valid === true
        );

    await writeState(
        'Analysis.OutdoorBinsJson',
        JSON.stringify(outdoorBins)
    );

    await writeState(
        'Analysis.PersistentColdRoomsJson',
        JSON.stringify(persistentRooms.cold)
    );

    await writeState(
        'Analysis.PersistentWarmRoomsJson',
        JSON.stringify(persistentRooms.warm)
    );

    await writeState(
        'Analysis.CurrentConfigurationSampleCount',
        currentConfigSamples.length
    );

    await writeState(
        'Analysis.CurrentConfigurationValidHeatingHours',
        currentConfigValidSamples.length *
        SAMPLE_INTERVAL_MINUTES / 60
    );

    return {
        windows: windowResults,
        outdoorBins,
        persistentRooms
    };
}


// ============================================================
// Beta.2 - T6 Evidence / Datenqualität
// ============================================================
function clampPercent(value) {
    if (!isFiniteNumber(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

function confidenceFromData({
    signalPercent = 0,
    hoursPercent = 0,
    dataQualityPercent = 0
}) {
    return clampPercent(
        signalPercent * 0.60 +
        hoursPercent * 0.25 +
        dataQualityPercent * 0.15
    );
}

function calculateSourceQuality(sourceCheck) {
    if (
        !sourceCheck ||
        !sourceCheck.required ||
        !isFiniteNumber(sourceCheck.required.total) ||
        sourceCheck.required.total <= 0
    ) {
        return 0;
    }

    return clampPercent(
        sourceCheck.required.ok /
        sourceCheck.required.total *
        100
    );
}

function getCurrentConfigurationSamples(signature) {
    return sampleBuffer.filter(
        sample => sample.configSignature === signature
    );
}

function calculateTimeCoverageQuality(validHeatingHours) {
    if (!isFiniteNumber(validHeatingHours)) return 0;
    if (validHeatingHours >= 12) return 100;
    if (validHeatingHours >= 8) return 80;
    if (validHeatingHours >= 4) return 50;
    return 20;
}

function calculateGlobalDataQuality(signature, sourceCheck) {
    const samples =
        getCurrentConfigurationSamples(signature);

    const validSamples =
        samples.filter(sample => sample.valid === true);

    const validHeatingHours =
        validSamples.length *
        SAMPLE_INTERVAL_MINUTES / 60;

    const sourceQualityPercent =
        calculateSourceQuality(sourceCheck);

    const heatingSampleQualityPercent =
        samples.length
            ? (average(samples.map(s => s.quality)) ?? 0)
            : 0;

    const roomCoverageQualityPercent =
        samples.length
            ? (
                average(
                    samples.map(sample =>
                        sample.rooms.activeCount > 0
                            ? sample.rooms.validCount /
                              sample.rooms.activeCount *
                              100
                            : 0
                    )
                ) ?? 0
            )
            : 0;

    const timeCoverageQualityPercent =
        calculateTimeCoverageQuality(
            validHeatingHours
        );

    let percent =
        sourceQualityPercent * 0.25 +
        heatingSampleQualityPercent * 0.30 +
        roomCoverageQualityPercent * 0.30 +
        timeCoverageQualityPercent * 0.15;

    percent = clampPercent(percent);

    const requiredMissing =
        sourceCheck?.required?.missing || [];

    let state =
        percent >= 90 ? 'EXCELLENT' :
        percent >= 75 ? 'GOOD' :
        percent >= 50 ? 'LIMITED' :
        'INSUFFICIENT';

    // T6: fehlende REQUIRED Source begrenzt auf INSUFFICIENT.
    if (requiredMissing.length > 0) {
        state = 'INSUFFICIENT';
    }

    return {
        percent,
        state,
        sourceQualityPercent,
        heatingSampleQualityPercent,
        roomCoverageQualityPercent,
        timeCoverageQualityPercent,
        currentConfigurationSampleCount:
            samples.length,
        currentConfigurationValidHeatingHours:
            validHeatingHours,
        requiredSourcesMissing:
            requiredMissing.map(item => item.name),
        optionalSourcesMissing:
            (sourceCheck?.optional?.missing || [])
                .map(item => item.name)
    };
}

function calculateSensorMismatch(
    nowTs,
    signature
) {
    const samples =
        getWindowSamples(nowTs, 24, signature);

    const differences =
        samples
            .map(sample =>
                sample.nibe.outdoorSensorDifference
            )
            .filter(isFiniteNumber)
            .map(value => Math.abs(value));

    const avgAbsDifference =
        average(differences);

    return {
        value:
            isFiniteNumber(avgAbsDifference) &&
            avgAbsDifference >=
            EVIDENCE_LIMITS.SENSOR_MISMATCH_K,

        averageAbsoluteDifferenceK:
            avgAbsDifference
    };
}

function calculateOutdoorDependence(outdoorBins) {
    const validBins =
        Object.entries(outdoorBins?.bins || {})
            .filter(([, bin]) =>
                bin &&
                bin.valid === true &&
                isFiniteNumber(
                    bin.averageOutdoorTemperature
                ) &&
                isFiniteNumber(
                    bin.medianRoomDeviation
                )
            )
            .map(([name, bin]) => ({
                name,
                ...bin
            }))
            .sort(
                (a, b) =>
                    b.averageOutdoorTemperature -
                    a.averageOutdoorTemperature
            );

    if (validBins.length < 2) {
        return {
            value: false,
            confidence: 0,
            direction: 'INSUFFICIENT_BINS',
            deltaMedianRoomDeviationK: null,
            validBinCount: validBins.length
        };
    }

    const warmest = validBins[0];
    const coldest =
        validBins[validBins.length - 1];

    const delta =
        coldest.medianRoomDeviation -
        warmest.medianRoomDeviation;

    const value =
        Math.abs(delta) >=
        EVIDENCE_LIMITS.OUTDOOR_DEPENDENCE_K;

    let direction = 'NONE';

    if (value) {
        direction =
            delta < 0
                ? 'COLDER_OUTSIDE_MORE_NEGATIVE'
                : 'COLDER_OUTSIDE_MORE_POSITIVE';
    }

    const signalPercent =
        clampPercent(
            Math.abs(delta) /
            EVIDENCE_LIMITS.OUTDOOR_DEPENDENCE_K *
            70
        );

    const hours =
        validBins.reduce(
            (sum, bin) =>
                sum + (bin.validHeatingHours || 0),
            0
        );

    return {
        value,
        confidence: confidenceFromData({
            signalPercent,
            hoursPercent:
                clampPercent(hours / 12 * 100),
            dataQualityPercent: 100
        }),
        direction,
        deltaMedianRoomDeviationK: delta,
        validBinCount: validBins.length,
        warmestBin: warmest.name,
        coldestBin: coldest.name
    };
}

function calculateEvidence(
    nowTs,
    signature,
    aggregations,
    dataQuality
) {
    const w24 =
        aggregations.windows.Window24h;

    const w72 =
        aggregations.windows.Window72h;

    const coldPersistent =
        aggregations.persistentRooms.cold || [];

    const warmPersistent =
        aggregations.persistentRooms.warm || [];

    // --------------------------------------------------------
    // GlobalTooCold
    // --------------------------------------------------------
    const globalTooColdValue =
        w72.valid === true &&
        w72.tooColdRatio >=
            EVIDENCE_LIMITS.GLOBAL_RATIO_PERCENT &&
        isFiniteNumber(w72.medianRoomDeviation) &&
        w72.medianRoomDeviation <=
            -EVIDENCE_LIMITS.GLOBAL_MEDIAN_K;

    const coldSignal =
        Math.max(
            clampPercent(
                w72.tooColdRatio /
                EVIDENCE_LIMITS.GLOBAL_RATIO_PERCENT *
                60
            ),
            clampPercent(
                Math.abs(
                    Math.min(
                        0,
                        w72.medianRoomDeviation || 0
                    )
                ) /
                EVIDENCE_LIMITS.GLOBAL_MEDIAN_K *
                60
            )
        );

    const globalTooColdConfidence =
        confidenceFromData({
            signalPercent: coldSignal,
            hoursPercent:
                clampPercent(
                    w72.validHeatingHours / 12 * 100
                ),
            dataQualityPercent:
                dataQuality.percent
        });

    // --------------------------------------------------------
    // GlobalTooWarm
    // --------------------------------------------------------
    const globalTooWarmValue =
        w72.valid === true &&
        w72.tooWarmRatio >=
            EVIDENCE_LIMITS.GLOBAL_RATIO_PERCENT &&
        isFiniteNumber(w72.medianRoomDeviation) &&
        w72.medianRoomDeviation >=
            EVIDENCE_LIMITS.GLOBAL_MEDIAN_K;

    const warmSignal =
        Math.max(
            clampPercent(
                w72.tooWarmRatio /
                EVIDENCE_LIMITS.GLOBAL_RATIO_PERCENT *
                60
            ),
            clampPercent(
                Math.max(
                    0,
                    w72.medianRoomDeviation || 0
                ) /
                EVIDENCE_LIMITS.GLOBAL_MEDIAN_K *
                60
            )
        );

    const globalTooWarmConfidence =
        confidenceFromData({
            signalPercent: warmSignal,
            hoursPercent:
                clampPercent(
                    w72.validHeatingHours / 12 * 100
                ),
            dataQualityPercent:
                dataQuality.percent
        });

    // --------------------------------------------------------
    // RoomImbalance
    // --------------------------------------------------------
    const imbalanceBySpread =
        w72.valid === true &&
        (
            (
                isFiniteNumber(
                    w72.deviationStdDev
                ) &&
                w72.deviationStdDev >=
                    EVIDENCE_LIMITS.ROOM_STDDEV_K
            ) ||
            (
                isFiniteNumber(
                    w72.deviationRange
                ) &&
                w72.deviationRange >=
                    EVIDENCE_LIMITS.ROOM_RANGE_K
            )
        );

    const imbalanceByPersistentRooms =
        coldPersistent.length > 0 &&
        warmPersistent.length > 0;

    const roomImbalanceValue =
        imbalanceBySpread ||
        imbalanceByPersistentRooms;

    const imbalanceSignal =
        Math.max(
            isFiniteNumber(w72.deviationStdDev)
                ? clampPercent(
                    w72.deviationStdDev /
                    EVIDENCE_LIMITS.ROOM_STDDEV_K *
                    60
                  )
                : 0,

            isFiniteNumber(w72.deviationRange)
                ? clampPercent(
                    w72.deviationRange /
                    EVIDENCE_LIMITS.ROOM_RANGE_K *
                    60
                  )
                : 0,

            imbalanceByPersistentRooms ? 100 : 0
        );

    const roomImbalanceConfidence =
        confidenceFromData({
            signalPercent: imbalanceSignal,
            hoursPercent:
                clampPercent(
                    w72.validHeatingHours / 12 * 100
                ),
            dataQualityPercent:
                dataQuality.percent
        });

    // --------------------------------------------------------
    // FlowTrackingProblem
    // --------------------------------------------------------
    let flowDirection = 'OK';

    if (
        isFiniteNumber(
            w24.avgFlowDeviation
        )
    ) {
        if (
            w24.avgFlowDeviation <=
            -EVIDENCE_LIMITS.FLOW_TRACKING_K
        ) {
            flowDirection = 'LOW';
        } else if (
            w24.avgFlowDeviation >=
            EVIDENCE_LIMITS.FLOW_TRACKING_K
        ) {
            flowDirection = 'HIGH';
        }
    }

    const flowTrackingValue =
        w24.valid === true &&
        flowDirection !== 'OK';

    const flowTrackingConfidence =
        confidenceFromData({
            signalPercent:
                isFiniteNumber(
                    w24.avgFlowDeviation
                )
                    ? clampPercent(
                        Math.abs(
                            w24.avgFlowDeviation
                        ) /
                        EVIDENCE_LIMITS.FLOW_TRACKING_K *
                        70
                      )
                    : 0,

            hoursPercent:
                clampPercent(
                    w24.validHeatingHours / 8 * 100
                ),

            dataQualityPercent:
                dataQuality.percent
        });

    // --------------------------------------------------------
    // OutdoorDependentDeviation
    // --------------------------------------------------------
    const outdoorDependent =
        calculateOutdoorDependence(
            aggregations.outdoorBins
        );

    // --------------------------------------------------------
    // AdditionalHeatInfluence
    // --------------------------------------------------------
    const additionalHeatInfluence =
        w72.valid === true &&
        w72.additionalHeatRuntimePercent >=
        EVIDENCE_LIMITS
            .ADDITIONAL_HEAT_RUNTIME_PERCENT;

    // --------------------------------------------------------
    // SensorMismatch
    // --------------------------------------------------------
    const sensorMismatch =
        calculateSensorMismatch(
            nowTs,
            signature
        );

    // --------------------------------------------------------
    // InsufficientData
    // --------------------------------------------------------
    const insufficientData =
        w72.valid !== true ||
        dataQuality.percent <
            EVIDENCE_LIMITS
                .MIN_DATA_QUALITY_PERCENT ||
        dataQuality
            .currentConfigurationValidHeatingHours < 8;

    // --------------------------------------------------------
    // AI.Ready
    // --------------------------------------------------------
    const aiReady =
        !insufficientData &&
        w72.valid === true &&
        dataQuality.percent >=
            EVIDENCE_LIMITS
                .AI_READY_DATA_QUALITY_PERCENT;

    return {
        version: '1.0',
        generatedAt: isoNow(),

        globalTooCold: {
            value: globalTooColdValue,
            confidence:
                globalTooColdConfidence
        },

        globalTooWarm: {
            value: globalTooWarmValue,
            confidence:
                globalTooWarmConfidence
        },

        outdoorDependentDeviation: {
            value:
                outdoorDependent.value,
            confidence:
                outdoorDependent.confidence,
            direction:
                outdoorDependent.direction,
            deltaMedianRoomDeviationK:
                outdoorDependent
                    .deltaMedianRoomDeviationK,
            validBinCount:
                outdoorDependent.validBinCount,
            warmestBin:
                outdoorDependent.warmestBin || null,
            coldestBin:
                outdoorDependent.coldestBin || null
        },

        roomImbalance: {
            value: roomImbalanceValue,
            confidence:
                roomImbalanceConfidence
        },

        flowTrackingProblem: {
            value: flowTrackingValue,
            confidence:
                flowTrackingConfidence,
            direction: flowDirection,
            averageDeviationK:
                w24.avgFlowDeviation
        },

        additionalHeatInfluence,

        sensorMismatch: {
            value:
                sensorMismatch.value,
            averageAbsoluteDifferenceK:
                sensorMismatch
                    .averageAbsoluteDifferenceK
        },

        insufficientData,

        aiReady
    };
}

async function calculateAndWriteEvidence(
    nowTs,
    signature,
    aggregations
) {
    const dataQuality =
        calculateGlobalDataQuality(
            signature,
            lastSourceCheck
        );

    const evidence =
        calculateEvidence(
            nowTs,
            signature,
            aggregations,
            dataQuality
        );

    await writeState(
        'Status.DataQualityPercent',
        dataQuality.percent
    );

    await writeState(
        'Status.DataQualityState',
        dataQuality.state
    );

    await writeState(
        'Analysis.EvidenceJson',
        JSON.stringify({
            ...evidence,
            dataQuality
        })
    );

    await writeState(
        'AI.Ready',
        evidence.aiReady
    );

    return {
        dataQuality,
        evidence
    };
}



// ============================================================
// RC.1 - T7 AI.AnalysisPayload
// ============================================================
function roundNumber(value, digits = 1) {
    if (!isFiniteNumber(value)) return null;

    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
}

function integerOrNull(value) {
    if (!isFiniteNumber(value)) return null;
    return Math.round(value);
}

function utf8ByteLength(value) {
    return unescape(encodeURIComponent(value)).length;
}

function normalizeRoomForPayload(room) {
    return {
        id: room.id,
        name: room.name,

        actualTemperatureC:
            roundNumber(room.actualTemperature, 1),

        temperatureSource:
            room.temperatureSource,

        scheduleTargetC:
            roundNumber(room.scheduleTarget, 1),

        effectiveTargetC:
            roundNumber(room.effectiveTarget, 1),

        deviationK:
            roundNumber(room.deviation, 1),

        comfortState:
            room.comfortState,

        windowOpen:
            room.windowOpen,

        roomState:
            room.roomState,

        roomActive:
            room.roomActive,

        dataValid:
            room.dataValid,

        validForHeatingCurve:
            room.validForHeatingCurve,

        excludeReasons:
            Array.isArray(room.excludeReasons)
                ? room.excludeReasons
                : [],

        thermostats:
            Array.isArray(room.thermostats)
                ? room.thermostats.map(t => ({
                    id: t.id,
                    name: t.name,
                    temperatureC:
                        roundNumber(t.temperature, 1),
                    setpointC:
                        roundNumber(t.setpoint, 1)
                }))
                : []
    };
}

function normalizeWindowForPayload(result) {
    return {
        valid: result.valid === true,

        validSampleCount:
            integerOrNull(
                result.validSampleCount
            ),

        validHeatingHours:
            roundNumber(
                result.validHeatingHours,
                1
            ),

        outdoor: {
            averageC:
                roundNumber(
                    result.avgOutdoorTemperature,
                    1
                ),
            minC:
                roundNumber(
                    result.minOutdoorTemperature,
                    1
                ),
            maxC:
                roundNumber(
                    result.maxOutdoorTemperature,
                    1
                )
        },

        flow: {
            targetAverageC:
                roundNumber(
                    result.avgFlowTarget,
                    1
                ),

            actualAverageC:
                roundNumber(
                    result.avgFlowActual,
                    1
                ),

            deviationAverageK:
                roundNumber(
                    result.avgFlowDeviation,
                    1
                ),

            returnAverageC:
                roundNumber(
                    result.avgReturnTemperature,
                    1
                ),

            deltaTAverageK:
                roundNumber(
                    result.avgDeltaT,
                    1
                )
        },

        degreeMinutes: {
            average:
                integerOrNull(
                    result.avgDegreeMinutes
                ),

            min:
                integerOrNull(
                    result.minDegreeMinutes
                ),

            max:
                integerOrNull(
                    result.maxDegreeMinutes
                )
        },

        compressor: {
            frequencyAverageHz:
                roundNumber(
                    result.avgCompressorFrequency,
                    1
                ),

            runtimePercent:
                roundNumber(
                    result.compressorRuntimePercent,
                    1
                )
        },

        additionalHeat: {
            runtimePercent:
                roundNumber(
                    result.additionalHeatRuntimePercent,
                    1
                )
        },

        rooms: {
            averageDeviationK:
                roundNumber(
                    result.avgRoomDeviation,
                    1
                ),

            medianDeviationK:
                roundNumber(
                    result.medianRoomDeviation,
                    1
                ),

            minDeviationK:
                roundNumber(
                    result.minRoomDeviation,
                    1
                ),

            maxDeviationK:
                roundNumber(
                    result.maxRoomDeviation,
                    1
                ),

            stdDevK:
                roundNumber(
                    result.deviationStdDev,
                    1
                ),

            rangeK:
                roundNumber(
                    result.deviationRange,
                    1
                ),

            tooColdRatioPercent:
                roundNumber(
                    result.tooColdRatio,
                    1
                ),

            okRatioPercent:
                roundNumber(
                    result.okRatio,
                    1
                ),

            tooWarmRatioPercent:
                roundNumber(
                    result.tooWarmRatio,
                    1
                )
        },

        dataQualityPercent:
            roundNumber(
                result.dataQualityPercent,
                1
            )
    };
}

function normalizeOutdoorBinsForPayload(outdoorBins) {
    const result = {};

    for (
        const [name, bin]
        of Object.entries(
            outdoorBins?.bins || {}
        )
    ) {
        result[name] = {
            valid:
                bin.valid === true,

            sampleCount:
                integerOrNull(
                    bin.sampleCount
                ),

            validHeatingHours:
                roundNumber(
                    bin.validHeatingHours,
                    1
                ),

            averageOutdoorTemperatureC:
                roundNumber(
                    bin.averageOutdoorTemperature,
                    1
                ),

            averageRoomDeviationK:
                roundNumber(
                    bin.averageRoomDeviation,
                    1
                ),

            medianRoomDeviationK:
                roundNumber(
                    bin.medianRoomDeviation,
                    1
                ),

            averageFlowTargetC:
                roundNumber(
                    bin.averageFlowTarget,
                    1
                ),

            averageFlowActualC:
                roundNumber(
                    bin.averageFlowActual,
                    1
                ),

            averageFlowDeviationK:
                roundNumber(
                    bin.averageFlowDeviation,
                    1
                ),

            averageDegreeMinutes:
                integerOrNull(
                    bin.averageDegreeMinutes
                ),

            tooColdRatioPercent:
                roundNumber(
                    bin.tooColdRatio,
                    1
                ),

            okRatioPercent:
                roundNumber(
                    bin.okRatio,
                    1
                ),

            tooWarmRatioPercent:
                roundNumber(
                    bin.tooWarmRatio,
                    1
                )
        };
    }

    return result;
}

function normalizePersistentRooms(list) {
    if (!Array.isArray(list)) return [];

    return list.map(room => ({
        room: room.name || room.id,
        id: room.id,

        validHours:
            roundNumber(
                room.validHours,
                1
            ),

        averageDeviationK:
            roundNumber(
                room.averageDeviation,
                1
            ),

        medianDeviationK:
            roundNumber(
                room.medianDeviation,
                1
            ),

        tooColdRatioPercent:
            roundNumber(
                room.tooColdRatio,
                1
            ),

        okRatioPercent:
            roundNumber(
                room.okRatio,
                1
            ),

        tooWarmRatioPercent:
            roundNumber(
                room.tooWarmRatio,
                1
            )
    }));
}

function readPreviousOptimizationForPayload() {
    const raw =
        getState(
            `${ROOT}.AI.Optimization.LastRecord`
        )?.val;

    if (
        raw === null ||
        raw === undefined ||
        raw === '' ||
        raw === 'null' ||
        raw === '{}'
    ) {
        return null;
    }

    try {
        const parsed = JSON.parse(String(raw));

        if (
            !parsed ||
            Array.isArray(parsed) ||
            typeof parsed !== 'object'
        ) {
            return null;
        }

        // T9.3 übernimmt nur Records des bereits festgelegten
        // OptimizationRecord-Schema. Erzeugung erfolgt in T9.8, Bewertung folgt in T9.9.
        if (
            parsed.schema !== 'NPS-AI-OptimizationRecord' ||
            parsed.schemaVersion !== '1.0'
        ) {
            return null;
        }

        return parsed;

    } catch (_) {
        return null;
    }
}

function buildAiAnalysisPayload({
    timestamp,
    config,
    signature,
    nibe,
    roomEvaluation,
    aggregations,
    evidenceResult
}) {
    const dataQuality =
        evidenceResult.dataQuality;

    const evidence =
        evidenceResult.evidence;

    const payload = {
        schema:
            PAYLOAD_SCHEMA,

        schemaVersion:
            PAYLOAD_VERSION,

        analyzerVersion:
            VERSION,

        generatedAt:
            isoNow(),

        analysisPeriodHours:
            PRIMARY_ANALYSIS_PERIOD_HOURS,

        ready:
            evidence.aiReady === true,

        system: {
            module:
                'HeatingCurveAnalyzer',

            sampleIntervalMinutes:
                SAMPLE_INTERVAL_MINUTES,

            comfortBandK:
                COMFORT_BAND_K,

            currentConfigurationSince:
                getState(
                    `${ROOT}.Configuration.ChangedAt`
                )?.val || null,

            currentConfigurationValidHeatingHours:
                roundNumber(
                    dataQuality
                        .currentConfigurationValidHeatingHours,
                    1
                ),

            currentConfigurationSampleCount:
                integerOrNull(
                    dataQuality
                        .currentConfigurationSampleCount
                ),

            plant: {
                ...PLANT_INFO
            }
        },

        configuration: {
            heatingCurve:
                config.heatingCurve,

            heatingCurveOffset:
                config.heatingCurveOffset,

            flowMinC:
                roundNumber(
                    config.flowMin,
                    1
                ),

            flowMaxC:
                roundNumber(
                    config.flowMax,
                    1
                ),

            customCurve: {
                p1: roundNumber(config.customCurveP1, 1),
                p2: roundNumber(config.customCurveP2, 1),
                p3: roundNumber(config.customCurveP3, 1),
                p4: roundNumber(config.customCurveP4, 1),
                p5: roundNumber(config.customCurveP5, 1),
                p6: roundNumber(config.customCurveP6, 1),
                p7: roundNumber(config.customCurveP7, 1)
            },

            pointAdjustment: {
                outdoorTemperatureC:
                    roundNumber(
                        config.pointOutdoorTemperature,
                        1
                    ),

                offsetC:
                    roundNumber(
                        config.pointOffset,
                        1
                    )
            },

            heatingStartUndertempC:
                roundNumber(
                    config.heatingStartUndertemp,
                    1
                ),

            heatingStopTemperatureC:
                roundNumber(
                    config.heatingStopTemperature,
                    1
                ),

            additionalHeatStopTemperatureC:
                roundNumber(
                    config.additionalHeatStopTemperature,
                    1
                ),

            autoFilterHours:
                roundNumber(
                    config.autoFilterTime,
                    1
                ),

            maxFlowDifferenceCompressorK:
                roundNumber(
                    config.maxFlowDifferenceCompressor,
                    1
                ),

            operatingMode:
                config.operatingMode,

            heatingAutomatic:
                config.heatingAutomatic,

            signature
        },

        current: {
            timestamp:
                new Date(timestamp)
                    .toISOString(),

            outdoorTemperatureC:
                roundNumber(
                    nibe.outdoorTemperature,
                    1
                ),

            outdoorTemperatureBT28C:
                roundNumber(
                    nibe.outdoorTemperatureBT28,
                    1
                ),

            outdoorSensorDifferenceK:
                roundNumber(
                    nibe.outdoorSensorDifference,
                    1
                ),

            flowTargetC:
                roundNumber(
                    nibe.flowTarget,
                    1
                ),

            flowActualC:
                roundNumber(
                    nibe.flowActual,
                    1
                ),

            returnTemperatureC:
                roundNumber(
                    nibe.returnTemperature,
                    1
                ),

            supplyDeviationK:
                roundNumber(
                    nibe.supplyDeviation,
                    1
                ),

            deltaTK:
                roundNumber(
                    nibe.deltaT,
                    1
                ),

            degreeMinutes:
                integerOrNull(
                    nibe.degreeMinutes
                ),

            compressorFrequencyHz:
                roundNumber(
                    nibe.compressorFrequency,
                    1
                ),

            compressorActive:
                nibe.compressorActive,

            volumeFlowLMin:
                roundNumber(
                    nibe.volumeFlow,
                    1
                ),

            operatingPriority:
                nibe.operatingPriority,

            defrostActive:
                nibe.defrostActive,

            additionalHeatActive:
                nibe.additionalHeatActive,

            additionalHeatPowerKW:
                roundNumber(
                    nibe.additionalHeatPower,
                    2
                ),

            heatPowerKW:
                roundNumber(
                    nibe.heatPower,
                    2
                ),

            electricalPowerW:
                integerOrNull(
                    nibe.electricalPower
                ),

            sampleValid:
                getState(
                    `${ROOT}.Current.SampleValid`
                )?.val === true,

            sampleQualityPercent:
                roundNumber(
                    getState(
                        `${ROOT}.Current.SampleQuality`
                    )?.val,
                    1
                ),

            excludeReasons:
                (() => {
                    try {
                        return JSON.parse(
                            String(
                                getState(
                                    `${ROOT}.Current.ExcludeReasonsJson`
                                )?.val || '[]'
                            )
                        );
                    } catch (_) {
                        return [];
                    }
                })()
        },

        rooms: {
            summary: {
                total:
                    roomEvaluation.summary.count,

                active:
                    roomEvaluation.summary.activeCount,

                dataValid:
                    roomEvaluation.summary.dataValidCount,

                validForHeatingCurve:
                    roomEvaluation.summary
                        .validForHeatingCurveCount,

                tooCold:
                    roomEvaluation.summary.tooColdCount,

                ok:
                    roomEvaluation.summary.okCount,

                tooWarm:
                    roomEvaluation.summary.tooWarmCount,

                averageDeviationK:
                    roundNumber(
                        roomEvaluation.summary
                            .averageDeviation,
                        1
                    ),

                medianDeviationK:
                    roundNumber(
                        roomEvaluation.summary
                            .medianDeviation,
                        1
                    ),

                minDeviationK:
                    roundNumber(
                        roomEvaluation.summary
                            .minimumDeviation,
                        1
                    ),

                maxDeviationK:
                    roundNumber(
                        roomEvaluation.summary
                            .maximumDeviation,
                        1
                    ),

                stdDevK:
                    roundNumber(
                        roomEvaluation.summary
                            .deviationStdDev,
                        1
                    ),

                rangeK:
                    roundNumber(
                        roomEvaluation.summary
                            .deviationRange,
                        1
                    ),

                coldestRoom:
                    roomEvaluation.summary
                        .coldestRoom || null,

                coldestRoomDeviationK:
                    roundNumber(
                        roomEvaluation.summary
                            .coldestRoomDeviation,
                        1
                    ),

                warmestRoom:
                    roomEvaluation.summary
                        .warmestRoom || null,

                warmestRoomDeviationK:
                    roundNumber(
                        roomEvaluation.summary
                            .warmestRoomDeviation,
                        1
                    )
            },

            details:
                roomEvaluation.details
                    .map(normalizeRoomForPayload)
        },

        analysis: {
            '6h':
                normalizeWindowForPayload(
                    aggregations.windows.Window6h
                ),

            '24h':
                normalizeWindowForPayload(
                    aggregations.windows.Window24h
                ),

            '72h':
                normalizeWindowForPayload(
                    aggregations.windows.Window72h
                ),

            '7d':
                normalizeWindowForPayload(
                    aggregations.windows.Window7d
                )
        },

        outdoorBins:
            normalizeOutdoorBinsForPayload(
                aggregations.outdoorBins
            ),

        persistentRooms: {
            cold:
                normalizePersistentRooms(
                    aggregations
                        .persistentRooms
                        .cold
                ),

            warm:
                normalizePersistentRooms(
                    aggregations
                        .persistentRooms
                        .warm
                )
        },

        evidence: {
            globalTooCold: {
                value:
                    evidence
                        .globalTooCold
                        .value,

                confidencePercent:
                    roundNumber(
                        evidence
                            .globalTooCold
                            .confidence,
                        1
                    )
            },

            globalTooWarm: {
                value:
                    evidence
                        .globalTooWarm
                        .value,

                confidencePercent:
                    roundNumber(
                        evidence
                            .globalTooWarm
                            .confidence,
                        1
                    )
            },

            outdoorDependentDeviation: {
                value:
                    evidence
                        .outdoorDependentDeviation
                        .value,

                confidencePercent:
                    roundNumber(
                        evidence
                            .outdoorDependentDeviation
                            .confidence,
                        1
                    ),

                direction:
                    evidence
                        .outdoorDependentDeviation
                        .direction,

                deltaMedianRoomDeviationK:
                    roundNumber(
                        evidence
                            .outdoorDependentDeviation
                            .deltaMedianRoomDeviationK,
                        1
                    ),

                validBinCount:
                    integerOrNull(
                        evidence
                            .outdoorDependentDeviation
                            .validBinCount
                    )
            },

            roomImbalance: {
                value:
                    evidence
                        .roomImbalance
                        .value,

                confidencePercent:
                    roundNumber(
                        evidence
                            .roomImbalance
                            .confidence,
                        1
                    )
            },

            flowTrackingProblem: {
                value:
                    evidence
                        .flowTrackingProblem
                        .value,

                confidencePercent:
                    roundNumber(
                        evidence
                            .flowTrackingProblem
                            .confidence,
                        1
                    ),

                direction:
                    evidence
                        .flowTrackingProblem
                        .direction,

                averageDeviationK:
                    roundNumber(
                        evidence
                            .flowTrackingProblem
                            .averageDeviationK,
                        1
                    )
            },

            additionalHeatInfluence:
                evidence.additionalHeatInfluence,

            sensorMismatch: {
                value:
                    evidence
                        .sensorMismatch
                        .value,

                averageAbsoluteDifferenceK:
                    roundNumber(
                        evidence
                            .sensorMismatch
                            .averageAbsoluteDifferenceK,
                        1
                    )
            },

            insufficientData:
                evidence.insufficientData
        },

        dataQuality: {
            percent:
                roundNumber(
                    dataQuality.percent,
                    1
                ),

            state:
                dataQuality.state,

            sourceQualityPercent:
                roundNumber(
                    dataQuality.sourceQualityPercent,
                    1
                ),

            heatingSampleQualityPercent:
                roundNumber(
                    dataQuality
                        .heatingSampleQualityPercent,
                    1
                ),

            roomCoverageQualityPercent:
                roundNumber(
                    dataQuality
                        .roomCoverageQualityPercent,
                    1
                ),

            timeCoverageQualityPercent:
                roundNumber(
                    dataQuality
                        .timeCoverageQualityPercent,
                    1
                ),

            requiredSourcesMissing:
                dataQuality
                    .requiredSourcesMissing || [],

            optionalSourcesMissing:
                dataQuality
                    .optionalSourcesMissing || [],

            currentConfigurationValidHeatingHours:
                roundNumber(
                    dataQuality
                        .currentConfigurationValidHeatingHours,
                    1
                ),

            warnings: []
        },

        // T9.3: letzter gültiger OptimizationRecord; sonst null.
        previousOptimization:
            readPreviousOptimizationForPayload()
    };

    return payload;
}

function reducePayloadIfNecessary(payload) {
    let working = payload;
    let json = JSON.stringify(working);

    if (
        utf8ByteLength(json) <=
        MAX_AI_PAYLOAD_BYTES
    ) {
        return {
            payload: working,
            json,
            reduced: false
        };
    }

    // 1. Thermostatdetails entfernen.
    working = JSON.parse(json);

    for (const room of working.rooms.details) {
        delete room.thermostats;
    }

    json = JSON.stringify(working);

    if (
        utf8ByteLength(json) <=
        MAX_AI_PAYLOAD_BYTES
    ) {
        working.dataQuality.warnings.push(
            'PAYLOAD_REDUCED_THERMOSTATS'
        );

        json = JSON.stringify(working);

        return {
            payload: working,
            json,
            reduced: true
        };
    }

    // 2. Ungültige aktuelle Raumdetails entfernen.
    working.rooms.details =
        working.rooms.details.filter(
            room =>
                room.validForHeatingCurve === true ||
                room.dataValid === true
        );

    working.dataQuality.warnings.push(
        'PAYLOAD_REDUCED_INVALID_ROOMS'
    );

    json = JSON.stringify(working);

    if (
        utf8ByteLength(json) <=
        MAX_AI_PAYLOAD_BYTES
    ) {
        return {
            payload: working,
            json,
            reduced: true
        };
    }

    // 3. Ungültige OutdoorBins auf Minimalstruktur reduzieren.
    for (
        const [name, bin]
        of Object.entries(
            working.outdoorBins
        )
    ) {
        if (bin.valid !== true) {
            working.outdoorBins[name] = {
                valid: false,
                sampleCount:
                    bin.sampleCount,
                validHeatingHours:
                    bin.validHeatingHours
            };
        }
    }

    working.dataQuality.warnings.push(
        'PAYLOAD_REDUCED_INVALID_BINS'
    );

    json = JSON.stringify(working);

    if (
        utf8ByteLength(json) <=
        MAX_AI_PAYLOAD_BYTES
    ) {
        return {
            payload: working,
            json,
            reduced: true
        };
    }

    // Pflichtblöcke bleiben erhalten.
    // Sollte das Limit dennoch überschritten sein,
    // wird der Payload als Fehler markiert, aber nicht
    // zerstückelt oder in ungültiges JSON überführt.
    working.ready = false;

    working.dataQuality.warnings.push(
        'PAYLOAD_TOO_LARGE'
    );

    json = JSON.stringify(working);

    return {
        payload: working,
        json,
        reduced: true
    };
}

async function buildAndWriteAiPayload({
    timestamp,
    config,
    signature,
    nibe,
    roomEvaluation,
    aggregations,
    evidenceResult
}) {
    const payload =
        buildAiAnalysisPayload({
            timestamp,
            config,
            signature,
            nibe,
            roomEvaluation,
            aggregations,
            evidenceResult
        });

    const reduced =
        reducePayloadIfNecessary(
            payload
        );

    const byteLength =
        utf8ByteLength(
            reduced.json
        );

    if (
        byteLength >
        MAX_AI_PAYLOAD_BYTES
    ) {
        log(
            `${LOG_PREFIX} AI-Payload zu groß: ${byteLength} Bytes`,
            'error'
        );

        await writeState(
            'AI.Ready',
            false
        );
    }

    await writeState(
        'AI.AnalysisPayload',
        reduced.json
    );

    await writeState(
        'AI.PayloadVersion',
        PAYLOAD_VERSION
    );

    await writeState(
        'AI.GeneratedAt',
        reduced.payload.generatedAt
    );

    await writeState(
        'AI.Ready',
        reduced.payload.ready === true &&
        byteLength <=
            MAX_AI_PAYLOAD_BYTES
    );

    return {
        byteLength,
        reduced:
            reduced.reduced,
        ready:
            reduced.payload.ready === true &&
            byteLength <=
                MAX_AI_PAYLOAD_BYTES
    };
}


// ============================================================
// RC.1 - Snapshot / Scheduler
// ============================================================
async function performSnapshot({
    storeInBuffer,
    timestamp
}) {
    // T8.13: reguläre 5-Minuten-Samples schreiben alle
    // eingefrorenen INFLUX_STATES auch bei unverändertem Wert.
    forceInfluxSampleWrites = storeInBuffer === true;

    try {
    // v0.1.1 / T8:
    // SourceCheck wird für jeden Snapshot neu erzeugt. Damit arbeiten
    // DataQuality, Evidence und AI-Payload nicht mehr mit dem Startup-Zustand.
    const sourceCheck = runSourceCheck();
    lastSourceCheck = sourceCheck;

    await setStateAsync(
        `${ROOT}.Status.SourceCheckOk`,
        sourceCheck.ok,
        true
    );

    await setStateAsync(
        `${ROOT}.Status.SourceCheckJson`,
        JSON.stringify(sourceCheck),
        true
    );

    const config = readConfiguration();
    const signature =
        buildConfigurationSignature(config);

    await writeConfiguration(config, signature);
    await writeState(
        'Internal.LastConfigSignature',
        signature
    );

    const nibe = readNibeCurrent();
    const nibeValidation =
        validateNibeCurrent(nibe);

    const hcStatus =
        readHeatingControlStatus();

    const roomEvaluation =
        evaluateRooms(hcStatus);

    const sampleEvaluation =
        evaluateCurrentSample(
            nibe,
            nibeValidation,
            roomEvaluation,
            hcStatus
        );

    await writeCurrent(
        nibe,
        sampleEvaluation,
        storeInBuffer
    );

    await writeRooms(
        roomEvaluation,
        storeInBuffer
    );

    const isoTimestamp =
        new Date(timestamp).toISOString();

    await setStateAsync(
        `${ROOT}.Status.LastCalculation`,
        isoNow(),
        true
    );

    await setStateAsync(
        `${ROOT}.Status.LastSample`,
        isoTimestamp,
        true
    );

    if (storeInBuffer) {
        const sample =
            buildBufferSample(
                timestamp,
                signature,
                nibe,
                roomEvaluation,
                sampleEvaluation
            );

        const added =
            addSampleToBuffer(sample);

        if (added) {
            const aggregations =
                await calculateAndWriteAllAggregations(
                    timestamp,
                    signature
                );

            const evidenceResult =
                await calculateAndWriteEvidence(
                    timestamp,
                    signature,
                    aggregations
                );

            await buildAndWriteAiPayload({
                timestamp,
                config,
                signature,
                nibe,
                roomEvaluation,
                aggregations,
                evidenceResult
            });

            await persistBuffer();
        } else {
            debugLog(
                `Doppel-Sample übersprungen: ${isoTimestamp}`
            );
        }
    } else {
        // Startup: vorhandenen Buffer nur neu auswerten
        const aggregations =
            await calculateAndWriteAllAggregations(
                timestamp,
                signature
            );

        const evidenceResult =
            await calculateAndWriteEvidence(
                timestamp,
                signature,
                aggregations
            );

        await buildAndWriteAiPayload({
            timestamp,
            config,
            signature,
            nibe,
            roomEvaluation,
            aggregations,
            evidenceResult
        });
    }

        // T9.8: Falls seit einer freigegebenen Recommendation eine
        // manuelle Anlagenänderung erfolgt ist, wird sie jetzt dokumentiert.
        await finalizePendingOptimizationRecord({
            timestamp,
            config,
            signature
        });

        // T9.9: Nach Ablauf der Beobachtungsfrist wird der letzte
        // OptimizationRecord deterministisch Vorher/Nachher bewertet.
        await evaluateLastOptimizationRecord({
            timestamp,
            signature
        });

        // T9.7: ChangeAllowed hängt von aktuellen Evidence-/Ready-/
        // Konfigurationswerten ab und wird daher nach jedem Snapshot
        // erneut fail-safe bewertet, ohne ReceivedAt zu verändern.
        await refreshRecommendationChangeAllowed({
            logDecision: false
        });

        return {
            signature,
            nibe,
            roomEvaluation,
            sampleEvaluation,
            sourceCheck
        };
    } finally {
        forceInfluxSampleWrites = false;
    }
}

async function runScheduledSample() {
    if (sampleRunning) {
        log(
            `${LOG_PREFIX} Snapshot übersprungen: vorheriger Lauf noch aktiv`,
            'warn'
        );
        return;
    }

    sampleRunning = true;
    const started = Date.now();

    try {
        const timestamp =
            normalizeSampleTimestamp();

        const result =
            await performSnapshot({
                storeInBuffer: true,
                timestamp
            });

        await setStateAsync(
            `${ROOT}.Status.Valid`,
            result.sourceCheck.ok,
            true
        );

        debugLog(
            `5-Min-Sample ${new Date(timestamp).toISOString()} | ` +
            `valid=${result.sampleEvaluation.valid} | ` +
            `buffer=${sampleBuffer.length}`
        );

    } catch (err) {
        await recordError(
            'SCHEDULED_SAMPLE_FAILED',
            err
        );

    } finally {
        const duration =
            Date.now() - started;

        if (duration > SNAPSHOT_ERROR_MS) {
            log(
                `${LOG_PREFIX} Snapshot-Laufzeit ${duration} ms`,
                'error'
            );
        } else if (duration > SNAPSHOT_WARN_MS) {
            log(
                `${LOG_PREFIX} Snapshot-Laufzeit ${duration} ms`,
                'warn'
            );
        }

        sampleRunning = false;
    }
}

function installScheduler() {
    schedulerHandle =
        schedule(
            '*/5 * * * *',
            () => {
                runScheduledSample()
                    .catch(err => {
                        log(
                            `${LOG_PREFIX} Schedulerfehler | ${err.message || err}`,
                            'error'
                        );
                    });
            }
        );

    return !!schedulerHandle;
}

async function shutdown() {
    try {
        if (schedulerHandle) {
            clearSchedule(schedulerHandle);
            schedulerHandle = null;
        }

        await persistBuffer();

        await setStateAsync(
            `${ROOT}.Status.Active`,
            false,
            true
        );

    } catch (err) {
        log(
            `${LOG_PREFIX} Fehler beim Stoppen | ${err.message || err}`,
            'error'
        );
    }
}


// ============================================================
// Fehlerbehandlung
// ============================================================
let errorCount = 0;

async function recordError(code, err) {
    errorCount++;

    const message =
        `${isoNow()} | ${code} | ${err?.message || err}`;

    log(`${LOG_PREFIX} ${message}`, 'error');

    try {
        await setStateAsync(`${ROOT}.Status.ErrorCount`, errorCount, true);
        await setStateAsync(`${ROOT}.Status.LastError`, message, true);
    } catch (_) {
        // Log ist die letzte Rückfallebene.
    }
}

// ============================================================
// T9.10 - Interner Startup-Integritätstest
// ============================================================
function runT910IsolatedEndToEndSelfTest() {
    const signature = 'T9.10|curve=6|offset=0';
    const analysisGeneratedAt = '2026-01-15T08:00:00.000Z';
    const receivedAt = '2026-01-15T08:05:00.000Z';
    const appliedAt = '2026-01-15T08:10:00.000Z';

    const inputJson = JSON.stringify({
        schema: RECOMMENDATION_SCHEMA,
        schemaVersion: RECOMMENDATION_SCHEMA_VERSION,
        analysisReference: {
            analysisGeneratedAt,
            analysisSchemaVersion: RECOMMENDATION_ANALYSIS_SCHEMA_VERSION,
            configurationSignature: signature
        },
        analysisValid: true,
        confidence: 0.90,
        assessment: {
            overallState: 'OPTIMIZATION_RECOMMENDED',
            primaryFinding: 'HEATING_CURVE_TOO_HIGH'
        },
        recommendation: {
            action: 'CHANGE_PARAMETER',
            parameter: 'heatingCurve',
            currentValue: 6,
            recommendedValue: 5,
            change: -1
        },
        secondaryRecommendation: null,
        reasonCodes: ['T9_10_SYNTHETIC_TEST'],
        explanation: 'Isolierter T9.10-Selbsttest ohne Anlagenzugriff.',
        observation: {
            recommendedObservationHours: 72
        }
    });

    let payload;
    try {
        payload = JSON.parse(inputJson);
    } catch (_) {
        return { pass: false, stage: 'PARSER', detail: 'INVALID_JSON' };
    }

    if (!recommendationIsObject(payload)) {
        return { pass: false, stage: 'PARSER', detail: 'PAYLOAD_NOT_OBJECT' };
    }

    const validation = validateRecommendationPayload(payload);
    if (!validation.valid) {
        return {
            pass: false,
            stage: 'VALIDATOR',
            detail: validation.errors.join(',')
        };
    }

    const evidence = {
        insufficientData: false,
        sensorMismatch: { value: false },
        flowTrackingProblem: { value: false },
        additionalHeatInfluence: false,
        outdoorDependentDeviation: { validBinCount: 3 }
    };

    const decision = evaluateRecommendationChangeAllowed(
        payload,
        validation,
        {
            aiReady: true,
            evidence,
            currentSignature: signature,
            currentParameterValue: 6
        }
    );

    if (!decision.allowed || decision.blockers.length !== 0) {
        return {
            pass: false,
            stage: 'CHANGE_ALLOWED',
            detail: decision.blockers.join(',')
        };
    }

    const beforeSnapshot = {
        generatedAt: analysisGeneratedAt,
        ready: true,
        configurationSignature: signature,
        analysis72h: {
            valid: true,
            rooms: {
                medianDeviationK: 0.8,
                okRatioPercent: 55
            }
        },
        evidence,
        dataQuality: { percent: 90, state: 'GOOD' }
    };

    const pending = buildPendingOptimizationRecord(
        payload,
        {
            receivedAt,
            createdAt: receivedAt,
            beforeSnapshot
        }
    );

    if (
        pending.recordState !== 'PENDING_MANUAL_CHANGE' ||
        pending.change.beforeValue !== 6 ||
        pending.change.recommendedValue !== 5 ||
        pending.before !== beforeSnapshot
    ) {
        return { pass: false, stage: 'PENDING_RECORD', detail: 'RECORD_INVALID' };
    }

    const afterSignature = 'T9.10|curve=5|offset=0';
    const observing = buildObservingOptimizationRecord(
        pending,
        {
            appliedAt,
            currentValue: 5,
            signature: afterSignature
        }
    );

    if (
        observing.recordState !== 'OBSERVING' ||
        observing.change.afterValue !== 5 ||
        observing.change.afterConfigurationSignature !== afterSignature ||
        observing.evaluation.status !== 'NOT_EVALUATED'
    ) {
        return { pass: false, stage: 'OBSERVING', detail: 'TRANSITION_INVALID' };
    }

    const afterSnapshot = {
        generatedAt: '2026-01-18T08:10:00.000Z',
        ready: true,
        configurationSignature: afterSignature,
        analysis72h: {
            valid: true,
            rooms: {
                medianDeviationK: 0.4,
                okRatioPercent: 67
            }
        },
        evidence,
        dataQuality: { percent: 91, state: 'GOOD' }
    };

    const preconditionErrors = optimizationEvaluationPreconditionErrors(
        observing,
        afterSnapshot,
        afterSignature
    );

    if (preconditionErrors.length !== 0) {
        return {
            pass: false,
            stage: 'EVALUATION_PRECONDITIONS',
            detail: preconditionErrors.join(',')
        };
    }

    const evaluation = classifyOptimizationEvaluation(
        observing.before,
        afterSnapshot
    );

    if (evaluation.status !== 'IMPROVED') {
        return {
            pass: false,
            stage: 'EVALUATION',
            detail: evaluation.status
        };
    }

    return {
        pass: true,
        stage: 'COMPLETE',
        detail: 'IMPROVED',
        recordId: pending.recordId
    };
}

// ============================================================
// Initialisierung
// ============================================================
async function initialize() {
    log(`${LOG_PREFIX} Version ${VERSION} gestartet`, 'info');

    try {
        await ensureDatapoints();

        // T9.5-T9.9 - Recommendation + OptimizationRecord/Evaluation.
        // Erst Subscription installieren, dann ggf. einen persistierten
        // manuellen Input vom vorherigen Lauf erneut abbilden.
        const recommendationParserOk =
            installRecommendationParser();

        await parseExistingRecommendationPayload();

        const t910SelfTest = runT910IsolatedEndToEndSelfTest();
        log(
            `${LOG_PREFIX} T9.10 Startup-Integritätstest: ` +
            `${t910SelfTest.pass ? 'PASS' : 'FAIL'} | ` +
            `Stufe=${t910SelfTest.stage} | Ergebnis=${t910SelfTest.detail} | ` +
            `isoliert=true | Anlagenzugriff=false`,
            t910SelfTest.pass ? 'info' : 'error'
        );

        await setStateAsync(`${ROOT}.Status.Version`, VERSION, true);
        await setStateAsync(`${ROOT}.Status.Active`, false, true);
        await setStateAsync(`${ROOT}.Status.Valid`, false, true);
        await setStateAsync(`${ROOT}.Status.ErrorCount`, 0, true);
        await setStateAsync(`${ROOT}.Status.LastError`, '', true);

        // ----------------------------------------------------
        // Buffer laden
        // ----------------------------------------------------
        sampleBuffer = loadBuffer();

        await persistBuffer();

        log(
            `${LOG_PREFIX} Buffer: ${sampleBuffer.length} Samples geladen`,
            'info'
        );

        // ----------------------------------------------------
        // Startup-Snapshot (nicht in Buffer)
        // ----------------------------------------------------
        const startupTimestamp =
            normalizeSampleTimestamp();

        const startup =
            await performSnapshot({
                storeInBuffer: false,
                timestamp: startupTimestamp
            });

        const sourceCheck = startup.sourceCheck;

        // ----------------------------------------------------
        // Scheduler
        // ----------------------------------------------------
        const schedulerOk =
            installScheduler();

        await setStateAsync(
            `${ROOT}.Status.Valid`,
            sourceCheck.ok && schedulerOk && recommendationParserOk && t910SelfTest.pass,
            true
        );

        await setStateAsync(
            `${ROOT}.Status.Active`,
            schedulerOk,
            true
        );

        // ----------------------------------------------------
        // Log-Zusammenfassung
        // ----------------------------------------------------
        log(
            `${LOG_PREFIX} Sources: ` +
            `${sourceCheck.required.ok}/${sourceCheck.required.total} required OK | ` +
            `${sourceCheck.optional.ok}/${sourceCheck.optional.total} optional OK`,
            sourceCheck.ok ? 'info' : 'warn'
        );

        log(
            `${LOG_PREFIX} Räume: ` +
            `${sourceCheck.rooms.valid}/${sourceCheck.rooms.configured} Quellen gültig | ` +
            `${startup.roomEvaluation.summary.dataValidCount} Daten gültig | ` +
            `${startup.roomEvaluation.summary.validForHeatingCurveCount} für Heizkurve gültig`,
            sourceCheck.rooms.valid === sourceCheck.rooms.configured
                ? 'info'
                : 'warn'
        );

        log(
            `${LOG_PREFIX} Current: ` +
            `Prio=${startup.nibe.operatingPriority} | ` +
            `Verdichter=${startup.nibe.compressorActive} | ` +
            `VL Soll=${startup.nibe.flowTarget} °C | ` +
            `VL Ist=${startup.nibe.flowActual} °C | ` +
            `SampleValid=${startup.sampleEvaluation.valid} | ` +
            `Qualität=${startup.sampleEvaluation.quality}%`,
            'info'
        );

        if (!startup.sampleEvaluation.valid) {
            log(
                `${LOG_PREFIX} Current-Messpunkt nicht für Heizkurvenanalyse gültig | ` +
                `Gründe=${startup.sampleEvaluation.reasons.join(',')}`,
                'info'
            );
        }

        const evidenceJsonRaw =
            getState(`${ROOT}.Analysis.EvidenceJson`)?.val;

        if (evidenceJsonRaw) {
            try {
                const evidenceState =
                    JSON.parse(String(evidenceJsonRaw));

                log(
                    `${LOG_PREFIX} Evidence: DataQuality=` +
                    `${Math.round(evidenceState.dataQuality?.percent || 0)}% | ` +
                    `State=${evidenceState.dataQuality?.state || 'INSUFFICIENT'} | ` +
                    `InsufficientData=${evidenceState.insufficientData === true} | ` +
                    `AI.Ready=${evidenceState.aiReady === true}`,
                    'info'
                );
            } catch (_) {
                // Keine Log-Ausgabe notwendig.
            }
        }

        const payloadRaw =
            getState(
                `${ROOT}.AI.AnalysisPayload`
            )?.val;

        if (payloadRaw) {
            const payloadBytes =
                utf8ByteLength(
                    String(payloadRaw)
                );

            log(
                `${LOG_PREFIX} AI-Payload: ` +
                `${payloadBytes} Bytes | ` +
                `Version=${PAYLOAD_VERSION} | ` +
                `Ready=${getState(`${ROOT}.AI.Ready`)?.val === true}`,
                'info'
            );
        }

        log(
            `${LOG_PREFIX} Recommendation-Parser/Validator/ChangeAllowed/OptimizationRecord/Evaluation/Startup-Integritätstest: ${recommendationParserOk ? 'aktiv' : 'FEHLER'}`,
            recommendationParserOk ? 'info' : 'error'
        );

        log(
            `${LOG_PREFIX} Scheduler: 5-Minuten-Raster ${schedulerOk ? 'aktiv' : 'FEHLER'}`,
            schedulerOk ? 'info' : 'error'
        );

        if (sourceCheck.ok && schedulerOk && recommendationParserOk && t910SelfTest.pass) {
            log(
                `${LOG_PREFIX} v${VERSION} Initialisierung erfolgreich`,
                'info'
            );
        } else {
            log(
                `${LOG_PREFIX} v${VERSION} Initialisierung unvollständig`,
                'warn'
            );
        }

    } catch (err) {
        await recordError(
            'INITIALIZATION_FAILED',
            err
        );

        try {
            await setStateAsync(
                `${ROOT}.Status.Valid`,
                false,
                true
            );

            await setStateAsync(
                `${ROOT}.Status.Active`,
                false,
                true
            );
        } catch (_) {
            // Keine weitere Aktion möglich.
        }
    }
}

// ============================================================
// Stop
// ============================================================
onStop(() => {
    shutdown();
}, 3000);

// ============================================================
// Start
// ============================================================
initialize();

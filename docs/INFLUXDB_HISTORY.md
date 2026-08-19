# InfluxDB History Matrix

**NPS V1.0.0 baseline**

This document records which NPS data points are intentionally historized in the two InfluxDB instances. It complements `HISTORY_POLICY.md` with the concrete state lists.

## Effective policy

| Instance | Purpose |
|---|---|
| `influxdb.0` | Completed, long-term daily values |
| `influxdb.1` | Live, short-term, diagnostic and cycle values |

> The effective V1 policy is defined by `99_NPS_InfluxConfiguration_statistics.js`, `99_NPS_InfluxConfiguration.js` and the cleanup rule in `99_NPS_Influxdb_Bereinigung.js`. `99_NPS_DashboardDataHistory.js` is an earlier/general history configuration tool and contains long-term assignments that conflict with the final V1 separation; it must not be used to re-enable those duplicate `influxdb.0` assignments.

## `influxdb.0` – long-term daily values (15)

| Data point | Purpose |
|---|---|
| `0_userdata.0.NPS.DashboardData.Statistics.StromGesamt.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.StromHeizung.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.StromWarmwasser.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.StromStandby.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.StromKuehlung.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.StromPool.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.StromUnbekannt.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.StromZugeordnet.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.WaermeHeizungGesamt.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.WaermeHeizungVerdichter.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.WaermeWarmwasserGesamt.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.WaermeWarmwasserVerdichter.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.Verdichterlaufzeit.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.Verdichterstarts.Yesterday` | Completed previous-day statistic |
| `0_userdata.0.NPS.DashboardData.Statistics.Abtaudauer.Yesterday` | Completed previous-day statistic |

## `influxdb.1` – DashboardData short-term energy (5)

| Data point |
|---|
| `0_userdata.0.NPS.DashboardData.Periods.Day.ElectricTotal` |
| `0_userdata.0.NPS.DashboardData.Periods.Day.ElectricHeating` |
| `0_userdata.0.NPS.DashboardData.Periods.Day.ElectricWarmwater` |
| `0_userdata.0.NPS.DashboardData.Periods.Day.HeatHeating` |
| `0_userdata.0.NPS.DashboardData.Periods.Day.HeatWarmwater` |

## `influxdb.1` – DashboardData COP (4)

| Data point |
|---|
| `0_userdata.0.NPS.DashboardData.Energy.COPTotal` |
| `0_userdata.0.NPS.DashboardData.Periods.Day.COPTotal` |
| `0_userdata.0.NPS.DashboardData.Periods.Day.COPHeating` |
| `0_userdata.0.NPS.DashboardData.Periods.Day.COPWarmwater` |

## `influxdb.1` – CycleAnalyzer (57)

`History.CycleReportJson` is mandatory because it is the complete historical source used by `11_NPS_InfluxAdapter`.

| CycleAnalyzer state |
|---|
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.TypeCode` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.RunNumber` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.DurationSeconds` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.RecordingDurationSeconds` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.SampleCount` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.MainSampleCount` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.PrebufferSampleCount` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.PostbufferSampleCount` |
| `0_userdata.0.NPS.CycleAnalyzer.Analysis.Valid` |
| `0_userdata.0.NPS.CycleAnalyzer.History.CycleReportJson` |
| `0_userdata.0.NPS.CycleAnalyzer.Compressor.RuntimeSeconds` |
| `0_userdata.0.NPS.CycleAnalyzer.Compressor.FrequencyMinimum` |
| `0_userdata.0.NPS.CycleAnalyzer.Compressor.FrequencyAverage` |
| `0_userdata.0.NPS.CycleAnalyzer.Compressor.FrequencyMaximum` |
| `0_userdata.0.NPS.CycleAnalyzer.Compressor.Starts` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.OutdoorStart` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.OutdoorEnd` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.OutdoorMinimum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.OutdoorMaximum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.OutdoorAverage` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterTopStart` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterTopEnd` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterTopMinimum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterTopMaximum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterTopRise` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterChargingStart` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterChargingEnd` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterChargingMinimum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterChargingMaximum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.HotWaterChargingRise` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.SupplyStart` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.SupplyEnd` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.SupplyMaximum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.ReturnStart` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.ReturnEnd` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.ReturnMaximum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.SpreadMinimum` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.SpreadAverage` |
| `0_userdata.0.NPS.CycleAnalyzer.Temperature.SpreadMaximum` |
| `0_userdata.0.NPS.CycleAnalyzer.Power.ElectricAverageW` |
| `0_userdata.0.NPS.CycleAnalyzer.Power.ElectricMaximumW` |
| `0_userdata.0.NPS.CycleAnalyzer.Power.HeatAverageKW` |
| `0_userdata.0.NPS.CycleAnalyzer.Power.HeatMaximumKW` |
| `0_userdata.0.NPS.CycleAnalyzer.Energy.ElectricKWh` |
| `0_userdata.0.NPS.CycleAnalyzer.Energy.HeatKWh` |
| `0_userdata.0.NPS.CycleAnalyzer.Energy.COP` |
| `0_userdata.0.NPS.CycleAnalyzer.Energy.ElectricTotalDeltaKWh` |
| `0_userdata.0.NPS.CycleAnalyzer.Energy.AliasConsumptionDeltaKWh` |
| `0_userdata.0.NPS.CycleAnalyzer.Energy.AliasProductionDeltaKWh` |
| `0_userdata.0.NPS.CycleAnalyzer.Events.DefrostCount` |
| `0_userdata.0.NPS.CycleAnalyzer.Events.StateChangeCount` |
| `0_userdata.0.NPS.CycleAnalyzer.Events.PriorityChangeCount` |
| `0_userdata.0.NPS.CycleAnalyzer.Quality.Score` |
| `0_userdata.0.NPS.CycleAnalyzer.Quality.Complete` |
| `0_userdata.0.NPS.CycleAnalyzer.Quality.ExpectedMainSamples` |
| `0_userdata.0.NPS.CycleAnalyzer.Quality.MissingMainSamples` |
| `0_userdata.0.NPS.CycleAnalyzer.Quality.LargestGapSeconds` |

## Explicit duplicate cleanup (34)

The following DashboardData states are explicitly removed from `influxdb.0` by `99_NPS_Influxdb_Bereinigung.js`; their short-term history in `influxdb.1` remains untouched.

| Data point removed from `influxdb.0` |
|---|
| `0_userdata.0.NPS.DashboardData.Compressor.Active` |
| `0_userdata.0.NPS.DashboardData.Compressor.Frequency` |
| `0_userdata.0.NPS.DashboardData.Compressor.Runtime` |
| `0_userdata.0.NPS.DashboardData.Compressor.Starts` |
| `0_userdata.0.NPS.DashboardData.Cycles.COP` |
| `0_userdata.0.NPS.DashboardData.Cycles.Duration` |
| `0_userdata.0.NPS.DashboardData.Cycles.ElectricEnergy` |
| `0_userdata.0.NPS.DashboardData.Cycles.HeatEnergy` |
| `0_userdata.0.NPS.DashboardData.Cycles.LastCycle` |
| `0_userdata.0.NPS.DashboardData.Cycles.Quality` |
| `0_userdata.0.NPS.DashboardData.Cycles.Type` |
| `0_userdata.0.NPS.DashboardData.Defrost.Active` |
| `0_userdata.0.NPS.DashboardData.Defrost.Count` |
| `0_userdata.0.NPS.DashboardData.Defrost.LastDuration` |
| `0_userdata.0.NPS.DashboardData.Defrost.LastStart` |
| `0_userdata.0.NPS.DashboardData.Energy.COPHeating` |
| `0_userdata.0.NPS.DashboardData.Energy.COPWarmwater` |
| `0_userdata.0.NPS.DashboardData.Energy.ElectricHeating` |
| `0_userdata.0.NPS.DashboardData.Energy.ElectricTotal` |
| `0_userdata.0.NPS.DashboardData.Energy.ElectricWarmwater` |
| `0_userdata.0.NPS.DashboardData.Energy.HeatHeating` |
| `0_userdata.0.NPS.DashboardData.Energy.HeatWarmwater` |
| `0_userdata.0.NPS.DashboardData.Events.Counter` |
| `0_userdata.0.NPS.DashboardData.Events.Criticality` |
| `0_userdata.0.NPS.DashboardData.Events.LastEvent` |
| `0_userdata.0.NPS.DashboardData.Events.Timestamp` |
| `0_userdata.0.NPS.DashboardData.Overview.Mode` |
| `0_userdata.0.NPS.DashboardData.Temperatures.DeltaT` |
| `0_userdata.0.NPS.DashboardData.Temperatures.Flow` |
| `0_userdata.0.NPS.DashboardData.Temperatures.MeanHeatingWater` |
| `0_userdata.0.NPS.DashboardData.Temperatures.Outdoor` |
| `0_userdata.0.NPS.DashboardData.Temperatures.Return` |
| `0_userdata.0.NPS.DashboardData.Temperatures.Supply` |
| `0_userdata.0.NPS.DashboardData.Temperatures.TemperatureLift` |

## Installation-specific history outside the NPS history tools

The current supplied ioBroker Modbus export contains the following already-enabled InfluxDB logging. This is an installation setting, not a history assignment created by the NPS configuration tools above.

| Data point | Name | Instance |
|---|---|---|
| `modbus.0.inputRegisters.3823_33823` | Gesamtverbrauch | `influxdb.1` |

## Retention

Retention is configured in the InfluxDB adapter/database and is not set by these NPS scripts. The V1 architecture treats `influxdb.1` as the short-term store and `influxdb.0` as the long-term store.

## Maintenance rule

When a history assignment changes, update the configuration script first and then regenerate this matrix. Do not maintain an independent manual list as a second source of truth.

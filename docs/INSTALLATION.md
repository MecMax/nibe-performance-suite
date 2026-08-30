# NPS Installation Guide

This guide describes the installation of the NIBE Performance Suite (NPS)
for a new ioBroker installation.

The current public beta is:

**NPS 1.1.0-beta.2**

NPS is currently developed and tested with a NIBE S2125 heat pump and
VVM S500 indoor module connected to ioBroker through Modbus TCP.

Other NIBE systems may work if the required values and Modbus registers
are available, but they have not yet been validated by the project.

---

## 1. Installation concept

NPS separates the physical NIBE data from its internal data model.

```text
NIBE heat pump
    |
    | Modbus TCP
    v
ioBroker Modbus adapter
    |
    v
NIBE source data points
    |
    v
ioBroker aliases
    |
    v
NPS production modules
    |
    +--> 0_userdata.0.NPS.*
    |
    +--> InfluxDB history
    |
    +--> analysis modules
    |
    +--> DashboardData
    |
    +--> optional Jarvis visualization
```

The aliases form the installation-specific interface between the NIBE
installation and NPS.

The internal NPS data model below `0_userdata.0.NPS` should normally not be
adapted to a particular installation.

---

## 2. Before installing NPS

A working ioBroker installation is required.

The following components are used by NPS or by optional NPS functions:

- ioBroker JavaScript adapter
- NIBE communication through Modbus TCP
- ioBroker alias data points for the required NIBE values
- ioBroker InfluxDB adapter for history functions
- Jarvis for the reference visualization, if desired
- notification infrastructure for NotificationBridge, if desired
- heatingcontrol and room-temperature data for HeatingCurveAnalyzer, if desired

Not every optional component is required for the NPS core functions.

---

## 3. NIBE Modbus connection

The NIBE installation must first be readable from ioBroker.

Configure the ioBroker Modbus adapter independently of NPS and verify that
the required NIBE registers provide plausible current values.

NPS does not directly depend on one specific Modbus object path.
Instead, installation-specific source data is mapped through ioBroker aliases.

See:

- [`ALIASES.md`](ALIASES.md)
- [`ALIAS_MODBUS_MAPPING.json`](ALIAS_MODBUS_MAPPING.json)

for the reference alias and Modbus mapping used by the project.

---

## 4. Alias layer

The current NPS beta uses explicit alias paths in several production modules.

Examples include values for:

- produced heat energy
- electrical energy and power
- operating priority
- compressor frequency
- compressor status
- compressor starts and runtime
- outdoor temperature
- supply temperature
- return temperature
- volume flow
- defrost state
- auxiliary heater power

Before starting the affected modules, either create aliases matching the
reference NPS alias structure or adapt the source definitions in the scripts
to the local ioBroker installation.

Do not change internal NPS paths below:

```text
0_userdata.0.NPS
```

unless explicitly documented.

---

## 5. Production scripts

The continuously running NPS modules are stored in:

```text
scripts/
```

Maintenance and one-shot utilities are stored separately in:

```text
tools/
```

The production modules are:

```text
01_NPS_VirtualMeters
02_NPS_EnergyAllocation
03_NPS_TemperatureMonitor
04_NPS_CompressorMonitor
05_NPS_DefrostMonitor
06_NPS_ProcessSignals
07_NPS_StateMachine
08_NPS_EventEngine
09_NPS_NotificationBridge
10_NPS_DashboardData
11_NPS_InfluxAdapter
12_NPS_ElectricalMeters
13_NPS_CycleAnalyzer
14_NPS_PerformanceAnalyzer
15_NPS_HeatingCurveAnalyzer
98_NPS_CycleRecorder
```

Not every module has to be enabled immediately.

It is recommended to configure and verify the data sources before enabling
all modules.

---

## 6. Important module dependencies

Several modules use installation-specific NIBE aliases directly.
Other modules consume normalized NPS data.

```text
NIBE aliases
    |
    +--> 01 VirtualMeters
    +--> 03 TemperatureMonitor
    +--> 04 CompressorMonitor
    +--> 06 ProcessSignals
    +--> 12 ElectricalMeters
    +--> 98 CycleRecorder

06 ProcessSignals
    |
    v
07 StateMachine
    |
    v
08 EventEngine
    |
    v
09 NotificationBridge

98 CycleRecorder
    |
    v
13 CycleAnalyzer
    |
    v
14 PerformanceAnalyzer
```

`02_NPS_EnergyAllocation` additionally uses data from ElectricalMeters
together with NIBE operating priority and compressor frequency.

`10_NPS_DashboardData` consolidates NPS analysis and presentation data for
the visualization layer.

---

## 7. Recommended commissioning order

For a new installation, commission NPS in stages.

### Stage A - source data

Verify first:

1. NIBE Modbus communication
2. required NIBE source values
3. ioBroker aliases
4. plausible units and values

### Stage B - basic NPS data

Enable and verify the basic source-processing modules, especially:

```text
01 VirtualMeters
03 TemperatureMonitor
04 CompressorMonitor
06 ProcessSignals
12 ElectricalMeters
98 CycleRecorder
```

Check their states below:

```text
0_userdata.0.NPS
```

for valid values and error/status messages.

### Stage C - dependent analysis

After the source modules are working, enable the dependent modules:

```text
02 EnergyAllocation
05 DefrostMonitor
07 StateMachine
08 EventEngine
13 CycleAnalyzer
14 PerformanceAnalyzer
10 DashboardData
```

### Stage D - optional integrations

Finally configure optional components:

```text
09 NotificationBridge
11 InfluxAdapter
15 HeatingCurveAnalyzer
Jarvis visualization
```

This staged procedure makes source or configuration errors easier to identify.

---

## 8. InfluxDB history

The NPS reference history policy distinguishes two InfluxDB instances.

```text
influxdb.0
    completed daily and long-term values

influxdb.1
    live values
    diagnostic values
    operating values
    event values
    cycle values
```

`11_NPS_InfluxAdapter` manages the NPS history policy and detects unintended
double history on both InfluxDB instances.

The current reference configuration uses:

```text
LONGTERM_INSTANCE = influxdb.0
LIVE_INSTANCE     = influxdb.1
```

Do not assign a managed NPS state to both instances unless this is explicitly
intended.

See:

- [`HISTORY_POLICY.md`](HISTORY_POLICY.md)
- [`INFLUXDB_HISTORY.md`](INFLUXDB_HISTORY.md)
- [`INFLUXDB_HISTORY.json`](INFLUXDB_HISTORY.json)

---

## 9. CycleRecorder configuration

`98_NPS_CycleRecorder` records detailed operating cycles.

Its installation-specific configuration must be reviewed before productive use.

Important settings include:

```text
FILE_EXPORT_ENABLED
FILE_ADAPTER
FILE_DIRECTORY
ELECTRIC_POWER_UNIT
AUXILIARY_POWER_UNIT
ELECTRIC_POWER_INCLUDES_AUXILIARY
```

The configured source aliases must also match the local installation.

In particular, verify whether the configured electrical power value already
contains auxiliary-heater power. An incorrect setting can cause auxiliary
energy to be counted twice.

---

## 10. NotificationBridge

`09_NPS_NotificationBridge` is optional.

It consumes NPS events and can route them to the configured notification
infrastructure and Jarvis.

The current reference setup additionally uses NIBE aliases for:

```text
UNREACH
Alarmnummer
```

and publishes notifications through:

```text
0_userdata.0.NotificationCenter.Events.Publish
```

This notification infrastructure is installation-specific and must be adapted
or disabled if it does not exist on the target system.

The core monitoring and analysis functions of NPS do not require notifications.

---

## 11. HeatingCurveAnalyzer

`15_NPS_HeatingCurveAnalyzer` is an NPS 1.1 beta extension for heating-curve
analysis and AI-assisted optimization.

It is not required for the NPS core installation.

The current beta requires additional installation-specific configuration.

### NIBE data

The module uses additional values such as:

- heating curve
- heating-curve offset
- minimum and maximum supply temperature
- calculated supply-temperature target
- actual supply temperature
- return temperature
- degree minutes
- heating start and stop limits
- compressor data
- volume flow
- auxiliary heat
- defrost state

The reference configuration currently contains explicit NIBE alias paths.

### Room data

The reference implementation also contains installation-specific room
definitions.

These definitions can include:

- heatingcontrol instance
- heatingcontrol room
- room-temperature sensor
- one or more radiator thermostats
- thermostat actual temperature
- thermostat setpoint

The supplied configuration reflects the development installation and must be
reviewed and adapted before HeatingCurveAnalyzer is used on another system.

The reference installation currently uses:

```text
heatingcontrol.0
heatingcontrol.1
```

A different installation may use another number of instances or a different
room structure.

### Safety

The AI-assisted workflow is advisory only.

NPS evaluates and validates recommendations. Any accepted NIBE parameter
change is performed manually by the user.

NPS 1.1.0-beta.2 does not automatically write heating-curve optimization
parameters to the NIBE system.

See:

- [`15_HeatingCurveAnalyzer/Anwenderspezifikation_v0.2.0.md`](15_HeatingCurveAnalyzer/Anwenderspezifikation_v0.2.0.md)
- [`15_HeatingCurveAnalyzer/Technische_Spezifikation_v0.2.0.md`](15_HeatingCurveAnalyzer/Technische_Spezifikation_v0.2.0.md)
- [`15_HeatingCurveAnalyzer/KI_Anwenderanleitung.md`](15_HeatingCurveAnalyzer/KI_Anwenderanleitung.md)

---

## 12. Jarvis

Jarvis is optional for the NPS processing and analysis functions.

NPS provides presentation data through `10_NPS_DashboardData`.

The repository documents the project's Jarvis reference interface, but the
`jarvis/` directory does not currently contain a complete private ioBroker
Jarvis export.

This is intentional: a complete Jarvis export may contain unrelated household
objects and must not be published without sanitization.

See:

- [`JARVIS_UI.md`](JARVIS_UI.md)
- [`../jarvis/README.md`](../jarvis/README.md)

---

## 13. First functional check

After enabling the required modules, inspect:

```text
0_userdata.0.NPS
```

For every enabled module verify:

- expected module states exist
- version information is present
- status and active states indicate normal operation
- source values are plausible
- no required source states are reported missing
- ioBroker log contains no recurring NPS warnings or errors

Do not evaluate COP, energy allocation, cycle quality or heating optimization
until the underlying source values and units have been verified.

---

## 14. Maintenance tools

Scripts below:

```text
tools/
```

are maintenance or one-shot utilities.

They are intentionally separated from production scripts to prevent accidental
continuous execution.

Review [`../tools/README.md`](../tools/README.md) before using them.

---

## 15. Beta status

NPS 1.1.0-beta.2 extends the frozen NPS 1.0.0 architectural baseline.

The core monitoring, energy, cycle and visualization functions are
production-tested on the reference installation.

Heating-period-dependent evaluations of HeatingCurveAnalyzer have passed
structural, integration and smoke tests.

The real seasonal before/after optimization cycle remains subject to field
validation under suitable heating conditions.

---

## 16. Troubleshooting

If an NPS module does not start correctly, check in this order:

1. Does the configured source object exist?
2. Does it currently contain a value?
3. Is the value type correct?
4. Is the unit correct?
5. Does the alias point to the intended NIBE source?
6. Are prerequisite NPS modules running?
7. Are the expected states present below `0_userdata.0.NPS`?
8. Does the ioBroker JavaScript log contain a source or version warning?

Most installation problems should be resolved at the alias/source layer rather
than by changing the internal NPS data model.

---

## 17. Additional documentation

See:

- [`V1_BASELINE.md`](V1_BASELINE.md)
- [`ALIASES.md`](ALIASES.md)
- [`ALIAS_MODBUS_MAPPING.json`](ALIAS_MODBUS_MAPPING.json)
- [`HISTORY_POLICY.md`](HISTORY_POLICY.md)
- [`INFLUXDB_HISTORY.md`](INFLUXDB_HISTORY.md)
- [`SCRIPT_INVENTORY.md`](SCRIPT_INVENTORY.md)
- [`JARVIS_UI.md`](JARVIS_UI.md)

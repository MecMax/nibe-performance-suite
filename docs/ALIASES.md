# Alias and Modbus Reference

This document lists the ioBroker aliases referenced by the active **NPS V1.0.0 production scripts** and their concrete mapping from the current ioBroker alias export.

**Unique NPS alias states:** 34  
**Resolved from current alias export:** 34  
**Unresolved references:** 0

## Mapping table

| Alias | Meaning / ioBroker name | Type | Role | Unit | Read | Write | Modbus area | Register index | Modbus address | ioBroker Modbus object | Used by NPS module(s) |
|---|---|---|---|---:|:---:|:---:|---|---:|---:|---|---|
| `alias.0.Keller.Waschküche.Waermepumpe.Aktuelle_Verdichterfrequenz_(EB101)` | Aktuelle_Verdichterfrequenz_(EB101) | `number` | `value.frequency` | Hz | ✓ | ✗ | `inputRegisters` | 1803 | 31803 | `modbus.0.inputRegisters.1803_31803` | `02_NPS_EnergyAllocation.js`, `04_NPS_CompressorMonitor.js`, `06_NPS_ProcessSignals.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Alarmnummer` | Alarmnummer | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 1975 | 31975 | `modbus.0.inputRegisters.1975_31975` | `09_NPS_NotificationBridge.js`, `10_NPS_DashboardData.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Aussentemperatur` | Aussentemperatur | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 1 | 30001 | `modbus.0.inputRegisters.1_30001` | `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Außenlufttemperatur_(EB101-BT28)` | Außenlufttemperatur_(EB101-BT28) | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 1621 | 31621 | `modbus.0.inputRegisters.1621_31621` | `03_NPS_TemperatureMonitor.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Berechneter_Vorlauf_Klimatisierungssystem_1` | Berechneter Vorlauf Klimatisierungssystem 1 | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 1017 | 31017 | `modbus.0.inputRegisters.1017_31017` | `10_NPS_DashboardData.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Betriebsmodus_interne_Zusatzheizung` | Betriebsmodus_interne_Zusatzheizung | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 1029 | 31029 | `modbus.0.inputRegisters.1029_31029` | `10_NPS_DashboardData.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_einschl_interner_ZH` | Brauchwasser_einschl_interner_ZH | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 1575 | 31575 | `modbus.0.inputRegisters.1575_31575` | `01_NPS_VirtualMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_nur_Verdichter` | Brauchwasser_nur_Verdichter | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 1583 | 31583 | `modbus.0.inputRegisters.1583_31583` | `01_NPS_VirtualMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasser_oben` | Brauchwasser_oben | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 8 | 30008 | `modbus.0.inputRegisters.8_30008` | `10_NPS_DashboardData.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Brauchwasserbereitung` | Brauchwasserbereitung | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 9 | 30009 | `modbus.0.inputRegisters.9_30009` | `10_NPS_DashboardData.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_der_Zusatzheizung_für_Brauchwasser_in_der_letzten_Stunde` | Energieprotokoll_Energieverbrauch der Zusatzheizung für Brauchwasser in der letzten Stunde | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 2301 | 32301 | `modbus.0.inputRegisters.2301_32301` | `12_NPS_ElectricalMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_der_Zusatzheizung_für_Heizung_in_der_letzten_Stunde` | Energieprotokoll_Energieverbrauch der Zusatzheizung für Heizung in der letzten Stunde | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 2299 | 32299 | `modbus.0.inputRegisters.2299_32299` | `12_NPS_ElectricalMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_für_Brauchwasser_in_der_letzten_Stunde` | Energieprotokoll_Energieverbrauch für Brauchwasser in der letzten Stunde | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 2293 | 32293 | `modbus.0.inputRegisters.2293_32293` | `12_NPS_ElectricalMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll_Energieverbrauch_für_Heizung_in_der_letzten_Stunde` | Energieprotokoll_Energieverbrauch für Heizung in der letzten Stunde | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 2291 | 32291 | `modbus.0.inputRegisters.2291_32291` | `12_NPS_ElectricalMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll___Tatsächlicher_Energieverbrauch` | Energieprotokoll – Tatsächlicher Energieverbrauch | `number` | `value.power` | W | ✓ | ✗ | `inputRegisters` | 2305 | 32305 | `modbus.0.inputRegisters.2305_32305` | `12_NPS_ElectricalMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Enteisung` | Enteisung | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 1805 | 31805 | `modbus.0.inputRegisters.1805_31805` | `05_NPS_DefrostMonitor.js`, `06_NPS_ProcessSignals.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Erzeugte_Leistung_Wärme_(EB101)` | Erzeugte_Leistung_Wärme_(EB101) | `number` | `value.power` | kW | ✓ | ✗ | `inputRegisters` | 406 | 30406 | `modbus.0.inputRegisters.406_30406` | `10_NPS_DashboardData.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Gesamtproduktion` | Gesamtproduktion | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 3821 | 33821 | `modbus.0.inputRegisters.3821_33821` | `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Gesamtverbrauch` | Gesamtverbrauch | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 3823 | 33823 | `modbus.0.inputRegisters.3823_33823` | `12_NPS_ElectricalMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Heizung_einschl_interner_ZH` | Heizung_einschl_interner_ZH | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 1577 | 31577 | `modbus.0.inputRegisters.1577_31577` | `01_NPS_VirtualMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Heizung_nur_Verdichter` | Heizung_nur_Verdichter | `number` | `value.energy` | kWh | ✓ | ✗ | `inputRegisters` | 1585 | 31585 | `modbus.0.inputRegisters.1585_31585` | `01_NPS_VirtualMeters.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Kondensatorfühler_Vorlauf_(EB101-BT12)` | Kondensatorfühler_Vorlauf_(EB101-BT12) | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 1478 | 31478 | `modbus.0.inputRegisters.1478_31478` | `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Leistung_interne_Zusatzheizung` | Leistung_interne_Zusatzheizung | `number` | `value.power` | kW | ✓ | ✗ | `inputRegisters` | 1027 | 31027 | `modbus.0.inputRegisters.1027_31027` | `10_NPS_DashboardData.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Ruecklauf` | Ruecklauf | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 7 | 30007 | `modbus.0.inputRegisters.7_30007` | `03_NPS_TemperatureMonitor.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Status_Verdichter_Bedarf` | Status Verdichter Bedarf | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 350 | 30350 | `modbus.0.inputRegisters.350_30350` | `06_NPS_ProcessSignals.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Status_Verdichter_Erwärmer` | Status Verdichter Erwärmer | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 348 | 30348 | `modbus.0.inputRegisters.348_30348` | `06_NPS_ProcessSignals.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Strom_(EB101-EP14)` | Strom (EB101-EP14) | `number` | `value.current` | A | ✓ | ✗ | `inputRegisters` | 1903 | 31903 | `modbus.0.inputRegisters.1903_31903` | `06_NPS_ProcessSignals.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.UNREACH` | UNREACH | `boolean` | `indicator` | — | ✓ | ✗ | `info` | — | — | `modbus.0.info.connection` | `09_NPS_NotificationBridge.js`, `10_NPS_DashboardData.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Anzahl_Starts` | Verdichter_Anzahl_Starts | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 1489 | 31489 | `modbus.0.inputRegisters.1489_31489` | `04_NPS_CompressorMonitor.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Verdichter_Gesamtbetriebszeit_(EB101-EP14)` | Verdichter_Gesamtbetriebszeit_(EB101-EP14) | `number` | `value.interval` | h | ✓ | ✗ | `inputRegisters` | 1491 | 31491 | `modbus.0.inputRegisters.1491_31491` | `04_NPS_CompressorMonitor.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Verdichterstatus` | Verdichterstatus | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 1484 | 31484 | `modbus.0.inputRegisters.1484_31484` | `04_NPS_CompressorMonitor.js`, `98_NPS_CycleRecorder.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Volumenstrommesser_(BF1)` | Volumenstrommesser_(BF1) | `number` | `value.flow` | l/min | ✓ | ✗ | `inputRegisters` | 40 | 30040 | `modbus.0.inputRegisters.40_30040` | `03_NPS_TemperatureMonitor.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.Vorlauf` | Vorlauf | `number` | `value.temperature` | °C | ✓ | ✗ | `inputRegisters` | 5 | 30005 | `modbus.0.inputRegisters.5_30005` | `03_NPS_TemperatureMonitor.js` |
| `alias.0.Keller.Waschküche.Waermepumpe.prio` | prio | `number` | `value` | — | ✓ | ✗ | `inputRegisters` | 1028 | 31028 | `modbus.0.inputRegisters.1028_31028` | `02_NPS_EnergyAllocation.js`, `06_NPS_ProcessSignals.js`, `98_NPS_CycleRecorder.js` |

## Alias read transformations

- `alias.0.Keller.Waschküche.Waermepumpe.Energieprotokoll___Tatsächlicher_Energieverbrauch` → `val = val * 1000`
- `alias.0.Keller.Waschküche.Waermepumpe.UNREACH` → `val = !val`

## Resolved compressor status aliases

The two optional compressor-status inputs used by `06_NPS_ProcessSignals.js` are now present in the current ioBroker alias export:

- `Status_Verdichter_Bedarf` → `modbus.0.inputRegisters.350_30350`
- `Status_Verdichter_Erwärmer` → `modbus.0.inputRegisters.348_30348`

The CycleRecorder auxiliary-heater power input is also aligned with the current alias:

- `Leistung_interne_Zusatzheizung` → `modbus.0.inputRegisters.1027_31027` (`kW`)

## Architecture

`NIBE → Modbus adapter → ioBroker alias → NPS module → DashboardData / Public API → Jarvis`

All mappings in this document are taken from the current supplied ioBroker alias export. No missing register assignment has been inferred.

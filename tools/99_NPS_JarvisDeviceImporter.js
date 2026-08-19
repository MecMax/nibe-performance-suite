/**
 * NIBE Performance Suite (NPS)
 * Datei:   99_NPS_JarvisDeviceImporter.js
 * Version: 1.2.2
 * Build:   2026-08-19
 *
 * Zweck
 * -----
 * Ein gemeinsamer, generischer Jarvis-Importer für alle NPS-v2-Geräte.
 *
 * Verwaltete Geräte:
 * - nps_v2_compressor
 * - nps_v2_temperatures
 * - nps_v2_energy
 * - nps_v2_cycles
 * - nps_v2_events
 * - nps_v2_defrost
 * - nps_v2_performance
 * - nps_v2_system
 *
 * Sicherheitsprinzip
 * ------------------
 * - Alle acht Zielgeräte werden in EINEM Schreibvorgang aktualisiert.
 * - Alle anderen Jarvis-Geräte bleiben byte-inhaltlich unverändert.
 * - Vor dem Schreibzugriff wird jarvis.0.devices vollständig gesichert.
 * - Paralleländerungsschutz vor dem Schreiben.
 * - Rückleseprüfung nach dem Schreiben.
 * - Vorhandene Zielgeräte werden nur übernommen, wenn sie als NPS-v2-Geräte
 *   des passenden bisherigen Importers/Converters erkennbar sind.
 *
 * NPS-Regeln
 * ----------
 * - Jeder importierte Datenpunkt verwendet icon: mdi:checkbox-blank-circle.
 * - JSON-States behalten ihre vorhandene Regel: kein stateStyle.
 * - Bestehende Jarvis-Geräte-IDs und State-Keys bleiben erhalten.
 *
 * Konsolidierung 1.0.0
 * --------------------
 * - Acht einzelne JarvisDeviceImporter zu einem generischen Importer zusammengeführt.
 * - Gemeinsame Backup-, Sicherheits-, Validierungs- und Schreiblogik.
 * - System-StateKey "NPS-Strukturversion" aus Kompatibilitätsgründen beibehalten,
 *   Quelle/Label jedoch auf StateMachine.System.Version / "StateMachine-Version"
 *   umgestellt, da 00_NPS_Structure nicht mehr existiert.
 *
 * Korrektur 2026-08-18
 * - Hilfsobjekt-Erzeugung für ioBroker-JavaScript-Adapter korrigiert.
 * - Existenzprüfung über existsObject(); createStateAsync mit forceCreation=false.
 *
 * Konsolidierung 1.1.0 | 2026-08-18
 * - Helper-States der ersten Unified-Fassung direkt unter
 *   NPS.JarvisImporter zusammengeführt.
 * - Keine funktionale Änderung an den acht Jarvis-Geräten.
 *
 * Version 1.2.0 | 2026-08-19
 * - Bestehende Jarvis-State-Darstellung wird erhalten.
 * - NPS führt nur stateKey, state (DP), label und unit.
 * - icon bleibt projektweit mdi:checkbox-blank-circle.
 * - JSON-States weiterhin ohne stateStyle.
 * - Bekannte Messfarben werden gegen das NPS-Farbschema geprüft/korrigiert.
 *
 * Version 1.2.1 | 2026-08-19
 * - Defrost-Public-API konsolidiert:
 *   Active, Count, Duration, LastDuration und LastStart werden aus
 *   DashboardData.Defrost gelesen.
 * - Defrost-spezifische Detailwerte ohne DashboardData-Pendant bleiben
 *   weiterhin auf der Public API des DefrostMonitor.
 *
 * Version 1.2.2 | 2026-08-19
 * - Events-Bezeichnungen vereinheitlicht:
 *   "Verdichter" -> "Verdichter aktiv"
 *   "Zusatzheizung" -> "Zusatzheizung aktiv"
 *   "Enteisung" -> "Enteisung aktiv"
 * - Datenpunkte und Darstellungsattribute bleiben unverändert.
 */

(function () {
    'use strict';

    const VERSION = '1.2.2';
    const BUILD = '2026-08-19';
    const LOG_PREFIX = '[NPS JarvisImporter]';

    const CONFIG = {
        jarvisDevicesState: 'jarvis.0.devices',
        dryRun: false,

        helperRoot: '0_userdata.0.NPS.JarvisImporter',
        versionState: '0_userdata.0.NPS.JarvisImporter.Version',
        lastRunState: '0_userdata.0.NPS.JarvisImporter.LastRun',
        lastResultState: '0_userdata.0.NPS.JarvisImporter.LastResult',
        importedDevicesState: '0_userdata.0.NPS.JarvisImporter.ImportedDevices',
        backupState: '0_userdata.0.NPS.JarvisImporter.BackupDevices',
        backupTimestampState: '0_userdata.0.NPS.JarvisImporter.BackupTimestamp'
    };

    const DEFINITIONS = {
    "compressor": {
        "key": "compressor",
        "enabled": true,
        "expectedStateCount": 19,
        "sourceModule": "10_NPS_DashboardData",
        "sourceVersion": "5.10.2",
        "allowConverter": false,
        "template": {
            "id": "nps_v2_compressor",
            "name": "NPS – Compressor V2",
            "icon": "mdi:heat-pump",
            "label": "",
            "function": "heating",
            "states": {
                "Verdichter aktiv": {
                    "stateKey": "Verdichter aktiv",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Active",
                    "label": "Verdichter aktiv",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Betriebsart": {
                    "stateKey": "Betriebsart",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Mode",
                    "label": "Betriebsart",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterfrequenz": {
                    "stateKey": "Verdichterfrequenz",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Frequency",
                    "label": "Verdichterfrequenz",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "Hz",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterlaufzeit gesamt": {
                    "stateKey": "Verdichterlaufzeit gesamt",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Runtime",
                    "label": "Verdichterlaufzeit gesamt",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterstarts gesamt": {
                    "stateKey": "Verdichterstarts gesamt",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Starts",
                    "label": "Verdichterstarts gesamt",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterstarts heute": {
                    "stateKey": "Verdichterstarts heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.StartsToday",
                    "label": "Verdichterstarts heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterlaufzeit heute": {
                    "stateKey": "Verdichterlaufzeit heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.RuntimeToday",
                    "label": "Verdichterlaufzeit heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Ø Zyklusdauer heute": {
                    "stateKey": "Ø Zyklusdauer heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.AverageCycleDurationToday",
                    "label": "Ø Zyklusdauer heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Ø Verdichterfrequenz heute": {
                    "stateKey": "Ø Verdichterfrequenz heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.AverageFrequencyToday",
                    "label": "Ø Verdichterfrequenz heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "Hz",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterzustand": {
                    "stateKey": "Verdichterzustand",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.State",
                    "label": "Verdichterzustand",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterstatus": {
                    "stateKey": "Verdichterstatus",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Status",
                    "label": "Verdichterstatus",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Qualitätsfarbe": {
                    "stateKey": "Qualitätsfarbe",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.QualityColor",
                    "label": "Qualitätsfarbe",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zyklustyp": {
                    "stateKey": "Zyklustyp",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.Type",
                    "label": "Zyklustyp",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Aktuelle Zyklusdauer": {
                    "stateKey": "Aktuelle Zyklusdauer",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.CurrentDuration",
                    "label": "Aktuelle Zyklusdauer",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterstarts pro Tag": {
                    "stateKey": "Verdichterstarts pro Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.History.StartsPerDay",
                    "label": "Verdichterstarts pro Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterlaufzeit pro Tag": {
                    "stateKey": "Verdichterlaufzeit pro Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.History.RuntimePerDay",
                    "label": "Verdichterlaufzeit pro Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Elektrische Leistung": {
                    "stateKey": "Elektrische Leistung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Electrical.CurrentPower",
                    "label": "Elektrische Leistung",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "W",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Wärmeleistung": {
                    "stateKey": "Wärmeleistung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Performance.ThermalPower",
                    "label": "Wärmeleistung",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kW",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Live-COP": {
                    "stateKey": "Live-COP",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Performance.LiveCOP",
                    "label": "Live-COP",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                }
            },
            "options": {}
        }
    },
    "temperatures": {
        "key": "temperatures",
        "enabled": true,
        "expectedStateCount": 14,
        "sourceModule": "10_NPS_DashboardData",
        "sourceVersion": "5.10.2",
        "allowConverter": false,
        "template": {
            "id": "nps_v2_temperatures",
            "name": "NPS – Temperatures V2",
            "icon": "mdi:thermometer",
            "label": "",
            "function": "heating",
            "states": {
                "Außentemperatur": {
                    "stateKey": "Außentemperatur",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.Outdoor",
                    "label": "Außentemperatur",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "°C",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Vorlauf Soll": {
                    "stateKey": "Vorlauf Soll",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.SupplyTarget",
                    "label": "Vorlauf Soll",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "°C",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Vorlaufabweichung": {
                    "stateKey": "Vorlaufabweichung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.SupplyDeviation",
                    "label": "Vorlaufabweichung",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "K",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Vorlauftemperatur": {
                    "stateKey": "Vorlauftemperatur",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.Supply",
                    "label": "Vorlauftemperatur",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "°C",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Rücklauftemperatur": {
                    "stateKey": "Rücklauftemperatur",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.Return",
                    "label": "Rücklauftemperatur",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "°C",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Spreizung": {
                    "stateKey": "Spreizung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.DeltaT",
                    "label": "Spreizung",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "K",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Volumenstrom": {
                    "stateKey": "Volumenstrom",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.Flow",
                    "label": "Volumenstrom",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "l/min",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Mittlere Heizwassertemperatur": {
                    "stateKey": "Mittlere Heizwassertemperatur",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.MeanHeatingWater",
                    "label": "Mittlere Heizwassertemperatur",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "°C",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Temperaturhub": {
                    "stateKey": "Temperaturhub",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.TemperatureLift",
                    "label": "Temperaturhub",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "K",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterfrequenz": {
                    "stateKey": "Verdichterfrequenz",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Frequency",
                    "label": "Verdichterfrequenz",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "Hz",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Warmwasser oben (BT7)": {
                    "stateKey": "Warmwasser oben (BT7)",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.Warmwater",
                    "label": "Warmwasser oben (BT7)",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "°C",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Warmwasserbereitung (BT6)": {
                    "stateKey": "Warmwasserbereitung (BT6)",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.WarmwaterCharging",
                    "label": "Warmwasserbereitung (BT6)",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "°C",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Betriebsart": {
                    "stateKey": "Betriebsart",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.Mode",
                    "label": "Betriebsart",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Qualitätsfarbe": {
                    "stateKey": "Qualitätsfarbe",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Temperatures.QualityColor",
                    "label": "Qualitätsfarbe",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                }
            },
            "options": {}
        }
    },
    "energy": {
        "key": "energy",
        "enabled": true,
        "expectedStateCount": 19,
        "sourceModule": "10_NPS_DashboardData",
        "sourceVersion": "5.10.2",
        "allowConverter": false,
        "template": {
            "id": "nps_v2_energy",
            "name": "NPS – Energy V2",
            "icon": "mdi:lightning-bolt",
            "label": "",
            "function": "heating",
            "states": {
                "Wärme gesamt": {
                    "stateKey": "Wärme gesamt",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.HeatTotal",
                    "label": "Wärme gesamt",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Wärme Heizung": {
                    "stateKey": "Wärme Heizung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.HeatHeating",
                    "label": "Wärme Heizung",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Wärme Warmwasser": {
                    "stateKey": "Wärme Warmwasser",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.HeatWarmwater",
                    "label": "Wärme Warmwasser",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Strom gesamt": {
                    "stateKey": "Strom gesamt",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.ElectricTotal",
                    "label": "Strom gesamt",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichterwärme": {
                    "stateKey": "Verdichterwärme",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.HeatCompressor",
                    "label": "Verdichterwärme",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zusatzheizungswärme": {
                    "stateKey": "Zusatzheizungswärme",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.HeatZH",
                    "label": "Zusatzheizungswärme",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichteranteil": {
                    "stateKey": "Verdichteranteil",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.ShareCompressor",
                    "label": "Verdichteranteil",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "%",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zusatzheizungsanteil": {
                    "stateKey": "Zusatzheizungsanteil",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.ShareZH",
                    "label": "Zusatzheizungsanteil",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "%",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Strom Heizung": {
                    "stateKey": "Strom Heizung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.ElectricHeating",
                    "label": "Strom Heizung",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Strom Warmwasser": {
                    "stateKey": "Strom Warmwasser",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.ElectricWarmwater",
                    "label": "Strom Warmwasser",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Wärme gesamt / Tag": {
                    "stateKey": "Wärme gesamt / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.HeatTotalPerDay",
                    "label": "Wärme gesamt / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Wärme Heizung / Tag": {
                    "stateKey": "Wärme Heizung / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.HeatHeatingPerDay",
                    "label": "Wärme Heizung / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Wärme Warmwasser / Tag": {
                    "stateKey": "Wärme Warmwasser / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.HeatWarmwaterPerDay",
                    "label": "Wärme Warmwasser / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Wärme Zusatzheizung / Tag": {
                    "stateKey": "Wärme Zusatzheizung / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.HeatZHPerDay",
                    "label": "Wärme Zusatzheizung / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Strom gesamt / Tag": {
                    "stateKey": "Strom gesamt / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.ElectricTotalPerDay",
                    "label": "Strom gesamt / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Strom Heizung / Tag": {
                    "stateKey": "Strom Heizung / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.ElectricHeatingPerDay",
                    "label": "Strom Heizung / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Strom Warmwasser / Tag": {
                    "stateKey": "Strom Warmwasser / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.ElectricWarmwaterPerDay",
                    "label": "Strom Warmwasser / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Strom Zusatzheizung / Tag": {
                    "stateKey": "Strom Zusatzheizung / Tag",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.History.ElectricZHPerDay",
                    "label": "Strom Zusatzheizung / Tag",
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Energie – Periodenvergleich": {
                    "stateKey": "Energie – Periodenvergleich",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Energy.PeriodComparisonJson",
                    "label": "Energie – Periodenvergleich",
                    "icon": "mdi:checkbox-blank-circle"
                }
            },
            "options": {}
        }
    },
    "cycles": {
        "key": "cycles",
        "enabled": true,
        "expectedStateCount": 11,
        "sourceModule": "10_NPS_DashboardData",
        "sourceVersion": "5.10.2",
        "allowConverter": true,
        "template": {
            "id": "nps_v2_cycles",
            "name": "NPS – Zyklus V2",
            "icon": "hvac",
            "label": "",
            "function": "heating",
            "states": {
                "Zyklus aktiv": {
                    "stateKey": "Zyklus aktiv",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.Active",
                    "label": "Zyklus aktiv",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "iconStyle": {
                        "true": {
                            "color": "#C45A32"
                        },
                        "false": {
                            "color": "#78909C"
                        },
                        "default": {
                            "color": "grey"
                        }
                    }
                },
                "Aktiver Zyklustyp": {
                    "stateKey": "Aktiver Zyklustyp",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.ActiveCycleType",
                    "label": "Aktiver Zyklustyp",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Aktuelle Zyklusdauer": {
                    "stateKey": "Aktuelle Zyklusdauer",
                    "showState": true,
                    "label": "Aktuelle Zyklusdauer",
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.CurrentDuration",
                    "unit": "min",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zyklustyp": {
                    "stateKey": "Zyklustyp",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.Type",
                    "label": "Zyklustyp",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Zyklusdauer": {
                    "stateKey": "Zyklusdauer",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.Duration",
                    "label": "Zyklusdauer",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Zyklus-COP": {
                    "stateKey": "Zyklus-COP",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.COP",
                    "label": "Zyklus-COP",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "iconStyle": {
                        "<0.1": {
                            "color": "grey"
                        },
                        "<2.2": {
                            "color": "red"
                        },
                        "<3.0": {
                            "color": "orange"
                        },
                        "<3.8": {
                            "color": "yellow"
                        },
                        "<4.5": {
                            "color": "green"
                        },
                        "default": {
                            "color": "lime"
                        }
                    }
                },
                "Elektrische Zyklusenergie": {
                    "stateKey": "Elektrische Zyklusenergie",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.ElectricEnergy",
                    "label": "Elektrische Zyklusenergie",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh"
                },
                "Thermische Zyklusenergie": {
                    "stateKey": "Thermische Zyklusenergie",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.HeatEnergy",
                    "label": "Thermische Zyklusenergie",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "kWh"
                },
                "Zyklusqualität": {
                    "stateKey": "Zyklusqualität",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.Quality",
                    "label": "Zyklusqualität",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "%",
                    "iconStyle": {
                        "<1": {
                            "color": "grey"
                        },
                        "<50": {
                            "color": "red"
                        },
                        "<70": {
                            "color": "orange"
                        },
                        "<85": {
                            "color": "yellow"
                        },
                        "<95": {
                            "color": "green"
                        },
                        "default": {
                            "color": "lime"
                        }
                    }
                },
                "Letzter Zyklus": {
                    "stateKey": "Letzter Zyklus",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.LastCycle",
                    "label": "Letzter Zyklus",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Zyklus Historie": {
                    "stateKey": "Zyklus Historie",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.History",
                    "label": "Zyklus Historie",
                    "icon": "mdi:checkbox-blank-circle"
                }
            },
            "options": {}
        }
    },
    "events": {
        "key": "events",
        "enabled": true,
        "expectedStateCount": 16,
        "sourceModule": "10_NPS_DashboardData",
        "sourceVersion": "5.10.2",
        "allowConverter": false,
        "template": {
            "id": "nps_v2_events",
            "name": "NPS – Events V2",
            "icon": "mdi:timeline-clock-outline",
            "label": "",
            "function": "heating",
            "states": {
                "Aktueller Prozess": {
                    "stateKey": "Aktueller Prozess",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.Mode",
                    "label": "Aktueller Prozess",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zyklus aktiv": {
                    "stateKey": "Zyklus aktiv",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.Active",
                    "label": "Zyklus aktiv",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zyklustyp": {
                    "stateKey": "Zyklustyp",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Cycles.Type",
                    "label": "Zyklustyp",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Verdichter aktiv": {
                    "stateKey": "Verdichter aktiv",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Compressor.Active",
                    "label": "Verdichter aktiv",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zusatzheizung aktiv": {
                    "stateKey": "Zusatzheizung aktiv",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.AdditionalHeat.Active",
                    "label": "Zusatzheizung aktiv",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Enteisung aktiv": {
                    "stateKey": "Enteisung aktiv",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Defrost.Active",
                    "label": "Enteisung aktiv",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Ereignis": {
                    "stateKey": "Ereignis",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.LastEvent",
                    "label": "Ereignis",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Zeitpunkt": {
                    "stateKey": "Zeitpunkt",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.Timestamp",
                    "label": "Zeitpunkt",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Meldung": {
                    "stateKey": "Meldung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.LastMessage",
                    "label": "Meldung",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Kritikalität": {
                    "stateKey": "Kritikalität",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.Criticality",
                    "label": "Kritikalität",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Ereignishistorie": {
                    "stateKey": "Ereignishistorie",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.History",
                    "label": "Ereignishistorie",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Heizzyklen heute": {
                    "stateKey": "Heizzyklen heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.Today.HeatingCycles",
                    "label": "Heizzyklen heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Warmwasserzyklen heute": {
                    "stateKey": "Warmwasserzyklen heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.Today.WarmwaterCycles",
                    "label": "Warmwasserzyklen heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Abtauungen heute": {
                    "stateKey": "Abtauungen heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.Today.Defrosts",
                    "label": "Abtauungen heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Warnungen heute": {
                    "stateKey": "Warnungen heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.Today.Warnings",
                    "label": "Warnungen heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Fehler heute": {
                    "stateKey": "Fehler heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Events.Today.Errors",
                    "label": "Fehler heute",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                }
            },
            "options": {}
        }
    },
    "defrost": {
        "key": "defrost",
        "enabled": true,
        "expectedStateCount": 14,
        "sourceModule": "10_NPS_DashboardData + 05_NPS_DefrostMonitor",
        "sourceVersion": "5.10.2 / 1.1.2",
        "allowConverter": false,
        "template": {
            "id": "nps_v2_defrost",
            "name": "NPS – Defrost V2",
            "icon": "hvac",
            "label": "",
            "function": "heating",
            "states": {
                "Enteisungsstatus": {
                    "stateKey": "Enteisungsstatus",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.Status",
                    "label": "Enteisungsstatus",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Enteisung aktiv": {
                    "stateKey": "Enteisung aktiv",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Defrost.Active",
                    "label": "Enteisung aktiv",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Gestartete Enteisungen gesamt": {
                    "stateKey": "Gestartete Enteisungen gesamt",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Defrost.Count",
                    "label": "Gestartete Enteisungen gesamt",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Abgeschlossene Enteisungen gesamt": {
                    "stateKey": "Abgeschlossene Enteisungen gesamt",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.CompletedCount",
                    "label": "Abgeschlossene Enteisungen gesamt",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Aktuelle Enteisungsdauer": {
                    "stateKey": "Aktuelle Enteisungsdauer",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Defrost.Duration",
                    "label": "Aktuelle Enteisungsdauer",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Letzte Enteisungsdauer": {
                    "stateKey": "Letzte Enteisungsdauer",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Defrost.LastDuration",
                    "label": "Letzte Enteisungsdauer",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Gesamte Enteisungsdauer": {
                    "stateKey": "Gesamte Enteisungsdauer",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.TotalDurationMinutes",
                    "label": "Gesamte Enteisungsdauer",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Letzter Enteisungsbeginn": {
                    "stateKey": "Letzter Enteisungsbeginn",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Defrost.LastStart",
                    "label": "Letzter Enteisungsbeginn",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Letztes Enteisungsende": {
                    "stateKey": "Letztes Enteisungsende",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.LastEnd",
                    "label": "Letztes Enteisungsende",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Zeit seit letzter Enteisung": {
                    "stateKey": "Zeit seit letzter Enteisung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.TimeSinceLastDefrostMinutes",
                    "label": "Zeit seit letzter Enteisung",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Letzter Abstand zwischen Enteisungen": {
                    "stateKey": "Letzter Abstand zwischen Enteisungen",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.LastIntervalMinutes",
                    "label": "Letzter Abstand zwischen Enteisungen",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Mittlere Enteisungsdauer": {
                    "stateKey": "Mittlere Enteisungsdauer",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.AverageDurationMinutes",
                    "label": "Mittlere Enteisungsdauer",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Mittlerer Abstand zwischen Enteisungen": {
                    "stateKey": "Mittlerer Abstand zwischen Enteisungen",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.AverageIntervalMinutes",
                    "label": "Mittlerer Abstand zwischen Enteisungen",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle",
                    "unit": "min"
                },
                "Historie der letzten 20 Enteisungen": {
                    "stateKey": "Historie der letzten 20 Enteisungen",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DefrostMonitor.Defrost.History",
                    "label": "Historie der letzten 20 Enteisungen",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                }
            },
            "options": {}
        }
    },
    "performance": {
        "key": "performance",
        "enabled": true,
        "expectedStateCount": 15,
        "sourceModule": "10_NPS_DashboardData",
        "sourceVersion": "5.10.2",
        "allowConverter": true,
        "template": {
            "id": "nps_v2_performance",
            "name": "NPS – Performance V2",
            "icon": "mdi:checkbox-blank-circle",
            "label": "",
            "function": "heating",
            "states": {
                "Aktuelle elektrische Leistung": {
                    "stateKey": "Aktuelle elektrische Leistung",
                    "showState": true,
                    "label": "Aktuelle elektrische Leistung",
                    "state": "0_userdata.0.NPS.DashboardData.Electrical.CurrentPower",
                    "unit": "W",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Aktuelle Wärmeleistung": {
                    "stateKey": "Aktuelle Wärmeleistung",
                    "showState": true,
                    "label": "Aktuelle Wärmeleistung",
                    "unit": "kW",
                    "state": "0_userdata.0.NPS.DashboardData.Performance.ThermalPower",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Aktiver Zyklustyp": {
                    "stateKey": "Aktiver Zyklustyp",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.ActiveCycleType",
                    "label": "Aktiver Zyklustyp",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "COP aktuell": {
                    "stateKey": "COP aktuell",
                    "showState": true,
                    "label": "COP aktuell",
                    "state": "0_userdata.0.NPS.DashboardData.Performance.LiveCOP",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "iconStyle": {
                        "<0.1": {
                            "color": "grey"
                        },
                        "<2.2": {
                            "color": "red"
                        },
                        "<3.0": {
                            "color": "orange"
                        },
                        "<3.8": {
                            "color": "yellow"
                        },
                        "<4.5": {
                            "color": "green"
                        },
                        "default": {
                            "color": "lime"
                        }
                    }
                },
                "COP gesamt heute": {
                    "stateKey": "COP gesamt heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.COPTotal",
                    "label": "COP gesamt heute",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "iconStyle": {
                        "<0.1": {
                            "color": "grey"
                        },
                        "<2.2": {
                            "color": "red"
                        },
                        "<3.0": {
                            "color": "orange"
                        },
                        "<3.8": {
                            "color": "yellow"
                        },
                        "<4.5": {
                            "color": "green"
                        },
                        "default": {
                            "color": "lime"
                        }
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "COP Heizung heute": {
                    "stateKey": "COP Heizung heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.COPHeating",
                    "label": "COP Heizung heute",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "iconStyle": {
                        "<0.1": {
                            "color": "grey"
                        },
                        "<2.2": {
                            "color": "red"
                        },
                        "<3.0": {
                            "color": "orange"
                        },
                        "<3.8": {
                            "color": "yellow"
                        },
                        "<4.5": {
                            "color": "green"
                        },
                        "default": {
                            "color": "lime"
                        }
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "COP Warmwasser heute": {
                    "stateKey": "COP Warmwasser heute",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.COPWarmwater",
                    "label": "COP Warmwasser heute",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "iconStyle": {
                        "<0.1": {
                            "color": "grey"
                        },
                        "<2.2": {
                            "color": "red"
                        },
                        "<3.0": {
                            "color": "orange"
                        },
                        "<3.8": {
                            "color": "yellow"
                        },
                        "<4.5": {
                            "color": "green"
                        },
                        "default": {
                            "color": "lime"
                        }
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Verdichteranteil heute": {
                    "stateKey": "Verdichteranteil heute",
                    "showState": true,
                    "label": "Verdichteranteil heute",
                    "unit": "%",
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.ShareCompressor",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Zusatzheizung Anteil heute": {
                    "stateKey": "Zusatzheizung Anteil heute",
                    "showState": true,
                    "label": "Zusatzheizung Anteil heute",
                    "unit": "%",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "state": "0_userdata.0.NPS.DashboardData.Periods.Day.ShareZH"
                },
                "COP-Tabelle": {
                    "stateKey": "COP-Tabelle",
                    "showState": true,
                    "label": "COP-Tabelle",
                    "state": "0_userdata.0.NPS.DashboardData.Performance.PeriodComparisonJson",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "COP Gesamt gestern": {
                    "stateKey": "COP Gesamt gestern",
                    "showState": true,
                    "label": "COP Gesamt gestern",
                    "state": "0_userdata.0.NPS.DashboardData.Statistics.COPGesamt.Yesterday",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "COP Warmwasser gestern": {
                    "stateKey": "COP Warmwasser gestern",
                    "showState": true,
                    "label": "COP Warmwasser gestern",
                    "state": "0_userdata.0.NPS.DashboardData.Statistics.COPWarmwasser.Yesterday",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "COP Heizung gestern": {
                    "stateKey": "COP Heizung gestern",
                    "showState": true,
                    "label": "COP Heizung gestern",
                    "state": "0_userdata.0.NPS.DashboardData.Statistics.COPHeizung.Yesterday",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Verdichteranteil gestern": {
                    "stateKey": "Verdichteranteil gestern",
                    "showState": true,
                    "label": "Verdichteranteil gestern",
                    "state": "0_userdata.0.NPS.DashboardData.Statistics.AnteilVerdichter.Yesterday",
                    "unit": "%",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Zusatzheizungsanteil gestern": {
                    "stateKey": "Zusatzheizungsanteil gestern",
                    "showState": true,
                    "unit": "Zusatzheizungsanteil gestern",
                    "state": "0_userdata.0.NPS.DashboardData.Statistics.AnteilZusatzheizung.Yesterday",
                    "label": "Zusatzheizungsanteil gestern",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    },
                    "icon": "mdi:checkbox-blank-circle"
                }
            },
            "options": {}
        }
    },
    "system": {
        "key": "system",
        "enabled": true,
        "expectedStateCount": 17,
        "sourceModule": "10_NPS_DashboardData + 07_NPS_StateMachine",
        "sourceVersion": "5.10.2 / 1.2.0",
        "allowConverter": true,
        "template": {
            "id": "nps_v2_system",
            "name": "NPS – System V2",
            "icon": "mdi:information-outline",
            "label": "",
            "function": "heating",
            "states": {
                "NPS Health": {
                    "stateKey": "NPS Health",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.HealthPercent",
                    "label": "NPS Health",
                    "unit": "%",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "<60": {
                            "color": "red",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "<80": {
                            "color": "orange",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "<90": {
                            "color": "yellow",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "<98": {
                            "color": "green",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "default": {
                            "color": "lime",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        }
                    },
                    "iconStyle": {
                        "<60": {
                            "color": "red"
                        },
                        "<80": {
                            "color": "orange"
                        },
                        "<90": {
                            "color": "yellow"
                        },
                        "<98": {
                            "color": "green"
                        },
                        "default": {
                            "color": "lime"
                        }
                    }
                },
                "NPS Health-Zustand": {
                    "stateKey": "NPS Health-Zustand",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.HealthState",
                    "label": "NPS Health-Zustand",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "NPS Health-Meldung": {
                    "stateKey": "NPS Health-Meldung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.HealthMessage",
                    "label": "NPS Health-Meldung",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Health-Berechnungsdetails": {
                    "stateKey": "Health-Berechnungsdetails",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.HealthDetails",
                    "label": "Health-Berechnungsdetails",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Health-Prüfkriterien": {
                    "stateKey": "Health-Prüfkriterien",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.HealthTable",
                    "label": "Health-Prüfkriterien",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Technischer Anlagenzustand": {
                    "stateKey": "Technischer Anlagenzustand",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.TechnicalState",
                    "label": "Technischer Anlagenzustand",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "font-size": "20px",
                        "fontWeight": "bold"
                    }
                },
                "Technische Zustandsmeldung": {
                    "stateKey": "Technische Zustandsmeldung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.TechnicalMessage",
                    "label": "Technische Zustandsmeldung",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Alarm": {
                    "stateKey": "Alarm",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.AlarmActive",
                    "label": "Alarm",
                    "icon": "mdi:checkbox-blank-circle",
                    "display": {
                        "true": "aktiv",
                        "false": "kein Alarm",
                        "default": "unbekannt"
                    },
                    "stateStyle": {
                        "true": {
                            "color": "red",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "false": {
                            "color": "#78909C",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "default": {
                            "color": "grey",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        }
                    },
                    "iconStyle": {
                        "true": {
                            "color": "red"
                        },
                        "false": {
                            "color": "#78909C"
                        },
                        "default": {
                            "color": "grey"
                        }
                    }
                },
                "Alarmnummer": {
                    "stateKey": "Alarmnummer",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.Overview.AlarmNumber",
                    "label": "Alarmnummer",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Modulstatus": {
                    "stateKey": "Modulstatus",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.Status",
                    "label": "Modulstatus",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "OK": {
                            "color": "lime",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "default": {
                            "color": "red",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        }
                    },
                    "iconStyle": {
                        "OK": {
                            "color": "lime"
                        },
                        "default": {
                            "color": "red"
                        }
                    }
                },
                "Dashboarddaten gültig": {
                    "stateKey": "Dashboarddaten gültig",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.DataValid",
                    "label": "Dashboarddaten gültig",
                    "icon": "mdi:checkbox-blank-circle",
                    "display": {
                        "true": "gültig",
                        "false": "ungültig",
                        "default": "unbekannt"
                    },
                    "stateStyle": {
                        "true": {
                            "color": "lime",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "false": {
                            "color": "red",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "default": {
                            "color": "grey",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        }
                    },
                    "iconStyle": {
                        "true": {
                            "color": "lime"
                        },
                        "false": {
                            "color": "red"
                        },
                        "default": {
                            "color": "grey"
                        }
                    }
                },
                "Letzte Aktualisierung": {
                    "stateKey": "Letzte Aktualisierung",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.LastUpdate",
                    "label": "Letzte Aktualisierung",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Modulversion": {
                    "stateKey": "Modulversion",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.Version",
                    "label": "Modulversion",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "NPS-Strukturversion": {
                    "stateKey": "NPS-Strukturversion",
                    "showState": true,
                    "state": "0_userdata.0.NPS.StateMachine.System.Version",
                    "label": "StateMachine-Version",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Dashboard-Strukturversion": {
                    "stateKey": "Dashboard-Strukturversion",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.StructureVersion",
                    "label": "Dashboard-Strukturversion",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Anzahl Aktualisierungen": {
                    "stateKey": "Anzahl Aktualisierungen",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.UpdateCounter",
                    "label": "Anzahl Aktualisierungen",
                    "icon": "mdi:checkbox-blank-circle"
                },
                "Anzahl Fehler": {
                    "stateKey": "Anzahl Fehler",
                    "showState": true,
                    "state": "0_userdata.0.NPS.DashboardData.System.ErrorCounter",
                    "label": "Anzahl Fehler",
                    "icon": "mdi:checkbox-blank-circle",
                    "stateStyle": {
                        "0": {
                            "color": "lime",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        },
                        "default": {
                            "color": "red",
                            "font-size": "20px",
                            "fontWeight": "bold"
                        }
                    },
                    "iconStyle": {
                        "0": {
                            "color": "lime"
                        },
                        "default": {
                            "color": "red"
                        }
                    }
                }
            },
            "options": {}
        }
    }
};

    function info(message) {
        log(LOG_PREFIX + ' ' + message, 'info');
    }

    function warn(message) {
        log(LOG_PREFIX + ' ' + message, 'warn');
    }

    function errorLog(message) {
        log(LOG_PREFIX + ' ' + message, 'error');
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    async function ensureChannel(id, name) {
        if (existsObject(id)) return;

        await setObjectAsync(id, {
            type: 'channel',
            common: { name: name },
            native: {}
        });
    }

    async function ensureStringState(id, name) {
        if (existsObject(id)) return;

        await createStateAsync(
            id,
            '',
            false,
            {
                name: name,
                type: 'string',
                role: 'text',
                read: true,
                write: true,
                def: ''
            }
        );
    }

    async function ensureHelperObjects() {
        await ensureChannel(
            '0_userdata.0.NPS.JarvisImporter',
            'NPS Jarvis Importer'
        );

        await ensureStringState(
            CONFIG.versionState,
            'Unified Importer - Version'
        );

        await ensureStringState(
            CONFIG.lastRunState,
            'Unified Importer - letzter Lauf'
        );

        await ensureStringState(
            CONFIG.lastResultState,
            'Unified Importer - letztes Ergebnis'
        );

        await ensureStringState(
            CONFIG.importedDevicesState,
            'Unified Importer - importierte Geräte'
        );

        await ensureStringState(
            CONFIG.backupState,
            'Unified Importer - Backup jarvis.0.devices'
        );

        await ensureStringState(
            CONFIG.backupTimestampState,
            'Unified Importer - Backup-Zeitpunkt'
        );
    }

    async function writeHelperState(id, value) {
        await setStateAsync(id, value, true);
    }

    function validateJarvisConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Jarvis-Konfiguration ist kein Objekt.');
        }

        if (
            !config.devices ||
            typeof config.devices !== 'object' ||
            Array.isArray(config.devices)
        ) {
            throw new Error(
                'Jarvis-Konfiguration enthält kein gültiges devices-Objekt.'
            );
        }
    }

    function isAllowedExistingTarget(device, definition) {
        if (!device) return true;
        if (!device.attributes) return false;

        const attributes = device.attributes;

        if (
            attributes.npsManaged !== true ||
            attributes.npsGeneration !== 'v2'
        ) {
            return false;
        }

        if (attributes.npsImporter === definition.key) {
            return true;
        }

        if (
            definition.allowConverter === true &&
            attributes.npsConverter === definition.key
        ) {
            return true;
        }

        // Historischer Defrost-Importer hatte noch kein npsImporter-Feld.
        if (
            definition.key === 'defrost' &&
            attributes.npsModule === '05_NPS_DefrostMonitor'
        ) {
            return true;
        }

        return false;
    }


    const NPS_MANAGED_STATE_FIELDS = Object.freeze([
        'stateKey',
        'state',
        'label',
        'unit'
    ]);

    /*
     * Feste NPS-Messfarben.
     * Status-/Ampelfarben werden nicht pauschal überschrieben, weil sie
     * wertabhängige Regeln enthalten können. Für bekannte Messgrößen wird
     * iconStyle.default.color geprüft und bei Abweichung korrigiert.
     */
    const NPS_FIXED_COLORS = Object.freeze({
        'Außentemperatur': '#42A5F5',
        'Vorlauftemperatur': '#EF6C3E',
        'Vorlauf Soll': '#FBC02D',
        'Rücklauftemperatur': '#AB47BC',
        'Warmwasser oben (BT7)': '#EC407A',
        'Warmwasserbereitung (BT6)': '#FF9800',
        'Verdichterfrequenz': '#26A69A',
        'Elektrische Leistung': '#5C6BC0',
        'Aktuelle elektrische Leistung': '#5C6BC0',
        'Wärmeleistung': '#FF7043',
        'Aktuelle Wärmeleistung': '#FF7043',
        'COP gesamt heute': '#66BB6A',
        'COP Heizung heute': '#43A047',
        'COP Warmwasser heute': '#26A69A',
        'Verdichteranteil': '#7CB342',
        'Verdichteranteil heute': '#7CB342',
        'Zusatzheizungsanteil': '#E53935',
        'Zusatzheizung Anteil heute': '#E53935',
        'Aktuelle Zyklusdauer': '#42A5F5',
        'Zyklusdauer': '#42A5F5',
        'Zyklusqualität': '#66BB6A'
    });

    const STATUS_ACTIVE_COLOR = '#C45A32';

    function isJsonLikeTemplateState(templateState) {
        /*
         * Die bisherigen NPS-Templates kennzeichnen JSON-Tabellen dadurch,
         * dass bewusst kein stateStyle gesetzt wird.
         */
        return !Object.prototype.hasOwnProperty.call(
            templateState,
            'stateStyle'
        );
    }

    function copyPreservedState(existingState, templateState) {
        const preserved =
            existingState && typeof existingState === 'object'
                ? clone(existingState)
                : {};

        /*
         * Nur die vier technischen Felder werden aus dem Template geführt.
         * Alle anderen vorhandenen Jarvis-Einstellungen bleiben erhalten.
         */
        NPS_MANAGED_STATE_FIELDS.forEach(function (field) {
            if (Object.prototype.hasOwnProperty.call(templateState, field)) {
                preserved[field] = clone(templateState[field]);
            } else {
                delete preserved[field];
            }
        });

        /*
         * Projektweite Icon-Regel ist die einzige zusätzliche NPS-Vorgabe.
         */
        preserved.icon = 'mdi:checkbox-blank-circle';

        /*
         * Bei neuen States fehlen Darstellungsattribute im bestehenden Gerät.
         * Dann übernehmen wir die Template-Defaults als Startwert.
         */
        if (!existingState) {
            Object.keys(templateState).forEach(function (key) {
                if (
                    !NPS_MANAGED_STATE_FIELDS.includes(key) &&
                    key !== 'icon'
                ) {
                    preserved[key] = clone(templateState[key]);
                }
            });
            preserved.icon = 'mdi:checkbox-blank-circle';
        }

        /*
         * JSON-Regel: kein stateStyle.
         */
        if (isJsonLikeTemplateState(templateState)) {
            delete preserved.stateStyle;
        }

        return preserved;
    }

    function findExistingState(existingTarget, templateState) {
        if (
            !existingTarget ||
            !existingTarget.states ||
            typeof existingTarget.states !== 'object'
        ) {
            return null;
        }

        if (
            templateState.stateKey &&
            existingTarget.states[templateState.stateKey]
        ) {
            return existingTarget.states[templateState.stateKey];
        }

        const states = Object.values(existingTarget.states);

        for (const state of states) {
            if (
                state &&
                state.state === templateState.state
            ) {
                return state;
            }
        }

        return null;
    }

    function ensureDefaultIconColor(state, expectedColor) {
        if (!state.iconStyle || typeof state.iconStyle !== 'object') {
            state.iconStyle = {};
        }

        if (
            !state.iconStyle.default ||
            typeof state.iconStyle.default !== 'object'
        ) {
            state.iconStyle.default = {};
        }

        const previous =
            state.iconStyle.default.color;

        state.iconStyle.default.color = expectedColor;

        return previous !== expectedColor;
    }

    function auditAndCorrectColors(device, definition) {
        const corrections = [];
        const warnings = [];

        Object.keys(device.states).forEach(function (stateKey) {
            const state = device.states[stateKey];
            const expected = NPS_FIXED_COLORS[stateKey];

            if (expected) {
                if (ensureDefaultIconColor(state, expected)) {
                    corrections.push(
                        definition.template.id + ' / ' +
                        stateKey + ' -> ' + expected
                    );
                }
            }

            /*
             * #C45A32 ist ausschließlich für aktive Statusanzeigen reserviert.
             * Bei festen Messfarben darf diese Farbe daher nie auftauchen.
             */
            if (
                expected &&
                state.iconStyle &&
                JSON.stringify(state.iconStyle).includes(STATUS_ACTIVE_COLOR) &&
                expected !== STATUS_ACTIVE_COLOR
            ) {
                warnings.push(
                    definition.template.id + ' / ' + stateKey +
                    ': aktive Statusfarbe in Messwert-Stil gefunden'
                );
            }
        });

        return {
            corrections: corrections,
            warnings: warnings
        };
    }

    function buildDevice(definition, existingTarget) {
        const template = clone(definition.template);

        /*
         * Geräteebene ebenfalls möglichst bewahren. Nur Kernidentität und
         * NPS-Verwaltungsmetadaten werden aktualisiert.
         */
        const device =
            existingTarget && typeof existingTarget === 'object'
                ? clone(existingTarget)
                : clone(template);

        device.id = template.id;

        if (!existingTarget) {
            device.name = template.name;
            device.icon = template.icon;
            device.label = template.label;
            device.function = template.function;
            device.options = clone(template.options || {});
        }

        device.states = {};

        Object.keys(template.states).forEach(function (stateKey) {
            const templateState = template.states[stateKey];
            const existingState =
                findExistingState(existingTarget, templateState);

            device.states[stateKey] =
                copyPreservedState(existingState, templateState);
        });

        const created =
            existingTarget &&
            existingTarget.attributes &&
            existingTarget.attributes._created
                ? existingTarget.attributes._created
                : Date.now();

        device.attributes = Object.assign(
            {},
            existingTarget && existingTarget.attributes
                ? clone(existingTarget.attributes)
                : {},
            {
                npsManaged: true,
                npsGeneration: 'v2',
                npsImporter: definition.key,
                npsUnifiedImporter: true,
                npsSourceModule: definition.sourceModule,
                npsSourceModuleVersion: definition.sourceVersion,
                npsImporterVersion: VERSION,
                _created: created,
                _updated: Date.now()
            }
        );

        device.revision =
            'npsv2-' + definition.key + '-unified-120';

        const colorAudit =
            auditAndCorrectColors(device, definition);

        colorAudit.corrections.forEach(function (message) {
            info('Farbschema korrigiert: ' + message);
        });

        colorAudit.warnings.forEach(function (message) {
            warn('Farbschema-Hinweis: ' + message);
        });

        return device;
    }

    function validateDevice(device, definition) {
        if (!device || !device.states) {
            throw new Error(
                "Zielgerät '" + definition.template.id + "' ist ungültig."
            );
        }

        const states = Object.values(device.states);

        if (states.length !== definition.expectedStateCount) {
            throw new Error(
                "Zielgerät '" + definition.template.id + "' enthält " +
                states.length + ' States statt ' +
                definition.expectedStateCount + '.'
            );
        }

        states.forEach(function (state) {
            if (!state.state || !state.stateKey) {
                throw new Error(
                    "Zielgerät '" + definition.template.id +
                    "' enthält einen State ohne state/stateKey."
                );
            }

            if (state.icon !== 'mdi:checkbox-blank-circle') {
                throw new Error(
                    "Zielgerät '" + definition.template.id +
                    "' verletzt die NPS-Icon-Regel."
                );
            }
        });
    }

    async function validateSourceStatesExist(device, definition) {
        const missing = [];

        for (const state of Object.values(device.states)) {
            if (!existsObject(state.state)) {
                missing.push(state.state);
            }
        }

        if (missing.length > 0) {
            throw new Error(
                "Zielgerät '" + definition.template.id +
                "' hat fehlende NPS-Quelldatenpunkte: " +
                missing.join(', ')
            );
        }
    }

    function makeSignature(oldSignature) {
        let signature =
            Date.now() * 1000 +
            Math.floor(Math.random() * 1000);

        if (signature === oldSignature) {
            signature += 1;
        }

        return signature;
    }

    function compareUntouchedDevices(beforeDevices, afterDevices, targetIds) {
        const allowed = new Set(targetIds);

        Object.keys(beforeDevices).forEach(function (id) {
            if (allowed.has(id)) return;

            if (!Object.prototype.hasOwnProperty.call(afterDevices, id)) {
                throw new Error(
                    "Sicherheitsprüfung: Gerät '" + id +
                    "' fehlt nach Import."
                );
            }

            if (
                JSON.stringify(beforeDevices[id]) !==
                JSON.stringify(afterDevices[id])
            ) {
                throw new Error(
                    "Sicherheitsprüfung: Gerät '" + id +
                    "' wurde verändert."
                );
            }
        });

        Object.keys(afterDevices).forEach(function (id) {
            if (allowed.has(id)) return;

            if (!Object.prototype.hasOwnProperty.call(beforeDevices, id)) {
                throw new Error(
                    "Sicherheitsprüfung: unerwartetes neues Gerät '" +
                    id + "'."
                );
            }
        });
    }

    async function main() {
        await ensureHelperObjects();

        await writeHelperState(CONFIG.versionState, VERSION);
        await writeHelperState(
            CONFIG.lastRunState,
            new Date().toISOString()
        );

        info(
            'Version ' + VERSION + ' | Build ' + BUILD + ' gestartet'
        );

        const activeDefinitions =
            Object.values(DEFINITIONS).filter(function (definition) {
                return definition.enabled === true;
            });

        if (activeDefinitions.length === 0) {
            throw new Error('Keine Geräte zum Import aktiviert.');
        }

        info(
            activeDefinitions.length +
            ' NPS-v2-Geräte für den Import aktiviert.'
        );

        const jarvisState =
            await getStateAsync(CONFIG.jarvisDevicesState);

        if (
            !jarvisState ||
            typeof jarvisState.val !== 'string' ||
            !jarvisState.val.trim()
        ) {
            throw new Error(
                "State '" + CONFIG.jarvisDevicesState +
                "' ist leer oder nicht lesbar."
            );
        }

        const rawBefore = jarvisState.val;
        let before;

        try {
            before = JSON.parse(rawBefore);
        } catch (error) {
            throw new Error(
                "JSON in '" + CONFIG.jarvisDevicesState +
                "' ist ungültig: " + error.message
            );
        }

        validateJarvisConfig(before);

        const after = clone(before);
        const targetIds = [];
        const actions = [];
        const builtDevices = [];

        for (const definition of activeDefinitions) {
            const targetId = definition.template.id;
            const existingTarget = before.devices[targetId];

            if (
                existingTarget &&
                !isAllowedExistingTarget(existingTarget, definition)
            ) {
                throw new Error(
                    "Gerät '" + targetId +
                    "' existiert bereits, ist aber nicht eindeutig als " +
                    "passendes NPS-v2-Gerät für '" +
                    definition.key + "' markiert."
                );
            }

            const device =
                buildDevice(definition, existingTarget);

            validateDevice(device, definition);
            await validateSourceStatesExist(device, definition);

            after.devices[targetId] = device;
            targetIds.push(targetId);
            builtDevices.push({
                definition: definition,
                device: device
            });

            actions.push(
                targetId + ': ' +
                (existingTarget ? 'aktualisiert' : 'neu angelegt') +
                ' (' + definition.expectedStateCount + ' States)'
            );
        }

        after.signature =
            makeSignature(before.signature);

        compareUntouchedDevices(
            before.devices,
            after.devices,
            targetIds
        );

        info(
            'Sicherheitsprüfung OK: alle nicht verwalteten Jarvis-Geräte ' +
            'bleiben unverändert.'
        );

        if (CONFIG.dryRun) {
            const result =
                'DRY-RUN OK | ' + actions.join(' | ');

            info(result);
            await writeHelperState(
                CONFIG.importedDevicesState,
                targetIds.join(', ')
            );
            await writeHelperState(
                CONFIG.lastResultState,
                result
            );
            return;
        }

        await writeHelperState(
            CONFIG.backupState,
            rawBefore
        );

        await writeHelperState(
            CONFIG.backupTimestampState,
            new Date().toISOString()
        );

        info(
            'Backup erstellt: ' + CONFIG.backupState
        );

        // Schutz gegen parallele Änderungen zwischen Lesen und Schreiben.
        const current =
            await getStateAsync(CONFIG.jarvisDevicesState);

        if (
            !current ||
            current.val !== rawBefore
        ) {
            throw new Error(
                'jarvis.0.devices wurde während des Imports verändert. ' +
                'Abbruch ohne Schreibzugriff.'
            );
        }

        await setStateAsync(
            CONFIG.jarvisDevicesState,
            JSON.stringify(after),
            true
        );

        const verifyState =
            await getStateAsync(CONFIG.jarvisDevicesState);

        if (
            !verifyState ||
            typeof verifyState.val !== 'string'
        ) {
            throw new Error(
                'Rückleseprüfung fehlgeschlagen.'
            );
        }

        let verify;

        try {
            verify = JSON.parse(verifyState.val);
        } catch (error) {
            throw new Error(
                'Rückleseprüfung: ungültiges JSON: ' +
                error.message
            );
        }

        validateJarvisConfig(verify);

        for (const item of builtDevices) {
            validateDevice(
                verify.devices[item.definition.template.id],
                item.definition
            );
        }

        compareUntouchedDevices(
            before.devices,
            verify.devices,
            targetIds
        );

        const result =
            'IMPORT OK | ' + actions.join(' | ') +
            ' | alle anderen Geräte unverändert';

        await writeHelperState(
            CONFIG.importedDevicesState,
            targetIds.join(', ')
        );

        await writeHelperState(
            CONFIG.lastResultState,
            result
        );

        info(result);
    }

    main().catch(async function (error) {
        const text =
            'ABBRUCH: ' + error.message;

        errorLog(text);

        try {
            await ensureHelperObjects();
            await writeHelperState(
                CONFIG.lastResultState,
                text
            );
        } catch (secondaryError) {
            errorLog(
                'Zusätzlich konnte LastResult nicht geschrieben werden: ' +
                secondaryError.message
            );
        }
    });
})();
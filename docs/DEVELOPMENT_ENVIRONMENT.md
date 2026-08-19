# Development and Test Environment

This document records the reference environment used to develop and test the
**NIBE Performance Suite (NPS) V1.0.0** baseline.

These versions describe the tested reference environment. They are **not**
minimum-version requirements unless explicitly stated otherwise.

## Hardware and runtime

| Component | Version / platform |
|---|---|
| Platform | Raspberry Pi 4 / arm64 |
| Node.js | `22.23.1` |
| npm | `10.9.8` |
| ioBroker js-controller | `7.2.2` |

## ioBroker adapters

| Adapter | Version | Role in NPS |
|---|---:|---|
| Admin | `7.8.23` | ioBroker administration |
| JavaScript | `9.0.18` | NPS script runtime |
| InfluxDB | `4.0.2` | Time-series storage (`influxdb.0` / `influxdb.1`) |
| Jarvis | `3.1.8` | NPS visualization |
| Modbus | `8.0.3` | NIBE data acquisition |
| Statistics | `5.0.0` | Statistical / delta processing |
| Matrix-org | `1.2.2` | Optional notification integration |

## NIBE firmware

| Device | Firmware |
|---|---:|
| NIBE S2125 | `3.3.1` |
| NIBE VVM S500 | `4.12.6` |

## Matrix integration

The `matrix-org` adapter is an **optional integration dependency**.

NPS core monitoring and analysis do not require Matrix. The
`09_NPS_NotificationBridge` module can use Matrix as a notification channel
when the integration is configured and enabled.

## Compatibility statement

NPS V1.0.0 was developed and tested with the versions listed above.

Older or newer versions may work, but compatibility outside this reference
environment has not been established by this baseline documentation.

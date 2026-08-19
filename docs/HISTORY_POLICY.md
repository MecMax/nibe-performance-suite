# NPS V1 History Policy

## Adapter assignment

```text
influxdb.0 → completed long-term daily values
influxdb.1 → live, short-term, diagnostic and cycle values
```

## Examples

### `influxdb.1`

- live temperatures
- compressor frequency
- defrost active/status curves
- cycle COP
- cycle duration
- other short-term diagnostic values

### `influxdb.0`

- compressor starts per completed day
- compressor runtime per completed day
- energy `*PerDay` values
- completed daily performance values

The type of value determines the adapter. A long graph range does not automatically imply `influxdb.0`.

## Complete state matrix

See [`INFLUXDB_HISTORY.md`](INFLUXDB_HISTORY.md) for the concrete V1 state assignments.

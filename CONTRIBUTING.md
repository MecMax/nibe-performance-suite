# Contributing

## Scope

NPS V1 is a frozen baseline.

Before changing code, classify the change as one of:

1. Bugfix V1.x
2. Configuration change
3. V2 extension

## Pull-request checklist

- Public API remains backward-compatible for V1 bugfixes.
- No new Jarvis dependency on internal module states.
- History adapter follows `docs/HISTORY_POLICY.md`.
- Colors follow `docs/COLOR_SCHEME.md`.
- Labels and units follow `docs/NAMING_FORMATTING.md`.
- Script header version and changelog are updated when behavior changes.
- Existing Jarvis styles are not overwritten unintentionally.
- JSON-table states do not receive forced `stateStyle`.

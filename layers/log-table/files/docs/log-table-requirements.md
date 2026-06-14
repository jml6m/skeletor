# Log Table Requirements

Guidance for CLI table output: fit the viewport, truncate with an ellipsis, and measure display width (not string length).

## Terminal width resolution (priority order)

1. Explicit override (`settings.terminalWidth`, tests, or `LOG_TABLE_WIDTH` env)
2. `process.stdout.columns` when stdout is a TTY
3. `$COLUMNS` environment variable
4. Config default (`defaultTerminalWidth` in `src/config/logTable.config.*`)

Clamp to `minTerminalWidth` … `maxTerminalWidth`.

## Display width vs string length

Use `string-width` (or language equivalents: `wcwidth`, `runewidth`, `unicode-width`):

- Strip ANSI sequences before measuring.
- Pad and truncate on display width, not `.length`.
- Append `…` when truncating — never silently clip borders.

## Column schema

| Field | Purpose |
| ----- | ------- |
| `minWidth` | Floor from header or smallest expected value |
| `maxWidth` | Ceiling — default ~48 for free text |
| `weight` | Flex share of slack; `0` = fixed column |

## JSON output mode

`--json` (or equivalent) must return complete, untruncated data. Truncation is presentation-only.

## Anti-patterns

- Hardcoded `colWidths` that exceed common terminals
- Using `.length` for emoji/CJK cells
- Putting unbounded URLs in table cells (use an ID column + inspect command)
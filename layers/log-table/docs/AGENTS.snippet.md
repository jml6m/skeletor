Print CLI tables with `printLogTable` / `buildLogTable` from `src/utils/logTable`. Tables fit the terminal:

- **Width**: `settings.terminalWidth` when set, else `process.stdout.columns` on a TTY, else `$COLUMNS`, else
  `defaultTerminalWidth` from `src/config/logTable.config`; clamped to `minTerminalWidth`–`maxTerminalWidth`.
- **Display width, not `.length`**: measure with `string-width` (ANSI stripped, emoji and CJK counted correctly),
  and end truncated cells with `…`. Never hardcode `colWidths` or let a row clip the table border.
- **Columns** take `minWidth`, `maxWidth` (capped by `maxCellWidth`, 48) and `weight`, the column's share of
  spare width; `weight: 0` keeps it fixed.
- **`--json`**: a command that prints a table also offers `--json` with complete, untruncated data. Truncation is
  presentation only; never store truncated strings.
- Keep unbounded values such as URLs out of cells: show an ID column and a command that prints the full record.

export interface LogTableSettings {
  minTerminalWidth: number;
  defaultTerminalWidth: number;
  maxTerminalWidth: number;
  maxCellWidth: number;
  minCellWidth: number;
  /** Explicit width override; otherwise stdout.columns, then $COLUMNS, then defaultTerminalWidth. */
  terminalWidth?: number;
}

export const DEFAULT_LOG_TABLE_SETTINGS: LogTableSettings = {
  minTerminalWidth: 60,
  defaultTerminalWidth: 100,
  maxTerminalWidth: 200,
  maxCellWidth: 48,
  minCellWidth: 4,
};

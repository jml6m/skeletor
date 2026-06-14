const Table = require('cli-table3');
const stringWidth = require('string-width');
const { DEFAULT_LOG_TABLE_SETTINGS } = require('../config/logTable.config.js');

const CLI_TABLE_HORIZONTAL_PADDING = 2;

function resolveTerminalWidth(settings = {}) {
  const cfg = { ...DEFAULT_LOG_TABLE_SETTINGS, ...settings };

  if (Number.isFinite(cfg.terminalWidth) && cfg.terminalWidth > 0) {
    return clampTerminalWidth(cfg.terminalWidth, cfg);
  }

  const envColumns = Number.parseInt(process.env.COLUMNS, 10);
  const stdoutColumns = process.stdout?.isTTY ? process.stdout.columns : null;
  const detected = stdoutColumns || (Number.isFinite(envColumns) ? envColumns : null) || cfg.defaultTerminalWidth;

  return clampTerminalWidth(detected, cfg);
}

function clampTerminalWidth(width, cfg) {
  return Math.max(cfg.minTerminalWidth, Math.min(width, cfg.maxTerminalWidth));
}

function cellDisplayWidth(value) {
  if (value == null) return 0;
  return stringWidth(String(value));
}

function truncateCell(value, maxWidth) {
  const str = value == null ? '' : String(value);
  if (maxWidth <= 0) return '';
  if (cellDisplayWidth(str) <= maxWidth) return str;
  if (maxWidth === 1) return '…';

  let built = '';
  for (const char of str) {
    const candidate = built + char;
    if (cellDisplayWidth(candidate + '…') > maxWidth) break;
    built = candidate;
  }
  return `${built}…`;
}

function tableFrameOverhead(columnCount) {
  return columnCount + 1;
}

function toColWidth(contentWidth) {
  return contentWidth + CLI_TABLE_HORIZONTAL_PADDING;
}

function computeColumnWidths(columns, rows, terminalWidth, settings = {}) {
  const cfg = { ...DEFAULT_LOG_TABLE_SETTINGS, ...settings };
  const globalMax = cfg.maxCellWidth;
  const globalMin = cfg.minCellWidth;
  const colWidthBudget = terminalWidth - tableFrameOverhead(columns.length);
  const budget = Math.max(
    columns.reduce((sum) => sum + globalMin, 0),
    colWidthBudget - columns.length * CLI_TABLE_HORIZONTAL_PADDING,
  );

  const specs = columns.map((col) => {
    const headerWidth = cellDisplayWidth(col.header);
    const contentWidth = rows.reduce((max, row) => Math.max(max, cellDisplayWidth(row[col.key])), headerWidth);
    const minWidth = Math.max(globalMin, col.minWidth ?? Math.min(contentWidth, headerWidth));
    const maxWidth = Math.min(globalMax, col.maxWidth ?? globalMax, Math.max(minWidth, contentWidth));
    const ideal = Math.max(minWidth, Math.min(maxWidth, contentWidth));

    return {
      key: col.key,
      minWidth,
      maxWidth,
      ideal,
      weight: col.weight == null ? 1 : col.weight,
      fixed: col.weight === 0,
    };
  });

  const widths = Object.fromEntries(specs.map((s) => [s.key, s.minWidth]));
  const idealSum = specs.reduce((sum, s) => sum + s.ideal, 0);

  if (idealSum <= budget) {
    for (const spec of specs) widths[spec.key] = spec.ideal;
    let slack = budget - idealSum;
    const growable = specs.filter((s) => !s.fixed);
    while (slack > 0 && growable.length > 0) {
      const totalWeight = growable.reduce((sum, s) => sum + s.weight, 0);
      let consumed = 0;
      for (const spec of growable) {
        const share = Math.floor((slack * spec.weight) / totalWeight);
        const room = spec.maxWidth - widths[spec.key];
        const add = Math.min(room, share);
        widths[spec.key] += add;
        consumed += add;
      }
      slack -= consumed;
      if (consumed === 0) break;
    }
    return widths;
  }

  let remaining = budget - specs.reduce((sum, s) => sum + s.minWidth, 0);
  const sorted = [...specs.filter((s) => !s.fixed)].sort((a, b) => b.weight - a.weight || b.ideal - a.ideal);

  for (const spec of sorted) {
    const extra = Math.min(spec.ideal - spec.minWidth, remaining);
    widths[spec.key] += extra;
    remaining -= extra;
    if (remaining <= 0) break;
  }

  return widths;
}

function buildLogTable(columns, rows, options = {}) {
  const settings = options.settings || {};
  const terminalWidth = resolveTerminalWidth(settings);
  const contentWidths = computeColumnWidths(columns, rows, terminalWidth, settings);

  const table = new Table({
    head: columns.map((col) => truncateCell(col.header, contentWidths[col.key])),
    colWidths: columns.map((col) => toColWidth(contentWidths[col.key])),
    wordWrap: false,
    style: { head: ['cyan'], ...(options.style || {}) },
    ...(options.tableOptions || {}),
  });

  rows.forEach((row) => {
    table.push(columns.map((col) => truncateCell(row[col.key], contentWidths[col.key])));
  });

  return table.toString();
}

function printLogTable(columns, rows, options = {}) {
  const output = buildLogTable(columns, rows, options);
  if (output) console.log(output);
  return output;
}

module.exports = {
  DEFAULT_LOG_TABLE_SETTINGS,
  CLI_TABLE_HORIZONTAL_PADDING,
  resolveTerminalWidth,
  cellDisplayWidth,
  truncateCell,
  computeColumnWidths,
  buildLogTable,
  printLogTable,
};
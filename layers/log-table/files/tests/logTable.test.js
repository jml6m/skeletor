const {
  resolveTerminalWidth,
  truncateCell,
  computeColumnWidths,
  buildLogTable,
  cellDisplayWidth,
} = require('../src/utils/logTable.js');

describe('logTable', () => {
  test('resolveTerminalWidth honors explicit override', () => {
    expect(resolveTerminalWidth({ terminalWidth: 88 })).toBe(88);
  });

  test('resolveTerminalWidth clamps to configured bounds', () => {
    expect(resolveTerminalWidth({ terminalWidth: 10, minTerminalWidth: 60, maxTerminalWidth: 120 })).toBe(60);
    expect(resolveTerminalWidth({ terminalWidth: 500, minTerminalWidth: 60, maxTerminalWidth: 120 })).toBe(120);
  });

  test('truncateCell respects display width and adds ellipsis', () => {
    const truncated = truncateCell('ineligible_default_profile', 12);
    expect(cellDisplayWidth(truncated)).toBeLessThanOrEqual(12);
    expect(truncated.endsWith('…')).toBe(true);
  });

  test('computeColumnWidths fits within terminal budget', () => {
    const columns = [
      { key: 'a', header: 'Keyword', weight: 1 },
      { key: 'b', header: 'Status', weight: 1 },
      { key: 'c', header: 'Growth', weight: 0, minWidth: 6, maxWidth: 8 },
    ];
    const rows = [
      { a: 'ethereum', b: 'complete', c: '82' },
      { a: 'chatgpt', b: 'too_new', c: '37' },
    ];
    const widths = computeColumnWidths(columns, rows, 80);
    const total = Object.values(widths).reduce((sum, w) => sum + w, 0);
    expect(total).toBeLessThanOrEqual(80 - 4);
    expect(widths.c).toBeGreaterThanOrEqual(6);
  });

  test('buildLogTable renders without throwing for wide data', () => {
    const output = buildLogTable(
      [
        { key: 'status', header: 'Status', weight: 1 },
        { key: 'url', header: 'Link', weight: 2, maxWidth: 30 },
      ],
      [{ status: 'ineligible_default_profile', url: 'https://example.com/status/12345678901234567890' }],
      { settings: { terminalWidth: 72, maxCellWidth: 24 } },
    );
    expect(output).toContain('Status');
  });
});
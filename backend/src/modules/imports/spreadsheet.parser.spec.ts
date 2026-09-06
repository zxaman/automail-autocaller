import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';

import { ColumnMapper } from './column-mapper';
import { HeaderDetector } from './header-detector';
import { SpreadsheetParser } from './spreadsheet.parser';

const parser = new SpreadsheetParser();
const detector = new HeaderDetector();
const mapper = new ColumnMapper();

async function buildXlsx(rows: unknown[][], sheetName = 'Contacts'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('SpreadsheetParser', () => {
  describe('format detection', () => {
    it.each([
      ['contacts.xlsx', '', 'xlsx'],
      ['contacts.XLSX', '', 'xlsx'],
      ['legacy.xls', 'application/vnd.ms-excel', 'xls'],
      ['export.csv', 'text/csv', 'csv'],
    ])('detects %s as %s', (fileName, mimeType, expected) => {
      expect(parser.detectFormat(fileName, mimeType)).toBe(expected);
    });

    it('rejects an unsupported file type', () => {
      expect(() => parser.detectFormat('contacts.pdf', 'application/pdf')).toThrow(
        /xlsx/i,
      );
    });
  });

  it('parses an xlsx file into a string grid', async () => {
    const buffer = await buildXlsx([
      ['Name', 'Phone No.', 'Email ID'],
      ['Asha Menon', 9812345678, 'asha@example.com'],
    ]);

    const { sheet } = await parser.parse(buffer, 'xlsx');

    expect(sheet.sheetName).toBe('Contacts');
    expect(sheet.rows[0]).toEqual(['Name', 'Phone No.', 'Email ID']);
    // Numeric phone cells must not become scientific notation.
    expect(sheet.rows[1]?.[1]).toBe('9812345678');
  });

  it('parses a csv file', async () => {
    const csv = Buffer.from(
      'Candidate Name,Mobile,Email Address\nAsha Menon,9812345678,asha@example.com\n',
      'utf8',
    );

    const { sheet } = await parser.parse(csv, 'csv');

    expect(sheet.rows[0]?.[0]).toBe('Candidate Name');
    expect(sheet.rows[1]?.[2]).toBe('asha@example.com');
  });

  it('lists every sheet in a multi-sheet workbook', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Summary').addRow(['ignore me']);
    const contacts = workbook.addWorksheet('Contacts');
    contacts.addRow(['Name', 'Mobile']);
    contacts.addRow(['Asha', '9812345678']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const { sheets } = await parser.parse(buffer, 'xlsx');
    expect(sheets.map((entry) => entry.name)).toEqual(['Summary', 'Contacts']);
  });

  it('reads a named sheet when one is requested', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Summary').addRow(['ignore me']);
    const contacts = workbook.addWorksheet('Contacts');
    contacts.addRow(['Name']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const { sheet } = await parser.parse(buffer, 'xlsx', 'Contacts');
    expect(sheet.sheetName).toBe('Contacts');
  });

  it('rejects an unreadable file rather than importing garbage', async () => {
    await expect(parser.parse(Buffer.from('not a spreadsheet'), 'xlsx')).rejects.toThrow(
      /could not be read/i,
    );
  });

  /**
   * The scenario the phase exists for: a file nobody formatted for us.
   */
  it('imports a messy real-world file end to end', async () => {
    const buffer = await buildXlsx([
      ['Q3 Candidate Export', '', '', ''],
      ['Generated 2026-09-01', '', '', ''],
      ['', '', '', ''],
      ['Candidate', 'Phone No.', 'Mail', 'Current Company'],
      ['Asha Menon', 9812345678, 'asha@example.com', 'Acme Ltd'],
      ['Ravi Kumar', '+91 98123 45679', 'ravi@example.com', 'Globex'],
    ]);

    const { sheet } = await parser.parse(buffer, 'xlsx');
    const detection = detector.detect(sheet.rows);

    expect(detection.hasHeaderRow).toBe(true);
    expect(detection.headerRowIndex).toBe(3);

    const columns = mapper.suggest(detection.headers, detection.hasHeaderRow);
    expect(columns.map((column) => column.suggestedField)).toEqual([
      'name',
      'phone',
      'email',
      'company',
    ]);
  });

  it('handles a headerless file end to end', async () => {
    const buffer = await buildXlsx([
      ['Asha Menon', '9812345678', 'asha@example.com'],
      ['Ravi Kumar', '9812345679', 'ravi@example.com'],
    ]);

    const { sheet } = await parser.parse(buffer, 'xlsx');
    const detection = detector.detect(sheet.rows);

    expect(detection.hasHeaderRow).toBe(false);
    expect(detection.dataStartRowIndex).toBe(0);

    const columns = mapper.suggest(detection.headers, detection.hasHeaderRow);
    expect(columns.map((column) => column.suggestedField)).toEqual(['name', 'phone', 'email']);
    expect(columns.every((column) => column.requiresConfirmation)).toBe(true);
  });
});

import ExcelJS from 'exceljs';

import { AppError } from '../../shared/errors/app-error';
import type { ParsedSheet, SheetSummary } from './import.types';

/** Guards against a decompression bomb producing a huge in-memory grid. */
const MAX_ROWS = 50_000;
const MAX_COLUMNS = 100;

export type SpreadsheetFormat = 'xlsx' | 'xls' | 'csv';

/**
 * Reads XLSX, XLS, and CSV into a plain string grid.
 *
 * Everything downstream works on `string[][]`, so format handling stops here.
 * Values are stringified at the boundary because spreadsheets happily mix a
 * number, a formula result, and text in one column.
 */
export class SpreadsheetParser {
  public detectFormat(fileName: string, mimeType: string): SpreadsheetFormat {
    const extension = fileName.toLowerCase().split('.').pop() ?? '';

    if (extension === 'xlsx' || mimeType.includes('spreadsheetml')) {
      return 'xlsx';
    }
    if (extension === 'xls' || mimeType === 'application/vnd.ms-excel') {
      return 'xls';
    }
    if (extension === 'csv' || mimeType.includes('csv')) {
      return 'csv';
    }

    throw new AppError(
      'Only .xlsx, .xls, and .csv files can be imported',
      400,
      'IMPORT_UNSUPPORTED_FORMAT',
    );
  }

  public async parse(
    buffer: Buffer,
    format: SpreadsheetFormat,
    sheetName?: string,
  ): Promise<{ sheet: ParsedSheet; sheets: SheetSummary[] }> {
    const workbook = await this.readWorkbook(buffer, format);

    const sheets: SheetSummary[] = workbook.worksheets.map((worksheet) => ({
      name: worksheet.name,
      rowCount: worksheet.actualRowCount ?? worksheet.rowCount,
    }));

    if (sheets.length === 0) {
      throw new AppError('The file does not contain any sheets', 400, 'IMPORT_EMPTY_FILE');
    }

    const worksheet = sheetName
      ? workbook.worksheets.find((entry) => entry.name === sheetName)
      : // Default to the first sheet that actually holds rows.
        workbook.worksheets.find((entry) => (entry.actualRowCount ?? 0) > 0) ??
        workbook.worksheets[0];

    if (!worksheet) {
      throw new AppError(
        `The sheet "${sheetName ?? ''}" was not found in this file`,
        400,
        'IMPORT_SHEET_NOT_FOUND',
      );
    }

    return { sheet: { sheetName: worksheet.name, rows: this.toGrid(worksheet) }, sheets };
  }

  private async readWorkbook(
    buffer: Buffer,
    format: SpreadsheetFormat,
  ): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();

    try {
      if (format === 'csv') {
        // ExcelJS's CSV reader wants a stream; a Readable over the buffer avoids
        // writing the upload to disk.
        const { Readable } = await import('node:stream');
        const stream = Readable.from(buffer);
        await workbook.csv.read(stream);
        return workbook;
      }

      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      return workbook;
    } catch (error) {
      throw new AppError(
        format === 'xls'
          ? 'This .xls file could not be read. Please re-save it as .xlsx or .csv and try again.'
          : 'The file could not be read. It may be corrupt or password protected.',
        400,
        'IMPORT_FILE_UNREADABLE',
        { details: { reason: error instanceof Error ? error.message : 'unknown' } },
      );
    }
  }

  /** Flattens a worksheet into a dense grid, dropping trailing empty rows. */
  private toGrid(worksheet: ExcelJS.Worksheet): string[][] {
    const grid: string[][] = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS) {
        return;
      }

      const cells: string[] = [];
      const columnCount = Math.min(worksheet.columnCount || 0, MAX_COLUMNS);

      for (let column = 1; column <= columnCount; column += 1) {
        cells.push(this.stringifyCell(row.getCell(column)));
      }

      grid.push(cells);
    });

    while (grid.length > 0 && grid[grid.length - 1]!.every((cell) => cell === '')) {
      grid.pop();
    }

    return grid;
  }

  /**
   * Cells arrive as numbers, dates, formulas, or rich text. Phone numbers in
   * particular are often stored numerically, so scientific notation must be
   * avoided or +919812345678 becomes 9.81235e+11.
   */
  private stringifyCell(cell: ExcelJS.Cell): string {
    const value = cell.value;

    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toFixed(0) : String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'object') {
      if ('text' in value && typeof value.text === 'string') {
        return value.text.trim();
      }
      if ('result' in value && value.result !== undefined && value.result !== null) {
        return String(value.result).trim();
      }
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((part) => part.text).join('').trim();
      }
      if ('hyperlink' in value && typeof value.hyperlink === 'string') {
        return value.hyperlink.replace(/^mailto:/i, '').trim();
      }
    }

    return String(value).trim();
  }
}

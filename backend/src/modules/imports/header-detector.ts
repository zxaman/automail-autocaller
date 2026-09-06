import { FIELD_ALIASES, normalizeHeaderLabel } from './header-alias.registry';
import type { DetectedHeader, HeaderDetectionResult } from './import.types';
import { ValueAnalyzer } from './value-analyzer';

/** How many rows from the top may be a header, and how many values we sample. */
const MAX_HEADER_SEARCH_ROWS = 10;
const SAMPLE_SIZE = 12;

/**
 * Finds the header row, or concludes there isn't one.
 *
 * Files exported from real systems often carry a title, a blank line, or a
 * generated-on stamp before the real headers, so the first non-empty row is not
 * a safe assumption. Rows are scored on how header-like they look, and a
 * headerless file is a legitimate outcome rather than an error.
 */
export class HeaderDetector {
  constructor(private readonly valueAnalyzer: ValueAnalyzer = new ValueAnalyzer()) {}

  public detect(rows: readonly string[][]): HeaderDetectionResult {
    if (rows.length === 0) {
      return {
        headerRowIndex: -1,
        hasHeaderRow: false,
        headers: [],
        dataStartRowIndex: 0,
        confidence: 0,
      };
    }

    let bestIndex = -1;
    let bestScore = 0;

    const searchLimit = Math.min(MAX_HEADER_SEARCH_ROWS, rows.length);
    for (let index = 0; index < searchLimit; index += 1) {
      const score = this.scoreAsHeaderRow(rows, index);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    // Below this, the top row reads like data, so treat the file as headerless.
    const hasHeaderRow = bestScore >= 0.5 && bestIndex >= 0;

    if (!hasHeaderRow) {
      const firstDataRow = rows.findIndex((row) => row.some((cell) => cell !== ''));
      const dataStart = firstDataRow === -1 ? 0 : firstDataRow;

      return {
        headerRowIndex: -1,
        hasHeaderRow: false,
        headers: this.buildPositionalHeaders(rows, dataStart),
        dataStartRowIndex: dataStart,
        confidence: bestScore,
      };
    }

    return {
      headerRowIndex: bestIndex,
      hasHeaderRow: true,
      headers: this.buildLabelledHeaders(rows, bestIndex),
      dataStartRowIndex: bestIndex + 1,
      confidence: bestScore,
    };
  }

  /**
   * A header row is mostly short, non-numeric, distinct text, and ideally
   * contains at least one recognised alias. Data rows fail on the alias check
   * and usually on the numeric one.
   */
  private scoreAsHeaderRow(rows: readonly string[][], index: number): number {
    const row = rows[index] ?? [];
    const filled = row.filter((cell) => cell.trim() !== '');

    if (filled.length < 2) {
      return 0;
    }

    let score = 0;

    const nonNumeric = filled.filter((cell) => !/^\+?[\d\s\-().]+$/.test(cell)).length;
    score += (nonNumeric / filled.length) * 0.3;

    const shortLabels = filled.filter((cell) => cell.length <= 40).length;
    score += (shortLabels / filled.length) * 0.2;

    const distinct = new Set(filled.map((cell) => cell.toLowerCase())).size;
    score += (distinct / filled.length) * 0.15;

    const aliasHits = filled.filter((cell) => this.matchesAnyAlias(cell)).length;
    score += Math.min(1, aliasHits / 2) * 0.35;

    // A row with no recognisable field name is not usable as a header even if
    // it is otherwise text-like, so it stays below the acceptance threshold.
    // Without this, a first data row of plain names reads as a header.
    if (aliasHits === 0) {
      score = Math.min(score, 0.45);
    }

    // A row of emails or phones is data, however alias-like its neighbours look.
    const signals = this.valueAnalyzer.analyze(filled);
    // Scaled by how much of the row is data-like, so one email column in an
    // otherwise valid header row does not disqualify it.
    const dataLike = signals.find(
      (signal) => (signal.field === 'email' || signal.field === 'phone') && signal.ratio >= 0.3,
    );
    if (dataLike) {
      score -= 0.5 * dataLike.ratio;
    }

    return Math.max(0, Math.min(1, score));
  }

  private matchesAnyAlias(rawLabel: string): boolean {
    const normalized = normalizeHeaderLabel(rawLabel);
    if (normalized === '') {
      return false;
    }

    return FIELD_ALIASES.some(
      (alias) =>
        alias.exact.includes(normalized) ||
        alias.contains.some((fragment) => normalized.includes(fragment)),
    );
  }

  private buildLabelledHeaders(rows: readonly string[][], headerIndex: number): DetectedHeader[] {
    const headerRow = rows[headerIndex] ?? [];
    const columnCount = this.widestRowLength(rows);

    return Array.from({ length: columnCount }, (_, column) => {
      const rawLabel = (headerRow[column] ?? '').trim();
      return {
        index: column,
        rawLabel: rawLabel === '' ? `Column ${column + 1}` : rawLabel,
        normalizedLabel: normalizeHeaderLabel(rawLabel),
        sampleValues: this.collectSamples(rows, headerIndex + 1, column),
      };
    });
  }

  /** Headerless files get positional labels; mapping is then value-driven. */
  private buildPositionalHeaders(rows: readonly string[][], dataStart: number): DetectedHeader[] {
    const columnCount = this.widestRowLength(rows);

    return Array.from({ length: columnCount }, (_, column) => ({
      index: column,
      rawLabel: `Column ${column + 1}`,
      normalizedLabel: '',
      sampleValues: this.collectSamples(rows, dataStart, column),
    }));
  }

  private collectSamples(rows: readonly string[][], startRow: number, column: number): string[] {
    const samples: string[] = [];

    for (let index = startRow; index < rows.length && samples.length < SAMPLE_SIZE; index += 1) {
      const value = (rows[index]?.[column] ?? '').trim();
      if (value !== '') {
        samples.push(value);
      }
    }

    return samples;
  }

  private widestRowLength(rows: readonly string[][]): number {
    return rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  }
}

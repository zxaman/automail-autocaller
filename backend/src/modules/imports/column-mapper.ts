import {
  AMBIGUOUS_HEADERS,
  FIELD_ALIASES,
  normalizeHeaderLabel,
} from './header-alias.registry';
import type {
  ColumnSuggestion,
  DetectedHeader,
  ImportTargetField,
  MappingConfidence,
} from './import.types';
import { ValueAnalyzer } from './value-analyzer';

/** Score thresholds that decide whether the user must confirm a column. */
const SCORE_EXACT_ALIAS = 100;
const SCORE_CONTAINS_ALIAS = 70;
const SCORE_VALUE_STRONG = 65;
const SCORE_VALUE_WEAK = 35;
const AMBIGUOUS_LABEL_CEILING = 60;

const HIGH_CONFIDENCE_MIN = 85;
const MEDIUM_CONFIDENCE_MIN = 60;

interface FieldScore {
  field: ImportTargetField;
  score: number;
  reason: string;
}

/**
 * Decides which contact field each spreadsheet column feeds.
 *
 * Two independent sources of evidence: the header label (alias registry) and
 * the values themselves (ValueAnalyzer). Agreement raises confidence; a vague
 * label leans on values; a conflict is forced to the user rather than guessed.
 */
export class ColumnMapper {
  constructor(private readonly valueAnalyzer: ValueAnalyzer = new ValueAnalyzer()) {}

  public suggest(headers: readonly DetectedHeader[], hasHeaderRow: boolean): ColumnSuggestion[] {
    const suggestions = headers.map((header) => this.suggestColumn(header, hasHeaderRow));
    return this.resolveCollisions(suggestions);
  }

  private suggestColumn(header: DetectedHeader, hasHeaderRow: boolean): ColumnSuggestion {
    const labelScores = hasHeaderRow ? this.scoreLabel(header.normalizedLabel) : [];
    const valueScores = this.scoreValues(header.sampleValues);
    const combined = this.combine(labelScores, valueScores);

    const isAmbiguousLabel = hasHeaderRow && AMBIGUOUS_HEADERS.has(header.normalizedLabel);
    const best = combined[0];

    if (!best || best.score < SCORE_VALUE_WEAK) {
      return {
        columnIndex: header.index,
        rawLabel: header.rawLabel,
        suggestedField: null,
        confidence: 'none',
        score: best?.score ?? 0,
        reason: hasHeaderRow
          ? 'No field matched this column name or its values.'
          : 'This file has no header row, so this column needs a manual choice.',
        requiresConfirmation: true,
        sampleValues: header.sampleValues,
        alternatives: combined.slice(0, 3).map((entry) => ({ field: entry.field, score: entry.score })),
      };
    }

    // A generic label can never earn high confidence on its own.
    const score = isAmbiguousLabel ? Math.min(best.score, AMBIGUOUS_LABEL_CEILING) : best.score;
    const confidence = this.toConfidence(score);
    const runnerUp = combined[1];
    // Two fields scoring within 15 points is a real ambiguity, not a winner.
    const isContested = runnerUp !== undefined && score - runnerUp.score < 15;

    return {
      columnIndex: header.index,
      rawLabel: header.rawLabel,
      suggestedField: best.field,
      confidence,
      score,
      reason: isAmbiguousLabel
        ? `"${header.rawLabel}" is a generic column name; ${best.reason.toLowerCase()} Please confirm.`
        : best.reason,
      requiresConfirmation: confidence !== 'high' || isContested,
      sampleValues: header.sampleValues,
      alternatives: combined.slice(1, 4).map((entry) => ({ field: entry.field, score: entry.score })),
    };
  }

  private scoreLabel(normalizedLabel: string): FieldScore[] {
    if (normalizedLabel === '') {
      return [];
    }

    const scores: FieldScore[] = [];

    for (const alias of FIELD_ALIASES) {
      if (alias.exact.includes(normalizedLabel)) {
        scores.push({
          field: alias.field,
          score: SCORE_EXACT_ALIAS,
          reason: `The column name matches a known ${alias.label.toLowerCase()} heading.`,
        });
        continue;
      }

      const fragment = alias.contains.find((entry) => normalizedLabel.includes(entry));
      if (fragment) {
        scores.push({
          field: alias.field,
          score: SCORE_CONTAINS_ALIAS,
          reason: `The column name contains "${fragment}", which suggests ${alias.label.toLowerCase()}.`,
        });
      }
    }

    return scores;
  }

  private scoreValues(samples: readonly string[]): FieldScore[] {
    return this.valueAnalyzer.analyze(samples).map((signal) => {
      const percentage = Math.round(signal.ratio * 100);
      const score =
        signal.ratio >= 0.8
          ? SCORE_VALUE_STRONG
          : signal.ratio >= 0.5
            ? SCORE_VALUE_WEAK + 15
            : SCORE_VALUE_WEAK;

      return {
        field: signal.field,
        score: Math.round(score * signal.ratio),
        reason: `${percentage}% of the sample values look like a ${signal.field}.`,
      };
    });
  }

  /** Label and value evidence for the same field reinforce each other. */
  private combine(labelScores: FieldScore[], valueScores: FieldScore[]): FieldScore[] {
    const merged = new Map<ImportTargetField, FieldScore>();

    for (const entry of labelScores) {
      merged.set(entry.field, { ...entry });
    }

    for (const entry of valueScores) {
      const existing = merged.get(entry.field);
      if (!existing) {
        merged.set(entry.field, { ...entry });
        continue;
      }

      merged.set(entry.field, {
        field: entry.field,
        // Capped, so agreement boosts confidence without runaway scores.
        score: Math.min(120, existing.score + Math.round(entry.score * 0.3)),
        reason: `${existing.reason} ${entry.reason}`,
      });
    }

    return [...merged.values()].sort((a, b) => b.score - a.score);
  }

  /**
   * Two columns cannot fill the same field. The weaker claim is demoted and
   * flagged for confirmation rather than silently dropped.
   */
  private resolveCollisions(suggestions: ColumnSuggestion[]): ColumnSuggestion[] {
    const claimed = new Map<ImportTargetField, number>();
    const ordered = [...suggestions].sort((a, b) => b.score - a.score);

    for (const suggestion of ordered) {
      const field = suggestion.suggestedField;
      if (field === null || field === 'ignore') {
        continue;
      }

      const holder = claimed.get(field);
      if (holder === undefined) {
        claimed.set(field, suggestion.columnIndex);
        continue;
      }

      const index = suggestions.findIndex((entry) => entry.columnIndex === suggestion.columnIndex);
      const alternative = suggestion.alternatives.find((entry) => !claimed.has(entry.field));

      suggestions[index] = {
        ...suggestion,
        suggestedField: alternative?.field ?? null,
        confidence: 'low',
        reason: alternative
          ? `Another column is a stronger match for this field, so ${alternative.field} is suggested instead. Please confirm.`
          : 'Another column already maps to this field. Please choose a field for this one.',
        requiresConfirmation: true,
      };

      if (alternative) {
        claimed.set(alternative.field, suggestion.columnIndex);
      }
    }

    return suggestions;
  }

  private toConfidence(score: number): MappingConfidence {
    if (score >= HIGH_CONFIDENCE_MIN) {
      return 'high';
    }
    if (score >= MEDIUM_CONFIDENCE_MIN) {
      return 'medium';
    }
    return 'low';
  }
}

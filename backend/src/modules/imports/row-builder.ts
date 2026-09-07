import { normalizePhone } from '../../shared/utils/phone';
import type {
  ColumnAssignment,
  ContactDraft,
  ImportTargetField,
} from './import.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const MAX_NOTE_LENGTH = 2000;

export interface RowBuildResult {
  draft: ContactDraft | null;
  error: string | null;
  /** True when the row was blank; skipped silently rather than reported. */
  isEmpty: boolean;
}

/**
 * Turns one spreadsheet row into a validated contact draft.
 *
 * Rules applied here: first/last name columns are combined, phones are
 * normalized to E.164, emails are format-checked, and a row with neither a
 * usable phone nor email is rejected because it cannot be called or mailed.
 */
export class RowBuilder {
  constructor(private readonly defaultTags: readonly string[] = []) {}

  public build(
    row: readonly string[],
    mapping: ReadonlyMap<number, ColumnAssignment>,
    rowNumber: number,
  ): RowBuildResult {
    if (row.every((cell) => (cell ?? '').trim() === '')) {
      return { draft: null, error: null, isEmpty: true };
    }

    const values = this.collectValues(row, mapping);

    const name = this.resolveName(values);
    const rawPhone = values.get('phone') ?? '';
    const rawEmail = values.get('email') ?? '';

    let phone: string | null = null;
    if (rawPhone !== '') {
      const normalized = normalizePhone(rawPhone);
      if (!normalized) {
        return {
          draft: null,
          isEmpty: false,
          error: `"${rawPhone}" is not a valid phone number`,
        };
      }
      phone = normalized.e164;
    }

    let email: string | null = null;
    if (rawEmail !== '') {
      const candidate = rawEmail.toLowerCase();
      if (!EMAIL_PATTERN.test(candidate)) {
        return { draft: null, isEmpty: false, error: `"${rawEmail}" is not a valid email address` };
      }
      email = candidate;
    }

    if (!phone && !email) {
      return {
        draft: null,
        isEmpty: false,
        error: 'The row has neither a phone number nor an email address',
      };
    }

    if (!name) {
      return { draft: null, isEmpty: false, error: 'The row has no name' };
    }

    return {
      isEmpty: false,
      error: null,
      draft: {
        rowNumber,
        name,
        phone,
        email,
        company: this.optional(values.get('company')),
        designation: this.optional(values.get('designation')),
        location: this.optional(values.get('location')),
        tags: this.resolveTags(values.get('tags')),
        notes: this.optional(values.get('notes'))?.slice(0, MAX_NOTE_LENGTH) ?? null,
      },
    };
  }

  private collectValues(
    row: readonly string[],
    mapping: ReadonlyMap<number, ColumnAssignment>,
  ): Map<ImportTargetField, string> {
    const values = new Map<ImportTargetField, string>();

    for (const [columnIndex, field] of mapping) {
      if (field === null || field === 'ignore') {
        continue;
      }

      const value = (row[columnIndex] ?? '').trim();
      if (value === '') {
        continue;
      }

      // First non-empty wins if two columns somehow target one field.
      if (!values.has(field)) {
        values.set(field, value);
      }
    }

    return values;
  }

  /** A dedicated name column wins; otherwise first and last are joined. */
  private resolveName(values: ReadonlyMap<ImportTargetField, string>): string | null {
    const fullName = values.get('name')?.trim();
    if (fullName) {
      return fullName.slice(0, 120);
    }

    const combined = [values.get('firstName'), values.get('lastName')]
      .map((part) => part?.trim() ?? '')
      .filter((part) => part !== '')
      .join(' ');

    return combined === '' ? null : combined.slice(0, 120);
  }

  /** Tags may arrive comma, semicolon, or pipe separated in a single cell. */
  private resolveTags(rawTags: string | undefined): string[] {
    const fromRow = (rawTags ?? '')
      .split(/[,;|]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag !== '');

    return [...new Set([...this.defaultTags, ...fromRow])].slice(0, 20);
  }

  private optional(value: string | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  }
}

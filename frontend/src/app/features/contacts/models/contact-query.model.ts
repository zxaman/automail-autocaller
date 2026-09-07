import type { ContactSource } from './contact.model';

export type ContactSortField = 'createdAt' | 'updatedAt' | 'name' | 'company' | 'lastContactedAt';
export type SortDirection = 'asc' | 'desc';

/** Query state driving the contact list. Mirrors the backend query contract. */
export interface ContactQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly tag: string | null;
  readonly source: ContactSource | null;
  readonly hasEmail: boolean | null;
  readonly hasPhone: boolean | null;
  readonly sortBy: ContactSortField;
  readonly sortDir: SortDirection;
}

export const DEFAULT_CONTACT_QUERY: ContactQuery = {
  page: 1,
  pageSize: 25,
  search: '',
  tag: null,
  source: null,
  hasEmail: null,
  hasPhone: null,
  sortBy: 'createdAt',
  sortDir: 'desc',
};

export interface ContactSortOption {
  readonly label: string;
  readonly sortBy: ContactSortField;
  readonly sortDir: SortDirection;
}

export const CONTACT_SORT_OPTIONS: readonly ContactSortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDir: 'desc' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDir: 'asc' },
  { label: 'Name A–Z', sortBy: 'name', sortDir: 'asc' },
  { label: 'Name Z–A', sortBy: 'name', sortDir: 'desc' },
  { label: 'Company A–Z', sortBy: 'company', sortDir: 'asc' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDir: 'desc' },
];

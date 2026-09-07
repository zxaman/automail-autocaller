import type { ContactSource } from './contact.model';

/** Client projection of a contact. */
export interface ContactDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  designation: string | null;
  location: string | null;
  tags: string[];
  notes: string | null;
  source: ContactSource;
  importBatchId: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ContactSortField = 'createdAt' | 'updatedAt' | 'name' | 'company' | 'lastContactedAt';
export type SortDirection = 'asc' | 'desc';

export interface ContactListQuery {
  page: number;
  pageSize: number;
  search?: string;
  tag?: string;
  company?: string;
  source?: ContactSource;
  hasEmail?: boolean;
  hasPhone?: boolean;
  sortBy: ContactSortField;
  sortDir: SortDirection;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PagedResult<TItem> {
  items: TItem[];
  pagination: PaginationMeta;
}

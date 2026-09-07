/** Canonical backend success envelope. */
export interface ApiSuccessResponse<TData> {
  readonly success: true;
  readonly message: string;
  readonly data: TData;
}

/** Canonical backend error envelope. Stack traces are never exposed. */
export interface ApiErrorBody {
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly message: string;
  readonly error: ApiErrorBody;
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface PagedData<TItem> {
  readonly items: readonly TItem[];
  readonly pagination: PaginationMeta;
}

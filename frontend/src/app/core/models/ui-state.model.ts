/** Shared async view-state contract used by feature state services. */
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AsyncState<TData> {
  readonly status: LoadStatus;
  readonly data: TData | null;
  readonly error: string | null;
}

export function idleState<TData>(): AsyncState<TData> {
  return { status: 'idle', data: null, error: null };
}

export function loadingState<TData>(previous?: AsyncState<TData>): AsyncState<TData> {
  return { status: 'loading', data: previous?.data ?? null, error: null };
}

export function loadedState<TData>(data: TData): AsyncState<TData> {
  return { status: 'loaded', data, error: null };
}

export function errorState<TData>(error: string): AsyncState<TData> {
  return { status: 'error', data: null, error };
}

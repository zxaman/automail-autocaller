/** Normalized application error used by every feature and UI error state. */
export interface AppErrorShape {
  readonly code: string;
  readonly message: string;
  readonly status: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class AppError extends Error implements AppErrorShape {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(shape: AppErrorShape) {
    super(shape.message);
    this.name = 'AppError';
    this.code = shape.code;
    this.status = shape.status;
    this.details = shape.details;
  }

  public get isUnauthorized(): boolean {
    return this.status === 401;
  }

  public get isForbidden(): boolean {
    return this.status === 403;
  }

  public get isNotFound(): boolean {
    return this.status === 404;
  }

  public get isNetworkError(): boolean {
    return this.status === 0;
  }
}

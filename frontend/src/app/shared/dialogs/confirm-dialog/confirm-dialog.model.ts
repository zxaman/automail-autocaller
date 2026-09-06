export interface ConfirmDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  /** Applies a destructive treatment to the confirm action. */
  readonly destructive: boolean;
}

export type ConfirmDialogResult = boolean;

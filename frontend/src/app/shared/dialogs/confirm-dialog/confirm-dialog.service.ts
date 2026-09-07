import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { Observable } from 'rxjs';

import { ConfirmDialogComponent } from './confirm-dialog.component';
import type { ConfirmDialogData, ConfirmDialogResult } from './confirm-dialog.model';

/** Opens the shared confirmation dialog with sensible defaults. */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  public confirm(options: Partial<ConfirmDialogData> & Pick<ConfirmDialogData, 'title' | 'message'>) {
    const data: ConfirmDialogData = {
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      destructive: false,
      ...options,
    };

    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, ConfirmDialogResult>(ConfirmDialogComponent, {
        data,
        width: '420px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'dialog',
        restoreFocus: true,
      })
      .afterClosed() as Observable<ConfirmDialogResult | undefined>;
  }
}

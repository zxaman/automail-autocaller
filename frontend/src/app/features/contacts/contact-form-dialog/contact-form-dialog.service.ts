import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { Observable } from 'rxjs';

import type { Contact } from '../models/contact.model';
import { ContactFormDialogComponent } from './contact-form-dialog.component';
import type { ContactFormDialogData, ContactFormDialogResult } from './contact-form-dialog.model';

/** Opens the contact form for create or edit and returns the saved contact. */
@Injectable({ providedIn: 'root' })
export class ContactFormDialogService {
  private readonly dialog = inject(MatDialog);

  public open(
    mode: 'create' | 'edit',
    contact: Contact | null,
    knownTags: readonly string[] = [],
  ): Observable<ContactFormDialogResult> {
    return this.dialog
      .open<ContactFormDialogComponent, ContactFormDialogData, ContactFormDialogResult>(
        ContactFormDialogComponent,
        {
          data: { mode, contact, knownTags },
          width: '640px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100dvh - 48px)',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        },
      )
      .afterClosed();
  }
}

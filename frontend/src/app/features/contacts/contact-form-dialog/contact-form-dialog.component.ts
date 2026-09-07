import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { MatChipsModule, type MatChipInputEvent } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AppError } from '../../../core/models/api-error.model';
import { NotificationService } from '../../../core/services/notification.service';
import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { UiIconComponent } from '../../../shared/components/ui-icon/ui-icon.component';
import type { Contact, ContactPayload } from '../models/contact.model';
import { ContactService } from '../services/contact.service';
import type { ContactFormDialogData, ContactFormDialogResult } from './contact-form-dialog.model';

/** A contact needs at least one way to reach them. */
function requirePhoneOrEmail(group: AbstractControl): ValidationErrors | null {
  const phone = (group.get('phone')?.value as string | null)?.trim();
  const email = (group.get('email')?.value as string | null)?.trim();
  return phone || email ? null : { channelRequired: true };
}

/**
 * Create and edit dialog for a contact.
 * Uses Material form fields and chips for accessible labelling, error wiring,
 * and keyboard tag entry.
 */
@Component({
  selector: 'app-contact-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    UiButtonComponent,
    UiIconComponent,
  ],
  templateUrl: './contact-form-dialog.component.html',
  styleUrl: './contact-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly contactService = inject(ContactService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialogRef =
    inject<MatDialogRef<ContactFormDialogComponent, ContactFormDialogResult>>(MatDialogRef);

  protected readonly data = inject<ContactFormDialogData>(MAT_DIALOG_DATA);
  protected readonly separatorKeyCodes = [ENTER, COMMA] as const;

  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly tags = signal<string[]>([...(this.data.contact?.tags ?? [])]);
  protected readonly isEdit = computed(() => this.data.mode === 'edit');
  protected readonly title = computed(() => (this.isEdit() ? 'Edit contact' : 'Add contact'));

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      name: [this.data.contact?.name ?? '', [Validators.required, Validators.maxLength(160)]],
      phone: [this.data.contact?.phone ?? '', [Validators.maxLength(32)]],
      email: [this.data.contact?.email ?? '', [Validators.email, Validators.maxLength(320)]],
      company: [this.data.contact?.company ?? '', [Validators.maxLength(160)]],
      designation: [this.data.contact?.designation ?? '', [Validators.maxLength(160)]],
      location: [this.data.contact?.location ?? '', [Validators.maxLength(160)]],
      notes: [this.data.contact?.notes ?? '', [Validators.maxLength(5000)]],
    },
    { validators: requirePhoneOrEmail },
  );

  protected addTag(event: MatChipInputEvent): void {
    const value = event.value.trim().toLowerCase();
    if (value && !this.tags().includes(value) && this.tags().length < 25) {
      this.tags.update((tags) => [...tags, value]);
    }
    event.chipInput.clear();
  }

  protected removeTag(tag: string): void {
    this.tags.update((tags) => tags.filter((item) => item !== tag));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.serverError.set(null);

    const payload = this.toPayload();
    const request$ =
      this.isEdit() && this.data.contact
        ? this.contactService.update(this.data.contact.id, payload)
        : this.contactService.create(payload);

    request$.subscribe({
      next: (contact: Contact) => {
        this.saving.set(false);
        this.notificationService.success(
          this.isEdit() ? `${contact.name} was updated.` : `${contact.name} was added.`,
        );
        this.dialogRef.close(contact);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.serverError.set(this.toMessage(error));
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  private toPayload(): ContactPayload {
    const value = this.form.getRawValue();
    const orNull = (input: string): string | null => (input.trim() ? input.trim() : null);

    return {
      name: value.name.trim(),
      phone: orNull(value.phone),
      email: orNull(value.email)?.toLowerCase() ?? null,
      company: orNull(value.company),
      designation: orNull(value.designation),
      location: orNull(value.location),
      tags: this.tags(),
      notes: orNull(value.notes),
    };
  }

  private toMessage(error: unknown): string {
    if (!(error instanceof AppError)) {
      return 'The contact could not be saved. Please try again.';
    }
    if (error.code === 'CONTACT_DUPLICATE') {
      const field = (error.details as { field?: string } | undefined)?.field ?? 'value';
      return `Another contact in this workspace already uses this ${field}.`;
    }
    return error.message;
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppError } from '../../../core/models/api-error.model';
import { NotificationService } from '../../../core/services/notification.service';
import { DEFAULT_CONTACT_QUERY } from '../../contacts/models/contact-query.model';
import type { Contact } from '../../contacts/models/contact.model';
import { ContactService } from '../../contacts/services/contact.service';
import type {
  EmailAttachment,
  EmailPreview,
  EmailRecord,
  EmailSignature,
  EmailTemplate,
} from '../models/email.model';
import { EmailService } from '../services/email.service';

export const MAX_ATTACHMENTS_PER_EMAIL = 5;

/**
 * Composer view state.
 *
 * Recipient selection, the draft, and the preview live here so the page and
 * its child components stay presentational.
 */
@Injectable()
export class ComposePageService {
  private readonly emailService = inject(EmailService);
  private readonly contactService = inject(ContactService);
  private readonly notifications = inject(NotificationService);

  private readonly contactsSignal = signal<readonly Contact[]>([]);
  private readonly selectedIdsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly templatesSignal = signal<readonly EmailTemplate[]>([]);
  private readonly signaturesSignal = signal<readonly EmailSignature[]>([]);
  private readonly attachmentsSignal = signal<readonly EmailAttachment[]>([]);
  private readonly selectedAttachmentIdsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly historySignal = signal<readonly EmailRecord[]>([]);

  private readonly subjectSignal = signal('');
  private readonly bodyHtmlSignal = signal('');
  private readonly templateIdSignal = signal<string | null>(null);
  private readonly signatureIdSignal = signal<string | null>(null);

  private readonly previewSignal = signal<EmailPreview | null>(null);
  private readonly previewIndexSignal = signal(0);

  private readonly isLoadingSignal = signal(false);
  private readonly isSendingSignal = signal(false);
  private readonly isPreviewingSignal = signal(false);
  private readonly isUploadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  public readonly contacts = this.contactsSignal.asReadonly();
  public readonly templates = this.templatesSignal.asReadonly();
  public readonly signatures = this.signaturesSignal.asReadonly();
  public readonly attachments = this.attachmentsSignal.asReadonly();
  public readonly history = this.historySignal.asReadonly();
  public readonly subject = this.subjectSignal.asReadonly();
  public readonly bodyHtml = this.bodyHtmlSignal.asReadonly();
  public readonly templateId = this.templateIdSignal.asReadonly();
  public readonly signatureId = this.signatureIdSignal.asReadonly();
  public readonly preview = this.previewSignal.asReadonly();
  public readonly isLoading = this.isLoadingSignal.asReadonly();
  public readonly isSending = this.isSendingSignal.asReadonly();
  public readonly isPreviewing = this.isPreviewingSignal.asReadonly();
  public readonly isUploading = this.isUploadingSignal.asReadonly();
  public readonly errorMessage = this.errorSignal.asReadonly();

  public readonly selectedIds = this.selectedIdsSignal.asReadonly();
  public readonly selectedAttachmentIds = this.selectedAttachmentIdsSignal.asReadonly();

  public readonly selectedContacts = computed(() => {
    const selected = this.selectedIdsSignal();
    return this.contactsSignal().filter((contact) => selected.has(contact.id));
  });

  public readonly recipientCount = computed(() => this.selectedIdsSignal().size);

  /** Selected contacts with no email address cannot be sent to. */
  public readonly unreachableCount = computed(
    () => this.selectedContacts().filter((contact) => !contact.email).length,
  );

  public readonly canSend = computed(
    () =>
      this.recipientCount() > 0 &&
      this.recipientCount() > this.unreachableCount() &&
      this.subjectSignal().trim().length > 0 &&
      this.bodyHtmlSignal().trim().length > 0 &&
      !this.isSendingSignal(),
  );

  public readonly previewContact = computed(() => {
    const selected = this.selectedContacts();
    return selected[Math.min(this.previewIndexSignal(), Math.max(0, selected.length - 1))] ?? null;
  });

  public async load(): Promise<void> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const [contacts, templates, signatures, attachments, history] = await Promise.all([
        // The composer loads a working set of contacts; larger workspaces will get
        // server-side recipient search in a later phase.
        firstValueFrom(
          this.contactService.list({ ...DEFAULT_CONTACT_QUERY, page: 1, pageSize: 100 }),
        ),
        firstValueFrom(this.emailService.listTemplates()),
        firstValueFrom(this.emailService.listSignatures()),
        firstValueFrom(this.emailService.listAttachments()),
        firstValueFrom(this.emailService.list({ page: 1, pageSize: 20 })),
      ]);

      this.contactsSignal.set(contacts.items);
      this.templatesSignal.set(templates.items);
      this.signaturesSignal.set(signatures.items);
      this.attachmentsSignal.set(attachments.items);
      this.historySignal.set(history.items);

      const defaultSignature = signatures.items.find((signature) => signature.isDefault);
      if (defaultSignature) {
        this.signatureIdSignal.set(defaultSignature.id);
      }
    } catch (error) {
      this.errorSignal.set(this.messageFor(error, 'The composer could not be loaded'));
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Seeds the composer from a follow-up draft prepared for one contact.
   *
   * Applied after `load()` so the contact list exists, and it only ever fills
   * the draft - nothing is sent, and the user edits it like any other email.
   */
  public applyFollowUp(draft: {
    contactId: string;
    subject: string;
    body: string;
  }): void {
    const known = this.contactsSignal().some((contact) => contact.id === draft.contactId);

    if (known) {
      this.selectedIdsSignal.set(new Set([draft.contactId]));
    }

    this.subjectSignal.set(draft.subject);
    // The draft arrives as plain text; newlines become paragraphs in the editor.
    this.bodyHtmlSignal.set(
      draft.body
        .split('\n')
        .map((line) => (line.trim().length === 0 ? '<p><br></p>' : `<p>${this.escapeHtml(line)}</p>`))
        .join(''),
    );
  }

  /** Draft copy is user-facing text, never markup: escape before embedding. */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public toggleRecipient(contactId: string): void {
    const next = new Set(this.selectedIdsSignal());
    if (!next.delete(contactId)) {
      next.add(contactId);
    }
    this.selectedIdsSignal.set(next);
  }

  public selectAllReachable(): void {
    this.selectedIdsSignal.set(
      new Set(
        this.contactsSignal()
          .filter((contact) => contact.email)
          .map((contact) => contact.id),
      ),
    );
  }

  public clearRecipients(): void {
    this.selectedIdsSignal.set(new Set());
  }

  public setSubject(value: string): void {
    this.subjectSignal.set(value);
  }

  public setBodyHtml(value: string): void {
    this.bodyHtmlSignal.set(value);
  }

  public setSignature(signatureId: string | null): void {
    this.signatureIdSignal.set(signatureId);
  }

  /** Applying a template replaces the draft with its content. */
  public applyTemplate(templateId: string | null): void {
    this.templateIdSignal.set(templateId);

    const template = this.templatesSignal().find((item) => item.id === templateId);
    if (template) {
      this.subjectSignal.set(template.subject);
      this.bodyHtmlSignal.set(template.bodyHtml);
    }
  }

  public toggleAttachment(attachmentId: string): void {
    const next = new Set(this.selectedAttachmentIdsSignal());

    if (!next.delete(attachmentId)) {
      if (next.size >= MAX_ATTACHMENTS_PER_EMAIL) {
        this.notifications.error(
          `An email can carry at most ${MAX_ATTACHMENTS_PER_EMAIL} attachments`,
        );
        return;
      }
      next.add(attachmentId);
    }

    this.selectedAttachmentIdsSignal.set(next);
  }

  public async uploadAttachment(file: File): Promise<void> {
    this.isUploadingSignal.set(true);

    try {
      const attachment = await firstValueFrom(this.emailService.uploadAttachment(file));
      const existing = this.attachmentsSignal().some((item) => item.id === attachment.id);

      if (!existing) {
        this.attachmentsSignal.set([attachment, ...this.attachmentsSignal()]);
      }

      this.notifications.success(`"${attachment.fileName}" is ready to attach`);
    } catch (error) {
      this.notifications.error(this.messageFor(error, 'The file could not be uploaded'));
    } finally {
      this.isUploadingSignal.set(false);
    }
  }

  public async refreshPreview(): Promise<void> {
    const contact = this.previewContact();

    if (!contact) {
      this.previewSignal.set(null);
      return;
    }

    this.isPreviewingSignal.set(true);

    try {
      this.previewSignal.set(
        await firstValueFrom(
          this.emailService.preview({
            contactId: contact.id,
            subject: this.subjectSignal(),
            bodyHtml: this.bodyHtmlSignal(),
            ...(this.signatureIdSignal() ? { signatureId: this.signatureIdSignal()! } : {}),
          }),
        ),
      );
    } catch (error) {
      this.notifications.error(this.messageFor(error, 'The preview could not be generated'));
    } finally {
      this.isPreviewingSignal.set(false);
    }
  }

  public showNextPreview(): void {
    const total = this.selectedContacts().length;
    if (total > 0) {
      this.previewIndexSignal.set((this.previewIndexSignal() + 1) % total);
      void this.refreshPreview();
    }
  }

  public async send(): Promise<void> {
    if (!this.canSend()) {
      return;
    }

    this.isSendingSignal.set(true);

    try {
      const result = await firstValueFrom(
        this.emailService.send({
          contactIds: [...this.selectedIdsSignal()],
          subject: this.subjectSignal(),
          bodyHtml: this.bodyHtmlSignal(),
          attachmentIds: [...this.selectedAttachmentIdsSignal()],
          ...(this.templateIdSignal() ? { templateId: this.templateIdSignal()! } : {}),
          ...(this.signatureIdSignal() ? { signatureId: this.signatureIdSignal()! } : {}),
        }),
      );

      const skippedNote =
        result.skipped.length > 0 ? ` ${result.skipped.length} contact(s) were skipped.` : '';
      this.notifications.success(
        `${result.queued} email(s) queued for sending.${skippedNote}`,
      );

      this.clearRecipients();
      this.previewSignal.set(null);
      await this.refreshHistory();
    } catch (error) {
      this.notifications.error(this.messageFor(error, 'The emails could not be queued'));
    } finally {
      this.isSendingSignal.set(false);
    }
  }

  public async refreshHistory(): Promise<void> {
    try {
      const history = await firstValueFrom(this.emailService.list({ page: 1, pageSize: 20 }));
      this.historySignal.set(history.items);
    } catch {
      // History is secondary; a failure here must not disturb the composer.
    }
  }

  public async retry(emailId: string): Promise<void> {
    try {
      await firstValueFrom(this.emailService.retry(emailId));
      this.notifications.success('The email was queued for another attempt');
      await this.refreshHistory();
    } catch (error) {
      this.notifications.error(this.messageFor(error, 'The email could not be retried'));
    }
  }

  private messageFor(error: unknown, fallback: string): string {
    return error instanceof AppError ? error.message : fallback;
  }
}

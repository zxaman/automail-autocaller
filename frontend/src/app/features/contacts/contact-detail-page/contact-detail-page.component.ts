import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { NotificationService } from '../../../core/services/notification.service';
import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiEmptyStateComponent } from '../../../shared/components/ui-empty-state/ui-empty-state.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiIconComponent } from '../../../shared/components/ui-icon/ui-icon.component';
import { UiAvatarComponent } from '../../../shared/components/ui-avatar/ui-avatar.component';
import { UiLoadingSpinnerComponent } from '../../../shared/components/ui-loading-spinner/ui-loading-spinner.component';
import { ConfirmDialogService } from '../../../shared/dialogs/confirm-dialog/confirm-dialog.service';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { ContactFormDialogService } from '../contact-form-dialog/contact-form-dialog.service';
import type { Contact } from '../models/contact.model';
import { ContactService } from '../services/contact.service';
import { ContactDetailPageService } from './contact-detail-page.service';

/** Contact profile: summary, action bar, and the communication timeline. */
@Component({
  selector: 'app-contact-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    RelativeTimePipe,
    UiAvatarComponent,
    UiButtonComponent,
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiIconComponent,
    UiLoadingSpinnerComponent,
  ],
  providers: [ContactDetailPageService],
  templateUrl: './contact-detail-page.component.html',
  styleUrl: './contact-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactDetailPageComponent implements OnInit {
  private readonly detailService = inject(ContactDetailPageService);
  private readonly contactService = inject(ContactService);
  private readonly formDialog = inject(ContactFormDialogService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  /** Route parameter bound by `withComponentInputBinding()`. */
  public readonly id = input.required<string>();

  protected readonly contact = this.detailService.contact;
  protected readonly isLoading = this.detailService.isLoading;
  protected readonly hasError = this.detailService.hasError;
  protected readonly errorMessage = this.detailService.errorMessage;
  protected readonly notFound = this.detailService.notFound;

  constructor() {
    // Reload when the route id changes without a component re-creation.
    effect(() => {
      const contactId = this.id();
      if (contactId) {
        this.detailService.load(contactId);
      }
    });
  }

  public ngOnInit(): void {
    this.detailService.load(this.id());
  }

  protected reload(): void {
    this.detailService.load(this.id());
  }

  protected onEdit(): void {
    const current = this.contact();
    if (!current) {
      return;
    }

    this.formDialog
      .open('edit', current, current.tags)
      .pipe(filter((updated): updated is Contact => !!updated))
      .subscribe((updated) => this.detailService.set(updated));
  }

  protected onDelete(): void {
    const current = this.contact();
    if (!current) {
      return;
    }

    this.confirmDialog
      .confirm({
        title: `Delete ${current.name}?`,
        message:
          'This removes the contact from your workspace. Past calls and emails are kept in your history.',
        confirmLabel: 'Delete contact',
        destructive: true,
      })
      .pipe(filter((confirmed): confirmed is true => confirmed === true))
      .subscribe(() => {
        this.contactService.delete(current.id).subscribe({
          next: () => {
            this.notificationService.success(`${current.name} was deleted.`);
            void this.router.navigate(['/contacts']);
          },
          error: () => this.notificationService.error('The contact could not be deleted.'),
        });
      });
  }

  protected onCall(): void {
    this.notificationService.info(
      'In-app calling becomes available when the telephony phase is enabled.',
    );
  }

  protected onEmail(): void {
    this.notificationService.info(
      'Email composition becomes available once a Gmail account is connected.',
    );
  }
}

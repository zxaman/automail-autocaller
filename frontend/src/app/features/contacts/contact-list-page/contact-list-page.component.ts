import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { filter, switchMap } from 'rxjs';

import { NotificationService } from '../../../core/services/notification.service';
import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiEmptyStateComponent } from '../../../shared/components/ui-empty-state/ui-empty-state.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';
import { UiSkeletonComponent } from '../../../shared/components/ui-skeleton/ui-skeleton.component';
import { ConfirmDialogService } from '../../../shared/dialogs/confirm-dialog/confirm-dialog.service';
import { ContactCardComponent } from '../components/contact-card/contact-card.component';
import { ContactFiltersComponent } from '../components/contact-filters/contact-filters.component';
import { ContactFormDialogService } from '../contact-form-dialog/contact-form-dialog.service';
import type { Contact } from '../models/contact.model';
import type { ContactSortOption } from '../models/contact-query.model';
import { ContactListPageService } from './contact-list-page.service';

/** Contact list: search, filter, sort, paginate, and CRUD entry points. */
@Component({
  selector: 'app-contact-list-page',
  standalone: true,
  imports: [
    MatPaginatorModule,
    ContactCardComponent,
    ContactFiltersComponent,
    UiButtonComponent,
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiPageHeaderComponent,
    UiSkeletonComponent,
  ],
  providers: [ContactListPageService],
  templateUrl: './contact-list-page.component.html',
  styleUrl: './contact-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListPageComponent implements OnInit {
  private readonly listService = inject(ContactListPageService);
  private readonly formDialog = inject(ContactFormDialogService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notificationService = inject(NotificationService);

  protected readonly contacts = this.listService.contacts;
  protected readonly pagination = this.listService.pagination;
  protected readonly query = this.listService.query;
  protected readonly tags = this.listService.tags;
  protected readonly isLoading = this.listService.isLoading;
  protected readonly hasError = this.listService.hasError;
  protected readonly errorMessage = this.listService.errorMessage;
  protected readonly isEmpty = this.listService.isEmpty;
  protected readonly hasActiveFilters = this.listService.hasActiveFilters;
  protected readonly totalItems = this.listService.totalItems;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  public ngOnInit(): void {
    this.listService.load();
  }

  protected reload(): void {
    this.listService.load();
  }

  protected onSearch(term: string): void {
    this.listService.search(term);
  }

  protected onTagChange(tag: string | null): void {
    this.listService.patchQuery({ tag, page: 1 });
  }

  protected onChannelChange(channel: 'all' | 'email' | 'phone'): void {
    this.listService.patchQuery({
      hasEmail: channel === 'email' ? true : null,
      hasPhone: channel === 'phone' ? true : null,
      page: 1,
    });
  }

  protected onSortChange(option: ContactSortOption): void {
    this.listService.patchQuery({ sortBy: option.sortBy, sortDir: option.sortDir, page: 1 });
  }

  protected onResetFilters(): void {
    this.listService.resetFilters();
  }

  protected onPageChange(event: PageEvent): void {
    this.listService.patchQuery({ page: event.pageIndex + 1, pageSize: event.pageSize });
  }

  protected onAdd(): void {
    this.formDialog
      .open('create', null, this.tags())
      .pipe(filter((contact): contact is Contact => !!contact))
      .subscribe(() => this.listService.load());
  }

  protected onEdit(contact: Contact): void {
    this.formDialog
      .open('edit', contact, this.tags())
      .pipe(filter((updated): updated is Contact => !!updated))
      .subscribe(() => this.listService.load());
  }

  protected onDelete(contact: Contact): void {
    this.confirmDialog
      .confirm({
        title: `Delete ${contact.name}?`,
        message:
          'This removes the contact from your workspace. Past calls and emails are kept in your history.',
        confirmLabel: 'Delete contact',
        destructive: true,
      })
      .pipe(filter((confirmed): confirmed is true => confirmed === true))
      .subscribe(() => this.listService.delete(contact));
  }

  /**
   * Calling and email composition arrive in their own phases. Rather than
   * pretending, tell the user exactly where the capability is coming from.
   */
  protected onCall(contact: Contact): void {
    this.notificationService.info(
      `Calling ${contact.name} becomes available when the telephony phase is enabled.`,
    );
  }

  protected onEmail(contact: Contact): void {
    this.notificationService.info(
      `Emailing ${contact.name} becomes available once a Gmail account is connected.`,
    );
  }
}

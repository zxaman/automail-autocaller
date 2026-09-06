import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

import { AppError } from '../../../core/models/api-error.model';
import type { PagedData } from '../../../core/models/api-response.model';
import { NotificationService } from '../../../core/services/notification.service';
import type { Contact } from '../models/contact.model';
import { DEFAULT_CONTACT_QUERY, type ContactQuery } from '../models/contact-query.model';
import { ContactService } from '../services/contact.service';

type ListStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * View state for the contact list: query parameters, results, and status.
 *
 * Provided per-route rather than in root so navigating away disposes the state
 * and no stale results are shown on return.
 */
@Injectable()
export class ContactListPageService {
  private readonly contactService = inject(ContactService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly querySignal = signal<ContactQuery>(DEFAULT_CONTACT_QUERY);
  private readonly resultSignal = signal<PagedData<Contact> | null>(null);
  private readonly statusSignal = signal<ListStatus>('idle');
  private readonly errorSignal = signal<string | null>(null);
  private readonly tagsSignal = signal<readonly string[]>([]);

  /** Search keystrokes are debounced; other changes reload immediately. */
  private readonly searchInput$ = new Subject<string>();
  private readonly reload$ = new Subject<void>();

  public readonly query = this.querySignal.asReadonly();
  public readonly tags = this.tagsSignal.asReadonly();
  public readonly contacts = computed<readonly Contact[]>(() => this.resultSignal()?.items ?? []);
  public readonly pagination = computed(() => this.resultSignal()?.pagination ?? null);
  public readonly isLoading = computed(() => this.statusSignal() === 'loading');
  public readonly hasError = computed(() => this.statusSignal() === 'error');
  public readonly errorMessage = this.errorSignal.asReadonly();
  public readonly totalItems = computed(() => this.pagination()?.totalItems ?? 0);

  /** Distinguishes "no contacts at all" from "no results for these filters". */
  public readonly isEmpty = computed(
    () => this.statusSignal() === 'loaded' && this.contacts().length === 0,
  );
  public readonly hasActiveFilters = computed(() => {
    const query = this.querySignal();
    return (
      query.search.trim().length > 0 ||
      query.tag !== null ||
      query.source !== null ||
      query.hasEmail !== null ||
      query.hasPhone !== null
    );
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.patchQuery({ search, page: 1 }));

    this.reload$
      .pipe(
        tap(() => {
          this.statusSignal.set('loading');
          this.errorSignal.set(null);
        }),
        // switchMap cancels an in-flight request so fast filtering cannot
        // render a stale response after a newer one.
        switchMap(() => this.contactService.list(this.querySignal())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.resultSignal.set(result);
          this.statusSignal.set('loaded');
        },
        error: (error: unknown) => {
          this.errorSignal.set(
            error instanceof AppError ? error.message : 'Contacts could not be loaded.',
          );
          this.statusSignal.set('error');
        },
      });
  }

  public load(): void {
    this.reload$.next();
    this.loadTags();
  }

  public search(term: string): void {
    this.searchInput$.next(term);
  }

  public patchQuery(patch: Partial<ContactQuery>): void {
    this.querySignal.update((current) => ({ ...current, ...patch }));
    this.reload$.next();
  }

  public goToPage(page: number): void {
    this.patchQuery({ page });
  }

  public resetFilters(): void {
    this.querySignal.set(DEFAULT_CONTACT_QUERY);
    this.reload$.next();
  }

  public delete(contact: Contact): void {
    this.contactService
      .delete(contact.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificationService.success(`${contact.name} was deleted.`);
          this.afterMutation();
        },
        error: (error: unknown) =>
          this.notificationService.error(
            error instanceof AppError ? error.message : 'The contact could not be deleted.',
          ),
      });
  }

  /** Steps back a page when the last item on the final page is removed. */
  public afterMutation(): void {
    const pagination = this.pagination();
    const isLastItemOnPage = this.contacts().length === 1 && this.querySignal().page > 1;
    if (pagination && isLastItemOnPage) {
      this.patchQuery({ page: this.querySignal().page - 1 });
      return;
    }
    this.load();
  }

  private loadTags(): void {
    this.contactService
      .listTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.tagsSignal.set(result.tags),
        error: () => this.tagsSignal.set([]),
      });
  }
}

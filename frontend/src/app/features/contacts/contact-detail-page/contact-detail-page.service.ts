import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AppError } from '../../../core/models/api-error.model';
import {
  errorState,
  idleState,
  loadedState,
  loadingState,
  type AsyncState,
} from '../../../core/models/ui-state.model';
import type { Contact } from '../models/contact.model';
import { ContactService } from '../services/contact.service';

/** Loads and holds a single contact for the profile page. */
@Injectable()
export class ContactDetailPageService {
  private readonly contactService = inject(ContactService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stateSignal = signal<AsyncState<Contact>>(idleState());

  public readonly contact = computed(() => this.stateSignal().data);
  public readonly isLoading = computed(() => this.stateSignal().status === 'loading');
  public readonly hasError = computed(() => this.stateSignal().status === 'error');
  public readonly errorMessage = computed(() => this.stateSignal().error);
  /** A contact in another workspace is reported as not found by the API. */
  public readonly notFound = signal(false);

  public load(contactId: string): void {
    this.stateSignal.update((previous) => loadingState(previous));
    this.notFound.set(false);

    this.contactService
      .getById(contactId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (contact) => this.stateSignal.set(loadedState(contact)),
        error: (error: unknown) => {
          if (error instanceof AppError && error.isNotFound) {
            this.notFound.set(true);
          }
          this.stateSignal.set(
            errorState(
              error instanceof AppError ? error.message : 'The contact could not be loaded.',
            ),
          );
        },
      });
  }

  public set(contact: Contact): void {
    this.stateSignal.set(loadedState(contact));
  }
}

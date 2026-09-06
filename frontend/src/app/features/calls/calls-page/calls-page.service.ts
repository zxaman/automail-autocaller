import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppError } from '../../../core/models/api-error.model';
import { NotificationService } from '../../../core/services/notification.service';
import { DEFAULT_CONTACT_QUERY } from '../../contacts/models/contact-query.model';
import type { Contact } from '../../contacts/models/contact.model';
import { ContactService } from '../../contacts/services/contact.service';
import {
  isTerminalCallStatus,
  type CallControls,
  type CallRecord,
} from '../models/call.model';
import { CallService } from '../services/call.service';

/** How often a live call is reconciled with the provider. */
const POLL_INTERVAL_MS = 3000;

/** Where the agent's own number is remembered between sessions. */
const AGENT_NUMBER_KEY = 'autocall.agentNumber';

/**
 * Calling view state, including the manual queue.
 *
 * The queue never advances on its own. Auto-dialling a contact list is both a
 * regulatory problem and a bad experience, so moving to the next contact is
 * always an explicit action.
 */
@Injectable()
export class CallsPageService {
  private readonly callService = inject(CallService);
  private readonly contactService = inject(ContactService);
  private readonly notifications = inject(NotificationService);

  private readonly contactsSignal = signal<readonly Contact[]>([]);
  private readonly queueSignal = signal<readonly Contact[]>([]);
  private readonly queueIndexSignal = signal(0);
  private readonly historySignal = signal<readonly CallRecord[]>([]);

  private readonly agentNumberSignal = signal(this.readStoredAgentNumber());
  private readonly activeCallSignal = signal<CallRecord | null>(null);
  private readonly controlsSignal = signal<CallControls | null>(null);
  private readonly instructionSignal = signal<string | null>(null);

  private readonly isLoadingSignal = signal(false);
  private readonly isStartingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  public readonly contacts = this.contactsSignal.asReadonly();
  public readonly queue = this.queueSignal.asReadonly();
  public readonly queueIndex = this.queueIndexSignal.asReadonly();
  public readonly history = this.historySignal.asReadonly();
  public readonly agentNumber = this.agentNumberSignal.asReadonly();
  public readonly activeCall = this.activeCallSignal.asReadonly();
  public readonly controls = this.controlsSignal.asReadonly();
  public readonly instruction = this.instructionSignal.asReadonly();
  public readonly isLoading = this.isLoadingSignal.asReadonly();
  public readonly isStarting = this.isStartingSignal.asReadonly();
  public readonly errorMessage = this.errorSignal.asReadonly();

  public readonly currentQueueContact = computed(
    () => this.queueSignal()[this.queueIndexSignal()] ?? null,
  );

  public readonly queueRemaining = computed(() =>
    Math.max(0, this.queueSignal().length - this.queueIndexSignal()),
  );

  public readonly isCallLive = computed(() => {
    const call = this.activeCallSignal();
    return call !== null && !isTerminalCallStatus(call.status);
  });

  public readonly canStartCall = computed(
    () => this.agentNumberSignal().trim().length >= 7 && !this.isCallLive() && !this.isStartingSignal(),
  );

  public async load(): Promise<void> {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const [contacts, history] = await Promise.all([
        firstValueFrom(
          this.contactService.list({ ...DEFAULT_CONTACT_QUERY, page: 1, pageSize: 100 }),
        ),
        firstValueFrom(this.callService.list({ page: 1, pageSize: 20 })),
      ]);

      this.contactsSignal.set(contacts.items);
      this.historySignal.set(history.items);
    } catch (error) {
      this.errorSignal.set(this.messageFor(error, 'Calling could not be loaded'));
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  public setAgentNumber(value: string): void {
    this.agentNumberSignal.set(value);

    // Only the agent's own number, which they typed. No contact data is stored.
    try {
      localStorage.setItem(AGENT_NUMBER_KEY, value);
    } catch {
      // Storage may be unavailable; remembering the number is a convenience.
    }
  }

  /** Builds the queue from contacts that actually have a phone number. */
  public buildQueue(contactIds: readonly string[]): void {
    const selected = new Set(contactIds);
    const queue = this.contactsSignal().filter(
      (contact) => selected.has(contact.id) && contact.phone,
    );

    this.queueSignal.set(queue);
    this.queueIndexSignal.set(0);
  }

  public queueAllWithPhone(): void {
    this.queueSignal.set(this.contactsSignal().filter((contact) => contact.phone));
    this.queueIndexSignal.set(0);
  }

  public clearQueue(): void {
    this.queueSignal.set([]);
    this.queueIndexSignal.set(0);
  }

  /**
   * Advances the queue. Called only from an explicit user action — never
   * automatically when a call ends.
   */
  public skipToNext(): void {
    if (this.queueIndexSignal() < this.queueSignal().length) {
      this.queueIndexSignal.set(this.queueIndexSignal() + 1);
      this.activeCallSignal.set(null);
      this.instructionSignal.set(null);
    }
  }

  public async callContact(contactId: string): Promise<void> {
    if (!this.canStartCall()) {
      return;
    }

    this.isStartingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const result = await firstValueFrom(
        this.callService.start({
          contactId,
          agentNumber: this.agentNumberSignal().trim(),
        }),
      );

      this.activeCallSignal.set(result.call);
      this.controlsSignal.set(result.controls);
      this.instructionSignal.set(result.instruction);
      this.startPolling();
    } catch (error) {
      this.notifications.error(this.messageFor(error, 'The call could not be started'));
    } finally {
      this.isStartingSignal.set(false);
    }
  }

  public async callCurrentQueueContact(): Promise<void> {
    const contact = this.currentQueueContact();

    if (contact) {
      await this.callContact(contact.id);
    }
  }

  public async cancelActiveCall(): Promise<void> {
    const call = this.activeCallSignal();

    if (!call) {
      return;
    }

    try {
      const updated = await firstValueFrom(this.callService.cancel(call.id));
      this.activeCallSignal.set(updated);
      this.stopPolling();
      await this.refreshHistory();
    } catch (error) {
      this.notifications.error(this.messageFor(error, 'The call could not be canceled'));
    }
  }

  /**
   * Reconciles the live call with the provider.
   *
   * Webhooks can be lost, so without polling a call could appear to ring
   * forever. Polling stops as soon as the call reaches a terminal state.
   */
  private startPolling(): void {
    this.stopPolling();

    this.pollTimer = setInterval(() => {
      void this.pollActiveCall();
    }, POLL_INTERVAL_MS);
  }

  private async pollActiveCall(): Promise<void> {
    const call = this.activeCallSignal();

    if (!call || isTerminalCallStatus(call.status)) {
      this.stopPolling();
      return;
    }

    try {
      const updated = await firstValueFrom(this.callService.refresh(call.id));
      this.activeCallSignal.set(updated);

      if (isTerminalCallStatus(updated.status)) {
        this.stopPolling();
        // The queue does not advance here: that stays a user decision.
        await this.refreshHistory();
      }
    } catch {
      // A failed poll is not worth interrupting the user; the next tick retries.
    }
  }

  public stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public async refreshHistory(): Promise<void> {
    try {
      const history = await firstValueFrom(this.callService.list({ page: 1, pageSize: 20 }));
      this.historySignal.set(history.items);
    } catch {
      // History is secondary to the live call.
    }
  }

  private readStoredAgentNumber(): string {
    try {
      return localStorage.getItem(AGENT_NUMBER_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private messageFor(error: unknown, fallback: string): string {
    return error instanceof AppError ? error.message : fallback;
  }
}

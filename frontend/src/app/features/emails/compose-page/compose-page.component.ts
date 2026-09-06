import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiEmptyStateComponent } from '../../../shared/components/ui-empty-state/ui-empty-state.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiLoadingSpinnerComponent } from '../../../shared/components/ui-loading-spinner/ui-loading-spinner.component';
import { UiStatusBadgeComponent } from '../../../shared/components/ui-status-badge/ui-status-badge.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { TEMPLATE_VARIABLES } from '../models/email.model';
import { ComposePageService } from './compose-page.service';

/**
 * AutoMail composer.
 *
 * The preview is rendered from server-sanitized HTML; the client never
 * sanitizes on its own behalf, so both sides agree on what will be sent.
 */
@Component({
  selector: 'app-compose-page',
  standalone: true,
  imports: [
    UiButtonComponent,
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiLoadingSpinnerComponent,
    UiStatusBadgeComponent,
    RelativeTimePipe,
  ],
  providers: [ComposePageService],
  templateUrl: './compose-page.component.html',
  styleUrl: './compose-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposePageComponent implements OnInit {
  protected readonly state = inject(ComposePageService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly variables = TEMPLATE_VARIABLES;

  public ngOnInit(): void {
    void this.state.load();
  }

  protected onSubjectInput(event: Event): void {
    this.state.setSubject((event.target as HTMLInputElement).value);
  }

  protected onBodyInput(event: Event): void {
    this.state.setBodyHtml((event.target as HTMLTextAreaElement).value);
  }

  protected onTemplateChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.state.applyTemplate(value || null);
  }

  protected onSignatureChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.state.setSignature(value || null);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      void this.state.uploadAttachment(file);
    }

    // Clearing lets the same file be chosen again after an error.
    input.value = '';
  }

  /** Appends a variable token to the body so users need not type the syntax. */
  protected insertVariable(token: string): void {
    this.state.setBodyHtml(`${this.state.bodyHtml()}${token}`);
  }

  /**
   * The preview HTML was sanitized on the server, which is the same content
   * that will be sent. Marking it trusted here renders the true result rather
   * than a second, differently-filtered version.
   */
  protected trustedPreview(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

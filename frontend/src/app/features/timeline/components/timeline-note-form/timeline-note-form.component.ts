import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button.component';

/** Small composer for adding a note to a contact's timeline. */
@Component({
  selector: 'app-timeline-note-form',
  standalone: true,
  imports: [UiButtonComponent],
  templateUrl: './timeline-note-form.component.html',
  styleUrl: './timeline-note-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineNoteFormComponent {
  public readonly isSaving = input<boolean>(false);
  public readonly noteSubmitted = output<string>();

  protected readonly body = signal('');

  protected readonly maxLength = 5000;

  protected onInput(event: Event): void {
    this.body.set((event.target as HTMLTextAreaElement).value);
  }

  protected canSubmit(): boolean {
    return this.body().trim().length > 0 && !this.isSaving();
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }

    this.noteSubmitted.emit(this.body().trim());
    this.body.set('');
  }
}

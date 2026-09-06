import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import {
  ACCEPTED_IMPORT_EXTENSIONS,
  MAX_IMPORT_FILE_BYTES,
} from '../../models/import.model';

/** Drag-and-drop file chooser with client-side type and size checks. */
@Component({
  selector: 'app-import-file-drop',
  standalone: true,
  templateUrl: './import-file-drop.component.html',
  styleUrl: './import-file-drop.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportFileDropComponent {
  public readonly disabled = input(false);
  public readonly fileSelected = output<File>();

  protected readonly isDragging = signal(false);
  protected readonly validationError = signal<string | null>(null);
  protected readonly accept = ACCEPTED_IMPORT_EXTENSIONS.join(',');

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) {
      this.isDragging.set(true);
    }
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    if (this.disabled()) {
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.accept_(file);
    }
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.accept_(file);
    }
    // Reset so choosing the same file twice still fires a change event.
    input.value = '';
  }

  /** Fails fast in the browser so an obviously wrong file never costs a round trip. */
  private accept_(file: File): void {
    const name = file.name.toLowerCase();
    const hasValidExtension = ACCEPTED_IMPORT_EXTENSIONS.some((extension) =>
      name.endsWith(extension),
    );

    if (!hasValidExtension) {
      this.validationError.set('Choose an .xlsx, .xls, or .csv file.');
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      this.validationError.set('The file is larger than the 10 MB limit.');
      return;
    }

    if (file.size === 0) {
      this.validationError.set('That file is empty.');
      return;
    }

    this.validationError.set(null);
    this.fileSelected.emit(file);
  }
}

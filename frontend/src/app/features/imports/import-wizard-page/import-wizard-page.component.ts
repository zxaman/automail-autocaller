import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';
import { ImportColumnMapperComponent } from '../components/import-column-mapper/import-column-mapper.component';
import { ImportFileDropComponent } from '../components/import-file-drop/import-file-drop.component';
import { ImportResultSummaryComponent } from '../components/import-result-summary/import-result-summary.component';
import type { ColumnAssignment, DuplicateStrategy } from '../models/import.model';
import { WIZARD_STEPS } from './import-wizard-page.model';
import { ImportWizardPageService } from './import-wizard-page.service';

/** Three-step contact import: upload, confirm the mapping, review the result. */
@Component({
  selector: 'app-import-wizard-page',
  standalone: true,
  imports: [
    UiButtonComponent,
    UiCardComponent,
    UiErrorStateComponent,
    UiPageHeaderComponent,
    ImportColumnMapperComponent,
    ImportFileDropComponent,
    ImportResultSummaryComponent,
  ],
  providers: [ImportWizardPageService],
  templateUrl: './import-wizard-page.component.html',
  styleUrl: './import-wizard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportWizardPageComponent {
  private readonly wizard = inject(ImportWizardPageService);
  private readonly router = inject(Router);

  protected readonly steps = WIZARD_STEPS;
  protected readonly strategies: readonly {
    value: DuplicateStrategy;
    label: string;
    description: string;
  }[] = [
    { value: 'skip', label: 'Skip', description: 'Keep the existing contact unchanged' },
    { value: 'update', label: 'Update', description: 'Overwrite the existing contact with this row' },
    { value: 'import', label: 'Import anyway', description: 'Add the row as a separate contact' },
  ];

  protected readonly step = this.wizard.step;
  protected readonly analysis = this.wizard.analysis;
  protected readonly mapping = this.wizard.mapping;
  protected readonly result = this.wizard.result;
  protected readonly isAnalyzing = this.wizard.isAnalyzing;
  protected readonly isCommitting = this.wizard.isCommitting;
  protected readonly errorMessage = this.wizard.errorMessage;
  protected readonly duplicateStrategy = this.wizard.duplicateStrategy;
  protected readonly unconfirmedCount = this.wizard.unconfirmedCount;
  protected readonly canCommit = this.wizard.canCommit;
  protected readonly hasName = this.wizard.hasName;
  protected readonly hasChannel = this.wizard.hasChannel;

  protected onFileSelected(file: File): void {
    this.wizard.analyzeFile(file);
  }

  protected onFieldAssigned(event: { columnIndex: number; field: ColumnAssignment }): void {
    this.wizard.assignField(event.columnIndex, event.field);
  }

  protected onSuggestionConfirmed(columnIndex: number): void {
    this.wizard.confirmSuggestion(columnIndex);
  }

  protected confirmAll(): void {
    this.wizard.confirmAllSuggestions();
  }

  protected setStrategy(strategy: DuplicateStrategy): void {
    this.wizard.setDuplicateStrategy(strategy);
  }

  protected onTagsInput(value: string): void {
    this.wizard.setTags(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
    );
  }

  protected commit(): void {
    this.wizard.commit();
  }

  protected back(): void {
    this.wizard.backToUpload();
  }

  protected importAnother(): void {
    this.wizard.reset();
  }

  protected viewContacts(): void {
    void this.router.navigate(['/contacts']);
  }

  protected isStepActive(stepId: string): boolean {
    return this.step() === stepId;
  }

  protected isStepComplete(stepId: string): boolean {
    const sequence = this.steps.map((entry) => entry.id);
    return sequence.indexOf(stepId as never) < sequence.indexOf(this.step());
  }
}

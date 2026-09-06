import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button.component';
import { UiIconComponent } from '../../../../shared/components/ui-icon/ui-icon.component';
import {
  CONTACT_SORT_OPTIONS,
  type ContactQuery,
  type ContactSortOption,
} from '../../models/contact-query.model';

/**
 * Search, tag filter, and sort controls for the contact list.
 * Purely presentational: it emits changes and the page owns the query state.
 */
@Component({
  selector: 'app-contact-filters',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    UiButtonComponent,
    UiIconComponent,
  ],
  templateUrl: './contact-filters.component.html',
  styleUrl: './contact-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFiltersComponent {
  public readonly query = input.required<ContactQuery>();
  public readonly tags = input<readonly string[]>([]);
  public readonly hasActiveFilters = input<boolean>(false);
  public readonly resultCount = input<number>(0);

  public readonly searchChanged = output<string>();
  public readonly tagChanged = output<string | null>();
  public readonly channelChanged = output<'all' | 'email' | 'phone'>();
  public readonly sortChanged = output<ContactSortOption>();
  public readonly filtersReset = output<void>();

  protected readonly sortOptions = CONTACT_SORT_OPTIONS;

  /** Collapses the two independent flags into one user-facing choice. */
  protected get channel(): 'all' | 'email' | 'phone' {
    const query = this.query();
    if (query.hasEmail === true) {
      return 'email';
    }
    if (query.hasPhone === true) {
      return 'phone';
    }
    return 'all';
  }

  protected get activeSortLabel(): string {
    const query = this.query();
    return (
      this.sortOptions.find(
        (option) => option.sortBy === query.sortBy && option.sortDir === query.sortDir,
      )?.label ?? 'Newest first'
    );
  }

  protected onSortSelected(label: string): void {
    const option = this.sortOptions.find((item) => item.label === label);
    if (option) {
      this.sortChanged.emit(option);
    }
  }
}

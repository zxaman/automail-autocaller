import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';

/** Contacts feature shell. Data behaviour is delivered in Phase 6. */
@Component({
  selector: 'app-contacts-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent],
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPageComponent {
  protected readonly phase = 'Phase 6';
  protected readonly summary = 'Contact CRUD, search, filtering, pagination, and the contact profile timeline.';
  protected readonly capabilities: readonly string[] = [
        'Create, edit, and delete contacts',
        'Server-side search, sort, filter, and pagination',
        'Tags, notes, and import batch source',
        'Contact profile with communication timeline',  ];
}

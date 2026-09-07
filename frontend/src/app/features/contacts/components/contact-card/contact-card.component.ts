import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { UiAvatarComponent } from '../../../../shared/components/ui-avatar/ui-avatar.component';
import { UiIconComponent } from '../../../../shared/components/ui-icon/ui-icon.component';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import type { Contact } from '../../models/contact.model';

/**
 * Presentational row/card for a single contact.
 * Emits intent only; the parent page owns all data mutations.
 */
@Component({
  selector: 'app-contact-card',
  standalone: true,
  imports: [RouterLink, MatMenuModule, MatTooltipModule, UiAvatarComponent, UiIconComponent, RelativeTimePipe],
  templateUrl: './contact-card.component.html',
  styleUrl: './contact-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactCardComponent {
  public readonly contact = input.required<Contact>();

  public readonly callRequested = output<Contact>();
  public readonly emailRequested = output<Contact>();
  public readonly editRequested = output<Contact>();
  public readonly deleteRequested = output<Contact>();
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationService } from '../../../core/services/notification.service';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

/** Renders the global notification queue. Mounted once in the app shell. */
@Component({
  selector: 'app-ui-toast-host',
  standalone: true,
  imports: [UiIconComponent],
  templateUrl: './ui-toast-host.component.html',
  styleUrl: './ui-toast-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiToastHostComponent {
  private readonly notificationService = inject(NotificationService);

  protected readonly notifications = this.notificationService.notifications;

  protected dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NetworkStatusService } from '../../../core/platform/network-status.service';

/**
 * Tells the user when the device has no connection.
 *
 * Shown app-wide because this product places real calls and sends real email:
 * discovering the network was down only after pressing Call is a worse
 * experience than being told beforehand.
 */
@Component({
  selector: 'app-ui-offline-banner',
  standalone: true,
  templateUrl: './ui-offline-banner.component.html',
  styleUrl: './ui-offline-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiOfflineBannerComponent {
  protected readonly network = inject(NetworkStatusService);
}

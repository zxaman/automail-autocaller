import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { AppFeatureFlags } from '../../../environments/environment.model';

/** Reads build-time feature flags. Server-driven flags can replace this later. */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  public isEnabled(flag: keyof AppFeatureFlags | undefined): boolean {
    if (!flag) {
      return true;
    }
    return environment.featureFlags[flag];
  }
}

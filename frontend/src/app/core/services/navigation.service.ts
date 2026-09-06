import { Injectable, computed, inject } from '@angular/core';

import { PRIMARY_NAVIGATION } from '../config/navigation.config';
import type { NavigationItem } from '../models/navigation.model';
import { FeatureFlagService } from './feature-flag.service';

/** Provides the navigation items that the current build should expose. */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly featureFlags = inject(FeatureFlagService);

  public readonly items = computed<readonly NavigationItem[]>(() =>
    PRIMARY_NAVIGATION.filter((item) => this.featureFlags.isEnabled(item.featureFlag)),
  );

  public readonly mobileItems = computed<readonly NavigationItem[]>(() =>
    this.items().filter((item) => item.primary),
  );

  public findByUrl(url: string): NavigationItem | null {
    return this.items().find((item) => url.startsWith(item.route)) ?? null;
  }
}

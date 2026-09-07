import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NavigationService } from './navigation.service';

describe('NavigationService', () => {
  function createService(): NavigationService {
    TestBed.configureTestingModule({});
    return TestBed.inject(NavigationService);
  }

  it('exposes the primary navigation items', () => {
    const service = createService();
    const routes = service.items().map((item) => item.route);
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/contacts');
    expect(routes).toContain('/settings');
  });

  it('limits mobile navigation to primary destinations', () => {
    const service = createService();
    expect(service.mobileItems().length).toBeLessThan(service.items().length);
    expect(service.mobileItems().every((item) => item.primary)).toBe(true);
  });

  it('resolves the active item from a url', () => {
    const service = createService();
    expect(service.findByUrl('/contacts/123')?.id).toBe('contacts');
    expect(service.findByUrl('/unknown')).toBeNull();
  });
});

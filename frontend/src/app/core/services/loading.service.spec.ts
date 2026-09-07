import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  function createService(): LoadingService {
    TestBed.configureTestingModule({});
    return TestBed.inject(LoadingService);
  }

  it('reports loading while requests are active', () => {
    const service = createService();
    expect(service.isLoading()).toBe(false);
    service.start();
    service.start();
    expect(service.isLoading()).toBe(true);
    service.stop();
    expect(service.isLoading()).toBe(true);
    service.stop();
    expect(service.isLoading()).toBe(false);
  });

  it('never drops below zero', () => {
    const service = createService();
    service.stop();
    expect(service.isLoading()).toBe(false);
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  function createService(): NotificationService {
    TestBed.configureTestingModule({});
    return TestBed.inject(NotificationService);
  }

  it('queues notifications with a tone', () => {
    const service = createService();
    service.success('Saved', 0);
    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0]?.tone).toBe('success');
  });

  it('dismisses a notification by id', () => {
    const service = createService();
    service.error('Failed', 0);
    const id = service.notifications()[0]!.id;
    service.dismiss(id);
    expect(service.notifications()).toHaveLength(0);
  });
});

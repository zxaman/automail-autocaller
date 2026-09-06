import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiUrlService } from './api-url.service';
import { PlatformService } from './platform.service';
import { SecureStorageService } from './secure-storage.service';

describe('PlatformService', () => {
  const configure = (platform: string) => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(PlatformService);
  };

  it('reports the web platform in a browser', () => {
    const service = configure('web');

    expect(service.platform).toBe('web');
    expect(service.isNative).toBe(false);
  });

  it('reports android as native', () => {
    const service = configure('android');

    expect(service.platform).toBe('android');
    expect(service.isNative).toBe(true);
  });

  it('treats an unrecognised platform as web rather than guessing', () => {
    const service = configure('electron');

    expect(service.platform).toBe('web');
  });

  it('never claims in-app voice on any platform', () => {
    // Calls are bridged provider-side and answered on the handset dialler,
    // so no build may present itself as capable of carrying call audio.
    for (const platform of ['web', 'android', 'ios']) {
      const service = configure(platform);

      expect(service.capabilities().hasInAppVoice).toBe(false);
      expect(service.capabilities().needsMicrophonePermission).toBe(false);
    }
  });

  it('offers secure storage only on native', () => {
    expect(configure('web').capabilities().hasSecureStorage).toBe(false);
    expect(configure('ios').capabilities().hasSecureStorage).toBe(true);
  });
});

describe('SecureStorageService', () => {
  const configure = (platform: string) => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(SecureStorageService);
  };

  it('is unavailable on the web', () => {
    expect(configure('web').isAvailable).toBe(false);
  });

  it('refuses to write on the web instead of falling back to localStorage', async () => {
    const storage = configure('web');

    const written = await storage.set('session', 'secret-value');

    expect(written).toBe(false);
    expect(await storage.get('session')).toBeNull();
    // A localStorage fallback would weaken the web build to match mobile.
    expect(localStorage.getItem('session')).toBeNull();
  });
});

describe('ApiUrlService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  const configure = (platform: string) => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    TestBed.configureTestingModule({});
    return TestBed.inject(ApiUrlService);
  };

  it('keeps API paths relative on the web so the cookie stays first-party', () => {
    const service = configure('web');

    expect(service.resolve('/contacts')).toBe('/api/v1/contacts');
  });

  it('uses an absolute origin on native, where a relative path is the device', () => {
    const service = configure('android');

    expect(service.resolve('/contacts')).toMatch(/^https?:\/\/.+\/api\/v1\/contacts$/);
  });

  it('normalizes a path given without a leading slash', () => {
    const service = configure('web');

    expect(service.resolve('contacts')).toBe('/api/v1/contacts');
  });
});

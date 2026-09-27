import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PeerProgressDisplayPreferenceService} from './peer-progress-display-preference.service';

describe('PeerProgressDisplayPreferenceService', () => {
  let currentUser: {id: number} | null;
  let service: PeerProgressDisplayPreferenceService;

  beforeEach(() => {
    const values: Map<string, string> = new Map();
    vi.stubGlobal('localStorage', {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
    currentUser = {id: 41};
    service = new PeerProgressDisplayPreferenceService({
      get currentUser() {
        return currentUser;
      },
    } as never);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('persists Advanced under the authenticated user only', () => {
    expect(service.enabled).toBe(false);

    expect(service.setEnabled(true)).toBe(true);
    expect(service.enabled).toBe(true);
    expect(localStorage.getItem(PeerProgressDisplayPreferenceService.storageKeyFor(41))).toBe(
      'true',
    );

    currentUser = {id: 42};
    expect(service.enabled).toBe(false);
    expect(localStorage.getItem(PeerProgressDisplayPreferenceService.storageKeyFor(42))).toBeNull();
  });

  it('survives a new service instance until the same user turns it off', () => {
    service.setEnabled(true);

    const reopened = new PeerProgressDisplayPreferenceService({
      get currentUser() {
        return currentUser;
      },
    } as never);

    expect(reopened.enabled).toBe(true);
    expect(reopened.setEnabled(false)).toBe(false);
    expect(service.enabled).toBe(false);
  });

  it('fails closed and writes nothing before authentication is available', () => {
    currentUser = null;

    expect(service.enabled).toBe(false);
    expect(service.setEnabled(true)).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});

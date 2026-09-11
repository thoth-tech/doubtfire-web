import {beforeEach, describe, expect, it} from 'vitest';
import {DEMO_MODE_STORAGE_KEY, DemoModeStore} from './demo-mode.store';

describe('DemoModeStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is available but defaults off in a development demo build', () => {
    const store = new DemoModeStore(true);

    expect(store.available).toBe(true);
    expect(store.enabled).toBe(false);
    expect(store.shouldMaskApiData).toBe(true);
  });

  it('persists the enabled state in session storage', () => {
    const firstStore = new DemoModeStore(true);
    firstStore.setEnabled(true);

    expect(sessionStorage.getItem(DEMO_MODE_STORAGE_KEY)).toBe('true');
    expect(new DemoModeStore(true).enabled).toBe(true);
  });

  it('reset fails closed and removes the stored state', () => {
    const store = new DemoModeStore(true);
    store.setEnabled(true);

    store.reset();

    expect(store.enabled).toBe(false);
    expect(sessionStorage.getItem(DEMO_MODE_STORAGE_KEY)).toBeNull();
  });

  it('cannot enable in production and leaves genuine API data unmasked', () => {
    sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
    const store = new DemoModeStore(false);

    store.setEnabled(true);

    expect(store.available).toBe(false);
    expect(store.enabled).toBe(false);
    expect(store.shouldMaskApiData).toBe(false);
    expect(sessionStorage.getItem(DEMO_MODE_STORAGE_KEY)).toBeNull();
  });
});

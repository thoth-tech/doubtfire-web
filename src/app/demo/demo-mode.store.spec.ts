import {beforeEach, describe, expect, it} from 'vitest';
import {DEMO_MODE_STORAGE_KEY, DemoModeStore} from './demo-mode.store';

describe('DemoModeStore', () => {
  beforeEach(() => sessionStorage.clear());

  it('is unavailable until the guarded scenario contract is loaded', () => {
    const store = new DemoModeStore(true);

    expect(store.available).toBe(false);
    expect(store.enabled).toBe(false);
  });

  it('stores the enabled state under the user and scenario namespace', () => {
    const firstStore = new DemoModeStore(true);
    firstStore.configureScenario('mobile-feedback-v1', 42);
    firstStore.setEnabled(true);

    const key = DEMO_MODE_STORAGE_KEY + ':mobile-feedback-v1:uid42';
    expect(sessionStorage.getItem(key)).toBe('true');

    const restoredStore = new DemoModeStore(true);
    restoredStore.configureScenario('mobile-feedback-v1', 42);
    expect(restoredStore.enabled).toBe(true);

    const otherUserStore = new DemoModeStore(true);
    otherUserStore.configureScenario('mobile-feedback-v1', 43);
    expect(otherUserStore.enabled).toBe(false);
  });

  it('disables without changing scenario availability and clears fully on sign out', () => {
    const store = new DemoModeStore(true);
    store.configureScenario('mobile-feedback-v1', 42);
    store.setEnabled(true);

    store.reset();
    expect(store.available).toBe(true);
    expect(store.enabled).toBe(false);

    store.clearScenario();
    expect(store.available).toBe(false);
  });

  it('cannot configure or enable when demo tools are not compiled in', () => {
    const store = new DemoModeStore(false);
    store.configureScenario('mobile-feedback-v1', 42);
    store.setEnabled(true);

    expect(store.available).toBe(false);
    expect(store.enabled).toBe(false);
  });
});

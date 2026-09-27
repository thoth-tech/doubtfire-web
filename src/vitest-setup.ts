import {vi} from 'vitest';
import 'zone.js/plugins/vitest-patch';

// The full Angular suite compiles and instantiates many large TestBed modules in
// parallel. Give those hooks enough headroom under CI load while keeping a
// finite timeout so genuine hangs still fail the run.
vi.setConfig({
  hookTimeout: 30_000,
  testTimeout: 30_000,
});

// Node 22.4 added its own localStorage, gated behind --localstorage-file, so on
// Node 24 and up globalThis.localStorage exists as a getter that returns
// undefined. Vitest's jsdom environment skips any key already present on the
// global, so jsdom's real localStorage is never copied across and every spec
// that touches it fails on the first line. sessionStorage is unaffected, which
// is what makes the failure look like a jsdom bug rather than a Node one.
//
// CI is on Node 22 without the flag, so it never sees this. Give local runs a
// working store so the suite means the same thing on both.
if (typeof globalThis.localStorage === 'undefined') {
  const store: Map<string, string> = new Map();

  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(String(key)) ? store.get(String(key))! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => void store.delete(String(key)),
    setItem: (key, value) => void store.set(String(key), String(value)),
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
    writable: true,
  });
}

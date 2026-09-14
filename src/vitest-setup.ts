import {vi} from 'vitest';
import 'zone.js/plugins/vitest-patch';

// The full Angular suite compiles and instantiates many large TestBed modules in
// parallel. Give those hooks enough headroom under CI load while keeping a
// finite timeout so genuine hangs still fail the run.
vi.setConfig({
  hookTimeout: 30_000,
  testTimeout: 30_000,
});

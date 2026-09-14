import {describe, expect, it} from 'vitest';
import {environment} from './environment.prod';

describe('production environment', () => {
  it('fails closed for demos and unresolved optional telemetry settings', () => {
    expect(environment.production).toBe(true);
    expect(environment.enableDemoTools).toBe(false);
    expect(environment.sentryDsn).toBe('');
    expect(environment.sentryRelease).toBe('');
    expect(environment.sentryDist).toBe('');
  });
});

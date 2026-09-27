import {describe, expect, it} from 'vitest';
import {Unit} from './unit';

describe('Unit.findStudent', () => {
  // Build a Unit without running the constructor so the test stays free of the
  // Angular injector, then give it a stub studentCache.
  function unitWithCache(entries: Record<number, unknown>): Unit {
    const unit = Object.create(Unit.prototype) as Unit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (unit as any).studentCache = {
      get: (key: number) => entries[key],
    };
    return unit;
  }

  it('returns the same instance the cache holds for that id', () => {
    const project = {id: 7} as unknown;
    const unit = unitWithCache({7: project});
    expect(unit.findStudent(7)).toBe(project);
  });

  it('returns undefined when no project has that id', () => {
    const unit = unitWithCache({7: {id: 7}});
    expect(unit.findStudent(99)).toBeUndefined();
  });
});

describe('Unit.findStudent (via stubbed cache)', () => {
  // Build a Unit without running the constructor so the test stays free of the
  // Angular injector, then give it a stub studentCache.
  function unitWithCache(entries: Record<number, unknown>): Unit {
    const unit = Object.create(Unit.prototype) as Unit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (unit as any).studentCache = {
      get: (key: number) => entries[key],
    };
    return unit;
  }

  it('returns the same instance the cache holds for that id', () => {
    const project = {id: 7} as unknown;
    const unit = unitWithCache({7: project});
    expect(unit.findStudent(7)).toBe(project);
  });

  it('returns undefined when no project has that id', () => {
    const unit = unitWithCache({7: {id: 7}});
    expect(unit.findStudent(99)).toBeUndefined();
  });
});

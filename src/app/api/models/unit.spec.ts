import {describe, expect, it, vi} from 'vitest';
import {Project} from './project';
import {Unit} from './unit';

describe('Unit.findStudent', () => {
  it('returns the same project instance as studentCache.get', () => {
    const unit = new Unit();
    const project = new Project(unit);

    project.id = 42;
    unit.studentCache.add(project);

    expect(unit.findStudent(42)).toBe(unit.studentCache.get(42));
  });

  it('does not scan the students array', () => {
    const unit = new Unit();
    const project = new Project(unit);

    project.id = 42;
    unit.studentCache.add(project);

    vi.spyOn(unit, 'students', 'get').mockImplementation(() => {
      throw new Error('students array was scanned');
    });

    expect(unit.findStudent(42)).toBe(project);
  });

  it('returns undefined when the student does not exist', () => {
    const unit = new Unit();

    expect(unit.findStudent(999)).toBeUndefined();
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

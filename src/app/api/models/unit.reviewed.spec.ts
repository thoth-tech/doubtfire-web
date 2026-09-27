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

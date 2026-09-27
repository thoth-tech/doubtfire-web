import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import type {Project} from 'src/app/api/models/project';
import type {Task} from 'src/app/api/models/task';
import {PortfolioCelebrationService} from './portfolio-celebration.service';

describe('PortfolioCelebrationService', () => {
  let service: PortfolioCelebrationService;
  let open: ReturnType<typeof vi.fn>;

  const build = (overrides: Partial<Project> = {}): Project =>
    ({
      unit: {code: 'SIT374', name: 'Team Project (A)', myRole: 'Student'},
      targetGradeWord: 'High Distinction',
      ...overrides,
    }) as unknown as Project;

  const tasks = (count: number): Task[] =>
    Array.from({length: count}, (_, index) => ({id: index}) as unknown as Task);

  beforeEach(() => {
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [PortfolioCelebrationService, {provide: MatDialog, useValue: {open}}],
    });
    service = TestBed.inject(PortfolioCelebrationService);
  });

  it('says what was sent and what happens next', () => {
    const data = service.describe(build(), tasks(11));

    expect(data?.unitCode).toBe('SIT374');
    expect(data?.headline).toBe('Portfolio submitted');
    expect(data?.facts).toEqual([
      {icon: 'task_alt', label: 'Work included', value: '11 tasks'},
      {icon: 'workspace_premium', label: 'Submitted for', value: 'High Distinction'},
    ]);
    expect(data?.next).toContain('email');
  });

  it('counts one task as a task, not as tasks', () => {
    const data = service.describe(build(), tasks(1));
    expect(data?.facts[0].value).toBe('1 task');
  });

  it('leaves out a fact it has no answer for', () => {
    const data = service.describe(build({targetGradeWord: undefined} as never), []);
    expect(data?.facts).toEqual([]);
  });

  it('is only for the student whose portfolio it is', () => {
    const staff = build({unit: {code: 'SIT374', myRole: 'Tutor'}} as never);

    expect(service.describe(staff, tasks(3))).toBeNull();
    expect(service.celebrate(staff, tasks(3))).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the dialog for a student and reports that it did', () => {
    expect(service.celebrate(build(), tasks(3))).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);

    // No timer: it waits to be dismissed, unlike the submission confirmation.
    const config = open.mock.calls[0][1];
    expect(config.panelClass).toBe('ot-portfolio-dialog');
    expect(config.data.facts[0].value).toBe('3 tasks');
  });

  it('never throws out of a submission that otherwise worked', () => {
    expect(service.celebrate(null as unknown as Project, tasks(2))).toBe(false);
  });
});

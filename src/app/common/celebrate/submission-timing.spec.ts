import {afterEach, describe, expect, it} from 'vitest';
import {TestBed} from '@angular/core/testing';
import type {Task} from 'src/app/api/models/task';
import {SubmissionCelebrationService} from './submission-celebration.service';
import {buildSubmissionCelebration, classifySubmissionTiming} from './submission-timing';

describe('submission timing', () => {
  const target = new Date(2026, 8, 10, 0, 0, 0);
  const due = new Date(2026, 8, 24, 0, 0, 0);

  it('counts anything up to the end of the target day as on time', () => {
    expect(classifySubmissionTiming(new Date(2026, 8, 3), target, due)).toBe('on_time');
    expect(classifySubmissionTiming(new Date(2026, 8, 10, 23, 30), target, due)).toBe('on_time');
  });

  it('is after the target once the target day has passed, until the due day ends', () => {
    expect(classifySubmissionTiming(new Date(2026, 8, 11, 0, 5), target, due)).toBe('after_target');
    expect(classifySubmissionTiming(new Date(2026, 8, 24, 22, 0), target, due)).toBe(
      'after_target',
    );
  });

  it('is after the due date once the due day has passed', () => {
    expect(classifySubmissionTiming(new Date(2026, 8, 25, 0, 1), target, due)).toBe('after_due');
  });

  it('does not invent lateness when a date is missing', () => {
    expect(classifySubmissionTiming(new Date(2026, 8, 20), undefined, due)).toBe('on_time');
    expect(classifySubmissionTiming(new Date(2026, 8, 20), target, null)).toBe('after_target');
  });

  it('celebrates an on time submission with the task named', () => {
    const view = buildSubmissionCelebration({
      timing: 'on_time',
      resubmission: false,
      abbreviation: '2.1P',
      name: 'Sorting',
    });

    expect(view.headline).toBe('Submitted on time. Ready for feedback');
    expect(view.detail).toBe('2.1P Sorting');
    expect(view.tone).toBe('success');
    expect(view.particles).toBe(true);
  });

  it('stays positive but calmer after the target date', () => {
    const view = buildSubmissionCelebration({
      timing: 'after_target',
      resubmission: false,
      abbreviation: '2.1P',
      name: 'Sorting',
    });

    expect(view.headline).toBe('Submitted. Ready for feedback');
    expect(view.detail).toContain('Your tutor will review it');
    expect(view.tone).toBe('primary');
    expect(view.particles).toBe(false);
  });

  it('is neutral with no particles after the due date', () => {
    const view = buildSubmissionCelebration({
      timing: 'after_due',
      resubmission: false,
      abbreviation: '2.1P',
      name: 'Sorting',
    });

    expect(view.headline).toBe('Submitted after the due date');
    expect(view.tone).toBe('neutral');
    expect(view.particles).toBe(false);
  });

  it('names a resubmission and keeps the same timing rules', () => {
    const onTime = buildSubmissionCelebration({
      timing: 'on_time',
      resubmission: true,
      abbreviation: '2.1P',
      name: 'Sorting',
    });
    const late = buildSubmissionCelebration({
      timing: 'after_due',
      resubmission: true,
      abbreviation: '2.1P',
      name: 'Sorting',
    });

    expect(onTime.headline).toBe('Resubmitted. Ready for feedback');
    expect(onTime.tone).toBe('success');
    expect(late.headline).toBe('Resubmitted after the due date');
    expect(late.particles).toBe(false);
  });
});

describe('SubmissionCelebrationService.describe', () => {
  afterEach(() => TestBed.resetTestingModule());

  const makeTask = (role: string, status = 'ready_for_feedback') =>
    ({
      status,
      unit: {myRole: role},
      definition: {abbreviation: '3.1C', name: 'Graphs'},
      localDueDate: () => new Date(2026, 8, 10),
      localDeadlineDate: () => new Date(2026, 8, 24),
    }) as unknown as Task;

  it('reads the task dates and the previous status', () => {
    const service = TestBed.inject(SubmissionCelebrationService);

    const onTime = service.describe(makeTask('Student'), 'working_on_it', new Date(2026, 8, 9));
    const resubmitted = service.describe(
      makeTask('Student'),
      'fix_and_resubmit',
      new Date(2026, 8, 15),
    );

    expect(onTime?.timing).toBe('on_time');
    expect(onTime?.resubmission).toBe(false);
    expect(resubmitted?.timing).toBe('after_target');
    expect(resubmitted?.headline).toBe('Resubmitted. Ready for feedback');
  });

  it('treats a time exceeded response as after the due date', () => {
    const service = TestBed.inject(SubmissionCelebrationService);
    const view = service.describe(
      makeTask('Student', 'time_exceeded'),
      'working_on_it',
      new Date(2026, 8, 9),
    );

    expect(view?.timing).toBe('after_due');
  });

  it('never celebrates for staff', () => {
    const service = TestBed.inject(SubmissionCelebrationService);

    expect(service.describe(makeTask('Tutor'), 'working_on_it')).toBeNull();
    expect(service.celebrate(makeTask('Convenor'), 'working_on_it')).toBe(false);
  });
});

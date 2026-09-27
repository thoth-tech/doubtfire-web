import {afterEach, describe, expect, it, vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {Project} from 'src/app/api/models/project';
import {UserService} from 'src/app/api/services/user.service';
import {MilestoneCelebrationService} from './milestone-celebration.service';
import {MilestoneDialogComponent, MilestoneDialogData} from './milestone-dialog.component';
import {TaskStatusSeenService} from './task-status-seen.service';

describe('MilestoneDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  const render = (data: MilestoneDialogData) => {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [MilestoneDialogComponent],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: data},
        {provide: MatDialogRef, useValue: {close}},
      ],
    });
    const fixture = TestBed.createComponent(MilestoneDialogComponent);
    fixture.detectChanges();
    return {fixture, close, element: fixture.nativeElement as HTMLElement};
  };

  const data = (overrides: Partial<MilestoneDialogData> = {}): MilestoneDialogData => ({
    unitCode: 'SIT374',
    completed: [
      {taskDefinitionId: 1, abbreviation: '1.1P', name: 'Hello', grade: 'P'},
      {taskDefinitionId: 2, abbreviation: '2.1C', name: 'Sorting', stars: {earned: 3, max: 5}},
      {taskDefinitionId: 3, abbreviation: '3.1D', name: 'Graphs'},
    ],
    alsoChanged: [],
    progressFrom: 40,
    progressTo: 55,
    targetGradeLabel: 'Distinction',
    ...overrides,
  });

  it('renders the count, the unit and each completed task in order', () => {
    const {element} = render(data());

    expect(element.querySelector('.ot-milestone__heading')?.textContent?.trim()).toBe(
      '3 tasks signed off',
    );
    expect(element.querySelector('.ot-milestone__unit')?.textContent?.trim()).toBe('SIT374');

    const rows = Array.from(element.querySelectorAll('.ot-milestone__row'));
    expect(rows.map((row) => row.querySelector('.ot-milestone__abbr')?.textContent)).toEqual([
      '1.1P',
      '2.1C',
      '3.1D',
    ]);
    expect(rows[0].querySelector('.ot-milestone__grade')?.textContent?.trim()).toBe('P');
    expect(rows[1].querySelector('.ot-milestone__stars')?.getAttribute('aria-label')).toBe(
      '3 of 5 stars',
    );
    expect(rows.every((row) => row.querySelector('f-animated-check'))).toBe(true);
  });

  it('uses the singular for one task', () => {
    const {element} = render(
      data({completed: [{taskDefinitionId: 1, abbreviation: '1.1P', name: 'Hello'}]}),
    );

    expect(element.querySelector('.ot-milestone__heading')?.textContent?.trim()).toBe(
      '1 task signed off',
    );
  });

  it('staggers rows and caps the stagger so a long list still settles quickly', () => {
    const {fixture} = render(data());
    const component = fixture.componentInstance;

    expect(component.rowDelay(1) - component.rowDelay(0)).toBe(50);
    expect(component.rowDelay(20)).toBe(component.rowDelay(8));
    expect(component.rowDelay(20)).toBeLessThanOrEqual(600);
  });

  it('shows progress from the old share to the new one', () => {
    const {element} = render(data());
    const track = element.querySelector('.ot-milestone__track');

    expect(track?.getAttribute('aria-valuenow')).toBe('55');
    expect(track?.getAttribute('aria-valuetext')).toBe('55 percent, up from 40 percent');
    expect(element.querySelector('.ot-milestone__delta')?.textContent?.trim()).toBe('Up from 40%');
  });

  it('lists other changes quietly below, and hides the section when there are none', () => {
    const none = render(data());
    expect(none.element.querySelector('.ot-milestone__also')).toBeNull();
    TestBed.resetTestingModule();

    const {element} = render(
      data({
        alsoChanged: [
          {taskDefinitionId: 9, abbreviation: '4.1P', name: 'Stacks', label: 'Needs changes'},
        ],
      }),
    );
    expect(element.querySelector('.ot-milestone__also-label')?.textContent).toBe('Needs changes');
  });

  it('closes with the chosen action', () => {
    const {element, close} = render(data());
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button'));

    buttons.find((button) => button.textContent?.includes('View completed'))?.click();
    expect(close).toHaveBeenCalledWith('view');

    buttons.find((button) => button.textContent?.trim() === 'Close')?.click();
    expect(close).toHaveBeenCalledWith('close');
  });
});

describe('MilestoneCelebrationService.prepare', () => {
  let stored: Map<string, string>;

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  const definitions = [
    {id: 1, abbreviation: '1.1P', name: 'Hello', weighting: 1, maxQualityPts: 0, targetGrade: 0},
    {id: 2, abbreviation: '2.1P', name: 'Loops', weighting: 1, maxQualityPts: 0, targetGrade: 0},
    {id: 3, abbreviation: '3.1C', name: 'Sorting', weighting: 2, maxQualityPts: 0, targetGrade: 1},
  ];

  const makeProject = (role: string, statuses: Record<number, string>) =>
    ({
      id: 12,
      targetGrade: 1,
      targetGradeWord: 'Credit',
      student: {id: 5},
      unit: {
        code: 'SIT374',
        myRole: role,
        taskDefinitions: definitions,
        taskDefinitionsForGrade: (grade: number) =>
          definitions.filter((d) => d.targetGrade <= grade),
      },
      findTaskForDefinition: (id: number) =>
        statuses[id] ? {status: statuses[id], numNewComments: 0} : undefined,
    }) as unknown as Project;

  const setup = () => {
    stored = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    });
    TestBed.configureTestingModule({
      providers: [{provide: UserService, useValue: {currentUser: {id: 5}}}],
    });
    return {
      service: TestBed.inject(MilestoneCelebrationService),
      seen: TestBed.inject(TaskStatusSeenService),
    };
  };

  it('records silently on a first visit', () => {
    const {service, seen} = setup();

    expect(service.prepare(makeProject('Student', {1: 'complete'}))).toBeNull();
    expect(seen.read(5, 12)).toEqual({'1': 'complete', '2': 'not_started', '3': 'not_started'});
  });

  it('builds the dialog for newly completed tasks with progress and other changes', () => {
    const {service} = setup();
    service.prepare(makeProject('Student', {1: 'complete', 2: 'ready_for_feedback'}));

    const data = service.prepare(
      makeProject('Student', {1: 'complete', 2: 'complete', 3: 'fix_and_resubmit'}),
    );

    expect(data?.completed.map((row) => row.abbreviation)).toEqual(['2.1P']);
    expect(data?.alsoChanged).toEqual([
      {taskDefinitionId: 3, abbreviation: '3.1C', name: 'Sorting', label: 'Needs changes'},
    ]);
    expect(data?.progressFrom).toBe(33);
    expect(data?.progressTo).toBe(67);
    expect(data?.unitCode).toBe('SIT374');

    // Recorded when shown, so the same change does not play again.
    expect(
      service.prepare(
        makeProject('Student', {1: 'complete', 2: 'complete', 3: 'fix_and_resubmit'}),
      ),
    ).toBeNull();
  });

  it('never shows or records for staff', () => {
    const {service, seen} = setup();

    expect(service.prepare(makeProject('Tutor', {1: 'complete'}))).toBeNull();
    expect(seen.read(5, 12)).toBeNull();
  });

  it('previews the current completed tasks without touching storage', () => {
    const {service, seen} = setup();

    const data = service.prepare(makeProject('Student', {1: 'complete', 3: 'complete'}), {
      preview: true,
    });

    expect(data?.completed.length).toBe(2);
    expect(data?.progressTo).toBe(67);
    expect(data?.progressFrom).toBe(0);
    expect(seen.read(5, 12)).toBeNull();
  });
});

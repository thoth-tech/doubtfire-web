import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {Group, MemberContribution} from 'src/app/api/models/groups/group';
import {GroupSet} from 'src/app/api/models/groups/group-set';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {Unit} from 'src/app/api/models/unit';
import {GroupMemberContributionAssignerComponent} from './group-member-contribution-assigner.component';

function member(id: number): Project {
  const project = new Project();
  project.id = id;
  return project;
}

describe('GroupMemberContributionAssignerComponent', () => {
  const unit = {id: 1} as Unit;
  let group: Group;
  let task: Task;
  let project: Project;

  beforeEach(async () => {
    const set = new GroupSet(unit);
    set.id = 100;
    group = new Group(unit);
    group.id = 1;
    group.groupSet = set;
    set.groupsCache.add(group);
    group.getMembers = vi.fn(() => of([member(1), member(2), member(3)]));

    project = {getGroupForTask: () => group, unit} as unknown as Project;
    task = {definition: {groupSet: set}} as unknown as Task;

    await TestBed.configureTestingModule({
      declarations: [GroupMemberContributionAssignerComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(GroupMemberContributionAssignerComponent, {set: {template: ''}})
      .compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function create(isTestSubmission = false): GroupMemberContributionAssignerComponent {
    const component = TestBed.createComponent(
      GroupMemberContributionAssignerComponent,
    ).componentInstance;
    component.task = task;
    component.project = project;
    component.isTestSubmission = isTestSubmission;
    component.ngOnInit();
    return component;
  }

  it('starts every member on an even share', () => {
    const component = create();
    const shares = component.team.memberContributions.map((contribution) =>
      component.percentFor(contribution),
    );

    expect(shares).toEqual([33, 33, 33]);
  });

  it('keeps the share when the pointer leaves the rating', () => {
    const component = create();
    const [first] = component.team.memberContributions;

    component.hoveringOver(first, 5);
    component.hoveringOver(first, null);

    expect(first.percent).toBe(33);
    expect(component.percentFor(first)).toBe(33);
  });

  it('updates every share when one rating changes', () => {
    const component = create();
    const [first, second] = component.team.memberContributions;

    component.selectRating(first, 5);
    component.hoveringOver(first, null);

    // 5 of 5 + 3 + 3 = 11 points in all.
    expect(component.percentFor(first)).toBe(45);
    expect(component.percentFor(second)).toBe(27);
  });

  it('shows 0% for a team rated all zero instead of NaN', () => {
    const component = create();
    component.team.memberContributions.forEach((contribution: MemberContribution) => {
      component.selectRating(contribution, contribution.rating);
      component.hoveringOver(contribution, null);
    });

    expect(component.team.memberContributions.map((c) => component.percentFor(c))).toEqual([
      0, 0, 0,
    ]);
  });

  it('asks for the members once when it opens', () => {
    // Bind the inputs the way the dialog does, so the first ngOnChanges runs too.
    const fixture = TestBed.createComponent(GroupMemberContributionAssignerComponent);
    fixture.componentRef.setInput('isTestSubmission', false);
    fixture.componentRef.setInput('project', project);
    fixture.componentRef.setInput('task', task);

    fixture.detectChanges();

    expect(group.getMembers).toHaveBeenCalledTimes(1);
  });

  it('hands back an empty team for a test submission without logging an error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = TestBed.createComponent(
      GroupMemberContributionAssignerComponent,
    ).componentInstance;
    const emitted: unknown[] = [];
    component.teamChange.subscribe((team) => emitted.push(team));
    component.task = task;
    component.project = project;
    component.isTestSubmission = true;

    component.ngOnInit();

    expect(consoleError).not.toHaveBeenCalled();
    expect(component.team.memberContributions).toEqual([]);
    expect(emitted).toHaveLength(1);
  });
});

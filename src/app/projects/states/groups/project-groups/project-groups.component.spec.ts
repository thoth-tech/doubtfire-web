import {beforeEach, describe, expect, it} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {GroupSet, Project, Unit} from 'src/app/api/models/doubtfire-model';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  DemoScenarioContract,
  DemoScenarioRegistryService,
} from 'src/app/demo/demo-scenario-registry.service';
import {ProjectGroupsComponent} from './project-groups.component';

describe('ProjectGroupsComponent authorised states', () => {
  let fixture: ComponentFixture<ProjectGroupsComponent>;
  let component: ProjectGroupsComponent;
  let demoMode: {enabled: boolean};
  let registry: {scenario: DemoScenarioContract | null};
  let unit: Unit;
  let project: Project;
  let groupSet: GroupSet;

  beforeEach(async () => {
    demoMode = {enabled: false};
    registry = {scenario: null};

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [ProjectGroupsComponent],
      providers: [
        {provide: DemoModeStore, useValue: demoMode},
        {provide: DemoScenarioRegistryService, useValue: registry},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    groupSet = {id: 30, name: 'Project teams', groups: []} as unknown as GroupSet;
    unit = {
      id: 20,
      code: 'DEMO20007',
      hasGroupwork: () => false,
    } as unknown as Unit;
    project = {id: 10, unit} as Project;

    fixture = TestBed.createComponent(ProjectGroupsComponent);
    component = fixture.componentInstance;
    component.unit = unit;
    component.project = project;
    component.selectedGroupSet = undefined;
    fixture.detectChanges();
  });

  it('explains the exact no-configuration state without inventing a group', () => {
    const state = fixture.nativeElement.querySelector('[data-state="not-configured"]');

    expect(state.textContent).toContain('Group work is not configured');
    expect(state.textContent).toContain('has not provided a group set or any groups');
    expect(fixture.nativeElement.querySelector('f-group-set-manager')).toBeNull();
  });

  it('distinguishes configured-but-empty group work from no group-work configuration', () => {
    component.unit = {...unit, hasGroupwork: () => true} as Unit;
    component.selectedGroupSet = {
      ...groupSet,
      allowStudentsToCreateGroups: false,
    } as unknown as GroupSet;
    fixture.detectChanges();

    const state = fixture.nativeElement.querySelector('[data-state="configured-empty"]');
    expect(state.textContent).toContain('no groups have been published');
    expect(state.textContent).toContain('Project teams');
    expect(fixture.nativeElement.querySelector('f-group-set-manager')).toBeNull();
  });

  it('renders the group manager for an empty set so a student can create the first group', () => {
    component.unit = {...unit, hasGroupwork: () => true} as Unit;
    component.selectedGroupSet = {
      ...groupSet,
      allowStudentsToCreateGroups: true,
      locked: false,
    } as unknown as GroupSet;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('f-group-set-manager')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-state]')).toBeNull();
  });

  it('keeps the empty state for a locked set even when student-created groups are allowed', () => {
    component.unit = {...unit, hasGroupwork: () => true} as Unit;
    component.selectedGroupSet = {
      ...groupSet,
      allowStudentsToCreateGroups: true,
      locked: true,
    } as unknown as GroupSet;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-state="configured-empty"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('f-group-set-manager')).toBeNull();
  });

  it('renders the ordinary authorised group manager when the unit payload contains groups', () => {
    component.unit = {...unit, hasGroupwork: () => true} as Unit;
    component.selectedGroupSet = {
      ...groupSet,
      groups: [{id: 40, name: 'Team Indigo'}],
    } as unknown as GroupSet;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('f-group-set-manager')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-state]')).toBeNull();
  });

  it('labels a matching Batch 09 hook only while isolated demo mode is enabled', () => {
    component.unit = {...unit, hasGroupwork: () => true} as Unit;
    component.selectedGroupSet = {
      ...groupSet,
      groups: [{id: 40, name: 'Team Indigo'}],
    } as unknown as GroupSet;
    demoMode.enabled = true;
    registry.scenario = {
      group_hook: {
        key: 'project-team',
        unit_key: 'DEMO20007',
        unit_id: 20,
        project_id: 10,
        group_set_id: 30,
        group_id: 40,
        name: 'Team Indigo',
        member_count: 3,
        capacity: 4,
        route: '/projects/10/groups',
      },
    } as DemoScenarioContract;
    fixture.detectChanges();

    const note = fixture.nativeElement.querySelector('[data-testid="demo-group-hook"]');
    expect(note.textContent).toContain('synthetic walkthrough data');

    demoMode.enabled = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="demo-group-hook"]')).toBeNull();
  });
});

import {HotkeysService} from '@ngneat/hotkeys';
import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA, SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {ActivatedRoute, Router} from '@angular/router';
import {EMPTY, Subject, of} from 'rxjs';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {Task} from 'src/app/api/models/task';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {TaskDefinitionService} from 'src/app/api/services/task-definition.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {CsvResultModalService} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {CsvUploadModalService} from 'src/app/common/modals/csv-upload-modal/csv-upload-modal.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {SelectedTaskService} from 'src/app/projects/states/dashboard/selected-task.service';
import {StaffTaskListComponent} from './staff-task-list.component';

const hotkeysServiceStub = {
  getHotkeys: () => [],
  addShortcut: () => EMPTY,
  removeShortcuts: () => {},
};
const emptyProvider = {};

function unitStub(id: number, tutorialAbbreviation: string): Unit {
  return {
    id,
    staff: [],
    tutorials: [{id: id * 10, abbreviation: tutorialAbbreviation, description: 'Lab'}],
    tutorialsForUserName: () => [],
  } as unknown as Unit;
}

function unitRoleStub(id: number): UnitRole {
  return {id, role: 'Convenor'} as unknown as UnitRole;
}

describe('StaffTaskListComponent', () => {
  let component: StaffTaskListComponent;
  let fixture: ComponentFixture<StaffTaskListComponent>;
  let sourcedUnitIds: number[];

  beforeEach(async () => {
    sourcedUnitIds = [];

    await TestBed.configureTestingModule({
      declarations: [StaffTaskListComponent],
      providers: [
        {provide: SelectedTaskService, useValue: {setSelectedTask: () => {}}},
        {provide: AlertService, useValue: emptyProvider},
        {provide: FileDownloaderService, useValue: emptyProvider},
        {provide: MatDialog, useValue: emptyProvider},
        {provide: CsvUploadModalService, useValue: emptyProvider},
        {provide: CsvResultModalService, useValue: emptyProvider},
        {provide: UserService, useValue: {currentUser: {name: 'A Tutor'}}},
        {provide: HotkeysService, useValue: hotkeysServiceStub},
        {provide: Router, useValue: {navigate: () => {}}},
        {provide: ActivatedRoute, useValue: emptyProvider},
        {provide: TaskDefinitionService, useValue: emptyProvider},
        {provide: SidekiqProgressModalService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(StaffTaskListComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StaffTaskListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // The screen the header dropdown can actually leave stale. This ran only in task
  // definition mode before, so the inbox kept the previous unit's list and tutors.
  it('rebuilds its tasks and its student filter in inbox mode when the unit changes', () => {
    const unitA = unitStub(1, 'LA1');
    const unitB = unitStub(2, 'LB1');

    component.unit = unitA;
    component.unitRole = unitRoleStub(11);
    component.filters = {};
    component.taskData = {
      source: (unit: Unit) => {
        sourcedUnitIds.push(unit.id);
        return of([]);
      },
      selectedTask: null,
      taskKey: null,
      onSelectedTaskChange: () => {},
      taskDefMode: false,
    };

    component.ngOnInit();

    expect(sourcedUnitIds).toEqual([1]);
    expect(component.studentFilter.map((option) => option.abbreviation)).toContain('LA1');

    component.unit = unitB;
    component.unitRole = unitRoleStub(12);
    component.filters = {};
    component.ngOnChanges({unit: new SimpleChange(unitA, unitB, false)});

    expect(sourcedUnitIds).toEqual([1, 2]);
    expect(component.studentFilter.map((option) => option.abbreviation)).toContain('LB1');
    expect(component.studentFilter.map((option) => option.abbreviation)).not.toContain('LA1');
  });

  // The parent hands down a partial filters object on every unit change, which used to
  // wipe the defaults this component installs for itself.
  it('reinstates its own filter defaults when the parent replaces the filters object', () => {
    const unitA = unitStub(1, 'LA1');
    const unitB = unitStub(2, 'LB1');

    component.unit = unitA;
    component.unitRole = unitRoleStub(11);
    component.filters = {};
    component.taskData = {
      source: () => of([]),
      selectedTask: null,
      taskKey: null,
      onSelectedTaskChange: () => {},
      taskDefMode: false,
    };

    component.ngOnInit();

    component.unit = unitB;
    component.unitRole = unitRoleStub(12);
    component.filters = {};
    component.ngOnChanges({unit: new SimpleChange(unitA, unitB, false)});

    expect(component.filters.tutorialIdSelected).toBe('all');
    expect(component.filters.unitRoleIdSelected).toBe('all');
  });

  it('cancels the previous task query when the unit changes', () => {
    const unitA = unitStub(1, 'LA1');
    const unitB = unitStub(2, 'LB1');
    const requests: Map<number, Subject<never[]>> = new Map();

    component.unit = unitA;
    component.unitRole = unitRoleStub(11);
    component.filters = {};
    component.taskData = {
      source: (unit: Unit) => {
        const request: Subject<never[]> = new Subject();
        requests.set(unit.id, request);
        return request;
      },
      selectedTask: null,
      taskKey: null,
      onSelectedTaskChange: () => {},
      taskDefMode: false,
    };

    component.ngOnInit();

    component.unit = unitB;
    component.unitRole = unitRoleStub(12);
    component.filters = {};
    component.ngOnChanges({unit: new SimpleChange(unitA, unitB, false)});

    requests.get(unitA.id)?.next([]);
    expect(component.loading).toBe(true);

    requests.get(unitB.id)?.next([]);
    expect(component.loading).toBe(false);
  });

  describe('row actions', () => {
    let task: Task;

    beforeEach(() => {
      task = {id: 4, hover: false, optionsOpened: false} as Task;
    });

    it('reveals the row actions when the pointer is over the row', () => {
      component.showTaskActionsForPointer(task);

      expect(component.rowActionsShown(task)).toBe(true);
    });

    it('leaves the row actions alone on a device that has opted out of hover', () => {
      component.allowHover = false;

      component.showTaskActionsForPointer(task);

      expect(component.rowActionsShown(task)).toBe(false);
    });

    it('reveals the row actions when the options button takes keyboard focus', () => {
      component.showTaskActionsForFocus(task);

      expect(component.rowActionsShown(task)).toBe(true);
    });

    it('still reveals the row actions on focus where hover is not available', () => {
      component.allowHover = false;

      component.showTaskActionsForFocus(task);

      expect(component.rowActionsShown(task)).toBe(true);
    });

    it('hides the row actions again once focus leaves', () => {
      component.showTaskActionsForFocus(task);
      component.hideTaskActionsForFocus(task);

      expect(component.rowActionsShown(task)).toBe(false);
    });

    it('keeps the row actions up while the overflow menu holds the focus', () => {
      component.showTaskActionsForFocus(task);
      task.optionsOpened = true;
      component.hideTaskActionsForFocus(task);

      expect(component.rowActionsShown(task)).toBe(true);
    });

    it('holds only one row open at a time', () => {
      const other = {id: 5, hover: false, optionsOpened: false} as Task;

      component.showTaskActionsForFocus(task);
      component.showTaskActionsForFocus(other);

      expect(component.rowActionsShown(task)).toBe(false);
      expect(component.rowActionsShown(other)).toBe(true);
    });

    it('does not let a late blur close a row another row already claimed', () => {
      const other = {id: 5, hover: false, optionsOpened: false} as Task;

      component.showTaskActionsForFocus(task);
      component.showTaskActionsForFocus(other);
      component.hideTaskActionsForFocus(task);

      expect(component.rowActionsShown(other)).toBe(true);
    });

    // The regression this pair guards: blur used to run the same handler as mouseout, so
    // tabbing off the options button faded it out from under a pointer still on the row.
    it('keeps the row actions up when focus leaves but the pointer is still on the row', () => {
      component.showTaskActionsForPointer(task);
      component.showTaskActionsForFocus(task);
      component.hideTaskActionsForFocus(task);

      expect(component.rowActionsShown(task)).toBe(true);
    });

    it('keeps the row actions up when the pointer leaves but focus is still on the button', () => {
      component.showTaskActionsForPointer(task);
      component.showTaskActionsForFocus(task);
      component.hideTaskActions(task);

      expect(component.rowActionsShown(task)).toBe(true);
    });

    it('closes the row only once both the pointer and the keyboard have left', () => {
      component.showTaskActionsForPointer(task);
      component.showTaskActionsForFocus(task);
      component.hideTaskActions(task);
      component.hideTaskActionsForFocus(task);

      expect(component.rowActionsShown(task)).toBe(false);
    });
  });
});

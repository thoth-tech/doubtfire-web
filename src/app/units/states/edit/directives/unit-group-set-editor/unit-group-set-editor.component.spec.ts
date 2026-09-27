import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {Component, Directive, Input, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatTableModule} from '@angular/material/table';
import {BehaviorSubject, throwError} from 'rxjs';
import {GroupSet, Unit} from 'src/app/api/models/doubtfire-model';
import {GroupSetService} from 'src/app/api/services/group-set.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {CsvResultModalService} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {UnitGroupSetEditorComponent} from './unit-group-set-editor.component';

function groupSetEditor() {
  const groupSetService = {delete: vi.fn(), update: vi.fn()};
  const alerts = {success: vi.fn(), error: vi.fn()};
  const csvResultModal = {show: vi.fn()};
  const confirmationModal = {show: vi.fn()};
  const component = new UnitGroupSetEditorComponent(
    groupSetService as never,
    alerts as never,
    {} as never,
    csvResultModal as never,
    confirmationModal as never,
  );
  const unit = {refresh: vi.fn(), groupSets: [], groupSetsCache: {}};
  component.unit = unit as never;
  return {component, groupSetService, alerts, csvResultModal, confirmationModal, unit};
}

describe('UnitGroupSetEditorComponent', () => {
  it('asks before deleting a group set', () => {
    const {component, groupSetService, confirmationModal} = groupSetEditor();

    component.removeGroupSet({name: 'Labs'} as never);

    expect(groupSetService.delete).not.toHaveBeenCalled();
    expect(confirmationModal.show).toHaveBeenCalledWith(
      'Delete Labs',
      expect.any(String),
      expect.any(Function),
    );
  });

  it('reloads the unit after a CSV import adds groups, so they show', () => {
    const {component, unit, csvResultModal} = groupSetEditor();

    component.onGroupCSVSuccess({success: [{}] as never});

    expect(csvResultModal.show).toHaveBeenCalled();
    expect(unit.refresh).toHaveBeenCalled();
  });

  it('follows the open group set to its new object when the unit reloads', () => {
    const {component} = groupSetEditor();
    const labs = {id: 3, name: 'Labs'};
    const projects = {id: 4, name: 'Projects'};
    const groupSets: BehaviorSubject<object[]> = new BehaviorSubject([labs, projects]);
    component.unit = {groupSets: [labs, projects], groupSetsCache: {values: groupSets}} as never;
    component.ngOnInit();
    component.selectGroupSet(projects as never);

    const reloadedProjects = {id: 4, name: 'Projects'};
    groupSets.next([{id: 3, name: 'Labs'}, reloadedProjects]);

    expect(component.selectedGroupSet).toBe(reloadedProjects);
    component.ngOnDestroy();
  });

  it('puts the old values back when saving a group set fails', () => {
    const {component, groupSetService} = groupSetEditor();
    const groupSet = {
      id: 3,
      name: 'Labs',
      capacity: 4,
      allowStudentsToCreateGroups: true,
      allowStudentsToManageGroups: true,
      keepGroupsInSameClass: false,
    };
    groupSetService.update.mockReturnValue(throwError(() => 'Server said no'));

    component.startEditGroupSet(groupSet as never);
    component.editingGroupSetModel.name = 'Projects';
    component.editingGroupSetModel.capacity = 6;
    component.saveGroupSet(groupSet as never);

    expect(groupSet.name).toBe('Labs');
    expect(groupSet.capacity).toBe(4);
  });

  it('will not save a group set without a name', () => {
    const {component, groupSetService} = groupSetEditor();
    const groupSet = {id: 3, name: 'Labs'};

    component.startEditGroupSet(groupSet as never);
    component.editingGroupSetModel.name = '   ';
    component.saveGroupSet(groupSet as never);

    expect(component.canSaveGroupSet).toBe(false);
    expect(groupSetService.update).not.toHaveBeenCalled();
  });
});

// Counts how many times the page builds the group manager, which is what clears
// the group it last showed.
let managersBuilt = 0;

@Component({
  selector: 'f-group-set-manager',
  templateUrl: './group-set-manager-stub.spec.html',
  standalone: false,
})
class GroupSetManagerStubComponent {
  @Input() selectedGroupSet: unknown;
  @Input() showGroupSetSelector: boolean;
  @Input() unit: unknown;
  @Input() unitRole: unknown;

  constructor() {
    managersBuilt++;
  }
}

// The uploader takes callbacks named on..., which Angular refuses to bind on an
// unknown element, so it is stubbed with the inputs the page passes it.
@Component({
  selector: 'f-file-uploader',
  templateUrl: './group-set-manager-stub.spec.html',
  standalone: false,
})
class FileUploaderStubComponent {
  @Input() asButton: boolean;
  @Input() files: unknown;
  @Input() isUploading: boolean;
  @Input() onComplete: unknown;
  @Input() onSuccess: unknown;
  @Input() url: string;
}

describe('UnitGroupSetEditorComponent group manager', () => {
  it('builds the group manager again when the open set is swapped for a new copy', async () => {
    const labs = {
      id: 3,
      name: 'Labs',
      groupCSVUploadUrl: () => '',
      groupStudentCSVUploadUrl: () => '',
    };
    const groupSets: BehaviorSubject<object[]> = new BehaviorSubject([labs]);
    await TestBed.configureTestingModule({
      declarations: [
        UnitGroupSetEditorComponent,
        GroupSetManagerStubComponent,
        FileUploaderStubComponent,
      ],
      imports: [CommonModule, MatTableModule],
      providers: [
        {provide: GroupSetService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
        {provide: CsvResultModalService, useValue: {}},
        {provide: ConfirmationModalService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(UnitGroupSetEditorComponent);
    const component = fixture.componentInstance;
    component.unit = {
      code: 'SIT101',
      groupSets: [labs],
      groupSetsCache: {values: groupSets},
    } as never;
    managersBuilt = 0;
    fixture.detectChanges();
    expect(managersBuilt).toBe(1);

    const reloaded = {...labs};
    component.unit = {...component.unit, groupSets: [reloaded]} as never;
    groupSets.next([reloaded]);
    fixture.detectChanges();

    expect(component.selectedGroupSet).toBe(reloaded);
    expect(managersBuilt).toBe(2);
    fixture.destroy();
  });
});

@Directive({selector: 'f-file-uploader'})
class FileUploaderStub {
  @Input() onComplete: unknown;
  @Input() onSuccess: unknown;
}

describe('UnitGroupSetEditorComponent field names', () => {
  let fixture: ComponentFixture<UnitGroupSetEditorComponent>;
  let groupSet: GroupSet;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UnitGroupSetEditorComponent],
      imports: [
        FileUploaderStub,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
      ],
      providers: [
        GroupSetService,
        AlertService,
        FileDownloaderService,
        CsvResultModalService,
        ConfirmationModalService,
      ].map((provide) => ({provide, useValue: {}})),
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    groupSet = {
      id: 1,
      name: 'Project teams',
      capacity: 4,
      groupCSVUploadUrl: () => '',
      groupStudentCSVUploadUrl: () => '',
    } as unknown as GroupSet;
    fixture = TestBed.createComponent(UnitGroupSetEditorComponent);
    fixture.componentRef.setInput('unit', {groupSets: [groupSet]} as unknown as Unit);
    fixture.componentInstance.startEditGroupSet(groupSet);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('names every editable table field without adding floating labels to the row', () => {
    const controls: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('input, mat-select'),
    );
    expect(controls.map((control) => control.getAttribute('aria-label'))).toEqual([
      'Group set name',
      'Most students in a group',
      'Who can create groups',
      'Who can change members',
      'Members from',
    ]);
    expect(fixture.nativeElement.querySelector('mat-label')).toBeNull();
  });

  it('preserves names when an empty name and unlimited capacity are edited', async () => {
    fixture.componentInstance.cancelEditGroupSet();
    groupSet.name = '';
    groupSet.capacity = null;
    fixture.componentInstance.startEditGroupSet(groupSet);
    fixture.detectChanges();
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Group set name"]',
    );
    const capacity: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[aria-label="Most students in a group"]',
    );
    expect(input.value).toBe('');
    expect(capacity.value).toBe('');
  });
});

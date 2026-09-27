import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {GroupSet, Unit, UnitRole} from 'src/app/api/models/doubtfire-model';
import {GroupSetService} from 'src/app/api/services/group-set.service';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {
  CsvResult,
  CsvResultModalService,
} from 'src/app/common/modals/csv-result-modal/csv-result-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

interface GroupSetEditModel {
  name: string;
  capacity: number | null;
  allowStudentsToCreateGroups: boolean;
  allowStudentsToManageGroups: boolean;
  keepGroupsInSameClass: boolean;
}

@Component({
  selector: 'f-unit-group-set-editor',
  templateUrl: './unit-group-set-editor.component.html',
  styleUrls: ['./unit-group-set-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitGroupSetEditorComponent implements OnInit, OnDestroy {
  @Input() unit: Unit;
  @Input() unitRole: UnitRole;

  public selectedGroupSet: GroupSet | null = null;
  public showHelp = false;
  public isGroupCSVUploading: boolean | null = null;

  // Keep `file` key to preserve backend form field name used in legacy implementation.
  public groupCSV = {
    file: {name: 'Group CSV', type: 'csv'},
  };

  public readonly columns = [
    'name',
    'capacity',
    'createGroups',
    'manageGroups',
    'restrictTutorials',
    'actions',
  ];

  public editingGroupSetId: number | null = null;
  public editingGroupSetModel: GroupSetEditModel | null = null;

  public studentStaffOptions = [
    {value: true, text: 'Staff and students'},
    {value: false, text: 'Staff only'},
  ];

  public tutorialOptions = [
    {value: true, text: 'Same tutorial only'},
    {value: false, text: 'Any tutorial'},
  ];

  // Handed to the uploaders once. Binding `fn.bind(this)` in the template made a
  // new function on every check, so the uploaders saw a changed input each time.
  public readonly handleGroupCSVSuccess = (response: CsvResult) => this.onGroupCSVSuccess(response);
  public readonly handleGroupCSVComplete = () => this.onGroupCSVComplete();

  private groupSetsSub?: Subscription;

  constructor(
    private groupSetService: GroupSetService,
    private alertService: AlertService,
    private fileDownloaderService: FileDownloaderService,
    private csvResultModal: CsvResultModalService,
    private confirmationModal: ConfirmationModalService,
  ) {}

  ngOnInit(): void {
    if (this.unit?.groupSets?.length > 0) {
      this.selectGroupSet(this.unit.groupSets[0]);
    }

    // Reloading the unit, as a CSV import does, builds new group set objects with
    // the new groups in them. Follow the open set to its new object, or the page
    // keeps showing the old one without the imported groups.
    this.groupSetsSub = this.unit?.groupSetsCache?.values?.subscribe((groupSets) => {
      const selected = this.selectedGroupSet;
      if (!selected || groupSets.includes(selected)) {
        return;
      }
      this.selectGroupSet(groupSets.find((set) => set.id === selected.id) ?? groupSets[0] ?? null);
    });
  }

  ngOnDestroy(): void {
    this.groupSetsSub?.unsubscribe();
  }

  public get canSaveGroupSet(): boolean {
    return !!this.editingGroupSetModel?.name?.trim();
  }

  addGroupSet(): void {
    const groupSet = this.groupSetService.createInstanceFrom({}, this.unit);
    const gsCount = this.unit.groupSets.length;
    groupSet.name = gsCount === 0 ? 'Group Work' : `Group Work Set ${gsCount + 1}`;

    this.groupSetService.store(groupSet, {cache: this.unit.groupSetsCache}).subscribe({
      next: (createdGroupSet) => {
        this.alertService.success('Group set created.', 2000);
        this.selectGroupSet(createdGroupSet ?? groupSet);
      },
      error: (message) => this.alertService.error(`Failed to create group set. ${message}`, 6000),
    });
  }

  startEditGroupSet(groupSet: GroupSet): void {
    this.editingGroupSetId = groupSet.id;
    this.editingGroupSetModel = {
      name: groupSet.name,
      allowStudentsToCreateGroups: !!groupSet.allowStudentsToCreateGroups,
      allowStudentsToManageGroups: !!groupSet.allowStudentsToManageGroups,
      keepGroupsInSameClass: !!groupSet.keepGroupsInSameClass,
      capacity: groupSet.capacity ?? null,
    };
  }

  cancelEditGroupSet(): void {
    this.editingGroupSetId = null;
    this.editingGroupSetModel = null;
  }

  saveGroupSet(groupSet: GroupSet): void {
    if (!this.editingGroupSetModel || !this.canSaveGroupSet) {
      return;
    }

    // The set is changed before the request so the request carries the new
    // values. If it fails, put the old ones back, or the table shows values the
    // server never took.
    const previous: GroupSetEditModel = {
      name: groupSet.name,
      allowStudentsToCreateGroups: groupSet.allowStudentsToCreateGroups,
      allowStudentsToManageGroups: groupSet.allowStudentsToManageGroups,
      keepGroupsInSameClass: groupSet.keepGroupsInSameClass,
      capacity: groupSet.capacity,
    };

    groupSet.name = this.editingGroupSetModel.name.trim();
    groupSet.allowStudentsToCreateGroups = this.editingGroupSetModel.allowStudentsToCreateGroups;
    groupSet.allowStudentsToManageGroups = this.editingGroupSetModel.allowStudentsToManageGroups;
    groupSet.keepGroupsInSameClass = this.editingGroupSetModel.keepGroupsInSameClass;
    groupSet.capacity = this.editingGroupSetModel.capacity;

    this.groupSetService.update(groupSet).subscribe({
      next: () => {
        this.alertService.success('Group set updated.', 2000);
        this.cancelEditGroupSet();
      },
      error: (message) => {
        Object.assign(groupSet, previous);
        this.alertService.error(`Failed to update group set. ${message}`, 6000);
      },
    });
  }

  toggleLocked(groupSet: GroupSet): void {
    const originalLockedState = groupSet.locked;
    groupSet.locked = !groupSet.locked;

    this.groupSetService.update(groupSet).subscribe({
      next: (response) => {
        this.alertService.success(
          `${response.locked ? 'Locked' : 'Unlocked'} ${groupSet.name}`,
          2000,
        );
      },
      error: (message) => {
        groupSet.locked = originalLockedState;
        this.alertService.error(
          `Failed to ${groupSet.locked ? 'unlock' : 'lock'} ${groupSet.name}. ${message}`,
          6000,
        );
      },
    });
  }

  removeGroupSet(groupSet: GroupSet): void {
    // One click used to delete the set and every group in it.
    this.confirmationModal.show(
      `Delete ${groupSet.name || 'this group set'}`,
      'This deletes the group set and all of its groups. You cannot undo this.',
      () => this.deleteGroupSet(groupSet),
    );
  }

  private deleteGroupSet(groupSet: GroupSet): void {
    this.groupSetService.delete(groupSet, {cache: this.unit.groupSetsCache}).subscribe({
      next: () => {
        if (groupSet === this.selectedGroupSet) {
          this.selectGroupSet(this.unit.groupSets[0] ?? null);
        }
        if (this.editingGroupSetId === groupSet.id) {
          this.cancelEditGroupSet();
        }
        this.alertService.success('Group set deleted.', 2000);
      },
      error: (message) => this.alertService.error(`Failed to delete group set. ${message}`, 6000),
    });
  }

  selectGroupSet(groupSet: GroupSet | null): void {
    this.selectedGroupSet = groupSet;
    if (this.editingGroupSetId && groupSet?.id !== this.editingGroupSetId) {
      this.cancelEditGroupSet();
    }
  }

  groupCSVUploadUrl(): string | undefined {
    return this.selectedGroupSet?.groupCSVUploadUrl();
  }

  groupStudentCSVUploadUrl(): string | undefined {
    return this.selectedGroupSet?.groupStudentCSVUploadUrl();
  }

  onGroupCSVSuccess(response: CsvResult): void {
    this.csvResultModal.show('Group CSV upload results.', response);
    // The groups arrive with the unit, so reload it. Selecting the same set
    // again, as this used to do, changed nothing, and the new groups did not show
    // until the page was reloaded.
    if ((response?.success?.length ?? 0) > 0) {
      this.unit.refresh();
    }
  }

  onGroupCSVComplete(): void {
    this.isGroupCSVUploading = null;
  }

  downloadGroupCSV(): void {
    if (!this.selectedGroupSet) {
      return;
    }

    this.fileDownloaderService.downloadFile(
      this.selectedGroupSet.groupCSVUploadUrl(),
      `${this.unit.code}-group-sets.csv`,
    );
  }

  downloadGroupStudentCSV(): void {
    if (!this.selectedGroupSet) {
      return;
    }

    this.fileDownloaderService.downloadFile(
      this.selectedGroupSet.groupStudentCSVUploadUrl(),
      `${this.unit.code}-${this.selectedGroupSet.name}-students.csv`,
    );
  }
}

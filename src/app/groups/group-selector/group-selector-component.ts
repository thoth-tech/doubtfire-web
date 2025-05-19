import {Component, EventEmitter, Input, OnInit, Output, SimpleChanges} from '@angular/core';
 import {FormBuilder, FormGroup, Validators} from '@angular/forms';
 import {Group, GroupSet, UnitService, UserService} from '../../api/models/doubtfire-model';
 import {Project} from '../../api/models/project';
 import {Unit} from '../../api/models/unit';
 import {UnitRole} from '../../api/models/unit-role';
 import {GroupService} from '../../api/services/group.service';
 import { GroupsInTutorialsPipe } from 'src/app/common/filters/groups-in-tutorial.pipe';
 import {PaginateAndSortPipe} from '../../common/filters/paginate-and-sort.pipe';
 import {GroupsWithNamePipe} from '../../common/filters/groups-with-name.pipe';
 import {GroupsForStudentPipe} from '../../common/filters/groups-for-student.pipe';
 import {AlertService} from '../../common/services/alert.service';

 @Component({
   selector: 'group-selector',
   templateUrl: './group-selector.component.html',
   styleUrls: ['./group-selector.component.scss'],
 })
 export class GroupSelectorComponent implements OnInit {
   @Input() unit: Unit;
   @Input() project: Project;
   @Input() unitRole: UnitRole;
   @Input() selectedGroup: Group;
   @Input() selectedGroupSet: GroupSet;
   @Input() showGroupSetSelector: boolean = false;
   @Output() onSelectGroup: EventEmitter<Group> = new EventEmitter<Group>();
   loaded: boolean = false;
   newGroupName: string = '';
   filteredGroups: Group[] = [];
   staffFilter: string = '';
   canCreateGroups: boolean = false;
   searchText: string = '';
   editingGroupId: number | null = null;
   editCache: {name: string; tutorialId: number; capacityAdjustment: number} = {
     name: '',
     tutorialId: 0,
     capacityAdjustment: 0,
   };
   isSaving = false;
   groupForm: FormGroup;
   public isGroupFormVisible: boolean = false;

   // Add getter for shownGroups
   get shownGroups(): Group[] {
     if (!this.filteredGroups) return [];

     let groups = this.filteredGroups;

     // Apply groupsForStudent filter if project exists
     if (this.project && this.selectedGroupSet) {
       groups =
         this.groupsForStudentPipe.transform(groups, this.project, this.selectedGroupSet) || [];
     }

     // Apply groupsWithName filter if newGroupName exists
     if (this.newGroupName) {
       groups = this.groupsWithNamePipe.transform(groups, this.newGroupName) || [];
     }

     return groups;
   }

   constructor(
     private groupService: GroupService,
     private fb: FormBuilder,
     private alertService: AlertService,
     private unitService: UnitService,
     private userService: UserService,
     private groupsInTutorialsPipe: GroupsInTutorialsPipe,
     private groupsWithNamePipe: GroupsWithNamePipe,
     private groupsForStudentPipe: GroupsForStudentPipe,
     private paginateAndSortPipe: PaginateAndSortPipe,
   ) {}

   ngOnInit(): void {
     const hasUnitRole = !!this.unitRole;
     const hasProject = !!this.project;
     this.initForm();
     if ((!hasUnitRole && !hasProject) || (hasUnitRole && hasProject)) {
       throw new Error('Group selector must have exactly one unit role or one project');
     }

     // Initialize group set and showGroupSetSelector
     if (this.unit?.groupSets?.length > 0) {
       this.selectedGroupSet = this.unit.groupSets[0]; // Select the first group set by default
     }
     this.showGroupSetSelector = this.unit.groupSets.length > 1;

     // Set the staff filter based on the unit role
     if (this.unitRole) {
       this.staffFilter =
         {
           Convenor: 'all',
           Tutor: 'mine',
         }[this.unitRole.role] || 'mine'; // Default to 'mine' if role is not found
     }

     // Call selectGroupSet with the initial selectedGroupSet
     this.selectGroupSet(this.selectedGroupSet);
   }

   ngOnChanges(changes: SimpleChanges): void {
     // Check if selectedGroupSet or project has changed
     if (changes['selectedGroupSet'] && this.selectedGroupSet) {
       this.startLoading();
     }

     // If the project changes, finish loading and select group
     if (changes['project'] && this.project) {
       this.finishLoading();
     }
   }

   pagination = {
     currentPage: 1,
     maxSize: 10,
     pageSize: 10,
     totalSize: null as number | null,
     show: false,
     onChange: () => this.applyFilters(),
   };

   tableSort = {
     order: 'name',
     reverse: false,
   };

   sortTableBy(column: string): void {
     if (this.tableSort.order === column) {
       this.tableSort.reverse = !this.tableSort.reverse;
     } else {
       this.tableSort.order = column;
       this.tableSort.reverse = false;
     }
     this.applyFilters();
   }

   applyFilters(): void {
     let groups: Group[] = [];

     if (this.unitRole) {
       groups =
         this.groupsInTutorialsPipe.transform(
           this.selectedGroupSet?.groups as Group[],
           this.unitRole,
           this.staffFilter,
         ) || [];
     } else {
       groups = (this.selectedGroupSet?.groups as Group[]) || [];
     }

     // Apply search text filter if exists
     if (this.searchText) {
       groups = groups.filter((group) =>
         group.name.toLowerCase().includes(this.searchText.toLowerCase()),
       );
     }

     // Apply pagination and sorting
     this.filteredGroups = this.paginateAndSortPipe.transform(
       groups,
       this.pagination,
       this.tableSort,
     );
   }

   setStaffFilter(scope: string): void {
     this.staffFilter = scope;
     this.applyFilters();
   }

   startLoading(): void {
     this.loaded = false;
   }

   finishLoading(): void {
     // Simulate the timeout behavior from your original code
     setTimeout(() => {
       this.loaded = true;
       if (this.project) {
         this.selectGroup(this.project.groupForGroupSet(this.selectedGroupSet));
       }
     }, 500);
   }

   selectGroupSet(groupSet: GroupSet): void {
     if (!groupSet) {
       return;
     }

     this.startLoading();
     this.selectGroup(null); // Reset the group selection

     // Can only create groups if unitRole is provided or groupSet allows students to create groups
     this.canCreateGroups = this.unitRole !== null || groupSet?.allowStudentsToCreateGroups;

     this.unit.getGroups(groupSet).subscribe({
       next: (groups) => {
         this.selectedGroupSet = groupSet;
         this.finishLoading();
         this.resetNewGroupForm();
         this.applyFilters();
       },
       error: (message) => {
         this.finishLoading();
         this.alertService.error(`Unable to get groups ${message}`, 6000);
       },
     });
   }

   selectGroup(group: Group): void {
     if (!group) {
       return;
     }

     this.selectedGroup = group;
     this.onSelectGroup.emit(this.selectedGroup);
   }

   resetNewGroupForm(): void {
     this.newGroupName = '';
   }

   // Function to handle search text chang

   addGroup(name: string): void {
     if (this.unit.tutorials.length === 0) {
       this.alertService.error(
         'Please ensure there is at least one tutorial before groups are created',
         6000,
       );
       return;
     }

     let tutorialId: number;

     // Student context
     if (this.project) {
       // TODO: Need to add stream to group set
       tutorialId = this.project.tutorials[0].id || this.unit.tutorials[0].id;
     } else {
       // Convenor or Tutor context
       const tutorName = this.unitRole?.role || this.userService.currentUser.name; // Placeholder for the current user
       tutorialId = this.unit.tutorials.find((tute) => tute.tutor?.name === tutorName)?.id;

       // Default to first tutorial if tutorial not found
       tutorialId ||= this.unit.tutorials[0]?.id;
     }

     this.groupService
       .create(
         {
           unitId: this.unit.id,
           groupSetId: this.selectedGroupSet.id,
         },
         {
           cache: this.selectedGroupSet.groupsCache,
           constructorParams: this.unit,
           body: {
             group: {
               name: name,
               tutorial_id: tutorialId,
             },
           },
         },
       )
       .subscribe({
         next: (group) => {
           this.resetNewGroupForm();
           this.applyFilters();
           this.selectGroup(group);
         },
         error: (message) => {
           this.alertService.error(message, 6000);
         },
       });
   }
   projectInGroup(group: Group): boolean {
     return this.project?.inGroup(group) ?? false;
   }

   joinGroup(group: Group): void {
     if (!this.project) {
       return;
     }

     const partOfGroup = this.projectInGroup(group);
     if (partOfGroup) {
       this.alertService.error('You are already a member of this group');
       return;
     }

     group.addMember(this.project, () => {
       this.selectedGroup = group;
     });
   }

   deleteGroup(group: Group): void {
     this.groupService
       .delete(group, {
         cache: this.selectedGroupSet.groupsCache,
       })
       .subscribe({
         next: () => {
           this.alertService.success('Deleted group', 2000);
           if (this.selectedGroup?.id === group.id) {
             this.selectedGroup = null;
             this.onSelectGroup.emit(null);
           }
           this.resetNewGroupForm();
           this.applyFilters();
         },
         error: (message) => {
           this.alertService.error(`Failed to delete group. ${message}`, 6000);
         },
       });
   }
   toggleLocked(group: Group): void {
     group.locked = !group.locked;
     this.groupService.update(group).subscribe({
       next: (updatedGroup) => {
         group.locked = updatedGroup.locked;
         this.alertService.success('Group updated', 2000);
       },
       error: (err) => {
         this.alertService.error(`Failed to update group. ${err}`, 6000);
         group.locked = !group.locked; // revert toggle if update fails
       },
     });
   }
   private initForm() {
     this.groupForm = this.fb.group({
       name: ['', Validators.required],
       tutorial: [null, Validators.required],
       capacityAdjustment: [0, [Validators.required, Validators.min(0)]],
     });
   }

   // Add these methods for inline editing
   isEditing(group: Group): boolean {
     return this.editingGroupId === group.id;
   }

   startEditing(group: Group): void {
     this.editingGroupId = group.id;
     this.editCache = {
       name: group.name,
       tutorialId: group.tutorial?.id,
       capacityAdjustment: group.capacityAdjustment,
     };
   }

   cancelEdit(): void {
     this.editingGroupId = null;
     this.editCache = {name: '', tutorialId: 0, capacityAdjustment: 0};
   }

   saveEdit(group: Group): void {
     const tutorial = this.unit.tutorials.find((t) => t.id === +this.editCache.tutorialId);
     if (!tutorial) {
       this.alertService.error('Invalid tutorial selected', 3000);
       return;
     }

     this.updateGroup(
       {
         name: this.editCache.name,
         tutorial: tutorial,
         capacityAdjustment: this.editCache.capacityAdjustment,
       },
       group,
     );

     this.editingGroupId = null;
     this.editCache = {name: '', tutorialId: 0, capacityAdjustment: 0};
   }

   updateGroup(data: Partial<Group>, group: Group): void {
     this.isSaving = true;

     // Update the local group object immediately for responsive UI
     Object.assign(group, data);

     this.groupService.update(group).subscribe({
       next: () => {
         this.alertService.success('Group updated successfully', 2000);
         this.isSaving = false;
         this.applyFilters();
       },
       error: (message) => {
         this.alertService.error(`Failed to update group: ${message}`, 6000);
         this.isSaving = false;
         this.applyFilters();
       },
     });
   }
  }

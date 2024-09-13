import {Component, Input, OnInit} from '@angular/core';
// importing necessary services
import {AlertService} from 'src/app/common/services/alert.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UnitRoleService} from 'src/app/api/services/unit-role.service';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {User, UserService} from 'src/app/api/models/doubtfire-model';
import {FormControl} from '@angular/forms';
import {Observable, startWith, map} from 'rxjs';

@Component({
  selector: 'unit-staff-editor', // Define the component selector
  templateUrl: './unit-staff-editor.component.html', // Link to the HTML template
  styleUrls: ['./unit-staff-editor.component.scss'], // Link to the SCSS file for styles
})
export class UnitStaffEditorComponent implements OnInit {
  @Input() unit: Unit; // Input property to receive data from the parent component
  unitStaff: UnitRole[] = []; // Array to hold the staff members
  selectedStaff: User; // This is the staff member selected by the user to be added

  public tutorFormControl: FormControl<string | User>;
  public tutors: User[];
  public filteredTutors: Observable<User[]>;

  // ToDo: roleId is deprecated
  public readonly ROLE_IDS = {
    'Tutor': 2,
    'Convenor': 3,
  };

  // Injecting services into the component through the constructor
  constructor(
    private alertService: AlertService,
    private userService: UserService,
    private newUnitService: UnitService,
    private newUnitRoleService: UnitRoleService,
  ) {}

  displayFn(user: User): string {
    return user && user.name ? user.name : '';
  }

  private _filter(name: string): User[] {
    const filterValue = name.toLowerCase();

    return this.tutors.filter(
      ({name, id}) =>
        name.toLowerCase().includes(filterValue) &&
        !this.unitStaff.some((role) => role.user.id === id),
    );
  }

  // Lifecycle hook that runs when the component is initialized
  ngOnInit(): void {
    // Subscribe to the unit's staff cache to keep the unitStaff array updated
    this.unit.staffCache.values.subscribe((unitStaff) => {
      this.unitStaff = unitStaff;
    });

    this.userService.getTutors().subscribe((tutors) => {
      this.tutors = tutors.filter((s) => ['Convenor', 'Admin', 'Tutor'].includes(s.systemRole));
    });

    this.tutorFormControl = new FormControl<string | User>('');

    this.filteredTutors = this.tutorFormControl.valueChanges.pipe(
      startWith(''),
      map((value) => {
        const name = typeof value === 'string' ? value : value?.name;
        return name ? this._filter(name as string) : this.tutors;
      }),
    );
  }

  // Method to change the role of a staff member (e.g., Tutor or Convenor)
  changeRole(unitRole: UnitRole, role: string): void {
    const previouRole = unitRole.role;
    const previousRoleId = unitRole.roleId;

    unitRole.role = role; // Update the roleId property of the unit role
    unitRole.roleId = this.ROLE_IDS[role];

    this.newUnitRoleService.update(unitRole).subscribe({
      // On successful update, show a success alert
      next: () => this.alertService.success('Role changed', 2000),
      // On error, show an error alert
      error: (response) =>{
        this.alertService.error(response, 6000),

        // revert button state if failed to change
        unitRole.role = previouRole;
        unitRole.roleId = previousRoleId;
      },
    });
  }

  // Method to change the main convenor of the unit
  changeMainConvenor(staff: UnitRole): void {
    this.unit.changeMainConvenor(staff).subscribe({
      // On successful change, show a success alert
      next: () => this.alertService.success('Main convenor changed', 2000),
      // On error, show an error alert
      error: (response) => this.alertService.error(response, 6000),
    });
  }

  // Method to add a selected staff member to the unit
  addSelectedStaff(): void {
    const staff = this.selectedStaff; // Get the selected staff member
    // this.selectedStaff = null; // Clear the selected staff input
    // this.unit.staff = []; // Ensure the unit staff array is initialized

    if (staff.id) {
      // If the selected staff member has an ID, add them to the unit
      this.unit.addStaff(staff).subscribe({
        next: () => this.alertService.success('Staff member added', 2000), // Show success alert
        error: (response) => this.alertService.error(response, 6000), // Show error alert
      });
    } else {
      // If no ID, show an error message indicating they can't be added
      this.alertService.error(
        'Unable to add staff member. Ensure they have a tutor or convenor account in User admin first.',
        6000,
      );
    }
  }

  // Method to filter staff members already assigned to the unit
  filterStaff(staff: UnitRole): boolean {
    // Return true if the staff member is not already in the unit's staff list
    return !this.unit.staff.find((listStaff) => staff.id === listStaff.user.id);
  }

  // Method to remove a staff member from the unit
  removeStaff(staff: UnitRole): void {
    this.newUnitRoleService.delete(staff, {cache: this.unit.staffCache}).subscribe({
      next: (response) => this.alertService.success('Staff member removed', 2000), // Show success alert
      error: (response) => this.alertService.error(response, 6000), // Show error alert
    });
  }

  // Method to get the name of a group set based on its ID
  groupSetName(id: number): string {
    return this.unit.groupSetsCache.get(id)?.name || 'Individual Work'; // Return the group set name or "Individual Work" if not found
  }
}

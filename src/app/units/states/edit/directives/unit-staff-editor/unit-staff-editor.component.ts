import { Component, Input, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { Subscription } from 'rxjs';
import { AlertService } from 'src/app/common/services/alert.service';
import { Unit, UnitRole, User } from 'src/app/api/models/doubtfire-model';
import { UnitRoleService } from 'src/app/api/services/unit-role.service';
import { UserService } from 'src/app/api/services/user.service';

@Component({
  selector: 'unit-staff-editor',
  templateUrl: './unit-staff-editor.component.html',
  styleUrls: ['./unit-staff-editor.component.scss'],
})
export class UnitStaffEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild(MatTable, { static: false }) table: MatTable<any>;
  @ViewChild(MatSort, { static: false }) sort: MatSort;
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  @Input() unit: Unit;

  selectedStaff: User | null = null;
  columns: string[] = ['avatar', 'name', 'role', 'mainConvenor', 'actions'];
  dataSource: MatTableDataSource<UnitRole>;
  allStaff: User[] = []; // Holds all staff fetched from UserService
  filteredStaff: User[] = []; // Holds filtered staff for autocomplete

  private subscriptions: Subscription[] = [];

  constructor(
    private alertService: AlertService,
    private unitRoleService: UnitRoleService,
    private userService: UserService,
  ) {}

  ngAfterViewInit(): void {
    this.dataSource = new MatTableDataSource(this.unit.staffCache.currentValuesClone());
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Customize filterPredicate to search by name
    this.dataSource.filterPredicate = (data: UnitRole, filter: string) => {
      const transformedFilter = filter.trim().toLowerCase();
      return data.user.name.toLowerCase().includes(transformedFilter);
    };

    this.subscriptions.push(
      this.unit.staffCache.values.subscribe((staff) => {
        this.dataSource.data = staff;
      })
    );

    this.userService.query().subscribe({
      next: () => {
        // Fetch all users and exclude users with the "Student" role
        this.allStaff = this.userService.cache
          .currentValuesClone()
          .filter((staff) => staff.systemRole !== 'Student');

        // Initialize filteredStaff by removing staff already in the unit
        this.filteredStaff = this.allStaff.filter(
          (staff) => !this.unit.staff.some((unitStaff) => unitStaff.user.id === staff.id)
        );
      },
      error: (err) => this.alertService.error('Failed to fetch all staff.', 6000),
    });

  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  addSelectedStaff(): void {
    const staff = this.selectedStaff;
    this.selectedStaff = null;

    // Check if the selected staff has an ID
    if (staff && staff.id) {
      this.unit.addStaff(staff).subscribe({
        next: () => {
          this.alertService.success('Staff member added successfully.', 2000);
        },
        error: (response) => {
          this.alertService.error(response, 6000);
        },
      });
    } else {
      // Show error if no valid staff is selected
      this.alertService.error(
        'Unable to add staff member. Ensure they have a tutor or convenor account in User admin first.',
        6000
      );
    }
  }

  changeRole(staff: UnitRole, role: string): void {
    // the roleMap and roleId can be remove when needed, it is also added into role string now
    const roleMap = {
      Tutor: 2,
      Convenor: 3,
    };

    const roleId = roleMap[role];

    if (roleId === undefined) {
      this.alertService.error(`Invalid role: ${role}`, 6000);
      return;
    }

    // Update both the roleId and the role string
    (staff as any).roleId = roleId;
    staff.role = role; // Update the role string

    this.unitRoleService.update(staff).subscribe({
      next: () => this.alertService.success('Role changed successfully.', 2000),
      error: (response) => this.alertService.error(response, 6000),
    });
  }

  changeMainConvenor(staff: UnitRole): void {
    if (!staff) {
      this.alertService.error('Invalid main convenor change request.', 6000);
      return;
    }

    this.unit.changeMainConvenor(staff).subscribe({
      next: () => {
        this.alertService.success('Main convenor changed successfully.', 2000);
      },
      error: (response) => {
        this.alertService.error(response, 6000);
      },
    });
  }

  removeStaff(staff: UnitRole): void {
    if (!staff) {
      this.alertService.error('Invalid staff removal request.', 6000);
      return;
    }

    this.unitRoleService.delete(staff, { cache: this.unit.staffCache }).subscribe({
      next: () => {
        this.alertService.success('Staff member removed successfully.', 2000);
      },
      error: (response) => {
        this.alertService.error(response, 6000);
      },
    });
  }


  filterStaff(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.toLowerCase();
    this.filteredStaff = this.allStaff.filter(
      (staff) =>
        staff.name.toLowerCase().includes(filterValue) &&
        !this.unit.staff.some((unitStaff) => unitStaff.user.id === staff.id)
    );
  }

  displayStaffName(staff: User): string {
    return staff ? staff.name : '';
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
}

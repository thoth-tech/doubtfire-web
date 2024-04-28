
import { ViewChild, Component, Input, Inject, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort, Sort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatAutocomplete } from '@angular/material/autocomplete';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { User } from 'src/app/api/models/doubtfire-model';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { UserService } from 'src/app/api/models/doubtfire-model';
import { Project, ProjectService, Unit, UnitRole, UnitRoleService } from 'src/app/api/models/doubtfire-model';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { AlertService } from 'src/app/common/services/alert.service';
import { MatFormField } from '@angular/material/form-field';
import _ from 'lodash';
import { consumerPollProducersForChange } from '@angular/core/primitives/signals';


@Component({
    selector: 'unit-staff-editor',
    templateUrl: 'unit-staff-editor.component.html',
    styleUrls: ['unit-staff-editor.component.scss'],
})
export class UnitStaffEditorComponent {
    @ViewChild(MatTable, {static:false}) table: MatTable<UnitRole>;
    @ViewChild(MatSort, { static: false}) sort: MatSort;
    @ViewChild(MatPaginator, {static: false}) paginator: MatPaginator;
    @Input() unit: any;
    formControl = new FormControl('');
    options: User[] = this.userService.cache.currentValuesClone();;


    private subscriptions: Subscription[] = [];

    columns: string[] = ['name', 'role', 'mainConvenor', 'test'];
    dataSource: MatTableDataSource<UnitRole>;

    constructor(
        private httpClient: HttpClient,
        private unitRoleService: UnitRoleService,
        private alertService: AlertService,
        private userService: UserService,
    ) {}

 

    ngAfterViewInit() {
        this.dataSource = new MatTableDataSource(this.unit.staffCache.currentValuesClone());
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        this.dataSource.filterPredicate = (data: any, filter: string) => data.matches(filter);
    
        this.subscriptions.push(
          this.unit.staffCache.values.subscribe((staff) => {
            this.dataSource.data = staff;
          })
        );
    
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((s) => s.unsubscribe());
      }

    applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
    }
    }

    changeRole(unitRole: UnitRole, role_id: any) {
        unitRole.id = role_id;
        this.alertService.success("Role changed", 3000);
        console.log(unitRole)

    }

    changeMainConvenor(staff) {
        this.unit.changeMainConvenor(staff)
        this.alertService.success("Convenor changed", 3000);

    }   

    removeStaff(staff) {
        console.log("removing staff");
        this.unitRoleService.delete(staff, {cache: this.unit.statffCache}).subscribe();
    }

    addSelectedStaff() {

        var staff = this.unit.selectedStaff;
        console.log(staff)
        this.unit.selectedStaff = null;
        this.unit.addStaff(staff, 'Tutor').subscribe();

        
    }

    filterStaff(staff) {
        _.find(this.unit.staff, staff.id == this.unit.staff.id, 0)
    }


    
    private sortCompare(aValue: number | string, bValue: number | string, isAsc: boolean) {
    return (aValue < bValue ? -1 : 1) * (isAsc ? 1 : -1);
    }



}


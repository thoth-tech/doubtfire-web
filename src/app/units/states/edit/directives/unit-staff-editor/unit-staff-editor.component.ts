
  import { ViewChild, Component, Input, Inject, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
  import { MatTable, MatTableDataSource } from '@angular/material/table';
  import { MatSort, Sort } from '@angular/material/sort';
  import { MatPaginator } from '@angular/material/paginator';
  import { HttpClient } from '@angular/common/http';
  import { Subscription } from 'rxjs';
  import { Project, ProjectService, Unit, UnitRole, UnitRoleService } from 'src/app/api/models/doubtfire-model';
import { alertService } from 'src/app/ajs-upgraded-providers';


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


    private subscriptions: Subscription[] = [];

    columns: string[] = ['name', 'role', 'main_convenor', 'test'];
    dataSource: MatTableDataSource<UnitRole>;

    constructor(
        private httpClient: HttpClient,
        private unitRoleService: UnitRoleService,


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
        this.unitRoleService.update(unitRole)

        }

        changeMainConvenor(staff) {
            this.unit.changeMainConvenor(staff);
    }

    
      private sortCompare(aValue: number | string, bValue: number | string, isAsc: boolean) {
        return (aValue < bValue ? -1 : 1) * (isAsc ? 1 : -1);
      }



}


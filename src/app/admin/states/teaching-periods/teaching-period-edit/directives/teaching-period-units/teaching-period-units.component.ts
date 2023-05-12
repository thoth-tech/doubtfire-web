import { Component, Input, Inject, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TeachingPeriod, Unit } from 'src/app/api/models/doubtfire-model';
import { Subscription } from 'rxjs';
import { rolloverTeachingPeriodModal } from 'src/app/ajs-upgraded-providers';
import { UIRouter } from '@uirouter/core';

@Component({
  selector: 'teaching-period-units',
  templateUrl: 'teaching-period-units.component.html',
  styleUrls: ['teaching-period-units.component.scss'],
})
export class TeachingPeriodUnitsComponent implements OnInit, OnDestroy {
  @ViewChild(MatTable, { static: false }) table: MatTable<Unit>;
  @ViewChild(MatSort, { static: false }) sort: MatSort;

  @Input() teachingperiod: TeachingPeriod;

  private subscriptions: Subscription[] = [];

  columns: string[] = ['unitCode', 'name', 'teachingPeriod', 'active'];
  dataSource: MatTableDataSource<Unit>;

  constructor(
    @Inject(rolloverTeachingPeriodModal) private rolloverTeachingPeriodModal: any,
    private router: UIRouter
  ) {}

  ngOnInit() {
    this.dataSource = new MatTableDataSource(this.teachingperiod.unitsCache.currentValuesClone());
    this.dataSource.sort = this.sort;

    this.subscriptions.push(
      this.teachingperiod.unitsCache.values.subscribe((units) => {
        this.dataSource.data = units;
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

  private sortCompare(aValue: number | string, bValue: number | string, isAsc: boolean) {
    return (aValue < bValue ? -1 : 1) * (isAsc ? 1 : -1);
  }

  sortTableData(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      return;
    }
    this.dataSource.data = this.dataSource.data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'unitCode':
        case 'name':
        case 'teachingPeriod':
        case 'active':
          return this.sortCompare(a[sort.active], b[sort.active], isAsc);
        default:
          return 0;
      }
    });
  }

  gotoUnit(unit: Unit) {
    this.router.stateService.go('units/admin', { unitId: unit.id });
  }

  rolloverTeachingPeriod() {
    this.rolloverTeachingPeriodModal.show(this.teachingperiod);
  }
}

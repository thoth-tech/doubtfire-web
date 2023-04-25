import { Component, Input, Inject, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { createBreakModal } from '../../../../../../ajs-upgraded-providers';
import { TeachingPeriod, TeachingPeriodBreak } from 'src/app/api/models/doubtfire-model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'teaching-period-breaks',
  templateUrl: 'teaching-period-breaks.component.html',
  styleUrls: ['teaching-period-breaks.component.scss'],
})
export class TeachingPeriodBreaksComponent implements OnInit, OnDestroy {
  @ViewChild(MatTable, { static: false }) table: MatTable<TeachingPeriodBreak>;
  @ViewChild(MatSort, { static: false }) sort: MatSort;

  @Input() teachingperiod: TeachingPeriod;

  private subscriptions: Subscription[] = [];

  columns: string[] = ['startDate', 'duration'];
  dataSource: MatTableDataSource<TeachingPeriodBreak>;

  constructor(@Inject(createBreakModal) private createBreakModal: any) {}

  ngOnInit() {
    this.dataSource = new MatTableDataSource(this.teachingperiod.breaksCache.currentValuesClone());
    this.dataSource.sort = this.sort;

    this.subscriptions.push(
      this.teachingperiod.breaksCache.values.subscribe((breaks) => {
        this.dataSource.data = breaks;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
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
        case 'startDate':
          return this.sortCompare(a.startDate.getTime(), b.startDate.getTime(), isAsc);
        case 'duration':
          return this.sortCompare(a.numberOfWeeks, b.numberOfWeeks, isAsc);
        default:
          return 0;
      }
    });
  }

  addBreak() {
    this.createBreakModal.show(this.teachingperiod);
  }
}

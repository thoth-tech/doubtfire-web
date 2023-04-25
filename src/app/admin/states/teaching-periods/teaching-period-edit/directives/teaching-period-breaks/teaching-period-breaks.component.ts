import { Component, Input, Inject, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { createBreakModal } from '../../../../../../ajs-upgraded-providers';
import { TeachingPeriod, TeachingPeriodBreak } from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'teaching-period-breaks',
  templateUrl: 'teaching-period-breaks.component.html',
  styleUrls: ['teaching-period-breaks.component.scss'],
})
export class TeachingPeriodBreaksComponent implements OnInit {
  @ViewChild(MatTable, { static: false }) table: MatTable<TeachingPeriodBreak>;
  @ViewChild(MatSort, { static: false }) sort: MatSort;
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  @Input() teachingperiod: TeachingPeriod;

  columns: string[] = ['startDate', 'duration'];
  dataSource: MatTableDataSource<TeachingPeriodBreak>;

  constructor(@Inject(createBreakModal) private createBreakModal: any) {}

  ngOnInit() {
    this.dataSource = new MatTableDataSource(this.teachingperiod.breaksCache.currentValuesClone());
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
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

import {NgxChartsModule} from '@swimlane/ngx-charts';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {Unit} from 'src/app/api/models/unit';
import {SummaryTaskStatusScatterComponent} from './summary-task-status-scatter.component';

const unit = {
  taskDefinitions: [
    {id: 1, abbreviation: '1.1P', name: 'First'},
    {id: 2, abbreviation: '2.1P', name: 'Second'},
  ],
} as unknown as Unit;
const data = {
  1: {
    10: [{status: 'complete', num: 3, tutorial_stream_id: 1}],
    20: [{status: 'complete', num: 2, tutorial_stream_id: 1}],
  },
  2: {10: [{status: 'not_started', num: 4, tutorial_stream_id: 1}]},
};

describe('SummaryTaskStatusScatterComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations()],
      declarations: [SummaryTaskStatusScatterComponent],
      imports: [FormsModule, MatCardModule, MatFormFieldModule, MatSelectModule, NgxChartsModule],
    }),
  );

  it('renders the chart and a table with summed task counts', () => {
    const fixture = TestBed.createComponent(SummaryTaskStatusScatterComponent);
    fixture.componentRef.setInput('unit', unit);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    expect(fixture.componentInstance.rows.map((row) => row.count)).toEqual([5, 4]);
    expect(fixture.nativeElement.querySelector('ngx-charts-bubble-chart svg')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('filters by tutorial and task without changing the source', () => {
    const chart = new SummaryTaskStatusScatterComponent();
    chart.unit = unit;
    chart.data = data;
    chart.tutorialId = 20;
    chart.taskId = 1;
    chart.updateData();
    expect(chart.rows).toEqual([{task: '1.1P', status: 'Complete', count: 2}]);
    expect(data[1][10][0].num).toBe(3);
    expect(chart.formatTask(0)).toBe('1.1P');
    expect(chart.formatTask(2.5)).toBe('');
  });

  it('clears unavailable data and ignores invalid or unknown counts', () => {
    const chart = new SummaryTaskStatusScatterComponent();
    chart.unit = unit;
    chart.data = {
      1: {
        10: [
          {status: 'unknown', num: 3, tutorial_stream_id: 1},
          {status: 'complete', num: NaN, tutorial_stream_id: 1},
        ],
      },
    };
    chart.ngOnChanges();
    expect(chart.rows).toEqual([]);
    chart.data = undefined;
    chart.ngOnChanges();
    expect(chart.rows).toEqual([]);
  });
});

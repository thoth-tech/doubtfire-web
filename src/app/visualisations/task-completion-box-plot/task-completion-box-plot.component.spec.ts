import {BoxSeriesComponent, NgxChartsModule} from '@swimlane/ngx-charts';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {By} from '@angular/platform-browser';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {GradeService} from 'src/app/common/services/grade.service';
import {TaskCompletionBoxPlotComponent} from './task-completion-box-plot.component';

const summary = {min: 1, lower: 3, median: 4.5, upper: 8, max: 10};
const data = {unit: summary, tutorial: {10: {...summary, max: 9}}, grade: {0: summary}};

describe('TaskCompletionBoxPlotComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations()],
      declarations: [TaskCompletionBoxPlotComponent],
      imports: [FormsModule, MatCardModule, MatFormFieldModule, MatSelectModule, NgxChartsModule],
    }),
  );

  it('renders a box with exactly the API bounds and median', () => {
    const fixture = TestBed.createComponent(TaskCompletionBoxPlotComponent);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    const box = fixture.debugElement.query(By.directive(BoxSeriesComponent)).componentInstance;
    expect(box.quartiles).toEqual([3, 4.5, 8]);
    expect(box.whiskers).toEqual([1, 10]);
    expect(fixture.nativeElement.querySelector('ngx-charts-box-chart svg')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('4.5');
  });

  it('selects tutorial summaries and unit-wide grade summaries', () => {
    const chart = new TaskCompletionBoxPlotComponent(new GradeService());
    chart.data = data;
    chart.tutorialId = 10;
    chart.ngOnChanges();
    expect(chart.rows[0].summary.max).toBe(9);
    chart.group = 'grade';
    chart.updateData();
    expect(chart.rows).toEqual([{name: 'Pass', summary}]);
  });

  it('handles empty, zero and invalid summaries', () => {
    const chart = new TaskCompletionBoxPlotComponent(new GradeService());
    chart.ngOnChanges();
    expect(chart.rows).toEqual([]);
    chart.data = {unit: {min: 0, lower: 0, median: 0, upper: 0, max: 0}, tutorial: {}, grade: {}};
    chart.ngOnChanges();
    expect(chart.hasCompletions).toBe(false);
    chart.data.unit.median = NaN;
    chart.ngOnChanges();
    expect(chart.rows).toEqual([]);
  });
});

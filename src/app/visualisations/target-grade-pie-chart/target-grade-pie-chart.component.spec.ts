import {NgxChartsModule} from '@swimlane/ngx-charts';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatCardModule} from '@angular/material/card';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {Unit} from 'src/app/api/models/unit';
import {ThemeColorService} from 'src/app/common/theme/theme-color.service';
import {ResolvedTheme} from 'src/app/common/theme/theme.service';
import {TargetGradePieChartComponent} from './target-grade-pie-chart.component';

const data = [
  {tutorial_id: 10, tutorial_stream_id: 1, grade: 0, num: 2},
  {tutorial_id: 20, tutorial_stream_id: 1, grade: 0, num: 1},
  {tutorial_id: 20, tutorial_stream_id: 1, grade: 3, num: 1},
];

describe('TargetGradePieChartComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideNoopAnimations()],
      declarations: [TargetGradePieChartComponent],
      imports: [MatCardModule, NgxChartsModule],
    }),
  );

  it('renders grade counts, colours and rounded percentages', () => {
    const fixture = TestBed.createComponent(TargetGradePieChartComponent);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    const chart = fixture.componentInstance;
    expect(chart.series).toEqual([
      {name: 'Pass', value: 3},
      {name: 'High Distinction', value: 1},
    ]);
    expect(chart.percentage(3)).toBe(75);
    expect(chart.colors.map((colour) => colour.name)).toEqual(['Pass', 'High Distinction']);
    expect(chart.colors.every((colour) => colour.value.length > 0)).toBe(true);
    expect(fixture.nativeElement.querySelector('ngx-charts-pie-chart svg')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('75%');
  });

  it('takes slice colours from the theme tokens and follows a theme change', () => {
    const theme = signal<ResolvedTheme>('light');
    TestBed.overrideProvider(ThemeColorService, {
      useValue: {
        resolved: theme.asReadonly(),
        token: (name: string) => `${theme()}${name}`,
      },
    });
    const fixture = TestBed.createComponent(TargetGradePieChartComponent);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    expect(fixture.componentInstance.colors).toEqual([
      {name: 'Pass', value: 'light--ot-chart-4'},
      {name: 'High Distinction', value: 'light--ot-chart-3'},
    ]);

    theme.set('dark');
    fixture.detectChanges();
    expect(fixture.componentInstance.colors.map((colour) => colour.value)).toEqual([
      'dark--ot-chart-4',
      'dark--ot-chart-3',
    ]);
  });

  it('respects tutorial filters and configured grade labels', () => {
    const chart = TestBed.createComponent(TargetGradePieChartComponent).componentInstance;
    chart.unit = {
      gradeDefinitions: [{id: 'pass', value: 0, label: 'Satisfactory', abbreviation: 'S'}],
    } as Unit;
    chart.data = data;
    chart.tutorialId = 10;
    chart.ngOnChanges();
    expect(chart.series).toEqual([{name: 'Satisfactory', value: 2}]);
    expect(chart.colors.map((colour) => colour.name)).toEqual(['Satisfactory']);
  });

  it('clears stale values and never divides by zero', () => {
    const chart = TestBed.createComponent(TargetGradePieChartComponent).componentInstance;
    chart.data = data;
    chart.ngOnChanges();
    chart.data = [];
    chart.ngOnChanges();
    expect(chart.series).toEqual([]);
    expect(chart.colors).toEqual([]);
    expect(chart.percentage(0)).toBe(0);
  });
});

import {NgxChartsModule} from '@swimlane/ngx-charts';
import {TestBed} from '@angular/core/testing';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {PeerProgressService, Project} from 'src/app/api/models/doubtfire-model';
import {ProjectProgressGaugeComponent} from 'src/app/common/project-progress/project-progress-gauge.component';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {ProgressBurndownChartComponent} from './progress-burndown-chart/progress-burndown-chart.component';
import {TaskStatusPieChartComponent} from './task-status-pie-chart/task-status-pie-chart.component';

describe('Existing charts on Angular 22', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [NgxChartsModule, MatIconModule, MatProgressSpinnerModule],
      declarations: [
        TaskStatusPieChartComponent,
        ProgressBurndownChartComponent,
        ProjectProgressGaugeComponent,
      ],
      providers: [
        provideNoopAnimations(),
        {provide: PeerProgressService, useValue: {}},
        {provide: DemoModeStore, useValue: {enabled: false}},
      ],
    }),
  );

  it('renders the existing project task status pie', () => {
    const fixture = TestBed.createComponent(TaskStatusPieChartComponent);
    fixture.componentRef.setInput('project', {
      activeTasks: () => [{status: 'complete'}, {status: 'not_started'}],
    } as unknown as Project);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ngx-charts-pie-chart svg')).toBeTruthy();
    expect(fixture.componentInstance.data).toContainEqual({name: 'Complete', value: 1});
  });

  it('renders the existing burndown line chart and series controls', () => {
    const startDate = new Date(2026, 6, 1);
    const endDate = new Date(2026, 7, 1);
    const fixture = TestBed.createComponent(ProgressBurndownChartComponent);
    fixture.componentRef.setInput('project', {
      id: 1,
      unit: {startDate, endDate},
      refreshBurndownChartData: vi.fn(),
      burndownChartData: [
        {
          key: 'Target',
          values: [
            [startDate.getTime(), 1],
            [endDate.getTime(), 0],
          ],
        },
      ],
    } as unknown as Project);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ngx-charts-line-chart svg')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Target');
  });

  it('renders the existing progress gauge', () => {
    const fixture = TestBed.createComponent(ProjectProgressGaugeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ngx-charts-gauge svg')).toBeTruthy();
  });
});

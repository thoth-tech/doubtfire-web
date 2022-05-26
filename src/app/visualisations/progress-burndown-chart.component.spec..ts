

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { projectService} from '../ajs-upgraded-providers';
import { VisulizationService} from './visulization.service';
import { ProgressBurndownChartComponent } from './progress-burndown-chart.component';

describe('ProgressBurndownChartComponent', () => {
  let component: ProgressBurndownChartComponent;
  let fixture: ComponentFixture<ProgressBurndownChartComponent>;
  let projectServiceStub: jasmine.SpyObj<any> = {};
   let VisulizationServiceStub: jasmine.SpyObj<any> = {};

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [ProgressBurndownChartComponent],
        providers: [
          { provide: projectService, useValue: projectServiceStub },
          { provide: VisulizationService, useValue: VisulizationServiceStub },
         ],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressBurndownChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
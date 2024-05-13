import {Component, Injector, OnInit, ViewContainerRef} from '@angular/core';
import {TooltipService} from '@swimlane/ngx-charts';

@Component({
  selector: 'f-project-progress',
  templateUrl: './project-progress.component.html',
  styleUrl: './project-progress.component.css',
})
export class ProjectProgressComponent implements OnInit {
  ngOnInit(): void {
    this.chartToolTipService.injectionService.setRootViewContainer(this.viewContainerRef);
  }

  constructor(private injectorObj: Injector) {
    this.chartToolTipService = this.injectorObj.get(TooltipService);
    this.viewContainerRef = this.injectorObj.get(ViewContainerRef);
  }
  private chartToolTipService: TooltipService;
  readonly viewContainerRef: ViewContainerRef;

  data = [
    {
      'name': 'Pass',
      'value': 100,
      'label': '100%',
    },
    {
      'name': 'Credit',
      'value': 79,
    },
    {
      'name': 'Distinction',
      'value': 40,
    },
    {
      'name': 'HD',
      'value': 19,
    },
  ];
  smallView = [90, 90];
  view = [400, 250];
  legend: boolean = true;
  legendPosition: string = 'below';

  colorScheme = {
    domain: ['#5AA454', '#E44D25', '#CFC0BB', '#7aa3e5', '#a8385d', '#aae3f5'],
  };
}

import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';

@Component({
  selector: 'f-portfolio-welcome-step',
  templateUrl: 'portfolio-welcome-step.component.html',
  styleUrls: ['portfolio-welcome-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
  host: {class: 'block'},
})
export class PortfolioWelcomeStepComponent implements OnInit {
  @Input() onAdvanceActiveTab?: (index: 1 | -1) => void;

  public externalName: string = 'OnTrack';

  // The four steps after this one, in the order the stepper shows them.
  public readonly steps: {icon: string; title: string; detail: string}[] = [
    {
      icon: 'workspace_premium',
      title: 'Choose your grade',
      detail: 'Check the assessment criteria, then pick the grade your work has earned.',
    },
    {
      icon: 'description',
      title: 'Add your learning summary report',
      detail: 'One document with your self-assessment and your reflections on the unit.',
    },
    {
      icon: 'attach_file',
      title: 'Add other files',
      detail: 'Optional. Anything extra you want at the front of your portfolio.',
    },
    {
      icon: 'menu_book',
      title: 'Review and create',
      detail: 'Check which tasks go in, then ask for your portfolio to be created.',
    },
  ];

  constructor(private constants: DoubtfireConstants) {}

  ngOnInit(): void {
    this.constants.ExternalName.subscribe((name) => {
      this.externalName = name;
    });
  }

  goNextStep() {
    if (this.onAdvanceActiveTab) {
      this.onAdvanceActiveTab(1);
      return;
    }
  }
}

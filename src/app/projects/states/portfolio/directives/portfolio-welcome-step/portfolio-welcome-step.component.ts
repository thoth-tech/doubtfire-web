import {Component, Input} from "@angular/core";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'portfolio-welcome-step',
  templateUrl: './portfolio-welcome-step.component.html',
  styleUrl: '../../portfolio.component.scss'
})
export class PortfolioWelcomeStepComponent {
  @Input() advanceActiveTab?: (step: number) => void;
  @Input() externalName: string;

  public advanceTab(): void {
    if (!this.advanceActiveTab) {
      console.warn('advanceActiveTab is not bound. Check parent template.');
      return;
    }
    this.advanceActiveTab(1);
  }
}

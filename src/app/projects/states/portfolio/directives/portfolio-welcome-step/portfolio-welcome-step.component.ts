import {Component, Input} from "@angular/core";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'portfolio-welcome-step',
  templateUrl: './portfolio-welcome-step.component.html',
})
export class PortfolioWelcomeStepComponent {
  @Input() advanceActiveTab!: (step: number) => void;

  public advanceTab(): void {
    if (this.advanceActiveTab) {
      this.advanceActiveTab(1);
    } else {
      console.log(
        'function "advanceActiveTab(advanceBy) unbound"'
        + '\ncheck portfolio template binds input correctly'
      )
    }
  }
}

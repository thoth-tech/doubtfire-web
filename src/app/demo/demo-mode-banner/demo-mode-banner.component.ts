import {ChangeDetectionStrategy, Component, Inject} from '@angular/core';
import {DEMO_RELOAD} from '../demo-controls/demo-controls.component';
import {DemoModeStore} from '../demo-mode.store';

@Component({
  selector: 'f-demo-mode-banner',
  templateUrl: './demo-mode-banner.component.html',
  styleUrls: ['./demo-mode-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DemoModeBannerComponent {
  constructor(
    readonly demoMode: DemoModeStore,
    @Inject(DEMO_RELOAD) private reload: () => void,
  ) {}

  exitDemo(): void {
    this.demoMode.reset();
    this.reload();
  }
}

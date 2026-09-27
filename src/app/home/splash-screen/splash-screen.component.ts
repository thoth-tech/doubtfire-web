import {ChangeDetectionStrategy, Component} from '@angular/core';
import {Observable} from 'rxjs';
import {GlobalStateService, StartupState} from 'src/app/projects/states/index/global-state.service';

@Component({
  selector: 'splash-screen',
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SplashScreenComponent {
  readonly startupState$: Observable<StartupState>;

  constructor(private globalState: GlobalStateService) {
    this.startupState$ = this.globalState.startupStateSubject.asObservable();
  }

  retry(): void {
    this.globalState.retryStartup();
  }

  continueToSignIn(): void {
    this.globalState.continueToSignIn();
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import {Component, ContentChild, OnInit, TemplateRef} from '@angular/core';
import {AnimationOptions} from 'ngx-lottie';
import {Observable} from 'rxjs';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {LoadingService} from './LoadingService.service';
@Component({
  selector: 'splash-screen',
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss'],
})
export class SplashScreenComponent implements OnInit {
  constructor(
    private globalState: GlobalStateService,
    private loadingService: LoadingService,
  ) {
    this.loading$ = this.loadingService.loading$;
  }

  loading$: Observable<boolean>;

  @ContentChild('loading')
  customLoadingIndicator: TemplateRef<any> | null = null;

  options: AnimationOptions = {
    loop: true,
    autoplay: true,
    path: '../../../assets/images/formatif-isolated-lottie.json',
  };

  public ngOnInit(): void {
    this.globalState.isLoadingSubject.subscribe((isLoading) => {
      if (isLoading) {
        this.loadingService.loadingOn();
      }
      if (!isLoading) {
        this.loadingService.loadingOff();
      }
    });
  }
}

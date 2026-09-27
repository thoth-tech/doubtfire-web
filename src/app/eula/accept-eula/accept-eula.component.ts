import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {Router} from '@angular/router';
import {Observable, ReplaySubject, Subscription, take} from 'rxjs';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {TiiService} from 'src/app/api/services/tii.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';

@Component({
  selector: 'f-accept-eula',
  templateUrl: './accept-eula.component.html',
  styleUrls: ['./accept-eula.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AcceptEulaComponent implements OnDestroy {
  public toolName: Observable<string>;
  public eulaHtml: string;

  public iframeDoc$: ReplaySubject<Document> = new ReplaySubject(1);

  private authenticationSubscription: Subscription;

  constructor(
    private constants: DoubtfireConstants,
    private authenticationService: AuthenticationService,
    private tiiService: TiiService,
    private userService: UserService,
    private alertService: AlertService,
    private router: Router,
  ) {
    // Auth completion now includes the protected settings request. Do not react
    // to IsTiiEnabled's pre-authentication false default: on a cold /eula load
    // that used to redirect before a remembered session could be restored.
    this.authenticationSubscription = this.authenticationService.afterAuthCall((authenticated) => {
      if (authenticated && this.constants.IsTiiEnabled.value) {
        this.getEulaHtml();
      } else {
        this.router.navigateByUrl('/home');
      }
    });

    this.toolName = constants.ExternalName;
  }

  public ngOnDestroy(): void {
    this.authenticationSubscription.unsubscribe();
  }

  public getEulaHtml(): void {
    this.tiiService.getTiiEula().subscribe((eulaHtml) => {
      this.eulaHtml = eulaHtml;
      this.updateHtmlEulaInIFrame();
    });
  }

  public acceptEula(): void {
    this.userService.currentUser.acceptTiiEula().subscribe(() => {
      this.alertService.success('You have accepted the EULAs');
      this.router.navigateByUrl('/home');
    });
  }

  public onIframeLoad(iframe: HTMLIFrameElement): void {
    if (iframe.contentDocument) {
      this.iframeDoc$.next(iframe.contentDocument);
    }
  }

  getIframeDoc(): Observable<Document> {
    return this.iframeDoc$.asObservable();
  }

  updateHtmlEulaInIFrame(): void {
    this.getIframeDoc()
      .pipe(take(1))
      .subscribe((iframeDoc) => {
        iframeDoc.open();
        iframeDoc.write(this.eulaHtml);
      });
  }
}

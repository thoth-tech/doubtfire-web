import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Optional,
} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {User} from 'src/app/api/models/user/user';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {PushBlocker, PushNotificationService} from 'src/app/api/services/push-notification.service';
import {UserService} from 'src/app/api/services/user.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';

@Component({
  selector: 'f-edit-profile-form',
  templateUrl: './edit-profile-form.component.html',
  styleUrls: ['./edit-profile-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EditProfileFormComponent implements OnInit, OnDestroy {
  constructor(
    private constants: DoubtfireConstants,
    private userService: UserService,
    private router: Router,
    private authService: AuthenticationService,
    @Optional()
    @Inject(MAT_DIALOG_DATA)
    public data: {user: User; mode: 'edit' | 'create' | 'new'; modal: boolean},
    private _snackBar: MatSnackBar,
    private pushService: PushNotificationService,
  ) {
    this.user = data?.user || this.userService.currentUser;
  }

  /**
   * The mode of the form, either 'edit', 'create', or 'new'
   * edit is for editing an existing user
   * create is used on first login
   * new is used for creating a new user
   */
  @Input() mode: 'edit' | 'create' | 'new';
  @Input() modal: boolean = false;

  public user: User;
  public externalName = this.constants.ExternalName;
  public initialFirstName: string;
  public formPronouns = {pronouns: ''};
  public get customPronouns(): boolean {
    return this.formPronouns.pronouns === '__customPronouns';
  }

  /**
   * Push opt-in state. `pushSubscribed` starts false and flips once the service
   * worker registers, which is six seconds after the page loads, so this is
   * driven by a subscription rather than read once.
   */
  public pushSubscribed = false;
  public pushBusy = false;
  private pushSubscription?: Subscription;

  ngOnInit(): void {
    if (this.data?.mode) {
      this.mode = this.data.mode;
    }
    if (this.data?.modal) {
      this.modal = this.data.modal;
    }

    this.pushSubscription = this.pushService.subscription$.subscribe(
      (subscription) => (this.pushSubscribed = subscription !== null),
    );

    // Existing users from an older API response have no stored value. Treat
    // that as the product default (on) until they explicitly opt out.
    if (this.user.displayPeerProgress === undefined || this.user.displayPeerProgress === null) {
      this.user.displayPeerProgress = true;
    }

    if (!this.user.hasRunFirstTimeSetup) {
      this.user.optInToResearch = false;
      this.user.receiveFeedbackNotifications = true;
      this.user.receivePortfolioNotifications = true;
      this.user.receiveTaskNotifications = true;
      this.user.displayPeerProgress = true;
    }
  }

  ngOnDestroy(): void {
    this.pushSubscription?.unsubscribe();
  }

  /**
   * Why the push button cannot be used, or null if it can. Drives the message
   * shown under the button.
   */
  public get pushBlocker(): PushBlocker | null {
    return this.pushService.blocker();
  }

  public get pushBlockerMessage(): string {
    switch (this.pushBlocker) {
      case 'unsupported':
        return 'This browser does not support push notifications.';
      case 'permission-denied':
        return 'You have blocked notifications for this site. Allow them in your browser settings, then reload.';
      case 'not-configured':
        return 'Push notifications are not set up on this server.';
      case 'no-service-worker':
        return 'Still starting up. This becomes available a few seconds after the page loads.';
      default:
        return '';
    }
  }

  /**
   * Per-browser steps to reverse a blocked notification permission. Empty
   * unless pushBlocker is 'permission-denied' — the generic message covers
   * every other blocker.
   */
  public get pushBlockerInstructions(): string[] {
    return this.pushBlocker === 'permission-denied'
      ? this.pushService.permissionDeniedInstructions()
      : [];
  }

  public togglePushNotifications(): void {
    if (this.pushBusy) {
      return;
    }
    this.pushBusy = true;

    const wasSubscribed = this.pushSubscribed;
    const request = wasSubscribed ? this.pushService.unsubscribe() : this.pushService.subscribe();

    request.subscribe({
      next: () => {
        this.pushBusy = false;
        this.notify(
          wasSubscribed ? 'Push notifications turned off' : 'Push notifications turned on',
        );
      },
      error: (error) => {
        this.pushBusy = false;
        // Denying the permission prompt rejects requestSubscription, so this is
        // an ordinary outcome and not only a failure.
        this.notify(
          Notification.permission === 'denied'
            ? 'Notifications are blocked in your browser'
            : 'Could not change push notifications',
        );
        console.error(error);
      },
    });
  }

  private notify(message: string): void {
    this._snackBar.open(message, 'dismiss', {
      duration: 2500,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  public signOut(): void {
    this.authService.signOut();
  }

  public get newUser(): boolean {
    return this.mode === 'new';
  }

  public get canEditSystemRole(): boolean {
    return !(this.user.id === this.userService.currentUser.id);
  }

  public get canSeeSystemRole(): boolean {
    return (
      this.userService.currentUser.systemRole === 'Admin' ||
      this.userService.currentUser.systemRole === 'Convenor'
    );
  }

  public get tiiEnabled(): boolean {
    return this.constants.IsTiiEnabled.value;
  }

  public submit(): void {
    this.user.pronouns = this.customPronouns ? this.user.pronouns : this.formPronouns.pronouns;
    this.user.hasRunFirstTimeSetup = true;

    if (this.newUser) {
      this.userService.create(this.user).subscribe({
        next: (updatedUser) => {
          this.user = updatedUser;
          this.initialFirstName = this.user.firstName;

          this._snackBar.open('User created', 'dismiss', {
            duration: 1500,
            horizontalPosition: 'end',
            verticalPosition: 'top',
          });
        },
        error: (error) => console.log(error),
      });
    } else {
      this.userService.update(this.user).subscribe({
        next: (updatedUser) => {
          if (this.mode === 'create') {
            this.router.navigateByUrl('/home');
          } else {
            this.user = updatedUser;
            this.initialFirstName = this.user.firstName;

            // TODO: refactor into new alertService
            // this is a new snackbar alert test
            this._snackBar.open('Profile saved', 'dismiss', {
              duration: 1500,
              horizontalPosition: 'end',
              verticalPosition: 'top',
            });
          }
        },
        error: (error) => console.log(error),
      });
    }
  }
}

import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {AdditionalNotificationEmailService} from 'src/app/api/services/additional-notification-email.service';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {consumeAdditionalEmailVerificationToken} from 'src/app/security/additional-email-verification-callback';

type VerificationState = 'verifying' | 'verified' | 'error';

@Component({
  selector: 'f-verify-additional-email',
  templateUrl: './verify-additional-email.component.html',
  styleUrl: './verify-additional-email.component.scss',
  standalone: false,
})
export class VerifyAdditionalEmailComponent implements OnInit {
  public state: VerificationState = 'verifying';
  public message = 'Verifying your additional notification email…';

  constructor(
    private additionalEmailService: AdditionalNotificationEmailService,
    private authentication: AuthenticationService,
    private router: Router,
    private changeDetector: ChangeDetectorRef,
  ) {}

  public openProfile(): void {
    if (this.authentication.isAuthenticated()) {
      void this.router.navigateByUrl('/edit_profile');
    } else {
      // Startup skips the refresh-token login on this route, so a saved session
      // is never restored here. A full load of the profile page runs the normal
      // startup, which restores that session or saves the profile as the return
      // URL and sends the user to sign in.
      window.location.assign('/edit_profile');
    }
  }

  public ngOnInit(): void {
    const token = consumeAdditionalEmailVerificationToken();
    if (!token) {
      this.state = 'error';
      this.message = 'This verification link is incomplete.';
      return;
    }

    // The component is OnPush by default, so a response that arrives after the
    // first render has to mark the view or the page stays on "Verifying".
    this.additionalEmailService.verify(token).subscribe({
      next: () => {
        this.state = 'verified';
        this.message = 'Your additional notification email is verified.';
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.state = 'error';
        this.message = 'This verification link is invalid, expired, or has already been used.';
        this.changeDetector.markForCheck();
      },
    });
  }
}

import {HttpErrorResponse} from '@angular/common/http';
import {ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import {User} from 'src/app/api/models/user/user';
import {
  AdditionalNotificationEmailService,
  AdditionalNotificationEmailState,
} from 'src/app/api/services/additional-notification-email.service';

@Component({
  selector: 'f-additional-notification-email',
  templateUrl: './additional-notification-email.component.html',
  styleUrl: './additional-notification-email.component.scss',
  standalone: false,
})
export class AdditionalNotificationEmailComponent implements OnInit {
  @Input({required: true}) user!: User;

  public state: AdditionalNotificationEmailState = {
    status: 'none',
    email: null,
    verificationExpiresAt: null,
  };
  public draftEmail = '';
  public loading = true;
  public busy = false;
  public message = '';
  public errorMessage = '';

  constructor(
    private additionalEmailService: AdditionalNotificationEmailService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    this.additionalEmailService.get(this.user.id).subscribe({
      next: (state) => {
        this.applyState(state);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.errorText(error, 'Could not load additional email settings.');
        this.changeDetector.markForCheck();
      },
    });
  }

  public get changed(): boolean {
    return this.draftEmail.trim().toLowerCase() !== (this.state.email ?? '').toLowerCase();
  }

  public get requestLabel(): string {
    if (this.state.status === 'verified') {
      return 'Change email and send verification';
    }
    return this.state.status === 'pending'
      ? 'Update email and send verification'
      : 'Send verification email';
  }

  public requestVerification(): void {
    const email = this.draftEmail.trim();
    if (this.busy || !email || !this.changed) {
      return;
    }

    this.startRequest();
    this.additionalEmailService.request(this.user.id, email).subscribe({
      next: (state) => {
        this.applyState(state);
        this.busy = false;
        this.message = 'Verification email requested. No notification copies are sent yet.';
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not request verification.'),
    });
  }

  /**
   * This block sits inside the profile form, so Enter in the email field would
   * otherwise submit the whole profile and request nothing. Treat Enter as the
   * verification button instead, and do nothing when that button is disabled.
   */
  public requestVerificationOnEnter(event: Event, invalid: boolean): void {
    event.preventDefault();
    if (!invalid) {
      this.requestVerification();
    }
  }

  public resend(): void {
    if (this.busy || this.state.status !== 'pending') {
      return;
    }

    this.startRequest();
    this.additionalEmailService.resend(this.user.id).subscribe({
      next: (state) => {
        this.applyState(state);
        this.busy = false;
        this.message = 'A new verification email was requested. Earlier links no longer work.';
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not resend verification.'),
    });
  }

  public remove(): void {
    if (this.busy || this.state.status === 'none') {
      return;
    }
    if (!window.confirm('Remove this additional notification email? Future copies will stop.')) {
      return;
    }

    this.startRequest();
    this.additionalEmailService.remove(this.user.id).subscribe({
      next: () => {
        this.applyState({status: 'none', email: null, verificationExpiresAt: null});
        this.busy = false;
        this.message = 'Additional notification email removed.';
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Could not remove the email.'),
    });
  }

  private applyState(state: AdditionalNotificationEmailState): void {
    this.state = state;
    this.draftEmail = state.email ?? '';
  }

  private startRequest(): void {
    this.busy = true;
    this.message = '';
    this.errorMessage = '';
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.busy = false;
    this.errorMessage = this.errorText(error, fallback);
    this.changeDetector.markForCheck();
  }

  private errorText(error: HttpErrorResponse, fallback: string): string {
    return typeof error.error?.error === 'string' ? error.error.error : fallback;
  }
}

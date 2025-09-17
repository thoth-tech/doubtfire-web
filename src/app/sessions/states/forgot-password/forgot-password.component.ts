import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { StateService } from '@uirouter/core';
import { AlertService } from 'src/app/common/services/alert.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { GlobalStateService } from 'src/app/projects/states/index/global-state.service';

@Component({
  selector: 'f-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent implements OnInit {
  requestingReset: boolean = false;
  emailSent: boolean = false;
  formData = {
    email: ''
  };

  constructor(
    private httpClient: HttpClient,
    private state: StateService,
    private constants: DoubtfireConstants,
    private globalState: GlobalStateService,
    private alerts: AlertService,
  ) {}

  ngOnInit(): void {
    this.globalState.hideHeader();
  }

  requestPasswordReset(): void {
    if (!this.formData.email) {
      this.alerts.error('Please enter your email address', 6000);
      return;
    }

    this.requestingReset = true;

    this.httpClient.post(`${this.constants.API_URL}/password/reset`, {
      email: this.formData.email
    }).subscribe({
      next: (response: any) => {
        this.requestingReset = false;
        this.emailSent = true;
        this.alerts.success('If an account with that email exists, a password reset link has been sent.', 8000);
      },
      error: (error) => {
        this.requestingReset = false;
        this.alerts.error('Failed to send password reset email. Please try again.', 6000);
      },
    });
  }

  goToLogin(): void {
    this.state.go('sign_in');
  }
}


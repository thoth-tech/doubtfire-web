import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { StateService, Transition } from '@uirouter/core';
import { AlertService } from 'src/app/common/services/alert.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { GlobalStateService } from 'src/app/projects/states/index/global-state.service';

@Component({
  selector: 'f-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  resettingPassword: boolean = false;
  passwordReset: boolean = false;
  token: string = '';
  formData = {
    password: '',
    passwordConfirmation: ''
  };

  constructor(
    private httpClient: HttpClient,
    private state: StateService,
    private transition: Transition,
    private constants: DoubtfireConstants,
    private globalState: GlobalStateService,
    private alerts: AlertService,
  ) {}

  ngOnInit(): void {
    this.globalState.hideHeader();
    this.token = this.transition.params().token || '';
    
    if (!this.token) {
      this.alerts.error('Invalid reset link. Please request a new password reset.', 6000);
      this.state.go('forgot-password');
    }
  }

  resetPassword(): void {
    if (this.formData.password !== this.formData.passwordConfirmation) {
      this.alerts.error('Passwords do not match', 6000);
      return;
    }

    if (this.formData.password.length < 8) {
      this.alerts.error('Password must be at least 8 characters long', 6000);
      return;
    }

    this.resettingPassword = true;

    this.httpClient.post(`${this.constants.API_URL}/password/reset/confirm`, {
      token: this.token,
      password: this.formData.password,
      password_confirmation: this.formData.passwordConfirmation
    }).subscribe({
      next: (response: any) => {
        this.resettingPassword = false;
        this.passwordReset = true;
        this.alerts.success('Your password has been reset successfully!', 6000);
        
        // Redirect to login after a short delay
        setTimeout(() => {
          this.state.go('sign_in');
        }, 3000);
      },
      error: (error) => {
        this.resettingPassword = false;
        this.formData.password = '';
        this.formData.passwordConfirmation = '';
        
        let errorMessage = 'Password reset failed';
        if (error.error && error.error.error) {
          errorMessage = error.error.error;
          if (error.error.details) {
            errorMessage += ': ' + error.error.details.join(', ');
          }
        }
        
        this.alerts.error(errorMessage, 6000);
      },
    });
  }

  goToLogin(): void {
    this.state.go('sign_in');
  }
}


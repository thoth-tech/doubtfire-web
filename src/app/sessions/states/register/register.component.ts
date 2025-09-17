import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { StateService } from '@uirouter/core';
import { AuthenticationService } from 'src/app/api/services/authentication.service';
import { AlertService } from 'src/app/common/services/alert.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { GlobalStateService } from 'src/app/projects/states/index/global-state.service';

@Component({
  selector: 'f-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnInit {
  registering: boolean = false;
  formData = {
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    firstName: '',
    lastName: '',
    nickname: ''
  };

  constructor(
    private httpClient: HttpClient,
    private authService: AuthenticationService,
    private state: StateService,
    private constants: DoubtfireConstants,
    private globalState: GlobalStateService,
    private alerts: AlertService,
  ) {}

  ngOnInit(): void {
    this.globalState.hideHeader();
  }

  register(): void {
    if (this.formData.password !== this.formData.passwordConfirmation) {
      this.alerts.error('Passwords do not match', 6000);
      return;
    }

    if (this.formData.password.length < 8) {
      this.alerts.error('Password must be at least 8 characters long', 6000);
      return;
    }

    this.registering = true;

    const registrationData = {
      username: this.formData.username,
      email: this.formData.email,
      password: this.formData.password,
      password_confirmation: this.formData.passwordConfirmation,
      first_name: this.formData.firstName,
      last_name: this.formData.lastName,
      nickname: this.formData.nickname || this.formData.firstName
    };

    this.httpClient.post(`${this.constants.API_URL}/register`, registrationData).subscribe({
      next: (response: any) => {
        this.registering = false;
        this.alerts.success('Registration successful! You are now logged in.', 6000);
        this.state.go('home');
      },
      error: (error) => {
        this.registering = false;
        this.formData.password = '';
        this.formData.passwordConfirmation = '';
        
        let errorMessage = 'Registration failed';
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


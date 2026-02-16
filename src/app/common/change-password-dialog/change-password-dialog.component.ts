import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { AlertService } from 'src/app/common/services/alert.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { AuthenticationService } from 'src/app/api/services/authentication.service';

@Component({
  selector: 'f-change-password-dialog',
  templateUrl: './change-password-dialog.component.html',
  styleUrls: ['./change-password-dialog.component.scss'],
})
export class ChangePasswordDialogComponent {
  changingPassword: boolean = false;
  formData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  constructor(
    public dialogRef: MatDialogRef<ChangePasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private httpClient: HttpClient,
    private alerts: AlertService,
    private constants: DoubtfireConstants,
    private authService: AuthenticationService
  ) {}

  changePassword(): void {
    if (this.formData.newPassword !== this.formData.confirmPassword) {
      this.alerts.error('New passwords do not match', 6000);
      return;
    }

    if (this.formData.newPassword.length < 8) {
      this.alerts.error('New password must be at least 8 characters long', 6000);
      return;
    }

    this.changingPassword = true;

    this.httpClient.post(`${this.constants.API_URL}/password/change`, {
      current_password: this.formData.currentPassword,
      password: this.formData.newPassword,
      password_confirmation: this.formData.confirmPassword
    }).subscribe({
      next: (response: any) => {
        this.changingPassword = false;
        this.alerts.success('Password changed successfully!', 6000);
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.changingPassword = false;
        this.formData.currentPassword = '';
        this.formData.newPassword = '';
        this.formData.confirmPassword = '';
        
        let errorMessage = 'Password change failed';
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

  cancel(): void {
    this.dialogRef.close(false);
  }
}


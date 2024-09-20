import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { User } from 'src/app/api/models/doubtfire-model';
import { EditProfileFormComponent } from '../../edit-profile-form/edit-profile-form.component';

@Injectable({
  providedIn: 'root',
})
export class EditProfileDialogService {
  constructor(public dialog: MatDialog) {}

  openDialog(user: User, mode: 'edit' | 'create' | 'new'): void {
    // This will help confirm if the user object has an id when it is passed to the EditProfileFormComponent.
    console.log('User passed to dialog:', user); // <-- Log user object here
    this.dialog.open(EditProfileFormComponent, {
      width: '800px',
      data: {user, mode: mode},
    });
  }
}

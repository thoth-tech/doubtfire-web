import { Component, OnInit, Input, Inject} from '@angular/core';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'confirmation-modal',
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
})
export class ConfirmationModalComponent implements OnInit {
  @Input() title: string;
  @Input() message: string;
  action: () => void;

  constructor(
    @Inject(alertService) private alertService: any,
    public dialogRef: MatDialogRef<ConfirmationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    console.log('confirmation-model ngOnInit()');
  }

  public confirmAction() {
    console.log('confirmAction');
    /** note - page reload after closing **/
    this.dialogRef.close();
  }

  public cancelAction() {
    console.log('cancelAction');
    this.alertService.add('info', '${title} action cancelled', 3000);
    this.dialogRef.close();
  }
}

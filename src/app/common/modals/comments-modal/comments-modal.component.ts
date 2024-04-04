import { Component, OnInit, Input, Inject} from '@angular/core';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'comments-modal',
  templateUrl: './comments-modal.component.html',
  styleUrls: ['./comments-modal.component.scss'],
})
export class CommentsModalComponent implements OnInit {
  @Input() commentResourceUrl: string;
  @Input() commentType: string;

  constructor(
    @Inject(alertService) private alertService: any,
    public dialogRef: MatDialogRef<CommentsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    console.log('comments-model ngOnInit()');
  }
}
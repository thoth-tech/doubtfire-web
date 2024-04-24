import { Component, OnInit, Input, Inject} from '@angular/core';
import { alertService } from 'src/app/ajs-upgraded-providers';
import { MatDialogRef } from '@angular/material/dialog';
import { User } from 'src/app/api/models/user/user';
import { Unit } from 'src/app/api/models/unit';
import { Campus, CampusService } from 'src/app/api/models/doubtfire-model';
import { ProjectService } from 'src/app/api/services/project.service';

@Component({
  selector: 'unit-student-enrolment-modal',
  templateUrl: 'unit-student-enrolment-modal.component.html',
})
export class UnitStudentEnrolmentModalComponent {
  constructor(
    @Inject(alertService) private alertService: any,
    public dialogRef: MatDialogRef<UnitStudentEnrolmentModalComponent>,
    private campusService: CampusService,
    private newProjectService: ProjectService,
  ) {}

  @Input() unit: Unit;
  public studentId: User;
  campuses: Campus[];
  campusId: number = 1;

  ngOnInit(): void {
    console.log('unit-student-enrolment-model ngOnInit()');
  }

  public enrolStudent(studentId: any, campusId: any): void {
    console.log('enrolStudent function');
  }
}
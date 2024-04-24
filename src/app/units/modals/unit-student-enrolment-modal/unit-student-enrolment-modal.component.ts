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
    this.campusService.query().subscribe((campuses) => {
      this.campuses = campuses;
      this.campusId = campuses[0].id;
    });
  }

  public enrolStudent(studentId: any, campusId: any): void {
    if (!campusId) {
      this.alertService.add('danger', 'Campus missing. Please indicate student campus', 5000);
      return
    }

    this.newProjectService.create(
      {}, 
      { cache: this.unit.studentCache,
        body: {
          unit_id: this.unit.id,
          student_num: studentId,
          campus_id: campusId
        },
        constructorParams: this.unit
       }
    ).subscribe({
      next: (project) => {
        this.alertService.add('success', 'Student enrolled', 2000);
        this.dialogRef.close();
      },
      error: (message) => {
        this.alertService.add('danger', `Error enrolling student: ${message}`, 6000);
      },
    });
  }
}
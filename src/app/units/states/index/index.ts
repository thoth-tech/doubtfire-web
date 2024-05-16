import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UnitService } from '../../../../app/api/models/doubtfire-model';
import { ProjectService } from '../../../../app/api/models/doubtfire-model';
import { GlobalStateService } from '../../../../app/projects/states/index/global-state.service';
import { UserService } from '../../../../app/api/models/doubtfire-model';
//import { alertService } from '../../../../app/ajs-upgraded-providers';
import { AlertService } from 'src/app/common/services/alert.service';
//import { AlertService } from 'src/app/com mon/services/alert.service';



@Component({
  selector: 'index',
  templateUrl: './index.html',
  styleUrls: ['./index.scss'],
})
export class UnitsIndexComponent implements OnInit {
  unitRole: any;
  unit: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private UnitService: UnitService,
    private newProjectService: ProjectService,
    private globalStateService: GlobalStateService,
    private UserService: UserService,
    private AlertService: AlertService,
  ) {}

  ngOnInit(): void {

    const unitId = +this.route.snapshot.paramMap.get('unitId');
    if (!unitId) {
      this.router.navigate(['home']);
      return;
    }

    this.globalStateService.onLoad(() => {

      this.unitRole = this.globalStateService.loadedUnitRoles.currentValues.find((unitRole: any) => unitRole.unit.id === unitId);

      if (!this.unitRole && this.UserService.currentUser.role === 'Admin') {
        this.unitRole = this.UserService.adminRoleFor(unitId, this.UserService.currentUser);
      }

      if (!this.unitRole) {
        this.router.navigate(['home']);
        return;
      }

      this.globalStateService.setView('UNIT', this.unitRole);

      this.UnitService.get(unitId).subscribe({
        next: (unit: any) => {
          this.newProjectService.loadStudents(unit).subscribe({
            next: (students: any) => {
              this.unit = unit;
            },
            error: (err: any) => {
              this.AlertService.add('danger', 'Error loading students: ' + err, 8000);
              setTimeout(() => this.router.navigate(['home']), 5000);
            }
			});
        },
        error: (err: any) => {
          this.AlertService.add('danger', 'Error loading unit: ' + err, 8000);
          setTimeout(() => this.router.navigate(['home']), 5000);
        }
      });
    });
  }
}

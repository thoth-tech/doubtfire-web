import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';


import { UnitService } from '../../../api/services/unit.service';
import { ProjectService } from '../../../api/services/project.service';
import { GlobalStateService } from '../../../projects/states/index/global-state.service';
import { UserService } from '../../../api/services/user.service';
import { AlertService } from '../../../common/services/alert.service';


@Component({
  selector: 'app-units-index-state',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class UnitsIndexStateComponent implements OnInit, OnDestroy {
  unit: any;
  unitRole: any;
  private destroy$ = new Subject<void>();


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private UnitService: UnitService,
    private newProjectService: ProjectService,
    private globalStateService: GlobalStateService,
    private newUserService: UserService,
    private alertService: AlertService
  ) {}


  ngOnInit(): void {
    // Get unitId from route parameters
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const unitId = +params['unitId'];


      if (!unitId) {
        this.router.navigate(['/home']);
        return;
      }


      this.loadUnit(unitId);
    });
  }


  private loadUnit(unitId: number): void {
    this.globalStateService.onLoad(() => {
      // Load assessing unit role
      this.unitRole = this.globalStateService.loadedUnitRoles.currentValues.find(
        (unitRole: any) => unitRole.unit.id === unitId
      );


      // Check for Admin or Auditor roles
      if (
        !this.unitRole &&
        (this.newUserService.currentUser.role === 'Admin' ||
          this.newUserService.currentUser.role === 'Auditor')
      ) {
        this.unitRole = this.newUserService.adminOrAuditorRoleFor(
          this.newUserService.currentUser.role,
          unitId,
          this.newUserService.currentUser
        );
      }


      // Go home if no unit role was found
      if (!this.unitRole) {
        this.router.navigate(['/home']);
        return;
      }


      this.globalStateService.setView(this.unit, this.unitRole);


      // Load unit and students
      this.UnitService
        .get(unitId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (unit) => {
            this.newProjectService
              .loadStudents(unit)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.unit = unit;
                },
                error: (err) => {
                  this.alertService.error(
                    'Error loading students: ' + err,
                    8000
                  );
                  setTimeout(() => this.router.navigate(['/home']), 5000);
                },
              });
          },
          error: (err) => {
            this.alertService.error('Error loading unit: ' + err, 8000);
            setTimeout(() => this.router.navigate(['/home']), 5000);
          },
        });
    });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}






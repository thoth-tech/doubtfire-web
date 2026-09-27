import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {CreateNewUnitModal} from 'src/app/admin/modals/create-new-unit-modal/create-new-unit-modal.component';
import {Unit} from 'src/app/api/models/unit';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {LtiService} from 'src/app/api/services/lti.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-lti-unit-link',
  templateUrl: 'lti-unit-link.component.html',
  styleUrls: ['lti-unit-link.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LtiUnitLinkComponent implements OnInit {
  constructor(
    private createUnitModalService: CreateNewUnitModal,
    private unitService: UnitService,
    private authenticationService: AuthenticationService,
    private confirmationModalService: ConfirmationModalService,
    private alertsService: AlertService,
    private ltiService: LtiService,
    private userService: UserService,
    private router: Router,
  ) {}

  @Input() ltik: string;

  public selectedUnit: Unit;
  public activeUnits: Unit[] = [];

  public unitLinked: boolean = false;

  // Starts true, so the page opens on its loading state rather than a blank one.
  public loadingUnits: boolean = true;
  public loadUnitsFailed = false;

  // In ngOnInit rather than ngAfterViewInit: nothing here needs the view, and state set
  // after the view was checked threw ExpressionChangedAfterItHasBeenChecked in dev builds.
  ngOnInit(): void {
    this.ltik = this.ltik ?? this.userService.currentUser.ltik;

    // Scroll to the bottom of the page in case the header is visible
    // Ensures our action buttons are centered
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);

    this.authenticationService.afterAuthCall(() => {
      this.userService.currentUser.ltik = this.ltik;
      this.loadUnits();
    });

    // TODO: query our LTI API to see if we have already linked a unit
  }

  public submit(): void {
    this.confirmationModalService.show(
      `Are you sure you want to link ${this.selectedUnit.code} ${this.selectedUnit.name} (${this.getTeachingPeriod(this.selectedUnit)}) to this course?`,
      'Once you have linked an OnTrack unit, students who launch this app will be enrolled automatically. Unlinking a unit will not withdraw students automatically.',
      () => {
        // Trigger API call to LTI.js with our unit link request
        this.linkUnit(this.selectedUnit);
      },
    );
  }

  private formatTeachingPeriod(date): string {
    const month = date.toLocaleString('en-US', {month: 'short'});
    const year = String(date.getFullYear()).slice(-2);
    return `${month} '${year}`;
  }

  public getTeachingPeriod(unit: Unit) {
    if (unit.teachingPeriod?.name) {
      return unit.teachingPeriod.name;
    }

    return `${this.formatTeachingPeriod(unit.startDate)} - ${this.formatTeachingPeriod(unit.endDate)}`;
  }

  private async linkUnit(unit: Unit) {
    this.ltiService
      .setUnitLink({
        unitId: unit.id.toString(),
        // unitCode: unit.code,
        // unitName: unit.name,
      })
      .subscribe({
        next: () => {
          this.alertsService.success(`Successfully linked ${unit.code}`, 5000);

          this.router.navigateByUrl('/lti');
        },
        error: (error) => {
          // Errors reach here as the message itself, so error.error was always undefined.
          this.alertsService.error(`Failed to link unit: ${error?.error ?? error}`, 6000);
        },
      });
  }

  public loadUnits(): void {
    this.loadingUnits = true;
    this.loadUnitsFailed = false;
    // Load units that current user is a convenor/admin of
    this.unitService
      .fetchAll(
        {},
        {
          params: {
            include_in_active: true,
          },
        },
      )
      .subscribe({
        next: (units) => {
          // Show newer units first
          this.activeUnits = [...units].sort(
            (a, b) => b.startDate.getTime() - a.startDate.getTime(),
          );
          this.loadingUnits = false;
        },
        error: (_error) => {
          // Without this the page said "Loading..." for good after a failed request.
          this.loadingUnits = false;
          this.loadUnitsFailed = true;
        },
      });
  }
}

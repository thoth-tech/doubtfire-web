import {formatDate} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  LOCALE_ID,
  OnInit,
  inject,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Router} from '@angular/router';
import {Project, Unit, UnitRole, User, UserService} from 'src/app/api/models/doubtfire-model';
import {DateService} from 'src/app/common/services/date.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService, ViewType} from 'src/app/projects/states/index/global-state.service';

// The six unit accents from the theme tokens. Cards take them in order so that
// neighbouring cards never share a colour, the same way the student My units page does.
const UNIT_ACCENT_COUNT = 6;

export interface StaffUnitCard {
  unitRole: UnitRole;
  unitId: number;
  code: string;
  name: string;
  role: string;
  periodLabel: string;
  accent: string;
  progress: number;
  progressLabel: string;
  progressValueText: string;
}

// A unit the user studies, drawn the same way as a unit they teach.
export interface StudyUnitCard {
  projectId: number;
  code: string;
  name: string;
  target: string | null;
  periodLabel: string;
  accent: string;
  progress: number;
  progressLabel: string;
  progressValueText: string;
}

export interface StaffSummary {
  activeLabel: string;
  previousCount: number;
  unreadNotes: number;
}

@Component({
  selector: 'home',
  templateUrl: 'home.component.html',
  styleUrls: ['home.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class HomeComponent implements OnInit {
  projects: Project[] = [];
  unitRoles: UnitRole[] = [];
  staffUnits: StaffUnitCard[] = [];
  studyUnits: StudyUnitCard[] = [];

  /** True until the global state has finished loading the user's units and projects. */
  loading = true;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private constants: DoubtfireConstants,
    private globalState: GlobalStateService,
    private userService: UserService,
    @Inject(DateService) private DateService: DateService,
    private router: Router,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    // projects and units are loaded as part of global state service at login
  }

  public externalName = this.constants.ExternalName;

  ngOnInit(): void {
    this.globalState.showHeader();
    this.globalState.setView(ViewType.OTHER);

    // The unit role and project caches are behaviour subjects that start out empty, so
    // they emit before the data arrives. Waiting on the loading flag stops the page from
    // flashing "you are not enrolled" while the first request is still in flight.
    this.globalState.isLoadingSubject.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (loading) => (this.loading = loading),
    });

    this.globalState.unitRolesSubject.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (unitRoles) => this.unitRolesLoaded(unitRoles ?? []),
    });

    this.globalState.projectsSubject.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (projects) => {
        // The cache can briefly hold a project whose unit has not been mapped yet, and
        // it is cleared on sign out. The header guards the same filter the same way.
        this.projectsLoaded(
          (projects ?? []).filter((project) => project?.unit?.myRole === 'Student'),
        );
      },
    });

    if (this.currentUser.role === 'Auditor') {
      this.router.navigateByUrl('/admin/units');
    }
  }

  get currentUser(): User {
    return this.userService.currentUser;
  }

  get isStaff(): boolean {
    return this.unitRoles.length > 0;
  }

  get hasNoUnits(): boolean {
    return !this.loading && this.unitRoles.length === 0 && this.projects.length === 0;
  }

  get staffSummary(): StaffSummary {
    const active = this.staffUnits.length;
    return {
      activeLabel: `${active} active ${active === 1 ? 'unit' : 'units'}`,
      previousCount: this.unitRoles.length - active,
      unreadNotes: this.staffUnits.reduce(
        (total, card) => total + Math.max(card.unitRole.tutorNoteCount ?? 0, 0),
        0,
      ),
    };
  }

  unitRolesLoaded(unitRoles: readonly UnitRole[]): void {
    this.unitRoles = unitRoles.filter((unitRole) => unitRole?.unit);
    this.staffUnits = this.unitRoles
      .filter((unitRole) => unitRole.unit.isActive)
      .map((unitRole, index) => this.buildStaffCard(unitRole, index));
  }

  projectsLoaded(projects: Project[]): void {
    this.projects = projects;
    this.studyUnits = projects
      .filter((project) => project.unit.isActive)
      .map((project, index) => this.buildStudyCard(project, index));
  }

  get studySummary(): string {
    const active = this.studyUnits.length;
    const previous = this.projects.length - active;
    const activeLabel = `${active} active ${active === 1 ? 'unit' : 'units'}`;
    return previous > 0 ? `${activeLabel} · ${previous} previous` : activeLabel;
  }

  unreadNotesLabel(count: number): string {
    return `${count} unread moderation ${count === 1 ? 'note' : 'notes'}`;
  }

  private buildStaffCard(unitRole: UnitRole, index: number): StaffUnitCard {
    const unit = unitRole.unit;
    const progress = this.teachingProgress(unit);

    return {
      unitRole,
      unitId: unit.id,
      code: unit.code,
      name: unit.name,
      role: unitRole.role,
      periodLabel: unit.teachingPeriod?.name || this.showDate(unit.startDate),
      accent: `var(--ot-unit-${(index % UNIT_ACCENT_COUNT) + 1})`,
      progress: progress.value,
      progressLabel: progress.label,
      progressValueText: `${progress.label}, ${progress.value}% through the teaching period`,
    };
  }

  private buildStudyCard(project: Project, index: number): StudyUnitCard {
    const unit = project.unit;
    const progress = this.teachingProgress(unit);

    return {
      projectId: project.id,
      code: unit.code,
      name: unit.name,
      target: project.targetGrade != null ? project.targetGradeWord : null,
      periodLabel: unit.teachingPeriod?.name || this.showDate(unit.startDate),
      accent: `var(--ot-unit-${(index % UNIT_ACCENT_COUNT) + 1})`,
      progress: progress.value,
      progressLabel: progress.label,
      progressValueText: `${progress.label}, ${progress.value}% through the teaching period`,
    };
  }

  private teachingProgress(unit: Unit): {value: number; label: string} {
    const start = unit.startDate;
    const end = unit.endDate;
    if (!(start instanceof Date) || !(end instanceof Date)) {
      return {value: 0, label: 'No teaching dates set'};
    }

    const now = new Date();
    if (now < start) {
      return {value: 0, label: `Starts ${formatDate(start, 'd MMM', this.locale)}`};
    }
    if (now >= end) {
      return {value: 100, label: 'Teaching finished'};
    }

    const week = unit.weekNumber(now);
    return {
      value: unit.teachingPeriodProgress,
      label: week != null && week > 0 ? `Week ${week}` : 'Teaching now',
    };
  }

  showDate = this.DateService.showDate;
}

import {CdkDragDrop, DragDropModule} from '@angular/cdk/drag-drop';
import {HttpErrorResponse} from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule, NgModel} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, catchError, combineLatest, forkJoin, of, switchMap} from 'rxjs';
import {
  CourseFlowCourse,
  CourseFlowDraft,
  CourseFlowIssue,
  CourseFlowMap,
  CourseFlowPeriod,
  CourseFlowSlot,
  CourseFlowUnit,
} from 'src/app/api/models/course-flow';
import {CourseFlowService} from 'src/app/api/services/course-flow.service';
import {checkCourseFlowPlan} from './course-flow-checks';

interface DropTarget {
  kind: 'catalog' | 'slot';
  year?: number;
  trimester?: number;
  position?: number;
}

@Component({
  selector: 'f-coursemap',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './coursemap.component.html',
  styleUrls: ['./coursemap.component.scss'],
  standalone: true,
  imports: [DragDropModule, FormsModule],
})
export class CoursemapComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CourseFlowService);
  private readonly refresh = new BehaviorSubject(0);
  private savedSnapshot: string | null = null;

  courses: CourseFlowCourse[] = [];
  maps: CourseFlowMap[] = [];
  selectedCourse: CourseFlowCourse | null = null;
  currentMap: CourseFlowMap | null = null;
  name = '';
  periods: CourseFlowPeriod[] = [];
  slots: CourseFlowSlot[] = [];
  loading = true;
  saving = false;
  deleting = false;
  loadError = '';
  actionError = '';
  conflict = false;
  status = '';
  unitSelection = '';
  destinationSelection = '';
  periodYear = new Date().getFullYear();
  periodTrimester = 1;
  readonly positions = [1, 2, 3, 4];
  readonly catalogTarget: DropTarget = {kind: 'catalog'};

  slotTarget(period: CourseFlowPeriod, position: number): DropTarget {
    return {kind: 'slot', ...period, position};
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.refresh])
      .pipe(
        switchMap(([params]) => {
          this.loading = true;
          this.loadError = '';
          const routeId = params.get('courseMapId');
          if (
            routeId !== null &&
            (!/^[1-9]\d*$/.test(routeId) || !Number.isSafeInteger(Number(routeId)))
          ) {
            this.loadError =
              'Invalid course plan ID. Start a new plan or choose one of your saved plans.';
            this.loading = false;
            return of(null);
          }
          return forkJoin({
            courses: this.service.getCourses(),
            maps: this.service.getMaps(),
            map: routeId ? this.service.getMap(Number(routeId)) : of(null),
          }).pipe(
            catchError((error: HttpErrorResponse) => {
              this.loadError =
                error.status === 404
                  ? 'This course plan is unavailable or does not belong to you.'
                  : 'Course plans could not be loaded. Check your connection and try again.';
              this.loading = false;
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        if (!data) {
          return;
        }
        this.courses = data.courses;
        this.maps = data.maps;
        this.clearDraft();
        if (data.map) {
          const course = this.courses.find((item) => item.id === data.map.course_id);
          if (!course) {
            this.loadError =
              'The catalog for this saved plan is unavailable. Please contact your administrator.';
          } else {
            this.applyMap(data.map, course);
          }
        }
        this.loading = false;
      });
  }

  get busy(): boolean {
    return this.loading || this.saving || this.deleting;
  }

  get dirty(): boolean {
    return this.selectedCourse !== null && this.snapshot() !== this.savedSnapshot;
  }

  get issues(): CourseFlowIssue[] {
    return this.selectedCourse ? checkCourseFlowPlan(this.selectedCourse, this.slots) : [];
  }

  get years(): number[] {
    return [...new Set(this.periods.map((period) => period.year))].sort((a, b) => a - b);
  }

  get plannedRequired(): number {
    return (
      this.selectedCourse?.units.filter((unit) => unit.required && this.isPlanned(unit.code))
        .length ?? 0
    );
  }

  get requiredCount(): number {
    return this.selectedCourse?.units.filter((unit) => unit.required).length ?? 0;
  }

  get plannedElectives(): number {
    return (
      this.selectedCourse?.units.filter((unit) => !unit.required && this.isPlanned(unit.code))
        .length ?? 0
    );
  }

  get availableRequired(): CourseFlowUnit[] {
    return (
      this.selectedCourse?.units.filter((unit) => unit.required && !this.isPlanned(unit.code)) ?? []
    );
  }

  get availableElectives(): CourseFlowUnit[] {
    return (
      this.selectedCourse?.units.filter((unit) => !unit.required && !this.isPlanned(unit.code)) ??
      []
    );
  }

  get destinations(): {value: string; label: string}[] {
    return this.periods.flatMap((period) =>
      this.positions.map((position) => {
        const occupant = this.slotAt(period, position);
        return {
          value: `${period.year}-${period.trimester}-${position}`,
          label: `${period.year}, trimester ${period.trimester}, slot ${position}${occupant ? ` (${occupant.unit_code})` : ' (empty)'}`,
        };
      }),
    );
  }

  periodsInYear(year: number): CourseFlowPeriod[] {
    return this.periods.filter((period) => period.year === year);
  }

  isPlanned(code: string): boolean {
    return this.slots.some((slot) => slot.unit_code === code);
  }

  unitByCode(code: string): CourseFlowUnit | undefined {
    return this.selectedCourse?.units.find((unit) => unit.code === code);
  }

  slotAt(period: CourseFlowPeriod, position: number): CourseFlowSlot | undefined {
    return this.slots.find(
      (slot) =>
        slot.year === period.year &&
        slot.trimester === period.trimester &&
        slot.position === position,
    );
  }

  canLeave(): boolean {
    if (this.saving || this.deleting) {
      return false;
    }
    return !this.dirty || window.confirm('Discard unsaved changes to this course plan?');
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty || this.saving || this.deleting) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  selectCourse(id: number | null): void {
    if (this.busy || this.currentMap || this.selectedCourse?.id === id || !this.canLeave()) {
      return;
    }
    this.clearDraft();
    this.selectedCourse = this.courses.find((course) => course.id === id) ?? null;
    if (this.selectedCourse) {
      this.name = `${this.selectedCourse.code} study plan`;
      this.periods = [{year: this.periodYear, trimester: 1}];
      this.status = 'New plan. Save to keep your changes.';
    }
  }

  selectCourseFromInput(value: string, control: NgModel): void {
    this.selectCourse(value ? Number(value) : null);
    control.control.setValue(this.selectedCourse ? String(this.selectedCourse.id) : '', {
      emitEvent: false,
      emitViewToModelChange: false,
    });
  }

  startNewPlan(): void {
    if (this.busy || !this.canLeave()) {
      return;
    }
    this.clearDraft();
    if (this.route.snapshot.paramMap.has('courseMapId')) {
      void this.router.navigate(['/coursemap']);
    }
  }

  openMap(id: number): void {
    if (this.busy) {
      return;
    }
    if (this.currentMap?.id === id) {
      this.reloadSaved();
    } else {
      void this.router.navigate(['/coursemap', id]);
    }
  }

  retryLoad(): void {
    if (!this.busy && this.canLeave()) {
      this.refresh.next(this.refresh.value + 1);
    }
  }

  reloadSaved(): void {
    if (!this.busy && this.canLeave()) {
      this.refresh.next(this.refresh.value + 1);
    }
  }

  nameChanged(): void {
    this.status = 'Unsaved changes.';
    if (!this.conflict) {
      this.actionError = '';
    }
  }

  addPeriod(): void {
    if (this.busy || !this.selectedCourse) {
      return;
    }
    if (
      !Number.isInteger(this.periodYear) ||
      this.periodYear < 2000 ||
      this.periodYear > 2200 ||
      ![1, 2, 3].includes(this.periodTrimester)
    ) {
      this.actionError = 'Choose a year from 2000 to 2200 and a trimester from 1 to 3.';
      return;
    }
    if (this.periods.length >= 60) {
      this.actionError = 'A plan can contain at most 60 study periods.';
      return;
    }
    if (
      this.periods.some(
        (period) => period.year === this.periodYear && period.trimester === this.periodTrimester,
      )
    ) {
      this.actionError = 'This study period is already in the plan.';
      return;
    }
    this.periods = [...this.periods, {year: this.periodYear, trimester: this.periodTrimester}].sort(
      (a, b) => a.year - b.year || a.trimester - b.trimester,
    );
    this.edited(`Added ${this.periodYear}, trimester ${this.periodTrimester}.`);
  }

  removePeriod(period: CourseFlowPeriod): void {
    if (this.busy || this.periods.length <= 1) {
      return;
    }
    this.periods = this.periods.filter(
      (item) => item.year !== period.year || item.trimester !== period.trimester,
    );
    this.slots = this.slots.filter(
      (slot) => slot.year !== period.year || slot.trimester !== period.trimester,
    );
    this.destinationSelection = '';
    this.edited(
      `Removed ${period.year}, trimester ${period.trimester}. Its units are available in the catalog again.`,
    );
  }

  placeSelectedUnit(): void {
    const [year, trimester, position] = this.destinationSelection.split('-').map(Number);
    this.placeUnit(this.unitSelection, {year, trimester}, position);
  }

  placeUnit(code: string, period: CourseFlowPeriod, position: number): void {
    if (this.busy || !this.unitByCode(code)) {
      return;
    }
    if (
      !this.positions.includes(position) ||
      !this.periods.some((item) => item.year === period.year && item.trimester === period.trimester)
    ) {
      this.actionError = 'Choose a unit and a valid destination slot.';
      return;
    }
    const source = this.slots.find((slot) => slot.unit_code === code);
    const target = this.slotAt(period, position);
    if (target?.unit_code === code) {
      return;
    }
    if (target && !source) {
      this.actionError =
        'Choose an empty slot for an unplanned unit. Two planned units can swap slots.';
      return;
    }
    this.slots = this.slots.filter((slot) => slot !== source && slot !== target);
    this.slots.push({unit_code: code, year: period.year, trimester: period.trimester, position});
    if (source && target) {
      this.slots.push({...source, unit_code: target.unit_code});
    }
    this.edited(
      target
        ? `Swapped ${code} and ${target.unit_code}.`
        : `Placed ${code} in ${period.year}, trimester ${period.trimester}, slot ${position}.`,
    );
  }

  removeUnit(code: string): void {
    if (this.busy || !this.isPlanned(code)) {
      return;
    }
    this.slots = this.slots.filter((slot) => slot.unit_code !== code);
    this.edited(`${code} returned to the catalog.`);
  }

  drop(event: CdkDragDrop<DropTarget, DropTarget, string>): void {
    const target = event.container.data;
    if (target.kind === 'catalog') {
      this.removeUnit(event.item.data);
    } else {
      this.placeUnit(
        event.item.data,
        {year: target.year, trimester: target.trimester},
        target.position,
      );
    }
  }

  save(asCopy = false): void {
    if (this.busy || !this.selectedCourse) {
      return;
    }
    if (!this.name.trim() || this.name.trim().length > 200) {
      this.actionError = 'Enter a plan name from 1 to 200 characters.';
      return;
    }
    const draft = this.draft();
    if (asCopy) {
      draft.name = `${draft.name.slice(0, 193)} (copy)`;
    }
    this.saving = true;
    this.actionError = '';
    this.status = 'Saving course plan…';
    const request =
      this.currentMap && !asCopy
        ? this.service.updateMap(this.currentMap.id, draft, this.currentMap.lock_version)
        : this.service.createMap(draft);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (map) => {
        this.saving = false;
        this.applyMap(map, this.selectedCourse);
        this.maps = [map, ...this.maps.filter((item) => item.id !== map.id)];
        if (this.route.snapshot.paramMap.get('courseMapId') !== String(map.id)) {
          void this.router.navigate(['/coursemap', map.id], {replaceUrl: true});
        }
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.status = '';
        this.writeFailed(error, 'save');
      },
    });
  }

  deletePlan(): void {
    if (
      this.busy ||
      !this.currentMap ||
      !window.confirm(
        `Delete saved plan “${this.currentMap.name}”? This also discards any unsaved changes and cannot be undone.`,
      )
    ) {
      return;
    }
    const map = this.currentMap;
    this.deleting = true;
    this.actionError = '';
    this.status = 'Deleting course plan…';
    this.service
      .deleteMap(map.id, map.lock_version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting = false;
          this.maps = this.maps.filter((item) => item.id !== map.id);
          this.clearDraft();
          this.status = 'Course plan deleted.';
          void this.router.navigate(['/coursemap']);
        },
        error: (error: HttpErrorResponse) => {
          this.deleting = false;
          this.status = '';
          this.writeFailed(error, 'delete');
        },
      });
  }

  private writeFailed(error: HttpErrorResponse, action: 'save' | 'delete'): void {
    this.conflict = error.status === 409;
    if (this.conflict) {
      this.actionError =
        'This plan changed in another session. Your edits are still here. Reload the saved plan to discard these edits, or save a copy to keep them.';
    } else if (error.status === 404) {
      this.actionError =
        'The saved plan is no longer available. Your edits are still here; save a copy to keep them.';
      this.conflict = true;
    } else if (error.status === 422) {
      this.actionError =
        'The server could not accept this plan. Check the name, course and study periods, then try saving again. Your edits are still here.';
    } else {
      this.actionError = `Could not ${action} the course plan. Your edits are still here. Check your connection and try again.`;
    }
  }

  private applyMap(map: CourseFlowMap, course: CourseFlowCourse): void {
    this.currentMap = map;
    this.selectedCourse = course;
    this.name = map.name;
    this.periods = map.periods
      .map((period) => ({...period}))
      .sort((a, b) => a.year - b.year || a.trimester - b.trimester);
    this.slots = map.slots.map((slot) => ({...slot}));
    this.savedSnapshot = this.snapshot();
    this.actionError = '';
    this.conflict = false;
    this.status = 'Course plan saved. Changes are stored in your account.';
  }

  private clearDraft(): void {
    this.selectedCourse = null;
    this.currentMap = null;
    this.name = '';
    this.periods = [];
    this.slots = [];
    this.savedSnapshot = null;
    this.actionError = '';
    this.conflict = false;
    this.status = '';
    this.unitSelection = '';
    this.destinationSelection = '';
    this.periodYear = new Date().getFullYear();
    this.periodTrimester = 1;
  }

  private edited(message: string): void {
    if (!this.conflict) {
      this.actionError = '';
    }
    this.status = `${message} Save to keep your changes.`;
  }

  private draft(): CourseFlowDraft {
    return {
      course_id: this.selectedCourse.id,
      name: this.name.trim(),
      periods: this.periods.map((period) => ({...period})),
      slots: this.slots.map((slot) => ({...slot})),
    };
  }

  private snapshot(): string {
    return JSON.stringify({
      ...this.draft(),
      name: this.name,
      slots: [...this.slots].sort((a, b) => a.unit_code.localeCompare(b.unit_code)),
    });
  }
}

import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
import {Subscription} from 'rxjs';
import {OverseerImage, UnitService} from 'src/app/api/models/doubtfire-model';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TeachingPeriod} from 'src/app/api/models/teaching-period';
import {GradeDefinition, Unit} from 'src/app/api/models/unit';
import {TeachingPeriodService} from 'src/app/api/services/teaching-period.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {TaskSubmissionService} from 'src/app/common/services/task-submission.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {D2lUnitDetailsModal} from './d2l-details-form/d2l-unit-details-form.component';

export type UnitSettingsSection =
  | 'about'
  | 'dates'
  | 'extensions'
  | 'feedback'
  | 'portfolio'
  | 'students'
  | 'overseer';

interface SettingField {
  /** The property on the unit, which is also the form control name. */
  key: string;
  /** The key the api expects in the update body. */
  json: string;
  /** Turns the form value into what the api expects. The value itself by default. */
  toJson?: (value: unknown) => unknown;
  /** Reads the starting value off the unit. The unit's property by default. */
  read?: (unit: Unit) => unknown;
  validators?: ValidatorFn[];
}

const wholeNumber: ValidatorFn[] = [
  Validators.required,
  Validators.min(0),
  Validators.pattern(/^\d+$/),
];

const idOrNull = (value: unknown) => (value as {id?: number} | null)?.id ?? null;

// The dates section is saved by hand, because the api refuses a teaching period and a
// start date in the same request. Every other section is a list of fields.
const SECTION_FIELDS: Record<Exclude<UnitSettingsSection, 'dates'>, SettingField[]> = {
  about: [
    {key: 'code', json: 'code', validators: [Validators.required, Validators.pattern(/\S/)]},
    {key: 'name', json: 'name', validators: [Validators.required, Validators.pattern(/\S/)]},
    {key: 'description', json: 'description'},
    {key: 'active', json: 'active'},
  ],
  extensions: [
    {key: 'allowFlexibleDates', json: 'allow_flexible_dates'},
    {key: 'allowStudentExtensionRequests', json: 'allow_student_extension_requests'},
    {key: 'autoApplyExtensionBeforeDeadline', json: 'auto_apply_extension_before_deadline'},
    {
      key: 'extensionWeeksOnResubmitRequest',
      json: 'extension_weeks_on_resubmit_request',
      validators: wholeNumber,
    },
  ],
  feedback: [
    {
      key: 'feedbackWarningThresholdDays',
      json: 'feedback_warning_threshold_days',
      validators: wholeNumber,
    },
    {
      key: 'feedbackOverflowThresholdDays',
      json: 'feedback_overflow_threshold_days',
      validators: wholeNumber,
    },
    {
      key: 'enforceFeedbackBeforeDiscussedInClass',
      json: 'enforce_feedback_before_discussed_in_class',
    },
  ],
  portfolio: [
    // Choosing "None" has to reach the api as null. An undefined value is dropped
    // from the request body, which is why clearing the draft task never used to stick.
    {key: 'draftTaskDefinition', json: 'draft_task_definition_id', toJson: idOrNull},
    {
      key: 'portfolioAutoGenerationDate',
      json: 'portfolio_auto_generation_date',
      toJson: (value) => formatDay(value as Date | null),
    },
    {
      key: 'markLateSubmissionsAsAssessInPortfolio',
      json: 'mark_late_submissions_as_assess_in_portfolio',
    },
  ],
  students: [
    {key: 'allowStudentChangeTutorial', json: 'allow_student_change_tutorial'},
    {key: 'sendNotifications', json: 'send_notifications'},
    {key: 'enableSyncEnrolments', json: 'enable_sync_enrolments'},
    {key: 'enableSyncTimetable', json: 'enable_sync_timetable'},
  ],
  overseer: [
    {key: 'assessmentEnabled', json: 'assessment_enabled'},
    {
      key: 'overseerImage',
      json: 'overseer_image_id',
      toJson: idOrNull,
      // The unit loads its image on its own, often after this page opens. Starting from
      // the id lets the select show the image as soon as the list of images arrives.
      read: (unit) =>
        unit.overseerImage ?? (unit.overseerImageId ? {id: unit.overseerImageId} : null),
    },
  ],
};

export interface SettingToggle {
  key: string;
  label: string;
  hint: string;
}

// The on and off settings, in the order they appear in each section.
const SECTION_TOGGLES: Partial<Record<UnitSettingsSection, SettingToggle[]>> = {
  about: [
    {
      key: 'active',
      label: 'Unit is active',
      hint: 'Students and tutors can see this unit. Turn it off to hide the unit from them.',
    },
  ],
  extensions: [
    {
      key: 'allowFlexibleDates',
      label: 'Flexible due dates',
      hint: 'Students can plan their own due dates without asking for an extension.',
    },
    {
      key: 'allowStudentExtensionRequests',
      label: 'Students can ask for extensions',
      hint: 'When this is off, only staff can ask for an extension for a student.',
    },
    {
      key: 'autoApplyExtensionBeforeDeadline',
      label: 'Grant extensions automatically',
      hint: "An extension is granted straight away when the new date is still on or before the task's deadline.",
    },
  ],
  feedback: [
    {
      key: 'enforceFeedbackBeforeDiscussedInClass',
      label: 'Feedback before discussion',
      hint: 'Tutors must give feedback before they can mark a task as discussed in class.',
    },
  ],
  portfolio: [
    {
      key: 'markLateSubmissionsAsAssessInPortfolio',
      label: 'Assess late work in the portfolio',
      hint: 'Late submissions show as Assess in Portfolio instead of Time Exceeded. Tutors can still sign them off, unless a task is set to be assessed in the portfolio only.',
    },
  ],
  students: [
    {
      key: 'allowStudentChangeTutorial',
      label: 'Students can change tutorial',
      hint: 'When this is off, only staff can move a student to another tutorial.',
    },
    {
      key: 'sendNotifications',
      label: 'Weekly progress emails',
      hint: 'Students get an email each week with their progress and the tasks to work on next.',
    },
    {
      key: 'enableSyncEnrolments',
      label: 'Sync enrolments',
      hint: "Keep enrolments in step with your institution's student system, where that is set up.",
    },
    {
      key: 'enableSyncTimetable',
      label: 'Sync timetable',
      hint: "Keep tutorials in step with your institution's timetable, where that is set up.",
    },
  ],
  overseer: [
    {
      key: 'assessmentEnabled',
      label: 'Automated checking',
      hint: 'Tasks in this unit can use Overseer to check submissions automatically.',
    },
  ],
};

const SECTION_NAMES: Record<UnitSettingsSection, string> = {
  about: 'Unit details',
  dates: 'Teaching dates',
  extensions: 'Extension settings',
  feedback: 'Feedback settings',
  portfolio: 'Portfolio settings',
  students: 'Student and tutorial settings',
  overseer: 'Automated checking settings',
};

/**
 * A day as the api stores it, in the browser's own calendar. Null for no date.
 */
export function formatDay(value: Date | null | undefined): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    return null;
  }
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/**
 * Whether a form value still matches what was last saved. Dates compare by day and
 * entities by id, and an empty value matches null or undefined.
 */
export function sameSetting(left: unknown, right: unknown): boolean {
  const isEmpty = (value: unknown) => value === null || value === undefined || value === '';
  if (isEmpty(left) || isEmpty(right)) {
    return isEmpty(left) && isEmpty(right);
  }
  if (left instanceof Date || right instanceof Date) {
    return formatDay(left as Date) === formatDay(right as Date);
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const leftId = (left as {id?: unknown}).id;
    const rightId = (right as {id?: unknown}).id;
    if (leftId !== undefined || rightId !== undefined) {
      return leftId === rightId;
    }
  }
  // Number inputs hand back numbers, but a value typed into an older field may be a string.
  return String(left) === String(right);
}

// The end date must fall on or after the start date. Only checked when both are set, and
// not at all once a teaching period is chosen, as its dates replace them.
const datesInOrder: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  if (group.get('teachingPeriod')?.value) {
    return null;
  }
  const start = group.get('startDate')?.value as Date | null;
  const end = group.get('endDate')?.value as Date | null;
  if (start instanceof Date && end instanceof Date && formatDay(end) < formatDay(start)) {
    return {datesOutOfOrder: true};
  }
  return null;
};

@Component({
  selector: 'f-unit-details-editor',
  templateUrl: 'unit-details-editor.component.html',
  styleUrls: ['unit-details-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class UnitDetailsEditorComponent implements OnInit, OnDestroy {
  @Input() unit: Unit;

  constructor(
    private teachingPeriodService: TeachingPeriodService,
    private doubtfireConstants: DoubtfireConstants,
    private taskSubmissionService: TaskSubmissionService,
    private d2lUnitDetailsModal: D2lUnitDetailsModal,
    private unitService: UnitService,
    private alertsService: AlertService,
    private confirmationModal: ConfirmationModalService,
  ) {}

  public teachingPeriods: TeachingPeriod[] = [];
  public taskDefinitions: TaskDefinition[] = [];
  public dockerImages: OverseerImage[] = [];
  public readonly toggles = SECTION_TOGGLES;

  /**
   * One form per section, each saved on its own. The unit only takes the new values
   * once the api accepts them, so an edit left unsaved never leaks into the rest of
   * the app, or into the next section that is saved.
   */
  public forms: Record<UnitSettingsSection, FormGroup>;
  public saving: Partial<Record<UnitSettingsSection, boolean>> = {};
  public saveErrors: Partial<Record<UnitSettingsSection, string>> = {};
  private savedValues: Partial<Record<UnitSettingsSection, Record<string, unknown>>> = {};

  public editingGradeId: string | null = null;
  public readonly gradeDefinitionColumns = ['index', 'label', 'abbreviation', 'order', 'actions'];
  private editingGradeDefinitions: GradeDefinition[] | null = null;
  private newGradeId: string | null = null;

  private subscriptions: Subscription[] = [];

  public get overseerEnabled() {
    return this.doubtfireConstants.IsOverseerEnabled;
  }

  public get d2lEnabled() {
    return this.doubtfireConstants.IsD2LEnabled;
  }

  ngOnInit(): void {
    this.buildForms();

    this.subscriptions.push(
      this.teachingPeriodService.query().subscribe((periods) => {
        this.teachingPeriods = periods;
      }),
    );

    this.subscriptions.push(
      this.unit.taskDefinitionCache.values.subscribe((taskDefs) => {
        this.taskDefinitions = taskDefs;
      }),
    );

    // The image list is only used when automated checking is on, and staff who cannot
    // use it get a 403 that used to surface as an uncaught promise in the console.
    if (this.overseerEnabled.value) {
      this.taskSubmissionService
        .getDockerImagesAsPromise()
        .then((images) => {
          this.dockerImages = images ?? [];
        })
        .catch(() => {
          this.dockerImages = [];
        });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  /**
   * The tasks that can be a draft learning summary: the api only accepts a task with
   * exactly one upload, and that upload a document. The current choice always stays
   * in the list so the field never shows blank.
   */
  public get draftTaskOptions(): TaskDefinition[] {
    const current = this.forms?.portfolio.controls.draftTaskDefinition.value as TaskDefinition;
    return this.taskDefinitions.filter((taskDefinition) => {
      const uploads = taskDefinition.uploadRequirements ?? [];
      const eligible = uploads.length === 1 && uploads[0]?.type === 'document';
      return eligible || taskDefinition.id === current?.id;
    });
  }

  public compareById(left: {id?: number} | null, right: {id?: number} | null): boolean {
    if (!left || !right) {
      return left === right;
    }
    return left.id === right.id;
  }

  public hasChanges(section: UnitSettingsSection): boolean {
    return this.changedKeys(section, this.forms[section].getRawValue()).length > 0;
  }

  private changedKeys(section: UnitSettingsSection, values: Record<string, unknown>): string[] {
    const saved = this.savedValues[section] ?? {};
    return Object.keys(values).filter((key) => !sameSetting(values[key], saved[key]));
  }

  // Save stays available while a field is wrong, so pressing it can point at the problem.
  public canSave(section: UnitSettingsSection): boolean {
    return this.hasChanges(section) && !this.saving[section];
  }

  public discardChanges(section: UnitSettingsSection): void {
    this.forms[section].reset(this.savedValues[section]);
    delete this.saveErrors[section];
  }

  public saveSection(section: UnitSettingsSection): void {
    const form = this.forms[section];
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    if (!this.hasChanges(section) || this.saving[section]) {
      return;
    }

    const values = form.getRawValue();
    const changed = this.changedKeys(section, values);
    const body =
      section === 'dates' ? this.datesBody(values) : this.fieldsBody(section, changed, values);

    this.saving[section] = true;
    delete this.saveErrors[section];

    this.unitService.update(this.unit, {body: {unit: body}}).subscribe({
      next: () => {
        this.applyToUnit(section, changed, values);
        // The form is left as it is rather than reset, so anything typed while the save
        // was on its way is kept, and shows as a change still to save.
        this.savedValues[section] = values;
        form.markAsPristine();
        form.markAsUntouched();
        this.saving[section] = false;
        this.alertsService.success(`${SECTION_NAMES[section]} saved.`, 2000);
      },
      error: (response) => {
        this.saving[section] = false;
        this.saveErrors[section] = `${response}`;
        this.alertsService.error(`Could not save. ${response}`, 6000);
      },
    });
  }

  public toggleControl(section: UnitSettingsSection, key: string): FormControl {
    return this.forms[section].get(key) as FormControl;
  }

  public onToggleChange(key: string, event: MatSlideToggleChange): void {
    if (key === 'markLateSubmissionsAsAssessInPortfolio') {
      this.onToggleAssessInPortfolio(event);
    }
  }

  /**
   * Turning on "Assess in portfolio" moves every Time Exceeded task, and it cannot be
   * turned off while any task is still in that state, so the switch asks first. The
   * change is still only kept once the section is saved.
   */
  public onToggleAssessInPortfolio(event: MatSlideToggleChange): void {
    const control = this.forms.portfolio.controls.markLateSubmissionsAsAssessInPortfolio;
    const savedValue = this.savedValues.portfolio?.markLateSubmissionsAsAssessInPortfolio;
    if (!event.checked || savedValue) {
      return;
    }

    control.setValue(false);
    this.confirmationModal.show(
      'Assess late work in the portfolio?',
      'Late submissions will show as "Assess in Portfolio" instead of "Time Exceeded", and every ' +
        'task that is Time Exceeded now will change to "Assess in Portfolio". You cannot turn ' +
        'this off again while any task is in that state.',
      () => {
        control.setValue(true);
        control.markAsDirty();
      },
      undefined,
      'Turn on',
    );
  }

  addD2lData() {
    this.d2lUnitDetailsModal.open(this.unit);
  }

  private buildForms(): void {
    const unit = this.unit;
    const group = (fields: SettingField[]) =>
      new FormGroup(
        Object.fromEntries(
          fields.map((field) => [
            field.key,
            new FormControl(
              (field.read ? field.read(unit) : unit[field.key]) ?? null,
              field.validators ?? [],
            ),
          ]),
        ),
      );

    this.forms = {
      about: group(SECTION_FIELDS.about),
      dates: new FormGroup(
        {
          teachingPeriod: new FormControl<TeachingPeriod | null>(unit.teachingPeriod ?? null),
          startDate: new FormControl<Date | null>(unit.startDate ?? null),
          endDate: new FormControl<Date | null>(unit.endDate ?? null),
        },
        {validators: datesInOrder},
      ),
      extensions: group(SECTION_FIELDS.extensions),
      feedback: group(SECTION_FIELDS.feedback),
      portfolio: group(SECTION_FIELDS.portfolio),
      students: group(SECTION_FIELDS.students),
      overseer: group(SECTION_FIELDS.overseer),
    };

    // Custom dates are only needed when the unit is not in a teaching period.
    const dates = this.forms.dates;
    const syncDateRules = (period: TeachingPeriod | null) => {
      for (const name of ['startDate', 'endDate']) {
        const control = dates.get(name);
        control.setValidators(period ? [] : [Validators.required]);
        control.updateValueAndValidity({emitEvent: false});
      }
    };
    syncDateRules(dates.controls.teachingPeriod.value);
    this.subscriptions.push(dates.controls.teachingPeriod.valueChanges.subscribe(syncDateRules));

    for (const section of Object.keys(this.forms) as UnitSettingsSection[]) {
      this.savedValues[section] = this.forms[section].getRawValue();
    }
  }

  private fieldsBody(
    section: Exclude<UnitSettingsSection, 'dates'>,
    changed: string[],
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    // Only what changed is sent, so saving one setting cannot trip the api's checks on
    // another that was left alone.
    for (const field of SECTION_FIELDS[section]) {
      if (changed.includes(field.key)) {
        const value = values[field.key];
        body[field.json] = field.toJson ? field.toJson(value) : (value ?? null);
      }
    }
    return body;
  }

  // The api treats a teaching period and custom dates as either or: sending a start
  // date takes the unit out of its teaching period, and sending both is refused.
  private datesBody(values: Record<string, unknown>): Record<string, unknown> {
    const period = values.teachingPeriod as TeachingPeriod | null;
    if (period) {
      return {teaching_period_id: period.id};
    }
    return {
      start_date: formatDay(values.startDate as Date),
      end_date: formatDay(values.endDate as Date),
    };
  }

  private applyToUnit(
    section: UnitSettingsSection,
    changed: string[],
    values: Record<string, unknown>,
  ): void {
    if (section === 'dates') {
      const period = values.teachingPeriod as TeachingPeriod | null;
      this.unit.teachingPeriod = period ?? undefined;
      this.unit.startDate = period ? period.startDate : (values.startDate as Date);
      this.unit.endDate = period ? period.endDate : (values.endDate as Date);
      return;
    }

    for (const field of SECTION_FIELDS[section].filter((each) => changed.includes(each.key))) {
      const value = values[field.key];
      if (field.key === 'overseerImage') {
        // The unit's setter reads the image's id, so it cannot take null.
        if (value) {
          this.unit.overseerImage = value as OverseerImage;
        }
        continue;
      }
      this.unit[field.key] = value ?? undefined;
    }
  }

  //
  // Grades. These save as soon as each change is made, as they always have.
  //

  public get gradeDefinitions(): GradeDefinition[] {
    return this.unit.gradeDefinitions;
  }

  public addGrade(): void {
    if (this.newGradeId) {
      return;
    }

    const previousDefinitions = this.cloneGradeDefinitions();
    const newGradeId = `grade-${Date.now()}`;
    this.unit.gradeDefinitions = [
      ...this.unit.gradeDefinitions,
      {
        id: newGradeId,
        value: this.unit.gradeDefinitions.length - 1,
        label: 'New grade',
        abbreviation: 'NEW',
      },
    ];
    this.reindexGrades();
    this.editingGradeDefinitions = previousDefinitions;
    this.editingGradeId = newGradeId;
    this.newGradeId = newGradeId;
  }

  public removeGrade(index: number): void {
    const grade = this.unit.gradeDefinitions[index];
    if (!grade) {
      return;
    }

    this.confirmationModal.show(
      `Delete the ${grade.label} grade?`,
      'Students and tasks will no longer be able to use this grade.',
      () => {
        if (grade.id === this.newGradeId) {
          this.cancelGradeEdit();
          return;
        }
        if (this.newGradeId) {
          return;
        }

        const previousDefinitions = this.cloneGradeDefinitions();
        this.unit.gradeDefinitions = this.unit.gradeDefinitions.filter(
          (_definition, definitionIndex) => definitionIndex !== index,
        );
        this.reindexGrades();
        if (this.editingGradeId === grade.id) {
          this.editingGradeId = null;
        }
        this.saveGradeDefinitions(previousDefinitions, 'Grade deleted.');
      },
      undefined,
      'Delete',
    );
  }

  public moveGrade(index: number, offset: -1 | 1): void {
    const targetIndex = index + offset;
    // Moving saves the whole list, so it waits until a rename is saved or cancelled.
    // Otherwise the half typed name was saved too, and cancelling then put back a list
    // the api no longer had.
    if (
      this.newGradeId ||
      this.editingGradeId ||
      index <= 0 ||
      targetIndex <= 0 ||
      targetIndex >= this.unit.gradeDefinitions.length
    ) {
      return;
    }

    const previousDefinitions = this.cloneGradeDefinitions();
    const definitions = [...this.unit.gradeDefinitions];
    const [definition] = definitions.splice(index, 1);
    definitions.splice(targetIndex, 0, definition);
    this.unit.gradeDefinitions = definitions;
    this.reindexGrades();
    this.saveGradeDefinitions(previousDefinitions, 'Grade order updated.');
  }

  public editGrade(grade: GradeDefinition): void {
    if (this.newGradeId) {
      return;
    }

    this.editingGradeDefinitions = this.cloneGradeDefinitions();
    this.editingGradeId = grade.id;
  }

  /**
   * Put the grades back as they were before the edit began. For a grade that was just
   * added, this removes it again.
   */
  public cancelGradeEdit(): void {
    if (this.editingGradeDefinitions) {
      this.unit.gradeDefinitions = this.editingGradeDefinitions;
    }
    this.editingGradeDefinitions = null;
    this.editingGradeId = null;
    this.newGradeId = null;
  }

  public saveGrade(): void {
    const previousDefinitions = this.editingGradeDefinitions ?? this.cloneGradeDefinitions();
    this.unit.gradeDefinitions = [...this.unit.gradeDefinitions];
    const successMessage =
      this.editingGradeId === this.newGradeId ? 'Grade added.' : 'Grade updated.';
    this.saveGradeDefinitions(previousDefinitions, successMessage, () => {
      this.editingGradeDefinitions = null;
      this.editingGradeId = null;
      this.newGradeId = null;
    });
  }

  public isAddingGrade(): boolean {
    return this.newGradeId !== null;
  }

  public updateGrade(index: number, key: 'label' | 'abbreviation', value: string): void {
    const normalizedValue = key === 'abbreviation' ? value.toUpperCase() : value;
    const definition = this.unit.gradeDefinitions[index];
    if (definition) {
      definition[key] = normalizedValue;
    }
  }

  private reindexGrades(): void {
    this.unit.gradeDefinitions = this.unit.gradeDefinitions.map((definition, index) => ({
      ...definition,
      value: index - 1,
    }));
  }

  private cloneGradeDefinitions(): GradeDefinition[] {
    return this.unit.gradeDefinitions.map((definition) => ({...definition}));
  }

  private saveGradeDefinitions(
    previousDefinitions: GradeDefinition[],
    successMessage: string,
    successAction?: () => void,
  ): void {
    const gradeDefinitions = this.cloneGradeDefinitions();
    this.unitService
      .update(this.unit, {body: {unit: {grade_definitions: gradeDefinitions}}})
      .subscribe({
        next: () => {
          successAction?.();
          this.alertsService.success(successMessage, 2000);
        },
        error: (response) => {
          this.unit.gradeDefinitions = previousDefinitions;
          if (
            !this.unit.gradeDefinitions.some((definition) => definition.id === this.editingGradeId)
          ) {
            this.editingGradeId = null;
            this.editingGradeDefinitions = null;
          }
          this.alertsService.error(`Could not update the grades. ${response}`, 6000);
        },
      });
  }
}

import {describe, expect, it, vi} from 'vitest';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {Unit} from 'src/app/api/models/unit';
import {UnitDetailsEditorComponent, formatDay, sameSetting} from './unit-details-editor.component';

interface EditorOptions {
  unit?: Partial<Unit>;
  overseer?: boolean;
  images?: Promise<unknown>;
  update?: () => unknown;
}

// Built directly rather than through TestBed: what is under test is which values reach
// the api and when the unit takes them, and none of that needs a rendered page.
function editorFor(options: EditorOptions = {}) {
  const unit = Object.assign(new Unit(), {
    id: 3,
    code: 'SIT101',
    name: 'Intro to Things',
    description: 'All about things',
    active: true,
    startDate: new Date(2026, 6, 13),
    endDate: new Date(2026, 9, 30),
    teachingPeriod: undefined,
    allowFlexibleDates: false,
    allowStudentExtensionRequests: true,
    autoApplyExtensionBeforeDeadline: true,
    extensionWeeksOnResubmitRequest: 1,
    feedbackWarningThresholdDays: 5,
    feedbackOverflowThresholdDays: 10,
    enforceFeedbackBeforeDiscussedInClass: false,
    markLateSubmissionsAsAssessInPortfolio: false,
    allowStudentChangeTutorial: true,
    sendNotifications: true,
    enableSyncEnrolments: false,
    enableSyncTimetable: false,
    ...options.unit,
  });

  const unitService = {update: vi.fn(options.update ?? (() => of(unit)))};
  const alerts = {success: vi.fn(), error: vi.fn()};
  const confirmationModal = {show: vi.fn()};
  const getDockerImagesAsPromise = vi.fn(() => options.images ?? Promise.resolve([]));

  const component = new UnitDetailsEditorComponent(
    {query: () => of([])} as never, // teachingPeriodService
    {
      IsOverseerEnabled: new BehaviorSubject(options.overseer ?? false),
      IsD2LEnabled: new BehaviorSubject(false),
    } as never,
    {getDockerImagesAsPromise} as never,
    {} as never, // d2lUnitDetailsModal
    unitService as never,
    alerts as never,
    confirmationModal as never,
  );
  component.unit = unit;
  component.ngOnInit();

  return {component, unit, unitService, alerts, confirmationModal, getDockerImagesAsPromise};
}

function sentBody(unitService: {update: ReturnType<typeof vi.fn>}) {
  return (unitService.update.mock.calls[0][1] as {body: {unit: object}}).body.unit;
}

describe('UnitDetailsEditorComponent sections', () => {
  it('sends only the fields of the section being saved', () => {
    const {component, unit, unitService} = editorFor();

    component.forms.about.controls.name.setValue('Things, in depth');
    component.forms.feedback.controls.feedbackWarningThresholdDays.setValue(7);
    component.saveSection('feedback');

    expect(sentBody(unitService)).toEqual({feedback_warning_threshold_days: 7});
    expect(unit.feedbackWarningThresholdDays).toBe(7);
    // The unsaved name stays in its own section until that section is saved.
    expect(unit.name).toBe('Intro to Things');
    expect(component.hasChanges('about')).toBe(true);
    expect(component.hasChanges('feedback')).toBe(false);
  });

  it('keeps the unit as it was when the api refuses the change', () => {
    const {component, unit, alerts} = editorFor({
      update: () => throwError(() => 'Code already exists in this teaching period'),
    });

    component.forms.about.controls.code.setValue('SIT102');
    component.saveSection('about');

    expect(unit.code).toBe('SIT101');
    expect(component.hasChanges('about')).toBe(true);
    expect(component.saveErrors.about).toBe('Code already exists in this teaching period');
    expect(alerts.error).toHaveBeenCalled();
  });

  // The whole form used to be reset to what was sent once the save came back, which
  // threw away anything typed in the meantime.
  it('keeps what was typed while a save was on its way', () => {
    const response: Subject<Unit> = new Subject();
    const {component, unit} = editorFor({update: () => response});

    component.forms.about.controls.name.setValue('Things, in depth');
    component.saveSection('about');
    component.forms.about.controls.description.setValue('Now with more things');
    response.next(unit);
    response.complete();

    expect(unit.name).toBe('Things, in depth');
    expect(unit.description).toBe('All about things');
    expect(component.forms.about.controls.description.value).toBe('Now with more things');
    expect(component.hasChanges('about')).toBe(true);
  });

  it('does not send a section with a field left empty', () => {
    const {component, unitService} = editorFor();

    component.forms.about.controls.code.setValue('   ');
    component.saveSection('about');

    expect(unitService.update).not.toHaveBeenCalled();
    expect(component.forms.about.controls.code.touched).toBe(true);
  });

  it('puts a section back to its saved values on undo', () => {
    const {component} = editorFor();

    component.forms.extensions.controls.allowFlexibleDates.setValue(true);
    component.discardChanges('extensions');

    expect(component.forms.extensions.controls.allowFlexibleDates.value).toBe(false);
    expect(component.hasChanges('extensions')).toBe(false);
  });

  // "None" used to reach the api as undefined, which drops out of the request body, so
  // the old draft task came back on the next load.
  it('clears the draft learning summary task with null', () => {
    const draft = {id: 42, uploadRequirements: [{type: 'document'}]};
    const {component, unit, unitService} = editorFor({unit: {draftTaskDefinition: draft as never}});

    component.forms.portfolio.controls.draftTaskDefinition.setValue(null);
    component.saveSection('portfolio');

    expect(sentBody(unitService)).toEqual({draft_task_definition_id: null});
    expect(unit.draftTaskDefinition).toBeUndefined();
  });

  it('lists only tasks the api accepts as a draft, plus the current choice', () => {
    const current = {id: 1, uploadRequirements: [{type: 'code'}]};
    const {component} = editorFor({unit: {draftTaskDefinition: current as never}});
    const oneDocument = {id: 2, uploadRequirements: [{type: 'document'}]};
    const twoFiles = {id: 3, uploadRequirements: [{type: 'document'}, {type: 'code'}]};
    component.taskDefinitions = [current, oneDocument, twoFiles] as never;

    expect(component.draftTaskOptions.map((task) => task.id)).toEqual([1, 2]);
  });
});

describe('UnitDetailsEditorComponent teaching dates', () => {
  it('sends only the teaching period when one is chosen', () => {
    const period = {id: 9, startDate: new Date(2026, 2, 2), endDate: new Date(2026, 5, 5)};
    const {component, unit, unitService} = editorFor();

    component.forms.dates.controls.startDate.setValue(new Date(2026, 6, 20));
    component.forms.dates.controls.teachingPeriod.setValue(period);
    component.saveSection('dates');

    // The api refuses a teaching period and a start date in the same request.
    expect(sentBody(unitService)).toEqual({teaching_period_id: 9});
    expect(unit.teachingPeriod).toBe(period);
    expect(unit.startDate).toBe(period.startDate);
  });

  // Choosing None used to send nothing at all unless a date had also been changed.
  it('takes the unit out of its teaching period by sending its dates', () => {
    const period = {id: 9, startDate: new Date(2026, 6, 13), endDate: new Date(2026, 9, 30)};
    const {component, unit, unitService} = editorFor({unit: {teachingPeriod: period as never}});

    component.forms.dates.controls.teachingPeriod.setValue(null);
    component.saveSection('dates');

    expect(sentBody(unitService)).toEqual({start_date: '2026-07-13', end_date: '2026-10-30'});
    expect(unit.teachingPeriod).toBeUndefined();
  });

  it('asks for both dates only when there is no teaching period', () => {
    const {component, unitService} = editorFor();

    component.forms.dates.controls.endDate.setValue(null);
    expect(component.forms.dates.valid).toBe(false);

    component.forms.dates.controls.teachingPeriod.setValue({id: 9} as never);
    expect(component.forms.dates.valid).toBe(true);

    component.forms.dates.controls.teachingPeriod.setValue(null);
    component.saveSection('dates');
    expect(unitService.update).not.toHaveBeenCalled();
  });

  it('refuses an end date before the start date', () => {
    const {component} = editorFor();

    component.forms.dates.controls.endDate.setValue(new Date(2026, 5, 1));

    expect(component.forms.dates.hasError('datesOutOfOrder')).toBe(true);
  });

  // Once a teaching period is chosen the custom dates are hidden, so dates left in the
  // wrong order must not keep the section from saving.
  it('saves a teaching period even when the hidden custom dates are out of order', () => {
    const {component, unitService} = editorFor();

    component.forms.dates.controls.endDate.setValue(new Date(2026, 5, 1));
    component.forms.dates.controls.teachingPeriod.setValue({id: 9} as never);
    component.saveSection('dates');

    expect(sentBody(unitService)).toEqual({teaching_period_id: 9});
  });
});

describe('UnitDetailsEditorComponent assess in portfolio', () => {
  it('asks before turning it on, and only turns it on when confirmed', () => {
    const {component, confirmationModal} = editorFor();
    const control = component.forms.portfolio.controls.markLateSubmissionsAsAssessInPortfolio;

    control.setValue(true);
    component.onToggleAssessInPortfolio({checked: true} as never);

    expect(control.value).toBe(false);
    expect(confirmationModal.show).toHaveBeenCalledTimes(1);

    const confirm = confirmationModal.show.mock.calls[0][2] as () => void;
    confirm();
    expect(control.value).toBe(true);
    expect(component.hasChanges('portfolio')).toBe(true);
  });

  it('does not ask when the unit already has it on', () => {
    const {component, confirmationModal} = editorFor({
      unit: {markLateSubmissionsAsAssessInPortfolio: true},
    });

    component.onToggleAssessInPortfolio({checked: true} as never);

    expect(confirmationModal.show).not.toHaveBeenCalled();
  });
});

describe('UnitDetailsEditorComponent grades', () => {
  // Moving saves the whole list, and used to take a half typed rename with it.
  it('does not move grades while one is being renamed', () => {
    const {component, unitService} = editorFor();

    const labels = () => component.gradeDefinitions.map((grade) => grade.label);
    const before = labels();

    component.editGrade(component.gradeDefinitions[2]);
    component.moveGrade(2, -1);

    expect(labels()).toEqual(before);
    expect(unitService.update).not.toHaveBeenCalled();
  });

  it('puts a renamed grade back when the rename is cancelled', () => {
    const {component, unitService} = editorFor();

    component.editGrade(component.gradeDefinitions[1]);
    component.updateGrade(1, 'label', 'Satisfactory');
    component.cancelGradeEdit();

    expect(component.gradeDefinitions[1].label).toBe('Pass');
    expect(component.editingGradeId).toBeNull();
    expect(unitService.update).not.toHaveBeenCalled();
  });
});

describe('UnitDetailsEditorComponent automated checking images', () => {
  // The unit fetches its image separately, so it is often not there yet when the page
  // builds its form. The select used to come up blank for a unit that had an image.
  it('starts from the image id until the image itself arrives', () => {
    const {component, unit, unitService} = editorFor({overseer: true, unit: {overseerImageId: 5}});
    const control = component.forms.overseer.controls.overseerImage;

    expect(component.compareById(control.value, {id: 5})).toBe(true);
    expect(component.hasChanges('overseer')).toBe(false);

    // Saving the other setting in the section leaves the image alone.
    component.forms.overseer.controls.assessmentEnabled.setValue(true);
    component.saveSection('overseer');
    expect(sentBody(unitService)).toEqual({assessment_enabled: true});
    expect(unit.overseerImage).toBeUndefined();
  });

  it('does not ask for images when automated checking is off', () => {
    const {getDockerImagesAsPromise} = editorFor({overseer: false});

    expect(getDockerImagesAsPromise).not.toHaveBeenCalled();
  });

  // Staff who cannot use Overseer get a 403, which used to be an uncaught promise.
  it('handles a refused image list quietly', async () => {
    const {component} = editorFor({overseer: true, images: Promise.reject('403')});

    await new Promise((resolve) => setTimeout(resolve));

    expect(component.dockerImages).toEqual([]);
  });
});

describe('unit setting helpers', () => {
  it('formats a day in the local calendar and treats no date as null', () => {
    expect(formatDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDay(null)).toBeNull();
    expect(formatDay(new Date('not a date'))).toBeNull();
  });

  it('compares dates by day, entities by id and empty values as equal', () => {
    expect(sameSetting(new Date(2026, 0, 5, 9), new Date(2026, 0, 5, 17))).toBe(true);
    expect(sameSetting({id: 1, name: 'a'}, {id: 1, name: 'b'})).toBe(true);
    expect(sameSetting({id: 1}, {id: 2})).toBe(false);
    expect(sameSetting(null, undefined)).toBe(true);
    expect(sameSetting('', null)).toBe(true);
    expect(sameSetting(5, '5')).toBe(true);
    expect(sameSetting(false, null)).toBe(false);
  });
});

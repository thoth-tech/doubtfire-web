import {describe, expect, it, vi} from 'vitest';
import {defer, of, throwError} from 'rxjs';
import {TutorialStream} from 'src/app/api/models/tutorial-stream/tutorial-stream';
import {Tutorial} from 'src/app/api/models/tutorial/tutorial';
import {Unit} from 'src/app/api/models/unit';
import {UnitTutorialsManagerComponent} from '../unit-tutorials-manager/unit-tutorials-manager.component';
import {UnitTutorialsListComponent} from './unit-tutorials-list.component';

function stream(abbreviation: string, name: string): TutorialStream {
  return Object.assign(new TutorialStream(), {abbreviation, name});
}

function tutorial(unit: Unit, id: number, extra: Partial<Tutorial> = {}): Tutorial {
  return Object.assign(new Tutorial(unit), {
    id,
    abbreviation: `LA1-0${id}`,
    meetingDay: 'Monday',
    meetingTime: '10:00',
    meetingLocation: 'Room 1',
    capacity: 20,
    numStudents: 0,
    ...extra,
  });
}

// Built directly: what is under test is the list's own handling of the form, the
// unit's caches and the api's answers, not the rendered table.
function listFor(options: {stream?: TutorialStream; create?: () => unknown} = {}) {
  const unit = Object.assign(new Unit(), {id: 3});
  const tutorialService = {
    create: vi.fn<(...args: unknown[]) => unknown>(options.create),
    delete: vi.fn(),
  };
  const tutorialStreamService = {update: vi.fn()};
  const confirmationModal = {show: vi.fn()};
  const alerts = {success: vi.fn(), error: vi.fn()};

  const component = new UnitTutorialsListComponent(
    tutorialService as never,
    tutorialStreamService as never,
    {query: () => of([])} as never, // campusService
    confirmationModal as never,
    alerts as never,
  );
  component.unit = unit;
  component.stream = options.stream;

  return {component, unit, tutorialService, tutorialStreamService, confirmationModal, alerts};
}

function fillNewTutorialRow(component: UnitTutorialsListComponent): void {
  component.formData.setValue({
    meetingDay: 'Tuesday',
    meetingTime: '14:30',
    meetingLocation: 'Room 2',
    abbreviation: 'LA1-02',
    campus: null,
    capacity: 25,
    tutor: {id: 7, name: 'Ada'},
  });
}

describe('UnitTutorialsListComponent adding tutorials', () => {
  // The new tutorial was built as the "selected" row, which the form reads as a row
  // being edited, so a refused create hid the add row until the page was reloaded.
  it('keeps the add row, and what was typed, when the api refuses a new tutorial', () => {
    const lab = stream('LA1', 'Lab 1');
    const {component, alerts} = listFor({
      stream: lab,
      create: () => throwError(() => 'Abbreviation already taken'),
    });
    component.ngOnInit();
    fillNewTutorialRow(component);

    component.submit();

    expect(component.selected).toBeFalsy();
    expect(component.formData.value.abbreviation).toBe('LA1-02');
    expect(alerts.error).toHaveBeenCalled();
  });

  // The api answer reaches the unit's cache first, which already refreshes the list.
  // The tutorial used to be pushed onto the table again after that, so it showed twice.
  it('shows a new tutorial once', () => {
    const lab = stream('LA1', 'Lab 1');
    const context = listFor({stream: lab});
    const saved = tutorial(context.unit, 2, {tutorialStream: lab});
    context.tutorialService.create.mockImplementation(() =>
      defer(() => {
        context.unit.tutorialsCache.add(saved);
        return of(saved);
      }),
    );
    context.component.ngOnInit();
    fillNewTutorialRow(context.component);

    context.component.submit();

    expect(context.component.dataSource.data).toEqual([saved]);
    expect((context.tutorialService.create.mock.calls[0][0] as Tutorial).tutorialStream).toBe(lab);
  });

  it('only offers the add row inside a stream', () => {
    expect(listFor({stream: stream('LA1', 'Lab 1')}).component.canAddTutorials).toBe(true);
    expect(listFor().component.canAddTutorials).toBe(false);
  });
});

describe('UnitTutorialsListComponent editing tutorials', () => {
  // The tutor select compared a user against a user_id that users do not have, so an
  // edited row always showed no tutor.
  it('matches the tutor and campus of the row being edited by id', () => {
    const {component} = listFor();

    expect(component.compareSelection({id: 7} as never, {id: 7} as never)).toBe(true);
    expect(component.compareSelection({id: 7} as never, {id: 8} as never)).toBe(false);
    expect(component.compareSelection({user_id: 7}, {id: 7} as never)).toBe(true);
    expect(component.compareSelection(null, null)).toBe(true);
    expect(component.compareSelection(null, {id: 1} as never)).toBe(false);
  });

  it('asks before deleting a tutorial, and says when the delete fails', () => {
    const {component, unit, tutorialService, confirmationModal, alerts} = listFor();
    const doomed = tutorial(unit, 1);
    tutorialService.delete.mockReturnValue(throwError(() => 'Tutorial has enrolments'));

    component.deleteTutorial(doomed);
    expect(tutorialService.delete).not.toHaveBeenCalled();

    (confirmationModal.show.mock.calls[0][2] as () => void)();
    expect(alerts.error).toHaveBeenCalledWith(
      'Could not delete LA1-01. Tutorial has enrolments',
      6000,
    );
  });

  it('sorts days in week order and times by the clock', () => {
    const {component, unit} = listFor();
    const early = tutorial(unit, 1, {meetingDay: 'Friday', meetingTime: '9:30'});
    const late = tutorial(unit, 2, {meetingDay: 'Monday', meetingTime: '10:00'});

    const value = (row: Tutorial, column: string) => component.sortValue(row, column) as number;
    expect(value(late, 'day')).toBeLessThan(value(early, 'day'));
    expect(value(early, 'time')).toBeLessThan(value(late, 'time'));
    expect(component.sortValue(early, 'location')).toBe('Room 1');
  });

  it('labels a tutorial with no limit on its size', () => {
    const {component, unit} = listFor();

    expect(component.capacityLabel(tutorial(unit, 1, {numStudents: 4, capacity: 20}))).toBe(
      '4 of 20',
    );
    expect(component.capacityLabel(tutorial(unit, 1, {numStudents: 4, capacity: -1}))).toBe(
      '4, no limit',
    );
  });
});

describe('UnitTutorialsListComponent streams', () => {
  // The unit kept the stream under its old short name after a rename, so deleting it
  // afterwards missed it and the stream stayed on the page.
  it('files a renamed stream under its new short name and keeps the order', () => {
    const first = stream('LA1', 'Lab 1');
    const second = stream('WS1', 'Workshop 1');
    const context = listFor({stream: first});
    context.unit.tutorialStreamsCache.add(first);
    context.unit.tutorialStreamsCache.add(second);
    context.component.ngOnInit();
    context.tutorialStreamService.update.mockImplementation(() => {
      first.abbreviation = 'LAB1';
      return of(first);
    });

    context.component.saveStream();

    const cache = context.unit.tutorialStreamsCache;
    expect(cache.has('LA1')).toBe(false);
    expect(cache.get('LAB1')).toBe(first);
    expect(context.unit.tutorialStreams).toEqual([first, second]);
    expect(context.component.editingStream).toBe(false);
  });
});

describe('UnitTutorialsListComponent streams being renamed at once', () => {
  // Another stream open for renaming has already changed its short name on screen, so
  // filing it again under that unsaved name used to list it twice.
  it('does not list a stream twice when another one is mid rename', () => {
    const first = stream('LA1', 'Lab 1');
    const second = stream('WS1', 'Workshop 1');
    const context = listFor({stream: first});
    context.unit.tutorialStreamsCache.add(first);
    context.unit.tutorialStreamsCache.add(second);
    context.component.ngOnInit();
    second.abbreviation = 'WS9';
    context.tutorialStreamService.update.mockImplementation(() => {
      first.abbreviation = 'LAB1';
      return of(first);
    });

    context.component.saveStream();

    expect(context.unit.tutorialStreams.length).toBe(2);
    expect(context.unit.tutorialStreamsCache.get('LAB1')).toBe(first);
    expect(context.unit.tutorialStreamsCache.get('WS1')).toBe(second);
  });
});

describe('UnitTutorialsManagerComponent', () => {
  // Tutorials without a stream were never listed on this tab.
  it('knows when some tutorials are not in a stream', () => {
    const unit = Object.assign(new Unit(), {id: 3});
    const manager = new UnitTutorialsManagerComponent({query: () => of([])} as never, {} as never);
    manager.unit = unit;

    unit.tutorialsCache.add(tutorial(unit, 1, {tutorialStream: stream('LA1', 'Lab 1')}));
    expect(manager.hasTutorialsWithoutStream).toBe(false);

    unit.tutorialsCache.add(tutorial(unit, 2, {tutorialStream: undefined}));
    expect(manager.hasTutorialsWithoutStream).toBe(true);
  });
});

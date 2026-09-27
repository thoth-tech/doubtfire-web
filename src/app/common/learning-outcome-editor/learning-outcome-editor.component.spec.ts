import {EntityCache, EntityMapping} from 'ngx-entity-service';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SimpleChange} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {LearningOutcome} from 'src/app/api/models/learning-outcome';
import {Unit} from 'src/app/api/models/unit';
import {LearningOutcomeEditorComponent} from './learning-outcome-editor.component';

function outcome(id: number, abbreviation: string, extra: Partial<LearningOutcome> = {}) {
  return Object.assign(new LearningOutcome(), {
    id,
    abbreviation,
    shortDescription: `About ${abbreviation}`,
    fullOutcomeDescription: `All about ${abbreviation}`,
    contextType: 'Unit',
    ...extra,
  });
}

function unitWith(...outcomes: LearningOutcome[]): Unit {
  const unit = Object.assign(new Unit(), {id: outcomes[0]?.id ?? 1, code: 'SIT101'});
  outcomes.forEach((each) => unit.learningOutcomesCache.add(each));
  return unit;
}

// The editor uses signals, an effect and inject(), so it is built inside an injection
// context, but it is driven by hand rather than rendered.
function editorFor(context?: Unit) {
  const learningOutcomeService = {
    cache: new EntityCache<LearningOutcome>(),
    mapping: new EntityMapping<LearningOutcome>(),
  };
  const alerts = {success: vi.fn(), error: vi.fn()};
  const component = TestBed.runInInjectionContext(
    () =>
      new LearningOutcomeEditorComponent(
        alerts as never,
        learningOutcomeService as never,
        {} as never, // fileDownloaderService
        {} as never, // nestedCsvDownloadModalService
        {} as never, // feedbackTemplateService
        {} as never, // taskService
        {} as never, // csvResultModalService
        {} as never, // csvUploadModal
        {show: vi.fn()} as never, // confirmationModal
      ),
  );
  component.context = context;
  component.ngOnChanges({context: new SimpleChange(undefined, context, true)});
  component.ngOnInit();
  return {component, learningOutcomeService, alerts};
}

describe('LearningOutcomeEditorComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  // The task editor keeps this editor open and swaps the task under it. The table used
  // to keep listing, and following, the outcomes of the task shown before.
  it('lists the outcomes of the new context when the context changes', () => {
    const first = unitWith(outcome(1, 'ULO1'));
    const second = unitWith(outcome(2, 'ULO7'));
    const {component} = editorFor(first);
    expect(component.outcomeSource.data.map((each) => each.abbreviation)).toEqual(['ULO1']);

    component.context = second;
    component.ngOnChanges({context: new SimpleChange(first, second, false)});

    expect(component.outcomeSource.data.map((each) => each.abbreviation)).toEqual(['ULO7']);

    // A change to the old context no longer reaches the table.
    first.learningOutcomesCache.add(outcome(3, 'ULO2'));
    expect(component.outcomeSource.data.map((each) => each.abbreviation)).toEqual(['ULO7']);
    component.ngOnDestroy();
  });

  // Each emission of the institution cache was appended to the last one, so the
  // suggestions to connect filled up with repeats.
  it('suggests each institution outcome once, however often the list refreshes', () => {
    const {component, learningOutcomeService} = editorFor(unitWith(outcome(1, 'ULO1')));

    learningOutcomeService.cache.add(outcome(10, 'GLO1', {contextType: null}));
    learningOutcomeService.cache.add(outcome(11, 'GLO2', {contextType: null}));

    expect(component.allOutcomes().map((each) => each.abbreviation)).toEqual(['GLO1', 'GLO2']);
    component.ngOnDestroy();
  });

  // The suggestion list was worked out once and never saw outcomes that loaded later.
  it('offers outcomes that load after the suggestions were first read', () => {
    const {component, learningOutcomeService} = editorFor(unitWith(outcome(1, 'ULO1')));
    expect(component.filteredOutcomes()).toEqual([]);

    learningOutcomeService.cache.add(outcome(10, 'GLO1', {contextType: null}));

    expect(component.filteredOutcomes().map((each) => each.abbreviation)).toEqual(['GLO1']);
    component.ngOnDestroy();
  });

  it('numbers a new outcome after the highest code in use', () => {
    const {component} = editorFor(
      unitWith(outcome(1, 'ULO3'), outcome(2, 'ULO1'), outcome(3, 'ULOX')),
    );

    expect(component.getNextOutcomeNumber()).toBe(4);

    component.createLearningOutcome();
    expect(component.selectedOutcome.abbreviation).toBe('ULO4');
    component.ngOnDestroy();
  });

  it('still numbers a new outcome when no code ends in a number', () => {
    const {component} = editorFor(unitWith(outcome(1, 'Intro'), outcome(2, 'Core')));

    expect(component.getNextOutcomeNumber()).toBe(1);
    component.ngOnDestroy();
  });

  it('ignores non-decimal suffixes when numbering outcomes', () => {
    const {component} = editorFor(
      unitWith(outcome(1, 'ULO2'), outcome(2, 'ULO0x10'), outcome(3, 'ULO1e3')),
    );

    expect(component.getNextOutcomeNumber()).toBe(3);
    component.ngOnDestroy();
  });

  // Saving one row used to close whichever outcome was open, even a different one.
  it('keeps the open outcome open when another row is saved', () => {
    const open = outcome(1, 'ULO1');
    const other = outcome(2, 'ULO2');
    open.save = vi.fn(() => of(open));
    other.save = vi.fn(() => of(other));
    const {component} = editorFor(unitWith(open, other));

    component.selectLearningOutcome(open);
    component.saveLearningOutcome(other);
    expect(component.selectedOutcome).toBe(open);

    component.saveLearningOutcome(open);
    expect(component.selectedOutcome).toBeNull();
    component.ngOnDestroy();
  });

  it('puts an outcome back as it was when editing is cancelled', () => {
    const open = outcome(1, 'ULO1');
    const {component} = editorFor(unitWith(open));

    component.selectLearningOutcome(open);
    open.shortDescription = 'Changed my mind';
    component.cancelEdit();

    expect(open.shortDescription).toBe('About ULO1');
    expect(component.selectedOutcome).toBeNull();
    component.ngOnDestroy();
  });
});

describe('LearningOutcomeEditorComponent.getNextOutcomeNumber', () => {
  // Build the component without the Angular injector so the test stays focused
  // on the numbering logic.
  function editorWith(prefix: string, abbreviations: string[]): LearningOutcomeEditorComponent {
    const comp = Object.create(
      LearningOutcomeEditorComponent.prototype,
    ) as LearningOutcomeEditorComponent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (comp as any).abbreviationPrefix = prefix;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (comp as any).outcomeSource = {data: abbreviations.map((abbreviation) => ({abbreviation}))};
    return comp;
  }

  it('returns 1 when there are no outcomes', () => {
    expect(editorWith('TLO', []).getNextOutcomeNumber()).toBe(1);
  });

  it('returns max + 1, not last + 1, when rows are out of order', () => {
    expect(editorWith('TLO', ['TLO1', 'TLO3', 'TLO2']).getNextOutcomeNumber()).toBe(4);
  });

  it('ignores a non-numeric abbreviation instead of producing NaN', () => {
    expect(editorWith('TLO', ['TLO1', 'TLOx']).getNextOutcomeNumber()).toBe(2);
  });

  it('returns 1 when every abbreviation is non-numeric', () => {
    expect(editorWith('TLO', ['TLOa', 'TLOb']).getNextOutcomeNumber()).toBe(1);
  });

  it('ignores an abbreviation where the prefix is not at the start', () => {
    expect(editorWith('TLO', ['1TLO', 'TLO2']).getNextOutcomeNumber()).toBe(3);
  });

  it('ignores a decimal suffix rather than producing a fractional number', () => {
    expect(editorWith('TLO', ['TLO.5', 'TLO4']).getNextOutcomeNumber()).toBe(5);
  });
});

import {describe, expect, it} from 'vitest';
import {LearningOutcomeEditorComponent} from './learning-outcome-editor.component';

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

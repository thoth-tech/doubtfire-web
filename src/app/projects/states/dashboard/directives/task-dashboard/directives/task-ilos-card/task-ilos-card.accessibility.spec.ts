import {beforeEach, describe, expect, it} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {MatCardModule} from '@angular/material/card';
import {MatChipsModule} from '@angular/material/chips';
import {MatTooltipModule} from '@angular/material/tooltip';
import {LearningOutcome} from 'src/app/api/models/learning-outcome';
import {expectAccessible} from 'src/app/common/testing/accessibility';
import {TaskIlosCardComponent} from './task-ilos-card.component';

describe('Task learning outcomes rendered accessibility', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskIlosCardComponent],
      imports: [MatCardModule, MatChipsModule, MatTooltipModule],
    }).compileComponents();
  });

  it('presents linked outcomes as descriptive list items without grid roles or tab stops', async () => {
    const fixture = TestBed.createComponent(TaskIlosCardComponent);
    const outcomes = [
      {
        id: 1,
        abbreviation: 'LO1',
        fullOutcomeDescription: 'Explain the solution.',
        linkedOutcomeIds: [2, 3],
      },
      {
        id: 2,
        abbreviation: 'O1',
        shortDescription: 'Critical thinking',
        fullOutcomeDescription: 'Think critically.',
        linkedOutcomeIds: [],
      },
      {
        id: 3,
        abbreviation: 'O2',
        shortDescription: 'Clear communication',
        fullOutcomeDescription: 'Communicate clearly.',
        linkedOutcomeIds: [],
      },
    ] as LearningOutcome[];
    fixture.componentRef.setInput('iloContextType', 'Unit');
    fixture.componentRef.setInput('unit', {ilos: outcomes});
    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    await expectAccessible(root);
    const lists = root.querySelectorAll('[role="list"]');
    expect(lists).toHaveLength(1);
    expect(lists[0].getAttribute('aria-label')).toBe('Linked outcomes for LO1');
    const chips = Array.from(lists[0].querySelectorAll<HTMLElement>('[role="listitem"]'));
    expect(chips.map((chip) => chip.textContent.trim())).toEqual(['O1', 'O2']);
    expect(root.querySelector('mat-chip-row, [role="gridcell"]')).toBeNull();
    for (const chip of chips) {
      expect(chip.tabIndex).toBe(-1);
      expect(chip.querySelector('button, input, [role="option"], [tabindex="0"]')).toBeNull();
    }
    expect(
      chips.map(
        (chip) => document.getElementById(chip.getAttribute('aria-describedby'))?.textContent,
      ),
    ).toEqual(['Critical thinking', 'Clear communication']);
  });

  it('does not render an empty outcomes card or an empty linked-outcome list', async () => {
    const fixture = TestBed.createComponent(TaskIlosCardComponent);
    fixture.componentRef.setInput('iloContextType', 'Unit');
    fixture.componentRef.setInput('unit', {ilos: []});
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('mat-card, [role="list"]')).toBeNull();
  });
});

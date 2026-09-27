import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {UnitRole} from 'src/app/api/models/unit-role';
import {TutorNotesViewComponent} from './tutor-notes-view.component';

const tutor = {user: {name: 'Tia Tutor'}} as UnitRole;
const task = {
  tutor,
  definition: {abbreviation: 'T1', name: 'First task'},
  project: {student: {name: 'Ada Lovelace', displayName: 'Ada Lovelace'}},
};

describe('TutorNotesViewComponent', () => {
  let fixture: ComponentFixture<TutorNotesViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TutorNotesViewComponent],
      // The notes list itself is covered by its own spec.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorNotesViewComponent);
  });

  function lines(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('header p')).map((line) =>
      line.textContent.replace(/\s+/g, ' ').trim(),
    );
  }

  it('heads the tab with a title, who can see the notes and the task', () => {
    fixture.componentRef.setInput('task', task);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2').textContent.trim()).toBe('Moderation notes');
    expect(lines()).toEqual([
      'Staff-only discussion about the feedback on this task. Visible to Tia Tutor and the convenors.',
      'T1 First task (Ada Lovelace)',
    ]);
  });

  it('leaves the title to the dialog and speaks about the tutor when there is no task', () => {
    fixture.componentRef.setInput('unitRole', tutor);
    fixture.componentRef.setInput('inDialog', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2')).toBeNull();
    expect(lines()).toEqual([
      'Staff-only discussion about feedback from Tia Tutor. Visible to Tia Tutor and the convenors.',
    ]);
  });

  it('lays itself out as a full-height flex column', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('h-full');
    expect(fixture.nativeElement.classList).toContain('flex-col');
  });
});

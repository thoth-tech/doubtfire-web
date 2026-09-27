import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {StaffNotesViewComponent} from './staff-notes-view.component';

describe('StaffNotesViewComponent', () => {
  let fixture: ComponentFixture<StaffNotesViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StaffNotesViewComponent],
      // The notes list itself is covered by its own spec.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffNotesViewComponent);
  });

  it('heads the tab with a title and says who the notes are about', () => {
    fixture.componentRef.setInput('project', {student: {name: 'Ada Lovelace'}});
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('header') as HTMLElement;
    expect(header.querySelector('h2').textContent.trim()).toBe('Student notes');
    expect(header.querySelector('p').textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Private notes about Ada Lovelace for staff. Students cannot see them.',
    );
    expect(fixture.nativeElement.querySelector('f-staff-notes')).not.toBeNull();
  });

  it('lays itself out as a full-height flex column', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('h-full');
    expect(fixture.nativeElement.classList).toContain('flex-col');
  });
});

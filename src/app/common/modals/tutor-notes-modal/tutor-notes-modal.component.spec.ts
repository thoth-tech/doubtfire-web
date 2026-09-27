import {beforeEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {UnitRole} from 'src/app/api/models/unit-role';
import {TutorNotesModalComponent} from './tutor-notes-modal.component';

describe('TutorNotesModalComponent', () => {
  let fixture: ComponentFixture<TutorNotesModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TutorNotesModalComponent],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: {unitRole: {user: {name: 'Tia Tutor'}} as UnitRole}},
      ],
      // The dialog directives and the notes view are not under test here.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorNotesModalComponent);
    fixture.detectChanges();
  });

  it('lays the dialog out as a title, the notes and a Close action', () => {
    const title = fixture.nativeElement.querySelector('[mat-dialog-title]') as HTMLElement;
    expect(title.textContent.trim()).toBe('Moderation notes');

    const content = fixture.nativeElement.querySelector('mat-dialog-content') as HTMLElement;
    expect(content.querySelector('f-tutor-notes-view')).not.toBeNull();

    const close = fixture.nativeElement.querySelector(
      'mat-dialog-actions button[mat-dialog-close]',
    ) as HTMLButtonElement;
    expect(close.textContent.trim()).toBe('Close');
    expect(close.getAttribute('type')).toBe('button');
  });
});

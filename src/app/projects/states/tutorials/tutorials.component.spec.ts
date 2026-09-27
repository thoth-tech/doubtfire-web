import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute} from '@angular/router';
import {of} from 'rxjs';
import {Project, Tutorial, Unit} from 'src/app/api/models/doubtfire-model';
import {TutorialsComponent} from './tutorials.component';

describe('TutorialsComponent phone cards', () => {
  let fixture: ComponentFixture<TutorialsComponent>;
  let component: TutorialsComponent;
  let project: Project;
  let firstTutorial: Tutorial;
  let secondTutorial: Tutorial;

  beforeEach(async () => {
    firstTutorial = {
      id: 1,
      abbreviation: 'LA1-01',
      tutorialStream: {name: 'Practical 1'},
      campus: {id: 4, name: 'Burwood'},
      meetingDay: 'Tuesday',
      meetingTime: '13:30:00',
      meetingLocation: 'EN107',
      tutorName: 'Demo Tutor',
      hasCapacity: () => true,
    } as unknown as Tutorial;
    secondTutorial = {
      id: 2,
      abbreviation: 'LA1-02',
      tutorialStream: {name: 'Practical 1'},
      campus: {id: 4, name: 'Burwood'},
      meetingDay: 'Wednesday',
      meetingTime: '09:00:00',
      meetingLocation: 'Online',
      tutorName: 'Second Tutor',
      hasCapacity: () => false,
    } as unknown as Tutorial;

    const unit = {
      tutorials: [firstTutorial, secondTutorial],
      tutorialStreamsCache: {size: 1},
      allowStudentChangeTutorial: true,
    } as unknown as Unit;
    project = {
      unit,
      campus: {id: 4, name: 'Burwood'},
      isEnrolledIn: vi.fn((tutorial: Tutorial) => tutorial.id === firstTutorial.id),
      switchToTutorial: vi.fn(),
    } as unknown as Project;

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        NoopAnimationsModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
      ],
      declarations: [TutorialsComponent],
      providers: [{provide: ActivatedRoute, useValue: {parent: {snapshot: {data: {project}}}}}],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorialsComponent);
    component = fixture.componentInstance;
    component.project$ = of(project);
    fixture.detectChanges();
  });

  it('keeps the desktop table and exposes every desktop value in each phone card', () => {
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.tutorial-card'),
    ) as HTMLElement[];

    expect(fixture.nativeElement.querySelector('table.tutorial-table')).not.toBeNull();
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('LA1-01');
    expect(cards[0].textContent).toContain('Practical 1');
    expect(cards[0].textContent).toContain('Burwood');
    expect(cards[0].textContent).toContain('Tuesday');
    expect(cards[0].textContent).toContain('13:30');
    expect(cards[0].textContent).toContain('EN107');
    expect(cards[0].textContent).toContain('Demo Tutor');
    expect(cards[0].textContent).toContain('Withdraw');
    expect(cards[1].textContent).toContain('Full');
  });

  it('uses the same enrolment action for phone cards and the desktop table', () => {
    const withdraw = fixture.nativeElement.querySelector(
      '.tutorial-card button[aria-label="Withdraw from LA1-01"]',
    ) as HTMLButtonElement;
    withdraw.click();

    expect(project.switchToTutorial).toHaveBeenCalledOnce();
    expect(project.switchToTutorial).toHaveBeenCalledWith(firstTutorial);
  });

  it('handles missing times and fields without throwing or rendering blanks', () => {
    expect(component.shortTime('')).toBe('Not set');
    expect(component.shortTime('9')).toBe('9');
    expect(component.tutorialValue(undefined)).toBe('Not set');
  });

  it('renders an exact empty state when the authorised unit payload has no tutorials', () => {
    (project.unit as unknown as {tutorials: Tutorial[]}).tutorials = [];
    component.project$ = of(project);
    component.ngOnDestroy();
    component.ngOnInit();
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.tutorial-empty[role="status"]');
    expect(empty.textContent).toContain('No tutorials available');
  });
});

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {Router, RouterModule, provideRouter} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {Project, Unit, UnitRole, UserService} from 'src/app/api/models/doubtfire-model';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {HomeComponent} from './home.component';

function projectIn(myRole: string, id: number): Project {
  return {id, unit: {myRole}} as unknown as Project;
}

function unitRole(
  id: number,
  role: string,
  unit: Partial<Unit> & {id: number; code: string},
  tutorNoteCount = 0,
): UnitRole {
  const result = new UnitRole();
  const model = Object.assign(new Unit(), {
    name: `${unit.code} unit`,
    active: true,
    startDate: new Date(2026, 6, 6),
    endDate: new Date(2026, 9, 30),
    ...unit,
  });
  Object.assign(result, {id, role, unit: model, tutorNoteCount});
  return result;
}

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let loading$: BehaviorSubject<boolean>;
  let unitRoles$: BehaviorSubject<UnitRole[]>;
  let projects$: BehaviorSubject<Project[]>;
  let currentUser: {role: string};

  beforeEach(async () => {
    // Only the clock is faked, so the teaching week and progress below are stable.
    vi.useFakeTimers({toFake: ['Date'], now: new Date(2026, 7, 20, 10)});

    loading$ = new BehaviorSubject(false);
    unitRoles$ = new BehaviorSubject<UnitRole[]>([]);
    projects$ = new BehaviorSubject<Project[]>([]);
    currentUser = {role: 'Tutor'};

    await TestBed.configureTestingModule({
      declarations: [HomeComponent],
      imports: [EmptyStateComponent, MatButtonModule, MatIconModule, RouterModule],
      providers: [
        provideRouter([]),
        {provide: DoubtfireConstants, useValue: {ExternalName: {value: 'OnTrack'}}},
        {
          provide: GlobalStateService,
          useValue: {
            showHeader: vi.fn(),
            setView: vi.fn(),
            isLoadingSubject: loading$,
            unitRolesSubject: unitRoles$,
            projectsSubject: projects$,
          },
        },
        {provide: UserService, useValue: {currentUser}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function page(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  // A sign out, or a project that is still being mapped, left a project with no unit in
  // the cache, and the unguarded filter threw "reading 'myRole'" out of the subscription.
  it('skips a project that has no unit instead of throwing', () => {
    const studying = projectIn('Student', 1);

    expect(() =>
      projects$.next([{id: 2} as Project, studying, projectIn('Tutor', 3), null]),
    ).not.toThrow();

    expect(component.projects).toEqual([studying]);
  });

  it('shows a loading state, not the empty state, until the units have loaded', () => {
    loading$.next(true);

    const loadingPage = page();
    expect(loadingPage.querySelector('[role="status"]')?.textContent).toContain(
      'Loading your units',
    );
    expect(loadingPage.textContent).not.toContain('You are not enrolled');

    loading$.next(false);
    expect(page().textContent).toContain('You are not enrolled in any OnTrack units');
  });

  it('gives each active unit a card with its colour band, role, teaching week and inbox link', () => {
    unitRoles$.next([
      unitRole(11, 'Convenor', {id: 1, code: 'SIT374'}, 2),
      unitRole(12, 'Tutor', {id: 2, code: 'SIT111', active: false}),
      unitRole(13, 'Tutor', {id: 3, code: 'SIT222'}),
    ]);

    const cards = page().querySelectorAll('ul[aria-label="Active units you teach"] > li');
    expect(cards.length).toBe(2);

    const first = cards[0] as HTMLElement;
    const band = first.querySelector('section') as HTMLElement;
    expect(band.style.getPropertyValue('--unit-accent')).toBe('var(--ot-unit-1)');
    expect(
      (cards[1].querySelector('section') as HTMLElement).style.getPropertyValue('--unit-accent'),
    ).toBe('var(--ot-unit-2)');

    expect(first.querySelector('h2 a')?.getAttribute('href')).toBe('/units/1/tasks/inbox');
    expect(first.textContent).toContain('Convenor');
    expect(first.textContent).toContain('Week 7');
    expect(first.textContent).toContain('2 unread moderation notes');

    const bar = first.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('39');
    expect(bar?.getAttribute('aria-valuetext')).toBe('Week 7, 39% through the teaching period');

    const inbox = Array.from(first.querySelectorAll('footer a')).find((link) =>
      link.textContent.includes('Open inbox'),
    );
    expect(inbox?.getAttribute('href')).toBe('/units/1/tasks/inbox');
    expect(inbox?.textContent).toContain('for SIT374');
  });

  it('sums the staff summary across the units you teach', () => {
    unitRoles$.next([
      unitRole(11, 'Convenor', {id: 1, code: 'SIT374'}, 2),
      unitRole(12, 'Tutor', {id: 2, code: 'SIT111', active: false}),
      unitRole(13, 'Tutor', {id: 3, code: 'SIT222'}, 1),
    ]);

    const header = page().querySelector('header');
    expect(header?.querySelector('h1')?.textContent).toContain('Units you teach');
    expect(header?.textContent).toContain('2 active units');
    expect(header?.textContent).toContain('1 previous');
    expect(header?.textContent).toContain('3 unread moderation notes');
    expect(header?.querySelector('a')?.getAttribute('href')).toBe('/view-all-units');
  });

  it('labels a unit that has not started yet with its start date', () => {
    unitRoles$.next([
      unitRole(11, 'Tutor', {
        id: 1,
        code: 'SIT374',
        startDate: new Date(2026, 8, 1),
        endDate: new Date(2026, 11, 1),
      }),
    ]);

    const card = page().querySelector('ul[aria-label="Active units you teach"] > li');
    expect(card?.textContent).toContain('Starts 1 Sep');
    expect(card?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('points a tutor with no active units at the full list', () => {
    unitRoles$.next([unitRole(12, 'Tutor', {id: 2, code: 'SIT111', active: false})]);

    const content = page();
    expect(content.querySelector('ul[aria-label="Active units you teach"]')).toBeNull();
    expect(content.textContent).toContain('You are not teaching any active units');
    expect(content.querySelector('section a')?.getAttribute('href')).toBe('/view-all-units');
  });

  it('gives a student the same unit cards, linked to their tasks and planner', () => {
    currentUser.role = 'Student';
    projects$.next([
      Object.assign(projectIn('Student', 1), {
        unit: Object.assign(new Unit(), {
          myRole: 'Student',
          id: 1,
          code: 'SIT374',
          name: 'Capstone',
          active: true,
          startDate: new Date(2026, 6, 6),
          endDate: new Date(2026, 9, 30),
        }),
      }),
    ]);

    const content = page();
    expect(content.querySelector('h1')?.textContent).toContain('My units');
    expect(content.textContent).not.toContain('Units you teach');

    const cards = content.querySelectorAll('ul[aria-label="Active units you study"] > li');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('SIT374');
    expect(cards[0].textContent).toContain('Capstone');
    expect(cards[0].querySelector('h3 a')?.getAttribute('href')).toBe('/projects/1/dashboard');
    // Straight under the page's h1, so the card title reads as a level 2 heading.
    expect(cards[0].querySelector('h3')?.getAttribute('aria-level')).toBe('2');
    expect(
      cards[0].querySelector('[role="progressbar"]')?.getAttribute('aria-valuetext'),
    ).toContain('Week');
    const links = Array.from(cards[0].querySelectorAll('footer a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual(['/projects/1/dashboard', '/projects/1/plan']);
  });

  // The unit caches start out empty, so the message has to wait for the first load to
  // finish before it can say the user has no units.
  describe('not enrolled message', () => {
    function notEnrolledShown(): boolean {
      return page().textContent.includes('You are not enrolled');
    }

    it('stays hidden while units and projects are still loading', () => {
      loading$.next(true);

      expect(component.hasNoUnits).toBe(false);
      expect(notEnrolledShown()).toBe(false);
    });

    it('shows once loading finishes with no projects and no unit roles', () => {
      loading$.next(true);
      loading$.next(false);

      expect(component.hasNoUnits).toBe(true);
      expect(notEnrolledShown()).toBe(true);
    });

    it('stays hidden for a student with a project', () => {
      currentUser.role = 'Student';
      loading$.next(true);
      projects$.next([projectIn('Student', 1)]);
      loading$.next(false);

      expect(component.hasNoUnits).toBe(false);
    });

    it('stays hidden for staff with a unit role', () => {
      loading$.next(true);
      unitRoles$.next([unitRole(11, 'Tutor', {id: 1, code: 'SIT374'})]);
      loading$.next(false);

      expect(component.hasNoUnits).toBe(false);
      expect(notEnrolledShown()).toBe(false);
    });
  });
});

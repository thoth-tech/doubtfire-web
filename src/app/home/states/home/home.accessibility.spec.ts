import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {RouterLink, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {IsActiveUnitRole} from 'src/app/common/pipes/is-active-unit-role.pipe';
import {DateService} from 'src/app/common/services/date.service';
import {expectAccessible} from 'src/app/common/testing/accessibility';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {HomeComponent} from './home.component';

describe('Home unit navigation accessibility', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let shell: HTMLElement;

  beforeEach(async () => {
    const day = 24 * 60 * 60 * 1000;
    const unit = {
      id: 8,
      active: true,
      isActive: true,
      name: 'Demonstration unit',
      code: 'DEMO',
      myRole: 'Student',
      startDate: new Date(Date.now() - 30 * day),
      endDate: new Date(Date.now() + 30 * day),
      weekNumber: () => 5,
      teachingPeriodProgress: 50,
    };
    await TestBed.configureTestingModule({
      imports: [CommonModule, RouterLink, MatProgressBarModule],
      declarations: [HomeComponent, IsActiveUnitRole],
      providers: [
        provideRouter([]),
        {provide: DoubtfireConstants, useValue: {ExternalName: {value: 'OnTrack'}}},
        {provide: UserService, useValue: {currentUser: {role: 'Tutor', preferredName: 'Demo'}}},
        {provide: DateService, useValue: {showDate: () => '2026'}},
        {
          provide: GlobalStateService,
          useValue: {
            showHeader: vi.fn(),
            setView: vi.fn(),
            onLoad: (fn: () => void) => fn(),
            isLoadingSubject: of(false),
            unitRolesSubject: of([
              {
                id: 3,
                unit: {...unit, code: 'TEACH', name: 'Teaching demonstration unit'},
                role: 'Tutor',
              },
            ]),
            projectsSubject: of([{id: 12, unit}]),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeComponent);
    // The app shell renders every page inside its one main landmark, so the section
    // headers on this page are not page banners.
    shell = document.createElement('main');
    fixture.nativeElement.replaceWith(shell);
    shell.appendChild(fixture.nativeElement);
    Object.assign(fixture.componentInstance, {$safeNavigationMigration: (value: unknown) => value});
    fixture.detectChanges();
  });

  afterEach(() => shell.remove());

  // Each unit card is named by its title link, which carries the unit code.
  const cardTitleLinks = (): HTMLAnchorElement[] => [
    ...fixture.nativeElement.querySelectorAll('[id^="staff-unit-"] a, [id^="study-unit-"] a'),
  ];

  it('renders staff and student cards as named native links with actual route destinations', () => {
    const links = cardTitleLinks();
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/units/8/tasks/inbox',
      '/projects/12/dashboard',
    ]);
    expect(links.map((link) => link.textContent?.trim())).toEqual(['TEACH', 'DEMO']);
    // the name starts with the visible code, then says which unit and role
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'TEACH, Teaching demonstration unit - Tutor',
      'DEMO, Demonstration unit',
    ]);
    for (const link of links) {
      expect(link.tabIndex).toBe(0);
      link.focus();
      expect(document.activeElement).toBe(link);
      expect(link.querySelector('button, a, input, [tabindex="0"]')).toBeNull();
    }
  });

  it('does not create navigation stops for inactive units', () => {
    const component = fixture.componentInstance;
    component.unitRolesLoaded(
      component.unitRoles.map((unitRole) => ({
        ...unitRole,
        unit: {...unitRole.unit, isActive: false},
      })) as never,
    );
    component.projectsLoaded(
      component.projects.map((project) => ({
        ...project,
        unit: {...project.unit, isActive: false},
      })) as never,
    );
    fixture.detectChanges();
    expect(cardTitleLinks()).toEqual([]);
  });

  it('passes automated accessibility checks for the student and staff entry points', async () => {
    await fixture.whenStable();
    await expectAccessible(fixture.nativeElement);
  });

  it('names both rendered progress bars as time through their own teaching period', async () => {
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const bars = [...element.querySelectorAll<HTMLElement>('[role="progressbar"]')];
    expect(bars.map((bar) => bar.getAttribute('aria-label'))).toEqual([
      'Teaching period progress for Teaching demonstration unit',
      'Teaching period progress for Demonstration unit',
    ]);
    expect(bars.map((bar) => bar.getAttribute('aria-valuenow'))).toEqual(['50', '50']);
    await expectAccessible(element);

    bars[0].removeAttribute('aria-label');
    await expect(expectAccessible(element)).rejects.toThrow('aria-progressbar-name');
  });

  it('uses one control for each view-all destination', () => {
    expect(fixture.nativeElement.querySelector('a button')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/dashboard"]')).toBeTruthy();
  });
});

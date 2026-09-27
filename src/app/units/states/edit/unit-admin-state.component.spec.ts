import {afterEach, describe, expect, it} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatTabsModule} from '@angular/material/tabs';
import {ActivatedRoute, RouterLink, convertToParamMap, provideRouter} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {PageContainerComponent} from 'src/app/common/page-container/page-container.component';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {UnitAdminStateComponent} from './unit-admin-state.component';

const unit = {id: 7, code: 'SIT101', name: 'Intro to Things', teachingPeriod: {name: 'T2 2026'}};

async function render(
  tab: string | null,
  routeUnit: object | null = unit,
): Promise<ComponentFixture<UnitAdminStateComponent>> {
  const params = convertToParamMap(tab ? {tab} : {});

  await TestBed.configureTestingModule({
    declarations: [UnitAdminStateComponent, PageContainerComponent],
    imports: [MatTabsModule, RouterLink, EmptyStateComponent],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {paramMap: params},
          paramMap: new BehaviorSubject(params),
          parent: {snapshot: {data: {unit: routeUnit}}},
        },
      },
      {
        provide: UserService,
        useValue: {getTutors: () => of([]), currentUser: {role: 'Convenor'}},
      },
      {
        provide: GlobalStateService,
        useValue: {
          currentViewAndEntitySubject$: {value: null},
          loadedUnitRoles: {currentValues: []},
          setView: () => {},
        },
      },
    ],
    // The editors behind each tab are covered by their own specs.
    schemas: [NO_ERRORS_SCHEMA],
  }).compileComponents();

  const fixture = TestBed.createComponent(UnitAdminStateComponent);
  fixture.detectChanges();
  return fixture;
}

function text(fixture: ComponentFixture<UnitAdminStateComponent>, selector: string): string {
  return (fixture.nativeElement.querySelector(selector)?.textContent ?? '').trim();
}

describe('UnitAdminStateComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('names the unit under the page heading', async () => {
    const fixture = await render('staff');

    expect(text(fixture, 'h1')).toBe('Unit administration');
    expect(text(fixture, 'header p')).toContain('SIT101 Intro to Things');
    expect(text(fixture, 'header p')).toContain('T2 2026');
  });

  it('links every tab to its own address and marks the open one', async () => {
    const fixture = await render('staff');
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('a[mat-tab-link]'),
    );

    expect(links.map((link) => link.textContent.trim())).toEqual([
      'Unit details',
      'Learning outcomes',
      'Staff',
      'Tutorials',
      'Students',
      'Tasks',
      'Groups',
      'Communications',
    ]);
    expect(links[2].getAttribute('href')).toBe('/units/7/admin/staff');
    expect(links[2].classList).toContain('mdc-tab--active');
    expect(links[0].classList).not.toContain('mdc-tab--active');
  });

  it('opens the tab in the address and introduces it', async () => {
    const fixture = await render('tutorials');

    expect(fixture.componentInstance.currentTab.routeSegment).toBe('tutorials');
    expect(text(fixture, 'mat-tab-nav-panel h2')).toBe('Tutorials');
    expect(fixture.nativeElement.querySelector('unit-tutorials-manager')).not.toBeNull();
  });

  it('falls back to unit details for an address it does not know', async () => {
    const fixture = await render('not-a-tab');

    expect(fixture.componentInstance.currentTab.routeSegment).toBe('details');
    expect(fixture.nativeElement.querySelector('f-unit-details-editor')).not.toBeNull();
  });

  it('leaves the tasks tab to lay out its own page', async () => {
    const fixture = await render('tasks');

    expect(fixture.nativeElement.querySelector('mat-tab-nav-panel h2')).toBeNull();
    expect(fixture.nativeElement.querySelector('f-unit-task-editor')).not.toBeNull();
  });

  // Before, a missing unit left the loading skeleton on screen for good.
  it('shows a way out when there is no unit to administer', async () => {
    const fixture = await render('details', null);

    expect(fixture.componentInstance.loadingUnit).toBe(false);
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeNull();
    expect(text(fixture, 'f-empty-state')).toContain('This unit could not be loaded');
    expect(fixture.nativeElement.querySelector('a[href="/home"]')).not.toBeNull();
  });
});

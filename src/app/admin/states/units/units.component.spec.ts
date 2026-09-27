import {EntityCache} from 'ngx-entity-service';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {ActivatedRoute, RouterModule, provideRouter} from '@angular/router';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {TeachingPeriod} from 'src/app/api/models/teaching-period';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {ProjectService} from 'src/app/api/services/project.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {CreateNewUnitModal} from '../../modals/create-new-unit-modal/create-new-unit-modal.component';
import {FUnitsComponent} from './units.component';

function unit(id: number, code: string, extra: Partial<Unit> = {}): Unit {
  return Object.assign(new Unit(), {
    id,
    code,
    name: `${code} name`,
    active: true,
    startDate: new Date(2026, 6, 6),
    endDate: new Date(2026, 9, 30),
    ...extra,
  });
}

function roleIn(id: number, taught: Unit, role = 'Tutor'): UnitRole {
  return Object.assign(new UnitRole(), {id, role, unit: taught});
}

function projectIn(id: number, studied: Unit): Project {
  return Object.assign(new Project(studied), {id});
}

describe('FUnitsComponent', () => {
  let fixture: ComponentFixture<FUnitsComponent>;
  let component: FUnitsComponent;
  let unitRoles$: BehaviorSubject<UnitRole[]>;
  let units$: BehaviorSubject<Unit[]>;
  let projects$: BehaviorSubject<Project[]>;
  let unitService: {query: ReturnType<typeof vi.fn>};
  let projectService: {query: ReturnType<typeof vi.fn>};
  let allProjects: Project[];

  async function create(mode: 'admin' | 'tutor' | 'student') {
    await TestBed.configureTestingModule({
      declarations: [FUnitsComponent],
      imports: [EmptyStateComponent, MatSortModule, MatTableModule, RouterModule],
      providers: [
        provideRouter([]),
        {provide: CreateNewUnitModal, useValue: {show: vi.fn()}},
        {
          provide: GlobalStateService,
          useValue: {
            onLoad: (run: () => void) => run(),
            loadedUnitRoles: {values: unitRoles$},
            loadedUnits: {values: units$},
            currentUserProjects: {values: projects$},
          },
        },
        {provide: UnitService, useValue: unitService},
        {provide: ProjectService, useValue: projectService},
        {provide: ActivatedRoute, useValue: {snapshot: {data: {mode}}}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(FUnitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function page(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): HTMLElement[] {
    return Array.from(page().querySelectorAll('tr.mat-mdc-row'));
  }

  beforeEach(() => {
    unitRoles$ = new BehaviorSubject<UnitRole[]>([]);
    units$ = new BehaviorSubject<Unit[]>([]);
    projects$ = new BehaviorSubject<Project[]>([]);
    allProjects = [];
    unitService = {query: vi.fn(() => of([]))};
    projectService = {
      // Stands in for the entity service, which fills the cache it is handed.
      query: vi.fn((_ids: unknown, options: {cache: EntityCache<Project>}) => {
        allProjects.forEach((project) => options.cache.add(project));
        return of(allProjects);
      }),
    };
  });

  describe('as a tutor', () => {
    beforeEach(async () => {
      await create('tutor');
    });

    it('titles the page for a tutor and links each unit code to its inbox', () => {
      unitRoles$.next([roleIn(11, unit(1, 'SIT374'), 'Convenor')]);

      expect(page().querySelector('h1')?.textContent).toContain('Units you teach');
      const [row] = rows();
      const link = row.querySelector('a');
      expect(link?.textContent).toContain('SIT374');
      expect(link?.getAttribute('href')).toBe('/units/1/tasks/inbox');
      // The row stays clickable but out of the tab order; the link is the keyboard way in.
      expect(row.getAttribute('tabindex')).toBe('-1');
      expect(row.textContent).toContain('Convenor');
    });

    // The Active column tested element.teachingPeriod, a field the rows never had, so a
    // unit whose teaching period had ended still showed as active.
    it('shows a unit whose teaching period is over as inactive', () => {
      const over = Object.assign(new TeachingPeriod(), {period: 'T1', year: '2026', active: false});
      unitRoles$.next([
        roleIn(11, unit(1, 'SIT374', {teachingPeriod: over})),
        roleIn(12, unit(2, 'SIT111')),
      ]);

      const [first, second] = rows();
      expect(first.textContent).toContain('Inactive');
      expect(second.textContent).toContain('Active');
      expect(second.textContent).not.toContain('Inactive');
      expect(page().textContent).toContain('2 units · 1 active');
    });

    // Each visit left a live subscription to the unit role cache behind, still writing
    // into the destroyed page's table.
    it('stops listening to the unit roles once the page is gone', () => {
      unitRoles$.next([roleIn(11, unit(1, 'SIT374'))]);
      fixture.destroy();

      unitRoles$.next([roleIn(11, unit(1, 'SIT374')), roleIn(12, unit(2, 'SIT111'))]);

      expect(component.dataSource.data.length).toBe(1);
    });

    it('tells a search with no match apart from an empty list', () => {
      unitRoles$.next([roleIn(11, unit(1, 'SIT374'))]);
      const input = page().querySelector('input') as HTMLInputElement;

      input.value = 'zzz';
      input.dispatchEvent(new Event('input'));

      expect(page().textContent).toContain('No units match your search');

      input.value = '374';
      input.dispatchEvent(new Event('input'));
      expect(rows().length).toBe(1);
    });

    it('sorts a missing date without breaking and text without regard to case', () => {
      const [row] = component.mapUnitOrProjectsToColumns([
        roleIn(11, unit(1, 'sit374', {startDate: undefined})),
      ]);

      expect(component.sortValue(row, 'start_date')).toBe(0);
      expect(component.sortValue(row, 'unit_code')).toBe('sit374');
      expect(component.sortValue({...row, unit_code: 'SIT374'}, 'unit_code')).toBe('sit374');
    });
  });

  describe('as a student', () => {
    // The page is reached from "View previous", but it only listed the active units the
    // global state had loaded, so a previous unit never appeared on it.
    it('lists earlier units as well as current ones', async () => {
      const current = unit(1, 'SIT374');
      const earlier = unit(2, 'SIT111', {active: false});
      projects$.next([projectIn(21, current)]);
      allProjects = [projectIn(21, current), projectIn(22, earlier)];

      await create('student');

      expect(projectService.query).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          params: {include_inactive: true, include_task_definitions: true},
        }),
      );
      const listed = rows();
      expect(listed.length).toBe(2);
      expect(listed.map((row) => row.querySelector('a')?.getAttribute('href'))).toEqual(
        expect.arrayContaining(['/projects/21/dashboard', '/projects/22/dashboard']),
      );
      expect(page().querySelector('th')?.textContent).not.toContain('Role');
    });

    // A student's own project gets its user later, so searching before then called
    // matches() on an undefined student and threw out of the table filter.
    it('searches a project that has no student yet without throwing', async () => {
      allProjects = [projectIn(21, unit(1, 'SIT374'))];
      await create('student');

      const [row] = component.dataSource.data;
      expect(() => row.matches('nothing like this')).not.toThrow();
      expect(row.matches('374')).toBe(true);
    });

    it('keeps the current units and offers a retry when the full list fails', async () => {
      projects$.next([projectIn(21, unit(1, 'SIT374'))]);
      projectService.query.mockReturnValueOnce(throwError(() => new Error('offline')));

      await create('student');

      expect(rows().length).toBe(1);
      const alert = page().querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Your earlier units could not be loaded');

      (alert?.querySelector('button') as HTMLButtonElement).click();
      expect(projectService.query).toHaveBeenCalledTimes(2);
      expect(page().querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('as an admin', () => {
    it('says it is loading, not that there are no units, while they are fetched', async () => {
      unitService.query.mockReturnValue(new Subject());
      await create('admin');

      expect(page().textContent).toContain('Loading units...');
      expect(page().textContent).not.toContain('No units yet');
    });

    it('offers the create button and routes rows to the unit admin page', async () => {
      units$.next([unit(1, 'SIT374')]);
      await create('admin');

      expect(page().querySelector('header button')?.textContent).toContain('Create unit');
      expect(rows()[0].querySelector('a')?.getAttribute('href')).toBe('/units/1/admin');
    });
  });
});

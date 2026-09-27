import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpErrorResponse} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap, provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {BehaviorSubject, Subject, of, throwError} from 'rxjs';
import {CourseFlowCourse, CourseFlowDraft, CourseFlowMap} from 'src/app/api/models/course-flow';
import {CourseFlowService} from 'src/app/api/services/course-flow.service';
import {courseFlowDirtyGuard} from './course-flow-dirty.guard';
import {CoursemapComponent} from './coursemap.component';

const course: CourseFlowCourse = {
  id: 7,
  code: 'DEMO',
  name: 'Example catalog',
  version: 'test-only',
  elective_count: 1,
  units: [
    {
      code: 'REQ1',
      name: 'First required',
      required: true,
      prerequisites: [],
      offered_trimesters: [1, 2, 3],
    },
    {
      code: 'REQ2',
      name: 'Second required',
      required: true,
      prerequisites: ['REQ1'],
      offered_trimesters: [2],
    },
    {
      code: 'ELEC1',
      name: 'First elective',
      required: false,
      prerequisites: [],
      offered_trimesters: [1, 2, 3],
    },
    {
      code: 'ELEC2',
      name: 'Second elective',
      required: false,
      prerequisites: [],
      offered_trimesters: [1, 2, 3],
    },
  ],
};
const otherCourse: CourseFlowCourse = {
  ...course,
  id: 8,
  code: 'OTHER',
  units: [],
  elective_count: 0,
};
const savedMap = (patch: Partial<CourseFlowMap> = {}): CourseFlowMap => ({
  id: 12,
  course_id: course.id,
  name: 'My saved plan',
  lock_version: 3,
  periods: [
    {year: 2026, trimester: 1},
    {year: 2026, trimester: 2},
  ],
  slots: [{unit_code: 'REQ1', year: 2026, trimester: 1, position: 3}],
  issues: [],
  complete: false,
  updated_at: '2026-09-22T00:00:00Z',
  ...patch,
});

function mockService() {
  return {
    getCourses: vi.fn().mockReturnValue(of([course, otherCourse])),
    getMaps: vi.fn().mockReturnValue(of([savedMap()])),
    getMap: vi.fn().mockImplementation((id: number) => of(savedMap({id}))),
    createMap: vi
      .fn()
      .mockImplementation((draft: CourseFlowDraft) =>
        of(savedMap({...draft, id: 55, lock_version: 0})),
      ),
    updateMap: vi
      .fn()
      .mockImplementation((id: number, draft: CourseFlowDraft, version: number) =>
        of(savedMap({...draft, id, lock_version: version + 1})),
      ),
    deleteMap: vi.fn().mockReturnValue(of(undefined)),
  };
}

describe('Course Flow account planning', () => {
  let fixture: ComponentFixture<CoursemapComponent>;
  let component: CoursemapComponent;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let service: ReturnType<typeof mockService>;
  let router: {navigate: ReturnType<typeof vi.fn>};
  let confirm: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({}));
    service = mockService();
    router = {navigate: vi.fn().mockResolvedValue(true)};
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await TestBed.configureTestingModule({
      imports: [CoursemapComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params,
            get snapshot() {
              return {paramMap: params.value};
            },
          },
        },
        {provide: Router, useValue: router},
        {provide: CourseFlowService, useValue: service},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CoursemapComponent);
    component = fixture.componentInstance;
  });
  afterEach(() => vi.restoreAllMocks());

  function start(): void {
    fixture.detectChanges();
    component.selectCourse(course.id);
    fixture.detectChanges();
  }
  function load(): void {
    params.next(convertToParamMap({courseMapId: '12'}));
    fixture.detectChanges();
  }
  async function choose(selector: string, value: string): Promise<void> {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(selector);
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads only authenticated catalog and own plans without creating records or choosing a course', () => {
    fixture.detectChanges();
    expect(service.getCourses).toHaveBeenCalledOnce();
    expect(service.getMaps).toHaveBeenCalledOnce();
    expect(service.getMap).not.toHaveBeenCalled();
    expect(service.createMap).not.toHaveBeenCalled();
    expect(component.selectedCourse).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('My saved plan');
    expect(fixture.nativeElement.querySelector('#course-select')).not.toBeNull();
  });

  it('shows an explicit empty catalog and makes no demo writes', () => {
    service.getCourses.mockReturnValue(of([]));
    service.getMaps.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No course catalogs are available');
    expect(fixture.nativeElement.textContent).toContain('You have no saved plans');
    expect(service.createMap).not.toHaveBeenCalled();
  });

  it('renders loading, cancels old reads on map navigation, and unsubscribes on destruction', () => {
    const first: Subject<CourseFlowMap> = new Subject();
    service.getMap.mockReturnValueOnce(first);
    load();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Loading');
    expect(first.observed).toBe(true);
    params.next(convertToParamMap({courseMapId: '13'}));
    fixture.detectChanges();
    expect(first.observed).toBe(false);
    expect(component.currentMap.id).toBe(13);
    fixture.destroy();
    params.next(convertToParamMap({courseMapId: '14'}));
    expect(service.getMap.mock.calls).toEqual([[12], [13]]);
  });

  it('reports an unavailable private map without displaying other saved content and retries', () => {
    service.getMap.mockReturnValueOnce(throwError(() => new HttpErrorResponse({status: 404})));
    load();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'does not belong to you',
    );
    expect(fixture.nativeElement.textContent).not.toContain('My saved plan');
    component.retryLoad();
    fixture.detectChanges();
    expect(component.currentMap.id).toBe(12);
    expect(component.loadError).toBe('');
  });

  it.each(['../1', '0', '-1', '9007199254740993'])(
    'rejects invalid map ID %s before requests',
    (id) => {
      params.next(convertToParamMap({courseMapId: id}));
      fixture.detectChanges();
      expect(component.loadError).toContain('Invalid');
      expect(service.getCourses).not.toHaveBeenCalled();
      expect(service.getMap).not.toHaveBeenCalled();
    },
  );

  it('restores the visible course selector when discarding changes is declined', async () => {
    fixture.detectChanges();
    await choose('#course-select', String(course.id));
    confirm.mockReturnValue(false);
    await choose('#course-select', String(otherCourse.id));
    expect(component.selectedCourse.id).toBe(course.id);
    expect(fixture.nativeElement.querySelector('#course-select').value).toBe(String(course.id));
    confirm.mockReturnValue(true);
    await choose('#course-select', String(otherCourse.id));
    expect(component.selectedCourse.id).toBe(otherCourse.id);
    expect(component.slots).toEqual([]);
    expect(component.requiredCount).toBe(0);
  });

  it('uses a valid initial period even after an invalid add-period draft and new-plan action', () => {
    start();
    component.periodYear = 2300;
    component.periodTrimester = 9;
    component.startNewPlan();
    component.selectCourse(course.id);
    expect(component.periods).toEqual([{year: new Date().getFullYear(), trimester: 1}]);
    component.periodYear = null;
    component.selectCourse(otherCourse.id);
    expect(component.periods[0].year).toBe(new Date().getFullYear());
  });

  it('supports native keyboard controls for placing, swapping and removing units', async () => {
    start();
    const year = component.periods[0].year;
    await choose('#placement-unit', 'REQ1');
    await choose('#placement-destination', `${year}-1-1`);
    const buttons = () =>
      Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons()
      .find((button) => button.textContent.trim() === 'Place or move unit')
      .click();
    fixture.detectChanges();
    expect(component.slots[0]).toEqual({unit_code: 'REQ1', year, trimester: 1, position: 1});
    expect(fixture.nativeElement.querySelector(`#slot-${year}-1-1`).textContent).toContain('REQ1');
    await choose('#placement-unit', 'ELEC1');
    await choose('#placement-destination', `${year}-1-2`);
    buttons()
      .find((button) => button.textContent.trim() === 'Place or move unit')
      .click();
    await choose('#placement-unit', 'REQ1');
    await choose('#placement-destination', `${year}-1-2`);
    buttons()
      .find((button) => button.textContent.trim() === 'Place or move unit')
      .click();
    fixture.detectChanges();
    expect(component.slotAt({year, trimester: 1}, 1).unit_code).toBe('ELEC1');
    expect(component.slotAt({year, trimester: 1}, 2).unit_code).toBe('REQ1');
    expect(component.plannedElectives).toBe(1);
    buttons()
      .find((button) => button.textContent.trim() === 'Remove selected unit')
      .click();
    fixture.detectChanges();
    expect(component.availableRequired.map((unit) => unit.code)).toContain('REQ1');
    expect(component.availableElectives.map((unit) => unit.code)).not.toContain('REQ1');
  });

  it('uses the same placement rules for drag/drop, rejects unknown units, and preserves occupied slots', () => {
    start();
    const period = component.periods[0];
    const drop = (code: string, target: object) =>
      component.drop({container: {data: target}, item: {data: code}} as Parameters<
        CoursemapComponent['drop']
      >[0]);
    drop('REQ1', {...period, position: 1, kind: 'slot'});
    drop('ELEC1', {...period, position: 1, kind: 'slot'});
    expect(component.actionError).toContain('empty slot');
    expect(component.slots.map((slot) => slot.unit_code)).toEqual(['REQ1']);
    drop('FOREIGN', {...period, position: 2, kind: 'slot'});
    expect(component.slots).toHaveLength(1);
    drop('REQ1', {...period, position: 2, kind: 'slot'});
    expect(component.slots[0].position).toBe(2);
    drop('REQ1', {kind: 'catalog'});
    expect(component.slots).toEqual([]);
    expect(component.availableRequired).toHaveLength(2);
  });

  it('removes periods with their slots, preserves empty periods, and prevents duplicate or invalid periods', () => {
    start();
    const first = component.periods[0];
    component.placeUnit('REQ1', first, 1);
    component.periodYear = first.year;
    component.periodTrimester = 2;
    component.addPeriod();
    component.addPeriod();
    expect(component.actionError).toContain('already');
    expect(component.periods).toHaveLength(2);
    component.removePeriod(first);
    expect(component.slots).toEqual([]);
    expect(component.availableRequired).toHaveLength(2);
    component.removePeriod(component.periods[0]);
    expect(component.periods).toHaveLength(1);
    component.periodYear = 2300;
    component.addPeriod();
    expect(component.actionError).toContain('2000 to 2200');
    component.save();
    expect(service.createMap.mock.calls[0][0].periods).toEqual([{year: first.year, trimester: 2}]);
    expect(service.createMap.mock.calls[0][0].slots).toEqual([]);
  });

  it('creates a named plan with course codes and explicit empty periods, then opens its saved URL', () => {
    start();
    const first = component.periods[0];
    component.name = '  My plan  ';
    component.placeUnit('REQ1', first, 3);
    component.periodYear = first.year + 1;
    component.periodTrimester = 3;
    component.addPeriod();
    component.save();
    expect(service.createMap).toHaveBeenCalledWith({
      course_id: 7,
      name: 'My plan',
      periods: [first, {year: first.year + 1, trimester: 3}],
      slots: [{unit_code: 'REQ1', ...first, position: 3}],
    });
    expect(component.currentMap.id).toBe(55);
    expect(component.dirty).toBe(false);
    expect(component.status).toContain('stored in your account');
    expect(router.navigate).toHaveBeenCalledWith(['/coursemap', 55], {replaceUrl: true});
  });

  it('loads exact saved positions and empty periods and updates with the returned lock version', async () => {
    load();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.periods).toEqual(savedMap().periods);
    expect(component.slotAt({year: 2026, trimester: 1}, 3).unit_code).toBe('REQ1');
    expect(fixture.nativeElement.querySelector('#course-select').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#course-select').value).toBe(String(course.id));
    component.name = 'Changed';
    component.save();
    expect(service.updateMap.mock.calls[0]).toEqual([
      12,
      {
        course_id: 7,
        name: 'Changed',
        periods: savedMap().periods,
        slots: savedMap().slots,
      },
      3,
    ]);
    expect(component.currentMap.lock_version).toBe(4);
    component.name = 'Changed again';
    component.save();
    expect(service.updateMap.mock.calls[1][2]).toBe(4);
  });

  it('blocks editing and navigation while saving and retains local work on a connection failure', () => {
    start();
    const pending: Subject<CourseFlowMap> = new Subject();
    service.createMap.mockReturnValue(pending);
    component.save();
    fixture.detectChanges();
    expect(component.saving).toBe(true);
    expect(component.canLeave()).toBe(false);
    expect(fixture.nativeElement.querySelector('.plan-details').disabled).toBe(true);
    const before = component.periods;
    component.addPeriod();
    component.startNewPlan();
    component.openMap(12);
    expect(component.periods).toBe(before);
    expect(router.navigate).not.toHaveBeenCalled();
    pending.error(new HttpErrorResponse({status: 0}));
    fixture.detectChanges();
    expect(component.dirty).toBe(true);
    expect(component.saving).toBe(false);
    expect(component.actionError).toContain('Your edits are still here');
  });

  it('keeps edits and recovery controls after conflicts and can save an independent copy', () => {
    load();
    service.updateMap.mockReturnValue(throwError(() => new HttpErrorResponse({status: 409})));
    component.name = 'My local edits';
    component.save();
    expect(component.conflict).toBe(true);
    expect(component.name).toBe('My local edits');
    expect(component.currentMap.lock_version).toBe(3);
    component.name = 'More local edits';
    component.nameChanged();
    component.placeUnit('ELEC1', component.periods[0], 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Save a copy',
    );
    confirm.mockReturnValue(false);
    component.reloadSaved();
    expect(service.getMap).toHaveBeenCalledOnce();
    component.save(true);
    expect(service.createMap.mock.calls[0][0].name).toBe('More local edits (copy)');
    expect(component.currentMap.id).toBe(55);
    expect(component.slots.some((slot) => slot.unit_code === 'ELEC1')).toBe(true);
    expect(component.conflict).toBe(false);
  });

  it('confirms deletion, uses optimistic locking and retains edits if delete conflicts', () => {
    load();
    component.name = 'Unsaved';
    confirm.mockReturnValue(false);
    component.deletePlan();
    expect(service.deleteMap).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    service.deleteMap.mockReturnValueOnce(throwError(() => new HttpErrorResponse({status: 409})));
    component.deletePlan();
    expect(service.deleteMap).toHaveBeenCalledWith(12, 3);
    expect(component.name).toBe('Unsaved');
    expect(component.conflict).toBe(true);
    component.deletePlan();
    expect(component.currentMap).toBeNull();
    expect(component.maps).toEqual([]);
    expect(component.dirty).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/coursemap']);
  });

  it('protects browser exit and new-plan changes, but allows leaving an unchanged saved plan', () => {
    load();
    expect(component.canLeave()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    component.name = 'Changed';
    confirm.mockReturnValue(false);
    component.startNewPlan();
    expect(component.currentMap.id).toBe(12);
    const event = new Event('beforeunload', {cancelable: true});
    component.beforeUnload(event as BeforeUnloadEvent);
    expect(event.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true);
    component.startNewPlan();
    expect(component.currentMap).toBeNull();
    expect(component.dirty).toBe(false);
  });

  it('shows prerequisite, availability and elective checks without blocking draft saves', () => {
    start();
    component.placeUnit('REQ2', component.periods[0], 1);
    expect(component.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'missing_required',
        'elective_count',
        'prerequisite',
        'unavailable_trimester',
      ]),
    );
    component.save();
    expect(service.createMap).toHaveBeenCalledOnce();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'They do not confirm graduation eligibility',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'REQ1 in an earlier study period than REQ2',
    );
  });

  it('rejects empty or oversized names without sending a request and accepts the 200-character bound', () => {
    start();
    component.name = ' ';
    component.save();
    component.name = 'x'.repeat(201);
    component.save();
    expect(service.createMap).not.toHaveBeenCalled();
    component.name = 'x'.repeat(200);
    component.save();
    expect(service.createMap).toHaveBeenCalledOnce();
  });
});

describe('Course Flow navigation guard with real Angular routing', () => {
  afterEach(() => vi.restoreAllMocks());

  it('protects path-parameter navigation between saved plans and route exit', async () => {
    const service = mockService();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {path: 'coursemap', component: CoursemapComponent, canDeactivate: [courseFlowDirtyGuard]},
          {
            path: 'coursemap/:courseMapId',
            component: CoursemapComponent,
            canDeactivate: [courseFlowDirtyGuard],
          },
        ]),
        {provide: CourseFlowService, useValue: service},
      ],
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const harness = await RouterTestingHarness.create('/coursemap/12');
    const component = harness.routeDebugElement.componentInstance as CoursemapComponent;
    component.name = 'Unsaved change';
    await harness.navigateByUrl('/coursemap/13');
    expect(TestBed.inject(Router).url).toBe('/coursemap/12');
    expect(service.getMap.mock.calls).toEqual([[12]]);
    await harness.navigateByUrl('/coursemap');
    expect(TestBed.inject(Router).url).toBe('/coursemap/12');
    confirm.mockReturnValue(true);
    await harness.navigateByUrl('/coursemap/13');
    expect(TestBed.inject(Router).url).toBe('/coursemap/13');
    expect(service.getMap.mock.calls).toEqual([[12], [13]]);
  });
});

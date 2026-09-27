import {Html5QrcodeScannerState} from 'html5-qrcode';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatSelectModule} from '@angular/material/select';
import {ActivatedRoute, ParamMap, Router, convertToParamMap} from '@angular/router';
import {BehaviorSubject, Subject, Subscription, of, throwError} from 'rxjs';
import {
  AuthenticationService,
  Project,
  ProjectService,
  Task,
  TaskCommentService,
  TaskService,
  Unit,
  UnitService,
  UserService,
} from 'src/app/api/models/doubtfire-model';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {DiscussedInClassReasonModalService} from 'src/app/common/modals/discussed-in-class-reason-modal/discussed-in-class-reason-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from '../index/global-state.service';
import {QrScanner, TutorDiscussionComponent, cameraProblemFrom} from './tutor-discussion.component';

/** Stands in for the camera scanner, so no spec ever touches a real camera. */
class FakeScanner implements QrScanner {
  state = Html5QrcodeScannerState.NOT_STARTED;
  onScan: (text: string) => void;
  start = vi.fn(
    async (_camera: unknown, _config: unknown, onScan: (text: string) => void): Promise<null> => {
      this.onScan = onScan;
      this.state = Html5QrcodeScannerState.SCANNING;
      return null;
    },
  );
  stop = vi.fn(async () => {
    this.state = Html5QrcodeScannerState.NOT_STARTED;
  });
  pause = vi.fn(() => {
    this.state = Html5QrcodeScannerState.PAUSED;
  });
  resume = vi.fn(() => {
    this.state = Html5QrcodeScannerState.SCANNING;
  });
  clear = vi.fn();
  getState = () => this.state;
  getRunningTrackSettings = () => ({deviceId: 'camera-1'}) as MediaTrackSettings;
}

function makeUnit(id = 1): Unit {
  return Object.assign(new Unit(), {id, code: `SIT${id}00`, name: 'Capstone', active: true});
}

function makeProject(unit: Unit, id: number, username: string): Project {
  const project = Object.assign(new Project(unit), {
    id,
    targetGrade: 0,
    staffNoteCount: 0,
    student: {username, name: `Student ${username}`, studentId: `22${id}`},
  });
  const task = Object.assign(new Task(project), {
    id: id * 10,
    status: 'discuss',
    definition: {id: 11, name: 'Pass task 1', abbreviation: 'P1', targetGrade: 0},
  });
  project.taskCache.add(task);
  return project;
}

describe('TutorDiscussionComponent', () => {
  let fixture: ComponentFixture<TutorDiscussionComponent>;
  let component: TutorDiscussionComponent;
  let scanner: FakeScanner;
  let unitParams: BehaviorSubject<ParamMap>;
  let query: BehaviorSubject<ParamMap>;
  let routeData: Record<string, unknown>;
  let unitService: {get: ReturnType<typeof vi.fn>};
  let projectService: {
    loadStudents: ReturnType<typeof vi.fn>;
    loadProject: ReturnType<typeof vi.fn>;
  };
  let alerts: {error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>};
  let createScanner: ReturnType<typeof vi.spyOn>;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let students: Project[];

  beforeEach(() => {
    scanner = new FakeScanner();
    unitParams = new BehaviorSubject(convertToParamMap({unitId: '1'}));
    query = new BehaviorSubject(convertToParamMap({}));
    routeData = {};
    const unit = makeUnit(1);
    students = [makeProject(unit, 5, 'ada'), makeProject(unit, 6, 'grace')];
    unitService = {get: vi.fn((ids: {id: number}) => of(makeUnit(ids.id)))};
    projectService = {
      loadStudents: vi.fn(() => of(students)),
      loadProject: vi.fn((id: number) => of(students.find((p) => p.id === id))),
    };
    alerts = {error: vi.fn(), success: vi.fn()};
    getUserMedia = vi.fn();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([])},
    });
    Object.defineProperty(window, 'isSecureContext', {configurable: true, value: true});

    createScanner = vi
      .spyOn(
        TutorDiscussionComponent.prototype as unknown as {createQrScanner: () => QrScanner},
        'createQrScanner',
      )
      .mockImplementation(() => scanner);
  });

  afterEach(() => {
    createScanner.mockRestore();
    delete (navigator as {mediaDevices?: unknown}).mediaDevices;
  });

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      declarations: [TutorDiscussionComponent],
      imports: [
        EmptyStateComponent,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatListModule,
        MatSelectModule,
      ],
      providers: [
        {provide: UnitService, useValue: unitService},
        {
          provide: AuthenticationService,
          useValue: {
            afterAuthCall: (callback: (result: boolean) => void) => {
              callback(true);
              return new Subscription();
            },
          },
        },
        {provide: UserService, useValue: {currentUser: {id: 1, systemRole: 'Tutor'}}},
        {provide: ProjectService, useValue: projectService},
        {provide: GradeService, useValue: {gradeLabel: () => 'Pass'}},
        {provide: Router, useValue: {navigateByUrl: vi.fn()}},
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {data: routeData, queryParamMap: convertToParamMap({})},
            parent: {paramMap: unitParams},
            queryParamMap: query,
          },
        },
        {provide: AlertService, useValue: alerts},
        {provide: ConfirmationModalService, useValue: {}},
        {provide: DiscussedInClassReasonModalService, useValue: {}},
        {provide: TaskCommentService, useValue: {}},
        {provide: TaskService, useValue: {}},
        {provide: MatDialog, useValue: {open: vi.fn()}},
        {provide: GlobalStateService, useValue: {loadedUnitRoles: {currentValues: []}}},
        {provide: DoubtfireConstants, useValue: {ExternalName: new BehaviorSubject('OnTrack')}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorDiscussionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }

  async function settle(): Promise<HTMLElement> {
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  // The scanner calls back from inside the Angular zone, so do the same here, or the page
  // would not wait for the work the scan starts.
  function scan(text: string): void {
    fixture.ngZone.run(() => scanner.onScan(text));
  }

  async function findByTyping(text: string): Promise<void> {
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[name="studentLookup"]',
    ) as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
    const find = button('Find student');
    expect(find.disabled).toBe(false);
    fixture.ngZone.run(() => find.click());
    await settle();
  }

  function button(label: string): HTMLButtonElement {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (candidate) => candidate.textContent.includes(label),
    ) as HTMLButtonElement;
  }

  // The page used to open the camera, and the browser's permission prompt, the moment it
  // loaded, behind a grey overlay with no explanation.
  it('explains itself and leaves the camera alone until the tutor chooses to scan', async () => {
    await create();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('h1')?.textContent).toContain('Discussion');
    expect(page.textContent).toContain("Scan a student's QR code");
    expect(createScanner).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();

    button('Start scanning').click();
    await settle();

    expect(scanner.start).toHaveBeenCalledWith(
      {facingMode: 'environment'},
      expect.objectContaining({fps: 10}),
      expect.any(Function),
      expect.any(Function),
    );
    expect(component.scanningQr).toBe(true);
  });

  it('says what to do when the camera permission is refused', async () => {
    await create();
    scanner.start.mockRejectedValueOnce(
      'Error getting userMedia, error = NotAllowedError: Permission denied',
    );

    button('Start scanning').click();
    const page = await settle();

    expect(component.scanningQr).toBe(false);
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Camera access is blocked');
    expect(button('Try the camera again')).toBeTruthy();
  });

  it('says so when the device has no camera', async () => {
    await create();
    scanner.start.mockRejectedValueOnce(
      new DOMException('Requested device not found', 'NotFoundError'),
    );

    button('Start scanning').click();
    const page = await settle();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('No camera found');
    // A way forward without a camera.
    expect(page.textContent).toContain('No camera? Find the student instead');
  });

  it('says when the browser cannot use a camera at all, and does not offer to scan', async () => {
    delete (navigator as {mediaDevices?: unknown}).mediaDevices;
    await create();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'This browser cannot use a camera here',
    );
    expect(button('Start scanning').disabled).toBe(true);
  });

  it('sorts camera errors into ones a tutor can act on', () => {
    expect(cameraProblemFrom('Error getting userMedia, error = NotAllowedError: x')).toBe('denied');
    expect(cameraProblemFrom(new DOMException('x', 'NotReadableError'))).toBe('busy');
    expect(cameraProblemFrom(new DOMException('x', 'OverconstrainedError'))).toBe('no-camera');
    expect(cameraProblemFrom('Camera streaming not supported by the browser.')).toBe('unsupported');
    expect(cameraProblemFrom(new Error('something else'))).toBe('failed');
  });

  it('opens the scanned student, then turns the camera off', async () => {
    await create();
    button('Start scanning').click();
    await settle();

    scan('https://ontrack.example/tutor-discussion?unitId=1&username=grace');
    const page = await settle();

    expect(projectService.loadProject).toHaveBeenCalledWith(6, expect.anything(), true);
    expect(component.project?.id).toBe(6);
    expect(component.scanningQr).toBe(false);
    expect(scanner.stop).toHaveBeenCalled();
    expect(page.querySelector('#discussion-student-heading')?.textContent).toContain(
      'Student grace',
    );
  });

  // A code carrying only a project id looked the student up by the username left over
  // from the last scan, so it opened the previous student again.
  it('opens a project id code by its project, not by the last student scanned', async () => {
    await create();
    button('Start scanning').click();
    await settle();
    scan('https://ontrack.example/tutor-discussion?unitId=1&username=ada');
    await settle();

    button('Scan next student').click();
    await settle();
    scan('https://ontrack.example/tutor-discussion?unitId=1&projectId=6');
    await settle();

    expect(component.project?.id).toBe(6);
  });

  it('keeps scanning and says why when a code is not a student code', async () => {
    await create();
    button('Start scanning').click();
    await settle();

    scan('just some text');
    const page = await settle();

    expect(component.scanningQr).toBe(true);
    expect(page.textContent).toContain("That QR code is not a student's code.");
    expect(projectService.loadStudents).not.toHaveBeenCalled();
  });

  it('shows why a student from a link could not be opened, without starting the camera', async () => {
    query.next(convertToParamMap({username: 'nobody'}));
    await create();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'That student is not enrolled in this unit.',
    );
    expect(createScanner).not.toHaveBeenCalled();
  });

  // loadStudents had no error handler, so a failed request left the promise unsettled
  // and the page stuck on its loading state.
  it('stops loading when the student list cannot be fetched', async () => {
    projectService.loadStudents.mockReturnValue(throwError(() => 'The server is unavailable'));
    query.next(convertToParamMap({username: 'ada'}));
    await create();

    expect(component.loadingStudentData).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The server is unavailable',
    );
  });

  it('labels the comments button and uses an icon the font has', async () => {
    query.next(convertToParamMap({username: 'ada'}));
    await create();

    const comments = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Show comments on Pass task 1"]',
    );
    expect(comments).toBeTruthy();
    // 'chat-bubble' is not a ligature in the icon font, so it rendered as the words.
    expect(comments?.querySelector('mat-icon')?.textContent.trim()).toMatch(/^chat_bubble/);
  });

  it('labels every task action with words, not only an icon', async () => {
    query.next(convertToParamMap({username: 'ada'}));
    await create();

    for (const label of ['Complete', 'Mark discussed', 'Fix and resubmit']) {
      expect(button(label)).toBeTruthy();
    }
  });

  // A tutorial with no stream, or no tutor yet, threw while the task list rendered.
  it('does not throw on a tutorial without a stream or a tutor', async () => {
    await create();
    component.unit = makeUnit(1);
    component.unit.tutorialsCache.add(
      Object.assign({key: 1, id: 1}, {tutorialStream: undefined, tutor: undefined}) as never,
    );

    expect(() =>
      component.currentUserTutorsInStream({abbreviation: 'L1', name: 'Lab'} as never),
    ).not.toThrow();
    expect(component.currentUserTutorsInStream({abbreviation: 'L1', name: 'Lab'} as never)).toBe(
      false,
    );
    expect(component.currentUserTutorsInStream(undefined)).toBe(false);
  });

  // The router keeps this page when only the unit in the url changes, so moving to
  // another unit's Discussion from the menu used to leave the last unit on screen.
  it('follows the unit in the url when the router reuses the page', async () => {
    query.next(convertToParamMap({username: 'ada'}));
    await create();
    expect(component.project?.id).toBe(5);

    // The router emits inside the Angular zone.
    fixture.ngZone.run(() => {
      query.next(convertToParamMap({}));
      unitParams.next(convertToParamMap({unitId: '2'}));
    });
    await settle();

    expect(component.project).toBeNull();
    expect(unitService.get).toHaveBeenLastCalledWith({id: 2});
    expect(component.unit?.id).toBe(2);
  });

  // A late answer for the previous unit's student replaced the page the tutor had moved
  // on to, so unit 2 showed unit 1's student with its marking buttons.
  it('drops a student that arrives after the tutor has moved to another unit', async () => {
    const late: Subject<Project> = new Subject();
    projectService.loadProject.mockReturnValue(late);
    query.next(convertToParamMap({username: 'ada'}));
    await create();

    fixture.ngZone.run(() => {
      query.next(convertToParamMap({}));
      unitParams.next(convertToParamMap({unitId: '2'}));
    });
    await settle();
    fixture.ngZone.run(() => late.next(students[0]));
    await settle();

    expect(component.project).toBeNull();
    expect(component.unit?.id).toBe(2);
  });

  // Stopping while the camera was coming up, with a remembered camera that then failed,
  // went on to ask for a second camera, and the late clean up of one start could wipe
  // the video of the next.
  it('does not start another camera after the tutor stops during start up', async () => {
    localStorage.setItem('HTML5_QRCODE_DATA', JSON.stringify({lastUsedCameraId: 'gone'}));
    let failStart: (reason: unknown) => void;
    scanner.start.mockImplementationOnce(
      () => new Promise((_resolve, reject) => (failStart = reject)),
    );
    await create();

    button('Start scanning').click();
    await settle();
    expect(component.cameraStarting).toBe(true);
    expect(button('Start scanning')).toBeUndefined();

    button('Stop scanning').click();
    fixture.ngZone.run(() => failStart(new DOMException('gone', 'NotFoundError')));
    await settle();

    expect(createScanner).toHaveBeenCalledTimes(1);
    expect(component.cameraStarting).toBe(false);
    expect(component.cameraProblem).toBeNull();
    expect(button('Start scanning').disabled).toBe(false);
    localStorage.removeItem('HTML5_QRCODE_DATA');
  });

  it('will not switch cameras while one is still starting', async () => {
    scanner.start.mockImplementationOnce(() => new Promise(() => undefined));
    await create();
    button('Start scanning').click();
    await settle();

    await component.switchCamera('camera-2');

    expect(createScanner).toHaveBeenCalledTimes(1);
  });

  // Once a student was open, the lookup and any camera message were hidden with the
  // start card, so a tutor with no camera could not open a second student.
  it('keeps the lookup and camera messages on the page once a student is open', async () => {
    query.next(convertToParamMap({username: 'ada'}));
    await create();
    scanner.start.mockRejectedValueOnce(new DOMException('x', 'NotFoundError'));

    button('Scan next student').click();
    const page = await settle();

    expect(component.project?.id).toBe(5);
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('No camera found');
    expect(button('Find student')).toBeTruthy();

    await findByTyping('226');
    expect(component.project?.id).toBe(6);
  });

  // The form's template was named #studentLookup, which shadowed the property of the same
  // name, so the field bound to the template and Find student never enabled.
  it('finds a student from what the tutor types', async () => {
    await create();

    await findByTyping('grace');

    expect(projectService.loadProject).toHaveBeenCalledWith(6, expect.anything(), true);
    expect(component.project?.id).toBe(6);
  });

  it('switches cameras only once when asked twice in a row', async () => {
    await create();
    button('Start scanning').click();
    await settle();
    const second = new FakeScanner();
    createScanner.mockImplementation(() => second);

    await Promise.all([component.switchCamera('camera-2'), component.switchCamera('camera-3')]);

    expect(createScanner).toHaveBeenCalledTimes(2);
    expect(second.start).toHaveBeenCalledTimes(1);
  });

  describe('check-in', () => {
    beforeEach(() => {
      routeData.attendance = true;
    });

    it('waits for a task before it offers to scan', async () => {
      await create();
      const page = fixture.nativeElement as HTMLElement;

      expect(page.querySelector('h1')?.textContent).toContain('Check-in');
      expect(page.textContent).toContain('Choose the task to check in before you scan.');
      expect(button('Start scanning').disabled).toBe(true);
    });

    it('turns away a code from another unit', async () => {
      await create();
      component.selectedTaskDefinition = {id: 11} as never;
      fixture.detectChanges();
      button('Start scanning').click();
      await settle();

      scan('https://ontrack.example/tutor-discussion?unitId=9&username=ada');
      const page = await settle();

      expect(page.textContent).toContain("That student's code is for a different unit.");
      expect(projectService.loadStudents).not.toHaveBeenCalled();
    });
  });
});

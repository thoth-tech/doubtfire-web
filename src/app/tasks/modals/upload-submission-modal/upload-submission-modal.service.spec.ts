import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ApplicationRef, NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatDialog, MatDialogModule, MatDialogRef, MatDialogState} from '@angular/material/dialog';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {BehaviorSubject, of} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {ProjectService} from 'src/app/api/services/project.service';
import {TaskService} from 'src/app/api/services/task.service';
import {UserService} from 'src/app/api/services/user.service';
import {FileUploaderComponent} from 'src/app/common/file-uploader/file-uploader.component';
import {AlertService} from 'src/app/common/services/alert.service';
import {EmojiService} from 'src/app/common/services/emoji.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {PrivacyPolicy} from 'src/app/config/privacy-policy/privacy-policy';
import {TaskUploadRequirementsComponent} from './task-upload-requirements/task-upload-requirements.component';
import {UploadSubmissionModalComponent} from './upload-submission-modal.component';
import {UploadSubmissionModalService} from './upload-submission-modal.service';

describe('UploadSubmissionModalService', () => {
  it('uses responsive geometry and a dirty-aware close predicate', () => {
    const open = vi.fn().mockReturnValue({afterClosed: () => of({value: {}})});
    const service = new UploadSubmissionModalService({open} as never, {error: vi.fn()} as never);
    const task = {
      isGroupTask: () => false,
      definition: {groupSet: {name: 'Team'}},
    } as unknown as Task;

    service.show(task, false);

    const config = open.mock.calls[0][1];
    expect(config.disableClose).toBe(false);
    expect(config.closeOnNavigation).toBe(true);
    expect(config.restoreFocus).toBe(true);
    expect(config.maxHeight).toContain('100dvh');
    expect(config.position).toBeUndefined();
    expect(
      config.closePredicate(undefined, undefined, {
        canClose: () => false,
      } as UploadSubmissionModalComponent),
    ).toBe(false);
  });
});

// These run the real dialog, close predicate and file uploader together, so a
// close the modal makes itself goes through the same guard a student's
// Escape or backdrop click does.
describe('UploadSubmissionModalService closing after an upload', () => {
  let task: Task;
  let alertService: {error: ReturnType<typeof vi.fn>; message: ReturnType<typeof vi.fn>};
  let confirm: ReturnType<typeof vi.spyOn>;

  const render = () => TestBed.inject(ApplicationRef).tick();
  const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')!;

  function respondToUploadWith(responseStatus: number, responseBody: string): void {
    class FakeRequest {
      upload: {onprogress?: (event: ProgressEvent) => void} = {};
      readyState = 0;
      status = responseStatus;
      responseText = responseBody;
      onreadystatechange?: () => void;
      open = vi.fn();
      setRequestHeader = vi.fn();
      abort = vi.fn();
      send = vi.fn(() => {
        this.readyState = 4;
        this.onreadystatechange?.();
      });
    }
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
  }

  async function openAndUpload() {
    const outcome: {value?: Task; rejected?: unknown} = {};
    TestBed.inject(UploadSubmissionModalService)
      .show(task, false)!
      .result.then(
        (value) => (outcome.value = value),
        (reason) => (outcome.rejected = reason),
      );
    const ref = TestBed.inject(MatDialog).openDialogs[0] as MatDialogRef<
      UploadSubmissionModalComponent,
      unknown
    >;
    render();

    const input = overlay().querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['evidence'], 'evidence.pdf', {type: 'application/pdf'})],
    });
    input.dispatchEvent(new Event('change'));
    render();

    ref.componentInstance.uploadButtonClicked();
    // The uploader handles the finished request in a microtask.
    await Promise.resolve();
    render();

    return {ref, outcome};
  }

  beforeEach(async () => {
    task = {
      status: 'ready_for_feedback',
      definition: {
        abbreviation: '1.1P',
        name: 'Hello World',
        uploadRequirements: [{key: 'file0', name: 'Task evidence', type: 'document'}],
        assessInPortfolioOnly: false,
      },
      project: {id: 1},
      unit: {id: 2},
      isGroupTask: () => false,
      inSubmittedState: () => false,
      submissionUrl: () => '/submission',
      testSubmissionUrl: () => '/test-submission',
      updateFromJson: vi.fn(),
      processTaskStatusChange: vi.fn(),
    } as unknown as Task;
    alertService = {error: vi.fn(), message: vi.fn()};
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, MatDialogModule],
      declarations: [
        UploadSubmissionModalComponent,
        FileUploaderComponent,
        TaskUploadRequirementsComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: TaskService,
          useValue: {
            submittableStatuses: ['ready_for_feedback'],
            statusLabels: new Map([['ready_for_feedback', 'Ready for feedback']]),
            mapping: {},
          },
        },
        {provide: ProjectService, useValue: {}},
        {provide: PrivacyPolicy, useValue: {privacy: '', plagiarism: ''}},
        {provide: AlertService, useValue: alertService},
        {provide: EmojiService, useValue: {nativeEmojiToColons: (value: string) => value}},
        {
          provide: UserService,
          useValue: {currentUser: {authenticationToken: 'token', username: 'demo_student'}},
        },
        {provide: DoubtfireConstants, useValue: {ExternalName: new BehaviorSubject('OnTrack')}},
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('closes on the submitted task once a successful upload completes', async () => {
    respondToUploadWith(201, JSON.stringify({id: 8, project_id: 1, status: 'ready_for_feedback'}));
    const {ref, outcome} = await openAndUpload();
    expect(overlay().textContent).toContain('Uploaded');

    // The redesign lets the student leave once the server has the submission, so
    // this only checks the dialog closes itself with the updated task.
    await vi.advanceTimersByTimeAsync(800);

    expect(task.processTaskStatusChange).toHaveBeenCalled();
    expect(ref.getState()).not.toBe(MatDialogState.OPEN);
    await vi.waitFor(() => expect(outcome.value).toBe(task));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('closes with an error when the server accepts the upload but returns no task', async () => {
    respondToUploadWith(200, '{}');
    const {ref, outcome} = await openAndUpload();

    expect(alertService.error).toHaveBeenCalled();
    expect(ref.getState()).not.toBe(MatDialogState.OPEN);
    await vi.waitFor(() => expect(outcome.value).toBe(task));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('lets the student cancel after a failed upload once they agree to discard the files', async () => {
    respondToUploadWith(503, JSON.stringify({error: 'Conversion service unavailable'}));
    const {ref, outcome} = await openAndUpload();
    expect(overlay().textContent).toContain('Upload failed');
    const cancel = Array.from(overlay().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    )!;

    cancel.click();
    expect(confirm).toHaveBeenCalledWith(
      'Discard the files and details selected for this submission?',
    );
    expect(ref.getState()).toBe(MatDialogState.OPEN);

    confirm.mockReturnValue(true);
    cancel.click();
    expect(ref.getState()).not.toBe(MatDialogState.OPEN);
    await vi.waitFor(() => expect(outcome.rejected).toEqual({dismissed: true}));
  });
});

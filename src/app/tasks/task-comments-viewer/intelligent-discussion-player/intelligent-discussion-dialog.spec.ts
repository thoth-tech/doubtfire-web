import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MatDialogRef} from '@angular/material/dialog';
import {Router} from '@angular/router';
import {Subject} from 'rxjs';
import {DiscussionComment, Task} from 'src/app/api/models/doubtfire-model';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {AppLifecycleService} from 'src/app/common/services/app-lifecycle.service';
import {IntelligentDiscussionDialog} from './intelligent-discussion-player.component';
import {IntelligentDiscussionPlayerService} from './intelligent-discussion-player.service';
import {IntelligentDiscussionRecorderComponent} from './intelligent-discussion-recorder/intelligent-discussion-recorder.component';

describe('IntelligentDiscussionDialog', () => {
  let lifecycle: AppLifecycleService;
  let visibilityState: DocumentVisibilityState;
  let originalVisibilityState: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = 'visible';
    originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    lifecycle = new AppLifecycleService(document, {
      events: new Subject<unknown>().asObservable(),
    } as unknown as Router);
    lifecycle.start();
  });

  afterEach(() => {
    lifecycle.ngOnDestroy();
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    } else {
      delete (document as Document & {visibilityState?: DocumentVisibilityState}).visibilityState;
    }
    vi.useRealTimers();
  });

  function hideApp(): void {
    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('keeps the prompt and the recording going when the window only loses focus', () => {
    const {dialog, audio, recorder} = setupDialog(lifecycle);
    startAndReachFirstPrompt(dialog);
    audio.pause.mockClear();

    window.dispatchEvent(new Event('blur'));

    expect(audio.pause).not.toHaveBeenCalled();
    expect(dialog.promptPlaying).toBe(true);
    expect(dialog.startedDiscussion).toBe(true);
    expect(recorder.stopRecording).not.toHaveBeenCalled();
    expect(recorder.cancelRecording).not.toHaveBeenCalled();
  });

  it('abandons a backgrounded discussion without submitting it and lets the student start again', () => {
    const {dialog, audio, recorder, discussion} = setupDialog(lifecycle);
    startAndReachFirstPrompt(dialog);

    hideApp();

    expect(recorder.stopRecording).not.toHaveBeenCalled();
    expect(recorder.cancelRecording).toHaveBeenCalled();
    expect(audio.pause).toHaveBeenCalled();
    expect(dialog.startedDiscussion).toBe(false);
    expect(dialog.inDiscussion).toBe(false);
    expect(dialog.promptPlaying).toBe(false);
    expect(dialog.responseRecording).toBe(false);
    expect(dialog.discussionComplete).toBe(false);
    expect(discussion.status).toBe('not_started');
    expect(dialog.discussionStatusTitle).toBe('Discussion interrupted');

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    startAndReachFirstPrompt(dialog);

    expect(recorder.startRecording).toHaveBeenCalledTimes(2);
    expect(dialog.activePromptId).toBe(0);
    expect(dialog.promptPlaying).toBe(true);
    expect(dialog.discussionStatusTitle).toBe('Listening to prompt 1');
  });

  it('abandons a discussion that is backgrounded during the countdown', () => {
    const {dialog, recorder} = setupDialog(lifecycle);
    dialog.startDiscussion();
    vi.advanceTimersByTime(1000);

    hideApp();
    vi.advanceTimersByTime(5000);

    expect(dialog.startedDiscussion).toBe(false);
    expect(dialog.countdownValue).toBeNull();
    expect(recorder.startRecording).not.toHaveBeenCalled();
  });

  it('ignores a prompt download that finishes after the discussion was abandoned', () => {
    const {dialog, audio, fileDownloader} = setupDialog(lifecycle, {deferDownloads: true});
    dialog.startDiscussion();
    vi.advanceTimersByTime(3000);
    const onDownloaded = fileDownloader.downloadBlob.mock.calls[0][1] as (url: string) => void;

    hideApp();
    onDownloaded('blob:late-prompt');

    expect(audio.play).not.toHaveBeenCalled();
    expect(dialog.promptPlaying).toBe(false);
    expect(fileDownloader.releaseBlob).toHaveBeenCalledWith('blob:late-prompt');
  });

  it('does not cancel the upload of a finished discussion', () => {
    const {dialog, recorder} = setupDialog(lifecycle);
    startAndReachFirstPrompt(dialog);
    dialog.finishDiscussion();

    hideApp();

    expect(recorder.stopRecording).toHaveBeenCalledOnce();
    expect(recorder.cancelRecording).not.toHaveBeenCalled();
    expect(dialog.discussionComplete).toBe(true);
  });
});

function startAndReachFirstPrompt(dialog: IntelligentDiscussionDialog): void {
  dialog.startDiscussion();
  vi.advanceTimersByTime(3000);
}

function setupDialog(lifecycle: AppLifecycleService, options: {deferDownloads?: boolean} = {}) {
  const audio = {
    src: '',
    currentTime: 0,
    paused: true,
    onended: null as (() => void) | null,
    load: vi.fn(),
    play: vi.fn(() => {
      audio.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      audio.paused = true;
    }),
  };
  const fileDownloader = {
    downloadBlob: vi.fn((url: string, onSuccess: (blobUrl: string) => void) => {
      if (!options.deferDownloads) {
        onSuccess(`blob:${url}`);
      }
    }),
    releaseBlob: vi.fn(),
  };
  const discussion = {
    id: 12,
    status: 'not_started',
    numberOfPrompts: 2,
    generateDiscussionPromptUrl: (promptNumber: number) => `/discussion/prompt/${promptNumber}`,
  };
  const dialog = new IntelligentDiscussionDialog(
    {close: vi.fn()} as unknown as MatDialogRef<IntelligentDiscussionDialog>,
    {} as IntelligentDiscussionPlayerService,
    fileDownloader as unknown as FileDownloaderService,
    {error: vi.fn()} as unknown as AlertService,
    lifecycle,
    {
      dc: discussion as unknown as DiscussionComment,
      task: {} as Task,
      audioRef: audio as unknown as HTMLAudioElement,
    },
  );
  const recorder = {
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
  };
  dialog.discussionRecorder = recorder as unknown as IntelligentDiscussionRecorderComponent;
  return {dialog, audio, recorder, fileDownloader, discussion};
}

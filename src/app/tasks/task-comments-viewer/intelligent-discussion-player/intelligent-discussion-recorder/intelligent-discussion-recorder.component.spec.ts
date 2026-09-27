import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ElementRef} from '@angular/core';
import {Subject, of} from 'rxjs';
import {DiscussionComment, TaskCommentService} from 'src/app/api/models/doubtfire-model';
import {AppLifecycleService, MediaPauseEvent} from 'src/app/common/services/app-lifecycle.service';
import {AudioPlaybackCoordinatorService} from 'src/app/common/services/audio-playback-coordinator.service';
import {MediaRecorderService} from 'src/app/common/services/recorder-service';
import {IntelligentDiscussionRecorderComponent} from './intelligent-discussion-recorder.component';

describe('IntelligentDiscussionRecorderComponent', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 5),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops the take without posting a reply when the app is backgrounded mid-answer', async () => {
    const {component, recorder, pauseEvents, taskCommentService} = setupRecorder();

    component.startRecording();
    await flushPromises();
    expect(component.isRecording).toBe(true);

    pauseEvents.next({reason: 'app-hidden', occurredAt: Date.now()});

    expect(recorder.stopRecording).not.toHaveBeenCalled();
    expect(recorder.cancelRecording).toHaveBeenCalledOnce();
    expect(taskCommentService.postDiscussionReply).not.toHaveBeenCalled();
    expect(component.isRecording).toBe(false);
    expect(component.isSending).toBe(false);
  });

  it('drops a take that is still waiting on microphone permission when the app is backgrounded', () => {
    const {component, recorder, pauseEvents, taskCommentService} = setupRecorder();
    recorder.startRecording.mockImplementation(() => new Promise<void>(() => undefined));

    component.startRecording();
    expect(component.isRequestingPermission).toBe(true);

    pauseEvents.next({reason: 'route-change', occurredAt: Date.now()});

    expect(recorder.cancelRecording).toHaveBeenCalledOnce();
    expect(component.isRequestingPermission).toBe(false);
    expect(taskCommentService.postDiscussionReply).not.toHaveBeenCalled();
  });

  it('still posts the whole take when the discussion is finished', async () => {
    const {component, recorder, taskCommentService} = setupRecorder();

    component.startRecording();
    await flushPromises();
    component.stopRecording();

    expect(recorder.stopRecording).toHaveBeenCalledOnce();
    expect(taskCommentService.postDiscussionReply).toHaveBeenCalledOnce();
  });
});

function setupRecorder() {
  const em = document.createDocumentFragment();
  const recorder = {
    state: 'inactive',
    config: {stopTracksAndCloseCtxWhenFinished: true, createAnalyserNode: true},
    em,
    analyserNode: {
      fftSize: 2048,
      frequencyBinCount: 8,
      getByteTimeDomainData: vi.fn(),
      getByteFrequencyData: vi.fn(),
    },
    startRecording: vi.fn(async () => {
      recorder.state = 'recording';
    }),
    // Mirrors MediaRecorderService: a stop always ends with the final clip.
    stopRecording: vi.fn(() => {
      recorder.state = 'inactive';
      em.dispatchEvent(
        new CustomEvent('recording', {
          detail: {recording: {blob: new Blob(['partial answer'], {type: 'audio/webm'})}},
        }),
      );
    }),
    cancelRecording: vi.fn(() => {
      recorder.state = 'inactive';
    }),
    processChunks: vi.fn(),
    dispose: vi.fn(),
  };
  const taskCommentService = {postDiscussionReply: vi.fn(() => of({}))};
  const pauseEvents: Subject<MediaPauseEvent> = new Subject();
  const component = new IntelligentDiscussionRecorderComponent(
    recorder as unknown as MediaRecorderService,
    taskCommentService as unknown as TaskCommentService,
    new AudioPlaybackCoordinatorService(),
    {
      registerMedia: vi.fn(() => vi.fn()),
      mediaPauseSubject: pauseEvents,
    } as unknown as AppLifecycleService,
  );
  const context = {clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: ''};
  component.canvasRef = {
    nativeElement: {
      clientWidth: 4,
      clientHeight: 72,
      width: 0,
      height: 0,
      getContext: () => context,
    },
  } as unknown as ElementRef<HTMLCanvasElement>;
  component.discussion = {id: 7} as DiscussionComment;
  component.init();
  return {component, recorder, pauseEvents, taskCommentService};
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

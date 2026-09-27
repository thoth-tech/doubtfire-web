import {DOCUMENT} from '@angular/common';
import {Inject, Injectable, OnDestroy} from '@angular/core';
import {NavigationStart, Router} from '@angular/router';
import {BehaviorSubject, Subject, Subscription, filter} from 'rxjs';

export type AppLifecycleState = 'active' | 'hidden';
export type MediaPauseReason = 'app-hidden' | 'route-change';

export interface MediaPauseEvent {
  reason: MediaPauseReason;
  occurredAt: number;
}

/**
 * One app-wide lifecycle contract for mobile/PWA features. Foregrounding only
 * publishes state; it deliberately does not navigate, reload, or resume media.
 *
 * Only real backgrounding counts as hidden: visibilitychange to hidden, pagehide
 * and freeze. A window blur is not, because a file picker, a microphone
 * permission prompt or a click into another window all blur a page the user is
 * still looking at, and pausing there cut recordings off mid-take.
 */
@Injectable({providedIn: 'root'})
export class AppLifecycleService implements OnDestroy {
  readonly stateSubject: BehaviorSubject<AppLifecycleState> = new BehaviorSubject(
    this.document.visibilityState === 'hidden' ? 'hidden' : 'active',
  );
  readonly mediaPauseSubject: Subject<MediaPauseEvent> = new Subject();

  private readonly registeredMedia: Set<HTMLMediaElement> = new Set();
  private routerSubscription?: Subscription;
  private started = false;

  private readonly visibilityChangeListener = () => {
    if (this.document.visibilityState === 'hidden') {
      this.markHiddenAndPause();
    } else {
      this.stateSubject.next('active');
    }
  };
  private readonly pageHideListener = () => this.markHiddenAndPause();
  private readonly pageShowListener = () => this.stateSubject.next('active');
  private readonly freezeListener = () => this.markHiddenAndPause();
  private readonly focusListener = () => {
    if (this.document.visibilityState !== 'hidden') {
      this.stateSubject.next('active');
    }
  };

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private router: Router,
  ) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.document.addEventListener('visibilitychange', this.visibilityChangeListener);
    this.document.addEventListener('freeze', this.freezeListener);
    window.addEventListener('pagehide', this.pageHideListener);
    window.addEventListener('pageshow', this.pageShowListener);
    window.addEventListener('focus', this.focusListener);
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => this.pauseMedia('route-change'));
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;

    this.document.removeEventListener('visibilitychange', this.visibilityChangeListener);
    this.document.removeEventListener('freeze', this.freezeListener);
    window.removeEventListener('pagehide', this.pageHideListener);
    window.removeEventListener('pageshow', this.pageShowListener);
    window.removeEventListener('focus', this.focusListener);
    this.routerSubscription?.unsubscribe();
    this.routerSubscription = undefined;
  }

  registerMedia(media: HTMLMediaElement): () => void {
    this.registeredMedia.add(media);
    return () => this.registeredMedia.delete(media);
  }

  ngOnDestroy(): void {
    this.stop();
    this.registeredMedia.clear();
    this.stateSubject.complete();
    this.mediaPauseSubject.complete();
  }

  private markHiddenAndPause(): void {
    this.stateSubject.next('hidden');
    this.pauseMedia('app-hidden');
  }

  private pauseMedia(reason: MediaPauseReason): void {
    const media: Set<HTMLMediaElement> = new Set([
      ...this.registeredMedia,
      ...Array.from(this.document.querySelectorAll<HTMLMediaElement>('audio, video')),
    ]);

    media.forEach((element) => {
      if (!element.paused) {
        element.pause();
      }
    });
    this.mediaPauseSubject.next({reason, occurredAt: Date.now()});
  }
}

import {DOCUMENT} from '@angular/common';
import {ApplicationRef, Inject, Injectable, OnDestroy} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SwUpdate} from '@angular/service-worker';
import {Subject, concat, delay, filter, from, interval, of, switchMap, take, takeUntil} from 'rxjs';

const APP_STABILITY_DELAY_MS = 10 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

@Injectable()
export class CheckForUpdateService implements OnDestroy {
  private readonly destroy$: Subject<void> = new Subject();

  constructor(
    appRef: ApplicationRef,
    private updates: SwUpdate,
    private snackBar: MatSnackBar,
    @Inject(DOCUMENT) private document: Document,
  ) {
    appRef.isStable
      .pipe(
        filter((isStable) => isStable),
        take(1),
        delay(APP_STABILITY_DELAY_MS),
        switchMap(() => concat(of(0), interval(UPDATE_CHECK_INTERVAL_MS))),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.checkForUpdate());

    this.updates.versionUpdates.pipe(takeUntil(this.destroy$)).subscribe((updateEvent) => {
      if (updateEvent.type !== 'VERSION_READY') {
        return;
      }

      const snackBarRef = this.snackBar.open(
        'A new version of OnTrack is ready. Reload to update now.',
        'Reload',
      );
      snackBarRef
        .onAction()
        .pipe(
          take(1),
          switchMap(() => from(this.updates.activateUpdate())),
          takeUntil(this.destroy$),
        )
        .subscribe(() => this.document.location.reload());
    });

    this.updates.unrecoverable.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const snackBarRef = this.snackBar.open(
        'This version of OnTrack can no longer run safely. Reload to recover.',
        'Reload',
      );
      snackBarRef
        .onAction()
        .pipe(take(1), takeUntil(this.destroy$))
        .subscribe(() => this.document.location.reload());
    });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public checkForUpdate(): void {
    if (this.updates.isEnabled) {
      void this.updates.checkForUpdate();
    }
  }
}

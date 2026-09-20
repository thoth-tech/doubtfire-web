import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ApplicationRef} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SwUpdate, UnrecoverableStateEvent, VersionEvent} from '@angular/service-worker';
import {Subject} from 'rxjs';
import {CheckForUpdateService} from './check-for-update.service';

const APP_STABILITY_DELAY_MS = 10 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

describe('CheckForUpdateService', () => {
  let service: CheckForUpdateService;
  let appIsStable: Subject<boolean>;
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let updateActions: Subject<void>[];
  let reload: ReturnType<typeof vi.fn>;
  let updates: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionEvent>;
    unrecoverable: Subject<UnrecoverableStateEvent>;
    checkForUpdate: ReturnType<typeof vi.fn>;
    activateUpdate: ReturnType<typeof vi.fn>;
  };
  let snackBar: {open: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    vi.useFakeTimers();
    appIsStable = new Subject<boolean>();
    versionUpdates = new Subject<VersionEvent>();
    unrecoverable = new Subject<UnrecoverableStateEvent>();
    updateActions = [];
    reload = vi.fn();
    updates = {
      isEnabled: true,
      versionUpdates,
      unrecoverable,
      checkForUpdate: vi.fn().mockResolvedValue(false),
      activateUpdate: vi.fn().mockResolvedValue(true),
    };
    snackBar = {
      open: vi.fn(() => {
        const action: Subject<void> = new Subject();
        updateActions.push(action);
        return {onAction: () => action};
      }),
    };

    service = new CheckForUpdateService(
      {isStable: appIsStable} as unknown as ApplicationRef,
      updates as unknown as SwUpdate,
      snackBar as unknown as MatSnackBar,
      {location: {reload}} as unknown as Document,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });

  it('checks after the app is stable for ten seconds and then every four hours', async () => {
    appIsStable.next(false);
    await vi.advanceTimersByTimeAsync(APP_STABILITY_DELAY_MS);
    expect(updates.checkForUpdate).not.toHaveBeenCalled();

    appIsStable.next(true);
    await vi.advanceTimersByTimeAsync(APP_STABILITY_DELAY_MS - 1);
    expect(updates.checkForUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not poll after the service is destroyed', async () => {
    appIsStable.next(true);
    await vi.advanceTimersByTimeAsync(APP_STABILITY_DELAY_MS);
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);

    service.ngOnDestroy();
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS * 2);

    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not check for updates when the service worker is disabled', async () => {
    updates.isEnabled = false;
    appIsStable.next(true);

    await vi.advanceTimersByTimeAsync(APP_STABILITY_DELAY_MS + UPDATE_CHECK_INTERVAL_MS);

    expect(updates.checkForUpdate).not.toHaveBeenCalled();
  });

  it('offers a reload for a ready version and reloads only after activation', async () => {
    let finishActivation: (activated: boolean) => void;
    updates.activateUpdate.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishActivation = resolve;
      }),
    );

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: {hash: 'old'},
      latestVersion: {hash: 'new'},
    });

    expect(snackBar.open).toHaveBeenCalledWith(
      'A new version of OnTrack is ready. Reload to update now.',
      'Reload',
    );

    updateActions[0].next();
    expect(updates.activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    finishActivation(true);
    await Promise.resolve();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ignores version events that are not ready to activate', () => {
    versionUpdates.next({type: 'VERSION_DETECTED', version: {hash: 'new'}});
    versionUpdates.next({type: 'NO_NEW_VERSION_DETECTED', version: {hash: 'current'}});
    versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: {hash: 'broken'},
      error: 'Download failed',
    });

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('offers a direct reload when the current version is unrecoverable', () => {
    unrecoverable.next({type: 'UNRECOVERABLE_STATE', reason: 'Cache is corrupt'});

    expect(snackBar.open).toHaveBeenCalledWith(
      'This version of OnTrack can no longer run safely. Reload to recover.',
      'Reload',
    );

    updateActions[0].next();

    expect(updates.activateUpdate).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

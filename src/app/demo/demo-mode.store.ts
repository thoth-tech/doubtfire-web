import {environment} from 'src/environments/environment';
import {Inject, Injectable, InjectionToken} from '@angular/core';
import {BehaviorSubject, Observable, distinctUntilChanged} from 'rxjs';

export const DEMO_MODE_STORAGE_KEY = 'ontrack_demo_mode_enabled';

export const DEMO_TOOLS_AVAILABLE: InjectionToken<boolean> = new InjectionToken(
  'DEMO_TOOLS_AVAILABLE',
  {
    providedIn: 'root',
    factory: () => environment.enableDemoTools === true && environment.production === false,
  },
);

@Injectable({providedIn: 'root'})
export class DemoModeStore {
  private readonly enabledSubject: BehaviorSubject<boolean>;

  readonly enabled$: Observable<boolean>;

  constructor(@Inject(DEMO_TOOLS_AVAILABLE) readonly available: boolean) {
    const enabled = available && this.readStoredValue();

    if (!available) {
      this.removeStoredValue();
    }

    this.enabledSubject = new BehaviorSubject(enabled);
    this.enabled$ = this.enabledSubject.asObservable().pipe(distinctUntilChanged());
  }

  get enabled(): boolean {
    return this.available && this.enabledSubject.value;
  }

  /**
   * Local development starts in the intentionally quiet state. Production and
   * builds without demo tools must always pass API data through unchanged.
   */
  get shouldMaskApiData(): boolean {
    return this.available && !this.enabled;
  }

  setEnabled(enabled: boolean): void {
    if (!this.available) {
      this.reset();
      return;
    }

    if (enabled) {
      this.writeStoredValue();
    } else {
      this.removeStoredValue();
    }

    this.enabledSubject.next(enabled);
  }

  reset(): void {
    this.removeStoredValue();
    this.enabledSubject.next(false);
  }

  private readStoredValue(): boolean {
    try {
      return globalThis.sessionStorage?.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeStoredValue(): void {
    try {
      globalThis.sessionStorage?.setItem(DEMO_MODE_STORAGE_KEY, 'true');
    } catch {
      // Storage can be unavailable in private or hardened browser contexts.
    }
  }

  private removeStoredValue(): void {
    try {
      globalThis.sessionStorage?.removeItem(DEMO_MODE_STORAGE_KEY);
    } catch {
      // The in-memory state still fails closed when storage is unavailable.
    }
  }
}

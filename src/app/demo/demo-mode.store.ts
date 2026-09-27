import {environment} from 'src/environments/environment';
import {Inject, Injectable, InjectionToken} from '@angular/core';
import {BehaviorSubject, Observable, distinctUntilChanged} from 'rxjs';

export const DEMO_MODE_STORAGE_KEY = 'ontrack_demo_mode_enabled';
export const DEMO_MEETING_LINKS_KEY = 'ontrack_demo_meeting_links';

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
  private scenarioId: string | null = null;
  private userId: number | null = null;

  readonly enabled$: Observable<boolean>;

  constructor(@Inject(DEMO_TOOLS_AVAILABLE) private readonly toolsEligible: boolean) {
    this.enabledSubject = new BehaviorSubject(false);
    this.enabled$ = this.enabledSubject.asObservable().pipe(distinctUntilChanged());
  }

  get available(): boolean {
    return this.toolsEligible && this.scenarioId !== null && this.userId !== null;
  }

  get enabled(): boolean {
    return this.available && this.enabledSubject.value;
  }

  configureScenario(scenarioId: string, userId: number): void {
    if (!this.toolsEligible) {
      return;
    }

    this.scenarioId = scenarioId;
    this.userId = userId;
    this.enabledSubject.next(this.readStoredValue());
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
    try {
      globalThis.sessionStorage?.removeItem(DEMO_MEETING_LINKS_KEY);
    } catch {
      // Hosted demo links are unavailable unless demo tools and mode are both enabled.
    }
    this.enabledSubject.next(false);
  }

  clearScenario(): void {
    this.reset();
    this.scenarioId = null;
    this.userId = null;
  }

  private readStoredValue(): boolean {
    try {
      return globalThis.sessionStorage?.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }

  private writeStoredValue(): void {
    try {
      globalThis.sessionStorage?.setItem(this.storageKey, 'true');
    } catch {
      // Storage can be unavailable in private or hardened browser contexts.
    }
  }

  private removeStoredValue(): void {
    try {
      if (this.scenarioId !== null && this.userId !== null) {
        globalThis.sessionStorage?.removeItem(this.storageKey);
      }
    } catch {
      // The in-memory state still fails closed when storage is unavailable.
    }
  }

  private get storageKey(): string {
    return `${DEMO_MODE_STORAGE_KEY}:${this.scenarioId}:uid${this.userId}`;
  }
}

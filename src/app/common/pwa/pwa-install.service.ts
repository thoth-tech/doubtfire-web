import {DOCUMENT, Injectable, NgZone, OnDestroy, computed, inject, signal} from '@angular/core';

export interface PwaBeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
  prompt(): Promise<void>;
}

export type PwaInstallResult = 'accepted' | 'dismissed' | 'unavailable' | 'error';

/** Retains browser install capability until an explicit user action consumes it. */
@Injectable({providedIn: 'root'})
export class PwaInstallService implements OnDestroy {
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly zone = inject(NgZone);
  private readonly deferredPrompt = signal<PwaBeforeInstallPromptEvent | null>(null);
  private readonly installedThisSession = signal(false);
  private readonly standalone = signal(false);
  private readonly installing = signal(false);
  private readonly message = signal('');
  private readonly displayModes: MediaQueryList[] = [];

  // A browser tab cannot reliably discover installations from previous visits.
  // Do not persist an installed flag: it would become stale after uninstalling.
  readonly isInstalled = computed(() => this.standalone() || this.installedThisSession());
  readonly isInstalling = this.installing.asReadonly();
  readonly installMessage = this.message.asReadonly();
  readonly canInstall = computed(
    () => !!this.deferredPrompt() && !this.isInstalled() && !this.installing(),
  );

  private readonly beforeInstallPrompt = (event: Event): void => {
    const prompt = event as PwaBeforeInstallPromptEvent;
    if (typeof prompt.prompt !== 'function') {
      return;
    }

    event.preventDefault();
    this.zone.run(() => {
      if (this.standalone()) {
        return;
      }

      // A fresh capability can also mean the user has since uninstalled the app.
      this.installedThisSession.set(false);
      this.deferredPrompt.set(prompt);
      this.message.set('');
    });
  };

  private readonly appInstalled = (): void => {
    this.zone.run(() => {
      this.installedThisSession.set(true);
      this.deferredPrompt.set(null);
      this.message.set('OnTrack is installed. Open it from your device’s app launcher.');
    });
  };

  private readonly displayModeChanged = (): void => {
    this.zone.run(() => {
      this.standalone.set(
        this.displayModes.some((mode) => mode.matches) ||
          !!(this.browser?.navigator as Navigator & {standalone?: boolean})?.standalone,
      );
      if (this.standalone()) {
        this.deferredPrompt.set(null);
        this.message.set('');
      }
    });
  };

  constructor() {
    if (!this.browser) {
      return;
    }

    if (typeof this.browser.matchMedia === 'function') {
      for (const mode of ['standalone', 'minimal-ui', 'window-controls-overlay']) {
        const query = this.browser.matchMedia(`(display-mode: ${mode})`);
        this.displayModes.push(query);
        if (typeof query.addEventListener === 'function') {
          query.addEventListener('change', this.displayModeChanged);
        } else {
          query.addListener?.(this.displayModeChanged);
        }
      }
    }

    this.displayModeChanged();
    this.browser.addEventListener('beforeinstallprompt', this.beforeInstallPrompt);
    this.browser.addEventListener('appinstalled', this.appInstalled);
  }

  /** Call directly from a click handler so prompt() retains browser user activation. */
  async install(): Promise<PwaInstallResult> {
    if (this.installing() || this.isInstalled()) {
      return 'unavailable';
    }

    const prompt = this.deferredPrompt();
    if (!prompt) {
      this.message.set('Use the instructions below to install from your browser’s menu.');
      return 'unavailable';
    }

    // Each event can only be used once, including after dismissal or failure.
    this.deferredPrompt.set(null);
    this.installing.set(true);
    this.message.set('');
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (!this.isInstalled()) {
        this.message.set(
          choice.outcome === 'accepted'
            ? 'Installation requested. Finish any steps shown by your browser.'
            : 'Installation cancelled. You can keep using OnTrack here or install from your browser’s menu later.',
        );
      }
      return choice.outcome;
    } catch {
      if (!this.isInstalled()) {
        this.message.set(
          'Your browser could not complete installation. Try its install menu, or reload this page to try again.',
        );
      }
      return 'error';
    } finally {
      this.installing.set(false);
    }
  }

  ngOnDestroy(): void {
    this.browser?.removeEventListener('beforeinstallprompt', this.beforeInstallPrompt);
    this.browser?.removeEventListener('appinstalled', this.appInstalled);
    for (const query of this.displayModes) {
      if (typeof query.removeEventListener === 'function') {
        query.removeEventListener('change', this.displayModeChanged);
      } else {
        query.removeListener?.(this.displayModeChanged);
      }
    }
  }
}

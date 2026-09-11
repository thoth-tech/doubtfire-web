import {Injectable, OnDestroy} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = 'ontrack_pwa_install_dismissed';
const PROMPT_DURATION = 10000;

@Injectable()
export class InstallPromptService implements OnDestroy {
  private beforeInstallPrompt: BeforeInstallPromptEvent | null = null;
  private readonly handleBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();

    this.beforeInstallPrompt = event as BeforeInstallPromptEvent;

    const snackBarRef = this._snackBar.open(
      'Install OnTrack for quicker access and notifications',
      'Install',
      {duration: PROMPT_DURATION},
    );

    snackBarRef.onAction().subscribe(() => {
      void this.showInstallPrompt();
    });

    snackBarRef.afterDismissed().subscribe(() => {
      this.rememberDismissal();
    });
  };

  constructor(private _snackBar: MatSnackBar) {
    if (window.localStorage.getItem(DISMISSED_KEY) === 'true' || this.isStandalone()) {
      return;
    }

    if (this.isIos()) {
      this.showIosPrompt();
      return;
    }

    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
  }

  private async showInstallPrompt(): Promise<void> {
    const prompt = this.beforeInstallPrompt;
    this.beforeInstallPrompt = null;

    if (!prompt) {
      return;
    }

    await prompt.prompt();
    await prompt.userChoice;
  }

  private showIosPrompt(): void {
    const snackBarRef = this._snackBar.open(
      'To install OnTrack: tap Share then "Add to Home Screen"',
      'Got it',
      {duration: PROMPT_DURATION},
    );

    snackBarRef.afterDismissed().subscribe(() => {
      this.rememberDismissal();
    });
  }

  private rememberDismissal(): void {
    window.localStorage.setItem(DISMISSED_KEY, 'true');
  }

  private isIos(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return (
      /iphone|ipad|ipod/.test(userAgent) ||
      (userAgent.includes('macintosh') && window.navigator.maxTouchPoints > 1)
    );
  }

  private isStandalone(): boolean {
    return (
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      ('standalone' in window.navigator &&
        (window.navigator as unknown as {standalone: boolean}).standalone)
    );
  }
}

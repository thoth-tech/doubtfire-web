import {A11yModule} from '@angular/cdk/a11y';
import {DOCUMENT} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {Subscription} from 'rxjs';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {resolveOnboardingTarget} from './student-onboarding-target';
import {OnboardingView, StudentOnboardingService} from './student-onboarding.service';
import {ONBOARDING_STEPS} from './student-onboarding.steps';

@Component({
  selector: 'f-student-onboarding',
  imports: [A11yModule, MatButtonModule],
  templateUrl: './student-onboarding.component.html',
  styleUrls: ['./student-onboarding.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class StudentOnboardingComponent implements OnInit, OnDestroy {
  @ViewChild('heading') heading?: ElementRef<HTMLElement>;
  readonly steps = ONBOARDING_STEPS;
  readonly guideUrl =
    'https://github.com/ontrack-features-t2-2026/github-guide/blob/main/docs/student-onboarding/student-guide.md';
  view: OnboardingView | null = null;
  target: HTMLElement | null = null;
  rect: DOMRect | null = null;
  private subscription?: Subscription;
  private observer?: MutationObserver;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private readonly onScroll = () => this.scheduleTargetRefresh();
  private targetTimer?: ReturnType<typeof setTimeout>;

  constructor(
    readonly onboarding: StudentOnboardingService,
    private globals: GlobalStateService,
    private changeDetector: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  get noUnits(): boolean {
    return this.globals.currentUserProjects.currentValues.length === 0;
  }
  get panelAtTop(): boolean {
    return !!this.rect && this.rect.top > this.document.defaultView.innerHeight / 2;
  }
  get step() {
    return this.steps[this.view?.index ?? 0];
  }
  get title(): string {
    switch (this.view?.panel) {
      case 'welcome':
        return 'Welcome to OnTrack';
      case 'skip':
        return 'Skip the tutorial?';
      case 'complete':
        return 'Tutorial complete';
      default:
        return this.step.title;
    }
  }

  ngOnInit(): void {
    this.subscription = this.onboarding.view$.subscribe((view) => {
      this.view = view;
      this.target = null;
      this.rect = null;
      clearTimeout(this.focusTimer);
      clearTimeout(this.targetTimer);
      this.targetTimer = undefined;
      if (view) {
        this.focusTimer = setTimeout(() => {
          this.heading?.nativeElement.focus();
          this.refreshTarget();
        });
      }
      this.changeDetector.markForCheck();
    });
    this.observer = new MutationObserver(() => this.scheduleTargetRefresh());
    this.observer.observe(this.document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'class', 'style'],
    });
    this.document.addEventListener('scroll', this.onScroll, true);
    this.onboarding.start();
  }

  @HostListener('window:resize')
  scheduleTargetRefresh(): void {
    if (this.targetTimer || this.view?.panel !== 'step') {
      return;
    }
    this.targetTimer = setTimeout(() => {
      this.targetTimer = undefined;
      this.refreshTarget();
    }, 50);
  }

  refreshTarget(): void {
    if (this.view?.panel !== 'step') {
      return;
    }
    this.target = resolveOnboardingTarget(this.document, this.step.target);
    const rect = this.target?.getBoundingClientRect();
    // No detached/offscreen highlight. The written fallback always remains usable.
    this.rect =
      rect &&
      rect.bottom > 0 &&
      rect.top < this.document.defaultView.innerHeight &&
      rect.right > 0 &&
      rect.left < this.document.defaultView.innerWidth
        ? rect
        : null;
    this.changeDetector.markForCheck();
  }

  findTarget(): void {
    this.refreshTarget();
    // Explicitly locating the control never activates it or changes a route/setting.
    this.target?.scrollIntoView({block: 'center', behavior: 'instant'});
    this.refreshTarget();
  }

  onEscape(event: Event): void {
    event.stopPropagation();
    this.onboarding.escape();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.observer?.disconnect();
    this.document.removeEventListener('scroll', this.onScroll, true);
    clearTimeout(this.focusTimer);
    clearTimeout(this.targetTimer);
  }
}

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {resolveOnboardingTarget} from './student-onboarding-target';
import {StudentOnboardingComponent} from './student-onboarding.component';
import {OnboardingView, StudentOnboardingService} from './student-onboarding.service';
import {ONBOARDING_STEPS} from './student-onboarding.steps';

function visibleTarget(name: string): HTMLElement {
  const target = document.createElement('button');
  target.dataset.onboardingTarget = name;
  target.textContent = 'Synthetic control';
  target.getBoundingClientRect = () => ({
    x: 20,
    y: 20,
    left: 20,
    top: 20,
    right: 100,
    bottom: 60,
    width: 80,
    height: 40,
    toJSON: () => ({}),
  });
  document.body.appendChild(target);
  return target;
}

describe('StudentOnboardingComponent', () => {
  let fixture: ComponentFixture<StudentOnboardingComponent>;
  let view: BehaviorSubject<OnboardingView | null>;
  let onboarding: {
    view$: BehaviorSubject<OnboardingView | null>;
    storageUnavailable: boolean;
    start: ReturnType<typeof vi.fn>;
    begin: ReturnType<typeof vi.fn>;
    next: ReturnType<typeof vi.fn>;
    back: ReturnType<typeof vi.fn>;
    requestSkip: ReturnType<typeof vi.fn>;
    cancelSkip: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
    finish: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    escape: ReturnType<typeof vi.fn>;
  };
  let targets: HTMLElement[];
  const buttons = () =>
    [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
  const click = (label: string) =>
    buttons()
      .find((button) => button.textContent.trim() === label)
      ?.click();
  const show = (panel: OnboardingView['panel'], index = 0, replay = false) => {
    view.next({panel, index, replay});
    fixture.detectChanges();
  };
  beforeEach(async () => {
    targets = [];
    view = new BehaviorSubject<OnboardingView | null>(null);
    onboarding = {
      view$: view,
      storageUnavailable: false,
      start: vi.fn(),
      begin: vi.fn(),
      next: vi.fn(),
      back: vi.fn(),
      requestSkip: vi.fn(),
      cancelSkip: vi.fn(),
      skip: vi.fn(),
      dismiss: vi.fn(),
      finish: vi.fn(),
      close: vi.fn(),
      escape: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [StudentOnboardingComponent],
      providers: [
        {provide: StudentOnboardingService, useValue: onboarding},
        {provide: GlobalStateService, useValue: {currentUserProjects: {currentValues: []}}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StudentOnboardingComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    targets.forEach((target) => target.remove());
    vi.restoreAllMocks();
  });

  it('starts integration once and names the welcome dialog using the approved copy', async () => {
    expect(onboarding.start).toHaveBeenCalledOnce();
    show('welcome');
    await new Promise((resolve) => setTimeout(resolve, 10));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="dialog"]').getAttribute('aria-labelledby'),
    ).toBe('onboarding-title');
    expect(fixture.nativeElement.textContent).toContain('Take a quick tour of the main areas');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('h2'));
    click('Start tutorial');
    expect(onboarding.begin).toHaveBeenCalledOnce();
  });
  it('offers Back, Next, Skip and Close in keyboard reading order without a modal step trap', () => {
    show('step');
    expect(
      buttons()
        .slice(0, 4)
        .map((button) => button.textContent.trim()),
    ).toEqual(['Back', 'Next', 'Skip for now', 'Close']);
    expect(buttons()[0].disabled).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[role="dialog"]').getAttribute('aria-modal'),
    ).toBeNull();
    click('Next');
    click('Skip for now');
    click('Close');
    expect(onboarding.next).toHaveBeenCalledOnce();
    expect(onboarding.requestSkip).toHaveBeenCalledOnce();
    expect(onboarding.close).toHaveBeenCalledOnce();
    show('step', 1);
    click('Back');
    expect(onboarding.back).toHaveBeenCalledOnce();
  });
  it('announces each exact step title and count, including missing-data fallbacks', () => {
    ONBOARDING_STEPS.forEach((step, index) => {
      show('step', index);
      expect(fixture.nativeElement.querySelector('[aria-live="polite"]').textContent).toContain(
        `Step ${index + 1} of 4: ${step.title}`,
      );
      expect(fixture.nativeElement.textContent).toContain(step.body);
      expect(fixture.nativeElement.textContent).toContain(step.fallback);
      expect(fixture.nativeElement.textContent).toContain('No current unit is available');
    });
  });
  it('exposes named confirmation, dismissal, completion and Escape controls', () => {
    show('skip');
    click('Go back');
    click('Skip tutorial');
    click('Do not show automatically again');
    expect(onboarding.cancelSkip).toHaveBeenCalledOnce();
    expect(onboarding.skip).toHaveBeenCalledOnce();
    expect(onboarding.dismiss).toHaveBeenCalledOnce();
    fixture.nativeElement
      .querySelector('section')
      .dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    expect(onboarding.escape).toHaveBeenCalledOnce();
    show('complete');
    click('Finish');
    expect(onboarding.finish).toHaveBeenCalledOnce();
  });
  it('hides dismissal during replay and explains a save failure', () => {
    onboarding.storageUnavailable = true;
    show('step', 0, true);
    expect(fixture.nativeElement.textContent).not.toContain('Do not show automatically again');
    expect(fixture.nativeElement.textContent).toContain('Progress could not be saved');
  });
  it('resolves all four stable targets and locating one never clicks it', () => {
    ONBOARDING_STEPS.forEach((step, index) => {
      const target = visibleTarget(step.target);
      targets.push(target);
      const clickSpy = vi.fn();
      target.addEventListener('click', clickSpy);
      target.scrollIntoView = vi.fn();
      show('step', index);
      fixture.componentInstance.refreshTarget();
      fixture.detectChanges();
      expect(fixture.componentInstance.target).toBe(target);
      expect(fixture.nativeElement.querySelector('.onboarding-highlight')).not.toBeNull();
      click(step.action);
      expect(target.scrollIntoView).toHaveBeenCalledOnce();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });
  it('recovers when a delayed target appears and removes the highlight when it disappears', () => {
    show('step', 2);
    fixture.componentInstance.refreshTarget();
    expect(fixture.componentInstance.target).toBeNull();
    const target = visibleTarget('target-grade');
    targets.push(target);
    fixture.componentInstance.refreshTarget();
    expect(fixture.componentInstance.target).toBe(target);
    target.remove();
    fixture.componentInstance.refreshTarget();
    expect(fixture.componentInstance.rect).toBeNull();
  });
});

describe('stable onboarding target visibility', () => {
  let targets: HTMLElement[];
  beforeEach(() => {
    targets = [];
  });
  afterEach(() => targets.forEach((target) => target.remove()));
  it('rejects selectors and ignores hidden targets, choosing the visible menu entry', () => {
    const hidden = visibleTarget('calendar');
    targets.push(hidden);
    hidden.hidden = true;
    const visible = visibleTarget('calendar');
    targets.push(visible);
    expect(resolveOnboardingTarget(document, 'calendar')).toBe(visible);
    expect(resolveOnboardingTarget(document, 'calendar"] button')).toBeNull();
    visible.style.visibility = 'hidden';
    expect(resolveOnboardingTarget(document, 'calendar')).toBeNull();
  });
  it('ignores inert or aria-hidden ancestors and zero-size controls', () => {
    const target = visibleTarget('unit-selector');
    targets.push(target);
    target.setAttribute('aria-hidden', 'true');
    expect(resolveOnboardingTarget(document, 'unit-selector')).toBeNull();
    target.removeAttribute('aria-hidden');
    target.setAttribute('inert', '');
    expect(resolveOnboardingTarget(document, 'unit-selector')).toBeNull();
    target.removeAttribute('inert');
    target.getBoundingClientRect = () => new DOMRect();
    expect(resolveOnboardingTarget(document, 'unit-selector')).toBeNull();
  });
});

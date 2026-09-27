import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {GlobalStateService, StartupState} from 'src/app/projects/states/index/global-state.service';
import {SplashScreenComponent} from './splash-screen.component';

describe('SplashScreenComponent', () => {
  let fixture: ComponentFixture<SplashScreenComponent>;
  let startupState: BehaviorSubject<StartupState>;
  let globalState: {
    startupStateSubject: BehaviorSubject<StartupState>;
    retryStartup: ReturnType<typeof vi.fn>;
    continueToSignIn: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    startupState = new BehaviorSubject<StartupState>({
      status: 'loading',
      phase: 'authentication',
      message: 'Checking your session…',
      attempt: 1,
      startedAt: Date.now(),
    });
    globalState = {
      startupStateSubject: startupState,
      retryStartup: vi.fn(),
      continueToSignIn: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [SplashScreenComponent],
      providers: [{provide: GlobalStateService, useValue: globalState}],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SplashScreenComponent);
    fixture.detectChanges();
  });

  it('uses the full-screen logo only while authentication is active', () => {
    expect(
      fixture.nativeElement.querySelector('[data-testid="startup-auth-loading"]'),
    ).toBeTruthy();

    startupState.next({
      status: 'loading',
      phase: 'units-and-projects',
      message: 'Loading your units…',
      attempt: 1,
      startedAt: Date.now(),
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="startup-auth-loading"]')).toBeFalsy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="startup-data-loading"]'),
    ).toBeTruthy();
  });

  it('draws the mark, the wordmark and the current status while signing in', () => {
    const splash = fixture.nativeElement.querySelector('[data-testid="startup-auth-loading"]');
    const mark = splash.querySelector('[data-testid="startup-mark"]');

    expect(splash.getAttribute('role')).toBe('status');
    expect(splash.getAttribute('aria-live')).toBe('polite');
    expect(mark.querySelectorAll('svg path')).toHaveLength(3);
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(splash.querySelector('[data-testid="startup-wordmark"]').textContent.trim()).toBe(
      'OnTrack',
    );
    expect(splash.querySelector('[data-testid="startup-status"]').textContent.trim()).toBe(
      'Checking your session…',
    );
    expect(splash.querySelector('img')).toBeFalsy();
  });

  it('swaps the status text in place when the message changes', () => {
    startupState.next({
      status: 'loading',
      phase: 'authentication',
      message: 'Still checking your session…',
      attempt: 2,
      startedAt: Date.now(),
    });
    fixture.detectChanges();

    const statuses = fixture.nativeElement.querySelectorAll('[data-testid="startup-status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].textContent.trim()).toBe('Still checking your session…');
  });

  it('shows a thin progress line with the message as a caption while data loads', () => {
    startupState.next({
      status: 'loading',
      phase: 'units-and-projects',
      message: 'Loading your units…',
      attempt: 1,
      startedAt: Date.now(),
    });
    fixture.detectChanges();

    const progress = fixture.nativeElement.querySelector('[data-testid="startup-data-loading"]');
    expect(progress.getAttribute('role')).toBe('status');
    expect(progress.getAttribute('aria-live')).toBe('polite');
    expect(progress.querySelector('.startup-progress-track span')).toBeTruthy();
    expect(progress.querySelector('.startup-progress-caption').textContent.trim()).toBe(
      'Loading your units…',
    );
  });

  it('renders a terminal recovery action instead of an indefinite logo', () => {
    startupState.next({
      status: 'error',
      phase: 'authentication',
      message: 'OnTrack could not finish starting. Please try again.',
      attempt: 1,
      startedAt: Date.now(),
      elapsedMs: 12_000,
    });
    fixture.detectChanges();

    const recovery = fixture.nativeElement.querySelector('[data-testid="startup-recovery"]');
    const buttons = Array.from(recovery.querySelectorAll('button')) as HTMLButtonElement[];
    expect(recovery.textContent).toContain('OnTrack couldn’t finish loading');
    expect(buttons.map((button) => button.textContent.trim())).toEqual([
      'Try again',
      'Go to sign in',
    ]);

    buttons[0].click();
    expect(globalState.retryStartup).toHaveBeenCalledOnce();
  });
});

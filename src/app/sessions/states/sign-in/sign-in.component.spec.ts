import {beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpClient} from '@angular/common/http';
import {Directive, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {GlobalStateService} from 'src/app/projects/states/index/global-state.service';
import {AuthReturnUrlService} from 'src/app/security/auth-return-url.service';
import {SignInComponent} from './sign-in.component';

describe('SignInComponent', () => {
  let component: SignInComponent;
  let fixture: ComponentFixture<SignInComponent>;
  let afterAuthCallback: ((result: boolean) => void) | undefined;
  let router: {navigateByUrl: ReturnType<typeof vi.fn>};
  let authReturnUrl: {consume: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn>};
  let userService: {currentUser: {hasRunFirstTimeSetup: boolean; ltik?: string}};
  let globalState: {
    goHome: ReturnType<typeof vi.fn>;
    hideHeader: ReturnType<typeof vi.fn>;
    onLoad: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    afterAuthCallback = undefined;
    router = {navigateByUrl: vi.fn().mockResolvedValue(true)};
    authReturnUrl = {consume: vi.fn().mockReturnValue(null), clear: vi.fn()};
    userService = {currentUser: {hasRunFirstTimeSetup: true}};
    globalState = {
      goHome: vi.fn(),
      hideHeader: vi.fn(),
      onLoad: vi.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [SignInComponent],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            afterAuthCall: vi.fn((callback: (result: boolean) => void) => {
              afterAuthCallback = callback;
            }),
            signIn: vi.fn().mockReturnValue(of(void 0)),
            rememberMe: true,
          },
        },
        {provide: UserService, useValue: userService},
        {provide: Router, useValue: router},
        {provide: DoubtfireConstants, useValue: {}},
        {provide: HttpClient, useValue: {}},
        {provide: GlobalStateService, useValue: globalState},
        {provide: AlertService, useValue: {error: vi.fn()}},
        {provide: AuthReturnUrlService, useValue: authReturnUrl},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SignInComponent, {set: {template: ''}})
      .compileComponents();

    fixture = TestBed.createComponent(SignInComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('returns a database login to the protected notification destination', () => {
    const target = '/projects/2/dashboard/1.1P/feedback';
    authReturnUrl.consume.mockReturnValue(target);

    component.signIn({username: 'student', password: 'password', remember: true, autoLogin: false});

    expect(globalState.goHome).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith(target);
  });

  it('uses the same destination after an authentication callback', () => {
    const target = '/projects/2/dashboard/1.1P/feedback';
    authReturnUrl.consume.mockReturnValue(target);
    fixture.detectChanges();

    afterAuthCallback?.(true);

    expect(router.navigateByUrl).toHaveBeenCalledWith(target);
  });

  it('does not let a second authentication observer replace the destination with home', () => {
    const target = '/projects/2/dashboard/1.1P/feedback';
    authReturnUrl.consume.mockReturnValue(target);
    fixture.detectChanges();

    component.signIn({username: 'student', password: 'password', remember: true, autoLogin: false});
    afterAuthCallback?.(true);

    expect(authReturnUrl.consume).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith(target);
  });

  it('falls back to home when there is no pending destination', () => {
    component.signIn({username: 'student', password: 'password', remember: true, autoLogin: false});

    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('keeps mandatory first-time setup ahead of a pending destination', () => {
    userService.currentUser.hasRunFirstTimeSetup = false;
    authReturnUrl.consume.mockReturnValue('/projects/2/dashboard/1.1P/feedback');

    component.signIn({username: 'student', password: 'password', remember: true, autoLogin: false});

    expect(router.navigateByUrl).toHaveBeenCalledWith('/welcome');
    expect(authReturnUrl.clear).toHaveBeenCalledOnce();
    expect(authReturnUrl.consume).not.toHaveBeenCalled();
  });

  it('keeps LTI routing ahead of and clears a pending destination', () => {
    component.isLtiLogin = true;
    component.ltik = 'launch-token';
    authReturnUrl.consume.mockReturnValue('/projects/2/dashboard/1.1P/feedback');

    component.signIn({username: 'student', password: 'password', remember: true, autoLogin: false});

    expect(globalState.hideHeader).toHaveBeenCalledOnce();
    expect(userService.currentUser.ltik).toBe('launch-token');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/lti');
    expect(authReturnUrl.clear).toHaveBeenCalledOnce();
    expect(authReturnUrl.consume).not.toHaveBeenCalled();
  });
});

// A11Y-FORM06: WCAG 1.3.5 Identify Input Purpose (AA).
// Renders the real sign-in template and asserts the two credential inputs
// declare their autocomplete purpose token, so browser autofill and password
// managers reliably offer the stored credential. Standing in for the whole
// Material/Forms stack, StubNgForm satisfies `#form="ngForm"` while
// NO_ERRORS_SCHEMA lets the unknown mat-* elements render as plain markup, so
// the static autocomplete attribute is what we assert on.
@Directive({selector: 'form', exportAs: 'ngForm', standalone: false})
class StubNgFormSignIn {
  public invalid = false;
}

describe('SignInComponent autocomplete purpose (A11Y-FORM06)', () => {
  let fixture: ComponentFixture<SignInComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SignInComponent, StubNgFormSignIn],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            afterAuthCall: vi.fn(),
            signIn: vi.fn().mockReturnValue(of(void 0)),
            rememberMe: false,
          },
        },
        {provide: UserService, useValue: {currentUser: {hasRunFirstTimeSetup: true}}},
        {provide: Router, useValue: {navigateByUrl: vi.fn()}},
        {provide: DoubtfireConstants, useValue: {}},
        {provide: HttpClient, useValue: {}},
        {
          provide: GlobalStateService,
          useValue: {goHome: vi.fn(), hideHeader: vi.fn(), onLoad: vi.fn()},
        },
        {provide: AlertService, useValue: {error: vi.fn()}},
        {provide: AuthReturnUrlService, useValue: {consume: vi.fn(), clear: vi.fn()}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SignInComponent);
    const component = fixture.componentInstance;
    // Reveal the credential fields (both guarded behind @if in the template).
    component.isLoading = false;
    component.showCredentials = true;
    component.externalName = new BehaviorSubject<string>('OnTrack');
    component.formData = {username: '', password: '', remember: false, autoLogin: false};
    fixture.detectChanges();
  });

  const input = (name: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`input[name="${name}"]`);

  it('declares autocomplete="username" on the sign-in username field', () => {
    const username = input('username');
    expect(username).toBeTruthy();
    expect(username?.getAttribute('autocomplete')).toBe('username');
  });

  it('declares autocomplete="current-password" on the sign-in password field', () => {
    const password = input('password');
    expect(password).toBeTruthy();
    expect(password?.getAttribute('autocomplete')).toBe('current-password');
  });

  // Failure path: the fix must be scoped to the credential inputs. The
  // "stay logged in" control is not a fillable text field and must not be
  // handed a purpose token.
  it('does not put an autocomplete purpose token on the non-credential controls', () => {
    const remember = fixture.nativeElement.querySelector('[name="remember"]');
    expect(remember?.getAttribute('autocomplete') ?? null).toBeNull();
  });
});

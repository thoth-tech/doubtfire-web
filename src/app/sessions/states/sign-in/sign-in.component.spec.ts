import {beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpClient} from '@angular/common/http';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {of} from 'rxjs';
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

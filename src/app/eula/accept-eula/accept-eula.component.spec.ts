import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {BehaviorSubject, Subscription, of} from 'rxjs';
import {UserService} from 'src/app/api/models/doubtfire-model';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {TiiService} from 'src/app/api/services/tii.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {AcceptEulaComponent} from './accept-eula.component';

const emptyProvider = {};

describe('AcceptEulaComponent', () => {
  let component: AcceptEulaComponent;
  let fixture: ComponentFixture<AcceptEulaComponent>;
  let afterAuthCallback: ((authenticated: boolean) => void) | undefined;
  let authenticationSubscription: Subscription;
  let tiiEnabled: BehaviorSubject<boolean>;
  let tiiService: {getTiiEula: ReturnType<typeof vi.fn>};
  let router: {navigateByUrl: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    afterAuthCallback = undefined;
    authenticationSubscription = new Subscription();
    tiiEnabled = new BehaviorSubject<boolean>(false);
    tiiService = {getTiiEula: vi.fn().mockReturnValue(of('<p>EULA</p>'))};
    router = {navigateByUrl: vi.fn()};

    await TestBed.configureTestingModule({
      declarations: [AcceptEulaComponent],
      providers: [
        {
          provide: DoubtfireConstants,
          useValue: {
            ExternalName: of('OnTrack'),
            IsTiiEnabled: tiiEnabled,
          },
        },
        {
          provide: AuthenticationService,
          useValue: {
            afterAuthCall: vi.fn((callback: (authenticated: boolean) => void) => {
              afterAuthCallback = callback;
              return authenticationSubscription;
            }),
          },
        },
        {provide: TiiService, useValue: tiiService},
        {provide: UserService, useValue: emptyProvider},
        {provide: AlertService, useValue: emptyProvider},
        {provide: Router, useValue: router},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(AcceptEulaComponent, {set: {template: ''}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AcceptEulaComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not treat the pre-authentication TurnItIn default as a disabled feature', () => {
    expect(afterAuthCallback).toBeDefined();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(tiiService.getTiiEula).not.toHaveBeenCalled();
  });

  it('loads the EULA after authenticated settings enable TurnItIn', () => {
    tiiEnabled.next(true);

    afterAuthCallback?.(true);

    expect(tiiService.getTiiEula).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('redirects after authenticated settings disable TurnItIn', () => {
    afterAuthCallback?.(true);

    expect(tiiService.getTiiEula).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('stops waiting for authentication when the component is destroyed', () => {
    const unsubscribe = vi.spyOn(authenticationSubscription, 'unsubscribe');

    fixture.destroy();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

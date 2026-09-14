import {beforeEach, describe, expect, it} from 'vitest';
import {Directive, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';
import {of} from 'rxjs';
import {User} from 'src/app/api/models/user/user';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {PushNotificationService} from 'src/app/api/services/push-notification.service';
import {UserService} from 'src/app/api/services/user.service';
import {NotificationSettingsComponent} from 'src/app/common/notification-settings/notification-settings.component';
import {DoubtfireConstants} from 'src/app/config/constants/doubtfire-constants';
import {EditProfileFormComponent} from './edit-profile-form.component';

const emptyProvider = {};

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    systemRole: 'Student',
    hasRunFirstTimeSetup: true,
    optInToResearch: true,
    receiveFeedbackNotifications: false,
    receivePortfolioNotifications: false,
    receiveTaskNotifications: false,
    displayPeerProgress: true,
    ...overrides,
  }) as User;

// The component subscribes to this in ngOnInit. Stubbed here rather than
// providing the real service, which would pull in SwPush and the whole service
// worker with it.
const pushServiceStub = {
  subscription$: of(null),
  isEnabled: false,
  blocker: (): 'no-service-worker' | 'permission-denied' => 'no-service-worker',
  permissionDeniedInstructions: (): string[] => [],
};

describe('EditProfileFormComponent', () => {
  let component: EditProfileFormComponent;
  let fixture: ComponentFixture<EditProfileFormComponent>;
  let userServiceStub: {currentUser: User};
  let dialogData: {
    user: User;
    mode: 'edit' | 'create' | 'new';
    modal: boolean;
  };

  const createComponent = (): void => {
    fixture = TestBed.createComponent(EditProfileFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    pushServiceStub.blocker = () => 'no-service-worker';
    pushServiceStub.permissionDeniedInstructions = () => [];

    const currentUser = makeUser();

    userServiceStub = {
      currentUser,
    };
    dialogData = {
      user: currentUser,
      mode: 'edit',
      modal: false,
    };

    await TestBed.configureTestingModule({
      declarations: [EditProfileFormComponent],
      providers: [
        {provide: DoubtfireConstants, useValue: emptyProvider},
        {provide: UserService, useValue: userServiceStub},
        {provide: Router, useValue: emptyProvider},
        {provide: AuthenticationService, useValue: emptyProvider},
        {provide: MAT_DIALOG_DATA, useValue: dialogData},
        {provide: MatSnackBar, useValue: emptyProvider},
        {provide: PushNotificationService, useValue: pushServiceStub},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(EditProfileFormComponent, {set: {template: ''}})
      .compileComponents();
  });

  it('should create', () => {
    createComponent();

    expect(component).toBeTruthy();
  });

  it('preserves notification and research preferences in edit mode', () => {
    dialogData.user = makeUser({
      optInToResearch: true,
      receiveFeedbackNotifications: false,
      receivePortfolioNotifications: false,
      receiveTaskNotifications: false,
    });
    dialogData.mode = 'edit';

    createComponent();

    expect(component.user.optInToResearch).toBe(true);
    expect(component.user.receiveFeedbackNotifications).toBe(false);
    expect(component.user.receivePortfolioNotifications).toBe(false);
    expect(component.user.receiveTaskNotifications).toBe(false);
  });

  it("preserves an established user's explicit peer progress opt-out", () => {
    dialogData.user = makeUser({displayPeerProgress: false});

    createComponent();

    expect(component.user.displayPeerProgress).toBe(false);
  });

  it('defaults a rolling-API user without the preference field to on', () => {
    dialogData.user = makeUser({displayPeerProgress: undefined});

    createComponent();

    expect(component.user.displayPeerProgress).toBe(true);
  });

  it('does not change another user when opened by an admin', () => {
    userServiceStub.currentUser = makeUser({
      id: 1,
      systemRole: 'Admin',
    });
    dialogData.user = makeUser({
      id: 2,
      optInToResearch: true,
      receiveFeedbackNotifications: false,
      receivePortfolioNotifications: false,
      receiveTaskNotifications: false,
    });
    dialogData.mode = 'edit';

    createComponent();

    expect(component.user.optInToResearch).toBe(true);
    expect(component.user.receiveFeedbackNotifications).toBe(false);
    expect(component.user.receivePortfolioNotifications).toBe(false);
    expect(component.user.receiveTaskNotifications).toBe(false);
  });

  it('applies defaults before first-time setup', () => {
    dialogData.user = makeUser({
      hasRunFirstTimeSetup: false,
      optInToResearch: true,
      receiveFeedbackNotifications: false,
      receivePortfolioNotifications: false,
      receiveTaskNotifications: false,
    });
    dialogData.mode = 'create';

    createComponent();

    expect(component.user.optInToResearch).toBe(false);
    expect(component.user.receiveFeedbackNotifications).toBe(true);
    expect(component.user.receivePortfolioNotifications).toBe(true);
    expect(component.user.receiveTaskNotifications).toBe(true);
    expect(component.user.displayPeerProgress).toBe(true);
  });

  it('applies defaults to a blank user opened from the admin screen', () => {
    dialogData.user = {} as User;
    dialogData.mode = 'edit';

    createComponent();

    expect(component.user.optInToResearch).toBe(false);
    expect(component.user.receiveFeedbackNotifications).toBe(true);
    expect(component.user.receivePortfolioNotifications).toBe(true);
    expect(component.user.receiveTaskNotifications).toBe(true);
    expect(component.user.displayPeerProgress).toBe(true);
  });

  it('returns no instructions when nothing is blocking notifications', () => {
    createComponent();

    expect(component.pushBlockerInstructions).toEqual([]);
  });

  it('asks the push service for instructions when permission is denied', () => {
    pushServiceStub.blocker = () => 'permission-denied';
    pushServiceStub.permissionDeniedInstructions = () => ['step one', 'step two'];

    createComponent();

    expect(component.pushBlockerInstructions).toEqual(['step one', 'step two']);
  });
});

// A11Y-FORM06: WCAG 1.3.5 Identify Input Purpose (AA).
// Renders the real profile template and asserts each name/email field declares
// its autocomplete purpose token. StubNgForm satisfies `#form="ngForm"` and
// NO_ERRORS_SCHEMA renders the unknown mat-* elements as plain markup so the
// static autocomplete attribute on each <input> is what we assert on.
@Directive({selector: 'form', exportAs: 'ngForm', standalone: false})
class StubNgFormProfile {
  public invalid = false;
}

// The identity fields now carry #model="ngModel" refs for the required/email
// validation messages, so the real template needs something exporting ngModel to
// render. Stub it, in the same spirit as StubNgFormProfile, and report no errors so
// the autocomplete assertions below are all that this spec turns on.
@Directive({selector: '[ngModel]', exportAs: 'ngModel', standalone: false})
class StubNgModelProfile {
  public hasError(): boolean {
    return false;
  }
}

describe('EditProfileFormComponent autocomplete purpose (A11Y-FORM06)', () => {
  let fixture: ComponentFixture<EditProfileFormComponent>;

  beforeEach(async () => {
    const user = makeUser({systemRole: 'Student'});

    await TestBed.configureTestingModule({
      declarations: [EditProfileFormComponent, StubNgFormProfile, StubNgModelProfile],
      providers: [
        {
          provide: DoubtfireConstants,
          useValue: {ExternalName: {value: 'OnTrack'}, IsTiiEnabled: {value: false}},
        },
        {provide: UserService, useValue: {currentUser: user}},
        {provide: Router, useValue: {}},
        {provide: AuthenticationService, useValue: {}},
        {provide: MAT_DIALOG_DATA, useValue: {user, mode: 'edit', modal: false}},
        {provide: MatSnackBar, useValue: {}},
        {
          provide: PushNotificationService,
          useValue: {
            subscription$: of(null),
            blocker: () => 'no-service-worker',
            permissionDeniedInstructions: () => [],
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileFormComponent);
    fixture.detectChanges();
  });

  const purpose = (name: string): string | null =>
    fixture.nativeElement.querySelector(`input[name="${name}"]`)?.getAttribute('autocomplete') ??
    null;

  it('maps every profile identity field to its WCAG 1.3.5 purpose token', () => {
    expect(purpose('username')).toBe('username');
    expect(purpose('first')).toBe('given-name');
    expect(purpose('last')).toBe('family-name');
    expect(purpose('preferred_name')).toBe('nickname');
    expect(purpose('email')).toBe('email');
  });

  // Failure path: the fix must stay scoped. Fields outside the agreed mapping
  // (student id, custom pronouns) must not be handed a purpose token.
  it('does not put a purpose token on fields outside the mapped set', () => {
    expect(purpose('student_id')).toBeNull();
    expect(purpose('custom_pronouns')).toBeNull();
  });
});

// The notification settings link to the viewer's own notifications page, so the
// link belongs on the profile page only. The admin Users dialog opens this form
// as a modal on someone else's account, and /welcome opens it in create mode.
// Renders the real form and the real notification settings so the input is
// checked end to end.
// Keep the real template renderable when identity validation adds ngModel refs.
@Directive({selector: '[ngModel]', exportAs: 'ngModel', standalone: false})
class StubNotificationNgModel {
  public hasError(): boolean {
    return false;
  }
}

describe('EditProfileFormComponent notifications page link', () => {
  let fixture: ComponentFixture<EditProfileFormComponent>;

  // The profile page and /welcome set mode as a template input. The dialog sets
  // no inputs, and ngOnInit copies mode and modal across from the dialog data.
  const render = async (
    inputMode: 'edit' | 'create' | null,
    dialogData: {user: User; mode: 'edit' | 'create' | 'new'; modal: boolean} | null,
  ): Promise<void> => {
    const currentUser = makeUser({id: 1, systemRole: 'Admin'});

    await TestBed.configureTestingModule({
      declarations: [
        EditProfileFormComponent,
        NotificationSettingsComponent,
        StubNgFormProfile,
        StubNotificationNgModel,
      ],
      providers: [
        {
          provide: DoubtfireConstants,
          useValue: {ExternalName: {value: 'OnTrack'}, IsTiiEnabled: {value: false}},
        },
        {provide: UserService, useValue: {currentUser}},
        {provide: Router, useValue: {}},
        {provide: AuthenticationService, useValue: {}},
        {provide: MAT_DIALOG_DATA, useValue: dialogData},
        {provide: MatSnackBar, useValue: {}},
        {
          provide: PushNotificationService,
          useValue: {
            subscription$: of(null),
            blocker: () => 'no-service-worker',
            permissionDeniedInstructions: () => [],
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileFormComponent);
    if (inputMode) {
      fixture.componentRef.setInput('mode', inputMode);
    }
    fixture.detectChanges();
  };

  const notificationsLink = (): HTMLAnchorElement | null =>
    fixture.nativeElement.querySelector('f-notification-settings a');

  it("shows the link on the user's own profile page", async () => {
    await render('edit', null);

    expect(notificationsLink()?.textContent.trim()).toBe('Notifications page');
  });

  it("hides the link in the admin Users dialog for another user's account", async () => {
    await render(null, {user: makeUser({id: 2}), mode: 'edit', modal: true});

    expect(fixture.nativeElement.querySelector('f-notification-settings')).not.toBeNull();
    expect(notificationsLink()).toBeNull();
  });

  it('hides the link on the first-login setup form', async () => {
    await render('create', null);

    expect(fixture.nativeElement.querySelector('f-notification-settings')).not.toBeNull();
    expect(notificationsLink()).toBeNull();
  });
});

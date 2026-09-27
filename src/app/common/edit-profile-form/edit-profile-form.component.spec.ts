import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {Directive, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatCheckboxHarness} from '@angular/material/checkbox/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Router} from '@angular/router';
import {Subject, of} from 'rxjs';
import {User} from 'src/app/api/models/user/user';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {PushNotificationService} from 'src/app/api/services/push-notification.service';
import {UserService} from 'src/app/api/services/user.service';
import {NotificationSettingsComponent} from 'src/app/common/notification-settings/notification-settings.component';
import {AlertService} from 'src/app/common/services/alert.service';
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
  let userServiceStub: {
    currentUser: User;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
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
      create: vi.fn().mockReturnValue(of(currentUser)),
      update: vi.fn().mockReturnValue(of(currentUser)),
    };
    dialogData = {
      user: currentUser,
      mode: 'edit',
      modal: false,
    };

    await TestBed.configureTestingModule({
      declarations: [EditProfileFormComponent],
      providers: [
        {provide: AlertService, useValue: {error: vi.fn()}},
        {provide: DoubtfireConstants, useValue: emptyProvider},
        {provide: UserService, useValue: userServiceStub},
        {provide: Router, useValue: {navigateByUrl: vi.fn()}},
        {provide: AuthenticationService, useValue: emptyProvider},
        {provide: MAT_DIALOG_DATA, useValue: dialogData},
        {provide: MatSnackBar, useValue: {open: vi.fn()}},
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

  it('treats SSO identity and own student id as read-only account information', () => {
    dialogData.user = makeUser({
      institutionalIdentityManaged: true,
      emailEditable: false,
    });

    createComponent();

    expect(component.canEditEmail).toBe(false);
    expect(component.canEditStudentId).toBe(false);
  });

  it('preserves local email editing and admin maintenance of another local student id', () => {
    userServiceStub.currentUser = makeUser({id: 1, systemRole: 'Admin'});
    dialogData.user = makeUser({
      id: 2,
      institutionalIdentityManaged: false,
      emailEditable: true,
    });

    createComponent();

    expect(component.canEditEmail).toBe(true);
    expect(component.canEditStudentId).toBe(true);
  });

  it('treats an SSO name as read-only and a local one as editable', () => {
    dialogData.user = makeUser({institutionalIdentityManaged: true, emailEditable: false});
    createComponent();
    expect(component.canEditName).toBe(false);

    dialogData.user = makeUser({institutionalIdentityManaged: false, emailEditable: true});
    createComponent();
    expect(component.canEditName).toBe(true);
  });

  it('previews the institution-managed page from a dev-only query parameter', () => {
    const search = window.location.search;
    window.history.replaceState({}, '', `${window.location.pathname}?identityManaged=1`);
    try {
      dialogData.user = makeUser({institutionalIdentityManaged: false, emailEditable: true});
      createComponent();
      expect(component.canEditName).toBe(false);
      expect(component.canEditEmail).toBe(false);
      expect(component.identityManagedView).toBe(true);
    } finally {
      window.history.replaceState({}, '', `${window.location.pathname}${search}`);
    }
  });

  it('leaves institution-managed name and email out of the update', () => {
    const user = makeUser({
      institutionalIdentityManaged: true,
      emailEditable: false,
      nickname: 'Preferred',
    });
    dialogData.user = user;
    userServiceStub.update.mockReturnValue(of(user));

    createComponent();
    component.submit();

    expect(userServiceStub.update).toHaveBeenCalledWith(user, {
      entity: user,
      ignoreKeys: ['firstName', 'lastName', 'email'],
    });
  });

  it('reports explicit saving and success state while preserving genuine settings', () => {
    // Database auth, so nothing on this account is institution-managed and the
    // whole entity goes up. The SSO case is covered separately below.
    const updated = makeUser({
      nickname: 'Preferred',
      receiveFeedbackNotifications: false,
      institutionalIdentityManaged: false,
      emailEditable: true,
    });
    dialogData.user = updated;
    userServiceStub.update.mockReturnValue(of(updated));

    createComponent();
    component.submit();

    expect(userServiceStub.update).toHaveBeenCalledWith(updated);
    expect(component.saving).toBe(false);
    expect(component.saveMessage).toBe('Profile saved.');
    expect(component.user.nickname).toBe('Preferred');
    expect(component.user.receiveFeedbackNotifications).toBe(false);
  });

  it('lets a save land after the view goes, but arms no timer behind it', () => {
    vi.useFakeTimers();

    // A save that has left but has not been answered yet.
    const response: Subject<User> = new Subject();
    userServiceStub.update.mockReturnValue(response);

    createComponent();
    component.submit();
    expect(component.saving).toBe(true);

    // The user leaves the profile page before the server replies. ngOnDestroy
    // has already had its one chance to clear the confirmation timer, so a
    // next handler running after this point would arm one nothing can clear.
    // The request is deliberately not cancelled: the save itself must survive.
    fixture.destroy();
    const pendingAfterDestroy = vi.getTimerCount();
    expect(response.observed).toBe(true);

    response.next(makeUser({nickname: 'Preferred'}));
    response.complete();

    expect(component.justSaved).toBe(false);
    expect(component.saveMessage).toBe('');
    expect(vi.getTimerCount()).toBe(pendingAfterDestroy);

    // And nothing turns up later either.
    vi.advanceTimersByTime(10_000);
    expect(component.justSaved).toBe(false);

    vi.useRealTimers();
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
        {provide: AlertService, useValue: {error: vi.fn()}},
        {
          provide: DoubtfireConstants,
          useValue: {ExternalName: {value: 'OnTrack'}, IsTiiEnabled: {value: false}},
        },
        {provide: UserService, useValue: {currentUser: user}},
        {provide: Router, useValue: {}},
        {provide: AuthenticationService, useValue: {}},
        {provide: MAT_DIALOG_DATA, useValue: {user, mode: 'new', modal: false}},
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
        {provide: AlertService, useValue: {error: vi.fn()}},
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

// The save bar only exists while there is something to act on.
@Directive({selector: 'form', exportAs: 'ngForm', standalone: false})
class StubNgFormSaveBar {
  public invalid = false;
  public dirty = false;
  public pristine = true;
}

describe('EditProfileFormComponent save bar and labels', () => {
  let fixture: ComponentFixture<EditProfileFormComponent>;

  beforeEach(async () => {
    const currentUser = makeUser({firstName: 'Ada', lastName: 'Lovelace', username: 'ada'});

    await TestBed.configureTestingModule({
      declarations: [EditProfileFormComponent, StubNgFormSaveBar, StubNotificationNgModel],
      providers: [
        {provide: AlertService, useValue: {error: vi.fn()}},
        {
          provide: DoubtfireConstants,
          useValue: {ExternalName: {value: 'OnTrack'}, IsTiiEnabled: {value: false}},
        },
        {provide: UserService, useValue: {currentUser}},
        {provide: Router, useValue: {}},
        {provide: AuthenticationService, useValue: {}},
        {provide: MAT_DIALOG_DATA, useValue: null},
        {provide: MatSnackBar, useValue: {}},
        {provide: PushNotificationService, useValue: pushServiceStub},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileFormComponent);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.detectChanges();
  });

  const form = (): StubNgFormSaveBar =>
    fixture.debugElement.children[0].injector.get(StubNgFormSaveBar);
  const text = (): string => fixture.nativeElement.textContent;

  it('shows no bar at all when there is nothing to act on', () => {
    expect(fixture.nativeElement.querySelector('.profile-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
    expect(text()).not.toContain('All changes saved');
  });

  it('brings the bar in with both actions once the form has changes', () => {
    form().dirty = true;
    form().pristine = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.profile-actions')).not.toBeNull();
    expect(text()).toContain('You have unsaved changes');

    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submit.textContent).toContain('Save changes');
    expect(text()).toContain('Discard');
  });

  it('keeps the bar while a save is in flight and while the result is still showing', () => {
    const component = fixture.componentInstance;

    component.saving = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.profile-actions')).not.toBeNull();

    component.saving = false;
    component.justSaved = true;
    component.saveMessage = 'Profile saved.';
    fixture.detectChanges();
    expect(text()).toContain('Profile saved.');

    // Once the confirmation has had its moment the bar goes with it.
    component.justSaved = false;
    component.saveMessage = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.profile-actions')).toBeNull();
  });

  it('puts every edited field back when the changes are discarded', () => {
    const component = fixture.componentInstance;
    const original = component.user.firstName;

    component.user.firstName = 'Edited';
    component.user.nickname = 'Edited too';
    component.discard();

    expect(component.user.firstName).toBe(original);
    expect(component.user.nickname).not.toBe('Edited too');
  });

  it('labels the name fields in sentence case', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.profile-name-fields mat-label',
      ) as NodeListOf<Element>,
    ).map((label) => label.textContent.trim());

    expect(labels).toEqual(['First name', 'Last name', 'Preferred name', 'Custom pronouns']);
    expect(text()).not.toContain('Second Name');
  });

  it('puts the display name and username in the header', () => {
    expect(fixture.nativeElement.querySelector('.profile-header h1').textContent.trim()).toBe(
      'Ada Lovelace',
    );
    expect(fixture.nativeElement.querySelector('.profile-header__meta').textContent).toContain(
      'ada',
    );
  });
});

// Identity the institution asserts is shown, not offered for editing. Renders
// the real template under both auth methods, because the difference between the
// two is entirely in what the form puts on the page.
describe('EditProfileFormComponent institution-managed identity', () => {
  let fixture: ComponentFixture<EditProfileFormComponent>;

  const render = async (user: User): Promise<void> => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      declarations: [EditProfileFormComponent, StubNgFormProfile, StubNotificationNgModel],
      providers: [
        {provide: AlertService, useValue: {error: vi.fn()}},
        {
          provide: DoubtfireConstants,
          useValue: {ExternalName: {value: 'OnTrack'}, IsTiiEnabled: {value: false}},
        },
        {provide: UserService, useValue: {currentUser: user}},
        {provide: Router, useValue: {}},
        {provide: AuthenticationService, useValue: {}},
        {provide: MAT_DIALOG_DATA, useValue: {user, mode: 'edit', modal: false}},
        {provide: MatSnackBar, useValue: {}},
        {provide: PushNotificationService, useValue: pushServiceStub},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileFormComponent);
    fixture.detectChanges();
  };

  const input = (name: string): Element | null =>
    fixture.nativeElement.querySelector(`input[name="${name}"]`);
  const accountFacts = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('.account-information dt') as NodeListOf<Element>,
    ).map((term) => term.textContent.trim());

  const ssoUser = (): User =>
    makeUser({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      email: 'ada@institution.edu',
      nickname: 'Addy',
      institutionalIdentityManaged: true,
      emailEditable: false,
    });

  const localUser = (): User =>
    makeUser({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      email: 'ada@local.test',
      institutionalIdentityManaged: false,
      emailEditable: true,
    });

  it('shows the managed name and email as account facts under SSO', async () => {
    await render(ssoUser());

    expect(accountFacts()).toContain('First name');
    expect(accountFacts()).toContain('Last name');
    expect(accountFacts()).toContain('Institutional / sign-in email');
    expect(fixture.nativeElement.querySelector('.account-information dl').textContent).toContain(
      'Lovelace',
    );
    expect(input('first')).toBeNull();
    expect(input('last')).toBeNull();
    expect(input('email')).toBeNull();
  });

  it('explains where the managed details come from under SSO', async () => {
    await render(ssoUser());

    expect(
      fixture.nativeElement.querySelector('.account-information__managed').textContent,
    ).toContain('Your name and email come from your institution account.');
  });

  it('keeps the preferred name editable and hinted under SSO', async () => {
    await render(ssoUser());

    expect(input('preferred_name')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Shown to your tutors instead of your first name.',
    );
  });

  it('keeps name and email editable under database auth', async () => {
    await render(localUser());

    expect(input('first')).not.toBeNull();
    expect(input('last')).not.toBeNull();
    expect(input('email')).not.toBeNull();
    expect(accountFacts()).not.toContain('First name');
    expect(fixture.nativeElement.querySelector('.account-information__managed')).toBeNull();
  });
});

// The save action only appears once the form is dirty. The notification
// category checkboxes live in a child component with standalone ngModels, so
// they never join this form. Renders the real NgForm and NgModel so the
// pristine state is the one the page actually uses.
describe('EditProfileFormComponent save state', () => {
  let fixture: ComponentFixture<EditProfileFormComponent>;
  let userServiceStub: {currentUser: User; update: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    const currentUser = makeUser({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      studentId: 's1234567',
      username: 'ada',
    });
    userServiceStub = {currentUser, update: vi.fn().mockReturnValue(of(currentUser))};

    await TestBed.configureTestingModule({
      declarations: [EditProfileFormComponent, NotificationSettingsComponent],
      imports: [
        FormsModule,
        MatCheckboxModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
      ],
      providers: [
        {provide: AlertService, useValue: {error: vi.fn()}},
        {
          provide: DoubtfireConstants,
          useValue: {ExternalName: {value: 'OnTrack'}, IsTiiEnabled: {value: false}},
        },
        {provide: UserService, useValue: userServiceStub},
        {provide: Router, useValue: {navigateByUrl: vi.fn()}},
        {provide: AuthenticationService, useValue: {}},
        {provide: MAT_DIALOG_DATA, useValue: null},
        {provide: MatSnackBar, useValue: {open: vi.fn()}},
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
    fixture.componentRef.setInput('mode', 'edit');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const saveButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.profile-actions button[type="submit"]');

  // The redesigned save bar is not rendered at all while the form is pristine.
  it('offers no save action until something changes', () => {
    expect(saveButton()).toBeNull();
  });

  it('offers Save changes when only a notification category changes', async () => {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const feedback = await loader.getHarness(
      MatCheckboxHarness.with({label: 'Feedback notifications'}),
    );

    await feedback.check();
    fixture.detectChanges();

    expect(saveButton()).not.toBeNull();
    expect(saveButton().disabled).toBe(false);
    expect(saveButton().textContent).toContain('Save changes');

    saveButton().click();

    expect(userServiceStub.update).toHaveBeenCalled();
    expect(userServiceStub.update.mock.calls[0][0]).toEqual(
      expect.objectContaining({receiveFeedbackNotifications: true}),
    );
  });
});

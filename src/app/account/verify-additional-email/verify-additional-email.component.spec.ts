import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {Router} from '@angular/router';
import {Subject, of, throwError} from 'rxjs';
import {AdditionalNotificationEmailService} from 'src/app/api/services/additional-notification-email.service';
import {AuthenticationService} from 'src/app/api/services/authentication.service';
import {
  captureAndScrubAdditionalEmailVerification,
  consumeAdditionalEmailVerificationToken,
} from 'src/app/security/additional-email-verification-callback';
import {VerifyAdditionalEmailComponent} from './verify-additional-email.component';

describe('VerifyAdditionalEmailComponent', () => {
  let fixture: ComponentFixture<VerifyAdditionalEmailComponent>;
  let component: VerifyAdditionalEmailComponent;
  const service = {verify: vi.fn()};
  const authentication = {isAuthenticated: vi.fn()};
  const router = {navigateByUrl: vi.fn()};
  let token: string | null = 'private-token';

  const create = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      declarations: [VerifyAdditionalEmailComponent],
      imports: [MatButtonModule, MatIconModule],
      providers: [
        {provide: AdditionalNotificationEmailService, useValue: service},
        {provide: AuthenticationService, useValue: authentication},
        {provide: Router, useValue: router},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VerifyAdditionalEmailComponent);
    component = fixture.componentInstance;
    if (token) {
      captureAndScrubAdditionalEmailVerification(
        `https://ontrack.example/verify_additional_email#token=${token}`,
        vi.fn(),
      );
    }
    fixture.detectChanges();
  };

  const rendered = (selector: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    consumeAdditionalEmailVerificationToken();
    token = 'private-token';
    service.verify.mockReturnValue(of(undefined));
    authentication.isAuthenticated.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consumes the pre-bootstrap token once and reports success', async () => {
    await create();

    expect(service.verify).toHaveBeenCalledWith('private-token');
    expect(component.state).toBe('verified');
    expect(consumeAdditionalEmailVerificationToken()).toBeNull();
  });

  it('shows the success message and next step when the response arrives after first render', async () => {
    const response: Subject<void> = new Subject();
    service.verify.mockReturnValue(response.asObservable());
    await create();
    expect(rendered('p')?.textContent).toContain('Verifying');
    expect(rendered('button')).toBeNull();

    response.next();
    response.complete();
    fixture.detectChanges();

    expect(rendered('p')?.textContent).toContain('Your additional notification email is verified.');
    expect(rendered('button')?.textContent).toContain('Review notification settings');
  });

  it('shows the error message and recovery step when a late response fails', async () => {
    const response: Subject<void> = new Subject();
    service.verify.mockReturnValue(response.asObservable());
    await create();

    response.error(new Error('expired'));
    fixture.detectChanges();

    expect(rendered('p')?.textContent).toContain('invalid, expired, or has already been used');
    expect(rendered('button')?.textContent).toContain('Request a new verification link');
  });

  it('reloads the profile for a signed-out verifier so startup can restore a saved session', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {assign});
    await create();

    rendered('button')?.click();

    expect(assign).toHaveBeenCalledWith('/edit_profile');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('opens the profile directly for an already authenticated user', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {assign});
    authentication.isAuthenticated.mockReturnValue(true);
    await create();

    rendered('button')?.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/edit_profile');
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not call the API for an incomplete link', async () => {
    token = null;
    await create();

    expect(service.verify).not.toHaveBeenCalled();
    expect(component.state).toBe('error');
  });

  it('shows one safe error for expired or replayed links', async () => {
    service.verify.mockReturnValue(throwError(() => new Error('expired')));
    await create();

    expect(component.state).toBe('error');
    expect(component.message).toContain('invalid, expired, or has already been used');
  });
});

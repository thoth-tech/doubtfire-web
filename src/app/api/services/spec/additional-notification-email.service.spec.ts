import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AdditionalNotificationEmailService} from '../additional-notification-email.service';

describe('AdditionalNotificationEmailService', () => {
  let service: AdditionalNotificationEmailService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdditionalNotificationEmailService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AdditionalNotificationEmailService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('maps pending state without exposing a verification token', () => {
    service.get(12).subscribe((state) => {
      expect(state).toEqual({
        status: 'pending',
        email: 'secondary@example.org',
        verificationExpiresAt: '2026-09-01T00:00:00Z',
      });
      expect(state).not.toHaveProperty('token');
    });

    const request = httpMock.expectOne(
      'http://localhost:3000/api/users/12/additional_notification_email',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      status: 'pending',
      email: 'secondary@example.org',
      verification_expires_at: '2026-09-01T00:00:00Z',
    });
  });

  it('uses explicit request, resend, removal, and body-token verification endpoints', () => {
    service.request(12, 'secondary@example.org').subscribe();
    let request = httpMock.expectOne(
      'http://localhost:3000/api/users/12/additional_notification_email',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({email: 'secondary@example.org'});
    request.flush({status: 'pending', email: 'secondary@example.org'});

    service.resend(12).subscribe();
    request = httpMock.expectOne(
      'http://localhost:3000/api/users/12/additional_notification_email/resend',
    );
    expect(request.request.method).toBe('POST');
    request.flush({status: 'pending', email: 'secondary@example.org'});

    service.remove(12).subscribe();
    request = httpMock.expectOne(
      'http://localhost:3000/api/users/12/additional_notification_email',
    );
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    service.verify('secret-link-token').subscribe();
    request = httpMock.expectOne('http://localhost:3000/api/additional_notification_emails/verify');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({token: 'secret-link-token'});
    expect(request.request.url).not.toContain('secret-link-token');
    request.flush({status: 'verified'});
  });
});

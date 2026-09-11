import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import API_URL from 'src/app/config/constants/apiUrl';
import {
  AuthenticatedSettingsResponseFormat,
  DoubtfireConstants,
} from 'src/app/config/constants/doubtfire-constants';

describe('DoubtfireConstants', () => {
  let httpMock: HttpTestingController;

  const publicSettings = {
    externalName: 'OnTrack',
    hasLogo: true,
    logoUrl: '/logo.svg',
    logoLinkUrl: '/',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushSignoutUrl(): void {
    const request = httpMock.expectOne(`${API_URL}/auth/signout_url`);
    request.flush({auth_signout_url: '/sign_out'});
  }

  /**
   * Bring the service up through the normal bootstrap path and answer the two
   * requests the constructor makes, so a test can start from a signed out
   * browser without repeating the plumbing.
   */
  function bootstrap(): DoubtfireConstants {
    const service = TestBed.inject(DoubtfireConstants);

    httpMock.expectOne(`${API_URL}/settings/public`).flush(publicSettings);
    flushSignoutUrl();

    return service;
  }

  it('loads public branding without authentication headers', () => {
    const service = TestBed.inject(DoubtfireConstants);

    const request = httpMock.expectOne(`${API_URL}/settings/public`);

    expect(request.request.headers.has('Auth-Token')).toBe(false);
    expect(request.request.headers.has('Username')).toBe(false);

    request.flush(publicSettings);
    flushSignoutUrl();

    expect(service.ExternalName.value).toBe('OnTrack');
    expect(service.LogoSettings.value).toEqual({
      hasLogo: true,
      logoUrl: '/logo.svg',
      logoLinkUrl: '/',
    });
  });

  it('falls back to the legacy settings route during a staged deployment', () => {
    const service = TestBed.inject(DoubtfireConstants);

    const publicRequest = httpMock.expectOne(`${API_URL}/settings/public`);
    publicRequest.flush(
      {error: 'Not found'},
      {
        status: 404,
        statusText: 'Not Found',
      },
    );

    const legacyRequest = httpMock.expectOne(`${API_URL}/settings`);
    legacyRequest.flush({
      ...publicSettings,
      overseerEnabled: true,
      tiiEnabled: true,
      d2lEnabled: true,
    });

    flushSignoutUrl();

    expect(service.ExternalName.value).toBe('OnTrack');
  });

  it('applies feature flags received after authentication', () => {
    const service = bootstrap();

    service.applyAuthenticatedSettings({
      overseerEnabled: true,
      tiiEnabled: true,
      d2lEnabled: false,
      pushEnabled: true,
      vapidPublicKey: 'BTestVapidPublicKey',
    });

    expect(service.IsOverseerEnabled.value).toBe(true);
    expect(service.IsTiiEnabled.value).toBe(true);
    expect(service.IsD2LEnabled.value).toBe(false);
  });

  /**
   * Push configuration moved behind authentication when /settings did. The
   * pre-auth client here carries no token on purpose, so nothing it fetches may
   * be trusted to populate these two. A signed out browser has to read as "push
   * is not available", because PushNotificationService gates the opt-in on
   * IsPushEnabled and VapidPublicKey both being truthy.
   */
  it('reports push as unavailable before anyone signs in', () => {
    const service = bootstrap();

    expect(service.IsPushEnabled.value).toBe(false);
    expect(service.VapidPublicKey.value).toBe('');
  });

  /**
   * The regression this file exists to catch. An older api still answers the
   * legacy /settings with push fields in the body, and the bootstrap request is
   * anonymous. Reading them there would hand the VAPID key to an unauthenticated
   * caller and would also mean the flags never refresh at sign in, so bootstrap
   * has to ignore them whatever the body says.
   */
  it('ignores push fields returned by the legacy settings route', () => {
    const service = TestBed.inject(DoubtfireConstants);

    httpMock.expectOne(`${API_URL}/settings/public`).flush(
      {error: 'Not found'},
      {
        status: 404,
        statusText: 'Not Found',
      },
    );

    httpMock.expectOne(`${API_URL}/settings`).flush({
      ...publicSettings,
      overseerEnabled: true,
      tiiEnabled: true,
      d2lEnabled: true,
      pushEnabled: true,
      vapidPublicKey: 'BLegacyKeyFromAnonymousRequest',
    });

    flushSignoutUrl();

    expect(service.IsPushEnabled.value).toBe(false);
    expect(service.VapidPublicKey.value).toBe('');
  });

  it('publishes the push configuration once the authenticated settings arrive', () => {
    const service = bootstrap();

    service.applyAuthenticatedSettings({
      overseerEnabled: false,
      tiiEnabled: false,
      d2lEnabled: false,
      pushEnabled: true,
      vapidPublicKey: 'BTestVapidPublicKey',
    });

    expect(service.IsPushEnabled.value).toBe(true);
    expect(service.VapidPublicKey.value).toBe('BTestVapidPublicKey');
  });

  /**
   * The api sends null rather than an empty string when DOUBTFIRE_VAPID_PUBLIC_KEY
   * is unset, so pushEnabled is false and the key is absent. VapidPublicKey is a
   * BehaviorSubject<string> and PushNotificationService reads .value directly, so
   * a null landing in it would read as truthy nowhere but would still be the wrong
   * type. It has to normalise to ''.
   */
  it('normalises a null vapid public key to an empty string', () => {
    const service = bootstrap();

    service.applyAuthenticatedSettings({
      overseerEnabled: false,
      tiiEnabled: false,
      d2lEnabled: false,
      pushEnabled: false,
      vapidPublicKey: null,
    });

    expect(service.IsPushEnabled.value).toBe(false);
    expect(service.VapidPublicKey.value).toBe('');
    expect(service.VapidPublicKey.value).not.toBeNull();
  });

  /**
   * The other half of a staged deployment: a web build carrying push talking to
   * an api that predates it, so /settings answers with the three original flags
   * and neither push field. The assertion is what makes the ?? in
   * applyAuthenticatedSettings load bearing rather than decoration.
   *
   * AuthenticatedSettingsResponseFormat keeps the two push fields optional for
   * this staged-deployment case.
   */
  it('leaves push disabled when the api omits the push fields entirely', () => {
    const service = bootstrap();

    const settingsFromAnOlderApi = {
      overseerEnabled: true,
      tiiEnabled: false,
      d2lEnabled: true,
    } as AuthenticatedSettingsResponseFormat;

    service.applyAuthenticatedSettings(settingsFromAnOlderApi);

    expect(service.IsOverseerEnabled.value).toBe(true);
    expect(service.IsD2LEnabled.value).toBe(true);
    expect(service.IsPushEnabled.value).toBe(false);
    expect(service.VapidPublicKey.value).toBe('');
  });

  /**
   * Signing out and back in as somebody on a server that has since had its keys
   * pulled must not leave the previous key sitting in the subject. Every apply
   * overwrites both, it never merges.
   */
  it('clears a previously published key when push is later turned off', () => {
    const service = bootstrap();

    service.applyAuthenticatedSettings({
      overseerEnabled: false,
      tiiEnabled: false,
      d2lEnabled: false,
      pushEnabled: true,
      vapidPublicKey: 'BFirstKey',
    });

    service.applyAuthenticatedSettings({
      overseerEnabled: false,
      tiiEnabled: false,
      d2lEnabled: false,
      pushEnabled: false,
      vapidPublicKey: null,
    });

    expect(service.IsPushEnabled.value).toBe(false);
    expect(service.VapidPublicKey.value).toBe('');
  });

  it('resets every authenticated setting to its signed-out default', () => {
    const service = bootstrap();

    service.applyAuthenticatedSettings({
      overseerEnabled: true,
      tiiEnabled: true,
      d2lEnabled: true,
      pushEnabled: true,
      vapidPublicKey: 'BPreviousSessionKey',
    });

    service.resetAuthenticatedSettings();

    expect(service.IsOverseerEnabled.value).toBe(false);
    expect(service.IsTiiEnabled.value).toBe(false);
    expect(service.IsD2LEnabled.value).toBe(false);
    expect(service.IsPushEnabled.value).toBe(false);
    expect(service.VapidPublicKey.value).toBe('');
  });
});

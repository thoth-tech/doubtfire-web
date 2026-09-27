import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {HttpAuthenticationInterceptor} from 'src/app/common/services/http-authentication.interceptor';
import {PRESERVE_HTTP_ERROR_RESPONSE} from 'src/app/common/services/http-error-context';
import {HttpErrorInterceptor} from 'src/app/common/services/http-error.interceptor';
import API_URL from 'src/app/config/constants/apiUrl';
import {CourseFlowDraft} from '../models/course-flow';
import {AuthenticationService} from './authentication.service';
import {CourseFlowService} from './course-flow.service';
import {UserService} from './user.service';

const draft: CourseFlowDraft = {
  course_id: 7,
  name: 'Personal study plan',
  periods: [
    {year: 2026, trimester: 1},
    {year: 2027, trimester: 2},
  ],
  slots: [{unit_code: 'REQ1', year: 2026, trimester: 1, position: 3}],
};

describe('Course Flow authenticated API contract', () => {
  let service: CourseFlowService;
  let http: HttpTestingController;
  let currentUser: {
    authenticationToken: string;
    authenticationTokenExpiry: string | null;
    username: string;
  };
  let authentication: {
    attemptLoginUsingRefreshToken: ReturnType<
      typeof vi.fn<(callback: (success: boolean) => void) => void>
    >;
    timeoutAuthentication: ReturnType<typeof vi.fn>;
  };
  const base = `${API_URL}/courseflow`;

  beforeEach(() => {
    currentUser = {
      authenticationToken: 'session-token',
      authenticationTokenExpiry: null,
      username: 'student',
    };
    authentication = {
      attemptLoginUsingRefreshToken: vi.fn((callback: (success: boolean) => void) => {
        currentUser.authenticationToken = 'renewed-token';
        callback(true);
      }),
      timeoutAuthentication: vi.fn(),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {provide: UserService, useValue: {currentUser, isAnonymousUser: () => false}},
        {provide: AuthenticationService, useValue: authentication},
        {provide: HTTP_INTERCEPTORS, useClass: HttpAuthenticationInterceptor, multi: true},
        {provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true},
      ],
    });
    service = TestBed.inject(CourseFlowService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('reads the student-accessible catalog and owner-scoped plans without teaching-unit or user-ID requests', () => {
    service.getCourses().subscribe();
    const catalog = http.expectOne({method: 'GET', url: `${base}/courses`});
    expect(catalog.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    expect(catalog.request.headers.get('Auth-Token')).toBe('session-token');
    expect(catalog.request.headers.get('Username')).toBe('student');
    catalog.flush([]);
    service.getMaps().subscribe();
    const maps = http.expectOne({method: 'GET', url: `${base}/maps`});
    expect(maps.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    maps.flush([]);
    service.getMap(12).subscribe();
    const map = http.expectOne({method: 'GET', url: `${base}/maps/12`});
    expect(map.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    map.flush({id: 12});
    http.expectNone((request) => request.url.includes('/api/units'));
  });

  it('sends a complete atomic draft body including empty periods and unit codes', () => {
    service.createMap(draft).subscribe();
    const request = http.expectOne({method: 'POST', url: `${base}/maps`});
    expect(request.request.body).toEqual(draft);
    expect(request.request.body.user_id).toBeUndefined();
    expect(request.request.body.params).toBeUndefined();
    expect(request.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    request.flush({...draft, id: 12, lock_version: 0});
  });

  it('sends the expected lock version on updates and preserves server conflicts for the caller', () => {
    let status: number;
    service.updateMap(12, draft, 4).subscribe({error: (error) => (status = error.status)});
    const request = http.expectOne({method: 'PUT', url: `${base}/maps/12`});
    expect(request.request.body).toEqual({...draft, lock_version: 4});
    expect(request.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    request.flush({error: 'Conflict'}, {status: 409, statusText: 'Conflict'});
    expect(status).toBe(409);
  });

  it('sends a real query lock version on deletion', () => {
    service.deleteMap(12, 4).subscribe();
    const request = http.expectOne({method: 'DELETE', url: `${base}/maps/12?lock_version=4`});
    expect(request.request.body).toBeNull();
    expect(request.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    request.flush(null, {status: 204, statusText: 'No Content'});
  });

  it('preserves owner-scoped 404 responses through the real interceptor', () => {
    let failure: HttpErrorResponse;
    service.getMap(99).subscribe({error: (error) => (failure = error)});
    http
      .expectOne(`${base}/maps/99`)
      .flush({error: 'Plan not found'}, {status: 404, statusText: 'Not Found'});
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect(failure.status).toBe(404);
    expect(failure.error).toEqual({error: 'Plan not found'});
    expect(authentication.attemptLoginUsingRefreshToken).not.toHaveBeenCalled();
  });

  it('preserves conflicts after refreshing credentials without bypassing authentication', () => {
    let failure: HttpErrorResponse;
    service.updateMap(12, draft, 4).subscribe({error: (error) => (failure = error)});
    http.expectOne(`${base}/maps/12`).flush({}, {status: 419, statusText: 'Expired'});
    const retry = http.expectOne(`${base}/maps/12`);
    expect(retry.request.headers.get('Auth-Token')).toBe('renewed-token');
    expect(retry.request.headers.get('Username')).toBe('student');
    expect(retry.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    expect(retry.request.body).toEqual({...draft, lock_version: 4});
    retry.flush({error: 'Conflict'}, {status: 409, statusText: 'Conflict'});
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect(failure.status).toBe(409);
    expect(authentication.attemptLoginUsingRefreshToken).toHaveBeenCalledOnce();
    expect(authentication.timeoutAuthentication).not.toHaveBeenCalled();
  });

  it('preserves errors for requests queued behind the same token refresh', () => {
    let completeRefresh: (success: boolean) => void;
    authentication.attemptLoginUsingRefreshToken.mockImplementation(
      (callback) => (completeRefresh = callback),
    );
    let firstFailure: HttpErrorResponse;
    let queuedFailure: HttpErrorResponse;
    service.getMap(12).subscribe({error: (error) => (firstFailure = error)});
    service.getMap(13).subscribe({error: (error) => (queuedFailure = error)});
    http.expectOne(`${base}/maps/12`).flush({}, {status: 419, statusText: 'Expired'});
    http.expectOne(`${base}/maps/13`).flush({}, {status: 419, statusText: 'Expired'});
    expect(authentication.attemptLoginUsingRefreshToken).toHaveBeenCalledOnce();
    currentUser.authenticationToken = 'shared-renewed-token';
    completeRefresh(true);
    const firstRetry = http.expectOne(`${base}/maps/12`);
    const queuedRetry = http.expectOne(`${base}/maps/13`);
    expect(queuedRetry.request.headers.get('Auth-Token')).toBe('shared-renewed-token');
    expect(queuedRetry.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(true);
    firstRetry.flush({}, {status: 404, statusText: 'Not Found'});
    queuedRetry.flush({}, {status: 409, statusText: 'Conflict'});
    expect(firstFailure.status).toBe(404);
    expect(queuedFailure).toBeInstanceOf(HttpErrorResponse);
    expect(queuedFailure.status).toBe(409);
  });

  it('keeps legacy message errors for callers that do not opt in', () => {
    let failure: unknown;
    TestBed.inject(HttpClient)
      .get(`${API_URL}/units`)
      .subscribe({error: (error) => (failure = error)});
    const request = http.expectOne(`${API_URL}/units`);
    expect(request.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(false);
    request.flush({error: 'Unit not found'}, {status: 404, statusText: 'Not Found'});
    expect(failure).toBe('Unit not found');
  });

  it('still expires the session when refreshing credentials fails', () => {
    authentication.attemptLoginUsingRefreshToken.mockImplementation((callback) => callback(false));
    let failure: Error;
    service.getMaps().subscribe({error: (error) => (failure = error)});
    http.expectOne(`${base}/maps`).flush({}, {status: 419, statusText: 'Expired'});
    expect(authentication.timeoutAuthentication).toHaveBeenCalledOnce();
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe('Authentication timed out');
  });

  it('keeps legacy message errors after token refresh too', () => {
    let failure: unknown;
    TestBed.inject(HttpClient)
      .get(`${API_URL}/units`)
      .subscribe({error: (error) => (failure = error)});
    http.expectOne(`${API_URL}/units`).flush({}, {status: 419, statusText: 'Expired'});
    const retry = http.expectOne(`${API_URL}/units`);
    expect(retry.request.headers.get('Auth-Token')).toBe('renewed-token');
    expect(retry.request.context.get(PRESERVE_HTTP_ERROR_RESPONSE)).toBe(false);
    retry.flush({error: 'Unit not found'}, {status: 404, statusText: 'Not Found'});
    expect(failure).toBe('Unit not found');
  });
});

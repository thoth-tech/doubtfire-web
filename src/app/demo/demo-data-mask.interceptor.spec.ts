import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import API_URL from 'src/app/config/constants/apiUrl';
import {
  DemoDataMaskInterceptor,
  filterProjectCollectionForQuietMode,
} from './demo-data-mask.interceptor';
import {DemoModeStore} from './demo-mode.store';

describe('DemoDataMaskInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let demoMode: {shouldMaskApiData: boolean};

  beforeEach(() => {
    demoMode = {shouldMaskApiData: true};

    TestBed.configureTestingModule({
      providers: [
        {provide: DemoModeStore, useValue: demoMode},
        {
          provide: HTTP_INTERCEPTORS,
          useClass: DemoDataMaskInterceptor,
          multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('retains only DEMO20007 from the live projects response while demo mode is off', () => {
    let result: unknown;
    http.get(`${API_URL}/projects`).subscribe((value) => (result = value));

    httpTesting.expectOne(`${API_URL}/projects`).flush([
      {id: 1, unit: {code: 'COS10001'}},
      {id: 2, unit: {code: 'DEMO20007'}},
      {id: 3, unit: {code: 'COS30003'}},
    ]);

    expect(result).toEqual([{id: 2, unit: {code: 'DEMO20007'}}]);
  });

  it('falls back to one project for a legacy local dataset', () => {
    expect(
      filterProjectCollectionForQuietMode([
        {id: 1, unit: {code: 'COS10001'}},
        {id: 2, unit: {code: 'COS20002'}},
      ]),
    ).toEqual([{id: 1, unit: {code: 'COS10001'}}]);
  });

  it('masks notification rows and unread count without calling the backend', () => {
    let notifications: unknown;
    let unread: unknown;

    http.get(`${API_URL}/notifications/`).subscribe((value) => (notifications = value));
    http.get(`${API_URL}/notifications/unread_count`).subscribe((value) => (unread = value));

    httpTesting.expectNone(`${API_URL}/notifications/`);
    httpTesting.expectNone(`${API_URL}/notifications/unread_count`);
    expect(notifications).toEqual([]);
    expect(unread).toEqual({count: 0});
  });

  it('passes API-backed data through unchanged when demo mode is on or unavailable', () => {
    demoMode.shouldMaskApiData = false;
    let result: unknown;
    http.get(`${API_URL}/notifications/`).subscribe((value) => (result = value));

    const live = [{id: 8, message: 'Live notification'}];
    httpTesting.expectOne(`${API_URL}/notifications/`).flush(live);

    expect(result).toEqual(live);
  });
});

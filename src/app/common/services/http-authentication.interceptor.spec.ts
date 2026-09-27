import {beforeEach, describe, expect, it, vi} from 'vitest';
import {HttpHandler, HttpRequest, HttpResponse} from '@angular/common/http';
import {of} from 'rxjs';
import {UserService} from 'src/app/api/services/user.service';
import API_URL from 'src/app/config/constants/apiUrl';
import LTI_API_URL from 'src/app/config/constants/ltiApiUrl';
import {HttpAuthenticationInterceptor} from './http-authentication.interceptor';

describe('HttpAuthenticationInterceptor', () => {
  const currentUser = {authenticationToken: '', username: '', ltik: ''};
  let interceptor: HttpAuthenticationInterceptor;
  const handle = vi.fn<HttpHandler['handle']>(() => of(new HttpResponse()));

  beforeEach(() => {
    Object.assign(currentUser, {
      authenticationToken: 'session-token',
      username: 'student',
      ltik: '',
    });
    handle.mockClear();
    interceptor = new HttpAuthenticationInterceptor({currentUser} as UserService);
  });

  function intercept(url: string): HttpRequest<unknown> {
    const request: HttpRequest<object> = new HttpRequest('GET', url);
    interceptor.intercept(request, {handle} as HttpHandler).subscribe();
    return handle.mock.calls[0][0] as HttpRequest<unknown>;
  }

  it.each([`${API_URL}/units`, `${LTI_API_URL}/launch`])(
    'adds session credentials to a configured API request %s',
    (url) => {
      const request = intercept(url);
      expect(request.headers.get('Auth-Token')).toBe('session-token');
      expect(request.headers.get('Username')).toBe('student');
      expect(request.headers.has('Authorization')).toBe(false);
    },
  );

  it('adds an LTI bearer token when the launch supplies one', () => {
    currentUser.ltik = 'launch-token';
    expect(intercept(`${LTI_API_URL}/units`).headers.get('Authorization')).toBe(
      'Bearer launch-token',
    );
  });

  it('does not invent session headers for an anonymous request', () => {
    currentUser.authenticationToken = '';
    const request = intercept(`${API_URL}/auth`);
    expect(request.headers.has('Auth-Token')).toBe(false);
    expect(request.headers.has('Username')).toBe(false);
  });

  it.each(['https://other.example/api/units', '/assets/config.json'])(
    'does not attach credentials to unrelated request %s',
    (url) => {
      currentUser.ltik = 'launch-token';
      expect(intercept(url).headers.keys()).toEqual([]);
    },
  );

  it('keeps the original request immutable and preserves caller headers', () => {
    const original = new HttpRequest<object>('GET', `${API_URL}/units`).clone({
      setHeaders: {'X-Request-ID': 'request-1'},
    });
    interceptor.intercept(original, {handle} as HttpHandler).subscribe();
    const outgoing = handle.mock.calls[0][0] as HttpRequest<unknown>;

    expect(original.headers.has('Auth-Token')).toBe(false);
    expect(outgoing.headers.get('X-Request-ID')).toBe('request-1');
    expect(handle).toHaveBeenCalledOnce();
  });
});

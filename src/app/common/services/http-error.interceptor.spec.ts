import {describe, expect, it} from 'vitest';
import {HttpErrorResponse, HttpHandler, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {HttpErrorInterceptor} from './http-error.interceptor';

// authenticationTokenExpiry is null on purpose. isAccessTokenExpired parses it,
// gets NaN and returns false, so the request reaches the handler below instead
// of being turned into a synthetic 419.
const userService = {
  currentUser: {
    authenticationToken: 'tok',
    authenticationTokenExpiry: null as string | null,
    username: 'u',
  },
  isAnonymousUser: () => false,
};

const authenticationService = {
  attemptLoginUsingRefreshToken: () => {},
  timeoutAuthentication: () => {},
};

function messageFor(error: HttpErrorResponse): Promise<unknown> {
  const interceptor = new HttpErrorInterceptor(
    authenticationService as never,
    userService as never,
  );

  const handler: HttpHandler = {
    handle: (): Observable<never> => throwError(() => error),
  };

  return new Promise((resolve) => {
    interceptor
      .intercept(new HttpRequest('GET', '/api/units'), handler)
      .subscribe({error: (message: unknown) => resolve(message)});
  });
}

describe('HttpErrorInterceptor', () => {
  it('falls back to the status text when the response body is empty', async () => {
    const message = await messageFor(
      new HttpErrorResponse({status: 502, statusText: 'Bad Gateway', error: null}),
    );

    expect(message).toBe('Bad Gateway');
  });

  it('uses the message from an ordinary api error', async () => {
    const message = await messageFor(
      new HttpErrorResponse({
        status: 404,
        statusText: 'Not Found',
        error: {error: 'Unit not found'},
      }),
    );

    expect(message).toBe('Unit not found');
  });

  it('passes a plain string body through unchanged', async () => {
    const message = await messageFor(
      new HttpErrorResponse({status: 500, statusText: 'Server Error', error: 'went wrong'}),
    );

    expect(message).toBe('went wrong');
  });

  it('falls back to the status text when the body could not be parsed', async () => {
    const message = await messageFor(
      new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        error: {error: new SyntaxError('Unexpected token <'), text: '<html></html>'},
      }),
    );

    expect(message).toBe('Internal Server Error');
  });
});

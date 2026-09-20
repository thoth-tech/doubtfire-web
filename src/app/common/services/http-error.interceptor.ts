/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Sentry from '@sentry/angular';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject, throwError} from 'rxjs';
import {catchError, filter, finalize, switchMap, take} from 'rxjs/operators';
import {AuthenticationService, UserService} from 'src/app/api/models/doubtfire-model';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  private refreshTokenInProgress = false;
  private refreshTokenSubject: Subject<any> = new BehaviorSubject<any>(null);

  constructor(
    private authenticationService: AuthenticationService,
    private userService: UserService,
  ) {}

  attemptRefresh$(): Observable<void> {
    return new Observable<void>((observer) => {
      this.authenticationService.attemptLoginUsingRefreshToken((result: boolean) => {
        if (result) {
          observer.next();
          observer.complete();
        } else {
          this.authenticationService.timeoutAuthentication();
          this.refreshTokenInProgress = false;
          observer.error(new Error('Authentication timed out'));
        }
      }, false); // Don't display splashscreen
    });
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const request$ = this.isAccessTokenExpired(request)
      ? throwError(() => new HttpErrorResponse({status: 419}))
      : next.handle(request);

    return request$.pipe(
      catchError((error: HttpErrorResponse) => {
        if (this.isAuthError(error)) {
          if (this.isAccessTokenRequest(request)) {
            return throwError(() => this.extractErrorMessage(error));
          }

          if (!this.refreshTokenInProgress) {
            console.log('Refreshing access token');
            this.refreshTokenInProgress = true;
            this.refreshTokenSubject.next(null);
            return this.attemptRefresh$().pipe(
              switchMap(() => {
                this.refreshTokenSubject.next(this.userService.currentUser.authenticationToken);
                return next.handle(this.injectToken(request));
              }),
              catchError((err: HttpErrorResponse) => {
                this.refreshTokenInProgress = false;
                if (this.isAuthError(err)) {
                  this.authenticationService.timeoutAuthentication();
                }
                if (!(err instanceof HttpErrorResponse)) {
                  return throwError(() => err);
                }
                return throwError(() => this.extractErrorMessage(err));
              }),
              finalize(() => (this.refreshTokenInProgress = false)),
            );
          } else {
            return this.refreshTokenSubject.pipe(
              filter((result) => result !== null),
              take(1),
              switchMap(() => next.handle(this.injectToken(request))),
              catchError((err: HttpErrorResponse) => {
                return throwError(() => this.extractErrorMessage(err));
              }),
            );
          }
        }

        return throwError(() => this.extractErrorMessage(error));
      }),
    );
  }

  private isAuthError(error: HttpErrorResponse) {
    return error.status === 419 || (error.status === 403 && this.userService.isAnonymousUser());
  }

  private isAccessTokenExpired(request: HttpRequest<any>) {
    const user = this.userService.currentUser;
    const expiry = Date.parse(user.authenticationTokenExpiry);

    return (
      !this.isAccessTokenRequest(request) &&
      !!user.authenticationToken &&
      !Number.isNaN(expiry) &&
      expiry <= Date.now()
    );
  }

  private isAccessTokenRequest(request: HttpRequest<any>) {
    return request.url.endsWith('/auth/access-token');
  }

  private extractErrorMessage(error: HttpErrorResponse) {
    let errorMessage: string;
    let logMessage: string = '';
    if (error.error instanceof ErrorEvent) {
      // client-side error
      errorMessage = error.error.message;
    } else if (error.error instanceof ProgressEvent) {
      errorMessage = error.statusText;
    } else {
      // Server-side error. error.error is null whenever the response body was
      // empty, which is every 502 from a proxy and every 500 that returns
      // nothing, so the property read has to come after the checks rather than
      // before them. The blob check moves up for the same reason: it only worked
      // where it was because a Blob happens to have no error property.
      const body: unknown = error.error;
      if (body instanceof Blob) {
        errorMessage = error.statusText;
      } else if (typeof body === 'string') {
        errorMessage = body;
      } else {
        // An unparseable body arrives as {error: SyntaxError, text: '<html>'},
        // so the nested value has to be a string before it is used as one.
        const nested = (body as {error?: unknown})?.error;
        errorMessage =
          typeof nested === 'string' ? nested : error.statusText || 'Something went wrong';
      }
      logMessage = `Error Code: ${error.status}`;
    }

    this.reportError(`${logMessage}: ${errorMessage}`, error.status);

    console.error(`${logMessage}: ${errorMessage}`);
    return errorMessage;
  }

  injectToken(request: HttpRequest<any>) {
    return request.clone({
      setHeaders: {
        'Auth-Token': this.userService.currentUser.authenticationToken,
        Username: this.userService.currentUser.username,
      },
    });
  }

  // Reports the failure rather than throwing at Sentry. The old version threw
  // inside a startSpan callback, which rethrows, inside a then() with no catch,
  // so every failed request in the app left an unhandled promise rejection that
  // nothing in the observable chain could see. Named reportError because rxjs
  // throwError is imported into this same file.
  private reportError(message: string, statusCode: number) {
    Sentry.captureException(new HttpRequestError(message, statusCode), {
      tags: {'http.response.status_code': statusCode},
    });
  }
}

class HttpRequestError extends Error {
  constructor(
    message: string | undefined,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

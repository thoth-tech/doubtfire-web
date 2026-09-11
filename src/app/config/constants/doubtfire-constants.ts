import {HttpBackend, HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BehaviorSubject, catchError, throwError} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';
import HOST_URL from 'src/app/config/constants/hostUrl';

interface PublicSettingsResponseFormat {
  externalName: string;
  hasLogo: boolean;
  logoUrl: string;
  logoLinkUrl: string;
}

export interface AuthenticatedSettingsResponseFormat {
  overseerEnabled: boolean;
  tiiEnabled: boolean;
  d2lEnabled: boolean;
  // Optional so an existing caller that predates push still type-checks, and
  // because applyAuthenticatedSettings already defaults both below.
  pushEnabled?: boolean;
  vapidPublicKey?: string | null;
}

export interface LogoSettings {
  hasLogo: boolean;
  logoUrl: string;
  logoLinkUrl: string;
}

interface SignOutUrlResponseFormat {
  auth_signout_url: string;
}

@Injectable({providedIn: 'root'})
export class DoubtfireConstants {
  private http: HttpClient;

  public mainContributors: readonly string[] = [
    'macite', // Andrew Cain
    'alexcu', // Alex Cummaudo
    'jakerenzella', // Jake Renzella
  ];

  public HOST_URL: string = HOST_URL;
  public API_URL: string = API_URL;

  // Where should we redirect users on signout?
  public SignoutURL: string;

  // Initialise external name to loading.
  public ExternalName: BehaviorSubject<string> = new BehaviorSubject<string>('Loading...');

  /**
   * Whether or not the Overseer feature is enabled.
   */
  public IsOverseerEnabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Whether or not the D2L integration is enabled.
   */
  public IsD2LEnabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Details on the logo.
   */
  public LogoSettings: BehaviorSubject<LogoSettings> = new BehaviorSubject<LogoSettings>({
    hasLogo: false,
    logoUrl: '/assets/images/institution-logo.png',
    logoLinkUrl: '/',
  });

  /**
   * Whether or not the TurnItIn integration is enabled.
   */
  public IsTiiEnabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Whether the api has VAPID keys configured. False means push cannot work at
   * all, so the opt-in is not offered.
   *
   * Populated after sign-in, not at bootstrap. /settings is authenticated, and
   * the pre-auth client here deliberately carries no token.
   */
  public IsPushEnabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * The VAPID public key the browser needs to subscribe to push. Not a secret —
   * it is sent to the push service in the clear. Empty until settings load.
   */
  public VapidPublicKey: BehaviorSubject<string> = new BehaviorSubject<string>('');

  private readonly publicSettingsUrl: string = `${this.API_URL}/settings/public`;
  private readonly legacySettingsUrl: string = `${this.API_URL}/settings`;

  constructor(handler: HttpBackend) {
    // Do not use interceptors for pre-authentication Doubtfire constants.
    this.http = new HttpClient(handler);
    this.loadPublicSettings();
    this.loadSignoutUrl();
  }

  private loadSignoutUrl(): void {
    const url: string = `${this.API_URL}/auth/signout_url`;

    this.http.get<SignOutUrlResponseFormat>(url).subscribe({
      next: (result) => (this.SignoutURL = result.auth_signout_url),
      error: (error) => console.error(error),
    });
  }

  /**
   * Load branding needed before the user signs in.
   *
   * The fallback allows this web change to be deployed before the API change.
   * The current API returns the same branding fields from /settings.
   */
  private loadPublicSettings(): void {
    this.http
      .get<PublicSettingsResponseFormat>(this.publicSettingsUrl)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) {
            return this.http.get<PublicSettingsResponseFormat>(this.legacySettingsUrl);
          }

          return throwError(() => error);
        }),
      )
      .subscribe({
        next: (result) => {
          this.ExternalName.next(result.externalName);
          this.LogoSettings.next({
            hasLogo: result.hasLogo,
            logoUrl: result.logoUrl,
            logoLinkUrl: result.logoLinkUrl,
          });
        },
        error: (error) => console.error('Unable to load public settings', error),
      });
  }

  /**
   * Apply settings returned after successful authentication.
   */
  public applyAuthenticatedSettings(result: AuthenticatedSettingsResponseFormat): void {
    this.IsOverseerEnabled.next(result.overseerEnabled);
    this.IsTiiEnabled.next(result.tiiEnabled);
    this.IsD2LEnabled.next(result.d2lEnabled);
    this.IsPushEnabled.next(result.pushEnabled ?? false);
    this.VapidPublicKey.next(result.vapidPublicKey ?? '');
  }

  /**
   * Remove configuration that may only be used by an authenticated session.
   *
   * DoubtfireConstants is a root singleton, so these subjects otherwise retain
   * the previous session's values after sign out. Keep the defaults fail closed
   * while signed out and when the authenticated settings request fails.
   */
  public resetAuthenticatedSettings(): void {
    this.IsOverseerEnabled.next(false);
    this.IsTiiEnabled.next(false);
    this.IsD2LEnabled.next(false);
    this.IsPushEnabled.next(false);
    this.VapidPublicKey.next('');
  }
}

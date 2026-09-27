import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable, map} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';

export type AdditionalNotificationEmailStatus = 'none' | 'pending' | 'verified';

export interface AdditionalNotificationEmailState {
  status: AdditionalNotificationEmailStatus;
  email: string | null;
  verificationExpiresAt: string | null;
}

interface AdditionalNotificationEmailResponse {
  status: AdditionalNotificationEmailStatus;
  email: string | null;
  verification_expires_at: string | null;
}

@Injectable({providedIn: 'root'})
export class AdditionalNotificationEmailService {
  constructor(private http: HttpClient) {}

  public get(userId: number): Observable<AdditionalNotificationEmailState> {
    return this.http
      .get<AdditionalNotificationEmailResponse>(this.url(userId))
      .pipe(map((response) => this.mapState(response)));
  }

  public request(userId: number, email: string): Observable<AdditionalNotificationEmailState> {
    return this.http
      .put<AdditionalNotificationEmailResponse>(this.url(userId), {email})
      .pipe(map((response) => this.mapState(response)));
  }

  public resend(userId: number): Observable<AdditionalNotificationEmailState> {
    return this.http
      .post<AdditionalNotificationEmailResponse>(`${this.url(userId)}/resend`, {})
      .pipe(map((response) => this.mapState(response)));
  }

  public remove(userId: number): Observable<void> {
    return this.http.delete<void>(this.url(userId));
  }

  public verify(token: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/additional_notification_emails/verify`, {token});
  }

  private url(userId: number): string {
    return `${API_URL}/users/${userId}/additional_notification_email`;
  }

  private mapState(
    response: AdditionalNotificationEmailResponse,
  ): AdditionalNotificationEmailState {
    return {
      status: response.status,
      email: response.email,
      verificationExpiresAt: response.verification_expires_at,
    };
  }
}

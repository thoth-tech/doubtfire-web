import {HttpContextToken} from '@angular/common/http';

/** Opt in when callers need HTTP status codes to recover from conflicts or missing resources. */
export const PRESERVE_HTTP_ERROR_RESPONSE: HttpContextToken<boolean> = new HttpContextToken(
  () => false,
);

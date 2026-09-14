import * as Sentry from '@sentry/angular';
import {enableProdMode, provideZoneChangeDetection} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {environment} from 'src/environments/environment';
import {DoubtfireAngularModule} from './app/doubtfire-angular.module';
import {
  captureAndScrubAuthCallback,
  redactAuthCallbackFromUrl,
} from './app/security/auth-callback';

// Authentication callbacks may contain a one-time credential. Remove it from
// browser history before any telemetry SDK or application code can observe it.
const telemetrySafe = captureAndScrubAuthCallback();

if (environment.sentryDsn && telemetrySafe) {
  Sentry.init({
    dsn: environment.sentryDsn,
    tunnel: '/api/client-reports',
    release: environment.sentryRelease || undefined,
    dist: environment.sentryDist || undefined,
    // Keep telemetry to redacted error events for this release. Browser tracing
    // and Session Replay can observe iframe/resource URLs outside beforeSend;
    // legacy SCORM URLs still contain a reusable credential in their path.
    // They must stay disabled until that launch protocol is redesigned.
    enableLogs: false,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = redactAuthCallbackFromUrl(event.request.url);
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      const url = breadcrumb.data?.['url'];
      if (typeof url === 'string') {
        breadcrumb.data['url'] = redactAuthCallbackFromUrl(url);
      }
      return breadcrumb;
    },
  });
}

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(DoubtfireAngularModule, {
  applicationProviders: [provideZoneChangeDetection()],
});

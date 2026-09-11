// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  // Runs the service worker outside a production build. Push notifications
  // cannot arrive without it, because the service worker is the thing that
  // receives them.
  //
  // Turn this off if the worker gets in your way. It caches, so a stale bundle
  // after a rebuild is the usual symptom, and clearing it is a manual step.
  // See docs/service-worker.md.
  enableServiceWorker: true,

  // Makes the local-only demo controls available. The mode itself still starts
  // off and is stored only for the current browser tab.
  enableDemoTools: true,

  sentryDsn: '',
  sentryRelease: '',
  sentryDist: '',
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.

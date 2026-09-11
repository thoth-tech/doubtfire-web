/**
 * Docker replaces optional build values before Angular compiles this file.
 * A direct production build leaves the `${...}` marker intact; normalising
 * unresolved markers to an empty string keeps optional telemetry disabled.
 */
const optionalBuildValue = (value: string): string =>
  value.startsWith('${') && value.endsWith('}') ? '' : value;

export const environment = {
  production: true,

  // Not read in production: `production: true` already enables the service
  // worker. Present so both environment files have the same shape.
  enableServiceWorker: false,

  // Demo mode must never be enabled by a production build.
  enableDemoTools: false,

  sentryDsn: optionalBuildValue('${SENTRY_DSN}'),
  sentryRelease: optionalBuildValue('${SENTRY_RELEASE}'),
  sentryDist: optionalBuildValue('${SENTRY_DIST}'),
};

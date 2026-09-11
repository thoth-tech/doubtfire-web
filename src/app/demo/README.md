# Centralised local demo mode

This folder owns every deliberately fabricated runtime value used by the combined local
walkthrough. Demo tools are available only when `environment.enableDemoTools` is true and
`environment.production` is false. They start off and persist only for the current browser tab.

When demo mode is off in local development, the HTTP mask keeps `DEMO20007` (or one fallback
project), hides notification rows/counts, and the task PPI service returns a labelled masked state.
When it is on, those API-backed surfaces pass through unchanged. The unit-summary percentage,
burndown curve, and push preview are the only fabricated presentation values.

The push preview is visual only. It must never inject `SwPush`, request `Notification` permission,
or call `/push_subscriptions`.

## Removal

1. Remove `DemoToolsModule` from `doubtfire-angular.module.ts` and delete this folder.
2. Remove `/demo-controls` and its imports from `app.routes.ts`.
3. Remove the Demo controls item/store injection from `common/header/header.component.*`.
4. Remove `<f-demo-mode-banner>` from `app.component.html`.
5. Remove `enableDemoTools` from both environment files.
6. Remove the `DemoModeStore.reset()` sign-out hook from `authentication.service.ts`.
7. Remove demo gating/imports from the PPI indicator, progress dashboard, and burndown chart.
8. Either delete the demo-only unit summary and peer-median UI or replace them with authorised live
   API adapters before retaining those surfaces.

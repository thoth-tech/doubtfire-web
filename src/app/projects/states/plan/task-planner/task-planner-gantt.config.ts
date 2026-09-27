import {GanttGlobalConfig, GanttI18nLocale} from '@worktile/gantt';

/** CSS token values stay live when the user changes the OnTrack theme. */
export const taskPlannerGanttConfig: GanttGlobalConfig = {
  locale: GanttI18nLocale.enUs,
  styleOptions: {
    defaultTheme: 'ontrack',
    themes: {
      ontrack: {
        primary: 'var(--ot-color-primary)',
        danger: 'var(--ot-color-error)',
        highlight: 'var(--ot-color-link)',
        background: 'var(--ot-color-surface)',
        text: {
          main: 'var(--ot-color-text)',
          muted: 'var(--ot-color-text-muted)',
          light: 'var(--ot-color-text-muted)',
          inverse: 'var(--ot-color-on-primary)',
        },
        gray: {
          100: 'var(--ot-color-page)',
          200: 'var(--ot-color-surface-raised)',
          300: 'var(--ot-color-surface-raised)',
          400: 'var(--ot-color-divider)',
          500: 'var(--ot-color-border)',
          600: 'var(--ot-color-border)',
        },
      },
    },
  },
};

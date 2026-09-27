/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  important: true,
  // SPIKE (THM-F03): bind the dark: variant to the resolved marker, not the OS.
  darkMode: ['selector', '[data-ot-theme="dark"]'],
  theme: {
    extend: {
      // Shape scale as Tailwind radius utilities: rounded-ot-sm … rounded-ot-circle
      // reference the --ot-radius-* tokens (styles/tokens/_shape.scss) so templates
      // pin to the same six rungs as SCSS. Use these instead of rounded-md/lg/xl,
      // which had drifted across five tiers for the same kinds of element.
      borderRadius: {
        'ot-xs': 'var(--ot-radius-xs)',
        'ot-sm': 'var(--ot-radius-sm)',
        'ot-md': 'var(--ot-radius-md)',
        'ot-lg': 'var(--ot-radius-lg)',
        'ot-pill': 'var(--ot-radius-pill)',
        'ot-circle': 'var(--ot-radius-circle)',
      },
      colors: {
        'formatif-blue': '#3939ff',
        'formatif-blue-lighter': '#e7e7ff',
        // OnTrack theme tokens as Tailwind colours. These reference the --ot-*
        // custom properties (declared only in styles/tokens/_light|_dark.scss), so
        // utilities like bg-ot-surface / text-ot-muted flip with data-ot-theme
        // automatically, no dark: variant needed. Use these instead of literal
        // colour utilities (bg-white, text-gray-600) on any themed surface.
        'ot-page': 'var(--ot-color-page)',
        'ot-surface': 'var(--ot-color-surface)',
        'ot-raised': 'var(--ot-color-surface-raised)',
        'ot-text': 'var(--ot-color-text)',
        'ot-muted': 'var(--ot-color-text-muted)',
        'ot-border': 'var(--ot-color-border)',
        'ot-divider': 'var(--ot-color-divider)',
        'ot-primary': 'var(--ot-color-primary)',
        'ot-on-primary': 'var(--ot-color-on-primary)',
        'ot-link': 'var(--ot-color-link)',
        'ot-focus': 'var(--ot-color-focus)',
        'ot-success': 'var(--ot-color-success)',
        'ot-warning': 'var(--ot-color-warning)',
        'ot-error': 'var(--ot-color-error)',
        'ot-info': 'var(--ot-color-info)',
        'ot-selected': 'var(--ot-color-selected)',
        'ot-hover': 'var(--ot-color-hover)',
        'ot-code': 'var(--ot-code-surface)',
        'ot-inverse': 'var(--ot-color-inverse-surface)',
        'ot-on-inverse': 'var(--ot-color-inverse-text)',
      },
    },
  },
  plugins: [],
};

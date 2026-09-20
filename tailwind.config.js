/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  important: true,
  // SPIKE (THM-F03): bind the dark: variant to the resolved marker, not the OS.
  darkMode: ['selector', '[data-ot-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'formatif-blue': '#3939ff',
        'formatif-blue-lighter': '#e7e7ff',
      },
    },
  },
  plugins: [],
};

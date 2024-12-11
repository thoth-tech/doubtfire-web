/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  important: true,
  theme: {
    extend: {
      colors: {
        'formatif-blue': '#3939ff',
        'formatif-blue-lighter': '#e7e7ff',
      },
      boxShadow: {
        'outline-blue': '0 0 0 3px rgba(0, 123, 255, 0.5)',
      },
    },
  },
  plugins: [],
};

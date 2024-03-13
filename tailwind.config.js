/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts,jsx,tsx}'],
  darkMode: 'selector',
  theme: {
    extend: {
      borderColor: {
        correct: 'green',
        incorrect: 'red',
      },
      colors: {
        'theme-color': '#00a2e8',
        'light-gray': '#f7f7f7',
        'dark-gray': '#222',
      },
      fontSize: {
        xxs: '0.6rem',
        xs: '0.7rem',
      },
      screens: {
        xs: { max: '638.98px' },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Agriculture-themed palette
        krishi: {
          50: '#f1faf1',
          100: '#dbf2db',
          200: '#b8e4b8',
          300: '#8bd08b',
          400: '#5cb85c',
          500: '#3a9d3a',
          600: '#2b7e2b',
          700: '#246324',
          800: '#1f4f1f',
          900: '#1a401a',
        },
        soil: {
          100: '#f5efe6',
          300: '#d6c2a3',
          500: '#a07c4a',
          700: '#6b4f2a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

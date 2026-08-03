/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#181818',
        'app-surface': '#1e1e1e',
        'app-surface2': '#252526',
        'app-surface3': '#2d2d2d',
        'app-hover': '#2a2d2e',
        'app-active': '#37373d',
        'app-input': '#222222',
        'app-border': '#2b2b2b',
        'app-border-light': '#3c3c3c',
        'app-text': '#cccccc',
        'app-text-muted': '#858585',
        'app-text-dim': '#666666',
        'app-accent': '#3794ff',
        'app-accent-vivid': '#007acc',
        'app-close-hover': '#e81123',
      },
      fontFamily: {
        mono: ['"Cascadia Code"', '"Fira Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

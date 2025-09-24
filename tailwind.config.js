/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        'secondary-foreground': 'rgb(var(--secondary-foreground) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        'status-new': 'rgb(var(--status-new) / <alpha-value>)',
        'status-learning': 'rgb(var(--status-learning) / <alpha-value>)',
        'status-reviewing': 'rgb(var(--status-reviewing) / <alpha-value>)',
        'status-mastered': 'rgb(var(--status-mastered) / <alpha-value>)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fly-out-up': {
          '0%': { transform: 'translateY(0) rotate(0)', opacity: 1 },
          '100%': { transform: 'translateY(-150%) rotate(-15deg)', opacity: 0 },
        },
        'fly-out-down': {
          '0%': { transform: 'translateY(0) rotate(0)', opacity: 1 },
          '100%': { transform: 'translateY(150%) rotate(15deg)', opacity: 0 },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-in-out',
        'fly-out-up': 'fly-out-up 0.3s ease-out forwards',
        'fly-out-down': 'fly-out-down 0.3s ease-out forwards',
      },
    },
  },
  // FIX: Add the tailwindcss-3d plugin here
  plugins: [
    require('tailwindcss-3d'),
  ],
}
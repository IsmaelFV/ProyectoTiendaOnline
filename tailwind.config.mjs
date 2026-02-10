/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta de grises profesional
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          850: '#1c1c1c',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Dorado premium refinado
        gold: {
          50: '#fffef7',
          100: '#fffbeb',
          200: '#fef3c7',
          300: '#fde68a',
          400: '#f4d467',
          500: '#d4af37',
          600: '#b8942e',
          700: '#a88a2d',
          800: '#8a7024',
          900: '#6b5619',
        },
        // Backgrounds oscuros con profundidad
        'dark': {
          'bg': '#0a0a0a',
          'surface': '#171717',
          'surface-elevated': '#1c1c1c',
          'card': '#262626',
          'card-hover': '#2e2e2e',
        },
        // Accent colors refinados
        'accent': {
          'gold': '#d4af37',
          'gold-light': '#e8c96d',
          'gold-dark': '#b8942e',
          'gold-muted': '#a88a2d',
          'emerald': '#10b981',
          'emerald-dark': '#059669',
          'teal': '#14b8a6',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-sm': '0 0 20px -5px rgba(16, 185, 129, 0.15)',
        'glow': '0 0 40px -10px rgba(16, 185, 129, 0.25)',
        'glow-lg': '0 0 60px -15px rgba(16, 185, 129, 0.35)',
        'glow-gold': '0 0 40px -10px rgba(212, 175, 55, 0.25), 0 0 80px -15px rgba(212, 175, 55, 0.1)',
        'glow-gold-lg': '0 0 60px -10px rgba(212, 175, 55, 0.35), 0 0 100px -15px rgba(212, 175, 55, 0.15)',
        'inner-glow': 'inset 0 0 20px -5px rgba(212, 175, 55, 0.15)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'glass-lg': '0 25px 50px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
        'elevated': '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
        'elevated-lg': '0 30px 60px -20px rgba(0, 0, 0, 0.8)',
        'card': '0 4px 16px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.4s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'bounce-subtle': 'bounce-subtle 2s infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

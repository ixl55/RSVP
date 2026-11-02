/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ألوان مستوحاة من شعار المؤتمر (العلم العراقي)
        brand: {
          50: '#eefbf3',
          100: '#d6f5e3',
          200: '#b0e9cb',
          300: '#7dd7ab',
          400: '#47bd86',
          500: '#22a06b',
          600: '#158055',
          700: '#116646',
          800: '#0f5138',
          900: '#0d4330',
        },
        accent: {
          50: '#fef2f2',
          100: '#fde3e3',
          200: '#fbcccc',
          300: '#f7a8a8',
          400: '#f07676',
          500: '#e14b4b',
          600: '#ce2f2f',
          700: '#ac2424',
          800: '#8e2222',
          900: '#772222',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.18)',
        lift: '0 12px 40px -12px rgba(16,24,40,.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(.94)' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.21,1.02,.73,1) both',
        'pop-in': 'pop-in .4s cubic-bezier(.21,1.02,.73,1) both',
      },
    },
  },
  plugins: [],
}

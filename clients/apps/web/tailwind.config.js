/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  mode: 'jit',
  content: [
    './src/**/*.{ts,tsx,mdx}',
    'node_modules/@polar-sh/ui/src/**/*.{ts,tsx}',
    'node_modules/@polar-sh/checkout/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    extend: {
      borderColor: {
        DEFAULT: 'rgb(0 0 0 / 0.07)',
      },
      boxShadow: {
        DEFAULT: `0 0px 15px rgba(0 0 0 / 0.04), 0 0px 2px rgba(0 0 0 / 0.06)`,
        lg: '0 0px 20px rgba(0 0 0 / 0.04), 0 0px 5px rgba(0 0 0 / 0.06)',
        xl: '0 0px 30px rgba(0 0 0 / 0.04), 0 0px 10px rgba(0 0 0 / 0.06)',
        '3xl': '0 0 50px rgba(0 0 0 / 0.02), 0 0 50px rgba(0 0 0 / 0.04)',
      },
      fontFamily: {
        sans: ['var(--font-geist)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...defaultTheme.fontFamily.mono],
      },
      fontSize: {
        xxs: '0.65rem',
      },
      colors: {
        blue: {
          DEFAULT: '#0062FF',
          50: '#E5EFFF',
          100: '#CCE0FF',
          200: '#99C0FF',
          300: '#66A1FF',
          400: '#3381FF',
          500: '#0062FF',
          600: '#0054DB',
          700: '#0047B8',
          800: '#003994',
          900: '#002B70',
          950: '#00245E',
        },
        green: {
          50: '#f0faf0',
          100: '#e2f6e3',
          200: '#c5edc6',
          300: '#97de9a',
          400: '#62c667',
          500: '#3fab44',
          600: '#2d8c31',
          700: '#266f29',
          800: '#235826',
          900: '#1e4921',
          950: '#0e2f11',
        },
        red: {
          50: '#fdf3f3',
          100: '#fde3e3',
          200: '#fbcdcd',
          300: '#f8a9a9',
          400: '#f17878',
          500: '#e64d4d',
          600: '#d32f2f',
          700: '#b12424',
          800: '#922222',
          900: '#6f1f1f',
          950: '#420d0d',
        },
        gray: {
          50: 'hsl(231, 10%, 98%)',
          100: 'hsl(233, 10%, 96.5%)',
          200: 'hsl(231, 10%, 94%)',
          300: 'hsl(231, 10%, 88%)',
          400: 'hsl(231, 10%, 60%)',
          500: 'hsl(233, 10%, 40%)',
          600: 'hsl(233, 10%, 30%)',
          700: 'hsl(233, 10%, 20%)',
          800: 'hsl(233, 10%, 10%)',
          900: 'hsl(233, 10%, 5%)',
          950: 'hsl(233, 10%, 0%)',
        },
        polar: {
          50: 'hsl(233, 5%, 85%)',
          100: 'hsl(233, 5%, 79%)',
          200: 'hsl(233, 5%, 68%)',
          300: 'hsl(233, 5%, 62%)',
          400: 'hsl(233, 5%, 52%)',
          500: 'hsl(233, 5%, 46%)',
          600: 'hsl(233, 5%, 24%)',
          700: 'hsl(233, 5%, 12%)',
          800: 'hsl(233, 5%, 9.5%)',
          900: 'hsl(233, 5%, 6.5%)',
          950: 'hsl(233, 5%, 3%)',
        },

        // chadcn/ui start
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        // chadcn/ui end
      },

      // chadcn/ui start
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '4xl': '2rem',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      // chadcn/ui end
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-radix')(),
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
  ],
}

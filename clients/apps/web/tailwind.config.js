/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme')
const colors = require('tailwindcss/colors')
const plugin = require('tailwindcss/plugin')

module.exports = {
  mode: 'jit',
  content: [
    './src/**/*.{ts,tsx}',
    'node_modules/polarkit/src/**/*.{ts,tsx}',
  ],
  theme: {
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      bold: '700',
      display: '350'
    },
    extend: {
      backgroundImage: {
        'grid-pattern': 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAmCAYAAACoPemuAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABSSURBVHgB7dihEYBAEATBf/JPEksEOCgEAYw70W3OTp3cvYY5r/v57rGGElYJq4RVwiphlbBKWCWsElYJq4RVwiphlbBKWCWsElbtf/OcZuzHXh9bB88+HN8BAAAAAElFTkSuQmCC")',
      },
      borderColor: {
        DEFAULT: "rgb(0 0 0 / 0.07)",
      },
      boxShadow: {
        DEFAULT: '0 1px 8px rgb(0 0 0 / 0.07), 0 0.5px 2.5px rgb(0 0 0 / 0.16)',
        lg: '0 5px 17px rgba(0 0 0 / 0.15), 0 0px 3px rgba(0 0 0 / 0.12)',
      },
      fontFamily: {
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
        display: ['Lexend', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        blue: {
          50: '#f2f6fc',
          100: '#e1ebf8',
          200: '#caddf3',
          300: '#a6c7ea', 
          400: '#7ba9df',
          500: '#5c8cd5',
          600: '#4872c8',
          700: '#3e60b7',
          800: '#374e96',
          900: '#2e4070',
          950: '#222c49',
        },
        gray: {
          50: '#FDFDFC',
          75: '#F8F8F6',
          100: '#F4F4F1',
          200: '#E5E5E1',
          300: '#D1D1CC',
          400: '#a3a3a3',
          500: '#727374',
          600: '#505153',
          700: '#3e3f42',
          800: '#26282b',
          900: '#181a1f',
          950: '#0b0b10',
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
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require("tailwindcss-radix")(),
    plugin(function({ addUtilities }) {
      const utilityStyles = {
        '.text-4xl': {
          fontWeight: '350',
          fontFamily: ['Lexend', defaultTheme.fontFamily.sans].toString(),
        },
      }
      utilityStyles['.text-5xl'] = utilityStyles['.text-4xl']
      utilityStyles['.text-6xl'] = utilityStyles['.text-4xl']
      utilityStyles['.text-7xl'] = utilityStyles['.text-4xl']
      utilityStyles['.text-8xl'] = utilityStyles['.text-4xl']
      utilityStyles['.text-9xl'] = utilityStyles['.text-4xl']

      utilityStyles['.bg-grid-pattern'] = {
        backgroundSize: '19px 19px',
      }

      addUtilities(utilityStyles)
    })
  ],
}
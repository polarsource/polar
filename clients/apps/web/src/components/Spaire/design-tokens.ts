/**
 * Spaire Design System Tokens
 * Based on Stripe Design System (SDS) principles
 *
 * Engineering-first approach: elegant, high-density, professional
 */

// Color Palette - Vibrant Neutral
export const colors = {
  // Backgrounds
  light: {
    bg: {
      primary: '#F6F9FC',      // Main background
      secondary: '#FFFFFF',    // Card/elevated surfaces
      tertiary: '#EDF2F7',     // Subtle sections
    },
    border: {
      subtle: '#E3E8EF',       // Card borders
      default: '#D1D9E6',      // Dividers
      strong: '#B8C4CE',       // Emphasized borders
    },
    text: {
      primary: '#0A2540',      // Headings
      secondary: '#425466',    // Body text
      tertiary: '#697386',     // Muted text
      quaternary: '#8792A2',   // Disabled/placeholder
    },
  },
  dark: {
    bg: {
      primary: '#0A192F',      // Main background (deep charcoal/slate)
      secondary: '#112240',    // Card/elevated surfaces
      tertiary: '#1D3A5F',     // Subtle sections
    },
    border: {
      subtle: '#1E3A5F',       // Card borders
      default: '#2D4A6F',      // Dividers
      strong: '#3D5A7F',       // Emphasized borders
    },
    text: {
      primary: '#E6F1FF',      // Headings
      secondary: '#A8B2D1',    // Body text
      tertiary: '#8892B0',     // Muted text
      quaternary: '#5C6B8A',   // Disabled/placeholder
    },
  },

  // Spaire Accent Colors (Wallet sub-brand)
  accent: {
    indigo: {
      50: '#EEF2FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#635BFF',   // Primary Spaire Indigo (Stripe-inspired)
      600: '#5046E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
    },
    teal: {
      50: '#F0FDFA',
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#14B8A6',   // Secondary accent
      600: '#0D9488',
      700: '#0F766E',
      800: '#115E59',
      900: '#134E4A',
    },
  },

  // Semantic colors
  semantic: {
    success: {
      light: '#10B981',
      dark: '#34D399',
      bg: {
        light: '#ECFDF5',
        dark: '#064E3B',
      },
    },
    warning: {
      light: '#F59E0B',
      dark: '#FBBF24',
      bg: {
        light: '#FFFBEB',
        dark: '#78350F',
      },
    },
    error: {
      light: '#EF4444',
      dark: '#F87171',
      bg: {
        light: '#FEF2F2',
        dark: '#7F1D1D',
      },
    },
    info: {
      light: '#3B82F6',
      dark: '#60A5FA',
      bg: {
        light: '#EFF6FF',
        dark: '#1E3A8A',
      },
    },
  },
} as const

// Typography - Poppins with tight letter-spacing
export const typography = {
  fontFamily: {
    sans: '"Poppins", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", Consolas, monospace',
  },
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.8125rem',   // 13px
    base: '0.875rem',  // 14px
    md: '0.9375rem',   // 15px
    lg: '1rem',        // 16px
    xl: '1.125rem',    // 18px
    '2xl': '1.25rem',  // 20px
    '3xl': '1.5rem',   // 24px
    '4xl': '2rem',     // 32px
    '5xl': '2.5rem',   // 40px
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  letterSpacing: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.01em',
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const

// Spacing - 8px grid system
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px (half-step for fine adjustments)
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const

// Elevation - Stripe's "Elevated Flat" style
export const elevation = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',

  // Dark mode shadows (more subtle)
  dark: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.2)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.2)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
  },
} as const

// Border radius
export const radius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
} as const

// Transitions
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  colors: 'color 200ms, background-color 200ms, border-color 200ms',
} as const

// Breakpoints
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// Container widths
export const containers = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1200px',
  '2xl': '1400px',
} as const

// Tailwind CSS class mappings for the design system
export const sdsClasses = {
  // Background colors
  bgPrimary: 'bg-[#F6F9FC] dark:bg-[#0A192F]',
  bgSecondary: 'bg-white dark:bg-[#112240]',
  bgTertiary: 'bg-[#EDF2F7] dark:bg-[#1D3A5F]',

  // Text colors
  textPrimary: 'text-[#0A2540] dark:text-[#E6F1FF]',
  textSecondary: 'text-[#425466] dark:text-[#A8B2D1]',
  textTertiary: 'text-[#697386] dark:text-[#8892B0]',
  textMuted: 'text-[#8792A2] dark:text-[#5C6B8A]',

  // Border colors
  borderSubtle: 'border-[#E3E8EF] dark:border-[#1E3A5F]',
  borderDefault: 'border-[#D1D9E6] dark:border-[#2D4A6F]',
  borderStrong: 'border-[#B8C4CE] dark:border-[#3D5A7F]',

  // Accent (Spaire Indigo)
  accentPrimary: 'text-[#635BFF] dark:text-[#818CF8]',
  accentBg: 'bg-[#635BFF] dark:bg-[#635BFF]',
  accentBgSubtle: 'bg-[#EEF2FF] dark:bg-[#312E81]',

  // Typography
  fontSans: 'font-[Poppins,system-ui,sans-serif]',
  fontMono: 'font-[JetBrains_Mono,SF_Mono,Consolas,monospace]',
  trackingTight: 'tracking-[-0.01em]',
  trackingTighter: 'tracking-[-0.02em]',

  // Elevation
  elevationSm: 'shadow-[0_1px_3px_0_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.4),0_1px_2px_-1px_rgba(0,0,0,0.2)]',
  elevationMd: 'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4),0_2px_4px_-2px_rgba(0,0,0,0.2)]',
  elevationLg: 'shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4),0_4px_6px_-4px_rgba(0,0,0,0.2)]',
} as const

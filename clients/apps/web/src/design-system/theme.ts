export const theme = {
  colors: {
    primary: 'var(--ds-primary)',
    'primary-hover': 'var(--ds-primary-hover)',
    secondary: 'var(--ds-secondary)',
    'secondary-hover': 'var(--ds-secondary-hover)',
    surface: 'var(--ds-surface)',
    page: 'var(--ds-page)',
    card: 'var(--ds-card)',
    elevated: 'var(--ds-elevated)',
    sidebar: 'var(--ds-sidebar)',
    destructive: 'var(--ds-destructive)',
    'ghost-hover': 'var(--ds-ghost-hover)',
    transparent: 'transparent',
    white: '#ffffff',
    black: '#000000',

    'text-primary': 'var(--ds-text-primary)',
    'text-secondary': 'var(--ds-text-secondary)',
    'text-muted': 'var(--ds-text-muted)',
    'text-inverted': 'var(--ds-text-inverted)',
    'text-destructive': 'var(--ds-text-destructive)',
    'text-link': 'var(--ds-text-link)',

    'border-default': 'var(--ds-border-default)',
    'border-subtle': 'var(--ds-border-subtle)',
    'border-strong': 'var(--ds-border-strong)',
    'border-primary': 'var(--ds-border-primary)',
    'border-destructive': 'var(--ds-border-destructive)',
    'border-transparent': 'transparent',
  },

  spacing: {
    none: 0,
    '2xs': 2,
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    '2xl': 40,
    '3xl': 48,
    '4xl': 64,
    '5xl': 80,
    '6xl': 96,
  },

  borderRadii: {
    none: 0,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 32,
    full: 9999,
  },

  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)',
    lg: '0 0px 20px rgba(0, 0, 0, 0.04), 0 0px 5px rgba(0, 0, 0, 0.06)',
    xl: '0 0px 30px rgba(0, 0, 0, 0.04), 0 0px 10px rgba(0, 0, 0, 0.06)',
    '3xl': '0 0 50px rgba(0, 0, 0, 0.02), 0 0 50px rgba(0, 0, 0, 0.04)',
  },

  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
} as const

export type Theme = typeof theme
export type ColorToken = keyof Theme['colors']
export type SpacingToken = keyof Theme['spacing']
export type BorderRadiusToken = keyof Theme['borderRadii']
export type ShadowToken = keyof Theme['shadows']
export type BreakpointKey = keyof Theme['breakpoints']

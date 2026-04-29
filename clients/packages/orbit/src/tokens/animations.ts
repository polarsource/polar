export const animationDelays = ['50', '100', '200', '400', '800'] as const

export type AnimationDelay = (typeof animationDelays)[number]

export type AnimationProperties = {
  opacity?: number
  translateX?: number
  translateY?: number
  scale?: number
  rotate?: number
}

export type AnimationEasing =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'

export type AnimationToken = {
  from?: AnimationProperties
  to?: AnimationProperties
  duration: number
  delay?: number
  easing: AnimationEasing
  repeat?: number | 'infinite'
  direction?: 'normal' | 'reverse' | 'alternate'
}

export const animations = {
  'slide-up': {
    from: { opacity: 0, translateY: 12 },
    to: { opacity: 1, translateY: 0 },
    duration: 300,
    easing: 'ease-out',
  },
  'slide-left': {
    from: { opacity: 0, translateX: 12 },
    to: { opacity: 1, translateX: 0 },
    duration: 300,
    easing: 'ease-out',
  },
  'fade-in': {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: 200,
    easing: 'ease-out',
  },
  'fade-out': {
    from: { opacity: 1 },
    to: { opacity: 0 },
    duration: 150,
    easing: 'ease-in',
  },
  'slide-down': {
    from: { opacity: 0, translateY: -12 },
    to: { opacity: 1, translateY: 0 },
    duration: 300,
    easing: 'ease-out',
  },
  'slide-right': {
    from: { opacity: 0, translateX: -12 },
    to: { opacity: 1, translateX: 0 },
    duration: 300,
    easing: 'ease-out',
  },
  'scale-in': {
    from: { opacity: 0, scale: 0.95 },
    to: { opacity: 1, scale: 1 },
    duration: 200,
    easing: 'ease-out',
  },
  'scale-out': {
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 0.95 },
    duration: 150,
    easing: 'ease-in',
  },
  pulse: {
    from: { opacity: 1 },
    to: { opacity: 0.5 },
    duration: 1500,
    easing: 'ease-in-out',
    repeat: 'infinite',
    direction: 'alternate',
  },
} as const satisfies Record<string, AnimationToken>

export type AnimationName = keyof typeof animations

import { PointerType } from '../types'
import { DragConfig, InternalDragOptions, Vector2 } from '../types'
import { V } from '../utils/maths'
import { coordinatesConfigResolver } from './coordinatesConfigResolver'
import { SUPPORT } from './support'

export const DEFAULT_PREVENT_SCROLL_DELAY = 250
export const DEFAULT_DRAG_DELAY = 180
export const DEFAULT_SWIPE_VELOCITY = 0.5
export const DEFAULT_SWIPE_DISTANCE = 50
export const DEFAULT_SWIPE_DURATION = 250
export const DEFAULT_KEYBOARD_DISPLACEMENT = 10

const DEFAULT_DRAG_AXIS_THRESHOLD: Record<PointerType, number> = { mouse: 0, touch: 0, pen: 8 }

export const dragConfigResolver = {
  ...coordinatesConfigResolver,
  device(
    this: InternalDragOptions,
    _v: any,
    _k: string,
    { pointer: { touch = false, lock = false, mouse = false } = {} }: DragConfig
  ) {
    this.pointerLock = lock && SUPPORT.pointerLock
    if (SUPPORT.touch && touch) return 'touch'
    if (this.pointerLock) return 'mouse'
    if (SUPPORT.pointer && !mouse) return 'pointer'
    if (SUPPORT.touch) return 'touch'
    return 'mouse'
  },
  preventScrollAxis(this: InternalDragOptions, value: 'x' | 'y' | 'xy', _k: string, { preventScroll }: DragConfig) {
    this.preventScrollDelay =
      typeof preventScroll === 'number'
        ? preventScroll
        : preventScroll || (preventScroll === undefined && value)
        ? DEFAULT_PREVENT_SCROLL_DELAY
        : undefined
    if (!SUPPORT.touchscreen || preventScroll === false) return undefined
    return value ? value : preventScroll !== undefined ? 'y' : undefined
  },
  pointerCapture(
    this: InternalDragOptions,
    _v: any,
    _k: string,
    { pointer: { capture = true, buttons = 1, keys = true } = {} }
  ) {
    this.pointerButtons = buttons
    this.keys = keys
    return !this.pointerLock && this.device === 'pointer' && capture
  },
  threshold(
    this: InternalDragOptions,
    value: number | Vector2,
    _k: string,
    { filterTaps = false, tapsThreshold = 3, axis = undefined }
  ) {
    // TODO add warning when value is 0 and filterTaps or axis is set
    const threshold = V.toVector(value, filterTaps ? tapsThreshold : axis ? 1 : 0)
    this.filterTaps = filterTaps
    this.tapsThreshold = tapsThreshold
    return threshold
  },
  swipe(
    this: InternalDragOptions,
    { velocity = DEFAULT_SWIPE_VELOCITY, distance = DEFAULT_SWIPE_DISTANCE, duration = DEFAULT_SWIPE_DURATION } = {}
  ) {
    return {
      velocity: this.transform(V.toVector(velocity)),
      distance: this.transform(V.toVector(distance)),
      duration
    }
  },
  delay(value: number | boolean = 0) {
    switch (value) {
      case true:
        return DEFAULT_DRAG_DELAY
      case false:
        return 0
      default:
        return value
    }
  },
  axisThreshold(value: Record<PointerType, number>) {
    if (!value) return DEFAULT_DRAG_AXIS_THRESHOLD
    return { ...DEFAULT_DRAG_AXIS_THRESHOLD, ...value }
  },
  keyboardDisplacement(value: number = DEFAULT_KEYBOARD_DISPLACEMENT) {
    return value
  }
}

if (process.env.NODE_ENV === 'development') {
  Object.assign(dragConfigResolver, {
    useTouch(value: any) {
      if (value !== undefined) {
        throw Error(
          `[@use-gesture]: \`useTouch\` option has been renamed to \`pointer.touch\`. Use it as in \`{ pointer: { touch: true } }\`.`
        )
      }
      return NaN
    },
    experimental_preventWindowScrollY(value: any) {
      if (value !== undefined) {
        throw Error(
          `[@use-gesture]: \`experimental_preventWindowScrollY\` option has been renamed to \`preventScroll\`.`
        )
      }
      return NaN
    },
    swipeVelocity(value: any) {
      if (value !== undefined) {
        throw Error(
          `[@use-gesture]: \`swipeVelocity\` option has been renamed to \`swipe.velocity\`. Use it as in \`{ swipe: { velocity: 0.5 } }\`.`
        )
      }
      return NaN
    },
    swipeDistance(value: any) {
      if (value !== undefined) {
        throw Error(
          `[@use-gesture]: \`swipeDistance\` option has been renamed to \`swipe.distance\`. Use it as in \`{ swipe: { distance: 50 } }\`.`
        )
      }
      return NaN
    },
    swipeDuration(value: any) {
      if (value !== undefined) {
        throw Error(
          `[@use-gesture]: \`swipeDuration\` option has been renamed to \`swipe.duration\`. Use it as in \`{ swipe: { duration: 250 } }\`.`
        )
      }
      return NaN
    }
  })
}

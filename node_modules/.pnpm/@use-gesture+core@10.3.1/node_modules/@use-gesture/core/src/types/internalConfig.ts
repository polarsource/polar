import { GestureKey, CoordinatesKey, ModifierKey } from './config'
import { State } from './state'
import { PointerType, Vector2 } from './utils'

export type InternalGenericOptions = {
  target?: () => EventTarget
  eventOptions: AddEventListenerOptions
  window: EventTarget
  enabled: boolean
  transform?: (v: Vector2) => Vector2
}

export type InternalGestureOptions<Key extends GestureKey = GestureKey> = {
  enabled: boolean
  eventOptions: AddEventListenerOptions
  from: Vector2 | ((state: State[Key]) => Vector2)
  threshold: Vector2
  preventDefault: boolean
  triggerAllEvents: boolean
  rubberband: Vector2
  bounds: [Vector2, Vector2] | ((state: State[Key]) => [Vector2, Vector2])
  hasCustomTransform: boolean
  transform: (v: Vector2) => Vector2
}

export type InternalCoordinatesOptions<Key extends CoordinatesKey = CoordinatesKey> = InternalGestureOptions<Key> & {
  axis?: 'x' | 'y'
  lockDirection: boolean
  axisThreshold: number
}

export type InternalDragOptions = Omit<InternalCoordinatesOptions<'drag'>, 'axisThreshold'> & {
  filterTaps: boolean
  tapsThreshold: number
  pointerButtons: number | number[]
  pointerCapture: boolean
  preventScrollDelay?: number
  preventScrollAxis?: 'x' | 'y' | 'xy'
  pointerLock: boolean
  keys: boolean
  device: 'pointer' | 'touch' | 'mouse'
  swipe: {
    velocity: Vector2
    distance: Vector2
    duration: number
  }
  delay: number
  axisThreshold: Record<PointerType, number>
  keyboardDisplacement: number
}

export type InternalPinchOptions = InternalGestureOptions<'pinch'> & {
  /**
   * When device is undefined, we'll be using wheel to zoom.
   */
  device: 'gesture' | 'pointer' | 'touch' | undefined
  lockDirection: boolean
  modifierKey: ModifierKey | NonNullable<ModifierKey>[]
  pinchOnWheel: boolean
}

type MoveAndHoverMouseOnly = {
  mouseOnly: boolean
}

export type InternalConfig = {
  shared: InternalGenericOptions
  drag?: InternalDragOptions
  wheel?: InternalCoordinatesOptions<'wheel'>
  scroll?: InternalCoordinatesOptions<'scroll'>
  move?: InternalCoordinatesOptions<'move'> & MoveAndHoverMouseOnly
  hover?: InternalCoordinatesOptions<'hover'> & MoveAndHoverMouseOnly
  pinch?: InternalPinchOptions
}

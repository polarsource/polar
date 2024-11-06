import { State } from './state'
import { Vector2, Target, PointerType, NonUndefined } from './utils'

export type GestureKey = Exclude<keyof State, 'shared'>
export type CoordinatesKey = Exclude<GestureKey, 'pinch'>

export type GenericOptions = {
  /**
   * Lets you specify a dom node or ref you want to attach the gesture to.
   */
  target?: Target
  /**
   * Lets you specify which window element the gesture should bind events to
   * (only relevant for the drag gesture).
   */
  window?: EventTarget
  /**
   * Lets you customize if you want events to be passive or captured.
   */
  eventOptions?: AddEventListenerOptions
  /**
   * When set to false none of the handlers will be fired.
   */
  enabled?: boolean
  /**
   * A function that you can use to transform movement and offset values. Useful
   * to map your screen coordinates to custom space coordinates such as a
   * canvas.
   */
  transform?: (v: Vector2) => Vector2
}

export type GestureOptions<T extends GestureKey> = GenericOptions & {
  /**
   * Whether the gesture is enabled.
   */
  enabled?: boolean
  /**
   * Lets you customize if you want events to be passive or captured.
   */
  eventOptions?: AddEventListenerOptions
  /**
   * The position `offset` will start from.
   */
  from?: Vector2 | ((state: NonUndefined<State[T]>) => Vector2)
  /**
   * The handler will fire only when the gesture displacement is greater than
   * the threshold.
   */
  threshold?: number | Vector2
  /**
   * The handler will preventDefault all events when `true`.
   */
  preventDefault?: boolean
  /**
   * Forces the handler to fire even for non intentional displacement (ignores
   * the threshold). In that case, the intentional attribute from state will
   * remain false until the threshold is reached.
   */
  triggerAllEvents?: boolean
  /**
   * The elasticity coefficient of the gesture when going out of bounds. When
   * set to true, the elasticiy coefficient will be defaulted to 0.15
   */
  rubberband?: boolean | number | Vector2
  /**
   * A function that you can use to transform movement and offset values. Useful
   * to map your screen coordinates to custom space coordinates such as a
   * canvas.
   */
  transform?: (v: Vector2) => Vector2
}

export type Bounds = {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export type CoordinatesConfig<Key extends CoordinatesKey = CoordinatesKey> = GestureOptions<Key> & {
  /**
   * The handler will only trigger if a movement is detected on the specified
   * axis.
   */
  axis?: 'x' | 'y' | 'lock'
  /**
   * Limits the gesture `offset` to the specified bounds.
   */
  bounds?: Bounds | ((state: State[Key]) => Bounds)
  /**
   * Determines the number of pixels in one direction needed for axises to be
   * calculated.
   */
  axisThreshold?: number
}

export type PinchBounds = { min?: number; max?: number }
export type ModifierKey = 'ctrlKey' | 'altKey' | 'metaKey' | null

export type PinchConfig = GestureOptions<'pinch'> & {
  pointer?: {
    /**
     * If true, pinch will use touch events on touch-enabled devices.
     */
    touch?: boolean
  }
  /**
   * Limits the scale `offset` to the specified bounds.
   */
  scaleBounds?: PinchBounds | ((state: State['pinch']) => PinchBounds)
  /**
   * Limits the angle `offset` to the specified bounds.
   */
  angleBounds?: PinchBounds | ((state: State['pinch']) => PinchBounds)
  /**
   * Scales OR rotates when set to 'lock'.
   */
  axis?: 'lock' | undefined
  /**
   * Key that triggers scale when using the wheel. Defaults to `'ctrlKey'`.
   */
  modifierKey?: ModifierKey | NonNullable<ModifierKey>[]
  /**
   * Whether wheel should trigger a pinch at all.
   */
  pinchOnWheel?: boolean
}

export type DragBounds = Bounds | HTMLElement | { current: HTMLElement | null }

type MoveAndHoverMouseOnly = {
  /**
   * If false, onMove or onHover handlers will also fire on touch devices.
   */
  mouseOnly?: boolean
}

export type MoveConfig = CoordinatesConfig<'move'> & MoveAndHoverMouseOnly

export type HoverConfig = MoveAndHoverMouseOnly

export type DragConfig = Omit<CoordinatesConfig<'drag'>, 'axisThreshold' | 'bounds'> & {
  /**
   * If true, the component won't trigger your drag logic if the user just clicked on the component.
   */
  filterTaps?: boolean
  /**
   * The maximum total displacement a tap can have
   */
  tapsThreshold?: number
  /**
   * Set this option to true when using with @react-three/fiber objects.
   */
  /**
   * Limits the gesture `offset` to the specified bounds. Can be a ref or a dom
   * node.
   */
  bounds?: DragBounds | ((state: State['drag']) => DragBounds)
  pointer?: {
    /**
     * The buttons combination that would trigger the drag. Use `-1` to allow
     * for any button combination to start the drag.
     */
    buttons?: number | number[]
    /**
     * If true, drag will use touch events on touch-enabled devices.
     */
    touch?: boolean
    /**
     * If true, drag will use touch events on touch-enabled devices, and use
     * mouse events on non touch devices.
     */
    mouse?: boolean
    /**
     * If false, will disable KeyboardEvents that would otherwise trigger the
     * drag gesture when the element is focused. Defaults to true.
     */
    keys?: boolean
    /**
     * Doesn't use setPointerCapture when false and delegate drag handling to
     * window
     */
    capture?: boolean
    /**
     * Will perform a pointer lock when drag starts, and exit pointer lock when
     * drag ends,
     */
    lock?: boolean
  }
  swipe?: {
    /**
     * The minimum velocity per axis (in pixels / ms) the drag gesture needs to
     * reach before the pointer is released.
     */
    velocity?: number | Vector2
    /**
     * The minimum distance per axis (in pixels) the drag gesture needs to
     * travel to trigger a swipe. Defaults to 50.
     */
    distance?: number | Vector2
    /**
     * The maximum duration in milliseconds that a swipe is detected. Defaults
     * to 250.
     */
    duration?: number
  }
  /**
   * If set, the drag will be triggered after the duration of the delay (in ms).
   * When set to true, delay is defaulted to 250ms.
   */
  preventScroll?: boolean | number
  /**
   * If set, the drag will allow scrolling in the direction of this axis until
   * the preventScroll duration has elapsed. Defaults to only 'y'.
   */
  preventScrollAxis?: 'x' | 'y' | 'xy'
  /**
   * If set, the handler will be delayed for the duration of the delay (in ms)
   * — or if the user starts moving. When set to true, delay is defaulted
   * to 180ms.
   */
  delay?: boolean | number
  /**
   * Key-number record that determines for each device (`'mouse'`, `'touch'`,
   * `'pen'`) the number of pixels of drag in one direction needed for axises to
   * be calculated.
   */
  axisThreshold?: Partial<Record<PointerType, number>>
  /**
   * The distance (in pixels) emulated by arrow keys.
   */
  keyboardDisplacement?: number
}

export type UserDragConfig = GenericOptions & DragConfig
export type UserPinchConfig = GenericOptions & PinchConfig
export type UserWheelConfig = GenericOptions & CoordinatesConfig<'wheel'>
export type UserScrollConfig = GenericOptions & CoordinatesConfig<'scroll'>
export type UserMoveConfig = GenericOptions & MoveConfig
export type UserHoverConfig = GenericOptions & HoverConfig

export type UserGestureConfig = GenericOptions & {
  drag?: DragConfig
  wheel?: CoordinatesConfig<'wheel'>
  scroll?: CoordinatesConfig<'scroll'>
  move?: MoveConfig
  pinch?: PinchConfig
  hover?: { enabled?: boolean } & HoverConfig
}

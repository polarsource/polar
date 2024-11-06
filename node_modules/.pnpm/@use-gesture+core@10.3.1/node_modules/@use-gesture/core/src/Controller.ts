import { EngineMap } from './actions'
import { parse } from './config/resolver'
import { isTouch, parseProp, toHandlerProp, touchIds } from './utils/events'
import { EventStore } from './EventStore'
import { TimeoutStore } from './TimeoutStore'
import { chain } from './utils/fn'
import { GestureKey, InternalConfig, InternalHandlers, NativeHandlers, State, UserGestureConfig } from './types'

export class Controller {
  /**
   * The list of gestures handled by the Controller.
   */
  public gestures = new Set<GestureKey>()
  /**
   * The event store that keeps track of the config.target listeners.
   */
  private _targetEventStore = new EventStore(this)
  /**
   * Object that keeps track of all gesture event listeners.
   */
  public gestureEventStores: { [key in GestureKey]?: EventStore } = {}
  public gestureTimeoutStores: { [key in GestureKey]?: TimeoutStore } = {}
  public handlers: InternalHandlers = {}
  private nativeHandlers?: NativeHandlers
  public config = {} as InternalConfig
  public pointerIds = new Set<number>()
  public touchIds = new Set<number>()
  public state = {
    shared: {
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false
    }
  } as State

  constructor(handlers: InternalHandlers) {
    resolveGestures(this, handlers)
  }
  /**
   * Sets pointer or touch ids based on the event.
   * @param event
   */
  setEventIds(event: TouchEvent | PointerEvent) {
    if (isTouch(event)) {
      this.touchIds = new Set(touchIds(event as TouchEvent))
      return this.touchIds
    } else if ('pointerId' in event) {
      if (event.type === 'pointerup' || event.type === 'pointercancel') this.pointerIds.delete(event.pointerId)
      else if (event.type === 'pointerdown') this.pointerIds.add(event.pointerId)
      return this.pointerIds
    }
  }
  /**
   * Attaches handlers to the controller.
   * @param handlers
   * @param nativeHandlers
   */
  applyHandlers(handlers: InternalHandlers, nativeHandlers?: NativeHandlers) {
    this.handlers = handlers
    this.nativeHandlers = nativeHandlers
  }
  /**
   * Compute and attaches a config to the controller.
   * @param config
   * @param gestureKey
   */
  applyConfig(config: UserGestureConfig, gestureKey?: GestureKey) {
    this.config = parse(config, gestureKey, this.config)
  }
  /**
   * Cleans all side effects (listeners, timeouts). When the gesture is
   * destroyed (in React, when the component is unmounted.)
   */
  clean() {
    this._targetEventStore.clean()
    for (const key of this.gestures) {
      this.gestureEventStores[key]!.clean()
      this.gestureTimeoutStores[key]!.clean()
    }
  }
  /**
   * Executes side effects (attaching listeners to a `config.target`). Ran on
   * each render.
   */
  effect() {
    if (this.config.shared.target) this.bind()
    return () => this._targetEventStore.clean()
  }
  /**
   * The bind function that can be returned by the gesture handler (a hook in
   * React for example.)
   * @param args
   */
  bind(...args: any[]) {
    const sharedConfig = this.config.shared
    const props: any = {}

    let target
    if (sharedConfig.target) {
      target = sharedConfig.target()
      // if target is undefined let's stop
      if (!target) return
    }

    if (sharedConfig.enabled) {
      // Adding gesture handlers
      for (const gestureKey of this.gestures) {
        const gestureConfig = this.config[gestureKey]!
        const bindFunction = bindToProps(props, gestureConfig.eventOptions, !!target)
        if (gestureConfig.enabled) {
          const Engine = EngineMap.get(gestureKey)!
          // @ts-ignore
          new Engine(this, args, gestureKey).bind(bindFunction)
        }
      }

      // Adding native handlers
      const nativeBindFunction = bindToProps(props, sharedConfig.eventOptions, !!target)
      for (const eventKey in this.nativeHandlers) {
        nativeBindFunction(
          eventKey,
          '',
          // @ts-ignore
          (event) => this.nativeHandlers[eventKey]({ ...this.state.shared, event, args }),
          undefined,
          true
        )
      }
    }

    // If target isn't set, we return an object that contains gesture handlers
    // mapped to props handler event keys.
    for (const handlerProp in props) {
      props[handlerProp] = chain(...props[handlerProp])
    }

    // When target isn't specified then return hanlder props.
    if (!target) return props

    // When target is specified, then add listeners to the controller target
    // store.
    for (const handlerProp in props) {
      const { device, capture, passive } = parseProp(handlerProp)
      this._targetEventStore.add(target, device, '', props[handlerProp], { capture, passive })
    }
  }
}

function setupGesture(ctrl: Controller, gestureKey: GestureKey) {
  ctrl.gestures.add(gestureKey)
  ctrl.gestureEventStores[gestureKey] = new EventStore(ctrl, gestureKey)
  ctrl.gestureTimeoutStores[gestureKey] = new TimeoutStore()
}

function resolveGestures(ctrl: Controller, internalHandlers: InternalHandlers) {
  // make sure hover handlers are added first to prevent bugs such as #322
  // where the hover pointerLeave handler is removed before the move
  // pointerLeave, which prevents hovering: false to be fired.
  if (internalHandlers.drag) setupGesture(ctrl, 'drag')
  if (internalHandlers.wheel) setupGesture(ctrl, 'wheel')
  if (internalHandlers.scroll) setupGesture(ctrl, 'scroll')
  if (internalHandlers.move) setupGesture(ctrl, 'move')
  if (internalHandlers.pinch) setupGesture(ctrl, 'pinch')
  if (internalHandlers.hover) setupGesture(ctrl, 'hover')
}

const bindToProps =
  (props: any, eventOptions: AddEventListenerOptions, withPassiveOption: boolean) =>
  (
    device: string,
    action: string,
    handler: (event: any) => void,
    options: AddEventListenerOptions = {},
    isNative = false
  ) => {
    const capture = options.capture ?? eventOptions.capture
    const passive = options.passive ?? eventOptions.passive
    // a native handler is already passed as a prop like "onMouseDown"
    let handlerProp = isNative ? device : toHandlerProp(device, action, capture)
    if (withPassiveOption && passive) handlerProp += 'Passive'
    props[handlerProp] = props[handlerProp] || []
    props[handlerProp].push(handler)
  }

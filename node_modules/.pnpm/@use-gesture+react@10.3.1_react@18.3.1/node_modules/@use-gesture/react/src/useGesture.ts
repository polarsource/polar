import { dragAction, pinchAction, scrollAction, wheelAction, moveAction, hoverAction } from '@use-gesture/core/actions'
import { GestureHandlers, UserGestureConfig, EventTypes, AnyHandlerEventTypes } from '@use-gesture/core/types'
import { createUseGesture } from './createUseGesture'

/**
 * @public
 *
 * The most complete gesture hook, allowing support for multiple gestures.
 *
 * @param {GestureHandlers} handlers - an object with on[Gesture] keys containg gesture handlers
 * @param {UserGestureConfig} config - the full config object
 */
export function useGesture<
  HandlerTypes extends AnyHandlerEventTypes = EventTypes,
  Config extends UserGestureConfig = UserGestureConfig
>(handlers: GestureHandlers<HandlerTypes>, config?: Config) {
  const hook = createUseGesture([dragAction, pinchAction, scrollAction, wheelAction, moveAction, hoverAction])
  return hook(handlers, config || ({} as Config))
}

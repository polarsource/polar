import { registerAction, wheelAction } from '@use-gesture/core/actions'
import { UserWheelConfig, Handler, EventTypes } from '@use-gesture/core/types'
import { useRecognizers } from './useRecognizers'

/**
 * Wheel hook.
 *
 * @param {Handler<'wheel'>} handler - the function fired every time the wheel gesture updates
 * @param {UserWheelConfig} config - the config object including generic options and wheel options
 */
export function useWheel<EventType = EventTypes['wheel'], Config extends UserWheelConfig = UserWheelConfig>(
  handler: Handler<'wheel', EventType>,
  config?: Config
) {
  registerAction(wheelAction)
  return useRecognizers({ wheel: handler }, config || {}, 'wheel')
}

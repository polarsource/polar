import { registerAction, hoverAction } from '@use-gesture/core/actions'
import { EventTypes, UserHoverConfig, Handler } from '@use-gesture/core/types'
import { useRecognizers } from './useRecognizers'

/**
 * Hover hook.
 *
 * @param {Handler<'hover'>} handler - the function fired every time the hover gesture updates
 * @param {UserHoverConfig} config - the config object including generic options and hover options
 */
export function useHover<EventType = EventTypes['hover'], Config extends UserHoverConfig = UserHoverConfig>(
  handler: Handler<'hover', EventType>,
  config?: Config
) {
  registerAction(hoverAction)
  return useRecognizers({ hover: handler }, config || {}, 'hover')
}

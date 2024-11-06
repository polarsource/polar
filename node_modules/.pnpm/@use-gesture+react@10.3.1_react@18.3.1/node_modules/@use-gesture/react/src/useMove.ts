import { registerAction, moveAction } from '@use-gesture/core/actions'
import { UserMoveConfig, Handler, EventTypes } from '@use-gesture/core/types'
import { useRecognizers } from './useRecognizers'

/**
 * Move hook.
 *
 * @param {Handler<'move'>} handler - the function fired every time the move gesture updates
 * @param {UserMoveConfig} config - the config object including generic options and move options
 */
export function useMove<EventType = EventTypes['move'], Config extends UserMoveConfig = UserMoveConfig>(
  handler: Handler<'move', EventType>,
  config?: Config
) {
  registerAction(moveAction)
  return useRecognizers({ move: handler }, config || {}, 'move')
}

import { parseMergedHandlers } from '@use-gesture/core'
import { registerAction } from '@use-gesture/core/actions'
import { Action, GestureHandlers, UserGestureConfig } from '@use-gesture/core/types'
import { useRecognizers } from './useRecognizers'

export function createUseGesture(actions: Action[]) {
  actions.forEach(registerAction)

  return function useGesture<Config extends UserGestureConfig = UserGestureConfig>(
    _handlers: GestureHandlers,
    _config?: Config
  ) {
    const { handlers, nativeHandlers, config } = parseMergedHandlers(_handlers, _config || {})
    return useRecognizers<Config>(handlers, config, undefined, nativeHandlers)
  }
}

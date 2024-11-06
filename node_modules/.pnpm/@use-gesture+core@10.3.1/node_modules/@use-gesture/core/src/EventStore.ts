import type { Controller } from './Controller'
import { GestureKey } from './types'
import { toDomEventType } from './utils/events'

export class EventStore {
  private _listeners = new Set<() => void>()
  private _ctrl: Controller
  private _gestureKey?: GestureKey
  constructor(ctrl: Controller, gestureKey?: GestureKey) {
    this._ctrl = ctrl
    this._gestureKey = gestureKey
  }

  add(
    element: EventTarget,
    device: string,
    action: string,
    handler: (event: any) => void,
    options?: AddEventListenerOptions
  ) {
    const listeners = this._listeners
    const type = toDomEventType(device, action)
    const _options = this._gestureKey ? this._ctrl.config[this._gestureKey]!.eventOptions : {}
    const eventOptions = { ..._options, ...options }
    element.addEventListener(type, handler, eventOptions)
    const remove = () => {
      element.removeEventListener(type, handler, eventOptions)
      listeners.delete(remove)
    }
    listeners.add(remove)
    return remove
  }

  clean() {
    this._listeners.forEach((remove) => remove())
    this._listeners.clear() // just for safety
  }
}

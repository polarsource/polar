import { Engine } from './Engine'
import { touchDistanceAngle, distanceAngle, wheelValues } from '../utils/events'
import { V } from '../utils/maths'
import { Vector2, WebKitGestureEvent } from '../types'
import { clampStateInternalMovementToBounds } from '../utils/state'

const SCALE_ANGLE_RATIO_INTENT_DEG = 30
const PINCH_WHEEL_RATIO = 100

export class PinchEngine extends Engine<'pinch'> {
  ingKey = 'pinching' as const
  aliasKey = 'da'

  init() {
    this.state.offset = [1, 0]
    this.state.lastOffset = [1, 0]
    this.state._pointerEvents = new Map()
  }

  // superseeds generic Engine reset call
  reset() {
    super.reset()
    const state = this.state
    state._touchIds = []
    state.canceled = false
    state.cancel = this.cancel.bind(this)
    state.turns = 0
  }

  computeOffset() {
    const { type, movement, lastOffset } = this.state
    if (type === 'wheel') {
      this.state.offset = V.add(movement, lastOffset)
    } else {
      this.state.offset = [(1 + movement[0]) * lastOffset[0], movement[1] + lastOffset[1]]
    }
  }

  computeMovement() {
    const { offset, lastOffset } = this.state
    this.state.movement = [offset[0] / lastOffset[0], offset[1] - lastOffset[1]]
  }

  axisIntent() {
    const state = this.state
    const [_m0, _m1] = state._movement
    if (!state.axis) {
      const axisMovementDifference = Math.abs(_m0) * SCALE_ANGLE_RATIO_INTENT_DEG - Math.abs(_m1)
      if (axisMovementDifference < 0) state.axis = 'angle'
      else if (axisMovementDifference > 0) state.axis = 'scale'
    }
  }

  restrictToAxis(v: Vector2) {
    if (this.config.lockDirection) {
      if (this.state.axis === 'scale') v[1] = 0
      else if (this.state.axis === 'angle') v[0] = 0
    }
  }

  cancel() {
    const state = this.state
    if (state.canceled) return
    setTimeout(() => {
      state.canceled = true
      state._active = false
      // we run compute with no event so that kinematics won't be computed
      this.compute()
      this.emit()
    }, 0)
  }

  touchStart(event: TouchEvent) {
    this.ctrl.setEventIds(event)
    const state = this.state
    const ctrlTouchIds = this.ctrl.touchIds

    if (state._active) {
      // check that the touchIds that initiated the gesture are still enabled
      // This is useful for when the page loses track of the pointers (minifying
      // gesture on iPad).
      if (state._touchIds.every((id) => ctrlTouchIds.has(id))) return
      // The gesture is still active, but probably didn't have the opportunity to
      // end properly, so we restart the pinch.
    }

    if (ctrlTouchIds.size < 2) return

    this.start(event)
    state._touchIds = Array.from(ctrlTouchIds).slice(0, 2) as [number, number]

    const payload = touchDistanceAngle(event, state._touchIds)

    if (!payload) return
    this.pinchStart(event, payload)
  }

  pointerStart(event: PointerEvent) {
    if (event.buttons != null && event.buttons % 2 !== 1) return
    this.ctrl.setEventIds(event)
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
    const state = this.state
    const _pointerEvents = state._pointerEvents
    const ctrlPointerIds = this.ctrl.pointerIds

    if (state._active) {
      // see touchStart comment
      if (Array.from(_pointerEvents.keys()).every((id) => ctrlPointerIds.has(id))) return
    }

    if (_pointerEvents.size < 2) {
      _pointerEvents.set(event.pointerId, event)
    }

    if (state._pointerEvents.size < 2) return

    this.start(event)

    // @ts-ignore
    const payload = distanceAngle(...Array.from(_pointerEvents.values()))

    if (!payload) return
    this.pinchStart(event, payload)
  }

  pinchStart(event: PointerEvent | TouchEvent, payload: { distance: number; angle: number; origin: Vector2 }) {
    const state = this.state
    state.origin = payload.origin
    this.computeValues([payload.distance, payload.angle])
    this.computeInitial()

    this.compute(event)
    this.emit()
  }

  touchMove(event: TouchEvent) {
    if (!this.state._active) return
    const payload = touchDistanceAngle(event, this.state._touchIds)

    if (!payload) return
    this.pinchMove(event, payload)
  }

  pointerMove(event: PointerEvent) {
    const _pointerEvents = this.state._pointerEvents
    if (_pointerEvents.has(event.pointerId)) {
      _pointerEvents.set(event.pointerId, event)
    }
    if (!this.state._active) return
    // @ts-ignore
    const payload = distanceAngle(...Array.from(_pointerEvents.values()))

    if (!payload) return
    this.pinchMove(event, payload)
  }

  pinchMove(event: PointerEvent | TouchEvent, payload: { distance: number; angle: number; origin: Vector2 }) {
    const state = this.state
    const prev_a = state._values[1]
    const delta_a = payload.angle - prev_a

    let delta_turns = 0
    if (Math.abs(delta_a) > 270) delta_turns += Math.sign(delta_a)

    this.computeValues([payload.distance, payload.angle - 360 * delta_turns])

    state.origin = payload.origin
    state.turns = delta_turns
    state._movement = [state._values[0] / state._initial[0] - 1, state._values[1] - state._initial[1]]

    this.compute(event)
    this.emit()
  }

  touchEnd(event: TouchEvent) {
    this.ctrl.setEventIds(event)
    if (!this.state._active) return

    if (this.state._touchIds.some((id) => !this.ctrl.touchIds.has(id))) {
      this.state._active = false

      this.compute(event)
      this.emit()
    }
  }

  pointerEnd(event: PointerEvent) {
    const state = this.state
    this.ctrl.setEventIds(event)
    try {
      // @ts-ignore r3f
      event.target.releasePointerCapture(event.pointerId)
    } catch {}

    if (state._pointerEvents.has(event.pointerId)) {
      state._pointerEvents.delete(event.pointerId)
    }

    if (!state._active) return

    if (state._pointerEvents.size < 2) {
      state._active = false
      this.compute(event)
      this.emit()
    }
  }

  gestureStart(event: WebKitGestureEvent) {
    if (event.cancelable) event.preventDefault()
    const state = this.state

    if (state._active) return

    this.start(event)
    this.computeValues([event.scale, event.rotation])
    state.origin = [event.clientX, event.clientY]
    this.compute(event)

    this.emit()
  }

  gestureMove(event: WebKitGestureEvent) {
    if (event.cancelable) event.preventDefault()

    if (!this.state._active) return

    const state = this.state

    this.computeValues([event.scale, event.rotation])
    state.origin = [event.clientX, event.clientY]
    const _previousMovement = state._movement
    state._movement = [event.scale - 1, event.rotation]
    state._delta = V.sub(state._movement, _previousMovement)
    this.compute(event)
    this.emit()
  }

  gestureEnd(event: WebKitGestureEvent) {
    if (!this.state._active) return

    this.state._active = false

    this.compute(event)
    this.emit()
  }

  wheel(event: WheelEvent) {
    const modifierKey = this.config.modifierKey
    if (modifierKey && (Array.isArray(modifierKey) ? !modifierKey.find((k) => event[k]) : !event[modifierKey])) return
    if (!this.state._active) this.wheelStart(event)
    else this.wheelChange(event)
    this.timeoutStore.add('wheelEnd', this.wheelEnd.bind(this))
  }

  wheelStart(event: WheelEvent) {
    this.start(event)
    this.wheelChange(event)
  }

  wheelChange(event: WheelEvent) {
    const isR3f = 'uv' in event
    if (!isR3f) {
      if (event.cancelable) {
        event.preventDefault()
      }
      if (process.env.NODE_ENV === 'development' && !event.defaultPrevented) {
        // eslint-disable-next-line no-console
        console.warn(
          `[@use-gesture]: To properly support zoom on trackpads, try using the \`target\` option.\n\nThis message will only appear in development mode.`
        )
      }
    }
    const state = this.state
    state._delta = [(-wheelValues(event)[1] / PINCH_WHEEL_RATIO) * state.offset[0], 0]
    V.addTo(state._movement, state._delta)

    // _movement rolls back to when it passed the bounds.
    clampStateInternalMovementToBounds(state)

    this.state.origin = [event.clientX, event.clientY]

    this.compute(event)
    this.emit()
  }

  wheelEnd() {
    if (!this.state._active) return
    this.state._active = false
    this.compute()
    this.emit()
  }

  bind(bindFunction: any) {
    const device = this.config.device
    if (!!device) {
      // @ts-ignore
      bindFunction(device, 'start', this[device + 'Start'].bind(this))
      // @ts-ignore
      bindFunction(device, 'change', this[device + 'Move'].bind(this))
      // @ts-ignore
      bindFunction(device, 'end', this[device + 'End'].bind(this))
      // @ts-ignore
      bindFunction(device, 'cancel', this[device + 'End'].bind(this))
      // @ts-ignore
      bindFunction('lostPointerCapture', '', this[device + 'End'].bind(this))
    }
    // we try to set a passive listener, knowing that in any case React will
    // ignore it.
    if (this.config.pinchOnWheel) {
      bindFunction('wheel', '', this.wheel.bind(this), { passive: false })
    }
  }
}

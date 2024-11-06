import { CoordinatesEngine } from './CoordinatesEngine'
import { coordinatesConfigResolver } from '../config/coordinatesConfigResolver'
import { pointerId, getPointerType, pointerValues } from '../utils/events'
import { V } from '../utils/maths'
import { Vector2 } from '../types'

const KEYS_DELTA_MAP = {
  ArrowRight: (displacement: number, factor: number = 1) => [displacement * factor, 0],
  ArrowLeft: (displacement: number, factor: number = 1) => [-1 * displacement * factor, 0],
  ArrowUp: (displacement: number, factor: number = 1) => [0, -1 * displacement * factor],
  ArrowDown: (displacement: number, factor: number = 1) => [0, displacement * factor]
}

export class DragEngine extends CoordinatesEngine<'drag'> {
  ingKey = 'dragging' as const

  // superseeds generic Engine reset call
  reset(this: DragEngine) {
    super.reset()
    const state = this.state
    state._pointerId = undefined
    state._pointerActive = false
    state._keyboardActive = false
    state._preventScroll = false
    state._delayed = false
    state.swipe = [0, 0]
    state.tap = false
    state.canceled = false
    state.cancel = this.cancel.bind(this)
  }

  setup() {
    const state = this.state

    if (state._bounds instanceof HTMLElement) {
      const boundRect = state._bounds.getBoundingClientRect()
      const targetRect = (state.currentTarget as HTMLElement).getBoundingClientRect()
      const _bounds = {
        left: boundRect.left - targetRect.left + state.offset[0],
        right: boundRect.right - targetRect.right + state.offset[0],
        top: boundRect.top - targetRect.top + state.offset[1],
        bottom: boundRect.bottom - targetRect.bottom + state.offset[1]
      }
      state._bounds = coordinatesConfigResolver.bounds(_bounds) as [Vector2, Vector2]
    }
  }

  cancel() {
    const state = this.state
    if (state.canceled) return
    state.canceled = true
    state._active = false
    setTimeout(() => {
      // we run compute with no event so that kinematics won't be computed
      this.compute()
      this.emit()
    }, 0)
  }

  setActive() {
    this.state._active = this.state._pointerActive || this.state._keyboardActive
  }

  // superseeds Engine clean function
  clean() {
    this.pointerClean()
    this.state._pointerActive = false
    this.state._keyboardActive = false
    super.clean()
  }

  pointerDown(event: PointerEvent) {
    const config = this.config
    const state = this.state

    if (
      event.buttons != null &&
      // If the user submits an array as pointer.buttons, don't start the drag
      // if event.buttons isn't included inside that array.
      (Array.isArray(config.pointerButtons)
        ? !config.pointerButtons.includes(event.buttons)
        : // If the user submits a number as pointer.buttons, refuse the drag if
          // config.pointerButtons is different than `-1` and if event.buttons
          // doesn't match the combination.
          config.pointerButtons !== -1 && config.pointerButtons !== event.buttons)
    )
      return

    const ctrlIds = this.ctrl.setEventIds(event)
    // We need to capture all pointer ids so that we can keep track of them when
    // they're released off the target
    if (config.pointerCapture) {
      ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
    }

    if (
      // in some situations (https://github.com/pmndrs/use-gesture/issues/494#issuecomment-1127584116)
      // like when a new browser tab is opened during a drag gesture, the drag
      // can be interrupted mid-way, and can stall. This happens because the
      // pointerId that initiated the gesture is lost, and since the drag
      // persists until that pointerId is lifted with pointerup, it never ends.
      //
      // Therefore, when we detect that only one pointer is pressing the screen,
      // we consider that the gesture can proceed.
      ctrlIds &&
      ctrlIds.size > 1 &&
      state._pointerActive
    )
      return

    this.start(event)
    this.setupPointer(event)

    state._pointerId = pointerId(event)
    state._pointerActive = true

    this.computeValues(pointerValues(event))
    this.computeInitial()

    if (config.preventScrollAxis && getPointerType(event) !== 'mouse') {
      // when preventScrollAxis is set we don't consider the gesture active
      // until it's deliberate
      state._active = false
      this.setupScrollPrevention(event)
    } else if (config.delay > 0) {
      this.setupDelayTrigger(event)
      // makes sure we emit all events when `triggerAllEvents` flag is `true`
      if (config.triggerAllEvents) {
        this.compute(event)
        this.emit()
      }
    } else {
      this.startPointerDrag(event)
    }
  }

  startPointerDrag(event: PointerEvent) {
    const state = this.state
    state._active = true
    state._preventScroll = true
    state._delayed = false

    this.compute(event)
    this.emit()
  }

  pointerMove(event: PointerEvent) {
    const state = this.state
    const config = this.config

    if (!state._pointerActive) return

    const id = pointerId(event)
    if (state._pointerId !== undefined && id !== state._pointerId) return
    const _values = pointerValues(event)

    if (document.pointerLockElement === event.target) {
      state._delta = [event.movementX, event.movementY]
    } else {
      state._delta = V.sub(_values, state._values)
      this.computeValues(_values)
    }

    V.addTo(state._movement, state._delta)
    this.compute(event)

    // if the gesture is delayed but deliberate, then we can start it
    // immediately.
    if (state._delayed && state.intentional) {
      this.timeoutStore.remove('dragDelay')
      // makes sure `first` is still true when moving for the first time after a
      // delay.
      state.active = false
      this.startPointerDrag(event)
      return
    }

    if (config.preventScrollAxis && !state._preventScroll) {
      if (state.axis) {
        if (state.axis === config.preventScrollAxis || config.preventScrollAxis === 'xy') {
          state._active = false
          this.clean()
          return
        } else {
          this.timeoutStore.remove('startPointerDrag')
          this.startPointerDrag(event)
          return
        }
      } else {
        return
      }
    }

    this.emit()
  }

  pointerUp(event: PointerEvent) {
    this.ctrl.setEventIds(event)
    // We release the pointer id if it has pointer capture
    try {
      if (this.config.pointerCapture && (event.target as HTMLElement).hasPointerCapture(event.pointerId)) {
        // this shouldn't be necessary as it should be automatic when releasing the pointer
        ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
      }
    } catch {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn(
          `[@use-gesture]: If you see this message, it's likely that you're using an outdated version of \`@react-three/fiber\`. \n\nPlease upgrade to the latest version.`
        )
      }
    }

    const state = this.state
    const config = this.config

    if (!state._active || !state._pointerActive) return

    const id = pointerId(event)
    if (state._pointerId !== undefined && id !== state._pointerId) return

    this.state._pointerActive = false
    this.setActive()
    this.compute(event)

    const [dx, dy] = state._distance
    state.tap = dx <= config.tapsThreshold && dy <= config.tapsThreshold

    if (state.tap && config.filterTaps) {
      state._force = true
    } else {
      const [_dx, _dy] = state._delta
      const [_mx, _my] = state._movement
      const [svx, svy] = config.swipe.velocity
      const [sx, sy] = config.swipe.distance
      const sdt = config.swipe.duration

      if (state.elapsedTime < sdt) {
        const _vx = Math.abs(_dx / state.timeDelta)
        const _vy = Math.abs(_dy / state.timeDelta)

        if (_vx > svx && Math.abs(_mx) > sx) state.swipe[0] = Math.sign(_dx)
        if (_vy > svy && Math.abs(_my) > sy) state.swipe[1] = Math.sign(_dy)
      }
    }

    this.emit()
  }

  pointerClick(event: MouseEvent) {
    // event.detail indicates the number of buttons being pressed. When it's
    // null, it's likely to be a keyboard event from the Enter Key that could
    // be used for accessibility, and therefore shouldn't be prevented.
    // See https://github.com/pmndrs/use-gesture/issues/530
    if (!this.state.tap && event.detail > 0) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  setupPointer(event: PointerEvent) {
    const config = this.config
    const device = config.device

    if (process.env.NODE_ENV === 'development') {
      try {
        if (device === 'pointer' && config.preventScrollDelay === undefined) {
          // @ts-ignore (warning for r3f)
          const currentTarget = 'uv' in event ? event.sourceEvent.currentTarget : event.currentTarget
          const style = window.getComputedStyle(currentTarget)
          if (style.touchAction === 'auto') {
            // eslint-disable-next-line no-console
            console.warn(
              `[@use-gesture]: The drag target has its \`touch-action\` style property set to \`auto\`. It is recommended to add \`touch-action: 'none'\` so that the drag gesture behaves correctly on touch-enabled devices. For more information read this: https://use-gesture.netlify.app/docs/extras/#touch-action.\n\nThis message will only show in development mode. It won't appear in production. If this is intended, you can ignore it.`,
              currentTarget
            )
          }
        }
      } catch {}
    }

    if (config.pointerLock) {
      ;(event.currentTarget as HTMLElement).requestPointerLock()
    }

    if (!config.pointerCapture) {
      this.eventStore.add(this.sharedConfig.window, device, 'change', this.pointerMove.bind(this))
      this.eventStore.add(this.sharedConfig.window, device, 'end', this.pointerUp.bind(this))
      this.eventStore.add(this.sharedConfig.window, device, 'cancel', this.pointerUp.bind(this))
    }
  }

  pointerClean() {
    if (this.config.pointerLock && document.pointerLockElement === this.state.currentTarget) {
      document.exitPointerLock()
    }
  }

  preventScroll(event: PointerEvent) {
    if (this.state._preventScroll && event.cancelable) {
      event.preventDefault()
    }
  }

  setupScrollPrevention(event: PointerEvent) {
    // fixes https://github.com/pmndrs/use-gesture/issues/497
    this.state._preventScroll = false
    persistEvent(event)
    // we add window listeners that will prevent the scroll when the user has started dragging
    const remove = this.eventStore.add(this.sharedConfig.window, 'touch', 'change', this.preventScroll.bind(this), {
      passive: false
    })
    this.eventStore.add(this.sharedConfig.window, 'touch', 'end', remove)
    this.eventStore.add(this.sharedConfig.window, 'touch', 'cancel', remove)
    this.timeoutStore.add('startPointerDrag', this.startPointerDrag.bind(this), this.config.preventScrollDelay!, event)
  }

  setupDelayTrigger(event: PointerEvent) {
    this.state._delayed = true
    this.timeoutStore.add(
      'dragDelay',
      () => {
        // forces drag to start no matter the threshold when delay is reached
        this.state._step = [0, 0]
        this.startPointerDrag(event)
      },
      this.config.delay
    )
  }

  keyDown(event: KeyboardEvent) {
    // @ts-ignore
    const deltaFn = KEYS_DELTA_MAP[event.key]
    if (deltaFn) {
      const state = this.state
      const factor = event.shiftKey ? 10 : event.altKey ? 0.1 : 1

      this.start(event)

      state._delta = deltaFn(this.config.keyboardDisplacement, factor)
      state._keyboardActive = true
      V.addTo(state._movement, state._delta)

      this.compute(event)
      this.emit()
    }
  }

  keyUp(event: KeyboardEvent) {
    if (!(event.key in KEYS_DELTA_MAP)) return

    this.state._keyboardActive = false
    this.setActive()
    this.compute(event)
    this.emit()
  }

  bind(bindFunction: any) {
    const device = this.config.device

    bindFunction(device, 'start', this.pointerDown.bind(this))

    if (this.config.pointerCapture) {
      bindFunction(device, 'change', this.pointerMove.bind(this))
      bindFunction(device, 'end', this.pointerUp.bind(this))
      bindFunction(device, 'cancel', this.pointerUp.bind(this))
      bindFunction('lostPointerCapture', '', this.pointerUp.bind(this))
    }

    if (this.config.keys) {
      bindFunction('key', 'down', this.keyDown.bind(this))
      bindFunction('key', 'up', this.keyUp.bind(this))
    }
    if (this.config.filterTaps) {
      bindFunction('click', '', this.pointerClick.bind(this), { capture: true, passive: false })
    }
  }
}

function persistEvent(event: PointerEvent) {
  // @ts-ignore
  'persist' in event && typeof event.persist === 'function' && event.persist()
}

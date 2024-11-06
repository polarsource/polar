import { CoordinatesEngine } from './CoordinatesEngine'
import { wheelValues } from '../utils/events'
import { V } from '../utils/maths'
import { clampStateInternalMovementToBounds } from '../utils/state'

export interface WheelEngine extends CoordinatesEngine<'wheel'> {
  wheel(this: WheelEngine, event: WheelEvent): void
  wheelChange(this: WheelEngine, event: WheelEvent): void
  wheelEnd(this: WheelEngine): void
}

export class WheelEngine extends CoordinatesEngine<'wheel'> {
  ingKey = 'wheeling' as const

  wheel(event: WheelEvent) {
    if (!this.state._active) this.start(event)
    this.wheelChange(event)
    this.timeoutStore.add('wheelEnd', this.wheelEnd.bind(this))
  }

  wheelChange(event: WheelEvent) {
    const state = this.state
    state._delta = wheelValues(event)
    V.addTo(state._movement, state._delta)

    // _movement rolls back to when it passed the bounds.
    clampStateInternalMovementToBounds(state)

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
    bindFunction('wheel', '', this.wheel.bind(this))
  }
}

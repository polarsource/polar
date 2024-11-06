import { CoordinatesEngine } from './CoordinatesEngine'
import { pointerValues } from '../utils/events'
import { V } from '../utils/maths'

export class MoveEngine extends CoordinatesEngine<'move'> {
  ingKey = 'moving' as const

  move(event: PointerEvent) {
    if (this.config.mouseOnly && event.pointerType !== 'mouse') return
    if (!this.state._active) this.moveStart(event)
    else this.moveChange(event)
    this.timeoutStore.add('moveEnd', this.moveEnd.bind(this))
  }

  moveStart(event: PointerEvent) {
    this.start(event)
    this.computeValues(pointerValues(event))
    this.compute(event)
    this.computeInitial()
    this.emit()
  }

  moveChange(event: PointerEvent) {
    if (!this.state._active) return
    const values = pointerValues(event)
    const state = this.state
    state._delta = V.sub(values, state._values)
    V.addTo(state._movement, state._delta)

    this.computeValues(values)

    this.compute(event)
    this.emit()
  }

  moveEnd(event?: PointerEvent) {
    if (!this.state._active) return
    this.state._active = false
    this.compute(event)
    this.emit()
  }

  bind(bindFunction: any) {
    bindFunction('pointer', 'change', this.move.bind(this))
    bindFunction('pointer', 'leave', this.moveEnd.bind(this))
  }
}

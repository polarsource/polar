import { Engine } from './Engine'
import { V } from '../utils/maths'
import { CoordinatesKey, Vector2 } from '../types'
import { getPointerType } from '../utils/events'

function selectAxis([dx, dy]: Vector2, threshold: number) {
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx > absDy && absDx > threshold) {
    return 'x'
  }
  if (absDy > absDx && absDy > threshold) {
    return 'y'
  }
  return undefined
}

export abstract class CoordinatesEngine<Key extends CoordinatesKey> extends Engine<Key> {
  aliasKey = 'xy'

  reset() {
    super.reset()
    this.state.axis = undefined
  }

  init() {
    this.state.offset = [0, 0]
    this.state.lastOffset = [0, 0]
  }

  computeOffset() {
    this.state.offset = V.add(this.state.lastOffset, this.state.movement)
  }

  computeMovement() {
    this.state.movement = V.sub(this.state.offset, this.state.lastOffset)
  }

  axisIntent(event?: UIEvent) {
    const state = this.state
    const config = this.config

    if (!state.axis && event) {
      const threshold =
        typeof config.axisThreshold === 'object' ? config.axisThreshold[getPointerType(event)] : config.axisThreshold

      state.axis = selectAxis(state._movement, threshold)
    }

    // We block the movement if either:
    // - config.lockDirection or config.axis was set but axis isn't detected yet
    // - config.axis was set but is different than detected axis
    state._blocked =
      ((config.lockDirection || !!config.axis) && !state.axis) || (!!config.axis && config.axis !== state.axis)
  }

  restrictToAxis(v: Vector2) {
    if (this.config.axis || this.config.lockDirection) {
      switch (this.state.axis) {
        case 'x':
          v[1] = 0
          break // [ x, 0 ]
        case 'y':
          v[0] = 0
          break // [ 0, y ]
      }
    }
  }
}

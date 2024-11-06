import { commonConfigResolver } from './commonConfigResolver'
import { InternalCoordinatesOptions, CoordinatesConfig, Bounds, DragBounds, State, Vector2 } from '../types'

const DEFAULT_AXIS_THRESHOLD = 0

export const coordinatesConfigResolver = {
  ...commonConfigResolver,
  axis(
    this: InternalCoordinatesOptions,
    _v: any,
    _k: string,
    { axis }: CoordinatesConfig
  ): InternalCoordinatesOptions['axis'] {
    this.lockDirection = axis === 'lock'
    if (!this.lockDirection) return axis as any
  },
  axisThreshold(value = DEFAULT_AXIS_THRESHOLD) {
    return value
  },
  bounds(
    value: DragBounds | ((state: State) => DragBounds) = {}
  ): (() => EventTarget | null) | HTMLElement | [Vector2, Vector2] {
    if (typeof value === 'function') {
      // @ts-ignore
      return (state: State) => coordinatesConfigResolver.bounds(value(state))
    }

    if ('current' in value) {
      return () => value.current
    }

    if (typeof HTMLElement === 'function' && value instanceof HTMLElement) {
      return value
    }

    const { left = -Infinity, right = Infinity, top = -Infinity, bottom = Infinity } = value as Bounds

    return [
      [left, right],
      [top, bottom]
    ]
  }
}

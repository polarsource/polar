import { Vector2 } from '../types'

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max))
}

export const V = {
  toVector<T>(v: T | [T, T] | undefined, fallback?: T | [T, T]): [T, T] {
    if (v === undefined) v = fallback as T | [T, T]
    return Array.isArray(v) ? v : [v, v]
  },
  add(v1: Vector2, v2: Vector2): Vector2 {
    return [v1[0] + v2[0], v1[1] + v2[1]]
  },
  sub(v1: Vector2, v2: Vector2): Vector2 {
    return [v1[0] - v2[0], v1[1] - v2[1]]
  },
  addTo(v1: Vector2, v2: Vector2) {
    v1[0] += v2[0]
    v1[1] += v2[1]
  },
  subTo(v1: Vector2, v2: Vector2) {
    v1[0] -= v2[0]
    v1[1] -= v2[1]
  }
}

// Based on @aholachek ;)
// https://twitter.com/chpwn/status/285540192096497664
// iOS constant = 0.55

// https://medium.com/@nathangitter/building-fluid-interfaces-ios-swift-9732bb934bf5

function rubberband(distance: number, dimension: number, constant: number) {
  if (dimension === 0 || Math.abs(dimension) === Infinity) return Math.pow(distance, constant * 5)
  return (distance * dimension * constant) / (dimension + constant * distance)
}

export function rubberbandIfOutOfBounds(position: number, min: number, max: number, constant = 0.15) {
  if (constant === 0) return clamp(position, min, max)
  if (position < min) return -rubberband(min - position, max - min, constant) + min
  if (position > max) return +rubberband(position - max, max - min, constant) + max
  return position
}

export function computeRubberband(bounds: [Vector2, Vector2], [Vx, Vy]: Vector2, [Rx, Ry]: Vector2): Vector2 {
  const [[X0, X1], [Y0, Y1]] = bounds
  return [rubberbandIfOutOfBounds(Vx, X0, X1, Rx), rubberbandIfOutOfBounds(Vy, Y0, Y1, Ry)]
}

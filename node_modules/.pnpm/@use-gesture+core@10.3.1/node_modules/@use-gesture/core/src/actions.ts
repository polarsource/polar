import { GestureKey, EngineClass, Action } from './types'
import { ResolverMap } from './config/resolver'

import { DragEngine } from './engines/DragEngine'
import { dragConfigResolver } from './config/dragConfigResolver'

import { PinchEngine } from './engines/PinchEngine'
import { pinchConfigResolver } from './config/pinchConfigResolver'

import { MoveEngine } from './engines/MoveEngine'
import { moveConfigResolver } from './config/moveConfigResolver'

import { ScrollEngine } from './engines/ScrollEngine'
import { scrollConfigResolver } from './config/scrollConfigResolver'

import { WheelEngine } from './engines/WheelEngine'
import { wheelConfigResolver } from './config/wheelConfigResolver'

import { HoverEngine } from './engines/HoverEngine'
import { hoverConfigResolver } from './config/hoverConfigResolver'

export const EngineMap = new Map<GestureKey, EngineClass<any>>()
export const ConfigResolverMap = new Map<GestureKey, ResolverMap>()

export function registerAction(action: Action) {
  EngineMap.set(action.key, action.engine)
  ConfigResolverMap.set(action.key, action.resolver)
}

export const dragAction: Action = {
  key: 'drag',
  engine: DragEngine as any,
  resolver: dragConfigResolver
}

export const hoverAction: Action = {
  key: 'hover',
  engine: HoverEngine as any,
  resolver: hoverConfigResolver
}

export const moveAction: Action = {
  key: 'move',
  engine: MoveEngine as any,
  resolver: moveConfigResolver
}

export const pinchAction: Action = {
  key: 'pinch',
  engine: PinchEngine as any,
  resolver: pinchConfigResolver
}

export const scrollAction: Action = {
  key: 'scroll',
  engine: ScrollEngine as any,
  resolver: scrollConfigResolver
}

export const wheelAction: Action = {
  key: 'wheel',
  engine: WheelEngine as any,
  resolver: wheelConfigResolver
}

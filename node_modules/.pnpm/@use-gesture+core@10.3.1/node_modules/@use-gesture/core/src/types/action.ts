import type { ResolverMap } from '../config/resolver'
import type { Controller } from '../Controller'
import type { Engine } from '../engines/Engine'
import { GestureKey } from './config'

export type EngineClass<Key extends GestureKey> = {
  new (controller: Controller, args: any[], key: Key): Engine<Key>
}

export type Action = {
  key: GestureKey
  engine: EngineClass<GestureKey>
  resolver: ResolverMap
}

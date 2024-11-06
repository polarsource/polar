import { Line, RectAreaLight, Color } from 'three'

export class RectAreaLightHelper extends Line {
  readonly type: 'RectAreaLightHelper'
  constructor(light: RectAreaLight, color?: Color | string | number)

  light: RectAreaLight
  color: Color | string | number | undefined

  dispose(): void
}

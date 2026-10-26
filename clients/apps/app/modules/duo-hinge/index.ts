import { requireOptionalNativeModule, type NativeModule } from 'expo'
import { useEffect, useState } from 'react'

export interface DivisionRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface Hinge {
  status: 'unknown' | 'closed' | 'partiallyOpen' | 'fullyOpen'
  angle: number
  division?: DivisionRegion
}

type DuoHingeEvents = { onHingeChange: (hinge: Hinge) => void }

declare class DuoHingeModule extends NativeModule<DuoHingeEvents> {
  getHinge(): Hinge | null
}

const native = requireOptionalNativeModule<DuoHingeModule>('DuoHinge')

export const useHinge = () => {
  const [hinge, setHinge] = useState<Hinge | null>(
    () => native?.getHinge() ?? null,
  )

  useEffect(() => {
    if (!native) return
    const subscription = native.addListener('onHingeChange', setHinge)
    return () => subscription.remove()
  }, [])

  return hinge
}

export const foldProgress = (angle: number) => {
  if (!Number.isFinite(angle)) return 1
  return Math.min(1, Math.max(0, (Math.PI - angle) / (Math.PI / 2)))
}

'use client'

import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import {
  CardSection,
  CarouselSection,
  ColorsSection,
  CoverSection,
  EndSection,
  LogoSection,
  MissionSection,
  TypographySection,
  VoiceSection,
} from '../../../components/Brand'

const sectionComponents = [
  { id: 'cover', Component: CoverSection },
  { id: 'mission', Component: MissionSection },
  { id: 'cards', Component: CardSection },
  { id: 'logo', Component: LogoSection },
  { id: 'colors', Component: ColorsSection },
  { id: 'typography', Component: TypographySection },
  { id: 'voice', Component: VoiceSection },
  { id: 'carousel', Component: CarouselSection },
  { id: 'end', Component: EndSection },
]

const dotCursor = (fill: string) =>
  `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='10' fill='${fill}'/></svg>") 12 12, auto`

export default function BrandPage() {
  const { resolvedTheme } = useTheme()
  const cursor = useMemo(
    () => dotCursor(resolvedTheme === 'dark' ? 'white' : 'black'),
    [resolvedTheme],
  )

  return (
    <div
      className="dark:bg-polar-950 bg-white text-black dark:text-white"
      style={{ cursor }}
    >
      <div className="flex flex-col">
        {sectionComponents.map((section) => (
          <section key={section.id}>
            <section.Component />
          </section>
        ))}
      </div>
    </div>
  )
}

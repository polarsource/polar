'use client'

import { DitherSection } from '@/components/Brand/DitherSection'
import {
  ColorsSection,
  CoverSection,
  EndSection,
  ImagerySection,
  LogoSection,
  MissionSection,
  SpacingSection,
  TypographySection,
  VoiceSection,
} from '../../../components/Brand'

const sectionComponents = [
  { id: 'cover', Component: CoverSection },
  { id: 'mission', Component: MissionSection },
  { id: 'dither', Component: DitherSection },
  { id: 'logo', Component: LogoSection },
  { id: 'colors', Component: ColorsSection },
  { id: 'typography', Component: TypographySection },
  { id: 'spacing', Component: SpacingSection },
  { id: 'imagery', Component: ImagerySection },
  { id: 'voice', Component: VoiceSection },
  { id: 'end', Component: EndSection },
]

export default function BrandPage() {
  return (
    <div className="dark:bg-polar-950 bg-white text-black dark:text-white">
      <div className="flex h-full w-max flex-col">
        {sectionComponents.map((section, i) => (
          <section
            key={section.id}
            className="relative h-screen w-screen shrink-0"
          >
            <section.Component />
          </section>
        ))}
      </div>
    </div>
  )
}

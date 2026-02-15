'use client'

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
} from './components/Brand'

const sectionComponents = [
  { id: 'cover', Component: CoverSection },
  { id: 'mission', Component: MissionSection },
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
    <div className="dark:bg-polar-950 h-screen bg-white text-black dark:text-white">
      <div className="flex h-full w-max flex-col">
        {sectionComponents.map((section, i) => (
          <section
            key={section.id}
            className="relative h-screen w-screen shrink-0"
          >
            <section.Component />
            {i < sectionComponents.length - 1 && (
              <div className="absolute top-16 right-0 bottom-16 w-px" />
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

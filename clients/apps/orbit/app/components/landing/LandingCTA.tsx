import { TextRings } from '../TextRings'
import { SectionHeading } from './SectionHeading'
import { LandingSection } from './LandingSection'

export const LandingCTA = () => (
  <LandingSection>
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <div className="dark:bg-dark-900 relative overflow-hidden bg-neutral-50 p-2">
        <TextRings />
      </div>

      <div className="dark:bg-dark-900 flex flex-col items-center justify-center gap-y-16 bg-neutral-50 p-16 py-24 xl:gap-y-32">
        <SectionHeading>
          Painless billing <br />
          is a click away
        </SectionHeading>
        <a
          href="#"
          className="rounded-full bg-black px-24 py-16 text-4xl font-medium text-nowrap text-white transition hover:bg-neutral-800 xl:px-32 xl:py-24 xl:text-7xl dark:bg-white dark:text-black dark:hover:bg-neutral-300"
        >
          Get Started
        </a>
      </div>
    </div>
  </LandingSection>
)

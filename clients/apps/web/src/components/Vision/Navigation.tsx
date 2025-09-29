import { AnimatePresence } from 'framer-motion'
import { twMerge } from 'tailwind-merge'

export const sections = [
  'index.md',
  'usage-billing.md',
  'entitlements.md',
  'adapters.md',
  'open-source.md',
  'team.md',
  '> blog',
]

export const branches = [
  'main',
  'feat/company',
  'feat/careers',
  'feat/resources',
]

export const PitchNavigation = ({
  activeIndex,
  setIndex,
}: {
  activeIndex: number
  setIndex: (index: number) => void
}) => {
  return (
    <div className="flex w-48 flex-col gap-y-6 p-4 text-xs md:gap-x-16">
      <div className="flex flex-col gap-y-2">
        <span className="text-polar-500 px-1">Workspace</span>
        <ul className="flex flex-col gap-y-2 md:gap-x-8">
          <AnimatePresence key={activeIndex}>
            {sections.map((section, index) => (
              <li
                key={index}
                onClick={() => setIndex(index)}
                className={twMerge(
                  'hover:bg-polar-200 cursor-default px-1 hover:text-black',
                  index === activeIndex ? 'bg-polar-200 text-black' : '',
                )}
              >
                {section}
              </li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <div className="flex flex-col gap-y-2">
        <span className="text-polar-500 px-1">Branches</span>
        <ul className="flex flex-col gap-y-2 md:gap-x-8">
          <AnimatePresence key={activeIndex}>
            {branches.map((branch, index) => (
              <li
                key={index}
                className={twMerge(
                  'hover:bg-polar-200 cursor-default px-1 hover:text-black',
                  index === 0 ? 'bg-polar-200 text-black' : '',
                )}
              >
                {branch}
              </li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  )
}

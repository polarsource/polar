import { twMerge } from 'tailwind-merge'

export const sections = [
  {
    title: '00. Index',
    href: '/pitch',
  },
  {
    title: '01. Usage Based Future',
    href: '/pitch/what',
  },
  {
    title: '02. 7 LOC',
    href: '/pitch/why',
  },
  {
    title: '03. Polar 2.0',
    href: '/pitch/how',
  },
  {
    title: '04. Open Source',
    href: '/pitch/us',
  },
  {
    title: '05. Team',
    href: '/pitch/team',
  },
  {
    title: '06. Investors',
    href: '/pitch/investors',
  },
]

export const PitchNavigation = ({
  activeIndex,
  setIndex,
}: {
  activeIndex: number
  setIndex: (index: number) => void
}) => {
  return (
    <div className="flex flex-col gap-y-8 text-xs md:flex-row md:gap-x-16">
      <span>Polar Software Inc.</span>
      <ul className="flex flex-col gap-y-2 md:flex-row md:gap-x-8">
        {sections.map((section, index) => (
          <li
            key={index}
            onClick={() => setIndex(index)}
            className={twMerge(
              'hover:bg-polar-200 cursor-pointer px-1 hover:text-black',
              index === activeIndex ? 'bg-polar-200 text-black' : '',
            )}
          >
            {section.title}
          </li>
        ))}
      </ul>
    </div>
  )
}

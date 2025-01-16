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
    title: '02. Why',
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

export const PitchNavigation = ({ activeIndex }: { activeIndex: number }) => {
  return (
    <div className="flex flex-row gap-x-16 text-xs">
      <span>Polar Software Inc.</span>
      <ul className="flex flex-row gap-x-8">
        {sections.map((section, index) => (
          <li
            key={index}
            className={
              index === activeIndex ? 'bg-polar-200 px-1 text-black' : ''
            }
          >
            {section.title}
          </li>
        ))}
      </ul>
    </div>
  )
}

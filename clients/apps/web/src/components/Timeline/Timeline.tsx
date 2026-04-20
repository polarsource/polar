import { TimelineSection } from './types'
import { TimelineItem } from './TimelineItem'

export const Timeline = ({ sections }: { sections: TimelineSection[] }) => {
  return (
    <div className="space-y-8">
      {sections.map((section, index) => (
        <section
          key={`${section.formattedDate}-${index}`}
          className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:gap-8"
        >
          <h3 className="dark:text-polar-200 text-base font-medium text-gray-900 md:pt-2">
            {section.formattedDate}
          </h3>

          <div className="relative space-y-4">
            <div className="dark:bg-polar-700 absolute top-0 bottom-0 left-0 w-px bg-gray-200" />
            {section.items.map((item) => (
              <TimelineItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

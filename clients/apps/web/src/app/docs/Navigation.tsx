'use client'

import { sections } from './APINavigation'
import { NaviagtionItem } from './NavigationItem'

export const Navigation = () => {
  return (
    <div className="flex flex-col gap-y-8">
      {sections.map((section) => (
        <div key={section.name} className="flex flex-col gap-y-4">
          <h2 className="font-medium capitalize">{section.name}</h2>
          <div className="flex flex-col gap-y-2">
            {section.endpoints.map((endpoint) => (
              <NaviagtionItem
                key={endpoint.path}
                className="text-sm"
                href={endpoint.path}
              >
                <div className="flex w-full flex-row items-center justify-between gap-x-2">
                  {endpoint.name}
                  <span className="dark:bg-polar-700 rounded-sm bg-gray-500 px-1.5 py-0 font-mono text-[10px] font-normal uppercase">
                    {endpoint.method}
                  </span>
                </div>
              </NaviagtionItem>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

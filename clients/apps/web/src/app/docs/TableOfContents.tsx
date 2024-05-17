'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ToCItem {
  id: string
  text: string | null
  level: number
}

export const TableOfContents = () => {
  const [toc, setToc] = useState<ToCItem[]>([])
  const pathname = usePathname()

  useEffect(() => {
    const content = document.getElementById('mdx-wrapper')?.innerHTML

    if (content) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(content, 'text/html')
      const headers = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))

      const tocItems = headers.map((header) => ({
        id: header.id,
        text: header.textContent,
        level: parseInt(header.tagName.replace('H', ''), 10),
      }))

      setToc(tocItems)
    }

    return () => {
      setToc([])
    }
  }, [pathname])

  if (!toc.length) return null

  return (
    <nav className="flex w-full flex-col gap-y-4">
      <h3 className="text-black dark:text-white">Table of Contents</h3>
      <ul className="flex flex-col gap-y-2 text-sm">
        {toc.map((item) => (
          <a key={item.id} href={`#${item.id}`}>
            <li
              className={twMerge(
                'dark:text-polar-500 text-gray-500 transition-colors duration-200 ease-in-out hover:text-black dark:hover:text-white',
              )}
              // style={{ marginLeft: `${item.level - 1}em` }}
            >
              {item.text}
            </li>
          </a>
        ))}
      </ul>
    </nav>
  )
}

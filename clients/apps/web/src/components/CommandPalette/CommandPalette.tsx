'use client'

import { ContentPasteOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useContextualDocs } from './useContextualDocs'

const triggerClassName = 'py-1'

const buildCurlCommand = (method: string = 'GET', url: string) => {
  return `curl -X ${method} \\
${url} \\
-H "Content-type: application/json" \\
-H "Accept: application/json" \\
-H "Authorization: Bearer <token>"`
}

export interface CommandPaletteProps {}

export const CommandPalette = ({}: CommandPaletteProps) => {
  const [activeItem, setActiveItem] = useState<(typeof items)[number]>()

  const items = useContextualDocs()

  const copyCodeToClipboard = useCallback(
    (snippet: string) => () => {
      navigator.clipboard.writeText(snippet)
    },
    [],
  )

  useEffect(() => {
    setActiveItem(items[0])
  }, [items])

  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (!activeItem) return

      if (e.key === 'ArrowDown') {
        const currentIndex = items.findIndex(
          (item) => item.path === activeItem.path,
        )
        if (currentIndex < items.length - 1) {
          setActiveItem(items[currentIndex + 1])
        }
      } else if (e.key === 'ArrowUp') {
        const currentIndex = items.findIndex(
          (item) => item.path === activeItem.path,
        )
        if (currentIndex > 0) {
          setActiveItem(items[currentIndex - 1])
        }
      }
    }

    document.addEventListener('keydown', handleArrowKeys)

    return () => {
      document.removeEventListener('keydown', handleArrowKeys)
    }
  }, [items, activeItem])

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 flex w-full flex-grow flex-col overflow-hidden rounded-3xl border bg-gray-100">
      <div className="dark:bg-polar-950 dark:border-polar-800 flex flex-row border-b border-gray-200 bg-white px-8 py-6">
        <input
          className="dark:text-polar-50 dark:placeholder:text-polar-500 w-full border-none bg-transparent p-0 text-xl text-gray-950 placeholder:text-gray-400 focus:border-none focus:outline-none focus:ring-0"
          placeholder="Enter Command..."
          autoFocus
        />
      </div>
      <div className="flex h-[360px] flex-grow flex-row">
        <div className="flex h-full w-72 flex-shrink-0 flex-col gap-y-1 overflow-y-scroll p-4">
          {items.map((item) => {
            return (
              <CommandItem
                command={item.path
                  .split('/')
                  .slice(3)
                  .join(' ')
                  .replace('_', ' ')}
                description={item.path}
                method={Object.keys(item.methods)[0]}
                onClick={() => setActiveItem(item)}
                active={activeItem === item}
              />
            )
          })}
        </div>
        {activeItem && (
          <div className="flex h-full w-full flex-col py-4 pr-4">
            <div className="dark:bg-polar-950 flex h-full w-full flex-col rounded-2xl bg-white shadow-sm">
              <Tabs defaultValue="curl">
                <TabsList className="dark:border-polar-800 flex w-full flex-row items-center gap-x-4 rounded-none border-b border-gray-200 px-4 py-3 md:justify-between">
                  <div className="flex flex-row items-center">
                    <TabsTrigger
                      className={triggerClassName}
                      value="curl"
                      size="small"
                    >
                      cURL
                    </TabsTrigger>
                    <TabsTrigger
                      className={triggerClassName}
                      value="nodejs"
                      size="small"
                    >
                      NodeJS
                    </TabsTrigger>
                  </div>
                  <Button
                    className="dark:text-polar-500 text-gray-500 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
                    variant="ghost"
                    size="icon"
                    onClick={copyCodeToClipboard(
                      buildCurlCommand(
                        Object.keys(activeItem.methods)[0].toUpperCase(),
                        `https://api.polar.sh${activeItem.path}`,
                      ),
                    )}
                  >
                    <ContentPasteOutlined className="h-4 w-4" />
                  </Button>
                </TabsList>
                <TabsContent value="curl" className="p-2 py-0">
                  <pre className="dark:text-polar-50 select-all p-4 font-mono text-xs leading-normal text-gray-900">
                    {buildCurlCommand(
                      Object.keys(activeItem.methods)[0].toUpperCase(),
                      `https://api.polar.sh${activeItem.path}`,
                    )}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export interface CommandItemProps {
  command: string
  description: string
  method: string
  active?: boolean
  onClick: () => void
}

const CommandItem = ({
  command,
  description,
  method,
  active,
  onClick,
}: CommandItemProps) => {
  const ref = useRef<HTMLDivElement>(null)

  const handleSelect = useCallback(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  useEffect(() => {
    if (active) {
      handleSelect()
    }
  }, [active, handleSelect])

  return (
    <div
      ref={ref}
      className={twMerge(
        'dark:hover:bg-polar-800 flex scroll-m-4 flex-col gap-y-1 rounded-2xl border border-transparent px-4 py-3 text-sm transition-colors hover:cursor-pointer hover:bg-white dark:border-transparent',
        active
          ? 'dark:bg-polar-800 dark:border-polar-700 bg-white shadow-sm'
          : '',
      )}
      onClick={onClick}
    >
      <div className="flex flex-row items-center justify-between gap-x-3">
        <h3 className="dark:text-polar-50 font-medium capitalize text-gray-950">
          {command}
        </h3>
        <span className="py-.5 rounded-sm bg-blue-50 px-2 font-mono text-[9px] text-blue-500 dark:bg-blue-950 dark:text-blue-200">
          {method.toUpperCase()}
        </span>
      </div>
      <span className="dark:text-polar-500 truncate font-mono text-xs text-gray-500">
        {description}
      </span>
    </div>
  )
}

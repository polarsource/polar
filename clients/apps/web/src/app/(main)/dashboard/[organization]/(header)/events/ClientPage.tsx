'use client'

import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEventNames, useEvents } from '@/hooks/queries/events'

import {
  AddOutlined,
  ArrowDownward,
  ArrowUpward,
  Search,
} from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ClientPageProps {
  organization: schemas['Organization']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization }) => {
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'email',
      'created_at',
      '-email',
      'name',
      '-name',
    ] as const).withDefault('-created_at'),
  )
  const [query, setQuery] = useQueryState('query', parseAsString)
  const [selectedEventName, setSelectedEventName] = useQueryState(
    'eventName',
    parseAsString,
  )

  const { data: eventNames } = useEventNames(organization.id)
  const { data: events } = useEvents(organization.id, {
    name: selectedEventName ? [selectedEventName] : undefined,
  })

  return (
    <DashboardBody
      title={selectedEventName ? selectedEventName : 'Events'}
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
          <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
            <div>Events</div>
            <div className="flex flex-row items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() =>
                  setSorting(
                    sorting === '-created_at' ? 'created_at' : '-created_at',
                  )
                }
              >
                {sorting === 'created_at' ? (
                  <ArrowUpward fontSize="small" />
                ) : (
                  <ArrowDownward fontSize="small" />
                )}
              </Button>
              <Button size="icon" className="h-6 w-6" onClick={() => {}}>
                <AddOutlined fontSize="small" />
              </Button>
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 px-4 py-2">
            <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Search
                fontSize="inherit"
                className="dark:text-polar-500 text-gray-500"
              />
            </div>
            <Input
              className="w-full rounded-none border-none bg-transparent p-0 !shadow-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              placeholder="Search Events"
              value={query ?? undefined}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="dark:divide-polar-800 flex h-full flex-grow flex-col divide-y divide-gray-50 overflow-y-auto">
            {eventNames?.map((eventName) => (
              <div
                key={eventName.name}
                onClick={() => setSelectedEventName(eventName.name)}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedEventName === eventName.name &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <div className="flex flex-row items-center gap-3 px-4 py-3">
                  <div className="flex flex-col">
                    <div>{eventName.name}</div>
                    <div className="dark:text-polar-500 text-sm text-gray-500">
                      {eventName.events_count} Ingested Events
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
      wide
    >
      {selectedEventName ? (
        <Events events={events?.pages.flatMap((page) => page.items) ?? []} />
      ) : (
        <div className="mt-96 flex w-full flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-normal">No Event Entity Selected</h1>
          <p className="dark:text-polar-500 text-gray-500">
            Select an event entity to view its details
          </p>
        </div>
      )}
    </DashboardBody>
  )
}

export default ClientPage

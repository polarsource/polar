import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import CostsSidebarFilters from './components/CostsSidebarFilters'
import { CostsSidebarTitle } from './components/CostsSidebarTitle'

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { organization: string }
}) {
  const resolvedParams = await params
  const organizationSlug = resolvedParams.organization
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    organizationSlug,
  )

  return (
    <DashboardBody
      title={null}
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="flex h-full flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-6 px-4 pt-4">
            <CostsSidebarTitle organizationSlug={organizationSlug} />
          </div>
          <CostsSidebarFilters organization={organization} />

          {/*
          <div
            className={twMerge(
              'flex flex-col gap-y-6 overflow-y-auto px-4 pt-2 pb-4',
              hasScrolled && 'dark:border-polar-700 border-t border-gray-200',
            )}
            onScroll={handleScroll}
          >
            <div className="flex flex-row items-center gap-3">
              <Input
                placeholder="Search Events"
                value={query ?? undefined}
                onChange={(e) => setQuery(e.target.value)}
                preSlot={<Search fontSize="small" />}
              />
            </div>
            <div className="flex h-full grow flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Timeline</h3>
                <DateRangePicker
                  date={dateRange}
                  onDateChange={onDateRangeChange}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <h3 className="text-sm">Sorting</h3>
                <Select
                  value={sorting}
                  onValueChange={(value) =>
                    setSorting(value as '-timestamp' | 'timestamp')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-timestamp">Newest</SelectItem>
                    <SelectItem value="timestamp">Oldest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {Object.entries(eventTypes ?? {})
                .sort((a) => (a[0] === 'system' ? 1 : -1))
                .map(([source, eventTypes]) => {
                  if (eventTypes.length === 0) return null

                  return (
                    <div className="flex flex-col gap-y-2" key={source}>
                      <h3 className="text-sm capitalize">{source} Events</h3>
                      <List size="small" className="rounded-xl">
                        {eventTypes.map((eventType) => (
                          <ListItem
                            key={eventType.name}
                            size="small"
                            className="justify-between px-3 font-mono text-xs"
                            inactiveClassName="text-gray-500 dark:text-polar-500"
                            selected={selectedEventTypes?.includes(
                              eventType.name,
                            )}
                            onSelect={() =>
                              setSelectedEventTypes((prev) =>
                                prev && prev.includes(eventType.name)
                                  ? prev.filter(
                                      (name) => name !== eventType.name,
                                    )
                                  : ([
                                      ...(prev ?? []),
                                      eventType.name,
                                    ] as string[]),
                              )
                            }
                          >
                            <span className="w-full truncate">
                              {eventType.label}
                            </span>
                            <span className="text-xxs dark:text-polar-500 font-mono text-gray-500">
                              {Number(eventType.occurrences).toLocaleString(
                                'en-US',
                                {
                                  style: 'decimal',
                                  compactDisplay: 'short',
                                  notation: 'compact',
                                },
                              )}
                            </span>
                          </ListItem>
                        ))}
                      </List>
                    </div>
                  )
                })}
              <CustomerSelector
                organizationId={organization.id}
                selectedCustomerIds={selectedCustomerIds}
                onSelectCustomerIds={setSelectedCustomerIds}
              />

              <EventMetadataFilter
                metadata={Object.entries(metadata ?? {}).map(
                  ([key, value]) => ({
                    key,
                    value,
                  }),
                )}
                onChange={(metadata) => {
                  setMetadata(
                    metadata.reduce(
                      (acc, curr) => {
                        acc[curr.key] = curr.value
                        return acc
                      },
                      {} as Record<string, string | number | boolean>,
                    ),
                  )
                }}
              />
            </div>
          </div>
           */}
        </div>
      }
      wide
    >
      {children}
    </DashboardBody>
  )
}

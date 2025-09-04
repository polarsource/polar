'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MeterIngestionGuide } from '@/components/Meter/MeterIngestionGuide'
import { MeterPage } from '@/components/Meter/MeterPage'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { useToast } from '@/components/Toast/use-toast'
import { useMetersInfinite, useUpdateMeter } from '@/hooks/queries/meters'
import { useInViewport } from '@/hooks/utils'
import { apiErrorToast } from '@/utils/api/errors'
import {
  AddOutlined,
  ArrowDownward,
  ArrowUpward,
  CheckOutlined,
  FilterList,
  MoreVertOutlined,
  Search,
} from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [selectedMeterId, setSelectedMeterId] = useQueryState('selectedMeter', {
    defaultValue: '',
  })
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      'created_at',
      '-created_at',
      'name',
      '-name',
    ] as const).withDefault('-created_at'),
  )
  const [query, setQuery] = useQueryState('query', {
    defaultValue: '',
  })
  const [archivedFilter, _setArchivedFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(['all', 'active', 'archived'] as const).withDefault(
      'active',
    ),
  )
  const setArchivedFilter = (state: 'all' | 'active' | 'archived') => {
    setSelectedMeterId('')
    _setArchivedFilter(state)
  }

  const router = useRouter()

  const {
    isShown: isEditMeterModalShown,
    show: showEditMeterModal,
    hide: hideEditMeterModal,
  } = useModal()

  const { toast } = useToast()
  const updateMeter = useUpdateMeter(selectedMeterId)

  const { data, hasNextPage, fetchNextPage, isLoading } = useMetersInfinite(
    organization.id,
    {
      sorting: [sorting],
      query,
      is_archived:
        archivedFilter === 'all' ? undefined : archivedFilter === 'archived',
    },
  )

  const meters = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const selectedMeter = useMemo(() => {
    return meters?.find((meter) => meter.id === selectedMeterId)
  }, [meters, selectedMeterId])

  const { ref: loadingRef, inViewport } = useInViewport()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  useEffect(() => {
    if (!selectedMeterId) {
      setSelectedMeterId(meters[0]?.id ?? null)
    }
  }, [meters, selectedMeterId, setSelectedMeterId])

  const handleArchiveMeter = useCallback(
    async (meter: schemas['Meter']) => {
      const isArchiving = !meter.archived_at
      const { error } = await updateMeter.mutateAsync({
        is_archived: isArchiving,
      })

      if (error) {
        apiErrorToast(error, toast)
        return
      }

      toast({
        title: `Meter ${isArchiving ? 'archived' : 'unarchived'}`,
        description: `${meter.name} has been ${
          isArchiving ? 'archived' : 'unarchived'
        } successfully.`,
      })

      let filterArg = ''
      if (isArchiving) {
        filterArg = '&filter=archived'
      }

      router.push(
        `/dashboard/${organization.slug}/usage-billing/meters?selectedMeter=${meter.id}${filterArg}`,
      )
    },
    [updateMeter, toast, organization, router],
  )

  return (
    <DashboardBody
      title={
        selectedMeter ? (
          <div className="flex flex-col gap-y-4">
            <h2 className="text-2xl">{selectedMeter.name}</h2>
            <div className="flex flex-row items-center gap-x-2">
              <Status
                className="bg-emerald-50 capitalize text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500"
                status={`${selectedMeter.aggregation.func} Aggregation`}
              />
              {'property' in selectedMeter.aggregation && (
                <Status
                  className="dark:bg-polar-700 dark:text-polar-500 bg-gray-200 text-gray-500"
                  status={selectedMeter.aggregation.property}
                />
              )}
              {selectedMeter.archived_at && (
                <Status
                  className="bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-500"
                  status="Archived"
                />
              )}
            </div>
          </div>
        ) : (
          'Meters'
        )
      }
      header={
        selectedMeter && (
          <div className="flex flex-row items-center gap-4">
            <Button onClick={showEditMeterModal}>Edit Meter</Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none" asChild>
                <Button className="h-10 w-10" variant="secondary">
                  <MoreVertOutlined fontSize="inherit" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="dark:bg-polar-800 bg-gray-50 shadow-lg"
              >
                <DropdownMenuItem
                  onClick={() => handleArchiveMeter(selectedMeter)}
                >
                  {selectedMeter.archived_at ? 'Unarchive' : 'Archive'} Meter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      }
      className="h-full"
      contextViewPlacement="left"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
          <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
            <div>Meters</div>
            <div className="flex flex-row items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" className="h-6 w-6" variant="ghost">
                    <FilterList fontSize="small" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setArchivedFilter('all')}>
                    <CheckOutlined
                      className={twMerge(
                        'h-4 w-4',
                        archivedFilter !== 'all' && 'invisible',
                      )}
                    />
                    <span>All</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setArchivedFilter('active')}>
                    <CheckOutlined
                      className={twMerge(
                        'h-4 w-4',
                        archivedFilter !== 'active' && 'invisible',
                      )}
                    />
                    <span>Active</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setArchivedFilter('archived')}
                  >
                    <CheckOutlined
                      className={twMerge(
                        'h-4 w-4',
                        archivedFilter !== 'archived' && 'invisible',
                      )}
                    />
                    <span>Archived</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              <Link
                href={`/dashboard/${organization.slug}/usage-billing/meters/create`}
              >
                <Button size="icon" className="h-6 w-6">
                  <AddOutlined fontSize="small" />
                </Button>
              </Link>
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
              placeholder="Search Meters"
              value={query ?? undefined}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="dark:divide-polar-800 flex h-full flex-grow flex-col divide-y divide-gray-50 overflow-y-auto">
            {meters.map((meter) => (
              <div
                key={meter.id}
                onClick={() => setSelectedMeterId(meter.id)}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedMeter?.id === meter.id &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <div className="flex min-w-0 flex-col gap-y-1 px-6 py-2">
                  <div className="flex items-center gap-x-2">
                    <div className="w-full truncate text-sm">{meter.name}</div>
                  </div>
                  <div className="w-full truncate text-xs capitalize text-gray-500 dark:text-gray-500">
                    {meter.aggregation.func}
                  </div>
                </div>
              </div>
            ))}
            {hasNextPage && (
              <div
                ref={loadingRef}
                className="flex w-full items-center justify-center py-8"
              >
                <Spinner />
              </div>
            )}
          </div>
        </div>
      }
      wide
    >
      {selectedMeter ? (
        <MeterPage
          meter={selectedMeter}
          organization={organization}
          isEditMeterModalShown={isEditMeterModalShown}
          hideEditMeterModal={hideEditMeterModal}
        />
      ) : !isLoading && !selectedMeterId ? (
        <MeterIngestionGuide />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      )}
    </DashboardBody>
  )
}

export default ClientPage

'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { MeterPage } from '@/components/Meter/MeterPage'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useUpdateMeter } from '@/hooks/queries/meters'
import { apiErrorToast } from '@/utils/api/errors'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  meter: schemas['Meter']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization, meter }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentFilter = searchParams.get('filter') ?? 'active'

  const {
    isShown: isEditMeterModalShown,
    show: showEditMeterModal,
    hide: hideEditMeterModal,
  } = useModal()

  const { toast } = useToast()
  const updateMeter = useUpdateMeter(meter.id)

  const handleArchiveMeter = useCallback(async () => {
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

    if (isArchiving) {
      // When archiving with "active" filter, redirect to next active meter
      // Similar to archiving an email - you stay in inbox and move to next email
      if (currentFilter === 'active') {
        const queryString = searchParams.toString()
        // Redirect to meters list, which will find and redirect to first active meter
        router.push(
          `/dashboard/${organization.slug}/products/meters${queryString ? `?${queryString}` : ''}`,
        )
      }
      // When archiving with "all" filter, stay on meter (it's still visible)
    } else {
      // When unarchiving with "archived" filter, update to "active" so sidebar shows the meter
      if (currentFilter === 'archived') {
        const params = new URLSearchParams(searchParams.toString())
        params.set('filter', 'active')
        router.push(
          `/dashboard/${organization.slug}/products/meters/${meter.id}?${params.toString()}`,
        )
      }
      // When unarchiving with "all" or "active" filter, stay on meter
    }
  }, [
    updateMeter,
    toast,
    organization,
    meter,
    router,
    searchParams,
    currentFilter,
  ])

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <div className="flex flex-col gap-y-4">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <h2 className="text-2xl">{meter.name}</h2>
            <div className="flex flex-row items-center gap-x-2">
              <Status
                className="bg-emerald-50 text-emerald-500 capitalize dark:bg-emerald-950 dark:text-emerald-500"
                status={`${meter.aggregation.func} Aggregation`}
              />
              {'property' in meter.aggregation && (
                <Status
                  className="dark:bg-polar-700 dark:text-polar-500 bg-gray-200 text-gray-500"
                  status={meter.aggregation.property}
                />
              )}
              {meter.archived_at && (
                <Status
                  className="bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-500"
                  status="Archived"
                />
              )}
            </div>
          </div>

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
                  destructive={!meter.archived_at}
                  onClick={handleArchiveMeter}
                >
                  {meter.archived_at ? 'Unarchive' : 'Archive'} Meter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      }
    >
      <MeterPage
        meter={meter}
        organization={organization}
        isEditMeterModalShown={isEditMeterModalShown}
        hideEditMeterModal={hideEditMeterModal}
      />
    </MasterDetailLayoutContent>
  )
}

export default ClientPage

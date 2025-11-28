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
import { useRouter } from 'next/navigation'
import React, { useCallback } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  meter: schemas['Meter']
}

const ClientPage: React.FC<ClientPageProps> = ({ organization, meter }) => {
  const router = useRouter()

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
      router.push(
        `/dashboard/${organization.slug}/products/meters/${meter.id}?filter=all`,
      )
    }
  }, [updateMeter, toast, organization, meter, router])

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <div className="flex flex-col gap-y-4">
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

'use client'

import Dropzone from '@/components/Benefit/Files/Dropzone'
import EmptyLayout from '@/components/Layout/EmptyLayout'
import { useUpdateOrganization } from '@/hooks/queries'
import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const updateOrganization = useUpdateOrganization()

  const router = useRouter()

  return (
    <EmptyLayout>
      <div className="dark:text-polar-200 flex flex-col text-gray-600">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="dark:text-polar-50 text-2xl font-medium text-gray-950">
            File upload demo
          </h2>
          <Dropzone
            organization={organization}
            onUploaded={() => console.log('uploaded')}
          />
        </div>
      </div>
    </EmptyLayout>
  )
}

'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { AIProductChat } from './AIProductChat'
import Link from 'next/link'
import { Button } from '@polar-sh/orbit'
import { ArrowLeftIcon } from 'lucide-react'

export default function AIProductPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody
      title="Create Product"
      wrapperClassName="max-w-(--breakpoint-md)!"
      className="gap-y-8"
      header={
        <Link href={`/dashboard/${organization.slug}/products/new`}>
          <Button variant="secondary">
            <ArrowLeftIcon className="mr-2" />
            Configure manually
          </Button>
        </Link>
      }
    >
      <AIProductChat organization={organization} />
    </DashboardBody>
  )
}

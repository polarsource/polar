'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { OrganizationUpdate } from '@polar-sh/sdk'
import { Form } from 'polarkit/components/ui/form'
import { useContext } from 'react'
import { useForm } from 'react-hook-form'
import { PublicPagePreview } from './PublicPagePreview'
import { PublicPageSidebar } from './PublicPageSidebar'

export const PublicPageCustomization = () => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const form = useForm<OrganizationUpdate>({
    defaultValues: {
      ...organization,
    },
  })

  return (
    <div className="ml-4 flex h-full flex-grow flex-row gap-x-4">
      <Form {...form}>
        <PublicPagePreview />
        <PublicPageSidebar />
      </Form>
    </div>
  )
}

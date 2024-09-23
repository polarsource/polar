'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { OrganizationUpdate } from '@polar-sh/sdk'
import { Form } from 'polarkit/components/ui/form'
import { useContext } from 'react'
import { useForm } from 'react-hook-form'
import { StorefrontPreview } from './StorefrontPreview'
import { StorefrontSidebar } from './StorefrontSidebar'

export const StorefrontCustomization = () => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const form = useForm<OrganizationUpdate>({
    defaultValues: {
      ...organization,
    },
  })

  return (
    <Form {...form}>
      <StorefrontPreview />
      <StorefrontSidebar />
    </Form>
  )
}

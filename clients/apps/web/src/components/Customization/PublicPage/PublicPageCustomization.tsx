'use client'

import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ArrowBack } from '@mui/icons-material'
import { OrganizationUpdate } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { Form } from 'polarkit/components/ui/form'
import { useContext } from 'react'
import { useForm } from 'react-hook-form'
import {
  CustomizationContextMode,
  useCustomizationContext,
} from '../CustomizationProvider'
import { PublicPagePreview } from './PublicPagePreview'
import { PublicPageSidebar } from './PublicPageSidebar'

export const PublicPageCustomization = () => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const router = useRouter()
  const { currentUser } = useAuth()

  const { customizationMode, setCustomizationMode } = useCustomizationContext()

  const form = useForm<OrganizationUpdate>({
    defaultValues: {
      ...organization,
    },
  })

  return (
    <div className="flex h-full flex-col px-8 pt-8">
      <ShadowBox className="relative z-50 flex flex-row items-center justify-between px-12 py-8">
        <div className="flex flex-row items-center gap-x-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-12 w-12 text-black dark:text-white"
            onClick={() => {
              router.push(`/dashboard/${organization.slug}`)
            }}
            tabIndex={-1}
          >
            <ArrowBack fontSize="small" />
          </Button>
          <h1 className="text-xl">Customize</h1>
        </div>
        <Tabs
          className="absolute left-1/2 flex -translate-x-1/2 flex-row items-center"
          value={customizationMode}
          onValueChange={(value) => {
            setCustomizationMode(value as CustomizationContextMode)
          }}
        >
          <TabsList>
            <TabsTrigger value="public_page">Public Page</TabsTrigger>
            <TabsTrigger value="checkout" disabled>
              Checkout
            </TabsTrigger>
            <TabsTrigger value="receipt" disabled>
              Receipt
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <PublicProfileDropdown
          authenticatedUser={currentUser}
          className="flex-shrink-0"
          showAllBackerRoutes
        />
      </ShadowBox>
      <div className="flex min-h-0 flex-grow flex-row">
        <Form {...form}>
          <PublicPagePreview />
          <PublicPageSidebar />
        </Form>
      </div>
    </div>
  )
}

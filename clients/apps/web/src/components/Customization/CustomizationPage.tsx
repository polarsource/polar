'use client'

import {
  CustomizationContextMode,
  CustomizationProvider,
  useCustomizationContext,
} from '@/components/Customization/CustomizationProvider'
import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { useAuth } from '@/hooks'
import { useProduct } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ArrowBack } from '@mui/icons-material'
import { OrganizationUpdate } from '@polar-sh/sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { Form } from 'polarkit/components/ui/form'
import { useContext, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { CheckoutCustomization } from './Checkout/CheckoutCustomization'
import { PortalCustomization } from './Portal/PortalCustomization'
import { StorefrontCustomization } from './Storefront/StorefrontCustomization'
import { StorefrontSidebar } from './Storefront/StorefrontSidebar'

export const CustomizationPage = () => {
  const search = useSearchParams()

  return (
    <CustomizationProvider
      initialCustomizationMode={
        (search.get('mode') as CustomizationContextMode) ?? undefined
      }
    >
      <Customization />
    </CustomizationProvider>
  )
}

const Customization = () => {
  const { organization } = useContext(MaintainerOrganizationContext)
  const { setCustomizationMode, customizationMode } = useCustomizationContext()

  const router = useRouter()
  const { currentUser } = useAuth()
  const params = useSearchParams()
  const productId = params.get('productId')

  const { data: product, isLoading } = useProduct(productId ?? '')

  const customizationContent = useMemo(() => {
    switch (customizationMode) {
      case 'checkout':
        return isLoading ? null : <CheckoutCustomization product={product} />
      case 'portal':
        return <PortalCustomization />
      case 'storefront':
      default:
        return <StorefrontCustomization />
    }
  }, [customizationMode, product, isLoading])

  const form = useForm<OrganizationUpdate>({
    defaultValues: {
      ...organization,
    },
  })

  return (
    <div className="dark:bg-polar-950 flex h-full flex-col bg-gray-100 px-8">
      <div className="relative z-50 flex flex-row items-center justify-between py-8">
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
          <h1 className="text-xl">Storefront</h1>
        </div>
        <Tabs
          className="absolute left-1/2 flex -translate-x-1/2 flex-row items-center"
          value={customizationMode}
          onValueChange={(value) => {
            setCustomizationMode(value as CustomizationContextMode)
          }}
        >
          <TabsList className="rounded-full bg-gray-200 dark:bg-transparent">
            <TabsTrigger
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              value="storefront"
            >
              Storefront
            </TabsTrigger>
            <TabsTrigger
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              value="checkout"
            >
              Checkout
            </TabsTrigger>
            <TabsTrigger
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              value="portal"
            >
              Portal
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <PublicProfileDropdown
          authenticatedUser={currentUser}
          className="flex-shrink-0"
        />
      </div>
      <Form {...form}>
        <div className="flex min-h-0 flex-grow flex-row gap-x-6 pb-8">
          {customizationContent}
          {customizationMode === 'storefront' && <StorefrontSidebar />}
        </div>
      </Form>
    </div>
  )
}

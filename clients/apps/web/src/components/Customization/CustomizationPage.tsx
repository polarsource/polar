'use client'

import {
  CustomizationContextMode,
  CustomizationProvider,
  useCustomizationContext,
} from '@/components/Customization/CustomizationProvider'
import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { ArrowBack } from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { useContext, useMemo } from 'react'
import { CheckoutCustomization } from './Checkout/CheckoutCustomization'
import { StorefrontCustomization } from './Storefront/StorefrontCustomization'

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

  const customizationContent = useMemo(() => {
    switch (customizationMode) {
      case 'checkout':
        return <CheckoutCustomization />
      case 'storefront':
      default:
        return <StorefrontCustomization />
    }
  }, [customizationMode])

  return (
    <div className="flex h-full flex-col px-8">
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
          <TabsList>
            <TabsTrigger value="storefront">Storefront</TabsTrigger>
            <TabsTrigger value="checkout">Checkout</TabsTrigger>
          </TabsList>
        </Tabs>
        <PublicProfileDropdown
          authenticatedUser={currentUser}
          className="flex-shrink-0"
        />
      </div>
      <div className="flex min-h-0 flex-grow flex-row gap-x-8 pb-8">
        {customizationContent}
      </div>
    </div>
  )
}

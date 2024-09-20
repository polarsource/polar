'use client'

import {
  CustomizationContextMode,
  CustomizationProvider,
} from '@/components/Customization/CustomizationProvider'
import { useSearchParams } from 'next/navigation'
import { StorefrontCustomization } from './Storefront/StorefrontCustomization'

export const CustomizationPage = () => {
  const search = useSearchParams()

  return (
    <CustomizationProvider
      initialCustomizationMode={
        (search.get('mode') as CustomizationContextMode) ?? undefined
      }
    >
      <StorefrontCustomization />
    </CustomizationProvider>
  )
}

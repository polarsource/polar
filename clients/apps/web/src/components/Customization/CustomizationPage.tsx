'use client'

import {
  CustomizationContextMode,
  CustomizationProvider,
} from '@/components/Customization/CustomizationProvider'
import { useSearchParams } from 'next/navigation'
import { PublicPageCustomization } from './PublicPage/PublicPageCustomization'

export const CustomizationPage = () => {
  const search = useSearchParams()

  return (
    <CustomizationProvider
      initialCustomizationMode={
        (search.get('mode') as CustomizationContextMode) ?? undefined
      }
    >
      <PublicPageCustomization />
    </CustomizationProvider>
  )
}

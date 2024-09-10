'use client'

import {
  CustomizationContextMode,
  CustomizationProvider,
} from '@/components/Customization/CustomizationProvider'
import { CustomizationSidebar } from '@/components/Customization/CustomizationSidebar'
import { useSearchParams } from 'next/navigation'
import { CustomizationPreview } from './CustomizationPreview'

export const CustomizationPage = () => {
  const search = useSearchParams()

  return (
    <CustomizationProvider
      initialCustomizationMode={
        (search.get('mode') as CustomizationContextMode) ?? undefined
      }
    >
      <div className="ml-4 flex h-full flex-grow flex-row gap-x-4">
        <CustomizationPreview />
        <CustomizationSidebar />
      </div>
    </CustomizationProvider>
  )
}

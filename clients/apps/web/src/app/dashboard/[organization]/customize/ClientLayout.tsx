'use client'

import {
  CustomizationContextMode,
  CustomizationProvider,
} from '@/components/Customization/CustomizationProvider'
import { CustomizationSidebar } from '@/components/Customization/CustomizationSidebar'
import { useSearchParams } from 'next/navigation'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const search = useSearchParams()

  return (
    <CustomizationProvider
      initialCustomizationMode={
        (search.get('mode') as CustomizationContextMode) ?? undefined
      }
    >
      <div className="ml-4 flex h-full flex-grow flex-row gap-x-4">
        {children}
        <CustomizationSidebar />
      </div>
    </CustomizationProvider>
  )
}

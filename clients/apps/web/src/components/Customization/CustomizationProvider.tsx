import { usePathname, useRouter } from 'next/navigation'
import React, { PropsWithChildren, useEffect } from 'react'

export type CustomizationContextMode =
  | 'storefront'
  | 'checkout'
  | 'confirmation'
  | 'portal'

export type CustomizationContextValue = {
  readonly customizationMode: CustomizationContextMode
  readonly setCustomizationMode: (mode: CustomizationContextMode) => void
}

const defaultCustomizationContext: CustomizationContextValue = {
  customizationMode: 'storefront',
  setCustomizationMode: () => {},
}

export const CustomizationContext =
  React.createContext<CustomizationContextValue>(defaultCustomizationContext)

export const CustomizationProvider = ({
  children,
  initialCustomizationMode = 'storefront',
}: PropsWithChildren<{
  initialCustomizationMode?: CustomizationContextMode
}>) => {
  const [customizationMode, setCustomizationMode] =
    React.useState<CustomizationContextMode>(initialCustomizationMode)

  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    router.replace(`${pathname}?mode=${customizationMode}`)
  }, [customizationMode])

  return (
    <CustomizationContext.Provider
      value={{
        customizationMode,
        setCustomizationMode,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  )
}

export const useCustomizationContext = () =>
  React.useContext(CustomizationContext)

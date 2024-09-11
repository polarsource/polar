import React, { PropsWithChildren } from 'react'

export type CustomizationContextMode = 'public_page' | 'checkout' | 'receipt'

export type CustomizationContextValue = {
  readonly customizationMode: CustomizationContextMode
  readonly setCustomizationMode: (mode: CustomizationContextMode) => void
}

const defaultCustomizationContext: CustomizationContextValue = {
  customizationMode: 'public_page',
  setCustomizationMode: () => {},
}

export const CustomizationContext =
  React.createContext<CustomizationContextValue>(defaultCustomizationContext)

export const CustomizationProvider = ({
  children,
  initialCustomizationMode = 'public_page',
}: PropsWithChildren<{
  initialCustomizationMode?: CustomizationContextMode
}>) => {
  const [customizationMode, setCustomizationMode] =
    React.useState<CustomizationContextMode>(initialCustomizationMode)

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

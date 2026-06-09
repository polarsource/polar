'use client'

import React, { createContext, useContext, useState } from 'react'

interface AccountSetupContextType {
  targetStepKey: string | null
  setTargetStepKey: (key: string | null) => void
}

const AccountSetupContext = createContext<AccountSetupContextType>({
  targetStepKey: null,
  setTargetStepKey: () => {},
})

export const AccountSetupProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [targetStepKey, setTargetStepKey] = useState<string | null>(null)
  return (
    <AccountSetupContext.Provider value={{ targetStepKey, setTargetStepKey }}>
      {children}
    </AccountSetupContext.Provider>
  )
}

export const useAccountSetup = () => useContext(AccountSetupContext)

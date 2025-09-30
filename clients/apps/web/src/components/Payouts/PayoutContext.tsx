import { schemas } from '@polar-sh/client'
import React, { createContext, ReactNode, useContext, useState } from 'react'

interface PayoutContextType {
  selectedPayout: schemas['Payout'] | null
  setSelectedPayout: (payout: schemas['Payout'] | null) => void
  isInvoiceModalOpen: boolean
  openInvoiceModal: () => void
  closeInvoiceModal: () => void
}

const PayoutContext = createContext<PayoutContextType | undefined>(undefined)

export const PayoutProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selectedPayout, setSelectedPayout] = useState<
    schemas['Payout'] | null
  >(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

  const openInvoiceModal = () => setIsInvoiceModalOpen(true)
  const closeInvoiceModal = () => setIsInvoiceModalOpen(false)

  return (
    <PayoutContext.Provider
      value={{
        selectedPayout,
        setSelectedPayout,
        isInvoiceModalOpen,
        openInvoiceModal,
        closeInvoiceModal,
      }}
    >
      {children}
    </PayoutContext.Provider>
  )
}

export const usePayoutContext = (): PayoutContextType => {
  const context = useContext(PayoutContext)
  if (context === undefined) {
    throw new Error('usePayoutContext must be used within a PayoutProvider')
  }
  return context
}

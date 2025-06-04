import { useAuth } from '@/hooks'
import { schemas } from '@polar-sh/client'
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

interface PayoutContextType {
  selectedPayout: schemas['Payout'] | null
  setSelectedPayout: (payout: schemas['Payout'] | null) => void
  isInvoiceModalOpen: boolean
  openInvoiceModal: () => void
  closeInvoiceModal: () => void
}

const PayoutContext = createContext<PayoutContextType | undefined>(undefined)

const easterEggHashes = [
  '3d78225070c6757c38ea6d96350e3851a222123796caf1a227c56609ce290d0c',
  '86475299acf4d433298daa726772ba20428bcd571f77b5d5ee2e13dcc51f2e23',
]

export const PayoutProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selectedPayout, setSelectedPayout] = useState<
    schemas['Payout'] | null
  >(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

  const { currentUser } = useAuth()
  const [emailHash, setEmailHash] = useState('')
  const [easterEggShown, setEasterEggShown] = useState(false)
  useEffect(() => {
    if (currentUser?.email) {
      crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(currentUser.email))
        .then((hashBuffer) => {
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hashString = hashArray
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
          setEmailHash(hashString)
        })
    }
  }, [currentUser])

  const openInvoiceModal = () => {
    if (easterEggHashes.includes(emailHash) && !easterEggShown) {
      window.open(
        'https://youtu.be/RfiQYRn7fBg?si=EYUI3_UrAhD5qNfa&t=12',
        '_blank',
      )
      setEasterEggShown(true)
      return
    }
    setIsInvoiceModalOpen(true)
  }
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

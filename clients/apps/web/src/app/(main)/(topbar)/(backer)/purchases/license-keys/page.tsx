import { PurchasesQueryParametersContextProvider } from '@/components/Purchases/PurchasesQueryParametersContext'
import ClientPage from './ClientPage'

export default function Page() {
  return (
    <PurchasesQueryParametersContextProvider>
      <ClientPage />
    </PurchasesQueryParametersContextProvider>
  )
}

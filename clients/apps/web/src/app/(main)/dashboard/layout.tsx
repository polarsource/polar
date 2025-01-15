import { Toaster } from '@/components/Toast/Toaster'
import { PropsWithChildren, Suspense } from 'react'

export default async function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex h-full flex-col md:h-screen">
      {children}
      <Suspense>
        <Toaster />
      </Suspense>
    </div>
  )
}

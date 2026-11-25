import { Toaster } from '@/components/Toast/Toaster'
import { requireAuthenticatedUser } from '@/utils/user'
import { PropsWithChildren, Suspense } from 'react'

export default async function Layout({ children }: PropsWithChildren) {
  await requireAuthenticatedUser()

  return (
    <div className="flex h-full flex-col md:h-screen">
      {children}
      <Suspense>
        <Toaster />
      </Suspense>
    </div>
  )
}

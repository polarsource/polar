import { Toaster } from '@/components/Toast/Toaster'
import { AuthProvider } from '@/providers/AuthProvider'
import { requireAuthenticatedUser } from '@/utils/user'
import { PropsWithChildren, Suspense } from 'react'

export default async function Layout({ children }: PropsWithChildren) {
  await requireAuthenticatedUser()

  return (
    <AuthProvider>
      <div className="flex h-full flex-col md:h-screen">
        {children}
        <Suspense>
          <Toaster />
        </Suspense>
      </div>
    </AuthProvider>
  )
}

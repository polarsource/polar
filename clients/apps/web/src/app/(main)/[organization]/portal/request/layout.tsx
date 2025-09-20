import { Toaster } from '@/components/Toast/Toaster'

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="w-full max-w-md">
        {children}
      </div>
      <Toaster />
    </div>
  )
}

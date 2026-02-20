import { OrbitNav } from '@/components/Orbit/OrbitNav'
import type { ReactNode } from 'react'

export default function OrbitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <OrbitNav />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="max-w-3xl px-12 py-16">{children}</div>
      </main>
    </div>
  )
}

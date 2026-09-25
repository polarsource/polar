import { MigrationPanelPreview } from '@/app/(main)/dashboard/[organization]/(header)/settings/migrations/review/MigrationPanelPreview'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Migration panel preview',
  robots: { index: false, follow: false },
}

export default function Page() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <Suspense>
      <MigrationPanelPreview />
    </Suspense>
  )
}

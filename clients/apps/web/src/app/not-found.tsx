import LandingLayout from '@/components/Landing/LandingLayout'
import { NotFound } from '@/components/Landing/NotFound'
import { Suspense } from 'react'
import { PolarThemeProvider } from './providers'

export default function RootNotFound() {
  return (
    <Suspense>
      <PolarThemeProvider>
        <LandingLayout>
          <NotFound />
        </LandingLayout>
      </PolarThemeProvider>
    </Suspense>
  )
}

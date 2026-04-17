import { LandingNav } from './components/landing/LandingNav'
import { LandingHero } from './components/landing/LandingHero'
import { LandingProduct } from './components/landing/LandingProduct'
import { LandingPayments } from './components/landing/LandingPayments'
import { LandingArchitecture } from './components/landing/LandingArchitecture'
import { LandingMetrics } from './components/landing/LandingMetrics'
import { LandingCTA } from './components/landing/LandingCTA'
import { LandingFooter } from './components/landing/LandingFooter'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <LandingNav />
      <LandingHero />
      <LandingProduct />
      <LandingPayments />
      <LandingArchitecture />
      <LandingMetrics />
      <LandingCTA />
      <LandingFooter />
    </div>
  )
}

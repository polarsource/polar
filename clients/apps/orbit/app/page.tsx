import { LandingNav } from './components/landing/LandingNav'
import { LandingHero } from './components/landing/LandingHero'
import { LandingProduct } from './components/landing/LandingProduct'
import { LandingArchitecture } from './components/landing/LandingArchitecture'
import { LandingMetrics } from './components/landing/LandingMetrics'
import { LandingTestimonials } from './components/landing/LandingTestimonials'
import { LandingCTA } from './components/landing/LandingCTA'
import { LandingFooter } from './components/landing/LandingFooter'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <LandingNav />
      <LandingHero />
      <LandingArchitecture />
      <LandingProduct />
      <LandingMetrics />
      <LandingTestimonials />
      <LandingCTA />
      <LandingFooter />
    </div>
  )
}

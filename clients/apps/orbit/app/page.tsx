import { LandingNav } from './components/landing/LandingNav'
import { LandingArchitecture } from './components/landing/LandingArchitecture'
import { LandingProduct } from './components/landing/LandingProduct'
import { LandingVision } from './components/landing/LandingVision'
import { LandingOffering } from './components/landing/LandingOffering'
import { LandingPricing } from './components/landing/LandingPricing'
import { LandingTestimonials } from './components/landing/LandingTestimonials'
import { LandingCTA } from './components/landing/LandingCTA'
import { LandingFooter } from './components/landing/LandingFooter'
import { LandingHero } from './components/landing/LandingHero'

export default function Home() {
  return (
    <div className="flex flex-col">
      <LandingNav />
      <LandingHero />
      <LandingArchitecture />
      <LandingVision />
      <LandingOffering />
      <LandingProduct />
      <LandingTestimonials />
      <LandingCTA />
      <LandingPricing />
      <LandingFooter />
    </div>
  )
}

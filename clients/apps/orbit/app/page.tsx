import { LandingNav } from './components/landing/LandingNav'
import { LandingArchitecture } from './components/landing/LandingArchitecture'
import { LandingProduct } from './components/landing/LandingProduct'
import { LandingOffering } from './components/landing/LandingOffering'
import { LandingPricing } from './components/landing/LandingPricing'
import { LandingTestimonials } from './components/landing/LandingTestimonials'
import { LandingCTA } from './components/landing/LandingCTA'
import { LandingFooter } from './components/landing/LandingFooter'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav />
      <LandingArchitecture />
      <LandingProduct />
      <LandingOffering />
      <LandingTestimonials />
      <LandingPricing />
      <LandingCTA />
      <LandingFooter />
    </div>
  )
}
